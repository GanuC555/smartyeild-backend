import { Injectable } from '@nestjs/common';
import { StubChainAdapter } from './stub-chain.adapter';
import { IChainAdapter } from './chain-adapter.interface';

@Injectable()
export class ChainAdapterFactory {
  create(): IChainAdapter {
    const adapter = process.env.CHAIN_ADAPTER || 'stub';
    switch (adapter) {
      // Future: case 'onechain': return new OneChainAdapter();
      case 'stub':
      default:
        return new StubChainAdapter();
    }
  }
}
