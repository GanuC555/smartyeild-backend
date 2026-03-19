import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Position } from '../../common/schemas/position.schema';
import { MarketSimulatorService } from '../../common/market/market-simulator.service';

/**
 * Accrues yield every 30s using the live market state from MarketSimulatorService.
 * Each position earns yield proportional to its strategy allocation and
 * the current market-driven APY for that strategy — so when an agent
 * rebalances (e.g. Hunter shifts into OnePredice), the yield rate changes
 * on the very next tick.
 *
 * Lane contribution (for users with lane allocations) is computed using
 * lane-weighted protocol APYs:
 *   Lane 1: ptDiscount - morphoBorrowRate  (spread)
 *   Lane 2: spread × 5  (leveraged)
 *   Lane 3: srNusdAPY   (YT streaming)
 */
const TICKS_PER_YEAR = 365 * 24 * 120; // 30-second intervals in a year

@Injectable()
export class DemoYieldService implements OnModuleInit {
  private readonly logger = new Logger('DemoYieldService');

  constructor(
    @InjectModel(Position.name) private positionModel: Model<Position>,
    private readonly market: MarketSimulatorService,
  ) {}

  onModuleInit() {
    // Disabled: yield accrual is now driven by on-chain vault.yield_reserve via:
    //   YieldHarvestService → simulate_trading_fees + harvest_dex_yield (every 5 min)
    //   YieldCreditService  → reads vault.yield_reserve, calls credit_yield per user (every 5 min)
    // DemoYieldService's simulated MongoDB writes to Position.accruedYield are no longer consumed.
    this.logger.log('DemoYieldService: DISABLED — on-chain yield harvesting is active');
  }

  private async accrueYield() {
    const ms        = this.market.getState();
    const positions = await this.positionModel.find({ status: 'active' });

    for (const pos of positions) {
      const principal = parseFloat(pos.depositedPrincipal || '0');
      if (principal <= 0) continue;

      const stratPool = parseFloat(pos.strategyPoolBalance || '0');
      const alloc = pos.strategyAllocation || { guardian: 100, balancer: 0, hunter: 0 };

      // ── Strategy-pool yield ────────────────────────────────────────────
      // Each strategy slice earns its current market APY (updated by agents)
      const guardianCapital = stratPool * (alloc.guardian / 100);
      const balancerCapital = stratPool * (alloc.balancer / 100);
      const hunterCapital   = stratPool * (alloc.hunter   / 100);

      const strategyYieldSlice =
        (guardianCapital * ms.guardianAPY / 100 +
         balancerCapital * ms.balancerAPY / 100 +
         hunterCapital   * ms.hunterAPY   / 100) / TICKS_PER_YEAR;

      // ── Lane-layer yield (on liquid pool via Pendle/Morpho lanes) ──────
      // Use the lane allocation bps if set (default 0 = no lane overlay)
      // This is additive — the liquid pool itself earns via lane strategies
      // Lane 1 spread (fixed):   ptDiscount - morphoBorrowRate
      // Lane 2 leveraged (5x):   spread × 5
      // Lane 3 YT streaming:     srNusdAPY
      const liquidPool = parseFloat(pos.liquidBalance || '0');
      const lane1APY   = Math.max(0, ms.lane1Spread);
      const lane2APY   = Math.max(0, ms.lane1Spread * 5);
      const lane3APY   = ms.srNusdAPY;

      // Default lane split (40/40/20) when no explicit user allocation
      const laneYieldSlice =
        (liquidPool * 0.40 * lane1APY / 100 +
         liquidPool * 0.40 * lane2APY / 100 +
         liquidPool * 0.20 * lane3APY / 100) / TICKS_PER_YEAR;

      const totalSlice = strategyYieldSlice + laneYieldSlice;

      pos.accruedYield = (
        parseFloat(pos.accruedYield || '0') + totalSlice
      ).toFixed(8);

      await pos.save();
    }

    if (positions.length > 0) {
      const ms2 = this.market.getState();
      this.logger.debug(
        `[yield-tick] ${positions.length} position(s) | ` +
        `G=${ms2.guardianAPY.toFixed(2)}% B=${ms2.balancerAPY.toFixed(2)}% H=${ms2.hunterAPY.toFixed(2)}% ` +
        `Lane1spread=${ms2.lane1Spread.toFixed(2)}%`,
      );
    }
  }
}
