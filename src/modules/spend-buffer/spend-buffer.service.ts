import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LanePosition, LanePositionDocument } from '../../common/schemas/lane-position.schema';
import { SpendTransaction, SpendTransactionDocument } from '../../common/schemas/spend-transaction.schema';
import { NotificationService } from '../notification/notification.service';
import { OneChainAdapterService } from '../../adapters/onechain/OneChainAdapterService';

@Injectable()
export class SpendBufferService {
  constructor(
    @InjectModel(LanePosition.name) private positionModel: Model<LanePositionDocument>,
    @InjectModel(SpendTransaction.name) private spendTxModel: Model<SpendTransactionDocument>,
    private readonly notification: NotificationService,
    private readonly oneChainAdapter: OneChainAdapterService,
  ) {}

  async getBalance(userId: string, walletAddress?: string) {
    const pos = await this.positionModel.findOne({ userId: new Types.ObjectId(userId) });
    const yieldBalance = BigInt(pos?.yieldBalance || '0');
    const liquidBalance = BigInt(pos?.liquidBalance || '0');

    let onChainYieldBalance = '0';
    let onChainAdvanceBalance = '0';

    if (walletAddress) {
      try {
        const onChain = await this.oneChainAdapter.getSpendBalance(walletAddress);
        onChainYieldBalance = onChain.yieldBalance.toString();
        onChainAdvanceBalance = onChain.advanceBalance.toString();
      } catch {
        // on-chain read is best-effort; fall back to zeros
      }
    }

    return {
      yieldBalance: yieldBalance.toString(),
      liquidBalance: liquidBalance.toString(),
      totalSpendable: (yieldBalance + liquidBalance).toString(),
      onChainYieldBalance,
      onChainAdvanceBalance,
    };
  }

  async settleQRPay(userId: string, walletAddress: string, recipient: string, amount: string, note?: string) {
    const pos = await this.positionModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!pos) throw new BadRequestException('No position found');

    const amountBig = BigInt(amount);
    const yieldBal = BigInt(pos.yieldBalance);
    const liquidBal = BigInt(pos.liquidBalance);
    const total = yieldBal + liquidBal;

    if (total < amountBig) throw new BadRequestException('Insufficient balance');

    let fromYield = 0n;
    let fromLiquid = 0n;
    let settlementSource: 'yield' | 'liquid' | 'mixed';

    if (yieldBal >= amountBig) {
      fromYield = amountBig;
      settlementSource = 'yield';
      pos.yieldBalance = (yieldBal - amountBig).toString();
    } else {
      fromYield = yieldBal;
      fromLiquid = amountBig - yieldBal;
      settlementSource = yieldBal > 0n ? 'mixed' : 'liquid';
      pos.yieldBalance = '0';
      pos.liquidBalance = (liquidBal - fromLiquid).toString();
    }
    await pos.save();

    const tx = await this.spendTxModel.create({
      userId: new Types.ObjectId(userId),
      type: 'qr_pay',
      amount,
      currency: 'USDC',
      recipient,
      settlementSource,
      yieldAmount: fromYield.toString(),
      liquidAmount: fromLiquid.toString(),
      txHash: `0xqr_${Date.now()}`,
      status: 'settled',
      note,
    });

    this.notification.emitPortfolioUpdate(userId, {
      event: 'spend:settled',
      amount,
      settlementSource,
      message: `Paid ${amount} USDC from ${settlementSource}. Principal untouched.`,
    });

    // Read on-chain balance post-settlement (best-effort, frontend has already submitted the tx)
    let onChainBalanceAfter: { yieldBalance: string; advanceBalance: string } | null = null;
    try {
      const onChain = await this.oneChainAdapter.getSpendBalance(walletAddress);
      onChainBalanceAfter = {
        yieldBalance: onChain.yieldBalance.toString(),
        advanceBalance: onChain.advanceBalance.toString(),
      };
    } catch {
      // on-chain read is best-effort
    }

    return { ...tx.toObject(), onChainBalanceAfter };
  }

  async creditYield(userId: string, amount: string) {
    await this.positionModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $set: { yieldBalance: amount } },
      { upsert: true },
    );
  }

  async getSpendHistory(userId: string) {
    return this.spendTxModel.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).limit(50);
  }
}
