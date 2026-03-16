import { Injectable } from '@nestjs/common';
import { IStrataAdapter, StrataDepositResult } from './IStrataAdapter';
import { MarketSimulatorService } from '../../common/market/market-simulator.service';

@Injectable()
export class MockStrataAdapterService implements IStrataAdapter {
  constructor(private readonly market: MarketSimulatorService) {}

  async deposit(usdcAmount: bigint): Promise<StrataDepositResult> {
    return { srNusdAmount: usdcAmount, txHash: `0xmock_strata_deposit_${Date.now()}` };
  }

  async redeem(srNusdAmount: bigint): Promise<{ usdcAmount: bigint; txHash: string }> {
    return { usdcAmount: srNusdAmount, txHash: `0xmock_strata_redeem_${Date.now()}` };
  }

  async getCurrentAPY(): Promise<number> {
    return this.market.getState().srNusdAPY;
  }

  async getSharePrice(): Promise<bigint> {
    return BigInt(1e18);
  }
}
