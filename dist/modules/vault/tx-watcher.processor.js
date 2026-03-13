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
exports.TxWatcherProcessor = void 0;
const bull_1 = require("@nestjs/bull");
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const vault_service_1 = require("./vault.service");
const transaction_schema_1 = require("../../common/schemas/transaction.schema");
let TxWatcherProcessor = class TxWatcherProcessor {
    constructor(txModel, vaultService) {
        this.txModel = txModel;
        this.vaultService = vaultService;
        this.logger = new common_1.Logger('TxWatcherProcessor');
    }
    async handleWatchTx(job) {
        const { txHash, userId, walletAddress, amount, transactionId } = job.data;
        this.logger.log(`Watching tx: ${txHash}`);
        try {
            await new Promise((r) => setTimeout(r, 2000));
            await this.txModel.findByIdAndUpdate(transactionId, {
                status: 'confirmed',
            });
            await this.vaultService.confirmDeposit(userId, walletAddress, amount, txHash);
            this.logger.log(`Tx confirmed: ${txHash}`);
        }
        catch (err) {
            this.logger.error(`Tx failed: ${txHash}`, err);
            await this.txModel.findByIdAndUpdate(transactionId, { status: 'failed' });
            throw err;
        }
    }
};
exports.TxWatcherProcessor = TxWatcherProcessor;
__decorate([
    (0, bull_1.Process)('watch-tx'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TxWatcherProcessor.prototype, "handleWatchTx", null);
exports.TxWatcherProcessor = TxWatcherProcessor = __decorate([
    (0, bull_1.Processor)('tx-watcher'),
    __param(0, (0, mongoose_1.InjectModel)(transaction_schema_1.Transaction.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        vault_service_1.VaultService])
], TxWatcherProcessor);
//# sourceMappingURL=tx-watcher.processor.js.map