import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StrategyController } from './strategy.controller';
import { StrategyService } from './strategy.service';
import { Position, PositionSchema } from '../../common/schemas/position.schema';
import { AuthModule } from '../auth/auth.module';
import { MarketSimulatorModule } from '../../common/market/market-simulator.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Position.name, schema: PositionSchema }]),
    AuthModule,
    MarketSimulatorModule,
  ],
  controllers: [StrategyController],
  providers: [StrategyService],
  exports: [StrategyService],
})
export class StrategyModule {}
