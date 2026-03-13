import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { VaultController } from './vault.controller';
import { VaultService } from './vault.service';
import { TxWatcherProcessor } from './tx-watcher.processor';
import { ChainAdapterFactory } from '../../adapters/chain/chain-adapter.factory';
import { Position, PositionSchema } from '../../common/schemas/position.schema';
import { Transaction, TransactionSchema } from '../../common/schemas/transaction.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Position.name, schema: PositionSchema },
      { name: Transaction.name, schema: TransactionSchema },
    ]),
    BullModule.registerQueue({ name: 'tx-watcher' }),
    AuthModule,
  ],
  controllers: [VaultController],
  providers: [VaultService, TxWatcherProcessor, ChainAdapterFactory],
  exports: [VaultService],
})
export class VaultModule {}
