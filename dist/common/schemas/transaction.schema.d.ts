import { Document } from 'mongoose';
export declare class Transaction extends Document {
    userId: string;
    type: string;
    status: string;
    amount: string;
    txHash: string;
    fromAddress: string;
    toAddress: string;
    metadata: Record<string, any>;
}
export declare const TransactionSchema: import("mongoose").Schema<Transaction, import("mongoose").Model<Transaction, any, any, any, Document<unknown, any, Transaction, any, {}> & Transaction & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Transaction, Document<unknown, {}, import("mongoose").FlatRecord<Transaction>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<Transaction> & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
}>;
