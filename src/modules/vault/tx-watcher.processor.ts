import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VaultService } from './vault.service';
import { OneChainService } from '../onechain/onechain.service';
import { Transaction } from '../../common/schemas/transaction.schema';

@Processor('tx-watcher')
export class TxWatcherProcessor {
  private readonly logger = new Logger('TxWatcherProcessor');

  constructor(
    @InjectModel(Transaction.name) private txModel: Model<Transaction>,
    private vaultService: VaultService,
    private oneChainService: OneChainService,
  ) {}

  @Process('watch-tx')
  async handleWatchTx(job: Job) {
    const { txHash, userId, walletAddress, amount, transactionId } = job.data;
    this.logger.log(`[watch-tx] START txHash=${txHash} userId=${userId} wallet=${walletAddress} amount=${amount}`);

    try {
      // Stub: simulate block confirmation
      await new Promise((r) => setTimeout(r, 2000));

      await this.txModel.findByIdAndUpdate(transactionId, { status: 'confirmed' });
      this.logger.log(`[watch-tx] Tx marked confirmed, calling confirmDeposit...`);

      await this.vaultService.confirmDeposit(userId, walletAddress, amount, txHash);
      this.logger.log(`[watch-tx] confirmDeposit SUCCESS for ${txHash}`);

      // Credit advance on-chain: 70% LTV of deposit amount
      const depositAmt = parseFloat(amount);
      const advanceUsd = depositAmt * 0.7;
      this.logger.log(`[watch-tx] Calling creditAdvance on-chain: ${advanceUsd} USD → ${walletAddress}`);
      const creditResult = await this.oneChainService.creditAdvance(walletAddress, advanceUsd);
      if (creditResult.success) {
        this.logger.log(`[watch-tx] creditAdvance SUCCESS digest=${creditResult.digest}`);
      } else {
        // Non-fatal: DB advance is already credited; log but don't fail the job
        this.logger.warn(`[watch-tx] creditAdvance on-chain FAILED (non-fatal): ${creditResult.message}`);
      }
    } catch (err) {
      this.logger.error(`[watch-tx] confirmDeposit FAILED for ${txHash}:`, err);
      await this.txModel.findByIdAndUpdate(transactionId, { status: 'failed' });
      throw err;
    }
  }
}
