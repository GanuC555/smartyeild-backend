import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Position extends Document {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  vaultId: string;

  @Prop({ required: true })
  walletAddress: string;

  @Prop({ default: '0' })
  shares: string;

  /** Original USDC deposited — NEVER touched automatically */
  @Prop({ default: '0' })
  depositedPrincipal: string;

  /** 50% of deposit — always accessible */
  @Prop({ default: '0' })
  liquidBalance: string;

  /** 50% of deposit — AI-managed */
  @Prop({ default: '0' })
  strategyPoolBalance: string;

  /** Yield accumulated since deposit */
  @Prop({ default: '0' })
  accruedYield: string;

  @Prop({
    default: { guardian: 100, balancer: 0, hunter: 0 },
    type: Object,
  })
  strategyAllocation: { guardian: number; balancer: number; hunter: number };

  @Prop({ default: 'active' })
  status: string;

  @Prop({ default: Date.now })
  depositedAt: Date;
}

export const PositionSchema = SchemaFactory.createForClass(Position);
