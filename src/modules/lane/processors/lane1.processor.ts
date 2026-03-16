import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LaneDecision, LaneDecisionDocument } from '../../../common/schemas/lane-decision.schema';
import { LanePosition, LanePositionDocument } from '../../../common/schemas/lane-position.schema';
import { PendleService } from '../../protocol/pendle.service';
import { MorphoService } from '../../protocol/morpho.service';

const SPREAD_DANGER  = 2.0;   // below this → de-emphasise Lane 1
const REBALANCE_STEP = 1000;  // 10% in basis points per shift

@Processor('lane1-queue')
@Injectable()
export class Lane1Processor {
  private readonly logger = new Logger('Lane1Processor');

  constructor(
    @InjectModel(LaneDecision.name)  private decisionModel:  Model<LaneDecisionDocument>,
    @InjectModel(LanePosition.name)  private lanePositionModel: Model<LanePositionDocument>,
    private readonly pendle: PendleService,
    private readonly morpho: MorphoService,
  ) {}

  @Process('lane1-decision')
  async handleDecision(_job: Job) {
    this.logger.log('Lane 1 decision cycle starting...');

    const [ptDiscount, borrowRate, utilization] = await Promise.all([
      this.pendle.getPTDiscount('default'),
      this.morpho.getBorrowRate({} as any),
      this.morpho.getMarketUtilization({} as any),
    ]);

    const spread           = ptDiscount - borrowRate;
    const rebalanceRequired = spread < SPREAD_DANGER;
    const trigger           = rebalanceRequired ? 'spread_compression' : 'routine';

    const margin = spread - SPREAD_DANGER;
    const reasoning = rebalanceRequired
      ? `Lane 1 spread compressed to ${spread.toFixed(2)}% (PT discount ${ptDiscount.toFixed(2)}% − borrow rate ${borrowRate.toFixed(2)}%). ` +
        `Below ${SPREAD_DANGER}% threshold — rotating ${REBALANCE_STEP / 100}% from Lane 1 → Lane 3 for all users.`
      : `Lane 1 spread healthy at ${spread.toFixed(2)}% — ${margin.toFixed(2)}% above the ${SPREAD_DANGER}% danger threshold. ` +
        `PT discount ${ptDiscount.toFixed(2)}% is outpacing Morpho borrow rate ${borrowRate.toFixed(2)}%, ` +
        `generating a ${spread.toFixed(2)}% net carry on the leveraged position. ` +
        `Morpho utilization ${utilization.toFixed(1)}%${utilization > 70 ? ' — approaching elevated range, monitoring closely' : ' — well within safe range'}. ` +
        `No rebalance warranted; holding Lane 1 allocation to maximise PT arbitrage yield.`;

    // ── Execute: shift bps for all users when spread is too tight ──
    if (rebalanceRequired) {
      const positions = await this.lanePositionModel.find({
        walletAddress: { $exists: true, $ne: null },
        lane1AllocationBps: { $gt: REBALANCE_STEP },
      });
      for (const pos of positions) {
        pos.lane1AllocationBps = Math.max(1000, pos.lane1AllocationBps - REBALANCE_STEP);
        pos.lane3AllocationBps = Math.min(8000, pos.lane3AllocationBps + REBALANCE_STEP);
        await pos.save();
      }
      if (positions.length > 0) {
        this.logger.log(`[lane1] Shifted ${REBALANCE_STEP}bps from Lane1→Lane3 for ${positions.length} user(s)`);
      }
    }

    const decision = await this.decisionModel.create({
      lane: 'lane1',
      trigger,
      model: 'rule-based',
      rebalanceRequired,
      reasoning,
      riskAssessment: utilization > 80 ? 'HIGH — Morpho utilization above 80%' : 'NORMAL',
      protocolMetrics: {
        ptDiscount,
        morphoBorrowRate: borrowRate,
        morphoUtilization: utilization,
        lane1Spread: spread,
        ytImpliedAPY: 0,
        srNusdAPY: 0,
      },
    });

    this.logger.log(`Lane 1 → ${trigger}, spread=${spread.toFixed(2)}%`);
    return decision;
  }
}
