export interface DepositPreview {
    shares: string;
    sharePrice: string;
    estimatedAPY: number;
}
export interface WithdrawPreview {
    usdcAmount: string;
    sharePrice: string;
}
export interface VaultState {
    totalAssets: string;
    sharePrice: string;
    totalShares: string;
    apy: number;
}
export interface TransactionResult {
    hash: string;
    status: 'pending' | 'confirmed' | 'failed';
}
export interface IChainAdapter {
    previewDeposit(amount: string): Promise<DepositPreview>;
    previewWithdraw(shares: string): Promise<WithdrawPreview>;
    getVaultState(): Promise<VaultState>;
    watchTransaction(hash: string): Promise<TransactionResult>;
    buildDepositTx(userAddress: string, amount: string): Promise<any>;
    buildWithdrawTx(userAddress: string, shares: string): Promise<any>;
    allocateToStrategy(strategyAddress: string, amount: string): Promise<TransactionResult>;
    withdrawFromStrategy(strategyAddress: string, amount: string): Promise<TransactionResult>;
}
