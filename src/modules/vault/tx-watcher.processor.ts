import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VaultService } from './vault.service';
import { Transaction } from '../../common/schemas/transaction.schema';

@Processor('tx-watcher')
export class TxWatcherProcessor {
  private readonly logger = new Logger('TxWatcherProcessor');

  constructor(
    @InjectModel(Transaction.name) private txModel: Model<Transaction>,
    private vaultService: VaultService,
  ) {}

  @Process('watch-tx')
  async handleWatchTx(job: Job) {
    const { txHash, userId, walletAddress, amount, transactionId } = job.data;
    this.logger.log(`Watching tx: ${txHash}`);

    try {
      // Stub: simulate block confirmation
      await new Promise((r) => setTimeout(r, 2000));

      await this.txModel.findByIdAndUpdate(transactionId, {
        status: 'confirmed',
      });
      await this.vaultService.confirmDeposit(userId, walletAddress, amount, txHash);
      this.logger.log(`Tx confirmed: ${txHash}`);
    } catch (err) {
      this.logger.error(`Tx failed: ${txHash}`, err);
      await this.txModel.findByIdAndUpdate(transactionId, { status: 'failed' });
      throw err;
    }
  }
}
