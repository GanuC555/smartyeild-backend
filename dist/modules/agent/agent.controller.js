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
exports.AgentController = void 0;
const common_1 = require("@nestjs/common");
const agent_service_1 = require("./agent.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
let AgentController = class AgentController {
    constructor(agentService) {
        this.agentService = agentService;
    }
    getAllStatus() {
        return this.agentService.getAllAgentsStatus();
    }
    getDecisions(strategy) {
        return this.agentService.getDecisions(strategy);
    }
    runAgent(strategy) {
        return this.agentService.runAgent(strategy);
    }
};
exports.AgentController = AgentController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AgentController.prototype, "getAllStatus", null);
__decorate([
    (0, common_1.Get)(':strategy/decisions'),
    __param(0, (0, common_1.Param)('strategy')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AgentController.prototype, "getDecisions", null);
__decorate([
    (0, common_1.Post)(':strategy/run'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('strategy')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AgentController.prototype, "runAgent", null);
exports.AgentController = AgentController = __decorate([
    (0, common_1.Controller)('agents'),
    __metadata("design:paramtypes", [agent_service_1.AgentService])
], AgentController);
//# sourceMappingURL=agent.controller.js.map