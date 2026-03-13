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
exports.AgentDecisionSchema = exports.AgentDecision = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let AgentDecision = class AgentDecision extends mongoose_2.Document {
};
exports.AgentDecision = AgentDecision;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentDecision.prototype, "strategy", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: [], type: Array }),
    __metadata("design:type", Array)
], AgentDecision.prototype, "conversationHistory", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentDecision.prototype, "reasoning", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentDecision.prototype, "decision", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: null, type: Object }),
    __metadata("design:type", Object)
], AgentDecision.prototype, "proposedAllocation", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: [] }),
    __metadata("design:type", Array)
], AgentDecision.prototype, "executedTasks", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: [] }),
    __metadata("design:type", Array)
], AgentDecision.prototype, "txHashes", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], AgentDecision.prototype, "toolCallCount", void 0);
exports.AgentDecision = AgentDecision = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], AgentDecision);
exports.AgentDecisionSchema = mongoose_1.SchemaFactory.createForClass(AgentDecision);
//# sourceMappingURL=agent-decision.schema.js.map