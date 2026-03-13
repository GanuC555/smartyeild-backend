import { Queue } from 'bull';
import { Model } from 'mongoose';
import { Position } from '../../common/schemas/position.schema';
import { Transaction } from '../../common/schemas/transaction.schema';
import { ChainAdapterFactory } from '../../adapters/chain/chain-adapter.factory';
export declare class VaultService {
    private positionModel;
    private transactionModel;
    private txWatcherQueue;
    private chainAdapterFactory;
    private chainAdapter;
    constructor(positionModel: Model<Position>, transactionModel: Model<Transaction>, txWatcherQueue: Queue, chainAdapterFactory: ChainAdapterFactory);
    getVaults(): {
        apy: number;
        tvl: string;
        sharePrice: string;
        status: string;
        id: string;
        name: string;
        chainId: string;
        contractAddress: string;
        minDeposit: string;
    }[];
    getVault(id: string): Promise<any>;
    previewDeposit(amount: string): Promise<any>;
    previewWithdraw(shares: string): Promise<any>;
    submitDeposit(userId: string, walletAddress: string, txHash: string, amount: string): Promise<{
        message: string;
        txHash: string;
    }>;
    confirmDeposit(userId: string, walletAddress: string, amount: string, txHash: string): Promise<import("mongoose").Document<unknown, {}, Position, {}, {}> & Position & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }>;
    getUserPositions(userId: string): Promise<(import("mongoose").FlattenMaps<Position> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
}
