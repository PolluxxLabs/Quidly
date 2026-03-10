import { BadRequestException } from '@nestjs/common';
import {
  CryptoAsset,
  CryptoChain,
  CryptoInvoiceStatus,
  CryptoTxStatus,
  LedgerDirection,
  LedgerEntryType,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProviderName,
} from '@prisma/client';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  type CreateArgs = {
    data: Record<string, unknown>;
  };

  type TransactionCallback = (
    tx: ReturnType<typeof createPrismaMock>,
  ) => unknown;

  const createPrismaMock = () => {
    const prisma = {
      paymentIntent: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      cryptoTransaction: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      cryptoInvoice: {
        create: jest.fn(),
        update: jest.fn(),
      },
      providerEvent: {
        findUnique: jest.fn(),
        create: jest
          .fn()
          .mockImplementation(({ data }: CreateArgs) => Promise.resolve(data)),
      },
      ledgerEntry: {
        findFirst: jest.fn(),
        create: jest
          .fn()
          .mockImplementation(({ data }: CreateArgs) => Promise.resolve(data)),
      },
      $transaction: jest.fn(),
    };

    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      Promise.resolve(callback(prisma)),
    );

    return prisma;
  };

  const buildPayment = (
    overrides: Partial<{
      paymentStatus: PaymentStatus;
      invoiceStatus: CryptoInvoiceStatus;
      expiresAt: Date;
      transactions: Array<{
        id: string;
        txHash: string;
      }>;
    }> = {},
  ) => ({
    id: 'pay_123',
    merchantId: 'merchant_123',
    amount: new Prisma.Decimal('25.50'),
    currency: 'USD',
    method: PaymentMethod.CRYPTO,
    status: overrides.paymentStatus ?? PaymentStatus.AWAITING_PAYMENT,
    provider: ProviderName.CRYPTO,
    cryptoInvoice: {
      id: 'inv_123',
      paymentIntentId: 'pay_123',
      asset: CryptoAsset.USDC,
      chain: CryptoChain.BASE,
      address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      expectedAmount: new Prisma.Decimal('25.50'),
      expectedAmountRaw: '25500000',
      status: overrides.invoiceStatus ?? CryptoInvoiceStatus.AWAITING_PAYMENT,
      expiresAt: overrides.expiresAt ?? new Date('2026-03-09T10:00:00.000Z'),
      transactions: overrides.transactions ?? [],
    },
  });

  const createLoggerMock = () => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });

  const createProviderRegistryMock = () => ({
    getProvider: jest.fn(),
  });

  it('marks an awaiting crypto payment as detected', async () => {
    const prisma = createPrismaMock();
    const webhooksService = {
      enqueuePaymentEvent: jest.fn().mockResolvedValue({ id: 'whd_123' }),
      enqueueDeliveryJob: jest.fn().mockResolvedValue(null),
    };
    const cryptoService = {
      getExpectedAmountRaw: jest.fn().mockReturnValue('25500000'),
    };
    const logger = createLoggerMock();
    const paymentProviderRegistry = createProviderRegistryMock();
    const service = new PaymentsService(
      prisma as never,
      webhooksService as never,
      { enqueueCryptoExpiry: jest.fn() } as never,
      cryptoService as never,
      logger as never,
      paymentProviderRegistry as never,
    );

    prisma.paymentIntent.findFirst.mockResolvedValue(buildPayment());
    prisma.cryptoTransaction.findUnique.mockResolvedValue(null);
    prisma.providerEvent.findUnique.mockResolvedValue(null);
    prisma.cryptoTransaction.create.mockResolvedValue({
      id: 'ctx_123',
      status: CryptoTxStatus.DETECTED,
      confirmations: 0,
    });
    prisma.cryptoInvoice.update.mockResolvedValue({
      id: 'inv_123',
      status: CryptoInvoiceStatus.CONFIRMING,
    });
    prisma.paymentIntent.update.mockResolvedValue({
      id: 'pay_123',
      status: PaymentStatus.CONFIRMING,
    });

    const result = await service.markCryptoDetected('pay_123');

    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    expect(prisma.cryptoTransaction.create).toHaveBeenCalledWith({
      data: {
        cryptoInvoiceId: 'inv_123',
        txHash: expect.stringMatching(/^0xdetected/),
        fromAddress: '0x1111111111111111111111111111111111111111',
        toAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        asset: CryptoAsset.USDC,
        chain: CryptoChain.BASE,
        amount: new Prisma.Decimal('25.50'),
        amountRaw: '25500000',
        blockNumber: null,
        confirmations: 0,
        status: CryptoTxStatus.DETECTED,
      },
    });
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    expect(prisma.cryptoInvoice.update).toHaveBeenCalledWith({
      where: { id: 'inv_123' },
      data: { status: CryptoInvoiceStatus.CONFIRMING },
    });
    expect(prisma.paymentIntent.update).toHaveBeenCalledWith({
      where: { id: 'pay_123' },
      data: { status: PaymentStatus.CONFIRMING },
    });
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    expect(prisma.providerEvent.create).toHaveBeenCalledWith({
      data: {
        paymentIntentId: 'pay_123',
        provider: ProviderName.CRYPTO,
        eventType: 'crypto.payment_detected',
        externalEventId: expect.stringMatching(/^detected:/),
        payload: {
          paymentId: 'pay_123',
          cryptoInvoiceId: 'inv_123',
          txHash: expect.stringMatching(/^0xdetected/),
          confirmations: 0,
        },
        processed: true,
        processedAt: expect.any(Date),
      },
    });
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    expect(webhooksService.enqueuePaymentEvent).toHaveBeenCalledWith(
      prisma,
      'pay_123',
      'payment.confirming',
    );
    expect(webhooksService.enqueueDeliveryJob).toHaveBeenCalledWith('whd_123');
    expect(result.payment.status).toBe(PaymentStatus.CONFIRMING);
  });

  it('rejects detection from an invalid state', async () => {
    const prisma = createPrismaMock();
    const logger = createLoggerMock();
    const paymentProviderRegistry = createProviderRegistryMock();
    const service = new PaymentsService(
      prisma as never,
      {
        enqueuePaymentEvent: jest.fn(),
        enqueueDeliveryJob: jest.fn(),
        enqueueCryptoExpiry: jest.fn(),
      } as never,
      { enqueueCryptoExpiry: jest.fn() } as never,
      { getExpectedAmountRaw: jest.fn() } as never,
      logger as never,
      paymentProviderRegistry as never,
    );

    prisma.paymentIntent.findFirst.mockResolvedValue(
      buildPayment({
        paymentStatus: PaymentStatus.CONFIRMING,
        invoiceStatus: CryptoInvoiceStatus.CONFIRMING,
      }),
    );

    await expect(service.markCryptoDetected('pay_123')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('marks a confirming crypto payment as confirmed', async () => {
    const prisma = createPrismaMock();
    const webhooksService = {
      enqueuePaymentEvent: jest.fn().mockResolvedValue({ id: 'whd_456' }),
      enqueueDeliveryJob: jest.fn().mockResolvedValue(null),
    };
    const cryptoService = {
      getExpectedAmountRaw: jest.fn().mockReturnValue('25500000'),
    };
    const logger = createLoggerMock();
    const paymentProviderRegistry = createProviderRegistryMock();
    const service = new PaymentsService(
      prisma as never,
      webhooksService as never,
      { enqueueCryptoExpiry: jest.fn() } as never,
      cryptoService as never,
      logger as never,
      paymentProviderRegistry as never,
    );

    prisma.paymentIntent.findFirst.mockResolvedValue(
      buildPayment({
        paymentStatus: PaymentStatus.CONFIRMING,
        invoiceStatus: CryptoInvoiceStatus.CONFIRMING,
        transactions: [{ id: 'ctx_123', txHash: '0xhash123' }],
      }),
    );
    prisma.cryptoTransaction.update.mockResolvedValue({
      id: 'ctx_123',
      status: CryptoTxStatus.CONFIRMED,
      confirmations: 3,
    });
    prisma.ledgerEntry.findFirst.mockResolvedValue(null);
    prisma.providerEvent.findUnique.mockResolvedValue(null);
    prisma.cryptoInvoice.update.mockResolvedValue({
      id: 'inv_123',
      status: CryptoInvoiceStatus.SUCCEEDED,
    });
    prisma.paymentIntent.update.mockResolvedValue({
      id: 'pay_123',
      status: PaymentStatus.SUCCEEDED,
    });

    const result = await service.markCryptoConfirmed('pay_123');

    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    expect(prisma.cryptoTransaction.update).toHaveBeenCalledWith({
      where: { id: 'ctx_123' },
      data: {
        confirmations: 3,
        status: CryptoTxStatus.CONFIRMED,
        confirmedAt: expect.any(Date),
      },
    });
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    expect(prisma.ledgerEntry.create).toHaveBeenCalledWith({
      data: {
        merchantId: 'merchant_123',
        paymentIntentId: 'pay_123',
        entryType: LedgerEntryType.MERCHANT_PAYABLE,
        direction: LedgerDirection.CREDIT,
        currency: 'USD',
        amount: new Prisma.Decimal('25.50'),
        description: 'Crypto payment confirmed for 25.5 USD',
      },
    });
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    expect(prisma.providerEvent.create).toHaveBeenCalledWith({
      data: {
        paymentIntentId: 'pay_123',
        provider: ProviderName.CRYPTO,
        eventType: 'crypto.payment_confirmed',
        externalEventId: 'confirmed:0xhash123',
        payload: {
          paymentId: 'pay_123',
          cryptoInvoiceId: 'inv_123',
          txHash: '0xhash123',
          confirmations: 3,
        },
        processed: true,
        processedAt: expect.any(Date),
      },
    });
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    expect(webhooksService.enqueuePaymentEvent).toHaveBeenCalledWith(
      prisma,
      'pay_123',
      'payment.succeeded',
    );
    expect(webhooksService.enqueueDeliveryJob).toHaveBeenCalledWith('whd_456');
    expect(result.payment.status).toBe(PaymentStatus.SUCCEEDED);
  });

  it('rejects confirmation without a detected transaction', async () => {
    const prisma = createPrismaMock();
    const logger = createLoggerMock();
    const paymentProviderRegistry = createProviderRegistryMock();
    const service = new PaymentsService(
      prisma as never,
      {
        enqueuePaymentEvent: jest.fn(),
        enqueueDeliveryJob: jest.fn(),
        enqueueCryptoExpiry: jest.fn(),
      } as never,
      { enqueueCryptoExpiry: jest.fn() } as never,
      { getExpectedAmountRaw: jest.fn() } as never,
      logger as never,
      paymentProviderRegistry as never,
    );

    prisma.paymentIntent.findFirst.mockResolvedValue(
      buildPayment({
        paymentStatus: PaymentStatus.CONFIRMING,
        invoiceStatus: CryptoInvoiceStatus.CONFIRMING,
      }),
    );

    await expect(service.markCryptoConfirmed('pay_123')).rejects.toThrow(
      new BadRequestException('No crypto transaction found'),
    );
  });

  it('expires an awaiting crypto payment', async () => {
    const prisma = createPrismaMock();
    const webhooksService = {
      enqueuePaymentEvent: jest.fn().mockResolvedValue({ id: 'whd_789' }),
      enqueueDeliveryJob: jest.fn().mockResolvedValue(null),
    };
    const cryptoService = {
      getExpectedAmountRaw: jest.fn().mockReturnValue('25500000'),
    };
    const logger = createLoggerMock();
    const paymentProviderRegistry = createProviderRegistryMock();
    const service = new PaymentsService(
      prisma as never,
      webhooksService as never,
      { enqueueCryptoExpiry: jest.fn() } as never,
      cryptoService as never,
      logger as never,
      paymentProviderRegistry as never,
    );

    prisma.paymentIntent.findFirst.mockResolvedValue(buildPayment());
    prisma.providerEvent.findUnique.mockResolvedValue(null);
    prisma.cryptoInvoice.update.mockResolvedValue({
      id: 'inv_123',
      status: CryptoInvoiceStatus.EXPIRED,
    });
    prisma.paymentIntent.update.mockResolvedValue({
      id: 'pay_123',
      status: PaymentStatus.EXPIRED,
    });

    const result = await service.expireCryptoPayment('pay_123');

    expect(prisma.cryptoInvoice.update).toHaveBeenCalledWith({
      where: { id: 'inv_123' },
      data: { status: CryptoInvoiceStatus.EXPIRED },
    });
    expect(prisma.paymentIntent.update).toHaveBeenCalledWith({
      where: { id: 'pay_123' },
      data: { status: PaymentStatus.EXPIRED },
    });
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    expect(prisma.providerEvent.create).toHaveBeenCalledWith({
      data: {
        paymentIntentId: 'pay_123',
        provider: ProviderName.CRYPTO,
        eventType: 'crypto.payment_expired',
        externalEventId: 'expired:pay_123',
        payload: {
          paymentId: 'pay_123',
          cryptoInvoiceId: 'inv_123',
        },
        processed: true,
        processedAt: expect.any(Date),
      },
    });
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    expect(webhooksService.enqueuePaymentEvent).toHaveBeenCalledWith(
      prisma,
      'pay_123',
      'payment.expired',
    );
    expect(webhooksService.enqueueDeliveryJob).toHaveBeenCalledWith('whd_789');
    expect(result.payment.status).toBe(PaymentStatus.EXPIRED);
  });

  it('rejects expiry after success', async () => {
    const prisma = createPrismaMock();
    const logger = createLoggerMock();
    const paymentProviderRegistry = createProviderRegistryMock();
    const service = new PaymentsService(
      prisma as never,
      {
        enqueuePaymentEvent: jest.fn(),
        enqueueDeliveryJob: jest.fn(),
        enqueueCryptoExpiry: jest.fn(),
      } as never,
      { enqueueCryptoExpiry: jest.fn() } as never,
      { getExpectedAmountRaw: jest.fn() } as never,
      logger as never,
      paymentProviderRegistry as never,
    );

    prisma.paymentIntent.findFirst.mockResolvedValue(
      buildPayment({
        paymentStatus: PaymentStatus.SUCCEEDED,
        invoiceStatus: CryptoInvoiceStatus.SUCCEEDED,
      }),
    );

    await expect(service.expireCryptoPayment('pay_123')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('expires a payment when the scheduled expiry job is due', async () => {
    const prisma = createPrismaMock();
    const webhooksService = {
      enqueuePaymentEvent: jest.fn().mockResolvedValue({ id: 'whd_due' }),
      enqueueDeliveryJob: jest.fn().mockResolvedValue(null),
    };
    const logger = createLoggerMock();
    const paymentProviderRegistry = createProviderRegistryMock();
    const service = new PaymentsService(
      prisma as never,
      webhooksService as never,
      { enqueueCryptoExpiry: jest.fn() } as never,
      { getExpectedAmountRaw: jest.fn() } as never,
      logger as never,
      paymentProviderRegistry as never,
    );

    prisma.paymentIntent.findFirst
      .mockResolvedValueOnce(
        buildPayment({
          expiresAt: new Date(Date.now() - 60_000),
        }),
      )
      .mockResolvedValueOnce(
        buildPayment({
          expiresAt: new Date(Date.now() - 60_000),
        }),
      );
    prisma.cryptoInvoice.update.mockResolvedValue({
      id: 'inv_123',
      status: CryptoInvoiceStatus.EXPIRED,
    });
    prisma.paymentIntent.update.mockResolvedValue({
      id: 'pay_123',
      status: PaymentStatus.EXPIRED,
    });

    const result = await service.processScheduledCryptoExpiry('pay_123');

    expect(result.skipped).toBe(false);
    expect(prisma.paymentIntent.update).toHaveBeenCalledWith({
      where: { id: 'pay_123' },
      data: { status: PaymentStatus.EXPIRED },
    });
  });

  it('does not expire a succeeded payment from the scheduled worker', async () => {
    const prisma = createPrismaMock();
    const logger = createLoggerMock();
    const paymentProviderRegistry = createProviderRegistryMock();
    const service = new PaymentsService(
      prisma as never,
      {
        enqueuePaymentEvent: jest.fn(),
        enqueueDeliveryJob: jest.fn(),
      } as never,
      { enqueueCryptoExpiry: jest.fn() } as never,
      { getExpectedAmountRaw: jest.fn() } as never,
      logger as never,
      paymentProviderRegistry as never,
    );

    prisma.paymentIntent.findFirst.mockResolvedValue(
      buildPayment({
        paymentStatus: PaymentStatus.SUCCEEDED,
        invoiceStatus: CryptoInvoiceStatus.SUCCEEDED,
        expiresAt: new Date(Date.now() - 60_000),
      }),
    );

    const result = await service.processScheduledCryptoExpiry('pay_123');

    expect(result).toEqual({
      skipped: true,
      reason: 'payment_already_terminal',
    });
    expect(prisma.paymentIntent.update).not.toHaveBeenCalled();
  });

  it('treats repeated scheduled expiry jobs as idempotent', async () => {
    const prisma = createPrismaMock();
    const logger = createLoggerMock();
    const paymentProviderRegistry = createProviderRegistryMock();
    const service = new PaymentsService(
      prisma as never,
      {
        enqueuePaymentEvent: jest.fn(),
        enqueueDeliveryJob: jest.fn(),
      } as never,
      { enqueueCryptoExpiry: jest.fn() } as never,
      { getExpectedAmountRaw: jest.fn() } as never,
      logger as never,
      paymentProviderRegistry as never,
    );

    prisma.paymentIntent.findFirst.mockResolvedValue(
      buildPayment({
        paymentStatus: PaymentStatus.EXPIRED,
        invoiceStatus: CryptoInvoiceStatus.EXPIRED,
        expiresAt: new Date(Date.now() - 60_000),
      }),
    );

    const result = await service.processScheduledCryptoExpiry('pay_123');

    expect(result).toEqual({
      skipped: true,
      reason: 'payment_already_terminal',
    });
    expect(prisma.paymentIntent.update).not.toHaveBeenCalled();
  });

  it('detects and confirms an exact on-chain transfer', async () => {
    const prisma = createPrismaMock();
    const webhooksService = {
      enqueuePaymentEvent: jest
        .fn()
        .mockResolvedValueOnce({ id: 'whd_detect' })
        .mockResolvedValueOnce({ id: 'whd_confirm' }),
      enqueueDeliveryJob: jest.fn().mockResolvedValue(null),
    };
    const paymentJobsService = {
      enqueueCryptoExpiry: jest.fn(),
      enqueueCryptoMonitoring: jest.fn().mockResolvedValue(null),
    };
    const cryptoService = {
      getRequiredConfirmations: jest.fn().mockReturnValue(3),
      findTransferToAddress: jest.fn().mockResolvedValue({
        status: 'exact',
        transfer: {
          txHash: '0xchainhash',
          fromAddress: '0x1111111111111111111111111111111111111111',
          toAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          amountRaw: '25500000',
          blockNumber: 101n,
          confirmations: 3,
        },
      }),
      getExpectedAmountRaw: jest.fn().mockReturnValue('25500000'),
    };
    const logger = createLoggerMock();
    const paymentProviderRegistry = createProviderRegistryMock();
    const service = new PaymentsService(
      prisma as never,
      webhooksService as never,
      paymentJobsService as never,
      cryptoService as never,
      logger as never,
      paymentProviderRegistry as never,
    );

    prisma.paymentIntent.findFirst
      .mockResolvedValueOnce(buildPayment())
      .mockResolvedValueOnce(
        buildPayment({
          paymentStatus: PaymentStatus.CONFIRMING,
          invoiceStatus: CryptoInvoiceStatus.CONFIRMING,
          transactions: [{ id: 'ctx_123', txHash: '0xchainhash' }],
        }),
      );
    prisma.cryptoTransaction.findUnique.mockResolvedValue(null);
    prisma.providerEvent.findUnique.mockResolvedValue(null);
    prisma.cryptoTransaction.create.mockResolvedValue({
      id: 'ctx_123',
      txHash: '0xchainhash',
      status: CryptoTxStatus.CONFIRMING,
      confirmations: 3,
    });
    prisma.cryptoInvoice.update
      .mockResolvedValueOnce({
        id: 'inv_123',
        status: CryptoInvoiceStatus.CONFIRMING,
      })
      .mockResolvedValueOnce({
        id: 'inv_123',
        status: CryptoInvoiceStatus.SUCCEEDED,
      });
    prisma.paymentIntent.update
      .mockResolvedValueOnce({
        id: 'pay_123',
        status: PaymentStatus.CONFIRMING,
      })
      .mockResolvedValueOnce({
        id: 'pay_123',
        status: PaymentStatus.SUCCEEDED,
      });
    prisma.cryptoTransaction.update.mockResolvedValue({
      id: 'ctx_123',
      status: CryptoTxStatus.CONFIRMED,
      confirmations: 3,
    });
    prisma.ledgerEntry.findFirst.mockResolvedValue(null);

    const result = await service.syncCryptoPaymentFromChain('pay_123');

    expect(result).toMatchObject({
      skipped: false,
      action: 'confirmed',
    });
    expect(cryptoService.findTransferToAddress).toHaveBeenCalledWith(
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '25500000',
      CryptoAsset.USDC,
      CryptoChain.BASE,
    );
    expect(paymentJobsService.enqueueCryptoMonitoring).not.toHaveBeenCalled();
  });
});
