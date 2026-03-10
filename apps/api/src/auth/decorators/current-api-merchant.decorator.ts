import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

type ApiMerchantRequest = Request & {
  merchant?: unknown;
};

export const CurrentApiMerchant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<ApiMerchantRequest>();
    return request.merchant;
  },
);
