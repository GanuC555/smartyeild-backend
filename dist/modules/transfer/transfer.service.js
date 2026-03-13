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
exports.TransferService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const transaction_schema_1 = require("../../common/schemas/transaction.schema");
const position_schema_1 = require("../../common/schemas/position.schema");
let TransferService = class TransferService {
    constructor(txModel, positionModel) {
        this.txModel = txModel;
        this.positionModel = positionModel;
    }
    async sendP2P(userId, toAddress, amount, note) {
        const position = await this.positionModel.findOne({ userId });
        if (!position)
            throw new common_1.BadRequestException('No position found');
        const sendAmt = parseFloat(amount);
        const yieldBal = parseFloat(position.accruedYield || '0');
        const liquidBal = parseFloat(position.liquidBalance || '0');
        const available = yieldBal + liquidBal;
        if (sendAmt > available) {
            throw new common_1.BadRequestException(`Insufficient balance. Available: ${available.toFixed(6)} USDC ` +
                `(yield: ${yieldBal.toFixed(6)} + liquid: ${liquidBal.toFixed(6)})`);
        }
        const fromYield = Math.min(sendAmt, yieldBal);
        const fromLiquid = sendAmt - fromYield;
        position.accruedYield = (yieldBal - fromYield).toFixed(6);
        position.liquidBalance = (liquidBal - fromLiquid).toFixed(6);
        await position.save();
        const tx = await this.txModel.create({
            userId,
            type: 'p2p_transfer',
            status: 'confirmed',
            amount,
            txHash: `0xp2p_${Date.now()}`,
            fromAddress: position.walletAddress,
            toAddress,
            metadata: {
                fromYield: fromYield.toFixed(6),
                fromLiquid: fromLiquid.toFixed(6),
                note: note || '',
                settlementSource: fromLiquid > 0 ? 'yield_and_liquid' : 'yield',
            },
        });
        return {
            success: true,
            txHash: tx.txHash,
            amount,
            toAddress,
            settlementSource: fromLiquid > 0
                ? 'Paid from yield and liquid balance'
                : 'Paid from yield balance',
            fromYield: fromYield.toFixed(6),
            fromLiquid: fromLiquid.toFixed(6),
            remainingBalance: {
                yield: position.accruedYield,
                liquid: position.liquidBalance,
            },
        };
    }
    async getHistory(userId, limit = 20) {
        return this.txModel
            .find({ userId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
    }
    async getSpendableBalance(userId) {
        const pos = await this.positionModel.findOne({ userId }).lean();
        if (!pos)
            return { yield: '0', liquid: '0', total: '0', principalLocked: '0' };
        const y = parseFloat(pos.accruedYield || '0');
        const l = parseFloat(pos.liquidBalance || '0');
        return {
            yield: y.toFixed(6),
            liquid: l.toFixed(6),
            total: (y + l).toFixed(6),
            principalLocked: pos.depositedPrincipal,
        };
    }
};
exports.TransferService = TransferService;
exports.TransferService = TransferService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(transaction_schema_1.Transaction.name)),
    __param(1, (0, mongoose_1.InjectModel)(position_schema_1.Position.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], TransferService);
//# sourceMappingURL=transfer.service.js.map