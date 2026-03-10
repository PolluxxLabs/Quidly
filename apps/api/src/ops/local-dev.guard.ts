import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

const LOCAL_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

@Injectable()
export class LocalDevGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('This endpoint is disabled in production');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const forwardedFor = request.headers['x-forwarded-for'];
    const forwardedIp =
      typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0]?.trim()
        : undefined;
    const remoteAddress =
      forwardedIp ?? request.ip ?? request.socket.remoteAddress ?? '';

    if (!LOCAL_ADDRESSES.has(remoteAddress)) {
      throw new ForbiddenException('This endpoint is only available locally');
    }

    return true;
  }
}
