import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MarketSnapshotDocument = MarketSnapshot & Document;

@Schema({ timestamps: false })
export class MarketSnapshot {
  @Prop({ required: true, index: true }) snapshotAt: Date;
  @Prop({ default: 0 }) ptDiscount: number;
  @Prop({ default: 0 }) ytImpliedAPY: number;
  @Prop({ default: 0 }) srNusdAPY: number;
  @Prop({ default: 0 }) morphoBorrowRate: number;
  @Prop({ default: 0 }) morphoUtilization: number;
  @Prop({ default: 0 }) lane1Spread: number; // ptDiscount - morphoBorrowRate
  @Prop({ default: 0 }) lane2LeverageAPY: number;
}

export const MarketSnapshotSchema = SchemaFactory.createForClass(MarketSnapshot);
