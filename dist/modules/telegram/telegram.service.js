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
exports.TelegramService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const user_schema_1 = require("../../common/schemas/user.schema");
const position_schema_1 = require("../../common/schemas/position.schema");
const agent_decision_schema_1 = require("../../common/schemas/agent-decision.schema");
const lane_position_schema_1 = require("../../common/schemas/lane-position.schema");
const market_simulator_service_1 = require("../../common/market/market-simulator.service");
const llm_adapter_1 = require("../../common/llm/llm.adapter");
const AGENT_EMOJI = { guardian: '🛡️', balancer: '⚖️', hunter: '🎯' };
const AGENT_LABEL = { guardian: 'Guardian', balancer: 'Balancer', hunter: 'Hunter' };
const h = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const MAX_HISTORY = 10;
let TelegramService = class TelegramService {
    constructor(userModel, positionModel, decisionModel, lanePositionModel, market, llm) {
        this.userModel = userModel;
        this.positionModel = positionModel;
        this.decisionModel = decisionModel;
        this.lanePositionModel = lanePositionModel;
        this.market = market;
        this.llm = llm;
        this.logger = new common_1.Logger('TelegramService');
        this.bot = null;
        this.history = new Map();
    }
    async onModuleInit() {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token || token === 'your_telegram_bot_token_here') {
            this.logger.warn('Telegram bot disabled — set TELEGRAM_BOT_TOKEN to enable');
            return;
        }
        try {
            const { Bot } = await Promise.resolve().then(() => require('grammy'));
            this.bot = new Bot(token);
            this.bot.catch((err) => {
                this.logger.error(`Bot error: ${err.message ?? err}`);
            });
            this.setupHandlers();
            const frontendUrl = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '');
            this.bot.api.raw.setChatMenuButton({
                menu_button: { type: 'web_app', text: '📊 Open App', web_app: { url: frontendUrl } },
            }).catch((e) => this.logger.warn(`Could not set menu button: ${e.message}`));
            void this.bot.start().catch((err) => {
                const description = err?.description ?? err?.message ?? String(err);
                if (err?.error_code === 409 || /terminated by other getUpdates request/i.test(description)) {
                    this.logger.error('Telegram polling conflict (409): another instance is already running with the same bot token. Stopping local bot polling.');
                    return;
                }
                this.logger.error(`Telegram bot start failed: ${description}`);
            });
            this.logger.log(`Telegram Mini App bot started (LLM: ${this.llm.provider}/${this.llm.model})`);
        }
        catch (err) {
            this.logger.error('Telegram bot failed to start', err);
        }
    }
    onModuleDestroy() {
        if (this.bot) {
            this.bot.stop();
            this.logger.log('Telegram bot polling stopped');
        }
    }
    setupHandlers() {
        if (!this.bot)
            return;
        this.bot.command('link', async (ctx) => {
            const platformId = ctx.message.text.split(' ')[1]?.toUpperCase();
            if (!platformId) {
                await ctx.reply('To link your account, send:\n<code>/link OYS-XXXX</code>\n\nFind your Platform ID in <b>Settings</b> on the web app.', { parse_mode: 'HTML' });
                return;
            }
            const user = await this.userModel.findOne({ platformId });
            if (!user) {
                await ctx.reply('❌ Platform ID not found. Check Settings in the web app.');
                return;
            }
            await this.userModel.findByIdAndUpdate(user._id, {
                telegramId: ctx.from.id.toString(),
                telegramUsername: ctx.from.username,
                telegramLinked: true,
            });
            this.history.delete(ctx.from.id.toString());
            await ctx.reply(`✅ <b>Account linked!</b>\n\n` +
                `Platform ID: <code>${h(platformId)}</code>\n\n` +
                `You can now ask me anything about your portfolio, yield, agents, or spending. Just type naturally!\n\n` +
                `Try: <i>"How much yield have I earned?"</i> or <i>"What are the agents doing?"</i>`, { parse_mode: 'HTML' });
        });
        this.bot.command('start', async (ctx) => {
            const user = await this.userModel.findOne({ telegramId: ctx.from.id.toString() });
            if (user) {
                await ctx.reply(`👋 <b>Welcome back!</b>\n\nAsk me anything about your OneYield portfolio. I understand natural language.\n\n` +
                    `<i>Examples:</i>\n` +
                    `• "How much have I earned?"\n` +
                    `• "What is Guardian agent doing?"\n` +
                    `• "How much can I spend?"\n` +
                    `• "Show me the market APYs"`, { parse_mode: 'HTML' });
            }
            else {
                await ctx.reply(`👋 <b>Welcome to OneYield&amp;Spend!</b>\n\n` +
                    `I'm your AI portfolio assistant. To get started, link your account:\n\n` +
                    `<code>/link OYS-XXXX</code>\n\n` +
                    `Get your Platform ID from <b>Settings</b> in the web app.`, { parse_mode: 'HTML' });
            }
        });
        this.bot.command('app', async (ctx) => {
            const frontendUrl = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '');
            await ctx.reply('Open your OneYield dashboard:', {
                reply_markup: {
                    inline_keyboard: [[
                            { text: '📊 Open App', web_app: { url: frontendUrl } },
                        ]],
                },
            });
        });
        this.bot.command('clear', async (ctx) => {
            this.history.delete(ctx.from.id.toString());
            await ctx.reply('🧹 Conversation cleared. Start fresh!');
        });
        this.bot.on('message:text', async (ctx) => {
            const text = ctx.message.text ?? '';
            if (text.startsWith('/'))
                return;
            const telegramId = ctx.from.id.toString();
            const user = await this.userModel.findOne({ telegramId });
            if (!user) {
                await ctx.reply('👋 Link your account first:\n\n<code>/link OYS-XXXX</code>\n\nFind your Platform ID in Settings on the web app.', { parse_mode: 'HTML' });
                return;
            }
            await ctx.replyWithChatAction('typing');
            try {
                const result = await this.chatFull(telegramId, user._id.toString(), text);
                if (result.payment) {
                    const { to, amount, note } = result.payment;
                    const frontendUrl = (process.env.FRONTEND_URL ?? 'http://localhost:3001').replace(/\/$/, '');
                    const params = new URLSearchParams({ to, amount, ...(note ? { note } : {}) });
                    const url = `${frontendUrl}/spend?${params.toString()}`;
                    await ctx.reply(result.text, {
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [[
                                    { text: '💳 Open Payment', web_app: { url } },
                                ]],
                        },
                    });
                }
                else {
                    await ctx.reply(result.text, { parse_mode: 'HTML' });
                }
            }
            catch (err) {
                this.logger.error(`Chat error for ${telegramId}: ${err}`);
                await ctx.reply('⚠️ Something went wrong. Try again in a moment.');
            }
        });
    }
    async chatFull(telegramId, userId, userMessage) {
        if (this.llm.isStub) {
            return { text: await this.stubReply(userId, userMessage) };
        }
        const ms = this.market.getState();
        const pos = await this.positionModel.findOne({ userId }).lean();
        const lanePos = await this.lanePositionModel.findOne({ userId: new mongoose_2.Types.ObjectId(userId) }).lean();
        const systemPrompt = this.buildSystemPrompt(ms, pos, lanePos);
        try {
            const tools = [
                {
                    name: 'get_portfolio',
                    description: 'Get the user\'s full portfolio details including principal, yield, balances, and strategy allocation.',
                    parameters: { type: 'object', properties: {}, required: [] },
                },
                {
                    name: 'get_agent_decisions',
                    description: 'Get the latest AI agent decisions for Guardian, Balancer, and Hunter strategies.',
                    parameters: { type: 'object', properties: {}, required: [] },
                },
                {
                    name: 'get_market_data',
                    description: 'Get current live market APYs, utilization rates, and protocol data.',
                    parameters: { type: 'object', properties: {}, required: [] },
                },
                {
                    name: 'get_yield_projection',
                    description: 'Calculate yield projections (daily, monthly, yearly) based on current APYs.',
                    parameters: { type: 'object', properties: {}, required: [] },
                },
                {
                    name: 'initiate_payment',
                    description: 'Called when the user wants to send/pay USDC to an address. Generates a deep link to the web app spend page with the recipient and amount pre-filled so the user can sign the transaction with their own wallet.',
                    parameters: {
                        type: 'object',
                        properties: {
                            to_address: { type: 'string', description: 'The recipient wallet address' },
                            amount: { type: 'string', description: 'The amount of USDC to send' },
                            note: { type: 'string', description: 'Optional payment note or memo' },
                        },
                        required: ['to_address', 'amount'],
                    },
                },
            ];
            const toolHandler = async (name) => {
                const freshMs = this.market.getState();
                const freshPos = await this.positionModel.findOne({ userId }).lean();
                const freshLane = await this.lanePositionModel.findOne({ userId: new mongoose_2.Types.ObjectId(userId) }).lean();
                const alloc = freshPos?.strategyAllocation || { guardian: 100, balancer: 0, hunter: 0 };
                const blended = (alloc.guardian / 100) * freshMs.guardianAPY +
                    (alloc.balancer / 100) * freshMs.balancerAPY +
                    (alloc.hunter / 100) * freshMs.hunterAPY;
                if (name === 'get_portfolio') {
                    return {
                        principal: parseFloat(freshPos?.depositedPrincipal || '0'),
                        yieldEarned: Number(freshLane?.yieldBalance ?? 0),
                        advanceCredit: Number(freshLane?.liquidBalance ?? 0),
                        availableToSpend: Number(freshLane?.yieldBalance ?? 0) + Number(freshLane?.liquidBalance ?? 0),
                        allocation: alloc,
                        blendedAPY: blended,
                        status: freshPos?.status || 'no position',
                    };
                }
                if (name === 'get_agent_decisions') {
                    const decisions = {};
                    for (const id of ['guardian', 'balancer', 'hunter']) {
                        const latest = await this.decisionModel.findOne({ strategy: id }).sort({ createdAt: -1 }).lean();
                        decisions[id] = latest
                            ? {
                                decision: latest.decision,
                                reasoning: (latest.reasoning || '').slice(0, 300),
                                createdAt: latest.createdAt,
                                apy: freshMs[`${id}APY`],
                            }
                            : { decision: 'no runs yet' };
                    }
                    return decisions;
                }
                if (name === 'get_market_data') {
                    return {
                        guardianAPY: freshMs.guardianAPY,
                        balancerAPY: freshMs.balancerAPY,
                        hunterAPY: freshMs.hunterAPY,
                        srNusdAPY: freshMs.srNusdAPY,
                        oneDexStableAPY: freshMs.oneDexStableAPY,
                        oneDexVolatileAPY: freshMs.oneDexVolatileAPY,
                        morphoUtilization: freshMs.morphoUtilization,
                        lane1Spread: freshMs.lane1Spread,
                        openMarkets: freshMs.openMarkets,
                        highConfMarkets: freshMs.highConfMarkets,
                    };
                }
                if (name === 'get_yield_projection') {
                    const principal = parseFloat(freshPos?.depositedPrincipal || '0');
                    return {
                        dailyUSD: (principal * blended / 100) / 365,
                        monthlyUSD: (principal * blended / 100) / 12,
                        yearlyUSD: principal * blended / 100,
                        blendedAPY: blended,
                    };
                }
                if (name === 'initiate_payment') {
                    return { __payment: true };
                }
                return {};
            };
            const history = this.history.get(telegramId) ?? [];
            let fullMessage = userMessage;
            if (history.length > 0) {
                const historyText = history
                    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
                    .join('\n');
                fullMessage = `Previous conversation:\n${historyText}\n\nUser: ${userMessage}`;
            }
            const result = await this.llm.runAgentLoop(systemPrompt, fullMessage, tools, toolHandler);
            history.push({ role: 'user', content: userMessage });
            history.push({ role: 'assistant', content: result.finalText });
            if (history.length > MAX_HISTORY * 2)
                history.splice(0, 2);
            this.history.set(telegramId, history);
            const paymentCall = result.toolCallLog.find(t => t.name === 'initiate_payment');
            if (paymentCall) {
                const input = paymentCall.input;
                return {
                    text: this.toHtml(result.finalText),
                    payment: { to: input.to_address, amount: input.amount, note: input.note },
                };
            }
            return { text: this.toHtml(result.finalText) };
        }
        catch (err) {
            const status = err?.status ?? err?.response?.status;
            if (status === 401 || status === 403) {
                this.logger.warn(`LLM API key invalid (${status}) — falling back to stub replies`);
                return { text: await this.stubReply(userId, userMessage) };
            }
            throw err;
        }
    }
    buildSystemPrompt(ms, pos, lanePos) {
        const alloc = pos?.strategyAllocation || { guardian: 100, balancer: 0, hunter: 0 };
        const blended = (alloc.guardian / 100) * ms.guardianAPY +
            (alloc.balancer / 100) * ms.balancerAPY +
            (alloc.hunter / 100) * ms.hunterAPY;
        const yieldEarned = Number(lanePos?.yieldBalance ?? 0);
        const advanceCredit = Number(lanePos?.liquidBalance ?? 0);
        const availableToSpend = yieldEarned + advanceCredit;
        return `You are OneAI, an AI portfolio assistant for OneYield&Spend — a non-custodial DeFi yield-earning wallet on OneChain.
You are talking to a user via Telegram. Be concise, friendly, and use emojis naturally.

The user's portfolio snapshot:
- Principal deposited: $${parseFloat(pos?.depositedPrincipal || '0').toFixed(2)} USDC
- Yield earned (on-chain): $${yieldEarned.toFixed(6)} USDC
- Advance credit (70% LTV): $${advanceCredit.toFixed(2)} USDC
- Total available to spend: $${availableToSpend.toFixed(2)} USDC
- Blended APY: ${blended.toFixed(2)}%

Current market APYs:
- Guardian (conservative): ${ms.guardianAPY.toFixed(2)}%
- Balancer (medium risk): ${ms.balancerAPY.toFixed(2)}%
- Hunter (aggressive): ${ms.hunterAPY.toFixed(2)}%

CRITICAL — Spending / Payment Rules (NEVER break these):
- OneYield&Spend is 100% non-custodial. Payments ALWAYS require the user to sign with their own wallet key.
- Spending is available on: (1) the web app at any time, (2) iOS users via OneWallet mobile app.
- Android spending is NOT yet supported — OneWallet does not have an Android app yet.
- If a user asks to pay, send, transfer, or spend USDC to any address → ALWAYS call the initiate_payment tool immediately. NEVER give step-by-step instructions. NEVER attempt to process the payment yourself.
- After calling initiate_payment, respond with a short confirmation like: "💳 Tap below to open the payment in your wallet and sign the transaction."
- If the user has not provided a recipient address or amount, ask for them before calling initiate_payment.

How to respond:
- Answer questions directly using the data above or by calling tools for fresh/detailed data
- For portfolio, yield, agent, or market questions — ALWAYS call the relevant tool first
- Keep responses under 300 words
- Format numbers with $ and 2 decimal places for USD amounts
- Use Telegram HTML formatting: <b>bold</b>, <i>italic</i>, <code>monospace</code>
- Do NOT use markdown (no ** or __ syntax)
- Be helpful about DeFi concepts if the user asks
- If asked what you can do, list: check yield, portfolio, agent decisions, market rates, spending balance — and clarify that spending requires the web app or iOS wallet`;
    }
    async stubReply(userId, message) {
        const pos = await this.positionModel.findOne({ userId }).lean();
        const lanePos = await this.lanePositionModel.findOne({ userId: new mongoose_2.Types.ObjectId(userId) }).lean();
        const ms = this.market.getState();
        const lower = message.toLowerCase();
        const yieldEarned = Number(lanePos?.yieldBalance ?? 0);
        const advanceCredit = Number(lanePos?.liquidBalance ?? 0);
        if (lower.includes('yield') || lower.includes('earn')) {
            return `📈 You've earned <code>$${h(yieldEarned.toFixed(6))}</code> USDC so far.\nCurrent blended APY: ~${h(ms.guardianAPY.toFixed(2))}%`;
        }
        if (lower.includes('balance') || lower.includes('spend') || lower.includes('liquid')) {
            return `💧 Available to spend: <code>$${h((yieldEarned + advanceCredit).toFixed(2))}</code> USDC (yield: $${h(yieldEarned.toFixed(4))} + advance: $${h(advanceCredit.toFixed(2))})`;
        }
        if (lower.includes('agent') || lower.includes('guardian') || lower.includes('balancer') || lower.includes('hunter')) {
            return `🤖 Agent APYs right now:\n🛡️ Guardian: ${h(ms.guardianAPY.toFixed(2))}%\n⚖️ Balancer: ${h(ms.balancerAPY.toFixed(2))}%\n🎯 Hunter: ${h(ms.hunterAPY.toFixed(2))}%`;
        }
        if (lower.includes('portfolio') || lower.includes('position')) {
            const principal = parseFloat(pos?.depositedPrincipal || '0');
            return `📊 Principal: <code>$${h(principal.toFixed(2))}</code>\nYield earned: <code>$${h(yieldEarned.toFixed(6))}</code>\nAvailable to spend: <code>$${h((yieldEarned + advanceCredit).toFixed(2))}</code>`;
        }
        return `👋 I can answer questions about your yield, portfolio, agent decisions, and spending balance. What would you like to know?`;
    }
    toHtml(text) {
        return text
            .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
            .replace(/\*(.+?)\*/g, '<i>$1</i>')
            .replace(/__(.+?)__/g, '<b>$1</b>')
            .replace(/_(.+?)_/g, '<i>$1</i>')
            .replace(/`(.+?)`/g, '<code>$1</code>')
            .replace(/&(?!amp;|lt;|gt;)/g, '&amp;')
            .replace(/<(?!b>|\/b>|i>|\/i>|code>|\/code>)/g, '&lt;');
    }
    async broadcastAgentDecision(strategyId, decision, reasoning, currentAPY) {
        if (!this.bot)
            return;
        const emoji = AGENT_EMOJI[strategyId];
        const label = AGENT_LABEL[strategyId];
        const action = decision === 'rebalance' ? '🔄 <b>Rebalanced</b>' : '✅ <b>Hold</b>';
        const summary = (reasoning || '')
            .split('\n').find((l) => l.trim().length > 20 && !l.startsWith('Capital'))
            ?.slice(0, 140) ?? '';
        const message = `${emoji} <b>${label} Agent Decision</b>\n\n` +
            `Decision: ${action}\n` +
            `Current APY: <b>${h(currentAPY.toFixed(2))}%</b>\n\n` +
            (summary ? `💬 <i>${h(summary)}</i>\n\n` : '') +
            `Reply or ask me anything about your portfolio.`;
        const users = await this.userModel.find({
            telegramLinked: true,
            telegramId: { $exists: true, $ne: '' },
        }).lean();
        let sent = 0;
        for (const user of users) {
            try {
                await this.bot.api.sendMessage(user.telegramId, message, { parse_mode: 'HTML' });
                sent++;
            }
            catch {
            }
        }
        if (sent > 0)
            this.logger.log(`broadcastAgentDecision [${strategyId}:${decision}] → ${sent} user(s)`);
    }
    async sendAlert(telegramId, message) {
        if (!this.bot || !telegramId)
            return;
        try {
            await this.bot.api.sendMessage(telegramId, message, { parse_mode: 'HTML' });
        }
        catch (err) {
            this.logger.error(`Alert failed for ${telegramId}`, err);
        }
    }
};
exports.TelegramService = TelegramService;
exports.TelegramService = TelegramService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __param(1, (0, mongoose_1.InjectModel)(position_schema_1.Position.name)),
    __param(2, (0, mongoose_1.InjectModel)(agent_decision_schema_1.AgentDecision.name)),
    __param(3, (0, mongoose_1.InjectModel)(lane_position_schema_1.LanePosition.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        market_simulator_service_1.MarketSimulatorService,
        llm_adapter_1.LLMAdapter])
], TelegramService);
//# sourceMappingURL=telegram.service.js.map