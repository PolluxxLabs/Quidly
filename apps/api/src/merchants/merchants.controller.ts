import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentMerchant } from '../auth/decorators/current-merchant.decorator';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { MerchantsService } from './merchants.service';
import { UpdateMerchantSettingsDto } from './dto/update-merchant-settings.dto';

@Controller('merchant')
@UseGuards(JwtAuthGuard)
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Post('api-keys')
  createApiKey(
    @CurrentMerchant() merchant: { merchantId: string },
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.merchantsService.createApiKey(merchant.merchantId, dto.name);
  }

  @Get('api-keys')
  listApiKeys(@CurrentMerchant() merchant: { merchantId: string }) {
    return this.merchantsService.listApiKeys(merchant.merchantId);
  }

  @Delete('api-keys/:id')
  revokeApiKey(
    @CurrentMerchant() merchant: { merchantId: string },
    @Param('id') id: string,
  ) {
    return this.merchantsService.revokeApiKey(merchant.merchantId, id);
  }

  @Get('settings')
  getSettings(@CurrentMerchant() merchant: { merchantId: string }) {
    return this.merchantsService.getSettings(merchant.merchantId);
  }

  @Patch('settings')
  updateSettings(
    @CurrentMerchant() merchant: { merchantId: string },
    @Body() dto: UpdateMerchantSettingsDto,
  ) {
    return this.merchantsService.updateSettings(merchant.merchantId, dto);
  }

  @Post('settings/rotate-webhook-secret')
  rotateWebhookSecret(@CurrentMerchant() merchant: { merchantId: string }) {
    return this.merchantsService.rotateWebhookSecret(merchant.merchantId);
  }
}
