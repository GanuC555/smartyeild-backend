import { AgentService } from './agent.service';
export declare class AgentController {
    private agentService;
    constructor(agentService: AgentService);
    getAllStatus(): Promise<({
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
        lastDecision: import("mongoose").FlattenMaps<import("../../common/schemas/agent-decision.schema").AgentDecision> & Required<{
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
        lastDecision: import("mongoose").FlattenMaps<import("../../common/schemas/agent-decision.schema").AgentDecision> & Required<{
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
        lastDecision: import("mongoose").FlattenMaps<import("../../common/schemas/agent-decision.schema").AgentDecision> & Required<{
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
    getDecisions(strategy: string): Promise<(import("mongoose").FlattenMaps<import("../../common/schemas/agent-decision.schema").AgentDecision> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    runAgent(strategy: 'guardian' | 'balancer' | 'hunter'): Promise<import("../../common/schemas/agent-decision.schema").AgentDecision>;
    faucet(body: {
        address: string;
        amount?: string;
    }): Promise<{
        txHash: string;
        amount: string;
        address: string;
        message: string;
    }>;
    triggerLane(body: {
        lane: string;
    }, req: any): Promise<{
        queued: boolean;
        lane: string;
        message: string;
    }>;
    simulateQRPay(body: {
        amount: string;
    }, req: any): Promise<{
        simulated: boolean;
        amount: string;
    }>;
}
