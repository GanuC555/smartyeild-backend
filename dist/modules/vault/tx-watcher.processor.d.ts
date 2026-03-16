import { Job } from 'bull';
import { Model } from 'mongoose';
import { VaultService } from './vault.service';
import { OneChainService } from '../onechain/onechain.service';
import { Transaction } from '../../common/schemas/transaction.schema';
export declare class TxWatcherProcessor {
    private txModel;
    private vaultService;
    private oneChainService;
    private readonly logger;
    constructor(txModel: Model<Transaction>, vaultService: VaultService, oneChainService: OneChainService);
    handleWatchTx(job: Job): Promise<void>;
}
