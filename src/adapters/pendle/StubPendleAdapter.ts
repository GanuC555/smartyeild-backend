import { Injectable } from '@nestjs/common';
import { IPendleAdapter, PendleMintResult } from './IPendleAdapter';

@Injectable()
export class StubPendleAdapter implements IPendleAdapter {
  async mintPY(srNusdAmount: bigint): Promise<PendleMintResult> {
    // PT = 88% of srNUSD value (12% discount = 12% implied APY), YT = 12%
    const ptAmount = (srNusdAmount * 88n) / 100n;
    const ytAmount = (srNusdAmount * 12n) / 100n;
    return { ptAmount, ytAmount, txHash: `0xstub_mint_${Date.now()}` };
  }

  async redeemPT(ptAmount: bigint): Promise<{ srNusdAmount: bigint; txHash: string }> {
    // At maturity PT redeems 1:1 — stub returns face value
    return { srNusdAmount: ptAmount, txHash: `0xstub_redeem_${Date.now()}` };
  }

  async claimYTYield(): Promise<{ yieldAmount: bigint; txHash: string }> {
    return { yieldAmount: BigInt(1e16), txHash: `0xstub_claim_${Date.now()}` };
  }

  async getImpliedAPY(): Promise<number> { return 12.0; }
  async getPTDiscount(): Promise<number> { return 12.0; }
  async getMarketMaturity(): Promise<Date> {
    const d = new Date();
    d.setMonth(d.getMonth() + 3); // 3 months from now
    return d;
  }
}
