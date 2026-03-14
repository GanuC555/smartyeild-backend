import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LaneDecisionDocument = LaneDecision & Document;

@Schema({ timestamps: true })
export class LaneDecision {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true }) userId: Types.ObjectId;
  @Prop({ required: true }) model: string;
  @Prop({ required: true, enum: ['lane1', 'lane2', 'lane3', 'orchestrator'] }) lane: string;
  @Prop({ required: true, enum: ['spread_compression', 'leverage_risk', 'yt_roll', 'routine'] }) trigger: string;
  @Prop({ type: Object }) conversationLog: object[];
  @Prop({ default: 0 }) currentLane1Bps: number;
  @Prop({ default: 0 }) currentLane2Bps: number;
  @Prop({ default: 0 }) currentLane3Bps: number;
  @Prop({ default: 0 }) proposedLane1Bps: number;
  @Prop({ default: 0 }) proposedLane2Bps: number;
  @Prop({ default: 0 }) proposedLane3Bps: number;
  @Prop({ default: false }) rebalanceRequired: boolean;
  @Prop() reasoning: string;
  @Prop() riskAssessment: string;
  @Prop({ type: Object }) protocolMetrics: {
    ptDiscount: number; ytImpliedAPY: number; morphoBorrowRate: number;
    morphoUtilization: number; srNusdAPY: number; lane1Spread: number;
  };
  @Prop() executedAt: Date;
  @Prop({ type: [String] }) executionTxHashes: string[];
}

export const LaneDecisionSchema = SchemaFactory.createForClass(LaneDecision);
