import { OnModuleInit } from '@nestjs/common';
import { Queue } from 'bull';
import { Model } from 'mongoose';
import { AgentDecision } from '../../common/schemas/agent-decision.schema';
import { Position } from '../../common/schemas/position.schema';
export declare class AgentService implements OnModuleInit {
    private decisionModel;
    private positionModel;
    private guardianQueue;
    private balancerQueue;
    private hunterQueue;
    private readonly logger;
    private anthropic;
    constructor(decisionModel: Model<AgentDecision>, positionModel: Model<Position>, guardianQueue: Queue, balancerQueue: Queue, hunterQueue: Queue);
    onModuleInit(): void;
    runAgent(strategyId: string): Promise<AgentDecision>;
    private gatherMarketData;
    private buildSystemPrompt;
    private buildObserverReport;
    private generateStubReasoning;
    getDecisions(strategyId: string, limit?: number): Promise<(import("mongoose").FlattenMaps<AgentDecision> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    getAllAgentsStatus(): Promise<any[]>;
}
