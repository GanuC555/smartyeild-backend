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
exports.GuardianProcessor = void 0;
const bull_1 = require("@nestjs/bull");
const common_1 = require("@nestjs/common");
const agent_service_1 = require("../agent.service");
let GuardianProcessor = class GuardianProcessor {
    constructor(agentService) {
        this.agentService = agentService;
        this.logger = new common_1.Logger('GuardianAgent');
    }
    async handle(job) {
        this.logger.log('Guardian cycle start');
        try {
            const d = await this.agentService.runAgent('guardian');
            this.logger.log(`Guardian → ${d.decision}`);
        }
        catch (err) {
            this.logger.error('Guardian failed', err);
        }
    }
};
exports.GuardianProcessor = GuardianProcessor;
__decorate([
    (0, bull_1.Process)('run-agent'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GuardianProcessor.prototype, "handle", null);
exports.GuardianProcessor = GuardianProcessor = __decorate([
    (0, bull_1.Processor)('guardian-agent'),
    __metadata("design:paramtypes", [agent_service_1.AgentService])
], GuardianProcessor);
//# sourceMappingURL=guardian.processor.js.map