import { MerchantEnvironment } from '@prisma/client';
import { IsEnum, IsOptional, IsUrl } from 'class-validator';

export class UpdateMerchantSettingsDto {
  @IsOptional()
  @IsUrl({
    require_tld: true,
    require_protocol: true,
  })
  webhookUrl?: string;

  @IsOptional()
  @IsEnum(MerchantEnvironment)
  defaultEnvironment?: MerchantEnvironment;
}
