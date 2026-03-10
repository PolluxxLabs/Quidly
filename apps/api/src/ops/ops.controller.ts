import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentMerchant } from '../auth/decorators/current-merchant.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LocalDevGuard } from './local-dev.guard';
import { OpsService } from './ops.service';

@Controller()
export class OpsController {
  constructor(private readonly opsService: OpsService) {}

  @Get('health')
  getAppHealth() {
    return this.opsService.getAppHealth();
  }

  @Get('health/db')
  getDatabaseHealth() {
    return this.opsService.getDatabaseHealth();
  }

  @Get('health/redis')
  getRedisHealth() {
    return this.opsService.getRedisHealth();
  }

  @Get('metrics')
  getMetrics() {
    return this.opsService.getMetricsSnapshot();
  }

  @Get('internal/dev/payments/:id/inspect')
  @UseGuards(JwtAuthGuard, LocalDevGuard)
  inspectPayment(
    @CurrentMerchant() merchant: { merchantId: string },
    @Param('id') id: string,
  ) {
    return this.opsService.inspectPayment(merchant.merchantId, id);
  }
}
