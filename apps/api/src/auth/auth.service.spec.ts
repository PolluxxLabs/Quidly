import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { MerchantEnvironment, MerchantStatus } from '@prisma/client';
import { WebhookSecretsService } from '../common/security/webhook-secrets.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const createPrismaMock = () => ({
    merchant: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  });

  const createJwtServiceMock = () => ({
    signAsync: jest.fn().mockResolvedValue('jwt_token'),
  });

  it('registers a merchant with encrypted webhook secret storage', async () => {
    const prisma = createPrismaMock();
    const jwtService = createJwtServiceMock();
    const webhookSecretsService = new WebhookSecretsService();
    const service = new AuthService(
      prisma as never,
      jwtService as never,
      webhookSecretsService,
    );

    prisma.merchant.findUnique.mockResolvedValue(null);
    prisma.merchant.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: 'merchant_123',
          name: data.name,
          email: data.email,
          status: data.status,
        }),
    );

    const result = await service.register({
      name: 'Quidly Demo',
      email: 'Merchant@Example.com',
      password: 'supersecurepassword',
    });

    const [createCall] = prisma.merchant.create.mock.calls as [
      [
        {
          data: {
            email: string;
            webhookSecret: null;
            webhookSecretEncrypted: string;
            webhookSecretHash: string;
            defaultEnvironment: MerchantEnvironment;
            status: MerchantStatus;
          };
        },
      ],
    ];
    const [createArgs] = createCall;
    const createData = createArgs.data;
    expect(createData.email).toBe('merchant@example.com');
    expect(createData.webhookSecret).toBeNull();
    expect(createData.webhookSecretEncrypted).toEqual(expect.any(String));
    expect(createData.webhookSecretHash).toEqual(expect.any(String));
    expect(createData.defaultEnvironment).toBe(MerchantEnvironment.SANDBOX);
    expect(createData.status).toBe(MerchantStatus.ACTIVE);
    expect(result.accessToken).toBe('jwt_token');
    expect(result.merchant.email).toBe('merchant@example.com');
  });

  it('rejects duplicate merchant registration', async () => {
    const prisma = createPrismaMock();
    const service = new AuthService(
      prisma as never,
      createJwtServiceMock() as never,
      new WebhookSecretsService(),
    );

    prisma.merchant.findUnique.mockResolvedValue({ id: 'merchant_123' });

    await expect(
      service.register({
        name: 'Quidly Demo',
        email: 'merchant@example.com',
        password: 'supersecurepassword',
      }),
    ).rejects.toThrow(
      new ConflictException('Merchant with this email already exists'),
    );
  });

  it('rejects invalid login credentials', async () => {
    const prisma = createPrismaMock();
    const service = new AuthService(
      prisma as never,
      createJwtServiceMock() as never,
      new WebhookSecretsService(),
    );

    prisma.merchant.findUnique.mockResolvedValue({
      id: 'merchant_123',
      name: 'Quidly Demo',
      email: 'merchant@example.com',
      passwordHash: await bcrypt.hash('anotherpassword', 10),
      status: MerchantStatus.ACTIVE,
    });

    await expect(
      service.login({
        email: 'merchant@example.com',
        password: 'supersecurepassword',
      }),
    ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
  });
});
