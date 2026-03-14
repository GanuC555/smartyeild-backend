import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LaneDecision, LaneDecisionDocument } from '../../../common/schemas/lane-decision.schema';
import { LanePosition, LanePositionDocument } from '../../../common/schemas/lane-position.schema';
import { PendleService } from '../../protocol/pendle.service';
import { StrataService } from '../../protocol/strata.service';

@Processor('lane3-queue')
@Injectable()
export class Lane3Processor {
  private readonly logger = new Logger('Lane3Processor');

  constructor(
    @InjectModel(LaneDecision.name) private decisionModel: Model<LaneDecisionDocument>,
    @InjectModel(LanePosition.name) private positionModel: Model<LanePositionDocument>,
    private readonly pendle: PendleService,
    private readonly strata: StrataService,
  ) {}

  @Process('lane3-decision')
  async handleDecision(_job: Job) {
    this.logger.log('Lane 3 YT monitor running...');

    const [impliedAPY, maturity, srNusdAPY] = await Promise.all([
      this.pendle.getImpliedAPY('default'),
      this.pendle.getMarketMaturity('default'),
      this.strata.getCurrentAPY(),
    ]);

    const daysToMaturity = Math.floor((maturity.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const needsRoll = daysToMaturity < 7;

    let trigger: string;
    let reasoning: string;

    if (needsRoll) {
      trigger = 'yt_roll';
      reasoning = `YT maturity in ${daysToMaturity} days — auto-rolling to next Pendle market.`;
    } else {
      trigger = 'routine';
      reasoning = `Lane 3 healthy. YT implied ${impliedAPY.toFixed(1)}%, srNUSD APY ${srNusdAPY.toFixed(1)}%, ${daysToMaturity} days to maturity.`;
    }

    const decision = await this.decisionModel.create({
      lane: 'lane3',
      trigger,
      model: 'rule-based',
      rebalanceRequired: needsRoll,
      reasoning,
      riskAssessment: needsRoll ? 'ACTION_REQUIRED — roll YT now' : 'NORMAL',
      protocolMetrics: { ytImpliedAPY: impliedAPY, srNusdAPY, ptDiscount: 0, morphoBorrowRate: 0, morphoUtilization: 0, lane1Spread: 0 },
    });

    this.logger.log(`Lane 3 decision: ${trigger}, maturity=${daysToMaturity}d`);
    return decision;
  }
}
