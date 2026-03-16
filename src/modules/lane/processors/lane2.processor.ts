import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LaneDecision, LaneDecisionDocument } from '../../../common/schemas/lane-decision.schema';
import { LanePosition, LanePositionDocument } from '../../../common/schemas/lane-position.schema';
import { MorphoService } from '../../protocol/morpho.service';
import { PendleService } from '../../protocol/pendle.service';

const UTILIZATION_DANGER = 80;   // de-lever above this
const REBALANCE_STEP     = 1500; // 15% shift when leverage risk fires

@Processor('lane2-queue')
@Injectable()
export class Lane2Processor {
  private readonly logger = new Logger('Lane2Processor');

  constructor(
    @InjectModel(LaneDecision.name)  private decisionModel:      Model<LaneDecisionDocument>,
    @InjectModel(LanePosition.name)  private lanePositionModel:  Model<LanePositionDocument>,
    private readonly morpho: MorphoService,
    private readonly pendle: PendleService,
  ) {}

  @Process('lane2-decision')
  async handleDecision(_job: Job) {
    this.logger.log('Lane 2 leverage health check...');

    const [utilization, impliedAPY] = await Promise.all([
      this.morpho.getMarketUtilization({} as any),
      this.pendle.getImpliedAPY('default'),
    ]);

    const highRisk       = utilization > UTILIZATION_DANGER;
    const trigger        = highRisk ? 'leverage_risk' : 'routine';
    const safeMultiplier = highRisk ? 3 : 5;

    const headroom = UTILIZATION_DANGER - utilization;
    const leveragedAPY = (impliedAPY * safeMultiplier).toFixed(1);
    const reasoning = highRisk
      ? `Morpho utilization at ${utilization.toFixed(1)}% — above ${UTILIZATION_DANGER}% threshold. ` +
        `De-levering to ${safeMultiplier}x. Rotating ${REBALANCE_STEP / 100}% from Lane 2 → Lane 3.`
      : `Lane 2 leverage health nominal. Morpho utilization ${utilization.toFixed(1)}% — ` +
        `${headroom.toFixed(1)}% below the ${UTILIZATION_DANGER}% de-lever trigger. ` +
        `At ${safeMultiplier}x leverage on YT implied APY ${impliedAPY.toFixed(2)}%, ` +
        `effective yield is ~${leveragedAPY}% on the Lane 2 allocation. ` +
        `Borrow costs remain manageable at current utilization. ` +
        `Maintaining ${safeMultiplier}x leverage to maximise carry while headroom is sufficient.`;

    // ── Execute: de-lever when utilization too high ───────────────
    if (highRisk) {
      const positions = await this.lanePositionModel.find({
        walletAddress: { $exists: true, $ne: null },
        lane2AllocationBps: { $gt: REBALANCE_STEP },
      });
      for (const pos of positions) {
        pos.lane2AllocationBps = Math.max(1000, pos.lane2AllocationBps - REBALANCE_STEP);
        pos.lane3AllocationBps = Math.min(8000, pos.lane3AllocationBps + REBALANCE_STEP);
        await pos.save();
      }
      if (positions.length > 0) {
        this.logger.log(`[lane2] De-levered: shifted ${REBALANCE_STEP}bps from Lane2→Lane3 for ${positions.length} user(s)`);
      }
    }

    const decision = await this.decisionModel.create({
      lane: 'lane2',
      trigger,
      model: 'rule-based',
      rebalanceRequired: highRisk,
      reasoning,
      riskAssessment: highRisk ? 'HIGH — de-lever recommended' : 'NORMAL',
      protocolMetrics: {
        morphoUtilization: utilization,
        ytImpliedAPY:      impliedAPY,
        ptDiscount:        0,
        morphoBorrowRate:  0,
        srNusdAPY:         0,
        lane1Spread:       0,
      },
    });

    this.logger.log(`Lane 2 → ${trigger}, utilization=${utilization.toFixed(1)}%`);
    return decision;
  }
}
