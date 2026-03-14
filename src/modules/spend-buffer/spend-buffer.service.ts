import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LanePosition, LanePositionDocument } from '../../common/schemas/lane-position.schema';
import { SpendTransaction, SpendTransactionDocument } from '../../common/schemas/spend-transaction.schema';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class SpendBufferService {
  constructor(
    @InjectModel(LanePosition.name) private positionModel: Model<LanePositionDocument>,
    @InjectModel(SpendTransaction.name) private spendTxModel: Model<SpendTransactionDocument>,
    private readonly notification: NotificationService,
  ) {}

  async getBalance(userId: string) {
    const pos = await this.positionModel.findOne({ userId: new Types.ObjectId(userId) });
    const yieldBalance = BigInt(pos?.yieldBalance || '0');
    const liquidBalance = BigInt(pos?.liquidBalance || '0');
    return {
      yieldBalance: yieldBalance.toString(),
      liquidBalance: liquidBalance.toString(),
      totalSpendable: (yieldBalance + liquidBalance).toString(),
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

    return tx;
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
