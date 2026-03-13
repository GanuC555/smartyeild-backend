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
const STRATEGY_APY = { guardian: 6.2, balancer: 12.8, hunter: 24.7 };
let DemoYieldService = class DemoYieldService {
    constructor(positionModel) {
        this.positionModel = positionModel;
        this.logger = new common_1.Logger('DemoYieldService');
    }
    onModuleInit() {
        if (process.env.DEMO_MODE !== 'true')
            return;
        this.logger.log('Demo yield accrual started (every 30s)');
        setInterval(() => this.accrueYield(), 30_000);
    }
    async accrueYield() {
        const positions = await this.positionModel.find({ status: 'active' });
        for (const pos of positions) {
            const principal = parseFloat(pos.depositedPrincipal || '0');
            if (principal <= 0)
                continue;
            const alloc = pos.strategyAllocation || {
                guardian: 100,
                balancer: 0,
                hunter: 0,
            };
            const blendedAPY = (alloc.guardian * STRATEGY_APY.guardian +
                alloc.balancer * STRATEGY_APY.balancer +
                alloc.hunter * STRATEGY_APY.hunter) /
                100;
            const slice = (principal * (blendedAPY / 100)) / (365 * 24 * 120);
            pos.accruedYield = (parseFloat(pos.accruedYield || '0') + slice).toFixed(8);
            await pos.save();
        }
    }
};
exports.DemoYieldService = DemoYieldService;
exports.DemoYieldService = DemoYieldService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(position_schema_1.Position.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], DemoYieldService);
//# sourceMappingURL=demo-yield.service.js.map