import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { DemoYieldService } from './demo-yield.service';
import { YieldCreditService } from './yield-credit.service';
import { YieldHarvestService } from './yield-harvest.service';
import { GuardianProcessor } from './processors/guardian.processor';
import { BalancerProcessor } from './processors/balancer.processor';
import { HunterProcessor } from './processors/hunter.processor';
import {
  AgentDecision,
  AgentDecisionSchema,
} from '../../common/schemas/agent-decision.schema';
import { Position, PositionSchema } from '../../common/schemas/position.schema';
import { LanePosition, LanePositionSchema } from '../../common/schemas/lane-position.schema';
import { AuthModule } from '../auth/auth.module';
import { StrategyModule } from '../strategy/strategy.module';
import { OneChainModule } from '../onechain/onechain.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AgentDecision.name, schema: AgentDecisionSchema },
      { name: Position.name, schema: PositionSchema },
      { name: LanePosition.name, schema: LanePositionSchema },
    ]),
    BullModule.registerQueue(
      { name: 'guardian-agent' },
      { name: 'balancer-agent' },
      { name: 'hunter-agent' },
    ),
    ConfigModule,
    AuthModule,
    StrategyModule,
    OneChainModule,
    TelegramModule,
  ],
  controllers: [AgentController],
  providers: [
    AgentService,
    DemoYieldService,
    YieldCreditService,
    YieldHarvestService,
    GuardianProcessor,
    BalancerProcessor,
    HunterProcessor,
  ],
  exports: [AgentService],
})
export class AgentModule {}
