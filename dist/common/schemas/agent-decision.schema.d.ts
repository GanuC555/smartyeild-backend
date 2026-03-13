import { Document } from 'mongoose';
export declare class AgentDecision extends Document {
    strategy: string;
    conversationHistory: any[];
    reasoning: string;
    decision: string;
    proposedAllocation: Record<string, any>;
    executedTasks: string[];
    txHashes: string[];
    toolCallCount: number;
}
export declare const AgentDecisionSchema: import("mongoose").Schema<AgentDecision, import("mongoose").Model<AgentDecision, any, any, any, Document<unknown, any, AgentDecision, any, {}> & AgentDecision & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, AgentDecision, Document<unknown, {}, import("mongoose").FlatRecord<AgentDecision>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<AgentDecision> & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
}>;
