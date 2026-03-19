import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Model } from 'mongoose';
import { AgentDecision } from '../../common/schemas/agent-decision.schema';
import { Position } from '../../common/schemas/position.schema';
import { STRATEGIES } from '../strategy/strategy.service';
import { LLMAdapter } from '../../common/llm/llm.adapter';
import { MarketSimulatorService, InternalAllocation } from '../../common/market/market-simulator.service';
import { TelegramService } from '../telegram/telegram.service';

const REBALANCE_STEP = 10; // shift 10 percentage points per rebalance
const MAX_SINGLE     = 80;
const MIN_IDLE       = 10;

@Injectable()
export class AgentService implements OnModuleInit {
  private readonly logger = new Logger('AgentService');

  constructor(
    @InjectModel(AgentDecision.name) private decisionModel: Model<AgentDecision>,
    @InjectModel(Position.name)      private positionModel: Model<Position>,
    @InjectQueue('guardian-agent')   private guardianQueue: Queue,
    @InjectQueue('balancer-agent')   private balancerQueue: Queue,
    @InjectQueue('hunter-agent')     private hunterQueue: Queue,
    private readonly llm: LLMAdapter,
    private readonly market: MarketSimulatorService,
    private readonly telegram: TelegramService,
  ) {}

  onModuleInit() {
    this.guardianQueue.add('run-agent', {}, { repeat: { every: 30 * 60 * 1000 }, removeOnComplete: 5, removeOnFail: 10 }).catch(() => {});
    this.balancerQueue.add('run-agent', {}, { repeat: { every: 6  * 60 * 60 * 1000 }, removeOnComplete: 5 }).catch(() => {});
    this.hunterQueue  .add('run-agent', {}, { repeat: { every: 15 * 60 * 1000 }, removeOnComplete: 5 }).catch(() => {});
    this.logger.log(`Agent schedulers: Guardian(30m) | Balancer(6h) | Hunter(15m) | LLM: ${this.llm.provider}/${this.llm.model}`);
  }

  async runAgent(strategyId: 'guardian' | 'balancer' | 'hunter'): Promise<AgentDecision> {
    this.logger.log(`Running ${strategyId} agent...`);
    const strategy = STRATEGIES[strategyId];
    if (!strategy) throw new Error(`Unknown strategy: ${strategyId}`);

    const ms = this.market.getState();
    const marketData = this.buildMarketData(strategyId, ms);

    const positions = await this.positionModel
      .find({ [`strategyAllocation.${strategyId}`]: { $gt: 0 } })
      .lean();

    const systemPrompt = this.buildSystemPrompt(strategyId, strategy);
    const userMessage  = this.buildObserverReport(strategyId, marketData, positions);

    let reasoning = '';
    let decision  = 'hold';

    if (!this.llm.isStub) {
      try {
        reasoning = await this.llm.chat(systemPrompt, userMessage);
        if (!reasoning?.trim()) {
          // LLM returned empty — fall back to rule-based
          this.logger.warn(`[${strategyId}] LLM returned empty response — using stub reasoning`);
          reasoning = this.generateStubReasoning(strategyId, marketData, ms);
          decision  = this.ruleBasedDecision(strategyId, ms);
        } else {
          decision = reasoning.toLowerCase().includes('rebalance') ? 'rebalance' : 'hold';
        }
      } catch (err) {
        this.logger.error(`LLM error for ${strategyId}:`, err);
        reasoning = this.generateStubReasoning(strategyId, marketData, ms);
        decision  = this.ruleBasedDecision(strategyId, ms);
      }
    } else {
      reasoning = this.generateStubReasoning(strategyId, marketData, ms);
      decision  = this.ruleBasedDecision(strategyId, ms);
    }

    this.logger.log(`[${strategyId}] decision=${decision}`);
    this.logger.log(`[${strategyId}] reasoning:\n${reasoning}`);

    // ── Execute: if rebalance, shift internal protocol allocation ──
    if (decision === 'rebalance') {
      this.executeRebalance(strategyId, ms);
    }

    const record = await this.decisionModel.create({
      strategy: strategyId,
      conversationHistory: [
        { role: 'user',      content: userMessage },
        { role: 'assistant', content: reasoning   },
      ],
      reasoning,
      decision,
      proposedAllocation: marketData.currentAllocation,
      executedTasks: decision === 'rebalance' ? [`shift_alloc_${strategyId}`] : [],
      txHashes: [],
      toolCallCount: 2,
    });

    // Broadcast to all linked Telegram users (non-blocking)
    const currentAPY = (ms[`${strategyId}APY` as keyof typeof ms] as number) || 0;
    this.telegram.broadcastAgentDecision(strategyId, decision, reasoning, currentAPY).catch(() => {});

    return record;
  }

  // ── Rule-based fallback decision (mirrors LLM intent) ─────────────────────
  private ruleBasedDecision(id: 'guardian' | 'balancer' | 'hunter', ms: ReturnType<MarketSimulatorService['getState']>): 'hold' | 'rebalance' {
    if (id === 'guardian') {
      const naviAPY = 4.0 + (ms.morphoUtilization - 45) * 0.08;
      return Math.abs(naviAPY - ms.srNusdAPY) > STRATEGIES.guardian.rebalanceThreshold ? 'rebalance' : 'hold';
    }
    if (id === 'balancer') {
      return ms.oneDexStableAPY < 8.0 ? 'rebalance' : 'hold';
    }
    if (id === 'hunter') {
      return ms.highConfMarkets > 0 ? 'rebalance' : 'hold';
    }
    return 'hold';
  }

  // ── Shift internal alloc by REBALANCE_STEP towards the better protocol ──
  private executeRebalance(id: 'guardian' | 'balancer' | 'hunter', ms: ReturnType<MarketSimulatorService['getState']>) {
    const alloc = { ...ms.alloc[id] } as any;

    if (id === 'guardian') {
      const naviAPY = 4.0 + (ms.morphoUtilization - 45) * 0.08;
      if (naviAPY > ms.srNusdAPY) {
        // Shift from sUSDS → naviUSDC
        const shift = Math.min(REBALANCE_STEP, alloc.sUSDS - MIN_IDLE);
        alloc.sUSDS    = Math.max(MIN_IDLE, alloc.sUSDS    - shift);
        alloc.naviUSDC = Math.min(MAX_SINGLE, alloc.naviUSDC + shift);
        alloc.idle     = 100 - alloc.sUSDS - alloc.naviUSDC;
      } else {
        // Shift from naviUSDC → sUSDS (safer)
        const shift = Math.min(REBALANCE_STEP, alloc.naviUSDC);
        alloc.naviUSDC = Math.max(0, alloc.naviUSDC - shift);
        alloc.sUSDS    = Math.min(MAX_SINGLE, alloc.sUSDS + shift);
        alloc.idle     = 100 - alloc.sUSDS - alloc.naviUSDC;
      }
    } else if (id === 'balancer') {
      if (ms.oneDexStableAPY < 8.0) {
        // OneDex underperforming — rotate to sUSDS floor
        const shift = Math.min(REBALANCE_STEP, alloc.oneDexStable - MIN_IDLE);
        alloc.oneDexStable = Math.max(MIN_IDLE, alloc.oneDexStable - shift);
        alloc.sUSDS        = Math.min(MAX_SINGLE, alloc.sUSDS + shift);
      } else {
        // OneDex outperforming — increase stable LP
        const shift = Math.min(REBALANCE_STEP, alloc.idle);
        alloc.idle         = Math.max(0, alloc.idle - shift);
        alloc.oneDexStable = Math.min(MAX_SINGLE, alloc.oneDexStable + shift);
      }
      alloc.idle = 100 - alloc.sUSDS - alloc.oneDexStable;
    } else if (id === 'hunter') {
      if (ms.highConfMarkets > 0) {
        // High-confidence markets exist — shift from idle into OnePredice
        const shift = Math.min(REBALANCE_STEP, alloc.idle + Math.floor(alloc.oneDexVolatile * 0.1));
        alloc.oneDexVolatile = Math.max(MIN_IDLE, alloc.oneDexVolatile - Math.floor(shift / 2));
        alloc.onePredice     = Math.min(MAX_SINGLE, alloc.onePredice + shift);
        alloc.idle           = Math.max(0, 100 - alloc.oneDexVolatile - alloc.onePredice);
      } else {
        // No confidence → retreat to volatile LP
        const shift = Math.min(REBALANCE_STEP, alloc.onePredice);
        alloc.onePredice     = Math.max(0, alloc.onePredice - shift);
        alloc.oneDexVolatile = Math.min(MAX_SINGLE, alloc.oneDexVolatile + shift);
        alloc.idle           = 100 - alloc.oneDexVolatile - alloc.onePredice;
      }
    }

    // Clamp idle ≥ 0
    alloc.idle = Math.max(0, alloc.idle);
    this.market.updateInternalAllocation(id, alloc);
    this.logger.log(`[${id}] executed rebalance → new alloc: ${JSON.stringify(alloc)}`);
  }

  // ── Build market data snapshot from MarketSimulator ───────────────────────
  private buildMarketData(id: string, ms: ReturnType<MarketSimulatorService['getState']>) {
    if (id === 'guardian') {
      const naviAPY = parseFloat((4.0 + (ms.morphoUtilization - 45) * 0.08).toFixed(2));
      return {
        timestamp:         new Date().toISOString(),
        naviUSDCAPY:       naviAPY,
        sUSDSAPY:          ms.srNusdAPY,
        morphoUtilization: ms.morphoUtilization,
        currentAllocation: ms.alloc.guardian,
        currentAPY:        ms.guardianAPY,
      };
    }
    if (id === 'balancer') {
      return {
        timestamp:         new Date().toISOString(),
        sUSDSAPY:          ms.srNusdAPY,
        naviUSDCAPY:       parseFloat((4.0 + (ms.morphoUtilization - 45) * 0.08).toFixed(2)),
        oneDexStableAPY:   ms.oneDexStableAPY,
        currentAllocation: ms.alloc.balancer,
        currentAPY:        ms.balancerAPY,
      };
    }
    return {
      timestamp:            new Date().toISOString(),
      oneDexVolatileAPY:    ms.oneDexVolatileAPY,
      onePrediceVolume24h:  ms.openMarkets * 35000,
      openMarkets:          ms.openMarkets,
      highConfidenceMarkets:ms.highConfMarkets,
      currentAllocation:    ms.alloc.hunter,
      currentAPY:           ms.hunterAPY,
    };
  }

  private buildSystemPrompt(strategyId: string, strategy: any): string {
    const prompts = {
      guardian: `You are the Guardian AI Agent — conservative yield optimizer. Allowed protocols: ${strategy.protocols.map((p) => p.name).join(', ')}. Rebalance only when APY difference > ${strategy.rebalanceThreshold}%. Keep ${strategy.minIdlePercent}% idle. Max ${strategy.maxSingleAllocation}% in any protocol. Respond: DECISION: Hold or DECISION: Rebalance with brief reasoning.`,
      balancer: `You are the Balancer AI Agent — medium-risk optimizer. Maintain 30% floor in sUSDS. If OneDex stable LP APY drops below 8%, rotate to RWA floor. Respond: DECISION: Hold or DECISION: Rebalance with brief reasoning.`,
      hunter:   `You are the Hunter AI Agent — aggressive optimizer. Only enter prediction markets with >75% implied confidence. If high-confidence markets exist, increase OnePredice allocation. Respond: DECISION: Hold or DECISION: Rebalance with brief reasoning.`,
    };
    return prompts[strategyId];
  }

  private buildObserverReport(strategyId: string, d: any, positions: any[]): string {
    const capital = positions.reduce((s, p) => {
      const alloc = p.strategyAllocation?.[strategyId] || 0;
      return s + (alloc / 100) * parseFloat(p.strategyPoolBalance || '0');
    }, 0);

    if (strategyId === 'guardian') {
      return `GUARDIAN REPORT — ${d.timestamp}
Capital: $${capital.toFixed(2)} | Current blended APY: ${d.currentAPY.toFixed(2)}%
Allocation: sUSDS ${d.currentAllocation.sUSDS}% | Navi ${d.currentAllocation.naviUSDC}% | Idle ${d.currentAllocation.idle}%
APYs: sUSDS=${d.sUSDSAPY.toFixed(2)}% | Navi USDC=${d.naviUSDCAPY.toFixed(2)}% | Delta=${Math.abs(d.naviUSDCAPY - d.sUSDSAPY).toFixed(2)}%
Rebalance threshold: ${STRATEGIES.guardian.rebalanceThreshold}%
Recommend: hold or rebalance?`;
    }
    if (strategyId === 'balancer') {
      return `BALANCER REPORT — ${d.timestamp}
Capital: $${capital.toFixed(2)} | Current blended APY: ${d.currentAPY.toFixed(2)}%
Allocation: sUSDS ${d.currentAllocation.sUSDS}% | OneDex Stable ${d.currentAllocation.oneDexStable}% | Idle ${d.currentAllocation.idle}%
APYs: sUSDS=${d.sUSDSAPY.toFixed(2)}% | OneDex Stable=${d.oneDexStableAPY.toFixed(2)}%
Rule: OneDex floor is 8% APY. Currently: ${d.oneDexStableAPY.toFixed(2)}%
Recommend: hold or rebalance?`;
    }
    return `HUNTER REPORT — ${d.timestamp}
Capital: $${capital.toFixed(2)} | Current blended APY: ${d.currentAPY.toFixed(2)}%
Allocation: OneDex Volatile ${d.currentAllocation.oneDexVolatile}% | OnePredice ${d.currentAllocation.onePredice}% | Idle ${d.currentAllocation.idle}%
OneDex APY: ${d.oneDexVolatileAPY.toFixed(2)}% | OnePredice 24h vol: $${d.onePrediceVolume24h.toLocaleString()}
Markets: ${d.openMarkets} open, ${d.highConfidenceMarkets} high-confidence (>75%)
Rule: only increase OnePredice when high-confidence markets exist.
Recommend: hold or rebalance?`;
  }

  private generateStubReasoning(strategyId: string, d: any, ms: ReturnType<MarketSimulatorService['getState']>): string {
    const decision = this.ruleBasedDecision(strategyId as any, ms);

    if (strategyId === 'guardian') {
      const delta = Math.abs(d.naviUSDCAPY - d.sUSDSAPY).toFixed(2);
      return decision === 'rebalance'
        ? `GUARDIAN ANALYSIS\nAPY delta of ${delta}% exceeds ${STRATEGIES.guardian.rebalanceThreshold}% threshold. ${d.naviUSDCAPY > d.sUSDSAPY ? `Navi USDC (${d.naviUSDCAPY.toFixed(2)}%) outperforming sUSDS (${d.sUSDSAPY.toFixed(2)}%) — shift ${REBALANCE_STEP}% allocation to Navi.` : `sUSDS (${d.sUSDSAPY.toFixed(2)}%) outperforming Navi (${d.naviUSDCAPY.toFixed(2)}%) — retreat to T-bills.`} DECISION: Rebalance`
        : `GUARDIAN ANALYSIS\nAPY delta of ${delta}% is within the ${STRATEGIES.guardian.rebalanceThreshold}% rebalance threshold. sUSDS at ${d.sUSDSAPY.toFixed(2)}%, Navi at ${d.naviUSDCAPY.toFixed(2)}%. Current blended APY ${d.currentAPY.toFixed(2)}% is optimal. Minimising transaction costs. DECISION: Hold`;
    }
    if (strategyId === 'balancer') {
      return decision === 'rebalance'
        ? `BALANCER ANALYSIS\nOneDex stable LP at ${d.oneDexStableAPY.toFixed(2)}% — below 8% floor threshold. Rotating ${REBALANCE_STEP}% from OneDex to sUSDS RWA floor to protect yield. DECISION: Rebalance`
        : `BALANCER ANALYSIS\nOneDex stable LP at ${d.oneDexStableAPY.toFixed(2)}% (above 8% floor). sUSDS floor intact at ${d.sUSDSAPY.toFixed(2)}%. Blended APY ${d.currentAPY.toFixed(2)}% within target range. DECISION: Hold`;
    }
    return decision === 'rebalance'
      ? `HUNTER ANALYSIS\nFound ${d.highConfidenceMarkets} high-confidence prediction market(s) (>75% implied probability). Shifting ${REBALANCE_STEP}% from idle/volatile LP into OnePredice for asymmetric yield capture. OneDex volatile at ${d.oneDexVolatileAPY.toFixed(2)}%. DECISION: Rebalance`
      : `HUNTER ANALYSIS\nNo high-confidence prediction markets available. Maintaining current OneDex volatile LP at ${d.oneDexVolatileAPY.toFixed(2)}% APY. Waiting for high-probability market opportunities. DECISION: Hold`;
  }

  async getDecisions(strategyId: string, limit = 10) {
    return this.decisionModel.find({ strategy: strategyId }).sort({ createdAt: -1 }).limit(limit).lean();
  }

  async getAllAgentsStatus() {
    const ids = ['guardian', 'balancer', 'hunter'] as const;
    const ms  = this.market.getState();
    const intervalMinutes = { guardian: 30, balancer: 360, hunter: 15 };
    return Promise.all(
      ids.map(async (id) => {
        const latest = await this.decisionModel.findOne({ strategy: id }).sort({ createdAt: -1 }).lean();
        const lastRunAt = (latest as any)?.createdAt ?? null;
        const elapsedMin = lastRunAt
          ? Math.floor((Date.now() - new Date(lastRunAt).getTime()) / 60000)
          : intervalMinutes[id];
        const nextRunInMinutes = Math.max(0, intervalMinutes[id] - elapsedMin);
        return {
          strategy: id,
          ...STRATEGIES[id],
          apy:              (ms[`${id}APY` as keyof typeof ms] as number) || STRATEGIES[id].currentAPY,
          currentAPY:       (ms[`${id}APY` as keyof typeof ms] as number) || STRATEGIES[id].currentAPY,
          internalAlloc:    ms.alloc[id],
          lastDecision:     latest,
          lastRunAt,
          nextRunInMinutes,
          status:           'active',
        };
      }),
    );
  }
}
