import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CryptoInvoiceStatus,
  CryptoTransaction as CryptoTransactionRecord,
  CryptoTxStatus,
  LedgerDirection,
  LedgerEntryType,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProviderName,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { AppLogger } from '../common/logging/app-logger.service';
import { CryptoService } from '../crypto/crypto.service';
import { ObservedCryptoTransfer } from '../crypto/crypto.types';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentJobsService } from './payment-jobs.service';
import { PaymentProviderRegistry } from './providers/payment-provider.registry';

type PaymentWithCryptoInvoice = Prisma.PaymentIntentGetPayload<{
  include: {
    cryptoInvoice: {
      include: {
        transactions: {
          orderBy: {
            detectedAt: 'asc';
          };
        };
      };
    };
  };
}>;

type CryptoPaymentRecord = Omit<PaymentWithCryptoInvoice, 'cryptoInvoice'> & {
  cryptoInvoice: NonNullable<PaymentWithCryptoInvoice['cryptoInvoice']>;
};

const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  [PaymentStatus.PENDING]: [PaymentStatus.AWAITING_PAYMENT],
  [PaymentStatus.AWAITING_PAYMENT]: [
    PaymentStatus.CONFIRMING,
    PaymentStatus.EXPIRED,
  ],
  [PaymentStatus.AWAITING_CUSTOMER_ACTION]: [],
  [PaymentStatus.CONFIRMING]: [PaymentStatus.SUCCEEDED, PaymentStatus.EXPIRED],
  [PaymentStatus.SUCCEEDED]: [],
  [PaymentStatus.FAILED]: [],
  [PaymentStatus.EXPIRED]: [],
  [PaymentStatus.CANCELLED]: [],
  [PaymentStatus.REFUNDED]: [],
  [PaymentStatus.REVERSED]: [],
};

const INVOICE_TRANSITIONS: Record<CryptoInvoiceStatus, CryptoInvoiceStatus[]> =
  {
    [CryptoInvoiceStatus.PENDING]: [CryptoInvoiceStatus.AWAITING_PAYMENT],
    [CryptoInvoiceStatus.AWAITING_PAYMENT]: [
      CryptoInvoiceStatus.CONFIRMING,
      CryptoInvoiceStatus.EXPIRED,
    ],
    [CryptoInvoiceStatus.DETECTED]: [CryptoInvoiceStatus.CONFIRMING],
    [CryptoInvoiceStatus.CONFIRMING]: [
      CryptoInvoiceStatus.SUCCEEDED,
      CryptoInvoiceStatus.EXPIRED,
    ],
    [CryptoInvoiceStatus.SUCCEEDED]: [],
    [CryptoInvoiceStatus.FAILED]: [],
    [CryptoInvoiceStatus.EXPIRED]: [],
  };

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooksService: WebhooksService,
    private readonly paymentJobsService: PaymentJobsService,
    private readonly cryptoService: CryptoService,
    private readonly logger: AppLogger,
    private readonly paymentProviderRegistry: PaymentProviderRegistry,
  ) {}

  async createPayment(
    merchantId: string,
    dto: CreatePaymentDto,
    idempotencyKey?: string,
  ) {
    return this.paymentProviderRegistry
      .getProvider(dto.method)
      .createPayment(merchantId, dto, idempotencyKey);
  }

  async listPayments(merchantId: string) {
    return this.prisma.paymentIntent.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
      include: {
        cryptoInvoice: true,
      },
    });
  }

  async getMerchantOverview(merchantId: string) {
    const [payments, succeeded, confirming, awaitingPayment, expired] =
      await Promise.all([
        this.prisma.paymentIntent.findMany({
          where: { merchantId },
          include: {
            cryptoInvoice: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.paymentIntent.count({
          where: { merchantId, status: PaymentStatus.SUCCEEDED },
        }),
        this.prisma.paymentIntent.count({
          where: { merchantId, status: PaymentStatus.CONFIRMING },
        }),
        this.prisma.paymentIntent.count({
          where: { merchantId, status: PaymentStatus.AWAITING_PAYMENT },
        }),
        this.prisma.paymentIntent.count({
          where: { merchantId, status: PaymentStatus.EXPIRED },
        }),
      ]);
    const successfulVolume = payments
      .filter((payment) => payment.status === PaymentStatus.SUCCEEDED)
      .reduce(
        (sum, payment) => sum.plus(payment.amount),
        new Prisma.Decimal(0),
      );

    return {
      totals: {
        payments: payments.length,
        succeeded,
        confirming,
        awaitingPayment,
        expired,
        successfulVolume: successfulVolume.toString(),
      },
      recentPayments: payments.slice(0, 5),
    };
  }

  async getPayment(merchantId: string, paymentId: string) {
    return this.prisma.paymentIntent.findFirst({
      where: {
        id: paymentId,
        merchantId,
      },
      include: {
        cryptoInvoice: {
          include: {
            transactions: true,
          },
        },
      },
    });
  }

  async markCryptoDetected(paymentId: string) {
    const payment = await this.loadCryptoPayment(paymentId);

    this.assertPaymentTransition(
      payment.status,
      PaymentStatus.CONFIRMING,
      'payment',
    );
    this.assertInvoiceTransition(
      payment.cryptoInvoice.status,
      CryptoInvoiceStatus.CONFIRMING,
    );

    return this.applyDetectedTransfer(payment, {
      txHash: `0xdetected${randomUUID().replace(/-/g, '').slice(0, 24)}`,
      fromAddress: '0x1111111111111111111111111111111111111111',
      toAddress: payment.cryptoInvoice.address,
      amountRaw: this.getExpectedAmountRaw(payment),
      blockNumber: null,
      confirmations: 0,
    });
  }

  async markCryptoConfirmed(paymentId: string) {
    const payment = await this.loadCryptoPayment(paymentId);
    const transaction = this.getTrackedTransaction(payment);

    if (!transaction) {
      throw new BadRequestException('No crypto transaction found');
    }

    this.assertPaymentTransition(
      payment.status,
      PaymentStatus.SUCCEEDED,
      'payment',
    );
    this.assertInvoiceTransition(
      payment.cryptoInvoice.status,
      CryptoInvoiceStatus.SUCCEEDED,
    );

    return this.applyConfirmation(payment, transaction, 3);
  }

  async expireCryptoPayment(paymentId: string) {
    const payment = await this.loadCryptoPayment(paymentId);

    this.assertPaymentTransition(
      payment.status,
      PaymentStatus.EXPIRED,
      'payment',
    );
    this.assertInvoiceTransition(
      payment.cryptoInvoice.status,
      CryptoInvoiceStatus.EXPIRED,
    );

    const result = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const cryptoInvoice = await tx.cryptoInvoice.update({
          where: { id: payment.cryptoInvoice.id },
          data: {
            status: CryptoInvoiceStatus.EXPIRED,
          },
        });
        const updatedPayment = await tx.paymentIntent.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.EXPIRED,
          },
        });

        await this.createProviderEventIfAbsent(tx, {
          paymentId: payment.id,
          eventType: 'crypto.payment_expired',
          externalEventId: `expired:${payment.id}`,
          payload: {
            paymentId: payment.id,
            cryptoInvoiceId: payment.cryptoInvoice.id,
          },
        });

        const webhookDelivery = await this.webhooksService.enqueuePaymentEvent(
          tx,
          payment.id,
          'payment.expired',
        );

        return {
          payment: updatedPayment,
          cryptoInvoice,
          webhookDelivery,
        };
      },
    );

    await this.enqueueWebhookDeliveryIfAny(result.webhookDelivery?.id);

    this.logPaymentTransition('payment.expired', {
      paymentId: result.payment.id,
      merchantId: result.payment.merchantId,
      paymentStatus: result.payment.status,
      invoiceStatus: result.cryptoInvoice.status,
    });

    return {
      payment: result.payment,
      cryptoInvoice: result.cryptoInvoice,
    };
  }

  async processScheduledCryptoExpiry(paymentId: string) {
    const payment = await this.loadCryptoPayment(paymentId);

    if (this.isTerminalCryptoPayment(payment)) {
      return {
        skipped: true,
        reason: 'payment_already_terminal',
      };
    }

    if (payment.cryptoInvoice.expiresAt.getTime() > Date.now()) {
      return {
        skipped: true,
        reason: 'invoice_not_due',
      };
    }

    if (!this.canExpire(payment)) {
      return {
        skipped: true,
        reason: 'payment_not_expirable',
      };
    }

    return {
      skipped: false,
      result: await this.expireCryptoPayment(paymentId),
    };
  }

  async syncCryptoPaymentFromChain(paymentId: string) {
    const payment = await this.loadCryptoPayment(paymentId);

    if (this.isTerminalCryptoPayment(payment)) {
      return {
        skipped: true,
        reason: 'payment_already_terminal',
      };
    }

    const transaction = this.getTrackedTransaction(payment);
    const requiredConfirmations = this.cryptoService.getRequiredConfirmations(
      payment.cryptoInvoice.asset,
      payment.cryptoInvoice.chain,
    );

    if (transaction) {
      const confirmations = await this.cryptoService.getConfirmations(
        transaction.txHash,
        transaction.blockNumber,
        transaction.asset,
        transaction.chain,
      );

      if (confirmations >= requiredConfirmations) {
        return {
          skipped: false,
          action: 'confirmed',
          result: await this.applyConfirmation(
            payment,
            transaction,
            confirmations,
          ),
        };
      }

      if (confirmations > transaction.confirmations) {
        await this.prisma.cryptoTransaction.update({
          where: { id: transaction.id },
          data: {
            confirmations,
            status: CryptoTxStatus.CONFIRMING,
          },
        });
      }

      await this.paymentJobsService.enqueueCryptoMonitoring({
        paymentId,
        chain: payment.cryptoInvoice.chain,
        asset: payment.cryptoInvoice.asset,
      });

      return {
        skipped: false,
        action: 'confirming',
        confirmations,
      };
    }

    const lookup = await this.cryptoService.findTransferToAddress(
      payment.cryptoInvoice.address,
      this.getExpectedAmountRaw(payment),
      payment.cryptoInvoice.asset,
      payment.cryptoInvoice.chain,
    );

    if (lookup.status === 'mismatch' && lookup.transfer) {
      await this.createProviderEventIfAbsent(this.prisma, {
        paymentId: payment.id,
        eventType: 'crypto.amount_mismatch',
        externalEventId: `mismatch:${lookup.transfer.txHash}`,
        payload: {
          paymentId: payment.id,
          cryptoInvoiceId: payment.cryptoInvoice.id,
          txHash: lookup.transfer.txHash,
          expectedAmountRaw: this.getExpectedAmountRaw(payment),
          observedAmountRaw: lookup.transfer.amountRaw,
        },
      });

      await this.paymentJobsService.enqueueCryptoMonitoring({
        paymentId,
        chain: payment.cryptoInvoice.chain,
        asset: payment.cryptoInvoice.asset,
      });

      return {
        skipped: true,
        reason: 'amount_mismatch',
      };
    }

    if (lookup.status === 'not_found' || !lookup.transfer) {
      await this.paymentJobsService.enqueueCryptoMonitoring({
        paymentId,
        chain: payment.cryptoInvoice.chain,
        asset: payment.cryptoInvoice.asset,
      });

      return {
        skipped: true,
        reason: 'transfer_not_found',
      };
    }

    const detectionResult = await this.applyDetectedTransfer(
      payment,
      lookup.transfer,
    );

    if (lookup.transfer.confirmations >= requiredConfirmations) {
      const confirmedPayment = await this.loadCryptoPayment(paymentId);
      const confirmedTransaction = this.getTrackedTransaction(confirmedPayment);

      if (!confirmedTransaction) {
        throw new BadRequestException('Detected transfer was not persisted');
      }

      return {
        skipped: false,
        action: 'confirmed',
        result: await this.applyConfirmation(
          confirmedPayment,
          confirmedTransaction,
          lookup.transfer.confirmations,
        ),
      };
    }

    await this.paymentJobsService.enqueueCryptoMonitoring({
      paymentId,
      chain: payment.cryptoInvoice.chain,
      asset: payment.cryptoInvoice.asset,
    });

    return {
      skipped: false,
      action: 'detected',
      result: detectionResult,
    };
  }

  private async applyDetectedTransfer(
    payment: CryptoPaymentRecord,
    transfer: ObservedCryptoTransfer,
  ) {
    const result = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const existingTransaction = await tx.cryptoTransaction.findUnique({
          where: { txHash: transfer.txHash },
        });

        if (existingTransaction) {
          this.assertStatus(
            existingTransaction.cryptoInvoiceId === payment.cryptoInvoice.id,
            'Transaction already belongs to another invoice',
          );

          return {
            payment,
            cryptoInvoice: payment.cryptoInvoice,
            cryptoTransaction: existingTransaction,
            webhookDelivery: null,
          };
        }

        const cryptoTransaction = await tx.cryptoTransaction.create({
          data: {
            cryptoInvoiceId: payment.cryptoInvoice.id,
            txHash: transfer.txHash,
            fromAddress: transfer.fromAddress,
            toAddress: transfer.toAddress,
            asset: payment.cryptoInvoice.asset,
            chain: payment.cryptoInvoice.chain,
            amount: payment.cryptoInvoice.expectedAmount,
            amountRaw: transfer.amountRaw,
            blockNumber: transfer.blockNumber,
            confirmations: transfer.confirmations,
            status:
              transfer.confirmations > 0
                ? CryptoTxStatus.CONFIRMING
                : CryptoTxStatus.DETECTED,
          },
        });
        const cryptoInvoice = await tx.cryptoInvoice.update({
          where: { id: payment.cryptoInvoice.id },
          data: {
            status: CryptoInvoiceStatus.CONFIRMING,
          },
        });
        const updatedPayment = await tx.paymentIntent.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.CONFIRMING,
          },
        });

        await this.createProviderEventIfAbsent(tx, {
          paymentId: payment.id,
          eventType: 'crypto.payment_detected',
          externalEventId: `detected:${transfer.txHash}`,
          payload: {
            paymentId: payment.id,
            cryptoInvoiceId: payment.cryptoInvoice.id,
            txHash: transfer.txHash,
            confirmations: transfer.confirmations,
          },
        });

        const webhookDelivery = await this.webhooksService.enqueuePaymentEvent(
          tx,
          payment.id,
          'payment.confirming',
        );

        return {
          payment: updatedPayment,
          cryptoInvoice,
          cryptoTransaction,
          webhookDelivery,
        };
      },
    );

    await this.enqueueWebhookDeliveryIfAny(result.webhookDelivery?.id);

    this.logPaymentTransition('payment.confirming', {
      paymentId: result.payment.id,
      merchantId: result.payment.merchantId,
      paymentStatus: result.payment.status,
      invoiceStatus: result.cryptoInvoice.status,
      txHash: result.cryptoTransaction.txHash,
      confirmations: result.cryptoTransaction.confirmations,
    });

    return {
      payment: result.payment,
      cryptoInvoice: result.cryptoInvoice,
      cryptoTransaction: result.cryptoTransaction,
    };
  }

  private async applyConfirmation(
    payment: CryptoPaymentRecord,
    transaction: CryptoTransactionRecord,
    confirmations: number,
  ) {
    const result = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const cryptoTransaction = await tx.cryptoTransaction.update({
          where: { id: transaction.id },
          data: {
            confirmations,
            status: CryptoTxStatus.CONFIRMED,
            confirmedAt: new Date(),
          },
        });
        const cryptoInvoice = await tx.cryptoInvoice.update({
          where: { id: payment.cryptoInvoice.id },
          data: {
            status: CryptoInvoiceStatus.SUCCEEDED,
            paidAt: new Date(),
          },
        });
        const updatedPayment = await tx.paymentIntent.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.SUCCEEDED,
          },
        });

        await this.createMerchantPayableIfAbsent(tx, payment);
        await this.createProviderEventIfAbsent(tx, {
          paymentId: payment.id,
          eventType: 'crypto.payment_confirmed',
          externalEventId: `confirmed:${transaction.txHash}`,
          payload: {
            paymentId: payment.id,
            cryptoInvoiceId: payment.cryptoInvoice.id,
            txHash: transaction.txHash,
            confirmations,
          },
        });

        const webhookDelivery = await this.webhooksService.enqueuePaymentEvent(
          tx,
          payment.id,
          'payment.succeeded',
        );

        return {
          payment: updatedPayment,
          cryptoInvoice,
          cryptoTransaction,
          webhookDelivery,
        };
      },
    );

    await this.enqueueWebhookDeliveryIfAny(result.webhookDelivery?.id);

    this.logPaymentTransition('payment.succeeded', {
      paymentId: result.payment.id,
      merchantId: result.payment.merchantId,
      paymentStatus: result.payment.status,
      invoiceStatus: result.cryptoInvoice.status,
      txHash: result.cryptoTransaction.txHash,
      confirmations: result.cryptoTransaction.confirmations,
    });

    return {
      payment: result.payment,
      cryptoInvoice: result.cryptoInvoice,
      cryptoTransaction: result.cryptoTransaction,
    };
  }

  private async createMerchantPayableIfAbsent(
    tx: Prisma.TransactionClient,
    payment: CryptoPaymentRecord,
  ) {
    const existingLedgerEntry = await tx.ledgerEntry.findFirst({
      where: {
        paymentIntentId: payment.id,
        entryType: LedgerEntryType.MERCHANT_PAYABLE,
      },
    });

    if (existingLedgerEntry) {
      this.logger.log('ledger.entry.skipped', {
        correlationId: payment.id,
        paymentId: payment.id,
        merchantId: payment.merchantId,
        entryType: LedgerEntryType.MERCHANT_PAYABLE,
        reason: 'already_exists',
      });
      return existingLedgerEntry;
    }

    const ledgerEntry = await tx.ledgerEntry.create({
      data: {
        merchantId: payment.merchantId,
        paymentIntentId: payment.id,
        entryType: LedgerEntryType.MERCHANT_PAYABLE,
        direction: LedgerDirection.CREDIT,
        currency: payment.currency,
        amount: payment.amount,
        description: `Crypto payment confirmed for ${payment.amount.toString()} ${payment.currency}`,
      },
    });

    this.logger.log('ledger.entry.created', {
      correlationId: payment.id,
      paymentId: payment.id,
      merchantId: payment.merchantId,
      entryType: ledgerEntry.entryType,
      amount: ledgerEntry.amount.toString(),
      currency: ledgerEntry.currency,
    });

    return ledgerEntry;
  }

  private async createProviderEventIfAbsent(
    client: PrismaService | Prisma.TransactionClient,
    params: {
      paymentId: string;
      eventType: string;
      externalEventId: string;
      payload: Prisma.InputJsonObject;
    },
  ) {
    const existing = await client.providerEvent.findUnique({
      where: {
        provider_externalEventId: {
          provider: ProviderName.CRYPTO,
          externalEventId: params.externalEventId,
        },
      },
    });

    if (existing) {
      this.logger.log('provider.event.duplicate', {
        correlationId: params.paymentId,
        paymentId: params.paymentId,
        provider: ProviderName.CRYPTO,
        eventType: params.eventType,
        externalEventId: params.externalEventId,
      });
      return existing;
    }

    const providerEvent = await client.providerEvent.create({
      data: {
        paymentIntentId: params.paymentId,
        provider: ProviderName.CRYPTO,
        eventType: params.eventType,
        externalEventId: params.externalEventId,
        payload: params.payload,
        processed: true,
        processedAt: new Date(),
      },
    });

    this.logger.log('provider.event.created', {
      correlationId: params.paymentId,
      paymentId: params.paymentId,
      provider: providerEvent.provider,
      eventType: providerEvent.eventType,
      externalEventId: providerEvent.externalEventId,
    });

    return providerEvent;
  }

  private async enqueueWebhookDeliveryIfAny(deliveryId?: string) {
    if (!deliveryId) {
      return;
    }

    await this.webhooksService.enqueueDeliveryJob(deliveryId);
  }

  private loadCryptoPayment(paymentId: string) {
    return this.prisma.paymentIntent
      .findFirst({
        where: {
          id: paymentId,
          method: PaymentMethod.CRYPTO,
        },
        include: {
          cryptoInvoice: {
            include: {
              transactions: {
                orderBy: {
                  detectedAt: 'asc',
                },
              },
            },
          },
        },
      })
      .then((payment): CryptoPaymentRecord => {
        if (!payment || !payment.cryptoInvoice) {
          throw new BadRequestException('Crypto payment not found');
        }

        return payment as CryptoPaymentRecord;
      });
  }

  private getTrackedTransaction(payment: CryptoPaymentRecord) {
    return payment.cryptoInvoice.transactions.find(
      (transaction) => transaction.status !== CryptoTxStatus.FAILED,
    );
  }

  private getExpectedAmountRaw(payment: CryptoPaymentRecord) {
    return (
      payment.cryptoInvoice.expectedAmountRaw ??
      this.cryptoService.getExpectedAmountRaw(
        payment.cryptoInvoice.expectedAmount.toString(),
        payment.cryptoInvoice.asset,
        payment.cryptoInvoice.chain,
      )
    );
  }

  private isTerminalCryptoPayment(payment: CryptoPaymentRecord) {
    return (
      payment.status === PaymentStatus.SUCCEEDED ||
      payment.status === PaymentStatus.EXPIRED ||
      payment.cryptoInvoice.status === CryptoInvoiceStatus.SUCCEEDED ||
      payment.cryptoInvoice.status === CryptoInvoiceStatus.EXPIRED
    );
  }

  private canExpire(payment: CryptoPaymentRecord) {
    const paymentStatusAllowsExpiry =
      payment.status === PaymentStatus.AWAITING_PAYMENT ||
      payment.status === PaymentStatus.CONFIRMING;
    const invoiceStatusAllowsExpiry =
      payment.cryptoInvoice.status === CryptoInvoiceStatus.AWAITING_PAYMENT ||
      payment.cryptoInvoice.status === CryptoInvoiceStatus.CONFIRMING;

    return paymentStatusAllowsExpiry && invoiceStatusAllowsExpiry;
  }

  private assertPaymentTransition(
    from: PaymentStatus,
    to: PaymentStatus,
    entity: 'payment' | 'invoice',
  ) {
    if (!PAYMENT_TRANSITIONS[from].includes(to)) {
      throw new BadRequestException(
        `Crypto ${entity} cannot transition from ${from} to ${to}`,
      );
    }
  }

  private assertInvoiceTransition(
    from: CryptoInvoiceStatus,
    to: CryptoInvoiceStatus,
  ) {
    if (!INVOICE_TRANSITIONS[from].includes(to)) {
      throw new BadRequestException(
        `Crypto invoice cannot transition from ${from} to ${to}`,
      );
    }
  }

  private assertStatus(condition: boolean, message: string) {
    if (!condition) {
      throw new BadRequestException(message);
    }
  }

  private logPaymentTransition(
    event: string,
    metadata: {
      paymentId: string;
      merchantId: string;
      paymentStatus: PaymentStatus;
      invoiceStatus: CryptoInvoiceStatus;
      txHash?: string;
      confirmations?: number;
    },
  ) {
    this.logger.log(event, {
      correlationId: metadata.paymentId,
      paymentId: metadata.paymentId,
      merchantId: metadata.merchantId,
      paymentStatus: metadata.paymentStatus,
      invoiceStatus: metadata.invoiceStatus,
      txHash: metadata.txHash,
      confirmations: metadata.confirmations,
    });
  }
}
