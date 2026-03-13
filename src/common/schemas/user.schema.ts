import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true })
  walletAddress: string;

  @Prop({ required: true, unique: true })
  platformId: string; // e.g. OYS-7K2P

  @Prop({ default: null })
  telegramId: string;

  @Prop({ default: null })
  telegramUsername: string;

  @Prop({ default: false })
  telegramLinked: boolean;

  @Prop({ default: 'active' })
  status: string;

  @Prop({ default: [] })
  refreshTokens: string[];
}

export const UserSchema = SchemaFactory.createForClass(User);
