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
exports.VaultService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const bull_1 = require("@nestjs/bull");
const mongoose_2 = require("mongoose");
const position_schema_1 = require("../../common/schemas/position.schema");
const transaction_schema_1 = require("../../common/schemas/transaction.schema");
const chain_adapter_factory_1 = require("../../adapters/chain/chain-adapter.factory");
const VAULT = {
    id: 'vault-main',
    name: 'OneYield Vault',
    chainId: 'onechain-testnet',
    contractAddress: process.env.VAULT_CONTRACT_ADDRESS ||
        '0x0000000000000000000000000000000000000001',
    minDeposit: '10',
};
let VaultService = class VaultService {
    constructor(positionModel, transactionModel, txWatcherQueue, chainAdapterFactory) {
        this.positionModel = positionModel;
        this.transactionModel = transactionModel;
        this.txWatcherQueue = txWatcherQueue;
        this.chainAdapterFactory = chainAdapterFactory;
        this.chainAdapter = this.chainAdapterFactory.create();
    }
    getVaults() {
        return [
            {
                ...VAULT,
                apy: 12.5,
                tvl: '485234.567891',
                sharePrice: '1.012847',
                status: 'active',
            },
        ];
    }
    async getVault(id) {
        const state = await this.chainAdapter.getVaultState();
        return { ...VAULT, ...state, id, status: 'active' };
    }
    async previewDeposit(amount) {
        return this.chainAdapter.previewDeposit(amount);
    }
    async previewWithdraw(shares) {
        return this.chainAdapter.previewWithdraw(shares);
    }
    async submitDeposit(userId, walletAddress, txHash, amount) {
        const existing = await this.transactionModel.findOne({ userId, txHash });
        if (existing)
            return { message: 'Already processing', txHash };
        const tx = await this.transactionModel.create({
            userId,
            type: 'deposit',
            status: 'pending',
            amount,
            txHash,
            fromAddress: walletAddress,
        });
        await this.txWatcherQueue.add('watch-tx', { txHash, userId, walletAddress, amount, transactionId: tx._id.toString() }, { attempts: 5, backoff: { type: 'exponential', delay: 2000 } });
        return { message: 'Deposit submitted, watching for confirmation', txHash };
    }
    async confirmDeposit(userId, walletAddress, amount, txHash) {
        const existing = await this.positionModel.findOne({ userId, walletAddress });
        const depositAmt = parseFloat(amount);
        const liquid = (depositAmt * 0.5).toFixed(6);
        const stratPool = (depositAmt * 0.5).toFixed(6);
        if (existing) {
            existing.depositedPrincipal = (parseFloat(existing.depositedPrincipal) + depositAmt).toFixed(6);
            existing.liquidBalance = (parseFloat(existing.liquidBalance) + parseFloat(liquid)).toFixed(6);
            existing.strategyPoolBalance = (parseFloat(existing.strategyPoolBalance) + parseFloat(stratPool)).toFixed(6);
            return existing.save();
        }
        const preview = await this.chainAdapter.previewDeposit(amount);
        return this.positionModel.create({
            userId,
            vaultId: VAULT.id,
            walletAddress,
            shares: preview.shares,
            depositedPrincipal: amount,
            liquidBalance: liquid,
            strategyPoolBalance: stratPool,
            accruedYield: '0',
            strategyAllocation: { guardian: 100, balancer: 0, hunter: 0 },
        });
    }
    async getUserPositions(userId) {
        return this.positionModel.find({ userId }).lean();
    }
};
exports.VaultService = VaultService;
exports.VaultService = VaultService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(position_schema_1.Position.name)),
    __param(1, (0, mongoose_1.InjectModel)(transaction_schema_1.Transaction.name)),
    __param(2, (0, bull_1.InjectQueue)('tx-watcher')),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model, Object, chain_adapter_factory_1.ChainAdapterFactory])
], VaultService);
//# sourceMappingURL=vault.service.js.map