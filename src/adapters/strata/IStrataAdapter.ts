export interface StrataDepositResult {
  srNusdAmount: bigint;
  txHash: string;
}

export interface IStrataAdapter {
  deposit(usdcAmount: bigint, recipient: string): Promise<StrataDepositResult>;
  redeem(srNusdAmount: bigint, recipient: string): Promise<{ usdcAmount: bigint; txHash: string }>;
  getCurrentAPY(): Promise<number>;
  getSharePrice(): Promise<bigint>; // 18 decimals — srNUSD per USDC
}
