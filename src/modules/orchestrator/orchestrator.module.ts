import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { OrchestratorService } from './orchestrator.service';
import { OrchestratorProcessor } from './orchestrator.processor';
import { LaneModule } from '../lane/lane.module';
import { ProtocolModule } from '../protocol/protocol.module';
import { LaneDecision, LaneDecisionSchema } from '../../common/schemas/lane-decision.schema';

@Module({
  imports: [
    LaneModule,
    ProtocolModule,
    MongooseModule.forFeature([{ name: LaneDecision.name, schema: LaneDecisionSchema }]),
    BullModule.registerQueue({ name: 'orchestrator-queue' }),
  ],
  providers: [OrchestratorService, OrchestratorProcessor],
  exports: [OrchestratorService],
})
export class OrchestratorModule {}
