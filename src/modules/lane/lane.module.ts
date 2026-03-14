import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { LaneController } from './lane.controller';
import { LaneService } from './lane.service';
import { Lane1Processor } from './processors/lane1.processor';
import { Lane2Processor } from './processors/lane2.processor';
import { Lane3Processor } from './processors/lane3.processor';
import { ProtocolModule } from '../protocol/protocol.module';
import { OneChainModule } from '../onechain/onechain.module';
import { LanePosition, LanePositionSchema } from '../../common/schemas/lane-position.schema';
import { LaneDecision, LaneDecisionSchema } from '../../common/schemas/lane-decision.schema';
import { MarketSnapshot, MarketSnapshotSchema } from '../../common/schemas/market-snapshot.schema';

@Module({
  imports: [
    ProtocolModule,
    OneChainModule,
    MongooseModule.forFeature([
      { name: LanePosition.name, schema: LanePositionSchema },
      { name: LaneDecision.name, schema: LaneDecisionSchema },
      { name: MarketSnapshot.name, schema: MarketSnapshotSchema },
    ]),
    BullModule.registerQueue(
      { name: 'lane1-queue' },
      { name: 'lane2-queue' },
      { name: 'lane3-queue' },
    ),
  ],
  controllers: [LaneController],
  providers: [LaneService, Lane1Processor, Lane2Processor, Lane3Processor],
  exports: [LaneService],
})
export class LaneModule {}
