import { Injectable } from '@nestjs/common';
import { IMorphoAdapter, MorphoMarket, LeverageParams } from './IMorphoAdapter';
import { MarketSimulatorService } from '../../common/market/market-simulator.service';

@Injectable()
export class StubMorphoAdapter implements IMorphoAdapter {
  constructor(private readonly market: MarketSimulatorService) {}

  async supplyCollateral(_market: MorphoMarket, _amount: bigint, _onBehalf: string): Promise<string> {
    return `0xstub_supply_${Date.now()}`;
  }

  async borrow(_market: MorphoMarket, amount: bigint): Promise<{ borrowed: bigint; txHash: string }> {
    // LTV = 70%
    return { borrowed: (amount * 70n) / 100n, txHash: `0xstub_borrow_${Date.now()}` };
  }

  async repayAndWithdrawCollateral(): Promise<string> {
    return `0xstub_repay_${Date.now()}`;
  }

  async executeLeverageLoop(params: LeverageParams): Promise<{ leveragedPTAmount: bigint; txHash: string }> {
    const leveraged = params.initialPtAmount * BigInt(params.targetMultiplier);
    return { leveragedPTAmount: leveraged, txHash: `0xstub_leverage_${Date.now()}` };
  }

  async getBorrowRate(): Promise<number> {
    return this.market.getState().morphoBorrowRate;
  }

  async getMarketUtilization(): Promise<number> {
    return this.market.getState().morphoUtilization;
  }
}
