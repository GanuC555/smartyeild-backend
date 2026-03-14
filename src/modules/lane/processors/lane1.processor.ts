import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LaneDecision, LaneDecisionDocument } from '../../../common/schemas/lane-decision.schema';
import { PendleService } from '../../protocol/pendle.service';
import { MorphoService } from '../../protocol/morpho.service';

@Processor('lane1-queue')
@Injectable()
export class Lane1Processor {
  private readonly logger = new Logger('Lane1Processor');

  constructor(
    @InjectModel(LaneDecision.name) private decisionModel: Model<LaneDecisionDocument>,
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

    const spread = ptDiscount - borrowRate;
    const rebalanceRequired = spread < 2.0;
    const trigger = rebalanceRequired ? 'spread_compression' : 'routine';

    const decision = await this.decisionModel.create({
      lane: 'lane1',
      trigger,
      model: 'rule-based',
      rebalanceRequired,
      reasoning: rebalanceRequired
        ? `Lane 1 spread compressed to ${spread.toFixed(2)}% (PT discount ${ptDiscount}% - borrow rate ${borrowRate}%). Recommend reducing Lane 1 allocation.`
        : `Lane 1 spread healthy at ${spread.toFixed(2)}%. No action needed.`,
      riskAssessment: utilization > 80 ? 'HIGH — Morpho utilization above 80%' : 'NORMAL',
      protocolMetrics: { ptDiscount, morphoBorrowRate: borrowRate, morphoUtilization: utilization, lane1Spread: spread, ytImpliedAPY: 0, srNusdAPY: 0 },
    });

    this.logger.log(`Lane 1 decision: ${trigger}, spread=${spread.toFixed(2)}%`);
    return decision;
  }
}
