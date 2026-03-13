import { TransferService } from './transfer.service';
export declare class TransferController {
    private transferService;
    constructor(transferService: TransferService);
    getBalance(req: any): Promise<{
        yield: string;
        liquid: string;
        total: string;
        principalLocked: string;
    }>;
    send(body: {
        toAddress: string;
        amount: string;
        note?: string;
    }, req: any): Promise<{
        success: boolean;
        txHash: string;
        amount: string;
        toAddress: string;
        settlementSource: string;
        fromYield: string;
        fromLiquid: string;
        remainingBalance: {
            yield: string;
            liquid: string;
        };
    }>;
    getHistory(req: any): Promise<(import("mongoose").FlattenMaps<import("../../common/schemas/transaction.schema").Transaction> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
}
