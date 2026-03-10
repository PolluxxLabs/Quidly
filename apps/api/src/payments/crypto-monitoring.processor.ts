import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { AppLogger } from '../common/logging/app-logger.service';
import { CRYPTO_MONITORING_QUEUE } from '../queues/queue.constants';
import { CryptoMonitoringJobPayload } from '../queues/queue.types';
import { PaymentsService } from './payments.service';

@Injectable()
@Processor(CRYPTO_MONITORING_QUEUE)
export class CryptoMonitoringProcessor extends WorkerHost {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly logger: AppLogger,
  ) {
    super();
  }

  async process(job: Job<CryptoMonitoringJobPayload>) {
    const result = await this.paymentsService.syncCryptoPaymentFromChain(
      job.data.paymentId,
    );

    this.logger.log('queue.crypto_monitoring.processed', {
      queue: CRYPTO_MONITORING_QUEUE,
      jobId: job.id,
      paymentId: job.data.paymentId,
      chain: job.data.chain,
      asset: job.data.asset,
      action: result.skipped ? 'skipped' : result.action,
      reason: result.skipped ? result.reason : undefined,
    });

    return result;
  }
}
