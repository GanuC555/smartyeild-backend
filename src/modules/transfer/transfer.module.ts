import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TransferController } from './transfer.controller';
import { TransferService } from './transfer.service';
import { Transaction, TransactionSchema } from '../../common/schemas/transaction.schema';
import { Position, PositionSchema } from '../../common/schemas/position.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: Position.name, schema: PositionSchema },
    ]),
    AuthModule,
  ],
  controllers: [TransferController],
  providers: [TransferService],
  exports: [TransferService],
})
export class TransferModule {}
