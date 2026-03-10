import { Processor, WorkerHost } from '@nestjs/bullmq';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { AppLogger } from '../common/logging/app-logger.service';
import { CRYPTO_EXPIRY_QUEUE } from '../queues/queue.constants';
import { CryptoExpiryJobPayload } from '../queues/queue.types';
import { PaymentsService } from './payments.service';

@Injectable()
@Processor(CRYPTO_EXPIRY_QUEUE)
export class CryptoExpiryProcessor extends WorkerHost {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly logger: AppLogger,
  ) {
    super();
  }

  async process(job: Job<CryptoExpiryJobPayload>) {
    try {
      const result = await this.paymentsService.processScheduledCryptoExpiry(
        job.data.paymentId,
      );

      this.logger.log('queue.crypto_expiry.processed', {
        queue: CRYPTO_EXPIRY_QUEUE,
        jobId: job.id,
        paymentId: job.data.paymentId,
        action: result.skipped ? 'skipped' : 'expired',
        reason: result.skipped ? result.reason : undefined,
      });

      return result;
    } catch (error) {
      if (error instanceof BadRequestException) {
        this.logger.warn('queue.crypto_expiry.skipped', {
          queue: CRYPTO_EXPIRY_QUEUE,
          jobId: job.id,
          paymentId: job.data.paymentId,
          action: 'skipped',
          reason: error.message,
        });

        return null;
      }

      throw error;
    }
  }
}
