"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategyService = exports.STRATEGIES = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const position_schema_1 = require("../../common/schemas/position.schema");
exports.STRATEGIES = {
    guardian: {
        id: 'guardian',
        name: 'The Guardian',
        emoji: '🛡️',
        riskLevel: 1,
        targetAPYMin: 5,
        targetAPYMax: 8,
        currentAPY: 6.2,
        description: 'Invests in tokenized US Treasury bills and USDC lending. No prediction markets, no volatile assets.',
        protocols: [
            {
                name: 'sUSDS (Tokenized US T-bills)',
                description: 'Your USDC earns yield from actual US government bonds.',
                apy: 5.1,
            },
            {
                name: 'Navi Protocol USDC Pool',
                description: 'Lending protocol — borrowers pay interest on USDC.',
                apy: 7.3,
            },
        ],
        whitelistedAddresses: ['0xsUSDS', '0xNAVI_USDC', '0xMOCK_STRATEGY'],
        rebalanceThreshold: 2,
        maxSingleAllocation: 80,
        minIdlePercent: 20,
        rebalanceInterval: 30,
    },
    balancer: {
        id: 'balancer',
        name: 'The Balancer',
        emoji: '⚖️',
        riskLevel: 2,
        targetAPYMin: 10,
        targetAPYMax: 15,
        currentAPY: 12.8,
        description: 'Maintains a 30% T-bill floor while reaching higher returns through stablecoin DEX liquidity.',
        protocols: [
            {
                name: 'sUSDS (RWA Floor)',
                description: '30% always in T-bills as safety floor.',
                apy: 5.1,
            },
            {
                name: 'Navi Protocol USDC Pool',
                description: 'USDC lending.',
                apy: 7.3,
            },
            {
                name: 'OneDex USDC/USDT Stable LP',
                description: 'Liquidity on stable trading pair — minimal impermanent loss.',
                apy: 12.4,
            },
        ],
        whitelistedAddresses: [
            '0xsUSDS',
            '0xNAVI_USDC',
            '0xONEDEX_STABLE',
            '0xMOCK_STRATEGY',
        ],
        rebalanceThreshold: 4,
        maxSingleAllocation: 60,
        minIdlePercent: 20,
        rebalanceInterval: 360,
    },
    hunter: {
        id: 'hunter',
        name: 'The Hunter',
        emoji: '🎯',
        riskLevel: 3,
        targetAPYMin: 20,
        targetAPYMax: 35,
        currentAPY: 24.7,
        description: 'Maximum yield using volatile DEX pairs and prediction market liquidity. High risk, high reward.',
        protocols: [
            {
                name: 'OneDex OCT/USDC LP',
                description: 'Volatile trading pair LP — higher fees, higher impermanent loss risk.',
                apy: 28.3,
            },
            {
                name: 'OnePredice Markets',
                description: 'AI identifies high-confidence prediction market outcomes as liquidity provider.',
                apy: 22.1,
            },
        ],
        whitelistedAddresses: [
            '0xONEDEX_VOLATILE',
            '0xONEPREDICE',
            '0xMOCK_STRATEGY',
        ],
        rebalanceThreshold: 5,
        maxSingleAllocation: 60,
        minIdlePercent: 15,
        rebalanceInterval: 15,
    },
};
let StrategyService = class StrategyService {
    constructor(positionModel) {
        this.positionModel = positionModel;
    }
    getStrategies() {
        return Object.values(exports.STRATEGIES);
    }
    getStrategy(id) {
        return exports.STRATEGIES[id] || null;
    }
    async allocate(userId, allocation) {
        const total = (allocation.guardian || 0) +
            (allocation.balancer || 0) +
            (allocation.hunter || 0);
        if (Math.abs(total - 100) > 0.5) {
            throw new common_1.BadRequestException(`Allocation must sum to 100%. Got ${total}%`);
        }
        const position = await this.positionModel.findOne({ userId });
        if (!position)
            throw new common_1.BadRequestException('No position found. Make a deposit first.');
        position.strategyAllocation = {
            guardian: allocation.guardian || 0,
            balancer: allocation.balancer || 0,
            hunter: allocation.hunter || 0,
        };
        await position.save();
        return {
            message: 'Strategy allocation updated',
            allocation: position.strategyAllocation,
            blendedAPY: this.calculateBlendedAPY(position.strategyAllocation),
        };
    }
    async getMyAllocation(userId) {
        const position = await this.positionModel.findOne({ userId }).lean();
        if (!position)
            return {
                allocation: { guardian: 0, balancer: 0, hunter: 0 },
                capital: {},
                blendedAPY: 0,
            };
        const stratPool = parseFloat(position.strategyPoolBalance || '0');
        const alloc = position.strategyAllocation || {
            guardian: 100,
            balancer: 0,
            hunter: 0,
        };
        return {
            allocation: alloc,
            capital: {
                guardian: ((alloc.guardian / 100) * stratPool).toFixed(6),
                balancer: ((alloc.balancer / 100) * stratPool).toFixed(6),
                hunter: ((alloc.hunter / 100) * stratPool).toFixed(6),
            },
            strategyPoolTotal: stratPool.toFixed(6),
            blendedAPY: this.calculateBlendedAPY(alloc),
        };
    }
    calculateBlendedAPY(alloc) {
        return parseFloat(((alloc.guardian / 100) * exports.STRATEGIES.guardian.currentAPY +
            (alloc.balancer / 100) * exports.STRATEGIES.balancer.currentAPY +
            (alloc.hunter / 100) * exports.STRATEGIES.hunter.currentAPY).toFixed(2));
    }
    isWhitelisted(strategyId, address) {
        return (exports.STRATEGIES[strategyId]?.whitelistedAddresses.includes(address) ?? false);
    }
};
exports.StrategyService = StrategyService;
exports.StrategyService = StrategyService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(position_schema_1.Position.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], StrategyService);
//# sourceMappingURL=strategy.service.js.map