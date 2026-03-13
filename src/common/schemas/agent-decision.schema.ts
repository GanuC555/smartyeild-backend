import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class AgentDecision extends Document {
  /** guardian | balancer | hunter */
  @Prop({ required: true })
  strategy: string;

  @Prop({ default: [], type: Array })
  conversationHistory: any[];

  @Prop({ required: true })
  reasoning: string;

  /** hold | rebalance */
  @Prop({ required: true })
  decision: string;

  @Prop({ default: null, type: Object })
  proposedAllocation: Record<string, any>;

  @Prop({ default: [] })
  executedTasks: string[];

  @Prop({ default: [] })
  txHashes: string[];

  @Prop({ default: 0 })
  toolCallCount: number;
}

export const AgentDecisionSchema = SchemaFactory.createForClass(AgentDecision);
