import { PaymentMethod } from '@prisma/client';
import { CreatePaymentDto } from '../dto/create-payment.dto';

export interface PaymentProviderHandler {
  readonly method: PaymentMethod;

  createPayment(
    merchantId: string,
    dto: CreatePaymentDto,
    idempotencyKey?: string,
  ): Promise<unknown>;
}
