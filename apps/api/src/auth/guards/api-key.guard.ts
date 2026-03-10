import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { MerchantStatus } from '@prisma/client';
import { Request } from 'express';
import { MerchantsService } from '../../merchants/merchants.service';

type ApiKeyRequest = Request & {
  apiKey?: {
    id: string;
    name: string;
    keyPrefix: string;
  };
  merchant?: {
    id: string;
    email: string;
    name: string;
    status: MerchantStatus;
  };
};

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly merchantsService: MerchantsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ApiKeyRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing API key');
    }

    const rawKey = authHeader.slice(7).trim();
    if (!rawKey.startsWith('qk_')) {
      throw new UnauthorizedException('Invalid API key format');
    }

    const apiKey = await this.merchantsService.findActiveApiKey(rawKey);
    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    await this.merchantsService.touchApiKey(apiKey.id);

    request.apiKey = {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
    };

    request.merchant = {
      id: apiKey.merchant.id,
      email: apiKey.merchant.email,
      name: apiKey.merchant.name,
      status: apiKey.merchant.status,
    };

    return true;
  }
}
