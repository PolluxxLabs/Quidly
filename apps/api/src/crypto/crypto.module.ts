import { Module } from '@nestjs/common';
import { BaseUsdcProvider } from './base-usdc.provider';
import { CryptoService } from './crypto.service';

@Module({
  providers: [CryptoService, BaseUsdcProvider],
  exports: [CryptoService],
})
export class CryptoModule {}
