"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const bull_1 = require("@nestjs/bull");
const llm_module_1 = require("./common/llm/llm.module");
const market_simulator_module_1 = require("./common/market/market-simulator.module");
const health_module_1 = require("./modules/health/health.module");
const user_module_1 = require("./modules/user/user.module");
const auth_module_1 = require("./modules/auth/auth.module");
const vault_module_1 = require("./modules/vault/vault.module");
const strategy_module_1 = require("./modules/strategy/strategy.module");
const agent_module_1 = require("./modules/agent/agent.module");
const transfer_module_1 = require("./modules/transfer/transfer.module");
const telegram_module_1 = require("./modules/telegram/telegram.module");
const notification_module_1 = require("./modules/notification/notification.module");
const lane_module_1 = require("./modules/lane/lane.module");
const orchestrator_module_1 = require("./modules/orchestrator/orchestrator.module");
const protocol_module_1 = require("./modules/protocol/protocol.module");
const spend_buffer_module_1 = require("./modules/spend-buffer/spend-buffer.module");
const onechain_module_1 = require("./modules/onechain/onechain.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/smartyield'),
            bull_1.BullModule.forRoot({
                redis: process.env.REDIS_URL || 'redis://localhost:6379',
            }),
            llm_module_1.LLMModule,
            market_simulator_module_1.MarketSimulatorModule,
            health_module_1.HealthModule,
            user_module_1.UserModule,
            auth_module_1.AuthModule,
            vault_module_1.VaultModule,
            strategy_module_1.StrategyModule,
            agent_module_1.AgentModule,
            transfer_module_1.TransferModule,
            telegram_module_1.TelegramModule,
            notification_module_1.NotificationModule,
            lane_module_1.LaneModule,
            orchestrator_module_1.OrchestratorModule,
            protocol_module_1.ProtocolModule,
            spend_buffer_module_1.SpendBufferModule,
            onechain_module_1.OneChainModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map