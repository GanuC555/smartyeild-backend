import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StrategyController } from './strategy.controller';
import { StrategyService } from './strategy.service';
import { Position, PositionSchema } from '../../common/schemas/position.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Position.name, schema: PositionSchema }]),
    AuthModule,
  ],
  controllers: [StrategyController],
  providers: [StrategyService],
  exports: [StrategyService],
})
export class StrategyModule {}
