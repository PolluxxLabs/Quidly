import { Injectable, NotFoundException } from '@nestjs/common';
import { ApiKeyStatus, MerchantStatus } from '@prisma/client';
import { randomBytes, createHash } from 'crypto';
import { WebhookSecretsService } from '../common/security/webhook-secrets.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMerchantSettingsDto } from './dto/update-merchant-settings.dto';

@Injectable()
export class MerchantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly webhookSecretsService: WebhookSecretsService,
  ) {}

  async createApiKey(merchantId: string, name: string) {
    const rawKey = `qk_live_${randomBytes(24).toString('hex')}`;
    const keyPrefix = rawKey.slice(0, 12);
    const keyHash = this.hashKey(rawKey);

    const apiKey = await this.prisma.merchantApiKey.create({
      data: {
        merchantId,
        name,
        keyPrefix,
        keyHash,
        status: ApiKeyStatus.ACTIVE,
      },
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      key: rawKey,
      createdAt: apiKey.createdAt,
    };
  }

  async listApiKeys(merchantId: string) {
    return this.prisma.merchantApiKey.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        status: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
  }

  async revokeApiKey(merchantId: string, keyId: string) {
    const apiKey = await this.prisma.merchantApiKey.findFirst({
      where: {
        id: keyId,
        merchantId,
      },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    return this.prisma.merchantApiKey.update({
      where: { id: keyId },
      data: { status: ApiKeyStatus.REVOKED },
    });
  }

  async findActiveApiKey(rawKey: string) {
    const keyHash = this.hashKey(rawKey);

    return this.prisma.merchantApiKey.findFirst({
      where: {
        keyHash,
        status: ApiKeyStatus.ACTIVE,
        merchant: {
          status: MerchantStatus.ACTIVE,
        },
      },
      include: {
        merchant: true,
      },
    });
  }

  async touchApiKey(id: string) {
    await this.prisma.merchantApiKey.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }

  async getSettings(merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: {
        id: true,
        name: true,
        email: true,
        webhookUrl: true,
        webhookSecret: true,
        webhookSecretEncrypted: true,
        webhookSecretHash: true,
        defaultEnvironment: true,
        webhookUrlUpdatedAt: true,
        webhookSecretUpdatedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const storedMerchant = await this.migrateLegacyWebhookSecretIfNeeded(
      merchantId,
      merchant,
    );

    return {
      id: storedMerchant.id,
      name: storedMerchant.name,
      email: storedMerchant.email,
      webhookUrl: storedMerchant.webhookUrl,
      defaultEnvironment: storedMerchant.defaultEnvironment,
      webhookUrlUpdatedAt: storedMerchant.webhookUrlUpdatedAt,
      webhookSecretUpdatedAt: storedMerchant.webhookSecretUpdatedAt,
      createdAt: storedMerchant.createdAt,
      updatedAt: storedMerchant.updatedAt,
      webhookSecretPreview:
        this.webhookSecretsService.getPreview(storedMerchant),
    };
  }

  async updateSettings(merchantId: string, dto: UpdateMerchantSettingsDto) {
    const merchant = await this.prisma.merchant.update({
      where: { id: merchantId },
      data: {
        webhookUrl: dto.webhookUrl,
        webhookUrlUpdatedAt:
          dto.webhookUrl !== undefined ? new Date() : undefined,
        defaultEnvironment: dto.defaultEnvironment,
      },
      select: {
        id: true,
        name: true,
        email: true,
        webhookUrl: true,
        defaultEnvironment: true,
        webhookUrlUpdatedAt: true,
        webhookSecretUpdatedAt: true,
        createdAt: true,
        updatedAt: true,
        webhookSecret: true,
        webhookSecretEncrypted: true,
        webhookSecretHash: true,
      },
    });

    const storedMerchant = await this.migrateLegacyWebhookSecretIfNeeded(
      merchantId,
      merchant,
    );

    return {
      id: storedMerchant.id,
      name: storedMerchant.name,
      email: storedMerchant.email,
      webhookUrl: storedMerchant.webhookUrl,
      defaultEnvironment: storedMerchant.defaultEnvironment,
      webhookUrlUpdatedAt: storedMerchant.webhookUrlUpdatedAt,
      webhookSecretUpdatedAt: storedMerchant.webhookSecretUpdatedAt,
      createdAt: storedMerchant.createdAt,
      updatedAt: storedMerchant.updatedAt,
      webhookSecretPreview:
        this.webhookSecretsService.getPreview(storedMerchant),
    };
  }

  async rotateWebhookSecret(merchantId: string) {
    const webhookSecret = this.webhookSecretsService.generateSecret();
    const storedWebhookSecret =
      this.webhookSecretsService.prepareForStorage(webhookSecret);
    const merchant = await this.prisma.merchant.update({
      where: { id: merchantId },
      data: {
        webhookSecret: null,
        webhookSecretEncrypted: storedWebhookSecret.encrypted,
        webhookSecretHash: storedWebhookSecret.hash,
        webhookSecretUpdatedAt: new Date(),
      },
      select: {
        id: true,
        webhookSecretUpdatedAt: true,
      },
    });

    return {
      merchantId: merchant.id,
      webhookSecret,
      webhookSecretPreview: storedWebhookSecret.preview,
      webhookSecretUpdatedAt: merchant.webhookSecretUpdatedAt,
    };
  }

  private hashKey(rawKey: string) {
    return createHash('sha256').update(rawKey).digest('hex');
  }

  private async migrateLegacyWebhookSecretIfNeeded<
    T extends {
      id: string;
      webhookSecret?: string | null;
      webhookSecretEncrypted?: string | null;
      webhookSecretHash?: string | null;
    },
  >(merchantId: string, merchant: T) {
    if (!merchant.webhookSecret || merchant.webhookSecretEncrypted) {
      return merchant;
    }

    const storedWebhookSecret = this.webhookSecretsService.prepareForStorage(
      merchant.webhookSecret,
    );

    await this.prisma.merchant.update({
      where: { id: merchantId },
      data: {
        webhookSecret: null,
        webhookSecretEncrypted: storedWebhookSecret.encrypted,
        webhookSecretHash: storedWebhookSecret.hash,
      },
    });

    return {
      ...merchant,
      webhookSecret: null,
      webhookSecretEncrypted: storedWebhookSecret.encrypted,
      webhookSecretHash: storedWebhookSecret.hash,
    };
  }
}
