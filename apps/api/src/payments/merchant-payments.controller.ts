import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentMerchant } from '../auth/decorators/current-merchant.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentsService } from './payments.service';

@Controller('merchant/payments')
@UseGuards(JwtAuthGuard)
export class MerchantPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  listPayments(@CurrentMerchant() merchant: { merchantId: string }) {
    return this.paymentsService.listPayments(merchant.merchantId);
  }

  @Get('overview')
  getOverview(@CurrentMerchant() merchant: { merchantId: string }) {
    return this.paymentsService.getMerchantOverview(merchant.merchantId);
  }

  @Get(':id')
  getPayment(
    @CurrentMerchant() merchant: { merchantId: string },
    @Param('id') id: string,
  ) {
    return this.paymentsService.getPayment(merchant.merchantId, id);
  }
}
