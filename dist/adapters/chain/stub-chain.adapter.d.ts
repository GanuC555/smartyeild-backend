import { IChainAdapter, DepositPreview, WithdrawPreview, VaultState, TransactionResult } from './chain-adapter.interface';
export declare class StubChainAdapter implements IChainAdapter {
    private readonly logger;
    constructor();
    previewDeposit(amount: string): Promise<DepositPreview>;
    previewWithdraw(shares: string): Promise<WithdrawPreview>;
    getVaultState(): Promise<VaultState>;
    watchTransaction(hash: string): Promise<TransactionResult>;
    buildDepositTx(userAddress: string, amount: string): Promise<any>;
    buildWithdrawTx(userAddress: string, shares: string): Promise<any>;
    allocateToStrategy(strategyAddress: string, amount: string): Promise<TransactionResult>;
    withdrawFromStrategy(strategyAddress: string, amount: string): Promise<TransactionResult>;
}
