import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentApiMerchant } from '../auth/decorators/current-api-merchant.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('v1/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @UseGuards(ApiKeyGuard)
  @Throttle({
    default: {
      limit: 30,
      ttl: 60_000,
    },
  })
  createPayment(
    @CurrentApiMerchant() merchant: { id: string },
    @Body() dto: CreatePaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.paymentsService.createPayment(merchant.id, dto, idempotencyKey);
  }

  @Get()
  @UseGuards(ApiKeyGuard)
  listPayments(@CurrentApiMerchant() merchant: { id: string }) {
    return this.paymentsService.listPayments(merchant.id);
  }

  @Get(':id')
  @UseGuards(ApiKeyGuard)
  getPayment(
    @CurrentApiMerchant() merchant: { id: string },
    @Param('id') id: string,
  ) {
    return this.paymentsService.getPayment(merchant.id, id);
  }

  @Post(':id/simulate/detected')
  @UseGuards(JwtAuthGuard)
  simulateDetected(@Param('id') id: string) {
    return this.paymentsService.markCryptoDetected(id);
  }

  @Post(':id/simulate/confirmed')
  @UseGuards(JwtAuthGuard)
  simulateConfirmed(@Param('id') id: string) {
    return this.paymentsService.markCryptoConfirmed(id);
  }

  @Post(':id/simulate/expired')
  @UseGuards(JwtAuthGuard)
  simulateExpired(@Param('id') id: string) {
    return this.paymentsService.expireCryptoPayment(id);
  }
}
