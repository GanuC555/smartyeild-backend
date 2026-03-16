import { Injectable } from '@nestjs/common';
import { IPendleAdapter, PendleMintResult } from './IPendleAdapter';
import { MarketSimulatorService } from '../../common/market/market-simulator.service';

@Injectable()
export class StubPendleAdapter implements IPendleAdapter {
  constructor(private readonly market: MarketSimulatorService) {}

  async mintPY(srNusdAmount: bigint): Promise<PendleMintResult> {
    const discount = this.market.getState().ptDiscount / 100;
    const ptFraction = BigInt(Math.round((1 - discount) * 10000));
    const ytFraction = BigInt(Math.round(discount * 10000));
    return {
      ptAmount: (srNusdAmount * ptFraction) / 10000n,
      ytAmount: (srNusdAmount * ytFraction) / 10000n,
      txHash: `0xstub_mint_${Date.now()}`,
    };
  }

  async redeemPT(ptAmount: bigint): Promise<{ srNusdAmount: bigint; txHash: string }> {
    return { srNusdAmount: ptAmount, txHash: `0xstub_redeem_${Date.now()}` };
  }

  async claimYTYield(): Promise<{ yieldAmount: bigint; txHash: string }> {
    // Yield earned is proportional to srNUSD APY
    const apy = this.market.getState().srNusdAPY / 100;
    const annualFraction = BigInt(Math.round(apy * 1e10));
    return {
      yieldAmount: annualFraction,
      txHash: `0xstub_claim_${Date.now()}`,
    };
  }

  async getImpliedAPY(): Promise<number> {
    return this.market.getState().ytImpliedAPY;
  }

  async getPTDiscount(): Promise<number> {
    return this.market.getState().ptDiscount;
  }

  async getMarketMaturity(): Promise<Date> {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d;
  }
}
