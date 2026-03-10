import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { CryptoPaymentProvider } from './crypto-payment.provider';
import { MpesaPaymentProvider } from './mpesa-payment.provider';

@Injectable()
export class PaymentProviderRegistry {
  private readonly providers = new Map<
    PaymentMethod,
    CryptoPaymentProvider | MpesaPaymentProvider
  >();

  constructor(
    cryptoPaymentProvider: CryptoPaymentProvider,
    mpesaPaymentProvider: MpesaPaymentProvider,
  ) {
    this.providers.set(cryptoPaymentProvider.method, cryptoPaymentProvider);
    this.providers.set(mpesaPaymentProvider.method, mpesaPaymentProvider);
  }

  getProvider(method: PaymentMethod) {
    const provider = this.providers.get(method);

    if (!provider) {
      throw new BadRequestException('Unsupported payment method for now');
    }

    return provider;
  }
}
