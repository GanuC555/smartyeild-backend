"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const bull_1 = require("@nestjs/bull");
const mongoose_2 = require("mongoose");
const agent_decision_schema_1 = require("../../common/schemas/agent-decision.schema");
const position_schema_1 = require("../../common/schemas/position.schema");
const strategy_service_1 = require("../strategy/strategy.service");
const llm_adapter_1 = require("../../common/llm/llm.adapter");
const market_simulator_service_1 = require("../../common/market/market-simulator.service");
const telegram_service_1 = require("../telegram/telegram.service");
const REBALANCE_STEP = 10;
const MAX_SINGLE = 80;
const MIN_IDLE = 10;
let AgentService = class AgentService {
    constructor(decisionModel, positionModel, guardianQueue, balancerQueue, hunterQueue, llm, market, telegram) {
        this.decisionModel = decisionModel;
        this.positionModel = positionModel;
        this.guardianQueue = guardianQueue;
        this.balancerQueue = balancerQueue;
        this.hunterQueue = hunterQueue;
        this.llm = llm;
        this.market = market;
        this.telegram = telegram;
        this.logger = new common_1.Logger('AgentService');
    }
    onModuleInit() {
        this.guardianQueue.add('run-agent', {}, { repeat: { every: 30 * 60 * 1000 }, removeOnComplete: 5, removeOnFail: 10 }).catch(() => { });
        this.balancerQueue.add('run-agent', {}, { repeat: { every: 6 * 60 * 60 * 1000 }, removeOnComplete: 5 }).catch(() => { });
        this.hunterQueue.add('run-agent', {}, { repeat: { every: 15 * 60 * 1000 }, removeOnComplete: 5 }).catch(() => { });
        this.logger.log(`Agent schedulers: Guardian(30m) | Balancer(6h) | Hunter(15m) | LLM: ${this.llm.provider}/${this.llm.model}`);
    }
    async runAgent(strategyId) {
        this.logger.log(`Running ${strategyId} agent...`);
        const strategy = strategy_service_1.STRATEGIES[strategyId];
        if (!strategy)
            throw new Error(`Unknown strategy: ${strategyId}`);
        const ms = this.market.getState();
        const marketData = this.buildMarketData(strategyId, ms);
        const positions = await this.positionModel
            .find({ [`strategyAllocation.${strategyId}`]: { $gt: 0 } })
            .lean();
        const systemPrompt = this.buildSystemPrompt(strategyId, strategy);
        const userMessage = this.buildObserverReport(strategyId, marketData, positions);
        let reasoning = '';
        let decision = 'hold';
        if (!this.llm.isStub) {
            try {
                reasoning = await this.llm.chat(systemPrompt, userMessage);
                decision = reasoning.toLowerCase().includes('rebalance') ? 'rebalance' : 'hold';
            }
            catch (err) {
                this.logger.error(`LLM error for ${strategyId}:`, err);
                reasoning = this.generateStubReasoning(strategyId, marketData, ms);
                decision = this.ruleBasedDecision(strategyId, ms);
            }
        }
        else {
            reasoning = this.generateStubReasoning(strategyId, marketData, ms);
            decision = this.ruleBasedDecision(strategyId, ms);
        }
        this.logger.log(`[${strategyId}] decision=${decision}`);
        this.logger.log(`[${strategyId}] reasoning:\n${reasoning}`);
        if (decision === 'rebalance') {
            this.executeRebalance(strategyId, ms);
        }
        const record = await this.decisionModel.create({
            strategy: strategyId,
            conversationHistory: [
                { role: 'user', content: userMessage },
                { role: 'assistant', content: reasoning },
            ],
            reasoning,
            decision,
            proposedAllocation: marketData.currentAllocation,
            executedTasks: decision === 'rebalance' ? [`shift_alloc_${strategyId}`] : [],
            txHashes: [],
            toolCallCount: 2,
        });
        const currentAPY = ms[`${strategyId}APY`] || 0;
        this.telegram.broadcastAgentDecision(strategyId, decision, reasoning, currentAPY).catch(() => { });
        return record;
    }
    ruleBasedDecision(id, ms) {
        if (id === 'guardian') {
            const naviAPY = 4.0 + (ms.morphoUtilization - 45) * 0.08;
            return Math.abs(naviAPY - ms.srNusdAPY) > strategy_service_1.STRATEGIES.guardian.rebalanceThreshold ? 'rebalance' : 'hold';
        }
        if (id === 'balancer') {
            return ms.oneDexStableAPY < 8.0 ? 'rebalance' : 'hold';
        }
        if (id === 'hunter') {
            return ms.highConfMarkets > 0 ? 'rebalance' : 'hold';
        }
        return 'hold';
    }
    executeRebalance(id, ms) {
        const alloc = { ...ms.alloc[id] };
        if (id === 'guardian') {
            const naviAPY = 4.0 + (ms.morphoUtilization - 45) * 0.08;
            if (naviAPY > ms.srNusdAPY) {
                const shift = Math.min(REBALANCE_STEP, alloc.sUSDS - MIN_IDLE);
                alloc.sUSDS = Math.max(MIN_IDLE, alloc.sUSDS - shift);
                alloc.naviUSDC = Math.min(MAX_SINGLE, alloc.naviUSDC + shift);
                alloc.idle = 100 - alloc.sUSDS - alloc.naviUSDC;
            }
            else {
                const shift = Math.min(REBALANCE_STEP, alloc.naviUSDC);
                alloc.naviUSDC = Math.max(0, alloc.naviUSDC - shift);
                alloc.sUSDS = Math.min(MAX_SINGLE, alloc.sUSDS + shift);
                alloc.idle = 100 - alloc.sUSDS - alloc.naviUSDC;
            }
        }
        else if (id === 'balancer') {
            if (ms.oneDexStableAPY < 8.0) {
                const shift = Math.min(REBALANCE_STEP, alloc.oneDexStable - MIN_IDLE);
                alloc.oneDexStable = Math.max(MIN_IDLE, alloc.oneDexStable - shift);
                alloc.sUSDS = Math.min(MAX_SINGLE, alloc.sUSDS + shift);
            }
            else {
                const shift = Math.min(REBALANCE_STEP, alloc.idle);
                alloc.idle = Math.max(0, alloc.idle - shift);
                alloc.oneDexStable = Math.min(MAX_SINGLE, alloc.oneDexStable + shift);
            }
            alloc.idle = 100 - alloc.sUSDS - alloc.oneDexStable;
        }
        else if (id === 'hunter') {
            if (ms.highConfMarkets > 0) {
                const shift = Math.min(REBALANCE_STEP, alloc.idle + Math.floor(alloc.oneDexVolatile * 0.1));
                alloc.oneDexVolatile = Math.max(MIN_IDLE, alloc.oneDexVolatile - Math.floor(shift / 2));
                alloc.onePredice = Math.min(MAX_SINGLE, alloc.onePredice + shift);
                alloc.idle = Math.max(0, 100 - alloc.oneDexVolatile - alloc.onePredice);
            }
            else {
                const shift = Math.min(REBALANCE_STEP, alloc.onePredice);
                alloc.onePredice = Math.max(0, alloc.onePredice - shift);
                alloc.oneDexVolatile = Math.min(MAX_SINGLE, alloc.oneDexVolatile + shift);
                alloc.idle = 100 - alloc.oneDexVolatile - alloc.onePredice;
            }
        }
        alloc.idle = Math.max(0, alloc.idle);
        this.market.updateInternalAllocation(id, alloc);
        this.logger.log(`[${id}] executed rebalance → new alloc: ${JSON.stringify(alloc)}`);
    }
    buildMarketData(id, ms) {
        if (id === 'guardian') {
            const naviAPY = parseFloat((4.0 + (ms.morphoUtilization - 45) * 0.08).toFixed(2));
            return {
                timestamp: new Date().toISOString(),
                naviUSDCAPY: naviAPY,
                sUSDSAPY: ms.srNusdAPY,
                morphoUtilization: ms.morphoUtilization,
                currentAllocation: ms.alloc.guardian,
                currentAPY: ms.guardianAPY,
            };
        }
        if (id === 'balancer') {
            return {
                timestamp: new Date().toISOString(),
                sUSDSAPY: ms.srNusdAPY,
                naviUSDCAPY: parseFloat((4.0 + (ms.morphoUtilization - 45) * 0.08).toFixed(2)),
                oneDexStableAPY: ms.oneDexStableAPY,
                currentAllocation: ms.alloc.balancer,
                currentAPY: ms.balancerAPY,
            };
        }
        return {
            timestamp: new Date().toISOString(),
            oneDexVolatileAPY: ms.oneDexVolatileAPY,
            onePrediceVolume24h: ms.openMarkets * 35000,
            openMarkets: ms.openMarkets,
            highConfidenceMarkets: ms.highConfMarkets,
            currentAllocation: ms.alloc.hunter,
            currentAPY: ms.hunterAPY,
        };
    }
    buildSystemPrompt(strategyId, strategy) {
        const prompts = {
            guardian: `You are the Guardian AI Agent — conservative yield optimizer. Allowed protocols: ${strategy.protocols.map((p) => p.name).join(', ')}. Rebalance only when APY difference > ${strategy.rebalanceThreshold}%. Keep ${strategy.minIdlePercent}% idle. Max ${strategy.maxSingleAllocation}% in any protocol. Respond: DECISION: Hold or DECISION: Rebalance with brief reasoning.`,
            balancer: `You are the Balancer AI Agent — medium-risk optimizer. Maintain 30% floor in sUSDS. If OneDex stable LP APY drops below 8%, rotate to RWA floor. Respond: DECISION: Hold or DECISION: Rebalance with brief reasoning.`,
            hunter: `You are the Hunter AI Agent — aggressive optimizer. Only enter prediction markets with >75% implied confidence. If high-confidence markets exist, increase OnePredice allocation. Respond: DECISION: Hold or DECISION: Rebalance with brief reasoning.`,
        };
        return prompts[strategyId];
    }
    buildObserverReport(strategyId, d, positions) {
        const capital = positions.reduce((s, p) => {
            const alloc = p.strategyAllocation?.[strategyId] || 0;
            return s + (alloc / 100) * parseFloat(p.strategyPoolBalance || '0');
        }, 0);
        if (strategyId === 'guardian') {
            return `GUARDIAN REPORT — ${d.timestamp}
Capital: $${capital.toFixed(2)} | Current blended APY: ${d.currentAPY.toFixed(2)}%
Allocation: sUSDS ${d.currentAllocation.sUSDS}% | Navi ${d.currentAllocation.naviUSDC}% | Idle ${d.currentAllocation.idle}%
APYs: sUSDS=${d.sUSDSAPY.toFixed(2)}% | Navi USDC=${d.naviUSDCAPY.toFixed(2)}% | Delta=${Math.abs(d.naviUSDCAPY - d.sUSDSAPY).toFixed(2)}%
Rebalance threshold: ${strategy_service_1.STRATEGIES.guardian.rebalanceThreshold}%
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
    generateStubReasoning(strategyId, d, ms) {
        const decision = this.ruleBasedDecision(strategyId, ms);
        if (strategyId === 'guardian') {
            const delta = Math.abs(d.naviUSDCAPY - d.sUSDSAPY).toFixed(2);
            return decision === 'rebalance'
                ? `GUARDIAN ANALYSIS\nAPY delta of ${delta}% exceeds ${strategy_service_1.STRATEGIES.guardian.rebalanceThreshold}% threshold. ${d.naviUSDCAPY > d.sUSDSAPY ? `Navi USDC (${d.naviUSDCAPY.toFixed(2)}%) outperforming sUSDS (${d.sUSDSAPY.toFixed(2)}%) — shift ${REBALANCE_STEP}% allocation to Navi.` : `sUSDS (${d.sUSDSAPY.toFixed(2)}%) outperforming Navi (${d.naviUSDCAPY.toFixed(2)}%) — retreat to T-bills.`} DECISION: Rebalance`
                : `GUARDIAN ANALYSIS\nAPY delta of ${delta}% is within the ${strategy_service_1.STRATEGIES.guardian.rebalanceThreshold}% rebalance threshold. sUSDS at ${d.sUSDSAPY.toFixed(2)}%, Navi at ${d.naviUSDCAPY.toFixed(2)}%. Current blended APY ${d.currentAPY.toFixed(2)}% is optimal. Minimising transaction costs. DECISION: Hold`;
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
    async getDecisions(strategyId, limit = 10) {
        return this.decisionModel.find({ strategy: strategyId }).sort({ createdAt: -1 }).limit(limit).lean();
    }
    async getAllAgentsStatus() {
        const ids = ['guardian', 'balancer', 'hunter'];
        const ms = this.market.getState();
        const intervalMinutes = { guardian: 30, balancer: 360, hunter: 15 };
        return Promise.all(ids.map(async (id) => {
            const latest = await this.decisionModel.findOne({ strategy: id }).sort({ createdAt: -1 }).lean();
            const lastRunAt = latest?.createdAt ?? null;
            const elapsedMin = lastRunAt
                ? Math.floor((Date.now() - new Date(lastRunAt).getTime()) / 60000)
                : intervalMinutes[id];
            const nextRunInMinutes = Math.max(0, intervalMinutes[id] - elapsedMin);
            return {
                strategy: id,
                ...strategy_service_1.STRATEGIES[id],
                apy: ms[`${id}APY`] || strategy_service_1.STRATEGIES[id].currentAPY,
                currentAPY: ms[`${id}APY`] || strategy_service_1.STRATEGIES[id].currentAPY,
                internalAlloc: ms.alloc[id],
                lastDecision: latest,
                lastRunAt,
                nextRunInMinutes,
                status: 'active',
            };
        }));
    }
};
exports.AgentService = AgentService;
exports.AgentService = AgentService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(agent_decision_schema_1.AgentDecision.name)),
    __param(1, (0, mongoose_1.InjectModel)(position_schema_1.Position.name)),
    __param(2, (0, bull_1.InjectQueue)('guardian-agent')),
    __param(3, (0, bull_1.InjectQueue)('balancer-agent')),
    __param(4, (0, bull_1.InjectQueue)('hunter-agent')),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model, Object, Object, Object, llm_adapter_1.LLMAdapter,
        market_simulator_service_1.MarketSimulatorService,
        telegram_service_1.TelegramService])
], AgentService);
//# sourceMappingURL=agent.service.js.map