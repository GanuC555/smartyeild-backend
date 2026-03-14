import { Injectable } from '@nestjs/common';
import { StubPendleAdapter } from '../../adapters/pendle/StubPendleAdapter';
import { IPendleAdapter, PendleMintResult } from '../../adapters/pendle/IPendleAdapter';

@Injectable()
export class PendleService implements IPendleAdapter {
  constructor(private readonly adapter: StubPendleAdapter) {}

  mintPY(srNusdAmount: bigint, _market: string): Promise<PendleMintResult> {
    return this.adapter.mintPY(srNusdAmount);
  }
  redeemPT(ptAmount: bigint, _market: string) {
    return this.adapter.redeemPT(ptAmount);
  }
  claimYTYield(_market: string, _onBehalf: string) {
    return this.adapter.claimYTYield();
  }
  getImpliedAPY(_market: string): Promise<number> {
    return this.adapter.getImpliedAPY();
  }
  getPTDiscount(_market: string): Promise<number> {
    return this.adapter.getPTDiscount();
  }
  getMarketMaturity(_market: string): Promise<Date> {
    return this.adapter.getMarketMaturity();
  }
}
