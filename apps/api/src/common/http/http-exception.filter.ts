import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import { AppLogger } from '../logging/app-logger.service';
import { sanitizeForLogs } from '../logging/log-redaction.util';
import { RequestWithContext } from './request-context';

type ErrorPayload = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId: string | null;
  timestamp: string;
  path: string;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithContext>();
    const response = context.getResponse<Response>();
    const timestamp = new Date().toISOString();
    const requestId = request.requestId ?? null;
    const status: number =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const payload = this.buildPayload(
      status,
      exception instanceof Error ? exception : null,
      exceptionResponse,
      requestId,
      timestamp,
      request.originalUrl,
    );

    const logMetadata = {
      requestId,
      method: request.method,
      path: request.originalUrl,
      statusCode: status,
      error: exception instanceof Error ? exception : undefined,
      response: sanitizeForLogs(exceptionResponse),
    };

    if (status >= 500) {
      this.logger.error('http.request.failed', logMetadata);
    } else {
      this.logger.warn('http.request.failed', logMetadata);
    }

    response.status(status).json(payload);
  }

  private buildPayload(
    status: number,
    error: Error | null,
    exceptionResponse: unknown,
    requestId: string | null,
    timestamp: string,
    path: string,
  ): ErrorPayload {
    if (Array.isArray(exceptionResponse)) {
      return {
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Request validation failed',
          details: sanitizeForLogs(exceptionResponse),
        },
        requestId,
        timestamp,
        path,
      };
    }

    if (
      exceptionResponse &&
      typeof exceptionResponse === 'object' &&
      !Array.isArray(exceptionResponse)
    ) {
      const responseRecord = exceptionResponse as Record<string, unknown>;
      const message = responseRecord.message;
      const details = Array.isArray(message) ? message : undefined;

      return {
        success: false,
        error: {
          code: this.getErrorCode(status, responseRecord.error),
          message:
            Array.isArray(message) || typeof message !== 'string'
              ? (error?.message ?? 'Request failed')
              : message,
          details: details ? sanitizeForLogs(details) : undefined,
        },
        requestId,
        timestamp,
        path,
      };
    }

    if (typeof exceptionResponse === 'string') {
      return {
        success: false,
        error: {
          code: this.getErrorCode(status),
          message: exceptionResponse,
        },
        requestId,
        timestamp,
        path,
      };
    }

    return {
      success: false,
      error: {
        code: this.getErrorCode(status),
        message:
          error?.message ??
          (status === 500 ? 'Internal server error' : 'Request failed'),
      },
      requestId,
      timestamp,
      path,
    };
  }

  private getErrorCode(status: number, errorName?: unknown) {
    if (typeof errorName === 'string') {
      return errorName.toUpperCase().replace(/\s+/g, '_');
    }

    if (status === 400) {
      return 'BAD_REQUEST';
    }

    if (status === 401) {
      return 'UNAUTHORIZED';
    }

    if (status === 429) {
      return 'RATE_LIMITED';
    }

    if (status === 404) {
      return 'NOT_FOUND';
    }

    return 'INTERNAL_SERVER_ERROR';
  }
}
