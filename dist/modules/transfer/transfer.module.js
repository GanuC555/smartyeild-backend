"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransferModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const transfer_controller_1 = require("./transfer.controller");
const transfer_service_1 = require("./transfer.service");
const transaction_schema_1 = require("../../common/schemas/transaction.schema");
const position_schema_1 = require("../../common/schemas/position.schema");
const auth_module_1 = require("../auth/auth.module");
let TransferModule = class TransferModule {
};
exports.TransferModule = TransferModule;
exports.TransferModule = TransferModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: transaction_schema_1.Transaction.name, schema: transaction_schema_1.TransactionSchema },
                { name: position_schema_1.Position.name, schema: position_schema_1.PositionSchema },
            ]),
            auth_module_1.AuthModule,
        ],
        controllers: [transfer_controller_1.TransferController],
        providers: [transfer_service_1.TransferService],
        exports: [transfer_service_1.TransferService],
    })
], TransferModule);
//# sourceMappingURL=transfer.module.js.map