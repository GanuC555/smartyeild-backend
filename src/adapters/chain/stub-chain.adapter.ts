import { Injectable, Logger } from '@nestjs/common';
import {
  IChainAdapter,
  DepositPreview,
  WithdrawPreview,
  VaultState,
  TransactionResult,
} from './chain-adapter.interface';

@Injectable()
export class StubChainAdapter implements IChainAdapter {
  private readonly logger = new Logger('StubChainAdapter');

  constructor() {
    this.logger.log('StubChainAdapter loaded — no real blockchain calls');
  }

  async previewDeposit(amount: string): Promise<DepositPreview> {
    const shares = (parseFloat(amount) * 0.9873).toFixed(6);
    return { shares, sharePrice: '1.012847', estimatedAPY: 12.5 };
  }

  async previewWithdraw(shares: string): Promise<WithdrawPreview> {
    const usdcAmount = (parseFloat(shares) * 1.012847).toFixed(6);
    return { usdcAmount, sharePrice: '1.012847' };
  }

  async getVaultState(): Promise<VaultState> {
    return {
      totalAssets: '485234.567891',
      sharePrice: '1.012847',
      totalShares: '479113.234567',
      apy: 12.5,
    };
  }

  async watchTransaction(hash: string): Promise<TransactionResult> {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return { hash, status: 'confirmed' };
  }

  async buildDepositTx(userAddress: string, amount: string): Promise<any> {
    return {
      to: process.env.VAULT_CONTRACT_ADDRESS,
      data: `0xdeposit_${userAddress}_${amount}`,
      value: '0',
    };
  }

  async buildWithdrawTx(userAddress: string, shares: string): Promise<any> {
    return {
      to: process.env.VAULT_CONTRACT_ADDRESS,
      data: `0xwithdraw_${userAddress}_${shares}`,
      value: '0',
    };
  }

  async allocateToStrategy(
    strategyAddress: string,
    amount: string,
  ): Promise<TransactionResult> {
    const hash = `0xstub_alloc_${Date.now()}`;
    this.logger.log(
      `STUB: Allocating ${amount} to ${strategyAddress} → ${hash}`,
    );
    return { hash, status: 'confirmed' };
  }

  async withdrawFromStrategy(
    strategyAddress: string,
    amount: string,
  ): Promise<TransactionResult> {
    const hash = `0xstub_withdraw_${Date.now()}`;
    this.logger.log(
      `STUB: Withdrawing ${amount} from ${strategyAddress} → ${hash}`,
    );
    return { hash, status: 'confirmed' };
  }
}
