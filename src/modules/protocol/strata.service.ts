import { Injectable } from '@nestjs/common';
import { MockStrataAdapterService } from '../../adapters/strata/MockStrataAdapterService';
import { IStrataAdapter, StrataDepositResult } from '../../adapters/strata/IStrataAdapter';

@Injectable()
export class StrataService implements IStrataAdapter {
  constructor(private readonly adapter: MockStrataAdapterService) {}

  deposit(usdcAmount: bigint, _recipient: string): Promise<StrataDepositResult> {
    return this.adapter.deposit(usdcAmount);
  }
  redeem(srNusdAmount: bigint, _recipient: string) {
    return this.adapter.redeem(srNusdAmount);
  }
  getCurrentAPY(): Promise<number> {
    return this.adapter.getCurrentAPY();
  }
  getSharePrice(): Promise<bigint> {
    return this.adapter.getSharePrice();
  }
}
