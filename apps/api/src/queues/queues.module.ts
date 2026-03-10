import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import {
  CRYPTO_EXPIRY_QUEUE,
  CRYPTO_MONITORING_QUEUE,
  WEBHOOK_DELIVERIES_QUEUE,
} from './queue.constants';
import { InMemoryQueue } from './in-memory-queue';
import { QUEUES_ENABLED } from './queue.config';
import { QueuesController } from './queues.controller';

@Module({
  imports: QUEUES_ENABLED
    ? [
        BullModule.registerQueue(
          { name: WEBHOOK_DELIVERIES_QUEUE },
          { name: CRYPTO_EXPIRY_QUEUE },
          { name: CRYPTO_MONITORING_QUEUE },
        ),
      ]
    : [],
  providers: QUEUES_ENABLED
    ? []
    : [
        {
          provide: getQueueToken(WEBHOOK_DELIVERIES_QUEUE),
          useValue: new InMemoryQueue(WEBHOOK_DELIVERIES_QUEUE),
        },
        {
          provide: getQueueToken(CRYPTO_EXPIRY_QUEUE),
          useValue: new InMemoryQueue(CRYPTO_EXPIRY_QUEUE),
        },
        {
          provide: getQueueToken(CRYPTO_MONITORING_QUEUE),
          useValue: new InMemoryQueue(CRYPTO_MONITORING_QUEUE),
        },
      ],
  controllers: [QueuesController],
  exports: QUEUES_ENABLED
    ? [BullModule]
    : [
        getQueueToken(WEBHOOK_DELIVERIES_QUEUE),
        getQueueToken(CRYPTO_EXPIRY_QUEUE),
        getQueueToken(CRYPTO_MONITORING_QUEUE),
      ],
})
export class QueuesModule {}
