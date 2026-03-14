export interface MorphoMarket {
  loanToken: string;
  collateralToken: string;
  oracle: string;
  irm: string;
  lltv: bigint; // e.g., 700000000000000000n for 70% LTV
}

export interface LeverageParams {
  user: string;
  initialPtAmount: bigint;
  targetMultiplier: number; // 3-7
  market: MorphoMarket;
}

export interface IMorphoAdapter {
  supplyCollateral(market: MorphoMarket, collateralAmount: bigint, onBehalf: string): Promise<string>;
  borrow(market: MorphoMarket, amount: bigint, onBehalf: string): Promise<{ borrowed: bigint; txHash: string }>;
  repayAndWithdrawCollateral(market: MorphoMarket, onBehalf: string): Promise<string>;
  executeLeverageLoop(params: LeverageParams): Promise<{ leveragedPTAmount: bigint; txHash: string }>;
  getBorrowRate(market: MorphoMarket): Promise<number>; // annualized %
  getMarketUtilization(market: MorphoMarket): Promise<number>; // 0-100
}
