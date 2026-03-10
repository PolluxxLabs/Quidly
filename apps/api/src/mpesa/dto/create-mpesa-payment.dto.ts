import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateMpesaPaymentDto {
  @IsNumber()
  @Min(1)
  amount!: number;

  @IsString()
  currency!: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  reference?: string;
}
