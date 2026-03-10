import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { randomUUID } from 'crypto';
import { AppLogger } from '../logging/app-logger.service';
import { RequestWithContext } from './request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly logger: AppLogger) {}

  use(request: RequestWithContext, response: Response, next: NextFunction) {
    const requestId =
      typeof request.headers['x-request-id'] === 'string' &&
      request.headers['x-request-id'].length > 0
        ? request.headers['x-request-id']
        : randomUUID();
    const startedAt = Date.now();

    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);

    response.on('finish', () => {
      const metadata = {
        requestId,
        method: request.method,
        path: request.originalUrl,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
        ip: request.ip,
        headers: {
          authorization: request.headers.authorization,
          'user-agent': request.headers['user-agent'],
        },
      };

      if (response.statusCode >= 500) {
        this.logger.error('http.request.completed', metadata);
        return;
      }

      if (response.statusCode >= 400) {
        this.logger.warn('http.request.completed', metadata);
        return;
      }

      this.logger.log('http.request.completed', metadata);
    });

    next();
  }
}
