import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentMerchant } from '../auth/decorators/current-merchant.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WebhooksService } from './webhooks.service';

@Controller('merchant/webhooks')
@UseGuards(JwtAuthGuard)
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get('deliveries')
  listDeliveries(@CurrentMerchant() merchant: { merchantId: string }) {
    return this.webhooksService.listDeliveries(merchant.merchantId);
  }

  @Post('deliveries/:id/replay')
  replayDelivery(
    @CurrentMerchant() merchant: { merchantId: string },
    @Param('id') id: string,
  ) {
    return this.webhooksService.replayDelivery(merchant.merchantId, id);
  }
}
