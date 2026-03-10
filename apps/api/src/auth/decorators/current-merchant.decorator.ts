import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

type AuthenticatedMerchantRequest = Request & {
  user?: unknown;
};

export const CurrentMerchant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<AuthenticatedMerchantRequest>();
    return request.user;
  },
);
