import { Model } from 'mongoose';
import { Position } from '../../common/schemas/position.schema';
import { MarketSimulatorService } from '../../common/market/market-simulator.service';
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
    private readonly market;
    constructor(positionModel: Model<Position>, market: MarketSimulatorService);
    getStrategies(): ({
        currentAPY: number;
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
    } | {
        currentAPY: number;
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
    } | {
        currentAPY: number;
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
