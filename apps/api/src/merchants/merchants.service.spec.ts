import { MerchantEnvironment } from '@prisma/client';
import { WebhookSecretsService } from '../common/security/webhook-secrets.service';
import { MerchantsService } from './merchants.service';

describe('MerchantsService', () => {
  const createPrismaMock = () => ({
    merchant: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    merchantApiKey: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  });

  it('returns masked webhook secret metadata in merchant settings', async () => {
    const prisma = createPrismaMock();
    const service = new MerchantsService(
      prisma as never,
      new WebhookSecretsService(),
    );

    prisma.merchant.findUnique.mockResolvedValue({
      id: 'merchant_123',
      name: 'Quidly Demo',
      email: 'merchant@example.com',
      webhookUrl: 'https://merchant.test/webhook',
      webhookSecret: null,
      webhookSecretEncrypted: null,
      webhookSecretHash: null,
      defaultEnvironment: MerchantEnvironment.SANDBOX,
      webhookUrlUpdatedAt: new Date('2026-03-09T10:00:00.000Z'),
      webhookSecretUpdatedAt: new Date('2026-03-09T09:00:00.000Z'),
      createdAt: new Date('2026-03-09T08:00:00.000Z'),
      updatedAt: new Date('2026-03-09T10:00:00.000Z'),
    });

    const result = await service.getSettings('merchant_123');

    expect(result.defaultEnvironment).toBe(MerchantEnvironment.SANDBOX);
    expect(result.webhookSecretPreview).toBeNull();
  });

  it('rotates the webhook secret and returns the new secret once', async () => {
    const prisma = createPrismaMock();
    const service = new MerchantsService(
      prisma as never,
      new WebhookSecretsService(),
    );

    prisma.merchant.update.mockResolvedValue({
      id: 'merchant_123',
      webhookSecretUpdatedAt: new Date('2026-03-09T12:00:00.000Z'),
    });

    const result = await service.rotateWebhookSecret('merchant_123');

    expect(result.merchantId).toBe('merchant_123');
    expect(result.webhookSecret).toMatch(/^qwhsec_/);
    expect(result.webhookSecretPreview).toMatch(/^qwhsec_/);
  });

  it('creates an API key with a one-time raw secret', async () => {
    const prisma = createPrismaMock();
    const service = new MerchantsService(
      prisma as never,
      new WebhookSecretsService(),
    );

    prisma.merchantApiKey.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: 'key_123',
          name: data.name,
          keyPrefix: data.keyPrefix,
          createdAt: new Date('2026-03-09T12:00:00.000Z'),
        }),
    );

    const result = await service.createApiKey('merchant_123', 'server');

    expect(result.key).toMatch(/^qk_live_/);
    expect(result.keyPrefix).toHaveLength(12);
  });

  it('only revokes API keys owned by the merchant', async () => {
    const prisma = createPrismaMock();
    const service = new MerchantsService(
      prisma as never,
      new WebhookSecretsService(),
    );

    prisma.merchantApiKey.findFirst.mockResolvedValue(null);

    await expect(
      service.revokeApiKey('merchant_123', 'key_other'),
    ).rejects.toThrow('API key not found');
  });
});
