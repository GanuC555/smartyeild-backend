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
exports.UserService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const user_schema_1 = require("../../common/schemas/user.schema");
const position_schema_1 = require("../../common/schemas/position.schema");
const transaction_schema_1 = require("../../common/schemas/transaction.schema");
const lane_position_schema_1 = require("../../common/schemas/lane-position.schema");
const market_simulator_service_1 = require("../../common/market/market-simulator.service");
const STRATEGY_APY = { guardian: 6.2, balancer: 12.8, hunter: 24.7 };
let UserService = class UserService {
    constructor(userModel, positionModel, transactionModel, lanePositionModel, market) {
        this.userModel = userModel;
        this.positionModel = positionModel;
        this.transactionModel = transactionModel;
        this.lanePositionModel = lanePositionModel;
        this.market = market;
    }
    async getProfile(userId) {
        return this.userModel.findById(userId).lean();
    }
    async getPortfolio(userId) {
        const positions = await this.positionModel.find({ userId }).lean();
        const lanePos = await this.lanePositionModel.findOne({ userId: new mongoose_2.Types.ObjectId(userId) }).lean();
        const totalPrincipal = positions.reduce((s, p) => s + parseFloat(p.depositedPrincipal || '0'), 0);
        const laneYield = Number(lanePos?.yieldBalance ?? 0);
        const laneAdvance = Number(lanePos?.liquidBalance ?? 0);
        const availableToSpend = laneYield + laneAdvance;
        const totalYield = laneYield;
        const advanceCredit = laneAdvance;
        const lockedSurplus = Math.max(0, totalPrincipal - laneAdvance);
        const alloc = positions[0]?.strategyAllocation ?? {
            guardian: 100,
            balancer: 0,
            hunter: 0,
        };
        const blendedAPY = (alloc.guardian * STRATEGY_APY.guardian +
            alloc.balancer * STRATEGY_APY.balancer +
            alloc.hunter * STRATEGY_APY.hunter) /
            100;
        const ms = this.market.getState();
        const lane1APY = Math.max(0, ms.lane1Spread);
        const lane2APY = Math.max(0, ms.lane1Spread * 5);
        const lane3APY = ms.srNusdAPY;
        const laneBlendedAPY = 0.40 * lane1APY + 0.40 * lane2APY + 0.20 * lane3APY;
        const effectiveAPY = 0.5 * blendedAPY + 0.5 * laneBlendedAPY;
        const dailyRate = (totalPrincipal * effectiveAPY) / 100 / 365;
        const perSecondRate = dailyRate / 86400;
        return {
            totalPrincipal: totalPrincipal.toFixed(6),
            totalYield: totalYield.toFixed(6),
            liquidBalance: advanceCredit.toFixed(6),
            strategyPool: lockedSurplus.toFixed(6),
            totalValue: (totalPrincipal + totalYield).toFixed(6),
            availableToSpend: availableToSpend.toFixed(6),
            blendedAPY: effectiveAPY.toFixed(2),
            dailyEarnRate: dailyRate.toFixed(8),
            perSecondEarnRate: perSecondRate.toFixed(10),
            positions,
        };
    }
    async linkTelegram(userId, telegramId, telegramUsername) {
        return this.userModel.findByIdAndUpdate(userId, { telegramId, telegramUsername, telegramLinked: true }, { new: true });
    }
    async findByPlatformId(platformId) {
        return this.userModel.findOne({ platformId });
    }
    async findByTelegramId(telegramId) {
        return this.userModel.findOne({ telegramId });
    }
};
exports.UserService = UserService;
exports.UserService = UserService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __param(1, (0, mongoose_1.InjectModel)(position_schema_1.Position.name)),
    __param(2, (0, mongoose_1.InjectModel)(transaction_schema_1.Transaction.name)),
    __param(3, (0, mongoose_1.InjectModel)(lane_position_schema_1.LanePosition.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        market_simulator_service_1.MarketSimulatorService])
], UserService);
//# sourceMappingURL=user.service.js.map