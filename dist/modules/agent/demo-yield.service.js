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
exports.DemoYieldService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const position_schema_1 = require("../../common/schemas/position.schema");
const market_simulator_service_1 = require("../../common/market/market-simulator.service");
const TICKS_PER_YEAR = 365 * 24 * 120;
let DemoYieldService = class DemoYieldService {
    constructor(positionModel, market) {
        this.positionModel = positionModel;
        this.market = market;
        this.logger = new common_1.Logger('DemoYieldService');
    }
    onModuleInit() {
        this.logger.log('DemoYieldService: DISABLED — on-chain yield harvesting is active');
    }
    async accrueYield() {
        const ms = this.market.getState();
        const positions = await this.positionModel.find({ status: 'active' });
        for (const pos of positions) {
            const principal = parseFloat(pos.depositedPrincipal || '0');
            if (principal <= 0)
                continue;
            const stratPool = parseFloat(pos.strategyPoolBalance || '0');
            const alloc = pos.strategyAllocation || { guardian: 100, balancer: 0, hunter: 0 };
            const guardianCapital = stratPool * (alloc.guardian / 100);
            const balancerCapital = stratPool * (alloc.balancer / 100);
            const hunterCapital = stratPool * (alloc.hunter / 100);
            const strategyYieldSlice = (guardianCapital * ms.guardianAPY / 100 +
                balancerCapital * ms.balancerAPY / 100 +
                hunterCapital * ms.hunterAPY / 100) / TICKS_PER_YEAR;
            const liquidPool = parseFloat(pos.liquidBalance || '0');
            const lane1APY = Math.max(0, ms.lane1Spread);
            const lane2APY = Math.max(0, ms.lane1Spread * 5);
            const lane3APY = ms.srNusdAPY;
            const laneYieldSlice = (liquidPool * 0.40 * lane1APY / 100 +
                liquidPool * 0.40 * lane2APY / 100 +
                liquidPool * 0.20 * lane3APY / 100) / TICKS_PER_YEAR;
            const totalSlice = strategyYieldSlice + laneYieldSlice;
            pos.accruedYield = (parseFloat(pos.accruedYield || '0') + totalSlice).toFixed(8);
            await pos.save();
        }
        if (positions.length > 0) {
            const ms2 = this.market.getState();
            this.logger.debug(`[yield-tick] ${positions.length} position(s) | ` +
                `G=${ms2.guardianAPY.toFixed(2)}% B=${ms2.balancerAPY.toFixed(2)}% H=${ms2.hunterAPY.toFixed(2)}% ` +
                `Lane1spread=${ms2.lane1Spread.toFixed(2)}%`);
        }
    }
};
exports.DemoYieldService = DemoYieldService;
exports.DemoYieldService = DemoYieldService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(position_schema_1.Position.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        market_simulator_service_1.MarketSimulatorService])
], DemoYieldService);
//# sourceMappingURL=demo-yield.service.js.map