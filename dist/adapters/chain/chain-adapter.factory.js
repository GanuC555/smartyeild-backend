"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChainAdapterFactory = void 0;
const common_1 = require("@nestjs/common");
const stub_chain_adapter_1 = require("./stub-chain.adapter");
let ChainAdapterFactory = class ChainAdapterFactory {
    create() {
        const adapter = process.env.CHAIN_ADAPTER || 'stub';
        switch (adapter) {
            case 'stub':
            default:
                return new stub_chain_adapter_1.StubChainAdapter();
        }
    }
};
exports.ChainAdapterFactory = ChainAdapterFactory;
exports.ChainAdapterFactory = ChainAdapterFactory = __decorate([
    (0, common_1.Injectable)()
], ChainAdapterFactory);
//# sourceMappingURL=chain-adapter.factory.js.map