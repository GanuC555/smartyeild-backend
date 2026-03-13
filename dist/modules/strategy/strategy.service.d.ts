import { Model } from 'mongoose';
import { Position } from '../../common/schemas/position.schema';
export declare const STRATEGIES: {
    guardian: {
        id: string;
        name: string;
        emoji: string;
        riskLevel: number;
        targetAPYMin: number;
        targetAPYMax: number;
        currentAPY: number;
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
    };
    balancer: {
        id: string;
        name: string;
        emoji: string;
        riskLevel: number;
        targetAPYMin: number;
        targetAPYMax: number;
        currentAPY: number;
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
    };
    hunter: {
        id: string;
        name: string;
        emoji: string;
        riskLevel: number;
        targetAPYMin: number;
        targetAPYMax: number;
        currentAPY: number;
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
    };
};
export declare class StrategyService {
    private positionModel;
    constructor(positionModel: Model<Position>);
    getStrategies(): ({
        id: string;
        name: string;
        emoji: string;
        riskLevel: number;
        targetAPYMin: number;
        targetAPYMax: number;
        currentAPY: number;
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
    } | {
        id: string;
        name: string;
        emoji: string;
        riskLevel: number;
        targetAPYMin: number;
        targetAPYMax: number;
        currentAPY: number;
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
    } | {
        id: string;
        name: string;
        emoji: string;
        riskLevel: number;
        targetAPYMin: number;
        targetAPYMax: number;
        currentAPY: number;
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
    })[];
    getStrategy(id: string): any;
    allocate(userId: string, allocation: {
        guardian?: number;
        balancer?: number;
        hunter?: number;
    }): Promise<{
        message: string;
        allocation: {
            guardian: number;
            balancer: number;
            hunter: number;
        };
        blendedAPY: number;
    }>;
    getMyAllocation(userId: string): Promise<{
        allocation: {
            guardian: number;
            balancer: number;
            hunter: number;
        };
        capital: {
            guardian?: undefined;
            balancer?: undefined;
            hunter?: undefined;
        };
        blendedAPY: number;
        strategyPoolTotal?: undefined;
    } | {
        allocation: import("mongoose").FlattenMaps<{
            guardian: number;
            balancer: number;
            hunter: number;
        }>;
        capital: {
            guardian: string;
            balancer: string;
            hunter: string;
        };
        strategyPoolTotal: string;
        blendedAPY: number;
    }>;
    calculateBlendedAPY(alloc: {
        guardian: number;
        balancer: number;
        hunter: number;
    }): number;
    isWhitelisted(strategyId: string, address: string): boolean;
}
