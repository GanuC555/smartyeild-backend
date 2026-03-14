export interface PendleMintResult {
  ptAmount: bigint;
  ytAmount: bigint;
  txHash: string;
}

export interface IPendleAdapter {
  mintPY(srNusdAmount: bigint, market: string): Promise<PendleMintResult>;
  redeemPT(ptAmount: bigint, market: string): Promise<{ srNusdAmount: bigint; txHash: string }>;
  claimYTYield(market: string, onBehalf: string): Promise<{ yieldAmount: bigint; txHash: string }>;
  getImpliedAPY(market: string): Promise<number>;
  getPTDiscount(market: string): Promise<number>; // % discount 0-100
  getMarketMaturity(market: string): Promise<Date>;
}
