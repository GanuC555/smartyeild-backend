"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VaultModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const bull_1 = require("@nestjs/bull");
const vault_controller_1 = require("./vault.controller");
const vault_service_1 = require("./vault.service");
const tx_watcher_processor_1 = require("./tx-watcher.processor");
const chain_adapter_factory_1 = require("../../adapters/chain/chain-adapter.factory");
const position_schema_1 = require("../../common/schemas/position.schema");
const transaction_schema_1 = require("../../common/schemas/transaction.schema");
const lane_position_schema_1 = require("../../common/schemas/lane-position.schema");
const auth_module_1 = require("../auth/auth.module");
const onechain_module_1 = require("../onechain/onechain.module");
let VaultModule = class VaultModule {
};
exports.VaultModule = VaultModule;
exports.VaultModule = VaultModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: position_schema_1.Position.name, schema: position_schema_1.PositionSchema },
                { name: transaction_schema_1.Transaction.name, schema: transaction_schema_1.TransactionSchema },
                { name: lane_position_schema_1.LanePosition.name, schema: lane_position_schema_1.LanePositionSchema },
            ]),
            bull_1.BullModule.registerQueue({ name: 'tx-watcher' }),
            auth_module_1.AuthModule,
            onechain_module_1.OneChainModule,
        ],
        controllers: [vault_controller_1.VaultController],
        providers: [vault_service_1.VaultService, tx_watcher_processor_1.TxWatcherProcessor, chain_adapter_factory_1.ChainAdapterFactory],
        exports: [vault_service_1.VaultService],
    })
], VaultModule);
//# sourceMappingURL=vault.module.js.map