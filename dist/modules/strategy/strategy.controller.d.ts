import { StrategyService } from './strategy.service';
export declare class StrategyController {
    private strategyService;
    constructor(strategyService: StrategyService);
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
    getMyAllocation(req: any): Promise<{
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
    allocate(body: {
        guardian?: number;
        balancer?: number;
        hunter?: number;
    }, req: any): Promise<{
        message: string;
        allocation: {
            guardian: number;
            balancer: number;
            hunter: number;
        };
        blendedAPY: number;
    }>;
}
