import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LaneDecision, LaneDecisionDocument } from '../../../common/schemas/lane-decision.schema';
import { LanePosition, LanePositionDocument } from '../../../common/schemas/lane-position.schema';
import { PendleService } from '../../protocol/pendle.service';
import { StrataService } from '../../protocol/strata.service';

const ROLL_DAYS_THRESHOLD    = 7;   // roll YT if fewer than 7 days to maturity
const YT_PREMIUM_THRESHOLD   = 3.0; // if YT APY > srNUSD + 3%, rotate Lane3 → Lane1

@Processor('lane3-queue')
@Injectable()
export class Lane3Processor {
  private readonly logger = new Logger('Lane3Processor');

  constructor(
    @InjectModel(LaneDecision.name)  private decisionModel:      Model<LaneDecisionDocument>,
    @InjectModel(LanePosition.name)  private lanePositionModel:  Model<LanePositionDocument>,
    private readonly pendle:  PendleService,
    private readonly strata:  StrataService,
  ) {}

  @Process('lane3-decision')
  async handleDecision(_job: Job) {
    this.logger.log('Lane 3 YT monitor running...');

    const [impliedAPY, maturity, srNusdAPY] = await Promise.all([
      this.pendle.getImpliedAPY('default'),
      this.pendle.getMarketMaturity('default'),
      this.strata.getCurrentAPY(),
    ]);

    const daysToMaturity  = Math.floor((maturity.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const needsRoll       = daysToMaturity < ROLL_DAYS_THRESHOLD;
    const ytPremium       = impliedAPY - srNusdAPY;
    const ytOutperforming = ytPremium > YT_PREMIUM_THRESHOLD;

    let trigger: string;
    let reasoning: string;
    let rebalanceRequired = false;

    if (needsRoll) {
      trigger           = 'yt_roll';
      rebalanceRequired = true;
      reasoning         = `YT maturity in ${daysToMaturity} days — auto-rolling to next Pendle market. ` +
                          `New implied APY: ${impliedAPY.toFixed(2)}%, srNUSD base: ${srNusdAPY.toFixed(2)}%.`;
    } else if (ytOutperforming) {
      trigger           = 'yt_premium';
      rebalanceRequired = true;
      reasoning         = `YT implied APY (${impliedAPY.toFixed(2)}%) exceeds srNUSD APY (${srNusdAPY.toFixed(2)}%) ` +
                          `by ${ytPremium.toFixed(2)}% — above ${YT_PREMIUM_THRESHOLD}% threshold. ` +
                          `Rotating 10% from Lane 3 → Lane 1 to capture PT discount arbitrage.`;
    } else {
      trigger   = 'routine';
      reasoning = `Lane 3 healthy. YT implied APY ${impliedAPY.toFixed(2)}% vs srNUSD base ${srNusdAPY.toFixed(2)}% — ` +
                  `YT premium ${ytPremium.toFixed(2)}% is ${(YT_PREMIUM_THRESHOLD - ytPremium).toFixed(2)}% below the ` +
                  `${YT_PREMIUM_THRESHOLD}% rotation trigger. ` +
                  `${daysToMaturity} days remain to maturity (roll threshold: ${ROLL_DAYS_THRESHOLD} days). ` +
                  `srNUSD is providing stable base yield of ${srNusdAPY.toFixed(2)}%; ` +
                  `YT tokens are streaming the ${ytPremium.toFixed(2)}% premium on top. ` +
                  `No action required — holding Lane 3 allocation and collecting yield as expected.`;
    }

    // ── Execute: rotate Lane3→Lane1 when YT outperforms significantly ──
    if (ytOutperforming && !needsRoll) {
      const SHIFT = 1000; // 10%
      const positions = await this.lanePositionModel.find({
        walletAddress: { $exists: true, $ne: null },
        lane3AllocationBps: { $gt: SHIFT + 1000 },
      });
      for (const pos of positions) {
        pos.lane3AllocationBps = Math.max(1000, pos.lane3AllocationBps - SHIFT);
        pos.lane1AllocationBps = Math.min(8000, pos.lane1AllocationBps + SHIFT);
        await pos.save();
      }
      if (positions.length > 0) {
        this.logger.log(`[lane3] YT premium: rotated ${SHIFT}bps Lane3→Lane1 for ${positions.length} user(s)`);
      }
    }

    const decision = await this.decisionModel.create({
      lane:             'lane3',
      trigger,
      model:            'rule-based',
      rebalanceRequired,
      reasoning,
      riskAssessment:   needsRoll ? 'ACTION_REQUIRED — roll YT now' : 'NORMAL',
      protocolMetrics:  {
        ytImpliedAPY: impliedAPY,
        srNusdAPY,
        ptDiscount:        0,
        morphoBorrowRate:  0,
        morphoUtilization: 0,
        lane1Spread:       0,
      },
    });

    this.logger.log(`Lane 3 → ${trigger}, maturity=${daysToMaturity}d, ytPremium=${ytPremium.toFixed(2)}%`);
    return decision;
  }
}
