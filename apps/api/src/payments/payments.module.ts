import { Module } from '@nestjs/common';
import { CryptoModule } from '../crypto/crypto.module';
import { MerchantsModule } from '../merchants/merchants.module';
import { MpesaModule } from '../mpesa/mpesa.module';
import { PrismaModule } from '../prisma/prisma.module';
import { QueuesModule } from '../queues/queues.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { CryptoExpiryProcessor } from './crypto-expiry.processor';
import { CryptoMonitoringProcessor } from './crypto-monitoring.processor';
import { MerchantPaymentsController } from './merchant-payments.controller';
import { PaymentJobsService } from './payment-jobs.service';
import { PaymentsController } from './payments.controller';
import { CryptoPaymentProvider } from './providers/crypto-payment.provider';
import { MpesaPaymentProvider } from './providers/mpesa-payment.provider';
import { PaymentProviderRegistry } from './providers/payment-provider.registry';
import { PaymentsService } from './payments.service';
import { QUEUES_ENABLED } from '../queues/queue.config';

@Module({
  imports: [
    CryptoModule,
    MpesaModule,
    PrismaModule,
    MerchantsModule,
    WebhooksModule,
    QueuesModule,
  ],
  controllers: [PaymentsController, MerchantPaymentsController],
  providers: [
    PaymentsService,
    PaymentJobsService,
    CryptoPaymentProvider,
    MpesaPaymentProvider,
    PaymentProviderRegistry,
    ...(QUEUES_ENABLED
      ? [CryptoExpiryProcessor, CryptoMonitoringProcessor]
      : []),
  ],
  exports: [PaymentsService, PaymentJobsService],
})
export class PaymentsModule {}
