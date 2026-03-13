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
const STRATEGY_APY = { guardian: 6.2, balancer: 12.8, hunter: 24.7 };
let UserService = class UserService {
    constructor(userModel, positionModel, transactionModel) {
        this.userModel = userModel;
        this.positionModel = positionModel;
        this.transactionModel = transactionModel;
    }
    async getProfile(userId) {
        return this.userModel.findById(userId).lean();
    }
    async getPortfolio(userId) {
        const positions = await this.positionModel.find({ userId }).lean();
        const totalPrincipal = positions.reduce((s, p) => s + parseFloat(p.depositedPrincipal || '0'), 0);
        const totalYield = positions.reduce((s, p) => s + parseFloat(p.accruedYield || '0'), 0);
        const liquidBalance = positions.reduce((s, p) => s + parseFloat(p.liquidBalance || '0'), 0);
        const strategyPool = positions.reduce((s, p) => s + parseFloat(p.strategyPoolBalance || '0'), 0);
        const alloc = positions[0]?.strategyAllocation ?? {
            guardian: 100,
            balancer: 0,
            hunter: 0,
        };
        const blendedAPY = (alloc.guardian * STRATEGY_APY.guardian +
            alloc.balancer * STRATEGY_APY.balancer +
            alloc.hunter * STRATEGY_APY.hunter) /
            100;
        const dailyRate = (totalPrincipal * blendedAPY) / 100 / 365;
        const perSecondRate = dailyRate / 86400;
        return {
            totalPrincipal: totalPrincipal.toFixed(6),
            totalYield: totalYield.toFixed(6),
            liquidBalance: liquidBalance.toFixed(6),
            strategyPool: strategyPool.toFixed(6),
            totalValue: (totalPrincipal + totalYield).toFixed(6),
            availableToSpend: (totalYield + liquidBalance).toFixed(6),
            blendedAPY: blendedAPY.toFixed(2),
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
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], UserService);
//# sourceMappingURL=user.service.js.map