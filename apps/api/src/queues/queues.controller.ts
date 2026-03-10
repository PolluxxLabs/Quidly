import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CRYPTO_EXPIRY_QUEUE,
  CRYPTO_MONITORING_QUEUE,
  WEBHOOK_DELIVERIES_QUEUE,
} from './queue.constants';
import { Queue } from 'bullmq';

@Controller('internal/dev/queues')
@UseGuards(JwtAuthGuard)
export class QueuesController {
  constructor(
    @InjectQueue(WEBHOOK_DELIVERIES_QUEUE)
    private readonly webhookQueue: Queue,
    @InjectQueue(CRYPTO_EXPIRY_QUEUE)
    private readonly cryptoExpiryQueue: Queue,
    @InjectQueue(CRYPTO_MONITORING_QUEUE)
    private readonly cryptoMonitoringQueue: Queue,
  ) {}

  @Get(':queue/failed')
  async listFailedJobs(@Param('queue') queueName: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException(
        'Queue inspection is disabled in production',
      );
    }

    const queue = this.getQueue(queueName);
    const jobs = await queue.getFailed();

    return jobs.map((job) => ({
      id: job.id,
      name: job.name,
      data: job.data as unknown,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      finishedOn: job.finishedOn,
    }));
  }

  private getQueue(queueName: string) {
    switch (queueName) {
      case WEBHOOK_DELIVERIES_QUEUE:
        return this.webhookQueue;
      case CRYPTO_EXPIRY_QUEUE:
        return this.cryptoExpiryQueue;
      case CRYPTO_MONITORING_QUEUE:
        return this.cryptoMonitoringQueue;
      default:
        throw new BadRequestException('Unknown queue name');
    }
  }
}
