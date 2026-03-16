import { IChainAdapter } from './chain-adapter.interface';
export declare class ChainAdapterFactory {
    private readonly logger;
    create(): IChainAdapter;
}
