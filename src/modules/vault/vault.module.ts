import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { VaultController } from './vault.controller';
import { VaultService } from './vault.service';
import { TxWatcherProcessor } from './tx-watcher.processor';
import { ChainAdapterFactory } from '../../adapters/chain/chain-adapter.factory';
import { Position, PositionSchema } from '../../common/schemas/position.schema';
import { Transaction, TransactionSchema } from '../../common/schemas/transaction.schema';
import { LanePosition, LanePositionSchema } from '../../common/schemas/lane-position.schema';
import { AuthModule } from '../auth/auth.module';
import { OneChainModule } from '../onechain/onechain.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Position.name, schema: PositionSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: LanePosition.name, schema: LanePositionSchema },
    ]),
    BullModule.registerQueue({ name: 'tx-watcher' }),
    AuthModule,
    OneChainModule,
  ],
  controllers: [VaultController],
  providers: [VaultService, TxWatcherProcessor, ChainAdapterFactory],
  exports: [VaultService],
})
export class VaultModule {}
