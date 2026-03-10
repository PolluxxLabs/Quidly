export interface ObservedCryptoTransfer {
  txHash: string;
  fromAddress: string | null;
  toAddress: string;
  amountRaw: string;
  blockNumber: bigint | null;
  confirmations: number;
}

export interface TransferLookupResult {
  status: 'exact' | 'mismatch' | 'not_found';
  transfer?: ObservedCryptoTransfer;
}
