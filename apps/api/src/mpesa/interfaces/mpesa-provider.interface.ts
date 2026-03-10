export type MpesaProviderRequest = {
  merchantId: string;
  amount: number;
  currency: string;
  reference?: string;
  idempotencyKey?: string;
};

export interface MpesaProvider {
  createPayment(request: MpesaProviderRequest): Promise<never>;
}
