export interface DepositParams {
  userAddress: string;
  amountOct: bigint;       // in base units (1 OCT = 1e9)
  maturityDays: 30 | 60 | 90;
  seniorBps: number;       // 0-10000
  juniorBps: number;       // 0-10000
}

export interface SpendParams {
  userAddress: string;
  recipientAddress: string;
  amountOct: bigint;
}

export interface SpendBalance {
  yieldBalance: bigint;
  advanceBalance: bigint;
}

export interface VaultPosition {
  depositAmount: bigint;
  seniorBps: number;
  juniorBps: number;
  maturityMs: number;
  advanceAmount: bigint;
  frtMinted: bigint;
  ystMinted: bigint;
  depositedAtMs: number;
}

export interface IOneChainAdapter {
  /** Health check — returns true if RPC is reachable */
  ping(): Promise<boolean>;

  /** Get spend balances for a user from SpendBuffer shared object */
  getSpendBalance(userAddress: string): Promise<SpendBalance>;

  /** Get vault position for a user */
  getVaultPosition(userAddress: string): Promise<VaultPosition | null>;

  /** Get total vault deposits (OCT) */
  getTotalDeposits(): Promise<bigint>;

  /** Get package ID of deployed oneyield package */
  getPackageId(): string;

  /** Total MOCK_USD currently in vault.yield_reserve (base units, 6 decimals) */
  getVaultYieldReserve(): Promise<bigint>;

  /** Total YST balance for a user across all their YST coin objects (base units) */
  getUserYstBalance(userAddress: string): Promise<bigint>;

  /**
   * LP share count for the admin address in the OneDex pool.
   * Returns 0n if admin has no position yet.
   */
  getAdminDexLpShares(): Promise<bigint>;
}
