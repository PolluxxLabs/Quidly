import { NotFoundException } from '@nestjs/common';
import {
  CryptoAsset,
  CryptoChain,
  CryptoInvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProviderName,
  WebhookDeliveryStatus,
} from '@prisma/client';
import { createHmac } from 'crypto';
import { WebhookSecretsService } from '../common/security/webhook-secrets.service';
import { WebhooksService } from './webhooks.service';

describe('WebhooksService', () => {
  type CreateArgs = {
    data: Record<string, unknown>;
  };

  const createPrismaMock = () => ({
    merchant: {
      update: jest.fn(),
    },
    paymentIntent: {
      findFirst: jest.fn(),
    },
    webhookDelivery: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  });

  const buildPayment = () => {
    const secretsService = new WebhookSecretsService();
    const storedSecret = secretsService.prepareForStorage('qwhsec_test_secret');

    return {
      id: 'pay_123',
      merchantId: 'merchant_123',
      amount: new Prisma.Decimal('25.50'),
      currency: 'USD',
      method: PaymentMethod.CRYPTO,
      status: PaymentStatus.CONFIRMING,
      provider: ProviderName.CRYPTO,
      reference: 'ref_123',
      merchant: {
        id: 'merchant_123',
        webhookUrl: 'https://merchant.test/webhooks',
        webhookSecret: null,
        webhookSecretEncrypted: storedSecret.encrypted,
        webhookSecretHash: storedSecret.hash,
      },
      cryptoInvoice: {
        id: 'inv_123',
        status: CryptoInvoiceStatus.CONFIRMING,
        address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        asset: CryptoAsset.USDC,
        chain: CryptoChain.BASE,
        expectedAmount: new Prisma.Decimal('25.50'),
        expiresAt: new Date('2026-03-09T10:00:00.000Z'),
      },
    };
  };

  it('creates a signed webhook delivery record', async () => {
    const prisma = createPrismaMock();
    const webhookQueue = { add: jest.fn() };
    const service = new WebhooksService(
      prisma as never,
      new WebhookSecretsService(),
      webhookQueue as never,
    );

    prisma.paymentIntent.findFirst.mockResolvedValue(buildPayment());
    prisma.webhookDelivery.create.mockImplementation(({ data }: CreateArgs) =>
      Promise.resolve(data),
    );

    const delivery = await service.enqueuePaymentEvent(
      prisma as never,
      'pay_123',
      'payment.confirming',
    );

    expect(prisma.webhookDelivery.create).toHaveBeenCalledTimes(1);
    expect(delivery).not.toBeNull();

    const payload = delivery?.payload as {
      headers: {
        'x-quidly-signature': string;
        'x-quidly-timestamp': string;
      };
      body: {
        type: string;
        data: {
          paymentId: string;
          amount: string;
        };
      };
    };
    const signedPayload = `${payload.headers['x-quidly-timestamp']}.${JSON.stringify(payload.body)}`;
    const expectedSignature = `sha256=${createHmac(
      'sha256',
      'qwhsec_test_secret',
    )
      .update(signedPayload)
      .digest('hex')}`;

    expect(payload.body.type).toBe('payment.confirming');
    expect(payload.body.data.paymentId).toBe('pay_123');
    expect(payload.body.data.amount).toBe('25.5');
    expect(payload.headers['x-quidly-signature']).toBe(expectedSignature);
  });

  it('schedules retry metadata after a failed delivery attempt', async () => {
    const prisma = createPrismaMock();
    const service = new WebhooksService(
      prisma as never,
      new WebhookSecretsService(),
      { add: jest.fn() } as never,
    );

    prisma.webhookDelivery.findUnique.mockResolvedValue({
      id: 'whd_123',
      attemptCount: 1,
    });
    prisma.webhookDelivery.update.mockImplementation(({ data }: CreateArgs) =>
      Promise.resolve(data),
    );

    const updated = await service.scheduleRetry(
      'whd_123',
      500,
      'upstream error',
    );

    expect(updated.attemptCount).toBe(2);
    expect(updated.responseCode).toBe(500);
    expect(updated.responseBody).toBe('upstream error');
    expect(updated.status).toBe(WebhookDeliveryStatus.FAILED);
    expect(updated.nextRetryAt).toBeInstanceOf(Date);
  });

  it('replays a stored delivery for the same merchant', async () => {
    const prisma = createPrismaMock();
    const webhookQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job_123' }),
    };
    const service = new WebhooksService(
      prisma as never,
      new WebhookSecretsService(),
      webhookQueue as never,
    );

    prisma.webhookDelivery.findFirst.mockResolvedValue({
      id: 'whd_123',
      merchantId: 'merchant_123',
      paymentIntentId: 'pay_123',
      eventType: 'payment.succeeded',
      targetUrl: 'https://merchant.test/webhooks',
      payload: { body: { ok: true } },
    });
    prisma.webhookDelivery.create.mockImplementation(({ data }: CreateArgs) =>
      Promise.resolve({
        id: 'whd_replay',
        ...data,
      }),
    );

    const replay = await service.replayDelivery('merchant_123', 'whd_123');

    expect(replay.eventType).toBe('payment.succeeded');
    expect(replay.status).toBe(WebhookDeliveryStatus.PENDING);
    expect(replay.nextRetryAt).toBeInstanceOf(Date);
    expect(webhookQueue.add).toHaveBeenCalledWith(
      'delivery:whd_replay',
      { deliveryId: 'whd_replay' },
      expect.objectContaining({
        attempts: 5,
      }),
    );
  });

  it('rejects replay for an unknown delivery', async () => {
    const prisma = createPrismaMock();
    const service = new WebhooksService(
      prisma as never,
      new WebhookSecretsService(),
      { add: jest.fn() } as never,
    );

    prisma.webhookDelivery.findFirst.mockResolvedValue(null);

    await expect(
      service.replayDelivery('merchant_123', 'missing'),
    ).rejects.toThrow(new NotFoundException('Webhook delivery not found'));
  });
});
