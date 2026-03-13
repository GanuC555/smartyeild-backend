"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const bull_1 = require("@nestjs/bull");
const agent_controller_1 = require("./agent.controller");
const agent_service_1 = require("./agent.service");
const demo_yield_service_1 = require("./demo-yield.service");
const guardian_processor_1 = require("./processors/guardian.processor");
const balancer_processor_1 = require("./processors/balancer.processor");
const hunter_processor_1 = require("./processors/hunter.processor");
const agent_decision_schema_1 = require("../../common/schemas/agent-decision.schema");
const position_schema_1 = require("../../common/schemas/position.schema");
const auth_module_1 = require("../auth/auth.module");
const strategy_module_1 = require("../strategy/strategy.module");
let AgentModule = class AgentModule {
};
exports.AgentModule = AgentModule;
exports.AgentModule = AgentModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: agent_decision_schema_1.AgentDecision.name, schema: agent_decision_schema_1.AgentDecisionSchema },
                { name: position_schema_1.Position.name, schema: position_schema_1.PositionSchema },
            ]),
            bull_1.BullModule.registerQueue({ name: 'guardian-agent' }, { name: 'balancer-agent' }, { name: 'hunter-agent' }),
            auth_module_1.AuthModule,
            strategy_module_1.StrategyModule,
        ],
        controllers: [agent_controller_1.AgentController],
        providers: [
            agent_service_1.AgentService,
            demo_yield_service_1.DemoYieldService,
            guardian_processor_1.GuardianProcessor,
            balancer_processor_1.BalancerProcessor,
            hunter_processor_1.HunterProcessor,
        ],
        exports: [agent_service_1.AgentService],
    })
], AgentModule);
//# sourceMappingURL=agent.module.js.map