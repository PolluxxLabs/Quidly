import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { QueuesModule } from '../queues/queues.module';
import { QUEUES_ENABLED } from '../queues/queue.config';
import { WebhooksController } from './webhooks.controller';
import { WebhookDeliveryProcessor } from './webhooks.processor';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [PrismaModule, AuthModule, QueuesModule],
  controllers: [WebhooksController],
  providers: [
    WebhooksService,
    ...(QUEUES_ENABLED ? [WebhookDeliveryProcessor] : []),
  ],
  exports: [WebhooksService],
})
export class WebhooksModule {}
