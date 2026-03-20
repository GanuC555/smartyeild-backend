"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategyModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const strategy_controller_1 = require("./strategy.controller");
const strategy_service_1 = require("./strategy.service");
const position_schema_1 = require("../../common/schemas/position.schema");
const auth_module_1 = require("../auth/auth.module");
const market_simulator_module_1 = require("../../common/market/market-simulator.module");
let StrategyModule = class StrategyModule {
};
exports.StrategyModule = StrategyModule;
exports.StrategyModule = StrategyModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([{ name: position_schema_1.Position.name, schema: position_schema_1.PositionSchema }]),
            auth_module_1.AuthModule,
            market_simulator_module_1.MarketSimulatorModule,
        ],
        controllers: [strategy_controller_1.StrategyController],
        providers: [strategy_service_1.StrategyService],
        exports: [strategy_service_1.StrategyService],
    })
], StrategyModule);
//# sourceMappingURL=strategy.module.js.map