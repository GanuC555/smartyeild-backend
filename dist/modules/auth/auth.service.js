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
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const user_schema_1 = require("../../common/schemas/user.schema");
const verify_1 = require("@onelabs/sui/verify");
const crypto = require("crypto");
let AuthService = AuthService_1 = class AuthService {
    constructor(userModel, jwtService) {
        this.userModel = userModel;
        this.jwtService = jwtService;
        this.logger = new common_1.Logger(AuthService_1.name);
        this.nonces = new Map();
    }
    generateNonce(address) {
        const nonce = [
            'OneYield&Spend Sign-In',
            `Address: ${address}`,
            `Nonce: ${crypto.randomBytes(16).toString('hex')}`,
            `Timestamp: ${Date.now()}`,
        ].join('\n');
        this.nonces.set(address.toLowerCase(), {
            nonce,
            expires: Date.now() + 5 * 60 * 1000,
        });
        return nonce;
    }
    async verify(address, signature) {
        const stored = this.nonces.get(address.toLowerCase());
        if (!stored || stored.expires < Date.now()) {
            throw new common_1.UnauthorizedException('Nonce expired or not found');
        }
        try {
            await (0, verify_1.verifyPersonalMessageSignature)(new TextEncoder().encode(stored.nonce), signature, { address });
        }
        catch (err) {
            this.logger.error(`Signature verification failed: ${err}`);
            throw new common_1.BadRequestException('Invalid signature — make sure you are signing with the correct wallet');
        }
        this.nonces.delete(address.toLowerCase());
        let user = await this.userModel.findOne({
            walletAddress: address.toLowerCase(),
        });
        if (!user) {
            user = await this.userModel.create({
                walletAddress: address.toLowerCase(),
                platformId: this.generatePlatformId(),
            });
        }
        const payload = {
            sub: user._id.toString(),
            address: user.walletAddress,
            platformId: user.platformId,
        };
        const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
        const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
        user.refreshTokens.push(refreshToken);
        if (user.refreshTokens.length > 5)
            user.refreshTokens.shift();
        await user.save();
        return { accessToken, refreshToken, user };
    }
    async refresh(refreshToken) {
        try {
            const payload = this.jwtService.verify(refreshToken, {
                secret: process.env.JWT_SECRET || 'smartyield_jwt_secret_hackathon_2024',
            });
            const user = await this.userModel.findById(payload.sub);
            if (!user || !user.refreshTokens.includes(refreshToken)) {
                throw new common_1.UnauthorizedException('Invalid refresh token');
            }
            const newPayload = {
                sub: user._id.toString(),
                address: user.walletAddress,
                platformId: user.platformId,
            };
            return {
                accessToken: this.jwtService.sign(newPayload, { expiresIn: '15m' }),
            };
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid or expired refresh token');
        }
    }
    async logout(refreshToken, userId) {
        await this.userModel.findByIdAndUpdate(userId, {
            $pull: { refreshTokens: refreshToken },
        });
    }
    generatePlatformId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let id = 'OYS-';
        for (let i = 0; i < 4; i++) {
            id += chars[Math.floor(Math.random() * chars.length)];
        }
        return id;
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map