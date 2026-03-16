import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User, UserSchema } from '../../common/schemas/user.schema';
import { Position, PositionSchema } from '../../common/schemas/position.schema';
import { Transaction, TransactionSchema } from '../../common/schemas/transaction.schema';
import { LanePosition, LanePositionSchema } from '../../common/schemas/lane-position.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Position.name, schema: PositionSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: LanePosition.name, schema: LanePositionSchema },
    ]),
    AuthModule,
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
