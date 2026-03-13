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
exports.PositionSchema = exports.Position = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let Position = class Position extends mongoose_2.Document {
};
exports.Position = Position;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Position.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Position.prototype, "vaultId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Position.prototype, "walletAddress", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '0' }),
    __metadata("design:type", String)
], Position.prototype, "shares", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '0' }),
    __metadata("design:type", String)
], Position.prototype, "depositedPrincipal", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '0' }),
    __metadata("design:type", String)
], Position.prototype, "liquidBalance", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '0' }),
    __metadata("design:type", String)
], Position.prototype, "strategyPoolBalance", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '0' }),
    __metadata("design:type", String)
], Position.prototype, "accruedYield", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        default: { guardian: 100, balancer: 0, hunter: 0 },
        type: Object,
    }),
    __metadata("design:type", Object)
], Position.prototype, "strategyAllocation", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'active' }),
    __metadata("design:type", String)
], Position.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: Date.now }),
    __metadata("design:type", Date)
], Position.prototype, "depositedAt", void 0);
exports.Position = Position = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Position);
exports.PositionSchema = mongoose_1.SchemaFactory.createForClass(Position);
//# sourceMappingURL=position.schema.js.map