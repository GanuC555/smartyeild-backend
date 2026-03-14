import { Injectable, Logger } from '@nestjs/common';
import { StubChainAdapter } from './stub-chain.adapter';
import { IChainAdapter } from './chain-adapter.interface';
import { OneChainChainAdapter } from './onechain-chain.adapter';

@Injectable()
export class ChainAdapterFactory {
  private readonly logger = new Logger(ChainAdapterFactory.name);

  create(): IChainAdapter {
    const adapter = process.env.CHAIN_ADAPTER || 'stub';
    switch (adapter) {
      case 'onechain':
        this.logger.log('OneChain adapter — on-chain via OneChainChainAdapter');
        return new OneChainChainAdapter();
      case 'stub':
      default:
        return new StubChainAdapter();
    }
  }
}
