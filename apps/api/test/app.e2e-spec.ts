import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupTestDatabase, TestDatabaseContext } from './test-database';

describe('API integration (e2e)', () => {
  let app: INestApplication<App>;
  let database: TestDatabaseContext;

  type AuthResponse = {
    accessToken: string;
    merchant: {
      id: string;
      email: string;
    };
  };

  type ApiKeyResponse = {
    key: string;
  };

  type PaymentResponse = {
    id: string;
    status: string;
    cryptoInvoice: {
      status: string;
      address: string;
    };
  };

  type PaymentTransitionResponse = {
    payment: {
      status: string;
    };
  };

  type PaymentDetailResponse = {
    status: string;
    cryptoInvoice: {
      status: string;
      transactions: Array<{
        status: string;
      }>;
    };
  };

  type WebhookDelivery = {
    eventType: string;
    paymentIntentId: string | null;
  };

  beforeAll(async () => {
    database = await setupTestDatabase();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
        stopAtFirstError: true,
        validateCustomDecorators: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.get(PrismaService).$disconnect();
      await app.close();
    }

    if (database) {
      await database.teardown();
    }
  });

  function buildMerchantEmail(label: string) {
    return `${label}.${Date.now()}@example.com`;
  }

  async function registerMerchant(label: string) {
    const email = buildMerchantEmail(label);
    const password = 'supersecurepassword';
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: `Merchant ${label}`,
        email,
        password,
      })
      .expect(201);
    const body = response.body as AuthResponse;

    return {
      email,
      password,
      accessToken: body.accessToken,
      merchantId: body.merchant.id,
    };
  }

  async function createApiKey(accessToken: string) {
    const response = await request(app.getHttpServer())
      .post('/merchant/api-keys')
      .set('authorization', `Bearer ${accessToken}`)
      .send({ name: 'server' })
      .expect(201);
    const body = response.body as ApiKeyResponse;

    return body.key;
  }

  async function configureWebhook(accessToken: string) {
    await request(app.getHttpServer())
      .patch('/merchant/settings')
      .set('authorization', `Bearer ${accessToken}`)
      .send({ webhookUrl: 'https://merchant.test/webhook' })
      .expect(200);
  }

  async function createCryptoPayment(apiKey: string, reference: string) {
    const response = await request(app.getHttpServer())
      .post('/v1/payments')
      .set('authorization', `Bearer ${apiKey}`)
      .set('idempotency-key', reference)
      .send({
        amount: 25,
        currency: 'USD',
        method: 'CRYPTO',
        asset: 'USDC',
        chain: 'BASE',
        reference,
        description: 'Order 1001',
        customerEmail: 'buyer@example.com',
      })
      .expect(201);
    const body = response.body as PaymentResponse;

    return body;
  }

  it('registers and logs in a merchant', async () => {
    const email = buildMerchantEmail('auth');
    const password = 'supersecurepassword';

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Merchant auth',
        email,
        password,
      })
      .expect(201);
    const registerBody = registerResponse.body as AuthResponse;

    expect(registerBody.accessToken).toEqual(expect.any(String));
    expect(registerBody.merchant.email).toBe(email);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        password,
      })
      .expect(201);
    const loginBody = loginResponse.body as AuthResponse;

    expect(loginBody.accessToken).toEqual(expect.any(String));
    expect(loginBody.merchant.email).toBe(email);
  });

  it('creates an API key and a crypto payment intent', async () => {
    const merchant = await registerMerchant('payment-create');
    await configureWebhook(merchant.accessToken);
    const apiKey = await createApiKey(merchant.accessToken);

    const payment = await createCryptoPayment(apiKey, 'order_create_001');

    expect(apiKey).toMatch(/^qk_live_/);
    expect(payment.status).toBe('AWAITING_PAYMENT');
    expect(payment.cryptoInvoice.status).toBe('AWAITING_PAYMENT');
    expect(payment.cryptoInvoice.address).toMatch(/^0x[a-fA-F0-9]{40}$/);

    const webhookLogs = await request(app.getHttpServer())
      .get('/merchant/webhooks/deliveries')
      .set('authorization', `Bearer ${merchant.accessToken}`)
      .expect(200);
    const webhookBodies = webhookLogs.body as WebhookDelivery[];

    expect(webhookBodies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: 'payment.awaiting_payment',
          paymentIntentId: payment.id,
        }),
      ]),
    );
  });

  it('detects and confirms a payment through the simulation endpoints', async () => {
    const merchant = await registerMerchant('payment-confirm');
    await configureWebhook(merchant.accessToken);
    const apiKey = await createApiKey(merchant.accessToken);
    const payment = await createCryptoPayment(apiKey, 'order_confirm_001');

    const detected = await request(app.getHttpServer())
      .post(`/v1/payments/${payment.id}/simulate/detected`)
      .set('authorization', `Bearer ${merchant.accessToken}`)
      .expect(201);
    const detectedBody = detected.body as PaymentTransitionResponse;

    expect(detectedBody.payment.status).toBe('CONFIRMING');

    const confirmed = await request(app.getHttpServer())
      .post(`/v1/payments/${payment.id}/simulate/confirmed`)
      .set('authorization', `Bearer ${merchant.accessToken}`)
      .expect(201);
    const confirmedBody = confirmed.body as PaymentTransitionResponse;

    expect(confirmedBody.payment.status).toBe('SUCCEEDED');

    const paymentDetail = await request(app.getHttpServer())
      .get(`/merchant/payments/${payment.id}`)
      .set('authorization', `Bearer ${merchant.accessToken}`)
      .expect(200);
    const paymentDetailBody = paymentDetail.body as PaymentDetailResponse;

    expect(paymentDetailBody.status).toBe('SUCCEEDED');
    expect(paymentDetailBody.cryptoInvoice.status).toBe('SUCCEEDED');
    expect(paymentDetailBody.cryptoInvoice.transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'CONFIRMED',
        }),
      ]),
    );

    const webhookLogs = await request(app.getHttpServer())
      .get('/merchant/webhooks/deliveries')
      .set('authorization', `Bearer ${merchant.accessToken}`)
      .expect(200);
    const webhookBodies = webhookLogs.body as WebhookDelivery[];

    expect(webhookBodies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: 'payment.confirming',
          paymentIntentId: payment.id,
        }),
        expect.objectContaining({
          eventType: 'payment.succeeded',
          paymentIntentId: payment.id,
        }),
      ]),
    );
  });

  it('expires a payment through the simulation endpoint and records a webhook', async () => {
    const merchant = await registerMerchant('payment-expire');
    await configureWebhook(merchant.accessToken);
    const apiKey = await createApiKey(merchant.accessToken);
    const payment = await createCryptoPayment(apiKey, 'order_expire_001');

    const expired = await request(app.getHttpServer())
      .post(`/v1/payments/${payment.id}/simulate/expired`)
      .set('authorization', `Bearer ${merchant.accessToken}`)
      .expect(201);
    const expiredBody = expired.body as PaymentTransitionResponse;

    expect(expiredBody.payment.status).toBe('EXPIRED');

    const webhookLogs = await request(app.getHttpServer())
      .get('/merchant/webhooks/deliveries')
      .set('authorization', `Bearer ${merchant.accessToken}`)
      .expect(200);
    const webhookBodies = webhookLogs.body as WebhookDelivery[];

    expect(webhookBodies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: 'payment.expired',
          paymentIntentId: payment.id,
        }),
      ]),
    );
  });
});
