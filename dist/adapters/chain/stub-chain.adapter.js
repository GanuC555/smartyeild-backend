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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StubChainAdapter = void 0;
const common_1 = require("@nestjs/common");
let StubChainAdapter = class StubChainAdapter {
    constructor() {
        this.logger = new common_1.Logger('StubChainAdapter');
        this.logger.log('StubChainAdapter loaded — no real blockchain calls');
    }
    async previewDeposit(amount) {
        const shares = (parseFloat(amount) * 0.9873).toFixed(6);
        return { shares, sharePrice: '1.012847', estimatedAPY: 12.5 };
    }
    async previewWithdraw(shares) {
        const usdcAmount = (parseFloat(shares) * 1.012847).toFixed(6);
        return { usdcAmount, sharePrice: '1.012847' };
    }
    async getVaultState() {
        return {
            totalAssets: '485234.567891',
            sharePrice: '1.012847',
            totalShares: '479113.234567',
            apy: 12.5,
        };
    }
    async watchTransaction(hash) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return { hash, status: 'confirmed' };
    }
    async buildDepositTx(userAddress, amount) {
        return {
            to: process.env.VAULT_CONTRACT_ADDRESS,
            data: `0xdeposit_${userAddress}_${amount}`,
            value: '0',
        };
    }
    async buildWithdrawTx(userAddress, shares) {
        return {
            to: process.env.VAULT_CONTRACT_ADDRESS,
            data: `0xwithdraw_${userAddress}_${shares}`,
            value: '0',
        };
    }
    async allocateToStrategy(strategyAddress, amount) {
        const hash = `0xstub_alloc_${Date.now()}`;
        this.logger.log(`STUB: Allocating ${amount} to ${strategyAddress} → ${hash}`);
        return { hash, status: 'confirmed' };
    }
    async withdrawFromStrategy(strategyAddress, amount) {
        const hash = `0xstub_withdraw_${Date.now()}`;
        this.logger.log(`STUB: Withdrawing ${amount} from ${strategyAddress} → ${hash}`);
        return { hash, status: 'confirmed' };
    }
};
exports.StubChainAdapter = StubChainAdapter;
exports.StubChainAdapter = StubChainAdapter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], StubChainAdapter);
//# sourceMappingURL=stub-chain.adapter.js.map