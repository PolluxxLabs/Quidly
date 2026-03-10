import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import {
  ApiKeyStatus,
  MerchantEnvironment,
  MerchantStatus,
  PrismaClient,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { WebhookSecretsService } from '../src/common/security/webhook-secrets.service';

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
  });
  const webhookSecretsService = new WebhookSecretsService();

  const name = process.env.SEED_MERCHANT_NAME ?? 'Quidly Dev Merchant';
  const email = (process.env.SEED_MERCHANT_EMAIL ?? 'dev@quidly.local').toLowerCase();
  const password = process.env.SEED_MERCHANT_PASSWORD ?? 'devpassword123';
  const apiKeyName = process.env.SEED_API_KEY_NAME ?? 'dev-local';
  const rawApiKey = `qk_live_${randomBytes(24).toString('hex')}`;
  const keyPrefix = rawApiKey.slice(0, 12);
  const keyHash = createHash('sha256').update(rawApiKey).digest('hex');
  const webhookSecret = webhookSecretsService.generateSecret();
  const storedWebhookSecret =
    webhookSecretsService.prepareForStorage(webhookSecret);

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();

  const merchant = await prisma.merchant.upsert({
    where: { email },
    create: {
      name,
      email,
      passwordHash,
      webhookSecret: null,
      webhookSecretEncrypted: storedWebhookSecret.encrypted,
      webhookSecretHash: storedWebhookSecret.hash,
      webhookSecretUpdatedAt: now,
      defaultEnvironment: MerchantEnvironment.SANDBOX,
      status: MerchantStatus.ACTIVE,
    },
    update: {
      name,
      passwordHash,
      webhookSecret: null,
      webhookSecretEncrypted: storedWebhookSecret.encrypted,
      webhookSecretHash: storedWebhookSecret.hash,
      webhookSecretUpdatedAt: now,
      defaultEnvironment: MerchantEnvironment.SANDBOX,
      status: MerchantStatus.ACTIVE,
    },
  });

  await prisma.merchantApiKey.updateMany({
    where: {
      merchantId: merchant.id,
      name: apiKeyName,
      status: ApiKeyStatus.ACTIVE,
    },
    data: {
      status: ApiKeyStatus.REVOKED,
    },
  });

  await prisma.merchantApiKey.create({
    data: {
      merchantId: merchant.id,
      name: apiKeyName,
      keyPrefix,
      keyHash,
      status: ApiKeyStatus.ACTIVE,
    },
  });

  console.log(
    JSON.stringify(
      {
        merchant: {
          id: merchant.id,
          email,
          password,
        },
        apiKey: rawApiKey,
        webhookSecret,
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
  await pool.end();
}

void main();
