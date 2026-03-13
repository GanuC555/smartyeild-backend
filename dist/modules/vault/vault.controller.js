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
exports.VaultController = void 0;
const common_1 = require("@nestjs/common");
const vault_service_1 = require("./vault.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
let VaultController = class VaultController {
    constructor(vaultService) {
        this.vaultService = vaultService;
    }
    getVaults() {
        return this.vaultService.getVaults();
    }
    getVault(id) {
        return this.vaultService.getVault(id);
    }
    previewDeposit(amount) {
        return this.vaultService.previewDeposit(amount);
    }
    previewWithdraw(shares) {
        return this.vaultService.previewWithdraw(shares);
    }
    submitDeposit(body, req) {
        return this.vaultService.submitDeposit(req.user.sub, req.user.address, body.txHash, body.amount);
    }
    demoConfirm(amount, req) {
        return this.vaultService.confirmDeposit(req.user.sub, req.user.address, amount, `0xdemo_${Date.now()}`);
    }
    getPositions(req) {
        return this.vaultService.getUserPositions(req.user.sub);
    }
};
exports.VaultController = VaultController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VaultController.prototype, "getVaults", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], VaultController.prototype, "getVault", null);
__decorate([
    (0, common_1.Post)(':id/preview-deposit'),
    __param(0, (0, common_1.Body)('amount')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], VaultController.prototype, "previewDeposit", null);
__decorate([
    (0, common_1.Post)(':id/preview-withdraw'),
    __param(0, (0, common_1.Body)('shares')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], VaultController.prototype, "previewWithdraw", null);
__decorate([
    (0, common_1.Post)(':id/deposit'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], VaultController.prototype, "submitDeposit", null);
__decorate([
    (0, common_1.Post)(':id/demo-confirm'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Body)('amount')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], VaultController.prototype, "demoConfirm", null);
__decorate([
    (0, common_1.Get)(':id/positions'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], VaultController.prototype, "getPositions", null);
exports.VaultController = VaultController = __decorate([
    (0, common_1.Controller)('vaults'),
    __metadata("design:paramtypes", [vault_service_1.VaultService])
], VaultController);
//# sourceMappingURL=vault.controller.js.map