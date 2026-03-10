import { PaymentJobsService } from './payment-jobs.service';

describe('PaymentJobsService', () => {
  it('enqueues a delayed crypto expiry job', async () => {
    const expiryQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job_123' }),
    };
    const monitoringQueue = {
      add: jest.fn(),
    };
    const service = new PaymentJobsService(
      expiryQueue as never,
      monitoringQueue as never,
    );

    const runAt = new Date(Date.now() + 60_000);

    await service.enqueueCryptoExpiry('pay_123', runAt);

    expect(expiryQueue.add).toHaveBeenCalledWith(
      'expire:pay_123',
      { paymentId: 'pay_123' },
      expect.objectContaining({
        jobId: 'expire:pay_123',
      }),
    );
  });
});
