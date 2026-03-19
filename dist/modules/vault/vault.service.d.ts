import { Queue } from 'bull';
import { Model, Types } from 'mongoose';
import { Position } from '../../common/schemas/position.schema';
import { Transaction } from '../../common/schemas/transaction.schema';
import { LanePositionDocument } from '../../common/schemas/lane-position.schema';
import { ChainAdapterFactory } from '../../adapters/chain/chain-adapter.factory';
import { OneChainAdapterService } from '../../adapters/onechain/OneChainAdapterService';
export declare class VaultService {
    private positionModel;
    private transactionModel;
    private lanePositionModel;
    private txWatcherQueue;
    private chainAdapterFactory;
    private readonly oneChainAdapter;
    private readonly logger;
    private chainAdapter;
    constructor(positionModel: Model<Position>, transactionModel: Model<Transaction>, lanePositionModel: Model<LanePositionDocument>, txWatcherQueue: Queue, chainAdapterFactory: ChainAdapterFactory, oneChainAdapter: OneChainAdapterService);
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
    submitDeposit(userId: string, walletAddress: string, txHash: string, amount: string): Promise<{
        message: string;
        txHash: string;
    }>;
    confirmDeposit(userId: string, walletAddress: string, amount: string, txHash: string): Promise<void>;
    getUserPositions(userId: string): Promise<(import("mongoose").FlattenMaps<Position> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
}
