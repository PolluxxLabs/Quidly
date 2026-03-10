import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { getRedisConnection } from '../queues/redis.config';

@Injectable()
export class OpsService {
  private readonly startedAt = new Date();

  constructor(private readonly prisma: PrismaService) {}

  getAppHealth() {
    return {
      status: 'ok',
      service: 'quidly-api',
      startedAt: this.startedAt.toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  async getDatabaseHealth() {
    try {
      await this.prisma.$queryRaw(Prisma.sql`SELECT 1`);

      return {
        status: 'ok',
        database: 'postgres',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException('Database health check failed');
    }
  }

  async getRedisHealth() {
    const redis = new Redis({
      ...getRedisConnection(),
      lazyConnect: true,
      enableReadyCheck: false,
      maxRetriesPerRequest: 1,
    });

    try {
      await redis.connect();
      const result = await redis.ping();

      return {
        status: result === 'PONG' ? 'ok' : 'unknown',
        redis: result,
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException('Redis health check failed');
    } finally {
      if (redis.status !== 'end') {
        await redis.quit().catch(() => {
          redis.disconnect();
        });
      }
    }
  }

  async getMetricsSnapshot() {
    const [merchantCount, paymentCount, pendingWebhooks, failedWebhooks] =
      await Promise.all([
        this.prisma.merchant.count(),
        this.prisma.paymentIntent.count(),
        this.prisma.webhookDelivery.count({
          where: { status: 'PENDING' },
        }),
        this.prisma.webhookDelivery.count({
          where: { status: 'FAILED' },
        }),
      ]);

    return {
      format: 'json-placeholder',
      note: 'Replace with Prometheus or OpenTelemetry in production.',
      generatedAt: new Date().toISOString(),
      counters: {
        merchants_total: merchantCount,
        payments_total: paymentCount,
        webhook_deliveries_pending: pendingWebhooks,
        webhook_deliveries_failed: failedWebhooks,
      },
    };
  }

  async inspectPayment(merchantId: string, paymentId: string) {
    const payment = await this.prisma.paymentIntent.findFirst({
      where: {
        id: paymentId,
        merchantId,
      },
      include: {
        cryptoInvoice: {
          include: {
            transactions: {
              orderBy: { detectedAt: 'asc' },
            },
          },
        },
        providerEvents: {
          orderBy: { createdAt: 'asc' },
        },
        ledgerEntries: {
          orderBy: { createdAt: 'asc' },
        },
        webhookLogs: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }
}
