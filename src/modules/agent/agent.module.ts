import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { DemoYieldService } from './demo-yield.service';
import { GuardianProcessor } from './processors/guardian.processor';
import { BalancerProcessor } from './processors/balancer.processor';
import { HunterProcessor } from './processors/hunter.processor';
import {
  AgentDecision,
  AgentDecisionSchema,
} from '../../common/schemas/agent-decision.schema';
import { Position, PositionSchema } from '../../common/schemas/position.schema';
import { AuthModule } from '../auth/auth.module';
import { StrategyModule } from '../strategy/strategy.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AgentDecision.name, schema: AgentDecisionSchema },
      { name: Position.name, schema: PositionSchema },
    ]),
    BullModule.registerQueue(
      { name: 'guardian-agent' },
      { name: 'balancer-agent' },
      { name: 'hunter-agent' },
    ),
    AuthModule,
    StrategyModule,
  ],
  controllers: [AgentController],
  providers: [
    AgentService,
    DemoYieldService,
    GuardianProcessor,
    BalancerProcessor,
    HunterProcessor,
  ],
  exports: [AgentService],
})
export class AgentModule {}
