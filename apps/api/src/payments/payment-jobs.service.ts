import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  CRYPTO_EXPIRY_QUEUE,
  CRYPTO_MONITORING_QUEUE,
} from '../queues/queue.constants';
import {
  CryptoExpiryJobPayload,
  CryptoMonitoringJobPayload,
} from '../queues/queue.types';

@Injectable()
export class PaymentJobsService {
  constructor(
    @InjectQueue(CRYPTO_EXPIRY_QUEUE)
    private readonly cryptoExpiryQueue: Queue<CryptoExpiryJobPayload>,
    @InjectQueue(CRYPTO_MONITORING_QUEUE)
    private readonly cryptoMonitoringQueue: Queue<CryptoMonitoringJobPayload>,
  ) {}

  async enqueueCryptoExpiry(paymentId: string, runAt: Date) {
    return this.cryptoExpiryQueue.add(
      `expire:${paymentId}`,
      { paymentId },
      {
        jobId: `expire:${paymentId}`,
        delay: Math.max(runAt.getTime() - Date.now(), 0),
        removeOnComplete: 100,
        removeOnFail: false,
      },
    );
  }

  async enqueueCryptoMonitoring(payload: CryptoMonitoringJobPayload) {
    const delay = Number(process.env.CRYPTO_MONITORING_INTERVAL_MS ?? 15_000);

    return this.cryptoMonitoringQueue.add(
      `monitor:${payload.paymentId}`,
      payload,
      {
        jobId: `monitor:${payload.paymentId}`,
        delay,
        removeOnComplete: 100,
        removeOnFail: false,
      },
    );
  }
}
