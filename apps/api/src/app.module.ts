import { BullModule } from '@nestjs/bullmq';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { HttpExceptionFilter } from './common/http/http-exception.filter';
import { RequestContextMiddleware } from './common/http/request-context.middleware';
import { CryptoModule } from './crypto/crypto.module';
import { MerchantsModule } from './merchants/merchants.module';
import { OpsModule } from './ops/ops.module';
import { PaymentsModule } from './payments/payments.module';
import { QueuesModule } from './queues/queues.module';
import { QUEUES_ENABLED } from './queues/queue.config';
import { getRedisConnection } from './queues/redis.config';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ...(QUEUES_ENABLED
      ? [
          BullModule.forRoot({
            connection: getRedisConnection(),
          }),
        ]
      : []),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 60,
      },
    ]),
    CommonModule,
    PrismaModule,
    AuthModule,
    CryptoModule,
    MerchantsModule,
    OpsModule,
    PaymentsModule,
    QueuesModule,
    WebhooksModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
