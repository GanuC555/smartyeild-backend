import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MarketSimulatorService } from './market-simulator.service';
import { MarketSnapshot, MarketSnapshotSchema } from '../schemas/market-snapshot.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MarketSnapshot.name, schema: MarketSnapshotSchema },
    ]),
  ],
  providers: [MarketSimulatorService],
  exports: [MarketSimulatorService],
})
export class MarketSimulatorModule {}
