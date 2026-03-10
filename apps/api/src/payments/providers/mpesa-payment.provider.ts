import { Injectable } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { MpesaService } from '../../mpesa/mpesa.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { PaymentProviderHandler } from './payment-provider.interface';

@Injectable()
export class MpesaPaymentProvider implements PaymentProviderHandler {
  readonly method = PaymentMethod.MPESA;

  constructor(private readonly mpesaService: MpesaService) {}

  createPayment(
    merchantId: string,
    dto: CreatePaymentDto,
    idempotencyKey?: string,
  ) {
    return this.mpesaService.createPayment({
      merchantId,
      amount: dto.amount,
      currency: dto.currency,
      reference: dto.reference,
      idempotencyKey,
    });
  }
}
