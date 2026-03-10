import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { MerchantEnvironment, MerchantStatus } from '@prisma/client';
import { WebhookSecretsService } from '../common/security/webhook-secrets.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly webhookSecretsService: WebhookSecretsService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.merchant.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('Merchant with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const webhookSecret = this.webhookSecretsService.generateSecret();
    const storedWebhookSecret =
      this.webhookSecretsService.prepareForStorage(webhookSecret);
    const now = new Date();
    const merchant = await this.prisma.merchant.create({
      data: {
        name: dto.name,
        email: dto.email.toLowerCase(),
        passwordHash,
        webhookSecret: null,
        webhookSecretEncrypted: storedWebhookSecret.encrypted,
        webhookSecretHash: storedWebhookSecret.hash,
        webhookSecretUpdatedAt: now,
        defaultEnvironment: MerchantEnvironment.SANDBOX,
        status: MerchantStatus.ACTIVE,
      },
    });

    const token = await this.signToken(merchant.id, merchant.email);

    return {
      merchant: {
        id: merchant.id,
        name: merchant.name,
        email: merchant.email,
        status: merchant.status,
      },
      accessToken: token,
    };
  }

  async login(dto: LoginDto) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!merchant) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, merchant.passwordHash);

    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = await this.signToken(merchant.id, merchant.email);

    return {
      merchant: {
        id: merchant.id,
        name: merchant.name,
        email: merchant.email,
        status: merchant.status,
      },
      accessToken: token,
    };
  }

  private async signToken(sub: string, email: string) {
    return this.jwtService.signAsync({
      sub,
      email,
    });
  }
}
