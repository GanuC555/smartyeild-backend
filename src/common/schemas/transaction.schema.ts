import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Transaction extends Document {
  @Prop({ required: true })
  userId: string;

  /** deposit | withdraw | p2p_transfer | agent_rebalance */
  @Prop({ required: true })
  type: string;

  /** pending | confirmed | failed */
  @Prop({ required: true })
  status: string;

  @Prop({ default: '0' })
  amount: string;

  @Prop({ default: null })
  txHash: string;

  @Prop({ default: null })
  fromAddress: string;

  @Prop({ default: null })
  toAddress: string;

  @Prop({ default: {}, type: Object })
  metadata: Record<string, any>;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
