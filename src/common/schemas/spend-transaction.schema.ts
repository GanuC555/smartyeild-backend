import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SpendTransactionDocument = SpendTransaction & Document;

@Schema({ timestamps: true })
export class SpendTransaction {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) userId: Types.ObjectId;
  @Prop({ required: true, enum: ['qr_pay', 'p2p', 'card'] }) type: string;
  @Prop({ required: true }) amount: string;
  @Prop({ default: 'USDC' }) currency: string;
  @Prop({ required: true }) recipient: string;
  @Prop({ required: true, enum: ['yield', 'liquid', 'mixed'] }) settlementSource: string;
  @Prop() yieldAmount: string;
  @Prop() liquidAmount: string;
  @Prop() txHash: string;
  @Prop({ required: true, enum: ['pending', 'approved', 'declined', 'settled'], default: 'pending' }) status: string;
  @Prop() declineReason: string;
  @Prop() note: string;
}

export const SpendTransactionSchema = SchemaFactory.createForClass(SpendTransaction);
