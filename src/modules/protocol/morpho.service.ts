import { Injectable } from '@nestjs/common';
import { StubMorphoAdapter } from '../../adapters/morpho/StubMorphoAdapter';
import { IMorphoAdapter, MorphoMarket, LeverageParams } from '../../adapters/morpho/IMorphoAdapter';

@Injectable()
export class MorphoService implements IMorphoAdapter {
  constructor(private readonly adapter: StubMorphoAdapter) {}

  supplyCollateral(market: MorphoMarket, collateralAmount: bigint, onBehalf: string): Promise<string> {
    return this.adapter.supplyCollateral(market, collateralAmount, onBehalf);
  }
  borrow(market: MorphoMarket, amount: bigint, _onBehalf: string) {
    return this.adapter.borrow(market, amount);
  }
  repayAndWithdrawCollateral(market: MorphoMarket, _onBehalf: string): Promise<string> {
    return this.adapter.repayAndWithdrawCollateral();
  }
  executeLeverageLoop(params: LeverageParams) {
    return this.adapter.executeLeverageLoop(params);
  }
  getBorrowRate(_market: MorphoMarket): Promise<number> {
    return this.adapter.getBorrowRate();
  }
  getMarketUtilization(_market: MorphoMarket): Promise<number> {
    return this.adapter.getMarketUtilization();
  }
}
