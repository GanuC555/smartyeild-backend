import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../common/schemas/user.schema';
import { Position } from '../../common/schemas/position.schema';
import { Transaction } from '../../common/schemas/transaction.schema';

// APY per strategy for blended rate calculation
const STRATEGY_APY = { guardian: 6.2, balancer: 12.8, hunter: 24.7 };

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Position.name) private positionModel: Model<Position>,
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
  ) {}

  async getProfile(userId: string) {
    return this.userModel.findById(userId).lean();
  }

  async getPortfolio(userId: string) {
    const positions = await this.positionModel.find({ userId }).lean();

    const totalPrincipal = positions.reduce(
      (s, p) => s + parseFloat(p.depositedPrincipal || '0'),
      0,
    );
    const totalYield = positions.reduce(
      (s, p) => s + parseFloat(p.accruedYield || '0'),
      0,
    );
    const liquidBalance = positions.reduce(
      (s, p) => s + parseFloat(p.liquidBalance || '0'),
      0,
    );
    const strategyPool = positions.reduce(
      (s, p) => s + parseFloat(p.strategyPoolBalance || '0'),
      0,
    );

    // Blended APY from allocation of first position (simplified)
    const alloc = positions[0]?.strategyAllocation ?? {
      guardian: 100,
      balancer: 0,
      hunter: 0,
    };
    const blendedAPY =
      (alloc.guardian * STRATEGY_APY.guardian +
        alloc.balancer * STRATEGY_APY.balancer +
        alloc.hunter * STRATEGY_APY.hunter) /
      100;

    const dailyRate = (totalPrincipal * blendedAPY) / 100 / 365;
    const perSecondRate = dailyRate / 86400;

    return {
      totalPrincipal: totalPrincipal.toFixed(6),
      totalYield: totalYield.toFixed(6),
      liquidBalance: liquidBalance.toFixed(6),
      strategyPool: strategyPool.toFixed(6),
      totalValue: (totalPrincipal + totalYield).toFixed(6),
      availableToSpend: (totalYield + liquidBalance).toFixed(6),
      blendedAPY: blendedAPY.toFixed(2),
      dailyEarnRate: dailyRate.toFixed(8),
      perSecondEarnRate: perSecondRate.toFixed(10),
      positions,
    };
  }

  async linkTelegram(
    userId: string,
    telegramId: string,
    telegramUsername: string,
  ) {
    return this.userModel.findByIdAndUpdate(
      userId,
      { telegramId, telegramUsername, telegramLinked: true },
      { new: true },
    );
  }

  async findByPlatformId(platformId: string) {
    return this.userModel.findOne({ platformId });
  }

  async findByTelegramId(telegramId: string) {
    return this.userModel.findOne({ telegramId });
  }
}
