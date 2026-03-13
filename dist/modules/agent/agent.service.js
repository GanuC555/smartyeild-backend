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
const sdk_1 = require("@anthropic-ai/sdk");
const agent_decision_schema_1 = require("../../common/schemas/agent-decision.schema");
const position_schema_1 = require("../../common/schemas/position.schema");
const strategy_service_1 = require("../strategy/strategy.service");
let AgentService = class AgentService {
    constructor(decisionModel, positionModel, guardianQueue, balancerQueue, hunterQueue) {
        this.decisionModel = decisionModel;
        this.positionModel = positionModel;
        this.guardianQueue = guardianQueue;
        this.balancerQueue = balancerQueue;
        this.hunterQueue = hunterQueue;
        this.logger = new common_1.Logger('AgentService');
        this.anthropic = new sdk_1.default({
            apiKey: process.env.ANTHROPIC_API_KEY || '',
        });
    }
    onModuleInit() {
        this.guardianQueue
            .add('run-agent', {}, {
            repeat: { every: 30 * 60 * 1000 },
            removeOnComplete: 5,
            removeOnFail: 10,
        })
            .catch(() => { });
        this.balancerQueue
            .add('run-agent', {}, {
            repeat: { every: 6 * 60 * 60 * 1000 },
            removeOnComplete: 5,
        })
            .catch(() => { });
        this.hunterQueue
            .add('run-agent', {}, {
            repeat: { every: 15 * 60 * 1000 },
            removeOnComplete: 5,
        })
            .catch(() => { });
        this.logger.log('Agent schedulers: Guardian(30m) | Balancer(6h) | Hunter(15m)');
    }
    async runAgent(strategyId) {
        this.logger.log(`Running ${strategyId} agent...`);
        const strategy = strategy_service_1.STRATEGIES[strategyId];
        if (!strategy)
            throw new Error(`Unknown strategy: ${strategyId}`);
        const marketData = await this.gatherMarketData(strategyId);
        const positions = await this.positionModel
            .find({ [`strategyAllocation.${strategyId}`]: { $gt: 0 } })
            .lean();
        const systemPrompt = this.buildSystemPrompt(strategyId, strategy);
        const userMessage = this.buildObserverReport(strategyId, marketData, positions);
        let reasoning = '';
        let decision = 'hold';
        const conversationHistory = [];
        const hasApiKey = process.env.ANTHROPIC_API_KEY &&
            process.env.ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here';
        if (hasApiKey) {
            try {
                const response = await this.anthropic.messages.create({
                    model: 'claude-sonnet-4-6',
                    max_tokens: 1024,
                    system: systemPrompt,
                    messages: [{ role: 'user', content: userMessage }],
                });
                const content = response.content[0];
                if (content.type === 'text') {
                    reasoning = content.text;
                    decision = reasoning.toLowerCase().includes('rebalance')
                        ? 'rebalance'
                        : 'hold';
                }
                conversationHistory.push({ role: 'user', content: userMessage }, { role: 'assistant', content: reasoning });
            }
            catch (err) {
                this.logger.error(`Claude API error for ${strategyId}:`, err);
                reasoning = this.generateStubReasoning(strategyId, marketData);
            }
        }
        else {
            reasoning = this.generateStubReasoning(strategyId, marketData);
            decision = Math.random() > 0.7 ? 'rebalance' : 'hold';
        }
        const record = await this.decisionModel.create({
            strategy: strategyId,
            conversationHistory,
            reasoning,
            decision,
            proposedAllocation: marketData.currentAllocation,
            executedTasks: [],
            txHashes: [],
            toolCallCount: conversationHistory.length,
        });
        this.logger.log(`${strategyId} → ${decision}`);
        return record;
    }
    async gatherMarketData(strategyId) {
        const data = {
            guardian: {
                timestamp: new Date().toISOString(),
                naviUSDCAPY: 6.8 + (Math.random() - 0.5) * 2,
                sUSDSAPY: 5.1 + (Math.random() - 0.5) * 0.5,
                currentAllocation: { sUSDS: 60, naviUSDC: 20, idle: 20 },
            },
            balancer: {
                timestamp: new Date().toISOString(),
                sUSDSAPY: 5.1,
                naviUSDCAPY: 7.3 + (Math.random() - 0.5) * 2,
                oneDexStableAPY: 11.4 + (Math.random() - 0.5) * 4,
                currentAllocation: { sUSDS: 30, oneDexStable: 50, idle: 20 },
            },
            hunter: {
                timestamp: new Date().toISOString(),
                oneDexVolatileAPY: 28.3 + (Math.random() - 0.5) * 8,
                onePrediceVolume24h: 145000 + Math.floor(Math.random() * 50000),
                openMarkets: 3 + Math.floor(Math.random() * 5),
                highConfidenceMarkets: Math.floor(Math.random() * 3),
                currentAllocation: { oneDexVolatile: 50, onePredice: 35, idle: 15 },
            },
        };
        return data[strategyId];
    }
    buildSystemPrompt(strategyId, strategy) {
        const prompts = {
            guardian: `You are the Guardian AI Agent — conservative yield optimizer. Allowed protocols: ${strategy.protocols.map((p) => p.name).join(', ')}. Rebalance only when APY difference > ${strategy.rebalanceThreshold}%. Keep ${strategy.minIdlePercent}% idle. Max ${strategy.maxSingleAllocation}% in any protocol. Holding is valid.`,
            balancer: `You are the Balancer AI Agent — medium-risk optimizer. Maintain 30% floor in sUSDS. Allowed: ${strategy.protocols.map((p) => p.name).join(', ')}. Rebalance when deviation > ${strategy.rebalanceThreshold}%. If DEX LP < 8% APY, shift to RWA floor.`,
            hunter: `You are the Hunter AI Agent — aggressive optimizer. Maximize yield with volatile DEX and prediction markets. Allowed: ${strategy.protocols.map((p) => p.name).join(', ')}. Only enter prediction markets with >75% implied probability. Max 60% any single position.`,
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
Capital: $${capital.toFixed(2)} USDC
Allocation: sUSDS ${d.currentAllocation.sUSDS}% | Navi ${d.currentAllocation.naviUSDC}% | Idle ${d.currentAllocation.idle}%
APYs: sUSDS=${d.sUSDSAPY.toFixed(2)}% | Navi USDC=${d.naviUSDCAPY.toFixed(2)}%
Recommend: hold or rebalance?`;
        }
        if (strategyId === 'balancer') {
            return `BALANCER REPORT — ${d.timestamp}
Capital: $${capital.toFixed(2)} USDC
Allocation: sUSDS ${d.currentAllocation.sUSDS}% | OneDex Stable ${d.currentAllocation.oneDexStable}% | Idle ${d.currentAllocation.idle}%
APYs: sUSDS=${d.sUSDSAPY.toFixed(2)}% | Navi=${d.naviUSDCAPY.toFixed(2)}% | OneDex Stable=${d.oneDexStableAPY.toFixed(2)}%
Recommend: maintain 30% RWA floor, optimize remainder?`;
        }
        return `HUNTER REPORT — ${d.timestamp}
Capital: $${capital.toFixed(2)} USDC
Allocation: OneDex Volatile ${d.currentAllocation.oneDexVolatile}% | OnePredice ${d.currentAllocation.onePredice}% | Idle ${d.currentAllocation.idle}%
OneDex APY: ${d.oneDexVolatileAPY.toFixed(2)}% | OnePredice 24h vol: $${d.onePrediceVolume24h.toLocaleString()}
Markets: ${d.openMarkets} open, ${d.highConfidenceMarkets} high-confidence (>75%)
Recommend: maximize yield, only enter high-confidence prediction markets?`;
    }
    generateStubReasoning(strategyId, d) {
        const s = strategy_service_1.STRATEGIES[strategyId];
        const stubs = {
            guardian: `GUARDIAN ANALYSIS (Demo Mode)
Reviewed current allocation. sUSDS at ${d.sUSDSAPY?.toFixed(2)}% APY, Navi USDC at ${d.naviUSDCAPY?.toFixed(2)}% APY. Delta ${Math.abs(d.sUSDSAPY - d.naviUSDCAPY).toFixed(2)}% is within the ${s.rebalanceThreshold}% rebalance threshold. Current positions performing within parameters. DECISION: Hold — no rebalance needed. Minimizing transaction costs.`,
            balancer: `BALANCER ANALYSIS (Demo Mode)
OneDex stable LP at ${d.oneDexStableAPY?.toFixed(2)}% (above 8% floor). RWA floor (sUSDS) at ${d.sUSDSAPY?.toFixed(2)}%. 30% sUSDS floor is intact. Blended APY ${(d.sUSDSAPY * 0.3 + d.oneDexStableAPY * 0.5).toFixed(2)}% within target range. DECISION: Hold — allocation optimal.`,
            hunter: `HUNTER ANALYSIS (Demo Mode)
OneDex volatile LP running ${d.oneDexVolatileAPY?.toFixed(2)}% APY. Found ${d.highConfidenceMarkets} high-confidence prediction market${d.highConfidenceMarkets !== 1 ? 's' : ''} (>75% probability). ${d.highConfidenceMarkets > 0 ? 'Recommend slight increase in OnePredice allocation to capture asymmetric yield.' : 'No sufficiently high-confidence markets — maintaining current allocation.'} DECISION: ${d.highConfidenceMarkets > 0 ? 'Rebalance' : 'Hold'}.`,
        };
        return stubs[strategyId];
    }
    async getDecisions(strategyId, limit = 10) {
        return this.decisionModel
            .find({ strategy: strategyId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
    }
    async getAllAgentsStatus() {
        const ids = ['guardian', 'balancer', 'hunter'];
        return Promise.all(ids.map(async (id) => {
            const latest = await this.decisionModel
                .findOne({ strategy: id })
                .sort({ createdAt: -1 })
                .lean();
            return {
                strategy: id,
                ...strategy_service_1.STRATEGIES[id],
                lastDecision: latest,
                lastRunAt: latest?.createdAt || null,
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
        mongoose_2.Model, Object, Object, Object])
], AgentService);
//# sourceMappingURL=agent.service.js.map