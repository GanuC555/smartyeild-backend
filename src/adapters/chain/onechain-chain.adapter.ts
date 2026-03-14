import { Logger } from '@nestjs/common';
import { SuiClient } from '@onelabs/sui/client';
import {
  IChainAdapter,
  DepositPreview,
  WithdrawPreview,
  VaultState,
  TransactionResult,
} from './chain-adapter.interface';

/**
 * IChainAdapter implementation that reads on-chain state from OneChain (Sui-compatible).
 * Transactions are signed client-side via dapp-kit; this adapter handles
 * read-only previews, state queries, and tx watching.
 */
export class OneChainChainAdapter implements IChainAdapter {
  private readonly logger = new Logger('OneChainChainAdapter');
  private client: SuiClient;
  private packageId: string;
  private vaultObjectId: string;

  constructor() {
    const rpcUrl =
      process.env.ONECHAIN_RPC_URL ?? 'https://rpc-testnet.onelabs.cc';
    this.packageId = process.env.ONECHAIN_PACKAGE_ID ?? '';
    this.vaultObjectId = process.env.ONECHAIN_VAULT_OBJECT_ID ?? '';
    this.client = new SuiClient({ url: rpcUrl });
    this.logger.log(`OneChainChainAdapter initialised — RPC: ${rpcUrl}`);
  }

  async previewDeposit(amount: string): Promise<DepositPreview> {
    // For now, return an estimate; full simulation would use devInspect
    const shares = (parseFloat(amount) * 0.9873).toFixed(6);
    return { shares, sharePrice: '1.012847', estimatedAPY: 12.5 };
  }

  async previewWithdraw(shares: string): Promise<WithdrawPreview> {
    const usdcAmount = (parseFloat(shares) * 1.012847).toFixed(6);
    return { usdcAmount, sharePrice: '1.012847' };
  }

  async getVaultState(): Promise<VaultState> {
    if (!this.vaultObjectId) {
      return {
        totalAssets: '0',
        sharePrice: '1.000000',
        totalShares: '0',
        apy: 0,
      };
    }
    try {
      const obj = await this.client.getObject({
        id: this.vaultObjectId,
        options: { showContent: true },
      });
      const fields = (obj.data?.content as any)?.fields;
      if (!fields) {
        return {
          totalAssets: '0',
          sharePrice: '1.000000',
          totalShares: '0',
          apy: 0,
        };
      }
      const totalDeposits = BigInt(fields.total_deposits ?? 0);
      const totalAssets = (
        Number(totalDeposits) / 1_000_000
      ).toFixed(6);
      return {
        totalAssets,
        sharePrice: '1.000000',
        totalShares: totalAssets,
        apy: 12.5,
      };
    } catch (err) {
      this.logger.warn(`getVaultState failed: ${err}`);
      return {
        totalAssets: '0',
        sharePrice: '1.000000',
        totalShares: '0',
        apy: 0,
      };
    }
  }

  async watchTransaction(hash: string): Promise<TransactionResult> {
    try {
      const tx = await this.client.waitForTransaction({
        digest: hash,
        options: { showEffects: true },
      });
      const status = tx.effects?.status?.status === 'success' ? 'confirmed' : 'failed';
      return { hash, status } as TransactionResult;
    } catch (err) {
      this.logger.warn(`watchTransaction failed for ${hash}: ${err}`);
      return { hash, status: 'failed' };
    }
  }

  async buildDepositTx(userAddress: string, amount: string): Promise<any> {
    // Client-side tx building is done via dapp-kit useOneChainTx;
    // return metadata for reference
    return {
      packageId: this.packageId,
      module: 'vault',
      function: 'deposit',
      userAddress,
      amount,
    };
  }

  async buildWithdrawTx(userAddress: string, shares: string): Promise<any> {
    return {
      packageId: this.packageId,
      module: 'vault',
      function: 'withdraw',
      userAddress,
      shares,
    };
  }

  async allocateToStrategy(
    strategyAddress: string,
    amount: string,
  ): Promise<TransactionResult> {
    this.logger.log(
      `OneChain: allocate ${amount} to strategy ${strategyAddress} — client-side signing required`,
    );
    return {
      hash: `pending_alloc_${Date.now()}`,
      status: 'pending',
    };
  }

  async withdrawFromStrategy(
    strategyAddress: string,
    amount: string,
  ): Promise<TransactionResult> {
    this.logger.log(
      `OneChain: withdraw ${amount} from strategy ${strategyAddress} — client-side signing required`,
    );
    return {
      hash: `pending_withdraw_${Date.now()}`,
      status: 'pending',
    };
  }
}
