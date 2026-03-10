import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { LocalDevGuard } from './local-dev.guard';
import { OpsController } from './ops.controller';
import { OpsService } from './ops.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [OpsController],
  providers: [OpsService, LocalDevGuard],
})
export class OpsModule {}
