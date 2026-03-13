import { Model } from 'mongoose';
import { Transaction } from '../../common/schemas/transaction.schema';
import { Position } from '../../common/schemas/position.schema';
export declare class TransferService {
    private txModel;
    private positionModel;
    constructor(txModel: Model<Transaction>, positionModel: Model<Position>);
    sendP2P(userId: string, toAddress: string, amount: string, note?: string): Promise<{
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
    getHistory(userId: string, limit?: number): Promise<(import("mongoose").FlattenMaps<Transaction> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    getSpendableBalance(userId: string): Promise<{
        yield: string;
        liquid: string;
        total: string;
        principalLocked: string;
    }>;
}
