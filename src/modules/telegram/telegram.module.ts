import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TelegramService } from './telegram.service';
import { User, UserSchema } from '../../common/schemas/user.schema';
import { Position, PositionSchema } from '../../common/schemas/position.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Position.name, schema: PositionSchema },
    ]),
  ],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
