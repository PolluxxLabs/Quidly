import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { AppLogger } from '../common/logging/app-logger.service';
import { WEBHOOK_DELIVERIES_QUEUE } from '../queues/queue.constants';
import { WebhookDeliveryJobPayload } from '../queues/queue.types';
import { WebhooksService } from './webhooks.service';

@Injectable()
@Processor(WEBHOOK_DELIVERIES_QUEUE)
export class WebhookDeliveryProcessor extends WorkerHost {
  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly logger: AppLogger,
  ) {
    super();
  }

  async process(job: Job<WebhookDeliveryJobPayload>) {
    const delivery = await this.webhooksService.getDeliveryById(
      job.data.deliveryId,
    );

    if (!delivery || delivery.status === 'DELIVERED') {
      this.logger.log('queue.webhook_delivery.skipped', {
        queue: WEBHOOK_DELIVERIES_QUEUE,
        jobId: job.id,
        deliveryId: job.data.deliveryId,
        action: 'skip',
      });
      return null;
    }

    this.logger.log('queue.webhook_delivery.attempted', {
      queue: WEBHOOK_DELIVERIES_QUEUE,
      jobId: job.id,
      deliveryId: delivery.id,
      attempt: job.attemptsMade + 1,
      targetUrl: delivery.targetUrl,
    });

    const payload = delivery.payload as {
      headers?: Record<string, string>;
      body: Record<string, unknown>;
    };

    const response = await fetch(delivery.targetUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(payload.headers ?? {}),
      },
      body: JSON.stringify(payload.body),
    });
    const responseBody = await response.text();

    if (!response.ok) {
      await this.webhooksService.scheduleRetry(
        delivery.id,
        response.status,
        responseBody,
      );

      this.logger.warn('queue.webhook_delivery.retry_scheduled', {
        queue: WEBHOOK_DELIVERIES_QUEUE,
        jobId: job.id,
        deliveryId: delivery.id,
        action: 'retry_scheduled',
        statusCode: response.status,
        attempt: job.attemptsMade + 1,
      });

      throw new Error(`Webhook delivery failed with status ${response.status}`);
    }

    await this.webhooksService.markDelivered(
      delivery.id,
      response.status,
      responseBody,
    );

    this.logger.log('queue.webhook_delivery.delivered', {
      queue: WEBHOOK_DELIVERIES_QUEUE,
      jobId: job.id,
      deliveryId: delivery.id,
      action: 'delivered',
      statusCode: response.status,
      attempt: job.attemptsMade + 1,
    });

    return { delivered: true };
  }
}
