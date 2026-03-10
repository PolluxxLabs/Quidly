import { Injectable } from '@nestjs/common';
import { sanitizeForLogs } from './log-redaction.util';

type LogLevel = 'info' | 'warn' | 'error';

@Injectable()
export class AppLogger {
  log(event: string, metadata: Record<string, unknown> = {}) {
    this.write('info', event, metadata);
  }

  warn(event: string, metadata: Record<string, unknown> = {}) {
    this.write('warn', event, metadata);
  }

  error(event: string, metadata: Record<string, unknown> = {}) {
    this.write('error', event, metadata);
  }

  private write(
    level: LogLevel,
    event: string,
    metadata: Record<string, unknown>,
  ) {
    const line = JSON.stringify(
      sanitizeForLogs({
        level,
        event,
        timestamp: new Date().toISOString(),
        ...metadata,
      }),
    );

    if (level === 'error') {
      process.stderr.write(`${line}\n`);
      return;
    }

    process.stdout.write(`${line}\n`);
  }
}
