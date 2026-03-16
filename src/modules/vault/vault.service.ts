import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Model, Types } from 'mongoose';
import { Position } from '../../common/schemas/position.schema';
import { Transaction } from '../../common/schemas/transaction.schema';
import { LanePosition, LanePositionDocument } from '../../common/schemas/lane-position.schema';
import { ChainAdapterFactory } from '../../adapters/chain/chain-adapter.factory';

const VAULT = {
  id: 'vault-main',
  name: 'OneYield Vault',
  chainId: 'onechain-testnet',
  contractAddress:
    process.env.VAULT_CONTRACT_ADDRESS ||
    '0x0000000000000000000000000000000000000001',
  minDeposit: '10',
};

@Injectable()
export class VaultService {
  private readonly logger = new Logger('VaultService');
  private chainAdapter;

  constructor(
    @InjectModel(Position.name) private positionModel: Model<Position>,
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
    @InjectModel(LanePosition.name) private lanePositionModel: Model<LanePositionDocument>,
    @InjectQueue('tx-watcher') private txWatcherQueue: Queue,
    private chainAdapterFactory: ChainAdapterFactory,
  ) {
    this.chainAdapter = this.chainAdapterFactory.create();
  }

  getVaults() {
    return [
      {
        ...VAULT,
        apy: 12.5,
        tvl: '485234.567891',
        sharePrice: '1.012847',
        status: 'active',
      },
    ];
  }

  async getVault(id: string) {
    const state = await this.chainAdapter.getVaultState();
    return { ...VAULT, ...state, id, status: 'active' };
  }

  async previewDeposit(amount: string) {
    return this.chainAdapter.previewDeposit(amount);
  }

  async previewWithdraw(shares: string) {
    return this.chainAdapter.previewWithdraw(shares);
  }

  async submitDeposit(
    userId: string,
    walletAddress: string,
    txHash: string,
    amount: string,
  ) {
    const existing = await this.transactionModel.findOne({ userId, txHash });
    if (existing) return { message: 'Already processing', txHash };

    const tx = await this.transactionModel.create({
      userId,
      type: 'deposit',
      status: 'pending',
      amount,
      txHash,
      fromAddress: walletAddress,
    });

    await this.txWatcherQueue.add(
      'watch-tx',
      { txHash, userId, walletAddress, amount, transactionId: tx._id.toString() },
      { attempts: 5, backoff: { type: 'exponential', delay: 2000 } },
    );

    return { message: 'Deposit submitted, watching for confirmation', txHash };
  }

  async confirmDeposit(
    userId: string,
    walletAddress: string,
    amount: string,
    txHash: string,
  ) {
    // Normalize to lowercase so address lookups are case-consistent with JWT payload
    walletAddress = walletAddress.toLowerCase();
    this.logger.log(`[confirmDeposit] START userId=${userId} wallet=${walletAddress} amount=${amount} txHash=${txHash}`);

    const existing = await this.positionModel.findOne({ userId, walletAddress });
    this.logger.log(`[confirmDeposit] Position lookup: ${existing ? 'FOUND existing' : 'NOT FOUND — creating new'}`);

    const depositAmt = parseFloat(amount);
    const liquid = (depositAmt * 0.5).toFixed(6);
    const stratPool = (depositAmt * 0.5).toFixed(6);

    if (existing) {
      existing.depositedPrincipal = (
        parseFloat(existing.depositedPrincipal) + depositAmt
      ).toFixed(6);
      existing.liquidBalance = (
        parseFloat(existing.liquidBalance) + parseFloat(liquid)
      ).toFixed(6);
      existing.strategyPoolBalance = (
        parseFloat(existing.strategyPoolBalance) + parseFloat(stratPool)
      ).toFixed(6);
      await existing.save();
      this.logger.log(`[confirmDeposit] Position updated`);
    } else {
      const preview = await this.chainAdapter.previewDeposit(amount);
      await this.positionModel.create({
        userId,
        vaultId: VAULT.id,
        walletAddress,
        shares: preview.shares,
        depositedPrincipal: amount,
        liquidBalance: liquid,
        strategyPoolBalance: stratPool,
        accruedYield: '0',
        strategyAllocation: { guardian: 100, balancer: 0, hunter: 0 },
      });
      this.logger.log(`[confirmDeposit] Position created`);
    }

    // Advance = 70% LTV (mirrors vault::deposit on-chain calculation)
    const advance = (depositAmt * 0.7).toFixed(6);
    this.logger.log(`[confirmDeposit] Advance to credit: ${advance} (70% of ${amount})`);

    // Upsert LanePosition by userId only — avoids duplicate docs when walletAddress wasn't set yet
    try {
      const existing = await this.lanePositionModel.findOne({ userId: new Types.ObjectId(userId) });
      const advanceNum = parseFloat(advance);

      if (existing) {
        // Convert field regardless of whether it was previously stored as string or number
        const currentLiquid = Number(existing.liquidBalance ?? 0);
        await this.lanePositionModel.findByIdAndUpdate(existing._id, {
          $set: { walletAddress, liquidBalance: currentLiquid + advanceNum },
        });
        this.logger.log(`[confirmDeposit] LanePosition updated → liquidBalance=${currentLiquid + advanceNum}`);
      } else {
        await this.lanePositionModel.create({
          userId,
          walletAddress,
          liquidBalance: advanceNum,
          yieldBalance: 0,
        });
        this.logger.log(`[confirmDeposit] LanePosition created → liquidBalance=${advanceNum}`);
      }
    } catch (err) {
      this.logger.error(`[confirmDeposit] LanePosition write FAILED:`, err);
      throw err;
    }

    this.logger.log(`[confirmDeposit] DONE`);
  }

  async getUserPositions(userId: string) {
    return this.positionModel.find({ userId }).lean();
  }
}
