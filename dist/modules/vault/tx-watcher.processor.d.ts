import { Job } from 'bull';
import { Model } from 'mongoose';
import { VaultService } from './vault.service';
import { Transaction } from '../../common/schemas/transaction.schema';
export declare class TxWatcherProcessor {
    private txModel;
    private vaultService;
    private readonly logger;
    constructor(txModel: Model<Transaction>, vaultService: VaultService);
    handleWatchTx(job: Job): Promise<void>;
}
