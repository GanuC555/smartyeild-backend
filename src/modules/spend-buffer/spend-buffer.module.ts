import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SpendBufferController } from './spend-buffer.controller';
import { SpendBufferService } from './spend-buffer.service';
import { LanePosition, LanePositionSchema } from '../../common/schemas/lane-position.schema';
import { SpendTransaction, SpendTransactionSchema } from '../../common/schemas/spend-transaction.schema';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    NotificationModule,
    MongooseModule.forFeature([
      { name: LanePosition.name, schema: LanePositionSchema },
      { name: SpendTransaction.name, schema: SpendTransactionSchema },
    ]),
  ],
  controllers: [SpendBufferController],
  providers: [SpendBufferService],
  exports: [SpendBufferService],
})
export class SpendBufferModule {}
