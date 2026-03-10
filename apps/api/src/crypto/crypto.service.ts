import { Injectable } from '@nestjs/common';
import { CryptoAsset, CryptoChain } from '@prisma/client';
import { BaseUsdcProvider } from './base-usdc.provider';

@Injectable()
export class CryptoService {
  constructor(private readonly baseUsdcProvider: BaseUsdcProvider) {}

  generateInvoiceAddress(
    invoiceId: string,
    asset: CryptoAsset,
    chain: CryptoChain,
  ) {
    this.assertSupported(asset, chain);

    return this.baseUsdcProvider.generateInvoiceAddress(invoiceId);
  }

  getExpectedAmountRaw(
    amount: number | string,
    asset: CryptoAsset,
    chain: CryptoChain,
  ) {
    this.assertSupported(asset, chain);

    return this.baseUsdcProvider.getExpectedAmountRaw(amount);
  }

  getRequiredConfirmations(asset: CryptoAsset, chain: CryptoChain) {
    this.assertSupported(asset, chain);

    return this.baseUsdcProvider.getRequiredConfirmations();
  }

  findTransferToAddress(
    address: string,
    expectedAmountRaw: string,
    asset: CryptoAsset,
    chain: CryptoChain,
  ) {
    this.assertSupported(asset, chain);

    return this.baseUsdcProvider.findTransferToAddress(
      address,
      expectedAmountRaw,
    );
  }

  getConfirmations(
    txHash: string,
    blockNumber: bigint | null,
    asset: CryptoAsset,
    chain: CryptoChain,
  ) {
    this.assertSupported(asset, chain);

    return this.baseUsdcProvider.getConfirmations(txHash, blockNumber);
  }

  private assertSupported(asset: CryptoAsset, chain: CryptoChain) {
    if (!this.baseUsdcProvider.supports(asset, chain)) {
      throw new Error('Unsupported crypto provider configuration');
    }
  }
}
