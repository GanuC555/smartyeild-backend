import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LanePosition } from '../../common/schemas/lane-position.schema';
import { OneChainService } from '../onechain/onechain.service';

/**
 * Runs every 5 minutes.
 *
 * For each user with a walletAddress:
 *   1. Read vault.yield_reserve (total on-chain yield pool) — real MOCK_USD
 *   2. Read vault.total_deposits (denominator for YST proportional share)
 *   3. Read user's YST balance on-chain
 *   4. Compute: userShare = (userYST / totalDeposits) * yieldReserve
 *   5. delta = userShare - lastCreditedYield
 *   6. If delta >= MIN_CREDIT_USD:
 *      a. Update LanePosition.yieldBalance += delta in MongoDB (optimistic UI)
 *      b. Update LanePosition.lastCreditedYield = userShare
 *      c. Call spend_buffer::credit_yield on-chain (admin signs)
 *
 * Source of yield: vault.yield_reserve — filled by YieldHarvestService
 * (simulate_trading_fees → harvest_dex_yield every 5 min).
 * No longer reads simulated Position.accruedYield from MongoDB.
 */
const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MIN_CREDIT_USD = 0.0005;       // only push to chain when delta >= $0.001
const MOCK_USD_DECIMALS = 1_000_000; // 6 decimal places

@Injectable()
export class YieldCreditService implements OnModuleInit {
  private readonly logger = new Logger(YieldCreditService.name);

  constructor(
    @InjectModel(LanePosition.name) private lanePositionModel: Model<LanePosition>,
    private readonly oneChainService: OneChainService,
  ) {}

  onModuleInit() {
    // Run once at startup (catches any missed accrual), then repeat every 5 min
    setTimeout(() => this.syncAllUsers(), 10_000);
    setInterval(() => this.syncAllUsers(), INTERVAL_MS);
    this.logger.log(
      `YieldCreditService started — on-chain mode ` +
      `(every ${INTERVAL_MS / 60_000} min, min threshold $${MIN_CREDIT_USD})`,
    );
  }

  private async syncAllUsers() {
    try {
      const lanePositions = await this.lanePositionModel
        .find({ walletAddress: { $exists: true, $ne: null } })
        .lean();

      if (lanePositions.length === 0) return;

      this.logger.log(`[yield-credit] Syncing ${lanePositions.length} user(s) from on-chain yield_reserve`);

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

    if (!walletAddress) {
      this.logger.debug(`[yield-credit] user=${userId} has no walletAddress — skipping`);
      return;
    }

    // ── Read on-chain state in parallel ─────────────────────────────────────
    let yieldReserveRaw: bigint;
    let totalDepositsRaw: bigint;
    let userYstRaw: bigint;

    try {
      [yieldReserveRaw, totalDepositsRaw, userYstRaw] = await Promise.all([
        this.oneChainService.getVaultYieldReserve(),
        this.oneChainService.getTotalDeposits(),
        this.oneChainService.getUserYstBalance(walletAddress),
      ]);
    } catch (err) {
      this.logger.warn(`[yield-credit] on-chain reads failed for user=${userId}: ${err}`);
      return;
    }

    if (totalDepositsRaw === 0n || yieldReserveRaw === 0n || userYstRaw === 0n) {
      this.logger.debug(
        `[yield-credit] user=${userId} — nothing to credit ` +
        `(yieldReserve=${yieldReserveRaw} totalDeposits=${totalDepositsRaw} userYST=${userYstRaw})`,
      );
      return;
    }

    // ── Compute user's proportional share ────────────────────────────────────
    // share (base units) = (userYST / totalDeposits) × yieldReserve
    // All BigInt values are in MOCK_USD base units (6 decimals)
    const userShareBaseUnits = (userYstRaw * yieldReserveRaw) / totalDepositsRaw;
    const totalAccruedUsd = Number(userShareBaseUnits) / MOCK_USD_DECIMALS;

    const lastCredited = Number(lp.lastCreditedYield ?? 0);
    const delta = totalAccruedUsd - lastCredited;

    if (delta < MIN_CREDIT_USD) {
      this.logger.debug(
        `[yield-credit] user=${userId} delta=${delta.toFixed(8)} — below threshold, skipping`,
      );
      return;
    }

    this.logger.log(
      `[yield-credit] user=${userId} wallet=${walletAddress} | ` +
      `yieldReserve=${(Number(yieldReserveRaw) / MOCK_USD_DECIMALS).toFixed(6)} USD | ` +
      `userYST=${(Number(userYstRaw) / MOCK_USD_DECIMALS).toFixed(2)} | ` +
      `totalDeposits=${(Number(totalDepositsRaw) / MOCK_USD_DECIMALS).toFixed(2)} | ` +
      `share=${totalAccruedUsd.toFixed(6)} | lastCredited=${lastCredited.toFixed(6)} | delta=${delta.toFixed(8)}`,
    );

    // ── 1. Update DB first (dashboard reflects it even if on-chain call fails) ─
    const newYieldBalance = Number(lp.yieldBalance ?? 0) + delta;
    await this.lanePositionModel.findByIdAndUpdate(lp._id, {
      $set: {
        yieldBalance: newYieldBalance,
        lastCreditedYield: totalAccruedUsd,
      },
    });

    this.logger.log(
      `[yield-credit] DB updated → yieldBalance=${newYieldBalance.toFixed(8)} lastCreditedYield=${totalAccruedUsd.toFixed(8)}`,
    );

    // ── 2. Push to on-chain SpendBuffer ──────────────────────────────────────
    const result = await this.oneChainService.creditYield(walletAddress, delta);
    if (result.success) {
      this.logger.log(`[yield-credit] credit_yield on-chain SUCCESS digest=${result.digest}`);
    } else {
      // Non-fatal: DB is already updated. lastCreditedYield has advanced,
      // so the next run won't double-credit this delta.
      this.logger.warn(`[yield-credit] credit_yield on-chain FAILED (non-fatal): ${result.message}`);
    }
  }
}
