import { Document } from 'mongoose';
export declare class Position extends Document {
    userId: string;
    vaultId: string;
    walletAddress: string;
    shares: string;
    depositedPrincipal: string;
    liquidBalance: string;
    strategyPoolBalance: string;
    accruedYield: string;
    strategyAllocation: {
        guardian: number;
        balancer: number;
        hunter: number;
    };
    status: string;
    depositedAt: Date;
}
export declare const PositionSchema: import("mongoose").Schema<Position, import("mongoose").Model<Position, any, any, any, Document<unknown, any, Position, any, {}> & Position & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Position, Document<unknown, {}, import("mongoose").FlatRecord<Position>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<Position> & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
}>;
