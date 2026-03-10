import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CryptoAsset,
  CryptoChain,
  CryptoInvoiceStatus,
  LedgerDirection,
  LedgerEntryType,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProviderName,
} from '@prisma/client';
import { AppLogger } from '../../common/logging/app-logger.service';
import { CryptoService } from '../../crypto/crypto.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WebhooksService } from '../../webhooks/webhooks.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { PaymentJobsService } from '../payment-jobs.service';
import { PaymentProviderHandler } from './payment-provider.interface';

@Injectable()
export class CryptoPaymentProvider implements PaymentProviderHandler {
  readonly method = PaymentMethod.CRYPTO;

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooksService: WebhooksService,
    private readonly paymentJobsService: PaymentJobsService,
    private readonly cryptoService: CryptoService,
    private readonly logger: AppLogger,
  ) {}

  async createPayment(
    merchantId: string,
    dto: CreatePaymentDto,
    idempotencyKey?: string,
  ) {
    const asset = dto.asset;
    const chain = dto.chain;

    if (!asset || !chain) {
      throw new BadRequestException('Crypto payments require asset and chain');
    }

    if (asset !== CryptoAsset.USDC || chain !== CryptoChain.BASE) {
      throw new BadRequestException('Only USDC on BASE is supported for now');
    }

    if (idempotencyKey) {
      const existing = await this.prisma.paymentIntent.findUnique({
        where: {
          merchantId_idempotencyKey: {
            merchantId,
            idempotencyKey,
          },
        },
        include: {
          cryptoInvoice: true,
        },
      });

      if (existing) {
        return existing;
      }
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const expectedAmountRaw = this.cryptoService.getExpectedAmountRaw(
      dto.amount,
      asset,
      chain,
    );

    const result = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const payment = await tx.paymentIntent.create({
          data: {
            merchantId,
            amount: new Prisma.Decimal(dto.amount),
            currency: dto.currency,
            method: PaymentMethod.CRYPTO,
            reference: dto.reference,
            idempotencyKey,
            status: PaymentStatus.AWAITING_PAYMENT,
            provider: ProviderName.CRYPTO,
            customerEmail: dto.customerEmail,
            description: dto.description,
          },
        });
        const address = this.cryptoService.generateInvoiceAddress(
          payment.id,
          asset,
          chain,
        );
        const cryptoInvoice = await tx.cryptoInvoice.create({
          data: {
            paymentIntentId: payment.id,
            asset,
            chain,
            address,
            expectedAmount: new Prisma.Decimal(dto.amount),
            expectedAmountRaw,
            status: CryptoInvoiceStatus.AWAITING_PAYMENT,
            expiresAt,
          },
        });

        await tx.ledgerEntry.create({
          data: {
            merchantId,
            paymentIntentId: payment.id,
            entryType: LedgerEntryType.PAYMENT_INFLOW,
            direction: LedgerDirection.CREDIT,
            currency: dto.currency,
            amount: new Prisma.Decimal(dto.amount),
            description: `Payment intent created for ${dto.amount} ${dto.currency}`,
          },
        });

        const webhookDelivery = await this.webhooksService.enqueuePaymentEvent(
          tx,
          payment.id,
          'payment.awaiting_payment',
        );

        return {
          ...payment,
          cryptoInvoice,
          webhookDelivery,
        };
      },
    );

    await this.enqueueWebhookDeliveryIfAny(result.webhookDelivery?.id);
    await this.paymentJobsService.enqueueCryptoExpiry(
      result.id,
      result.cryptoInvoice.expiresAt,
    );
    await this.paymentJobsService.enqueueCryptoMonitoring({
      paymentId: result.id,
      chain: result.cryptoInvoice.chain,
      asset: result.cryptoInvoice.asset,
    });

    this.logger.log('payment.intent.created', {
      correlationId: result.id,
      paymentId: result.id,
      merchantId: result.merchantId,
      amount: result.amount.toString(),
      currency: result.currency,
      method: result.method,
      provider: result.provider,
      paymentStatus: result.status,
      invoiceStatus: result.cryptoInvoice.status,
      chain: result.cryptoInvoice.chain,
      asset: result.cryptoInvoice.asset,
      expiresAt: result.cryptoInvoice.expiresAt.toISOString(),
    });

    return {
      id: result.id,
      merchantId: result.merchantId,
      amount: result.amount,
      currency: result.currency,
      method: result.method,
      reference: result.reference,
      idempotencyKey: result.idempotencyKey,
      status: result.status,
      provider: result.provider,
      providerRef: result.providerRef,
      customerEmail: result.customerEmail,
      customerPhone: result.customerPhone,
      description: result.description,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      cryptoInvoice: result.cryptoInvoice,
    };
  }

  private async enqueueWebhookDeliveryIfAny(deliveryId?: string) {
    if (!deliveryId) {
      return;
    }

    await this.webhooksService.enqueueDeliveryJob(deliveryId);
  }
}
