import { VaultService } from './vault.service';
export declare class VaultController {
    private vaultService;
    constructor(vaultService: VaultService);
    getVaults(): Promise<{
        apy: number;
        tvl: string;
        sharePrice: string;
        status: string;
        id: string;
        name: string;
        chainId: string;
        contractAddress: string;
        minDeposit: string;
    }[]>;
    getVault(id: string): Promise<any>;
    previewDeposit(amount: string): Promise<any>;
    previewWithdraw(shares: string): Promise<any>;
    submitDeposit(body: {
        txHash: string;
        amount: string;
    }, req: any): Promise<{
        message: string;
        txHash: string;
    }>;
    demoConfirm(amount: string, req: any): Promise<void>;
    getPositions(req: any): Promise<(import("mongoose").FlattenMaps<import("../../common/schemas/position.schema").Position> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
}
