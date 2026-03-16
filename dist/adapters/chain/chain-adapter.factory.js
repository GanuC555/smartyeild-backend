"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ChainAdapterFactory_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChainAdapterFactory = void 0;
const common_1 = require("@nestjs/common");
const stub_chain_adapter_1 = require("./stub-chain.adapter");
const onechain_chain_adapter_1 = require("./onechain-chain.adapter");
let ChainAdapterFactory = ChainAdapterFactory_1 = class ChainAdapterFactory {
    constructor() {
        this.logger = new common_1.Logger(ChainAdapterFactory_1.name);
    }
    create() {
        const adapter = process.env.CHAIN_ADAPTER || 'stub';
        switch (adapter) {
            case 'onechain':
                this.logger.log('OneChain adapter — on-chain via OneChainChainAdapter');
                return new onechain_chain_adapter_1.OneChainChainAdapter();
            case 'stub':
            default:
                return new stub_chain_adapter_1.StubChainAdapter();
        }
    }
};
exports.ChainAdapterFactory = ChainAdapterFactory;
exports.ChainAdapterFactory = ChainAdapterFactory = ChainAdapterFactory_1 = __decorate([
    (0, common_1.Injectable)()
], ChainAdapterFactory);
//# sourceMappingURL=chain-adapter.factory.js.map