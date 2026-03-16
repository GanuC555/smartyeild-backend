import { OnModuleInit } from '@nestjs/common';
import { Queue } from 'bull';
import { Model } from 'mongoose';
import { AgentDecision } from '../../common/schemas/agent-decision.schema';
import { Position } from '../../common/schemas/position.schema';
import { LLMAdapter } from '../../common/llm/llm.adapter';
import { MarketSimulatorService } from '../../common/market/market-simulator.service';
import { TelegramService } from '../telegram/telegram.service';
export declare class AgentService implements OnModuleInit {
    private decisionModel;
    private positionModel;
    private guardianQueue;
    private balancerQueue;
    private hunterQueue;
    private readonly llm;
    private readonly market;
    private readonly telegram;
    private readonly logger;
    constructor(decisionModel: Model<AgentDecision>, positionModel: Model<Position>, guardianQueue: Queue, balancerQueue: Queue, hunterQueue: Queue, llm: LLMAdapter, market: MarketSimulatorService, telegram: TelegramService);
    onModuleInit(): void;
    runAgent(strategyId: 'guardian' | 'balancer' | 'hunter'): Promise<AgentDecision>;
    private ruleBasedDecision;
    private executeRebalance;
    private buildMarketData;
    private buildSystemPrompt;
    private buildObserverReport;
    private generateStubReasoning;
    getDecisions(strategyId: string, limit?: number): Promise<(import("mongoose").FlattenMaps<AgentDecision> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    getAllAgentsStatus(): Promise<({
        apy: number;
        currentAPY: number;
        internalAlloc: {
            sUSDS: number;
            naviUSDC: number;
            idle: number;
        } | {
            sUSDS: number;
            oneDexStable: number;
            idle: number;
        } | {
            oneDexVolatile: number;
            onePredice: number;
            idle: number;
        };
        lastDecision: import("mongoose").FlattenMaps<AgentDecision> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        };
        lastRunAt: any;
        nextRunInMinutes: number;
        status: string;
        id: string;
        name: string;
        emoji: string;
        riskLevel: number;
        targetAPYMin: number;
        targetAPYMax: number;
        description: string;
        protocols: {
            name: string;
            description: string;
            apy: number;
        }[];
        whitelistedAddresses: string[];
        rebalanceThreshold: number;
        maxSingleAllocation: number;
        minIdlePercent: number;
        rebalanceInterval: number;
        strategy: "guardian" | "balancer" | "hunter";
    } | {
        apy: number;
        currentAPY: number;
        internalAlloc: {
            sUSDS: number;
            naviUSDC: number;
            idle: number;
        } | {
            sUSDS: number;
            oneDexStable: number;
            idle: number;
        } | {
            oneDexVolatile: number;
            onePredice: number;
            idle: number;
        };
        lastDecision: import("mongoose").FlattenMaps<AgentDecision> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        };
        lastRunAt: any;
        nextRunInMinutes: number;
        status: string;
        id: string;
        name: string;
        emoji: string;
        riskLevel: number;
        targetAPYMin: number;
        targetAPYMax: number;
        description: string;
        protocols: {
            name: string;
            description: string;
            apy: number;
        }[];
        whitelistedAddresses: string[];
        rebalanceThreshold: number;
        maxSingleAllocation: number;
        minIdlePercent: number;
        rebalanceInterval: number;
        strategy: "guardian" | "balancer" | "hunter";
    } | {
        apy: number;
        currentAPY: number;
        internalAlloc: {
            sUSDS: number;
            naviUSDC: number;
            idle: number;
        } | {
            sUSDS: number;
            oneDexStable: number;
            idle: number;
        } | {
            oneDexVolatile: number;
            onePredice: number;
            idle: number;
        };
        lastDecision: import("mongoose").FlattenMaps<AgentDecision> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        };
        lastRunAt: any;
        nextRunInMinutes: number;
        status: string;
        id: string;
        name: string;
        emoji: string;
        riskLevel: number;
        targetAPYMin: number;
        targetAPYMax: number;
        description: string;
        protocols: {
            name: string;
            description: string;
            apy: number;
        }[];
        whitelistedAddresses: string[];
        rebalanceThreshold: number;
        maxSingleAllocation: number;
        minIdlePercent: number;
        rebalanceInterval: number;
        strategy: "guardian" | "balancer" | "hunter";
    })[]>;
}
