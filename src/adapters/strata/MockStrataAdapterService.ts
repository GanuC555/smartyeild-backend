import { Injectable } from '@nestjs/common';
import { IStrataAdapter, StrataDepositResult } from './IStrataAdapter';

@Injectable()
export class MockStrataAdapterService implements IStrataAdapter {
  async deposit(usdcAmount: bigint): Promise<StrataDepositResult> {
    // 1:1 on testnet mock
    return { srNusdAmount: usdcAmount, txHash: `0xmock_strata_deposit_${Date.now()}` };
  }

  async redeem(srNusdAmount: bigint): Promise<{ usdcAmount: bigint; txHash: string }> {
    return { usdcAmount: srNusdAmount, txHash: `0xmock_strata_redeem_${Date.now()}` };
  }

  async getCurrentAPY(): Promise<number> {
    return 6.5; // mock 6.5% APY
  }

  async getSharePrice(): Promise<bigint> {
    return BigInt(1e18); // 1:1
  }
}
