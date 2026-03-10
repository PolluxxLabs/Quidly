import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUppercase,
  Min,
} from 'class-validator';
import { CryptoAsset, CryptoChain, PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  @IsNumber()
  @Min(0.000001)
  amount!: number;

  @IsString()
  @IsUppercase()
  currency!: string;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsOptional()
  @IsEnum(CryptoAsset)
  asset?: CryptoAsset;

  @IsOptional()
  @IsEnum(CryptoChain)
  chain?: CryptoChain;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  customerEmail?: string;
}
