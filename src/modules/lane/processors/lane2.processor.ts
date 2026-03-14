import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LaneDecision, LaneDecisionDocument } from '../../../common/schemas/lane-decision.schema';
import { MorphoService } from '../../protocol/morpho.service';
import { PendleService } from '../../protocol/pendle.service';

@Processor('lane2-queue')
@Injectable()
export class Lane2Processor {
  private readonly logger = new Logger('Lane2Processor');

  constructor(
    @InjectModel(LaneDecision.name) private decisionModel: Model<LaneDecisionDocument>,
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

    const highRisk = utilization > 80;
    const trigger = highRisk ? 'leverage_risk' : 'routine';
    const safeMultiplier = highRisk ? 3 : 5;

    const decision = await this.decisionModel.create({
      lane: 'lane2',
      trigger,
      model: 'rule-based',
      rebalanceRequired: highRisk,
      reasoning: highRisk
        ? `Morpho utilization at ${utilization.toFixed(1)}% — above 80% threshold. Recommend reducing leverage to ${safeMultiplier}x.`
        : `Leverage health nominal. Utilization ${utilization.toFixed(1)}%, estimated APY ${(impliedAPY * safeMultiplier).toFixed(1)}% at ${safeMultiplier}x.`,
      riskAssessment: highRisk ? 'HIGH — de-lever recommended' : 'NORMAL',
      protocolMetrics: { morphoUtilization: utilization, ytImpliedAPY: impliedAPY, ptDiscount: 0, morphoBorrowRate: 0, srNusdAPY: 0, lane1Spread: 0 },
    });

    this.logger.log(`Lane 2 decision: ${trigger}, utilization=${utilization.toFixed(1)}%`);
    return decision;
  }
}
