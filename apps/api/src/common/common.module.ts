import { Global, Module } from '@nestjs/common';
import { AppLogger } from './logging/app-logger.service';
import { WebhookSecretsService } from './security/webhook-secrets.service';

@Global()
@Module({
  providers: [AppLogger, WebhookSecretsService],
  exports: [AppLogger, WebhookSecretsService],
})
export class CommonModule {}
