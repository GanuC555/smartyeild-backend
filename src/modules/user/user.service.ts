import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../../common/schemas/user.schema';
import { Position } from '../../common/schemas/position.schema';
import { Transaction } from '../../common/schemas/transaction.schema';
import { LanePosition } from '../../common/schemas/lane-position.schema';
import { MarketSimulatorService } from '../../common/market/market-simulator.service';

// APY per strategy for blended rate calculation
const STRATEGY_APY = { guardian: 6.2, balancer: 12.8, hunter: 24.7 };

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Position.name) private positionModel: Model<Position>,
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
    @InjectModel(LanePosition.name) private lanePositionModel: Model<LanePosition>,
    private readonly market: MarketSimulatorService,
  ) {}

  async getProfile(userId: string) {
    return this.userModel.findById(userId).lean();
  }

  async getPortfolio(userId: string) {
    const positions = await this.positionModel.find({ userId }).lean();
    const lanePos = await this.lanePositionModel.findOne({ userId: new Types.ObjectId(userId) }).lean();

    // ── Position-level aggregates (two-pool architecture) ─────────────────
    const totalPrincipal = positions.reduce(
      (s, p) => s + parseFloat(p.depositedPrincipal || '0'),
      0,
    );
    const totalYield = positions.reduce(
      (s, p) => s + parseFloat(p.accruedYield || '0'),
      0,
    );
    // liquidBalance & strategyPool here represent the two-pool split (50/50)
    const twoPoolLiquid = positions.reduce(
      (s, p) => s + parseFloat(p.liquidBalance || '0'),
      0,
    );
    const strategyPool = positions.reduce(
      (s, p) => s + parseFloat(p.strategyPoolBalance || '0'),
      0,
    );

    // ── LanePosition: actual spendable advance (70% LTV) ─────────────────
    // yieldBalance = yield credited to spend layer
    // liquidBalance = advance credit (70% of deposit)
    const laneYield = Number(lanePos?.yieldBalance ?? 0);
    const laneAdvance = Number(lanePos?.liquidBalance ?? 0);
    const availableToSpend = laneYield + laneAdvance;

    // ── Blended APY from allocation of first position ─────────────────────
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

    // Lane-inclusive APY: liquid pool (50% of principal) earns via lane strategies
    // Lane 1: spread (PT discount), Lane 2: 5x leverage on spread, Lane 3: srNUSD
    // Default split 40/40/20 bps across lanes
    const ms = this.market.getState();
    const lane1APY = Math.max(0, ms.lane1Spread);
    const lane2APY = Math.max(0, ms.lane1Spread * 5);
    const lane3APY = ms.srNusdAPY;
    const laneBlendedAPY = 0.40 * lane1APY + 0.40 * lane2APY + 0.20 * lane3APY;

    // Effective APY: 50% of principal in strategy pool + 50% in liquid pool (lanes)
    const effectiveAPY = 0.5 * blendedAPY + 0.5 * laneBlendedAPY;

    const dailyRate = (totalPrincipal * effectiveAPY) / 100 / 365;
    const perSecondRate = dailyRate / 86400;

    return {
      totalPrincipal: totalPrincipal.toFixed(6),
      totalYield: totalYield.toFixed(6),
      // two-pool breakdown shown in TwoPoolVisual
      liquidBalance: twoPoolLiquid.toFixed(6),
      strategyPool: strategyPool.toFixed(6),
      totalValue: (totalPrincipal + totalYield).toFixed(6),
      // availableToSpend = real spend advance (LanePosition), NOT two-pool liquid
      availableToSpend: availableToSpend.toFixed(6),
      blendedAPY: effectiveAPY.toFixed(2),
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
