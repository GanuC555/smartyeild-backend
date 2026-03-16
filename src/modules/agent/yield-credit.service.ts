import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Position } from '../../common/schemas/position.schema';
import { LanePosition } from '../../common/schemas/lane-position.schema';
import { OneChainService } from '../onechain/onechain.service';

/**
 * Runs every 5 minutes.
 * For each user:
 *   delta = Position.accruedYield − LanePosition.lastCreditedYield
 * If delta > MIN_CREDIT_USD:
 *   1. Update LanePosition.yieldBalance += delta
 *   2. Update LanePosition.lastCreditedYield = Position.accruedYield
 *   3. Call spend_buffer::credit_yield on-chain (admin signs)
 *
 * The MIN_CREDIT_USD threshold avoids spamming tiny on-chain txs
 * while yield is still tiny (< $0.001).
 */
const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MIN_CREDIT_USD = 0.001;       // only push to chain when delta >= $0.001

@Injectable()
export class YieldCreditService implements OnModuleInit {
  private readonly logger = new Logger(YieldCreditService.name);

  constructor(
    @InjectModel(Position.name) private positionModel: Model<Position>,
    @InjectModel(LanePosition.name) private lanePositionModel: Model<LanePosition>,
    private readonly oneChainService: OneChainService,
  ) {}

  onModuleInit() {
    // Run once at startup (catches any missed accrual), then repeat every 5 min
    setTimeout(() => this.syncAllUsers(), 10_000);
    setInterval(() => this.syncAllUsers(), INTERVAL_MS);
    this.logger.log(`Yield credit sync started (every ${INTERVAL_MS / 60_000} min, min threshold $${MIN_CREDIT_USD})`);
  }

  private async syncAllUsers() {
    try {
      // Find all LanePositions that have a walletAddress (i.e. real depositing users)
      const lanePositions = await this.lanePositionModel
        .find({ walletAddress: { $exists: true, $ne: null } })
        .lean();

      if (lanePositions.length === 0) return;

      this.logger.log(`[yield-credit] Syncing ${lanePositions.length} user(s)`);

      for (const lp of lanePositions) {
        await this.syncUser(lp);
      }
    } catch (err) {
      this.logger.error(`[yield-credit] syncAllUsers error: ${err}`);
    }
  }

  private async syncUser(lp: any) {
    const userId = lp.userId.toString();
    const walletAddress: string = lp.walletAddress;

    // Find the corresponding Position (stores accruedYield)
    const position = await this.positionModel.findOne({ userId }).lean();
    if (!position) return;

    const totalAccrued = parseFloat(position.accruedYield || '0');
    const lastCredited = Number(lp.lastCreditedYield ?? 0);
    const delta = totalAccrued - lastCredited;

    if (delta < MIN_CREDIT_USD) {
      this.logger.debug(
        `[yield-credit] user=${userId} delta=${delta.toFixed(8)} — below threshold, skipping`,
      );
      return;
    }

    this.logger.log(
      `[yield-credit] user=${userId} wallet=${walletAddress} delta=$${delta.toFixed(8)} — crediting`,
    );

    // 1. Update DB first (so dashboard reflects it even if on-chain call fails)
    const newYieldBalance = Number(lp.yieldBalance ?? 0) + delta;
    await this.lanePositionModel.findByIdAndUpdate(lp._id, {
      $set: {
        yieldBalance: newYieldBalance,
        lastCreditedYield: totalAccrued,
      },
    });

    this.logger.log(
      `[yield-credit] DB updated → yieldBalance=$${newYieldBalance.toFixed(8)} lastCreditedYield=$${totalAccrued.toFixed(8)}`,
    );

    // 2. Push to on-chain SpendBuffer (admin signs credit_yield tx)
    const result = await this.oneChainService.creditYield(walletAddress, delta);
    if (result.success) {
      this.logger.log(`[yield-credit] on-chain credit_yield SUCCESS digest=${result.digest}`);
    } else {
      // Non-fatal: DB is already updated. Log warning and move on.
      // The next run will skip this delta (lastCreditedYield already advanced).
      this.logger.warn(`[yield-credit] on-chain credit_yield FAILED (non-fatal): ${result.message}`);
    }
  }
}
