import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Prisma, WebhookDeliveryStatus } from '@prisma/client';
import { createHmac, randomUUID } from 'crypto';
import { Queue } from 'bullmq';
import { WebhookSecretsService } from '../common/security/webhook-secrets.service';
import { PrismaService } from '../prisma/prisma.service';
import { WEBHOOK_DELIVERIES_QUEUE } from '../queues/queue.constants';
import { WebhookDeliveryJobPayload } from '../queues/queue.types';

export type PaymentWebhookEvent =
  | 'payment.awaiting_payment'
  | 'payment.confirming'
  | 'payment.succeeded'
  | 'payment.failed'
  | 'payment.expired';

type WebhookPrismaClient = PrismaService | Prisma.TransactionClient;

type PaymentWebhookRecord = Prisma.PaymentIntentGetPayload<{
  include: {
    merchant: true;
    cryptoInvoice: true;
  };
}>;

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly webhookSecretsService: WebhookSecretsService,
    @InjectQueue(WEBHOOK_DELIVERIES_QUEUE)
    private readonly webhookQueue: Queue<WebhookDeliveryJobPayload>,
  ) {}

  async enqueuePaymentEvent(
    client: WebhookPrismaClient,
    paymentId: string,
    eventType: PaymentWebhookEvent,
  ) {
    const payment = (await client.paymentIntent.findFirst({
      where: { id: paymentId },
      include: {
        merchant: true,
        cryptoInvoice: true,
      },
    })) as PaymentWebhookRecord | null;

    if (!payment) {
      throw new NotFoundException('Payment not found for webhook delivery');
    }

    const { webhookUrl } = payment.merchant;
    const webhookSecret = await this.resolveWebhookSecret(
      client,
      payment.merchant,
    );

    if (
      typeof webhookUrl !== 'string' ||
      webhookUrl.length === 0 ||
      typeof webhookSecret !== 'string' ||
      webhookSecret.length === 0
    ) {
      return null;
    }

    const timestamp = new Date().toISOString();
    const body = {
      id: randomUUID(),
      type: eventType,
      createdAt: timestamp,
      data: {
        paymentId: payment.id,
        merchantId: payment.merchantId,
        status: payment.status,
        amount: payment.amount.toString(),
        currency: payment.currency,
        method: payment.method,
        provider: payment.provider,
        reference: payment.reference,
        cryptoInvoice: payment.cryptoInvoice
          ? {
              id: payment.cryptoInvoice.id,
              status: payment.cryptoInvoice.status,
              address: payment.cryptoInvoice.address,
              asset: payment.cryptoInvoice.asset,
              chain: payment.cryptoInvoice.chain,
              expectedAmount: payment.cryptoInvoice.expectedAmount.toString(),
              expiresAt: payment.cryptoInvoice.expiresAt.toISOString(),
            }
          : null,
      },
    };
    const signature = this.signPayload(webhookSecret, timestamp, body);

    return client.webhookDelivery.create({
      data: {
        merchantId: payment.merchantId,
        paymentIntentId: payment.id,
        eventType,
        targetUrl: webhookUrl,
        payload: {
          headers: {
            'x-quidly-signature': signature,
            'x-quidly-timestamp': timestamp,
          },
          body,
        },
        status: WebhookDeliveryStatus.PENDING,
      },
    });
  }

  async listDeliveries(merchantId: string) {
    return this.prisma.webhookDelivery.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async enqueueDeliveryJob(deliveryId: string) {
    return this.webhookQueue.add(
      `delivery:${deliveryId}`,
      { deliveryId },
      {
        jobId: deliveryId,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 60_000,
        },
        removeOnComplete: 100,
        removeOnFail: false,
      },
    );
  }

  async getDeliveryById(deliveryId: string) {
    return this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
    });
  }

  async replayDelivery(merchantId: string, deliveryId: string) {
    const delivery = await this.prisma.webhookDelivery.findFirst({
      where: {
        id: deliveryId,
        merchantId,
      },
    });

    if (!delivery) {
      throw new NotFoundException('Webhook delivery not found');
    }

    const replay = await this.prisma.webhookDelivery.create({
      data: {
        merchantId: delivery.merchantId,
        paymentIntentId: delivery.paymentIntentId,
        eventType: delivery.eventType,
        targetUrl: delivery.targetUrl,
        payload: this.toPrismaJsonValue(delivery.payload),
        status: WebhookDeliveryStatus.PENDING,
        nextRetryAt: new Date(),
      },
    });

    await this.enqueueDeliveryJob(replay.id);

    return replay;
  }

  async scheduleRetry(
    deliveryId: string,
    responseCode: number,
    responseBody: string,
  ) {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery) {
      throw new NotFoundException('Webhook delivery not found');
    }

    const nextAttemptCount = delivery.attemptCount + 1;
    const nextRetryAt = new Date(
      Date.now() + this.getRetryDelayMs(nextAttemptCount),
    );

    return this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        attemptCount: nextAttemptCount,
        responseCode,
        responseBody,
        nextRetryAt,
        status: WebhookDeliveryStatus.FAILED,
      },
    });
  }

  async markDelivered(
    deliveryId: string,
    responseCode: number,
    responseBody: string,
  ) {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery) {
      throw new NotFoundException('Webhook delivery not found');
    }

    return this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        attemptCount: delivery.attemptCount + 1,
        responseCode,
        responseBody,
        deliveredAt: new Date(),
        nextRetryAt: null,
        status: WebhookDeliveryStatus.DELIVERED,
      },
    });
  }

  private signPayload(
    secret: string,
    timestamp: string,
    body: Record<string, unknown>,
  ) {
    const signedPayload = `${timestamp}.${JSON.stringify(body)}`;

    return `sha256=${createHmac('sha256', secret).update(signedPayload).digest('hex')}`;
  }

  private getRetryDelayMs(attemptCount: number) {
    if (attemptCount < 1) {
      throw new BadRequestException('Attempt count must be positive');
    }

    return Math.min(60_000 * 2 ** (attemptCount - 1), 24 * 60 * 60 * 1000);
  }

  private toPrismaJsonValue(
    value: Prisma.JsonValue,
  ): Prisma.InputJsonValue | Prisma.JsonNullValueInput {
    return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
  }

  private async resolveWebhookSecret(
    client: WebhookPrismaClient,
    merchant: {
      id: string;
      webhookSecret?: string | null;
      webhookSecretEncrypted?: string | null;
      webhookSecretHash?: string | null;
    },
  ) {
    const secret = this.webhookSecretsService.resolve(merchant);

    if (!secret || merchant.webhookSecretEncrypted) {
      return secret;
    }

    const storedWebhookSecret =
      this.webhookSecretsService.prepareForStorage(secret);

    await client.merchant.update({
      where: { id: merchant.id },
      data: {
        webhookSecret: null,
        webhookSecretEncrypted: storedWebhookSecret.encrypted,
        webhookSecretHash: storedWebhookSecret.hash,
      },
    });

    return secret;
  }
}
