import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LanePositionDocument = LanePosition & Document;

@Schema({ timestamps: true })
export class LanePosition {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) userId: Types.ObjectId;
  @Prop({ required: true }) walletAddress: string;

  @Prop({ default: '0' }) lane1SrNusdAmount: string; // bigint as string
  @Prop({ default: '0' }) lane1PtAmount: string;
  @Prop({ default: '0' }) lane1MorphoBorrowAmount: string;
  @Prop({ default: 0 }) lane1AllocationBps: number;

  @Prop({ default: '0' }) lane2SrNusdAmount: string;
  @Prop({ default: '0' }) lane2LeveragedPtAmount: string;
  @Prop({ default: 1 }) lane2LeverageMultiplier: number;
  @Prop({ default: 0 }) lane2AllocationBps: number;

  @Prop({ default: '0' }) lane3SrNusdAmount: string;
  @Prop({ default: '0' }) lane3YtAmount: string;
  @Prop() lane3YtMarket: string;
  @Prop() lane3YtMaturity: Date;
  @Prop({ default: 0 }) lane3AllocationBps: number;

  @Prop({ default: '0' }) yieldBalance: string;
  @Prop({ default: '0' }) liquidBalance: string;
}

export const LanePositionSchema = SchemaFactory.createForClass(LanePosition);
