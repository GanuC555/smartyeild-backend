import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { User, UserSchema } from '../../common/schemas/user.schema';
import { Position, PositionSchema } from '../../common/schemas/position.schema';
import { AgentDecision, AgentDecisionSchema } from '../../common/schemas/agent-decision.schema';
import { LanePosition, LanePositionSchema } from '../../common/schemas/lane-position.schema';
import { MarketSimulatorModule } from '../../common/market/market-simulator.module';
import { LLMModule } from '../../common/llm/llm.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Position.name, schema: PositionSchema },
      { name: AgentDecision.name, schema: AgentDecisionSchema },
      { name: LanePosition.name, schema: LanePositionSchema },
    ]),
    MarketSimulatorModule,
    LLMModule,
  ],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
