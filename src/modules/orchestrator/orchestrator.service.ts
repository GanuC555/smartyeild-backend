import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Anthropic from '@anthropic-ai/sdk';
import { LaneDecision, LaneDecisionDocument } from '../../common/schemas/lane-decision.schema';
import { LaneService } from '../lane/lane.service';
import { PendleService } from '../protocol/pendle.service';
import { MorphoService } from '../protocol/morpho.service';
import { StrataService } from '../protocol/strata.service';

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger('OrchestratorService');
  private readonly claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  constructor(
    @InjectModel(LaneDecision.name) private decisionModel: Model<LaneDecisionDocument>,
    private readonly laneService: LaneService,
    private readonly pendle: PendleService,
    private readonly morpho: MorphoService,
    private readonly strata: StrataService,
  ) {}

  async runAllocationDecision(userId?: string): Promise<LaneDecision> {
    const tools: Anthropic.Tool[] = [
      {
        name: 'get_lane_metrics',
        description: 'Get current protocol metrics: PT discount, YT implied APY, Morpho borrow rate and utilization, srNUSD APY',
        input_schema: { type: 'object' as const, properties: {} },
      },
      {
        name: 'get_market_snapshot',
        description: 'Get the latest stored market snapshot from the database',
        input_schema: { type: 'object' as const, properties: {} },
      },
      {
        name: 'propose_lane_rebalance',
        description: 'Propose optimal lane allocation in basis points (must sum to 10000)',
        input_schema: {
          type: 'object' as const,
          properties: {
            lane1_bps: { type: 'number', description: 'Basis points for Lane 1 (0-10000)' },
            lane2_bps: { type: 'number', description: 'Basis points for Lane 2 (0-10000)' },
            lane3_bps: { type: 'number', description: 'Basis points for Lane 3 (0-10000)' },
            trigger: { type: 'string', enum: ['spread_compression', 'leverage_risk', 'yt_roll', 'routine'] },
            reasoning: { type: 'string', description: 'Plain English explanation of the decision' },
            risk_assessment: { type: 'string', description: 'Risk level and key concerns' },
          },
          required: ['lane1_bps', 'lane2_bps', 'lane3_bps', 'trigger', 'reasoning', 'risk_assessment'],
        },
      },
    ];

    const systemPrompt = `You are the OneYield&Spend lane allocation orchestrator.

You manage capital across three protocol-native yield lanes:
- Lane 1 (Fixed Advance): Strata srNUSD → Pendle PT → Morpho borrow USDC. Earn: PT fixed APY minus borrow rate spread.
- Lane 2 (Leveraged Fixed): Strata srNUSD → Pendle PT → Morpho 5x flash loan loop. Earn: 5x amplified fixed APY.
- Lane 3 (Yield Streaming): Strata srNUSD → Pendle YT. Earn: floating srNUSD APY streamed daily.

Decision rules:
1. If Lane 1 spread < 2%: reduce Lane 1, increase Lane 3.
2. If Morpho utilization > 80%: reduce Lane 2, propose de-lever.
3. If YT implied APY > srNUSD APY + 3%: rotate Lane 3 → Lane 1 or 2.
4. All 3 lane_bps values MUST sum to exactly 10000.
5. Minimum 1000 bps (10%) in any active lane.

Current date: ${new Date().toISOString()}`;

    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: 'Analyze current lane conditions and propose optimal allocation.' }
    ];

    let response = await this.claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      tools,
      messages,
    });

    let proposedDecision: any = null;
    const conversationLog: object[] = [];

    while (response.stop_reason === 'tool_use') {
      conversationLog.push({ role: 'assistant', content: response.content });
      const toolResults = await this.handleToolCalls(response.content);
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });
      conversationLog.push({ role: 'user', content: toolResults });

      for (const block of response.content) {
        if (block.type === 'tool_use' && block.name === 'propose_lane_rebalance') {
          proposedDecision = block.input;
        }
      }

      response = await this.claude.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: systemPrompt,
        tools,
        messages,
      });
    }

    const metrics = await this.getLaneMetrics();
    const decision = await this.decisionModel.create({
      userId: userId ?? undefined,
      lane: 'orchestrator',
      trigger: proposedDecision?.trigger || 'routine',
      model: 'claude-sonnet-4-6',
      conversationLog: conversationLog as any,
      proposedLane1Bps: proposedDecision?.lane1_bps || 4000,
      proposedLane2Bps: proposedDecision?.lane2_bps || 4000,
      proposedLane3Bps: proposedDecision?.lane3_bps || 2000,
      rebalanceRequired: proposedDecision?.trigger !== 'routine',
      reasoning: proposedDecision?.reasoning || 'No rebalance needed',
      riskAssessment: proposedDecision?.risk_assessment || 'NORMAL',
      protocolMetrics: metrics,
    });

    this.logger.log(`Orchestrator decision: ${proposedDecision?.trigger || 'routine'}`);
    return decision;
  }

  private async getLaneMetrics() {
    const [ptDiscount, impliedAPY, borrowRate, utilization, srNusdAPY] = await Promise.all([
      this.pendle.getPTDiscount('default'),
      this.pendle.getImpliedAPY('default'),
      this.morpho.getBorrowRate({} as any),
      this.morpho.getMarketUtilization({} as any),
      this.strata.getCurrentAPY(),
    ]);
    return {
      ptDiscount, ytImpliedAPY: impliedAPY, morphoBorrowRate: borrowRate,
      morphoUtilization: utilization, srNusdAPY, lane1Spread: ptDiscount - borrowRate,
    };
  }

  private async handleToolCalls(content: Anthropic.ContentBlock[]): Promise<Anthropic.ToolResultBlockParam[]> {
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of content) {
      if (block.type !== 'tool_use') continue;
      let result: unknown;
      if (block.name === 'get_lane_metrics') result = await this.getLaneMetrics();
      if (block.name === 'get_market_snapshot') result = await this.laneService.getLatestMarketSnapshot();
      if (block.name === 'propose_lane_rebalance') result = { status: 'proposal_recorded', ...(block.input as object) };
      results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
    }
    return results;
  }
}
