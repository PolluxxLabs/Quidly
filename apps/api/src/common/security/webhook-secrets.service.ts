import { Injectable } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

type SecretRecord = {
  webhookSecret?: string | null;
  webhookSecretEncrypted?: string | null;
  webhookSecretHash?: string | null;
};

@Injectable()
export class WebhookSecretsService {
  generateSecret() {
    return `qwhsec_${randomBytes(32).toString('hex')}`;
  }

  prepareForStorage(secret: string) {
    return {
      encrypted: this.encrypt(secret),
      hash: this.hash(secret),
      preview: this.mask(secret),
    };
  }

  getPreview(record: SecretRecord) {
    const secret = this.resolve(record);

    if (!secret) {
      return null;
    }

    return this.mask(secret);
  }

  resolve(record: SecretRecord) {
    if (record.webhookSecretEncrypted) {
      const secret = this.decrypt(record.webhookSecretEncrypted);

      if (
        record.webhookSecretHash &&
        record.webhookSecretHash !== this.hash(secret)
      ) {
        throw new Error('Stored webhook secret hash mismatch');
      }

      return secret;
    }

    if (record.webhookSecret) {
      return record.webhookSecret;
    }

    return null;
  }

  private hash(secret: string) {
    return createHash('sha256').update(secret).digest('hex');
  }

  private mask(secret: string) {
    return `${secret.slice(0, 8)}...${secret.slice(-4)}`;
  }

  private encrypt(secret: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.getKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decrypt(secret: string) {
    const [ivHex, tagHex, cipherHex] = secret.split(':');

    if (!ivHex || !tagHex || !cipherHex) {
      throw new Error('Invalid encrypted webhook secret payload');
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.getKey(),
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

    return Buffer.concat([
      decipher.update(Buffer.from(cipherHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  }

  private getKey() {
    const rawKey =
      process.env.WEBHOOK_SECRET_ENCRYPTION_KEY ??
      process.env.JWT_SECRET ??
      'quidly-dev-webhook-secret-key';

    return createHash('sha256').update(rawKey).digest();
  }
}
