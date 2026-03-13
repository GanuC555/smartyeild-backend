import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Transaction } from '../../common/schemas/transaction.schema';
import { Position } from '../../common/schemas/position.schema';

@Injectable()
export class TransferService {
  constructor(
    @InjectModel(Transaction.name) private txModel: Model<Transaction>,
    @InjectModel(Position.name) private positionModel: Model<Position>,
  ) {}

  async sendP2P(
    userId: string,
    toAddress: string,
    amount: string,
    note?: string,
  ) {
    const position = await this.positionModel.findOne({ userId });
    if (!position) throw new BadRequestException('No position found');

    const sendAmt = parseFloat(amount);
    const yieldBal = parseFloat(position.accruedYield || '0');
    const liquidBal = parseFloat(position.liquidBalance || '0');
    const available = yieldBal + liquidBal;

    if (sendAmt > available) {
      throw new BadRequestException(
        `Insufficient balance. Available: ${available.toFixed(6)} USDC ` +
          `(yield: ${yieldBal.toFixed(6)} + liquid: ${liquidBal.toFixed(6)})`,
      );
    }

    // Draw from yield first, then liquid
    const fromYield = Math.min(sendAmt, yieldBal);
    const fromLiquid = sendAmt - fromYield;

    position.accruedYield = (yieldBal - fromYield).toFixed(6);
    position.liquidBalance = (liquidBal - fromLiquid).toFixed(6);
    await position.save();

    const tx = await this.txModel.create({
      userId,
      type: 'p2p_transfer',
      status: 'confirmed',
      amount,
      txHash: `0xp2p_${Date.now()}`,
      fromAddress: position.walletAddress,
      toAddress,
      metadata: {
        fromYield: fromYield.toFixed(6),
        fromLiquid: fromLiquid.toFixed(6),
        note: note || '',
        settlementSource:
          fromLiquid > 0 ? 'yield_and_liquid' : 'yield',
      },
    });

    return {
      success: true,
      txHash: tx.txHash,
      amount,
      toAddress,
      settlementSource:
        fromLiquid > 0
          ? 'Paid from yield and liquid balance'
          : 'Paid from yield balance',
      fromYield: fromYield.toFixed(6),
      fromLiquid: fromLiquid.toFixed(6),
      remainingBalance: {
        yield: position.accruedYield,
        liquid: position.liquidBalance,
      },
    };
  }

  async getHistory(userId: string, limit = 20) {
    return this.txModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async getSpendableBalance(userId: string) {
    const pos = await this.positionModel.findOne({ userId }).lean();
    if (!pos) return { yield: '0', liquid: '0', total: '0', principalLocked: '0' };

    const y = parseFloat(pos.accruedYield || '0');
    const l = parseFloat(pos.liquidBalance || '0');
    return {
      yield: y.toFixed(6),
      liquid: l.toFixed(6),
      total: (y + l).toFixed(6),
      principalLocked: pos.depositedPrincipal,
    };
  }
}
