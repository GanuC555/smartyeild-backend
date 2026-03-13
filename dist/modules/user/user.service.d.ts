import { Model } from 'mongoose';
import { User } from '../../common/schemas/user.schema';
import { Position } from '../../common/schemas/position.schema';
import { Transaction } from '../../common/schemas/transaction.schema';
export declare class UserService {
    private userModel;
    private positionModel;
    private transactionModel;
    constructor(userModel: Model<User>, positionModel: Model<Position>, transactionModel: Model<Transaction>);
    getProfile(userId: string): Promise<import("mongoose").FlattenMaps<User> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }>;
    getPortfolio(userId: string): Promise<{
        totalPrincipal: string;
        totalYield: string;
        liquidBalance: string;
        strategyPool: string;
        totalValue: string;
        availableToSpend: string;
        blendedAPY: string;
        dailyEarnRate: string;
        perSecondEarnRate: string;
        positions: (import("mongoose").FlattenMaps<Position> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
    }>;
    linkTelegram(userId: string, telegramId: string, telegramUsername: string): Promise<import("mongoose").Document<unknown, {}, User, {}, {}> & User & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }>;
    findByPlatformId(platformId: string): Promise<import("mongoose").Document<unknown, {}, User, {}, {}> & User & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }>;
    findByTelegramId(telegramId: string): Promise<import("mongoose").Document<unknown, {}, User, {}, {}> & User & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }>;
}
