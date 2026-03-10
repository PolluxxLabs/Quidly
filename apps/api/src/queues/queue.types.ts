import { CryptoAsset, CryptoChain } from '@prisma/client';

export interface WebhookDeliveryJobPayload {
  deliveryId: string;
}

export interface CryptoExpiryJobPayload {
  paymentId: string;
}

export interface CryptoMonitoringJobPayload {
  paymentId: string;
  chain: CryptoChain;
  asset: CryptoAsset;
}
