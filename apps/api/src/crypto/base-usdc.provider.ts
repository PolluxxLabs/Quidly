import { Injectable } from '@nestjs/common';
import { CryptoAsset, CryptoChain } from '@prisma/client';
import { createHash } from 'crypto';
import {
  Hex,
  createPublicClient,
  erc20Abi,
  getAddress,
  getContract,
  http,
  parseUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
import { ObservedCryptoTransfer, TransferLookupResult } from './crypto.types';

@Injectable()
export class BaseUsdcProvider {
  private readonly network = process.env.BASE_NETWORK ?? 'sepolia';
  private readonly chain = this.network === 'mainnet' ? base : baseSepolia;
  private readonly usdcAddress = getAddress(this.getUsdcContractAddress());
  private readonly publicClient = createPublicClient({
    chain: this.chain,
    transport: http(process.env.BASE_RPC_URL),
  });

  supports(asset: CryptoAsset, chain: CryptoChain) {
    return asset === CryptoAsset.USDC && chain === CryptoChain.BASE;
  }

  generateInvoiceAddress(invoiceId: string) {
    const privateKey = this.derivePrivateKey(invoiceId);
    return privateKeyToAccount(privateKey).address;
  }

  getExpectedAmountRaw(amount: number | string) {
    return parseUnits(String(amount), 6).toString();
  }

  getRequiredConfirmations() {
    if (process.env.BASE_REQUIRED_CONFIRMATIONS) {
      return Number(process.env.BASE_REQUIRED_CONFIRMATIONS);
    }

    return this.network === 'mainnet' ? 65 : 3;
  }

  async findTransferToAddress(
    address: string,
    expectedAmountRaw: string,
  ): Promise<TransferLookupResult> {
    const latestBlock = await this.publicClient.getBlockNumber();
    const lookbackBlocks = BigInt(
      process.env.CRYPTO_MONITORING_LOOKBACK_BLOCKS ?? '10000',
    );
    const fromBlock =
      latestBlock > lookbackBlocks ? latestBlock - lookbackBlocks : 0n;
    const usdcContract = getContract({
      address: this.usdcAddress,
      abi: erc20Abi,
      client: this.publicClient,
    });
    const logs = await usdcContract.getEvents.Transfer(
      {
        to: getAddress(address),
      },
      {
        fromBlock,
        toBlock: latestBlock,
        strict: true,
      },
    );

    const exactMatch = logs.find(
      (log) => log.args.value?.toString() === expectedAmountRaw,
    );

    if (exactMatch) {
      return {
        status: 'exact',
        transfer: this.mapTransferLog(exactMatch, latestBlock),
      };
    }

    const mismatch = logs[0];

    if (mismatch) {
      return {
        status: 'mismatch',
        transfer: this.mapTransferLog(mismatch, latestBlock),
      };
    }

    return {
      status: 'not_found',
    };
  }

  async getConfirmations(txHash: string, blockNumber?: bigint | null) {
    const latestBlock = await this.publicClient.getBlockNumber();
    const resolvedBlockNumber =
      blockNumber ?? (await this.getBlockNumber(txHash));

    if (resolvedBlockNumber === null) {
      return 0;
    }

    return Number(latestBlock - resolvedBlockNumber + 1n);
  }

  private async getBlockNumber(txHash: string) {
    const receipt = await this.publicClient.getTransactionReceipt({
      hash: txHash as Hex,
    });

    return receipt.blockNumber ?? null;
  }

  private mapTransferLog(
    log: {
      transactionHash: Hex;
      blockNumber: bigint | null;
      args: {
        from?: `0x${string}`;
        to?: `0x${string}`;
        value?: bigint;
      };
    },
    latestBlock: bigint,
  ): ObservedCryptoTransfer {
    const blockNumber = log.blockNumber ?? null;

    return {
      txHash: log.transactionHash,
      fromAddress: log.args.from ?? null,
      toAddress: log.args.to ?? '',
      amountRaw: log.args.value?.toString() ?? '0',
      blockNumber,
      confirmations:
        blockNumber === null ? 0 : Number(latestBlock - blockNumber + 1n),
    };
  }

  private derivePrivateKey(invoiceId: string): Hex {
    const walletSeed =
      process.env.CRYPTO_WALLET_SEED ?? 'quidly-unsafe-dev-wallet-seed';
    const digest = createHash('sha256')
      .update(`${walletSeed}:${invoiceId}`)
      .digest('hex');

    return `0x${digest}`;
  }

  private getUsdcContractAddress() {
    if (process.env.BASE_USDC_CONTRACT) {
      return process.env.BASE_USDC_CONTRACT;
    }

    return this.network === 'mainnet'
      ? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
      : '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
  }
}
