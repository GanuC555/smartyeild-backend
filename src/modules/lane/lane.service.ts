import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LanePosition, LanePositionDocument } from '../../common/schemas/lane-position.schema';
import { LaneDecision, LaneDecisionDocument } from '../../common/schemas/lane-decision.schema';
import { MarketSnapshot, MarketSnapshotDocument } from '../../common/schemas/market-snapshot.schema';
import { MarketSimulatorService } from '../../common/market/market-simulator.service';
import { PendleService } from '../protocol/pendle.service';
import { MorphoService } from '../protocol/morpho.service';
import { StrataService } from '../protocol/strata.service';
import { OneChainAdapterService } from '../../adapters/onechain/OneChainAdapterService';

@Injectable()
export class LaneService implements OnModuleInit {
  private readonly logger = new Logger('LaneService');

  constructor(
    @InjectModel(LanePosition.name) private lanePositionModel: Model<LanePositionDocument>,
    @InjectModel(LaneDecision.name) private laneDecisionModel: Model<LaneDecisionDocument>,
    @InjectModel(MarketSnapshot.name) private marketSnapshotModel: Model<MarketSnapshotDocument>,
    private readonly pendle: PendleService,
    private readonly morpho: MorphoService,
    private readonly strata: StrataService,
    private readonly oneChainAdapter: OneChainAdapterService,
    private readonly market: MarketSimulatorService,
    @InjectQueue('lane1-queue') private lane1Queue: Queue,
    @InjectQueue('lane2-queue') private lane2Queue: Queue,
    @InjectQueue('lane3-queue') private lane3Queue: Queue,
  ) {}

  onModuleInit() {
    // Lane 1 — check spread every 15 min (spread_compression is time-sensitive)
    this.lane1Queue
      .add('lane1-decision', {}, { repeat: { every: 15 * 60 * 1000 }, removeOnComplete: 10 })
      .catch(() => {});
    // Lane 2 — check leverage/utilization every 30 min
    this.lane2Queue
      .add('lane2-decision', {}, { repeat: { every: 30 * 60 * 1000 }, removeOnComplete: 10 })
      .catch(() => {});
    // Lane 3 — check YT APY every hour
    this.lane3Queue
      .add('lane3-decision', {}, { repeat: { every: 60 * 60 * 1000 }, removeOnComplete: 10 })
      .catch(() => {});

    // Trigger one immediate run on startup so the collection is populated right away
    this.lane1Queue.add('lane1-decision', {}, { removeOnComplete: 10 }).catch(() => {});
    this.lane2Queue.add('lane2-decision', {}, { removeOnComplete: 10 }).catch(() => {});
    this.lane3Queue.add('lane3-decision', {}, { removeOnComplete: 10 }).catch(() => {});

    this.logger.log('Lane schedulers: Lane1(15m) | Lane2(30m) | Lane3(1h) — immediate run queued');
  }

  async getLaneDefinitions() {
    const [ptDiscount, impliedAPY, borrowRate, utilization, srNusdAPY] = await Promise.all([
      this.pendle.getPTDiscount('default'),
      this.pendle.getImpliedAPY('default'),
      this.morpho.getBorrowRate({} as any),
      this.morpho.getMarketUtilization({} as any),
      this.strata.getCurrentAPY(),
    ]);

    return [
      {
        id: 'lane1',
        name: 'Lane 1 — Fixed Advance',
        description: 'Borrow USDC against PT for immediate spending. Repaid at maturity.',
        ptDiscount,
        impliedAPY,
        borrowRate,
        spread: ptDiscount - borrowRate,
        targetAPY: `${(ptDiscount - borrowRate).toFixed(1)}%`,
        riskLevel: 'low',
        spendAccess: 'Immediate (day-1 advance)',
      },
      {
        id: 'lane2',
        name: 'Lane 2 — Leveraged Fixed',
        description: '5-7x leveraged PT position for amplified fixed yield.',
        impliedAPY,
        leverageMultiplier: 5,
        estimatedAPY: `${(impliedAPY * 5).toFixed(1)}%`,
        morphoUtilization: utilization,
        riskLevel: 'medium',
        spendAccess: 'At maturity',
      },
      {
        id: 'lane3',
        name: 'Lane 3 — Yield Streaming',
        description: 'Hold YT for streaming floating yield. Rolls automatically.',
        ytImpliedAPY: impliedAPY,
        srNusdAPY,
        riskLevel: 'low-medium',
        spendAccess: 'Ongoing (daily yield credits)',
      },
    ];
  }

  async getUserAllocation(userId: string, walletAddress?: string) {
    const allocation = await this.lanePositionModel.findOne({ userId: new Types.ObjectId(userId) });

    let onChainPosition: {
      depositAmount: string;
      seniorBps: number;
      juniorBps: number;
      maturityMs: number;
      advanceAmount: string;
      frtMinted: string;
      ystMinted: string;
      depositedAtMs: number;
    } | null = null;

    const addressToUse = walletAddress ?? allocation?.walletAddress;
    if (addressToUse) {
      try {
        const pos = await this.oneChainAdapter.getVaultPosition(addressToUse);
        if (pos) {
          onChainPosition = {
            depositAmount: pos.depositAmount.toString(),
            seniorBps: pos.seniorBps,
            juniorBps: pos.juniorBps,
            maturityMs: pos.maturityMs,
            advanceAmount: pos.advanceAmount.toString(),
            frtMinted: pos.frtMinted.toString(),
            ystMinted: pos.ystMinted.toString(),
            depositedAtMs: pos.depositedAtMs,
          };
        }
      } catch {
        // on-chain read is best-effort
      }
    }

    return { allocation, onChainPosition };
  }

  async setUserAllocation(userId: string, walletAddress: string, lane1Bps: number, lane2Bps: number, lane3Bps: number) {
    if (lane1Bps + lane2Bps + lane3Bps !== 10000) {
      throw new Error('Lane allocations must sum to 10000 bps');
    }
    return this.lanePositionModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $set: { lane1AllocationBps: lane1Bps, lane2AllocationBps: lane2Bps, lane3AllocationBps: lane3Bps, walletAddress: walletAddress.toLowerCase() } },
      { upsert: true, new: true },
    );
  }

  async getLaneDecisions(lane: string, limit = 10) {
    return this.laneDecisionModel.find({ lane }).sort({ createdAt: -1 }).limit(limit);
  }

  async saveMarketSnapshot(metrics: Partial<MarketSnapshot>) {
    return this.marketSnapshotModel.create({ ...metrics, snapshotAt: new Date() });
  }

  getLatestMarketSnapshot() {
    // Return the live in-memory state for the orchestrator's tool call
    return Promise.resolve(this.market.getState());
  }
}
