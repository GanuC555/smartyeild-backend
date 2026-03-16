import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MarketSnapshot, MarketSnapshotDocument } from '../schemas/market-snapshot.schema';

/**
 * Shared market state for the testnet simulation.
 * All stub adapters read from here so every service sees the SAME coherent market.
 * Values drift realistically using a clamped random walk — no independent noise.
 *
 * Updated every 15 minutes. Persisted to MongoDB so the frontend/API can also
 * read the latest snapshot.
 */

export interface InternalAllocation {
  guardian:  { sUSDS: number; naviUSDC: number; idle: number };
  balancer:  { sUSDS: number; oneDexStable: number; idle: number };
  hunter:    { oneDexVolatile: number; onePredice: number; idle: number };
}

export interface MarketState {
  // ── Protocol metrics ──────────────────────────────────────────────
  srNusdAPY:          number;   // 4 – 7 %  (Strata)
  ptDiscount:         number;   // 8 – 14 % (Pendle — = ytImpliedAPY)
  ytImpliedAPY:       number;   // same as ptDiscount
  morphoBorrowRate:   number;   // 3 – 6 %
  morphoUtilization:  number;   // 45 – 85 %
  lane1Spread:        number;   // ptDiscount − morphoBorrowRate

  // ── DEX / prediction ─────────────────────────────────────────────
  oneDexStableAPY:    number;   // 8 – 15 %
  oneDexVolatileAPY:  number;   // 20 – 40 %
  openMarkets:        number;   // 2 – 8
  highConfMarkets:    number;   // 0 – 3

  // ── Derived strategy APYs (used by DemoYieldService) ─────────────
  guardianAPY:  number;
  balancerAPY:  number;
  hunterAPY:    number;

  // ── Internal protocol allocations (updated by agents) ────────────
  alloc: InternalAllocation;

  updatedAt: Date;
}

// ── Initial state (sensible testnet defaults) ─────────────────────
const INITIAL_STATE: Omit<MarketState, 'guardianAPY' | 'balancerAPY' | 'hunterAPY' | 'lane1Spread' | 'updatedAt'> = {
  srNusdAPY:          6.5,
  ptDiscount:         11.0,
  ytImpliedAPY:       11.0,
  morphoBorrowRate:   4.5,
  morphoUtilization:  58.0,
  oneDexStableAPY:    11.4,
  oneDexVolatileAPY:  28.3,
  openMarkets:        4,
  highConfMarkets:    1,
  alloc: {
    guardian: { sUSDS: 60, naviUSDC: 20, idle: 20 },
    balancer: { sUSDS: 30, oneDexStable: 50, idle: 20 },
    hunter:   { oneDexVolatile: 50, onePredice: 35, idle: 15 },
  },
};

// How much each metric drifts per 15-min tick (σ)
const DRIFT = {
  srNusdAPY:         0.08,
  ptDiscount:        0.25,
  morphoBorrowRate:  0.15,
  morphoUtilization: 2.0,
  oneDexStableAPY:   0.4,
  oneDexVolatileAPY: 1.2,
};

// Hard clamps
const CLAMP = {
  srNusdAPY:         [4.0,   7.0],
  ptDiscount:        [8.0,  14.0],
  morphoBorrowRate:  [3.0,   6.0],
  morphoUtilization: [45.0, 85.0],
  oneDexStableAPY:   [8.0,  15.0],
  oneDexVolatileAPY: [20.0, 40.0],
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
function drift(current: number, sigma: number, min: number, max: number): number {
  // Mean-reverting: nudge slightly towards midpoint to avoid stuck at extremes
  const mid = (min + max) / 2;
  const reversion = (mid - current) * 0.05;
  const noise = (Math.random() - 0.5) * 2 * sigma;
  return clamp(current + reversion + noise, min, max);
}

// ── Derive strategy APYs from protocol metrics + internal allocs ──
function computeStrategyAPYs(s: Omit<MarketState, 'guardianAPY' | 'balancerAPY' | 'hunterAPY' | 'lane1Spread' | 'updatedAt'>) {
  // Navi lend APY rises with utilization
  const naviLendAPY = 4.0 + (s.morphoUtilization - 45) * 0.08;

  const guardianAPY =
    (s.alloc.guardian.sUSDS    * s.srNusdAPY     +
     s.alloc.guardian.naviUSDC * naviLendAPY) / 100;

  const balancerAPY =
    (s.alloc.balancer.sUSDS       * s.srNusdAPY        +
     s.alloc.balancer.oneDexStable * s.oneDexStableAPY) / 100;

  // OnePredice base yield = volatile APY × 0.6 (market maker discount)
  const onePrediceAPY = s.oneDexVolatileAPY * 0.6 + s.highConfMarkets * 2.5;
  const hunterAPY =
    (s.alloc.hunter.oneDexVolatile * s.oneDexVolatileAPY +
     s.alloc.hunter.onePredice     * onePrediceAPY) / 100;

  return {
    guardianAPY: parseFloat(guardianAPY.toFixed(4)),
    balancerAPY: parseFloat(balancerAPY.toFixed(4)),
    hunterAPY:   parseFloat(hunterAPY.toFixed(4)),
  };
}

@Injectable()
export class MarketSimulatorService implements OnModuleInit {
  private readonly logger = new Logger(MarketSimulatorService.name);
  private state: MarketState;

  constructor(
    @InjectModel(MarketSnapshot.name)
    private snapshotModel: Model<MarketSnapshotDocument>,
  ) {}

  async onModuleInit() {
    // Restore last snapshot or start fresh
    const last = await this.snapshotModel.findOne().sort({ snapshotAt: -1 }).lean();
    if (last && last.ptDiscount > 0) {
      this.state = this.buildStateFrom(last as any);
      this.logger.log(`Market state restored from DB: PT=${last.ptDiscount}% util=${last.morphoUtilization}%`);
    } else {
      this.state = this.buildInitialState();
      this.logger.log('Market state initialised from defaults');
    }

    // Update every 15 minutes
    setInterval(() => this.tick(), 15 * 60 * 1000);
    // Also persist current state immediately
    await this.persist();
  }

  getState(): MarketState {
    return this.state ?? this.buildInitialState();
  }

  /** Called by agents after a rebalance decision to shift internal protocol alloc */
  updateInternalAllocation(
    strategy: 'guardian' | 'balancer' | 'hunter',
    newAlloc: Record<string, number>,
  ) {
    this.state.alloc[strategy] = newAlloc as any;
    const apy = computeStrategyAPYs(this.state);
    this.state.guardianAPY = apy.guardianAPY;
    this.state.balancerAPY = apy.balancerAPY;
    this.state.hunterAPY   = apy.hunterAPY;
    this.logger.log(
      `[market] ${strategy} alloc updated → APY now ${apy[`${strategy}APY`].toFixed(2)}%`,
    );
  }

  private async tick() {
    const s = this.state;

    // Drift all base metrics
    s.srNusdAPY         = drift(s.srNusdAPY,         DRIFT.srNusdAPY,         ...CLAMP.srNusdAPY as [number,number]);
    s.ptDiscount        = drift(s.ptDiscount,        DRIFT.ptDiscount,        ...CLAMP.ptDiscount as [number,number]);
    s.ytImpliedAPY      = s.ptDiscount; // correlated
    s.morphoBorrowRate  = drift(s.morphoBorrowRate,  DRIFT.morphoBorrowRate,  ...CLAMP.morphoBorrowRate as [number,number]);
    s.morphoUtilization = drift(s.morphoUtilization, DRIFT.morphoUtilization, ...CLAMP.morphoUtilization as [number,number]);
    s.oneDexStableAPY   = drift(s.oneDexStableAPY,   DRIFT.oneDexStableAPY,   ...CLAMP.oneDexStableAPY as [number,number]);
    s.oneDexVolatileAPY = drift(s.oneDexVolatileAPY, DRIFT.oneDexVolatileAPY, ...CLAMP.oneDexVolatileAPY as [number,number]);

    // Borrow rate is loosely correlated with utilization
    s.morphoBorrowRate = clamp(
      s.morphoBorrowRate + (s.morphoUtilization - 60) * 0.01,
      3.0, 6.0,
    );

    s.lane1Spread = parseFloat((s.ptDiscount - s.morphoBorrowRate).toFixed(3));

    // Prediction market randomness (discrete)
    s.openMarkets    = Math.max(2, Math.min(8, s.openMarkets    + (Math.random() > 0.7 ? 1 : Math.random() > 0.6 ? -1 : 0)));
    s.highConfMarkets = Math.max(0, Math.min(3, s.highConfMarkets + (Math.random() > 0.75 ? 1 : Math.random() > 0.6 ? -1 : 0)));

    // Recompute derived APYs
    const apy = computeStrategyAPYs(s);
    s.guardianAPY = apy.guardianAPY;
    s.balancerAPY = apy.balancerAPY;
    s.hunterAPY   = apy.hunterAPY;
    s.updatedAt   = new Date();

    this.logger.log(
      `[market-tick] PT=${s.ptDiscount.toFixed(2)}% util=${s.morphoUtilization.toFixed(1)}% ` +
      `spread=${s.lane1Spread.toFixed(2)}% | G=${s.guardianAPY.toFixed(2)}% B=${s.balancerAPY.toFixed(2)}% H=${s.hunterAPY.toFixed(2)}%`,
    );

    await this.persist();
  }

  private async persist() {
    const s = this.state;
    await this.snapshotModel.create({
      snapshotAt:        new Date(),
      ptDiscount:        s.ptDiscount,
      ytImpliedAPY:      s.ytImpliedAPY,
      srNusdAPY:         s.srNusdAPY,
      morphoBorrowRate:  s.morphoBorrowRate,
      morphoUtilization: s.morphoUtilization,
      lane1Spread:       s.lane1Spread,
      lane2LeverageAPY:  s.ptDiscount * 5,
    });
  }

  private buildInitialState(): MarketState {
    const base = { ...INITIAL_STATE };
    const apy  = computeStrategyAPYs(base);
    return {
      ...base,
      ...apy,
      lane1Spread: parseFloat((base.ptDiscount - base.morphoBorrowRate).toFixed(3)),
      updatedAt: new Date(),
    };
  }

  private buildStateFrom(snap: Partial<MarketSnapshot>): MarketState {
    const base = {
      ...INITIAL_STATE,
      srNusdAPY:         snap.srNusdAPY         ?? INITIAL_STATE.srNusdAPY,
      ptDiscount:        snap.ptDiscount        ?? INITIAL_STATE.ptDiscount,
      ytImpliedAPY:      snap.ytImpliedAPY      ?? INITIAL_STATE.ytImpliedAPY,
      morphoBorrowRate:  snap.morphoBorrowRate  ?? INITIAL_STATE.morphoBorrowRate,
      morphoUtilization: snap.morphoUtilization ?? INITIAL_STATE.morphoUtilization,
    };
    const apy = computeStrategyAPYs(base);
    return {
      ...base,
      ...apy,
      lane1Spread: parseFloat((base.ptDiscount - base.morphoBorrowRate).toFixed(3)),
      updatedAt: new Date(),
    };
  }
}
