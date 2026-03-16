import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LanePosition, LanePositionDocument } from '../../common/schemas/lane-position.schema';
import { SpendTransaction, SpendTransactionDocument } from '../../common/schemas/spend-transaction.schema';
import { Position } from '../../common/schemas/position.schema';
import { NotificationService } from '../notification/notification.service';
import { OneChainAdapterService } from '../../adapters/onechain/OneChainAdapterService';

@Injectable()
export class SpendBufferService {
  private readonly logger = new Logger('SpendBufferService');

  constructor(
    @InjectModel(LanePosition.name) private positionModel: Model<LanePositionDocument>,
    @InjectModel(SpendTransaction.name) private spendTxModel: Model<SpendTransactionDocument>,
    @InjectModel(Position.name) private vaultPositionModel: Model<Position>,
    private readonly notification: NotificationService,
    private readonly oneChainAdapter: OneChainAdapterService,
  ) {}

  async getBalance(userId: string, walletAddress?: string) {
    this.logger.log(`[getBalance] userId=${userId} walletAddress=${walletAddress ?? 'NOT PROVIDED'}`);

    // Normalize to lowercase so JWT-supplied address always matches stored value
    const normalizedAddress = walletAddress?.toLowerCase();

    // Try walletAddress first (lowercase + original case), fall back to userId
    let pos = normalizedAddress
      ? await this.positionModel.findOne({ walletAddress: normalizedAddress })
      : null;
    if (!pos && normalizedAddress) {
      // try original case in case old doc was stored before normalization
      pos = await this.positionModel.findOne({ walletAddress });
    }
    if (!pos) {
      pos = await this.positionModel.findOne({ userId: new Types.ObjectId(userId) });
    }
    this.logger.log(`[getBalance] LanePosition DB lookup: ${pos ? `FOUND id=${pos._id} yieldBalance=${pos.yieldBalance} liquidBalance=${pos.liquidBalance}` : 'NOT FOUND — returning zeros'}`);

    const yieldBalance = Number(pos?.yieldBalance ?? 0);
    let liquidBalance = Number(pos?.liquidBalance ?? 0);

    // Fallback: if LanePosition.liquidBalance is 0 but a Position deposit exists,
    // compute the 70% LTV advance from depositedPrincipal (handles cases where
    // confirmDeposit ran before setUserAllocation or the tx-watcher job was missed)
    if (liquidBalance === 0) {
      const vaultPos = walletAddress
        ? await this.vaultPositionModel.findOne({ walletAddress: walletAddress.toLowerCase() }).lean()
        : await this.vaultPositionModel.findOne({ userId }).lean();
      if (vaultPos) {
        const principal = parseFloat(vaultPos.depositedPrincipal || '0');
        if (principal > 0) {
          liquidBalance = parseFloat((principal * 0.7).toFixed(6));
          this.logger.log(`[getBalance] LanePosition.liquidBalance=0 — computed advance from depositedPrincipal=${principal} → advance=${liquidBalance}`);
          // Persist the corrected value so future reads are instant
          if (pos) {
            await this.positionModel.findByIdAndUpdate(pos._id, { $set: { liquidBalance } });
          }
        }
      }
    }

    const totalSpendable = yieldBalance + liquidBalance;

    let onChainYieldBalance = '0';
    let onChainAdvanceBalance = '0';

    if (walletAddress) {
      try {
        const onChain = await this.oneChainAdapter.getSpendBalance(walletAddress);
        onChainYieldBalance = onChain.yieldBalance.toString();
        onChainAdvanceBalance = onChain.advanceBalance.toString();
        this.logger.log(`[getBalance] On-chain: yieldBalance=${onChainYieldBalance} advanceBalance=${onChainAdvanceBalance}`);
      } catch (err) {
        this.logger.warn(`[getBalance] On-chain read failed: ${err}`);
      }
    } else {
      this.logger.warn(`[getBalance] walletAddress not provided — skipping on-chain read`);
    }

    return {
      yieldBalance: yieldBalance.toFixed(6),
      liquidBalance: liquidBalance.toFixed(6),
      totalSpendable: totalSpendable.toFixed(6),
      onChainYieldBalance,
      onChainAdvanceBalance,
    };
  }

  async settleQRPay(userId: string, walletAddress: string, recipient: string, amount: string, note?: string) {
    const pos = await this.positionModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!pos) throw new BadRequestException('No position found');

    const amountNum = parseFloat(amount);
    const yieldBal = Number(pos.yieldBalance ?? 0);
    const liquidBal = Number(pos.liquidBalance ?? 0);
    const total = yieldBal + liquidBal;

    if (total < amountNum) throw new BadRequestException('Insufficient balance');

    let fromYield = 0;
    let fromLiquid = 0;
    let settlementSource: 'yield' | 'liquid' | 'mixed';

    if (yieldBal >= amountNum) {
      fromYield = amountNum;
      settlementSource = 'yield';
      pos.yieldBalance = yieldBal - amountNum;
    } else {
      fromYield = yieldBal;
      fromLiquid = amountNum - yieldBal;
      settlementSource = yieldBal > 0 ? 'mixed' : 'liquid';
      pos.yieldBalance = 0;
      pos.liquidBalance = liquidBal - fromLiquid;
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
      { $set: { yieldBalance: parseFloat(amount) } },
      { upsert: true },
    );
  }

  async getSpendHistory(userId: string) {
    return this.spendTxModel.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).limit(50);
  }
}
