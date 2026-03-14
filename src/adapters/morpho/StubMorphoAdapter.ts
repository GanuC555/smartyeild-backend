import { Injectable } from '@nestjs/common';
import { IMorphoAdapter, MorphoMarket, LeverageParams } from './IMorphoAdapter';

@Injectable()
export class StubMorphoAdapter implements IMorphoAdapter {
  async supplyCollateral(_market: MorphoMarket, _amount: bigint, _onBehalf: string): Promise<string> {
    return `0xstub_supply_${Date.now()}`;
  }

  async borrow(_market: MorphoMarket, amount: bigint): Promise<{ borrowed: bigint; txHash: string }> {
    return { borrowed: (amount * 70n) / 100n, txHash: `0xstub_borrow_${Date.now()}` };
  }

  async repayAndWithdrawCollateral(): Promise<string> {
    return `0xstub_repay_${Date.now()}`;
  }

  async executeLeverageLoop(params: LeverageParams): Promise<{ leveragedPTAmount: bigint; txHash: string }> {
    const leveraged = params.initialPtAmount * BigInt(params.targetMultiplier);
    return { leveragedPTAmount: leveraged, txHash: `0xstub_leverage_${Date.now()}` };
  }

  async getBorrowRate(): Promise<number> { return 4.5; }
  async getMarketUtilization(): Promise<number> { return 55.0; }
}
