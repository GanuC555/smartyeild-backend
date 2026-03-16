import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../common/schemas/user.schema';
import { Position } from '../../common/schemas/position.schema';
import { AgentDecision } from '../../common/schemas/agent-decision.schema';
import { MarketSimulatorService } from '../../common/market/market-simulator.service';
import { LLMAdapter } from '../../common/llm/llm.adapter';

const AGENT_EMOJI = { guardian: '🛡️', balancer: '⚖️', hunter: '🎯' };
const AGENT_LABEL = { guardian: 'Guardian', balancer: 'Balancer', hunter: 'Hunter' };

/** Escape HTML special chars for Telegram HTML parse_mode */
const h = (s: string | number) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const MAX_HISTORY = 10; // turns to keep per user

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger('TelegramService');
  private bot: any = null;

  // In-memory conversation history keyed by telegramId
  private readonly history = new Map<string, Array<{ role: 'user' | 'assistant'; content: string }>>();

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Position.name) private positionModel: Model<Position>,
    @InjectModel(AgentDecision.name) private decisionModel: Model<AgentDecision>,
    private readonly market: MarketSimulatorService,
    private readonly llm: LLMAdapter,
  ) {}

  async onModuleInit() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token || token === 'your_telegram_bot_token_here') {
      this.logger.warn('Telegram bot disabled — set TELEGRAM_BOT_TOKEN to enable');
      return;
    }
    try {
      const { Bot } = await import('grammy');
      this.bot = new Bot(token);

      this.bot.catch((err: any) => {
        this.logger.error(`Bot error: ${err.message ?? err}`);
      });

      this.setupHandlers();
      this.bot.start();
      this.logger.log(`Telegram AI chatbot started (LLM: ${this.llm.provider}/${this.llm.model})`);
    } catch (err) {
      this.logger.error('Telegram bot failed to start', err);
    }
  }

  private setupHandlers() {
    if (!this.bot) return;

    // /link stays as a command — it's account setup, not a question
    this.bot.command('link', async (ctx: any) => {
      const platformId = ctx.message.text.split(' ')[1]?.toUpperCase();
      if (!platformId) {
        await ctx.reply(
          'To link your account, send:\n<code>/link OYS-XXXX</code>\n\nFind your Platform ID in <b>Settings</b> on the web app.',
          { parse_mode: 'HTML' },
        );
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
      // Clear old history on re-link
      this.history.delete(ctx.from.id.toString());
      await ctx.reply(
        `✅ <b>Account linked!</b>\n\n` +
        `Platform ID: <code>${h(platformId)}</code>\n\n` +
        `You can now ask me anything about your portfolio, yield, agents, or spending. Just type naturally!\n\n` +
        `Try: <i>"How much yield have I earned?"</i> or <i>"What are the agents doing?"</i>`,
        { parse_mode: 'HTML' },
      );
    });

    // /start — welcome without account requirement
    this.bot.command('start', async (ctx: any) => {
      const user = await this.userModel.findOne({ telegramId: ctx.from.id.toString() });
      if (user) {
        await ctx.reply(
          `👋 <b>Welcome back!</b>\n\nAsk me anything about your OneYield portfolio. I understand natural language.\n\n` +
          `<i>Examples:</i>\n` +
          `• "How much have I earned?"\n` +
          `• "What is Guardian agent doing?"\n` +
          `• "How much can I spend?"\n` +
          `• "Show me the market APYs"`,
          { parse_mode: 'HTML' },
        );
      } else {
        await ctx.reply(
          `👋 <b>Welcome to OneYield&amp;Spend!</b>\n\n` +
          `I'm your AI portfolio assistant. To get started, link your account:\n\n` +
          `<code>/link OYS-XXXX</code>\n\n` +
          `Get your Platform ID from <b>Settings</b> in the web app.`,
          { parse_mode: 'HTML' },
        );
      }
    });

    // /clear — reset conversation history
    this.bot.command('clear', async (ctx: any) => {
      this.history.delete(ctx.from.id.toString());
      await ctx.reply('🧹 Conversation cleared. Start fresh!');
    });

    // All other text messages → AI chatbot
    this.bot.on('message:text', async (ctx: any) => {
      const text: string = ctx.message.text ?? '';
      if (text.startsWith('/')) return; // ignore unknown commands

      const telegramId = ctx.from.id.toString();

      // Must be linked to use the chatbot
      const user = await this.userModel.findOne({ telegramId });
      if (!user) {
        await ctx.reply(
          '👋 Link your account first:\n\n<code>/link OYS-XXXX</code>\n\nFind your Platform ID in Settings on the web app.',
          { parse_mode: 'HTML' },
        );
        return;
      }

      // Show typing indicator
      await ctx.replyWithChatAction('typing');

      try {
        const reply = await this.chat(telegramId, user._id.toString(), text);
        await ctx.reply(reply, { parse_mode: 'HTML' });
      } catch (err) {
        this.logger.error(`Chat error for ${telegramId}: ${err}`);
        await ctx.reply('⚠️ Something went wrong. Try again in a moment.');
      }
    });
  }

  // ── Core AI chat handler ──────────────────────────────────────────────────

  private async chat(telegramId: string, userId: string, userMessage: string): Promise<string> {
    if (this.llm.isStub) {
      return this.stubReply(userId, userMessage);
    }

    const ms  = this.market.getState();
    const pos = await this.positionModel.findOne({ userId }).lean();

    const systemPrompt = this.buildSystemPrompt(ms, pos);

    // Tools the LLM can call
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
    ];

    const toolHandler = async (name: string): Promise<unknown> => {
      const freshMs  = this.market.getState();
      const freshPos = await this.positionModel.findOne({ userId }).lean() as any;
      const alloc    = freshPos?.strategyAllocation || { guardian: 100, balancer: 0, hunter: 0 };
      const blended  =
        (alloc.guardian / 100) * freshMs.guardianAPY +
        (alloc.balancer / 100) * freshMs.balancerAPY +
        (alloc.hunter   / 100) * freshMs.hunterAPY;

      if (name === 'get_portfolio') {
        return {
          principal:     parseFloat(freshPos?.depositedPrincipal || '0'),
          accruedYield:  parseFloat(freshPos?.accruedYield || '0'),
          liquidBalance: parseFloat(freshPos?.liquidBalance || '0'),
          strategyPool:  parseFloat(freshPos?.strategyPoolBalance || '0'),
          allocation:    alloc,
          blendedAPY:    blended,
          status:        freshPos?.status || 'no position',
        };
      }

      if (name === 'get_agent_decisions') {
        const decisions: Record<string, any> = {};
        for (const id of ['guardian', 'balancer', 'hunter'] as const) {
          const latest = await this.decisionModel.findOne({ strategy: id }).sort({ createdAt: -1 }).lean() as any;
          decisions[id] = latest
            ? {
                decision:  latest.decision,
                reasoning: (latest.reasoning || '').slice(0, 300),
                createdAt: latest.createdAt,
                apy:       freshMs[`${id}APY` as keyof typeof freshMs],
              }
            : { decision: 'no runs yet' };
        }
        return decisions;
      }

      if (name === 'get_market_data') {
        return {
          guardianAPY:        freshMs.guardianAPY,
          balancerAPY:        freshMs.balancerAPY,
          hunterAPY:          freshMs.hunterAPY,
          srNusdAPY:          freshMs.srNusdAPY,
          oneDexStableAPY:    freshMs.oneDexStableAPY,
          oneDexVolatileAPY:  freshMs.oneDexVolatileAPY,
          morphoUtilization:  freshMs.morphoUtilization,
          lane1Spread:        freshMs.lane1Spread,
          openMarkets:        freshMs.openMarkets,
          highConfMarkets:    freshMs.highConfMarkets,
        };
      }

      if (name === 'get_yield_projection') {
        const principal = parseFloat(freshPos?.depositedPrincipal || '0');
        return {
          dailyUSD:   (principal * blended / 100) / 365,
          monthlyUSD: (principal * blended / 100) / 12,
          yearlyUSD:   principal * blended / 100,
          blendedAPY: blended,
        };
      }

      return {};
    };

    // Build messages with history
    const history = this.history.get(telegramId) ?? [];

    // Prepend history context as a single user message if exists
    let fullMessage = userMessage;
    if (history.length > 0) {
      const historyText = history
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');
      fullMessage = `Previous conversation:\n${historyText}\n\nUser: ${userMessage}`;
    }

    const result = await this.llm.runAgentLoop(systemPrompt, fullMessage, tools, toolHandler);

    // Update history
    history.push({ role: 'user', content: userMessage });
    history.push({ role: 'assistant', content: result.finalText });
    if (history.length > MAX_HISTORY * 2) history.splice(0, 2); // drop oldest pair
    this.history.set(telegramId, history);

    // Convert markdown-style bold/italic to HTML for Telegram
    return this.toHtml(result.finalText);
  }

  // ── System prompt ─────────────────────────────────────────────────────────

  private buildSystemPrompt(ms: any, pos: any): string {
    const alloc = pos?.strategyAllocation || { guardian: 100, balancer: 0, hunter: 0 };
    const blended =
      (alloc.guardian / 100) * ms.guardianAPY +
      (alloc.balancer / 100) * ms.balancerAPY +
      (alloc.hunter   / 100) * ms.hunterAPY;

    return `You are Ava, an AI portfolio assistant for OneYield&Spend — a DeFi yield-earning wallet on OneChain.
You are talking to a user via Telegram. Be concise, friendly, and use emojis naturally.

The user's portfolio snapshot:
- Principal deposited: $${parseFloat(pos?.depositedPrincipal || '0').toFixed(2)} USDC
- Accrued yield: $${parseFloat(pos?.accruedYield || '0').toFixed(6)} USDC
- Liquid (spendable): $${parseFloat(pos?.liquidBalance || '0').toFixed(2)} USDC
- Blended APY: ${blended.toFixed(2)}%

Current market APYs:
- Guardian (conservative): ${ms.guardianAPY.toFixed(2)}%
- Balancer (medium risk): ${ms.balancerAPY.toFixed(2)}%
- Hunter (aggressive): ${ms.hunterAPY.toFixed(2)}%

How to respond:
- Answer questions directly using the data above or by calling tools for fresh/detailed data
- For portfolio, yield, agent, or market questions — ALWAYS call the relevant tool first
- Keep responses under 300 words
- Format numbers with $ and 2 decimal places for USD amounts
- Use Telegram HTML formatting: <b>bold</b>, <i>italic</i>, <code>monospace</code>
- Do NOT use markdown (no ** or __ syntax)
- Be helpful about DeFi concepts if the user asks
- If asked what you can do, list: check yield, portfolio, agent decisions, market rates, spending balance`;
  }

  // ── Stub reply when no LLM is configured ─────────────────────────────────

  private async stubReply(userId: string, message: string): Promise<string> {
    const pos = await this.positionModel.findOne({ userId }).lean() as any;
    const ms  = this.market.getState();
    const lower = message.toLowerCase();

    if (lower.includes('yield') || lower.includes('earn')) {
      const accrued = parseFloat(pos?.accruedYield || '0');
      return `📈 You've earned <code>$${h(accrued.toFixed(6))}</code> USDC so far.\nCurrent blended APY: ~${h(ms.guardianAPY.toFixed(2))}%`;
    }
    if (lower.includes('balance') || lower.includes('spend') || lower.includes('liquid')) {
      const liquid = parseFloat(pos?.liquidBalance || '0');
      return `💧 Available to spend: <code>$${h(liquid.toFixed(2))}</code> USDC`;
    }
    if (lower.includes('agent') || lower.includes('guardian') || lower.includes('balancer') || lower.includes('hunter')) {
      return `🤖 Agent APYs right now:\n🛡️ Guardian: ${h(ms.guardianAPY.toFixed(2))}%\n⚖️ Balancer: ${h(ms.balancerAPY.toFixed(2))}%\n🎯 Hunter: ${h(ms.hunterAPY.toFixed(2))}%`;
    }
    if (lower.includes('portfolio') || lower.includes('position')) {
      const principal = parseFloat(pos?.depositedPrincipal || '0');
      return `📊 Principal: <code>$${h(principal.toFixed(2))}</code>\nYield: <code>$${h(parseFloat(pos?.accruedYield || '0').toFixed(6))}</code>`;
    }

    return `👋 I can answer questions about your yield, portfolio, agent decisions, and spending balance. What would you like to know?`;
  }

  // ── Convert LLM markdown output to Telegram HTML ──────────────────────────

  private toHtml(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/\*(.+?)\*/g, '<i>$1</i>')
      .replace(/__(.+?)__/g, '<b>$1</b>')
      .replace(/_(.+?)_/g, '<i>$1</i>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/&(?!amp;|lt;|gt;)/g, '&amp;')
      .replace(/<(?!b>|\/b>|i>|\/i>|code>|\/code>)/g, '&lt;');
  }

  // ── Push notification: called by AgentService after each decision ─────────

  async broadcastAgentDecision(
    strategyId: 'guardian' | 'balancer' | 'hunter',
    decision: string,
    reasoning: string,
    currentAPY: number,
  ) {
    if (!this.bot) return;

    const emoji  = AGENT_EMOJI[strategyId];
    const label  = AGENT_LABEL[strategyId];
    const action = decision === 'rebalance' ? '🔄 <b>Rebalanced</b>' : '✅ <b>Hold</b>';
    const summary = (reasoning || '')
      .split('\n').find((l: string) => l.trim().length > 20 && !l.startsWith('Capital'))
      ?.slice(0, 140) ?? '';

    const message =
      `${emoji} <b>${label} Agent Decision</b>\n\n` +
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
      } catch {
        // user blocked bot — skip
      }
    }
    if (sent > 0) this.logger.log(`broadcastAgentDecision [${strategyId}:${decision}] → ${sent} user(s)`);
  }

  // ── Direct alert to a single user ────────────────────────────────────────

  async sendAlert(telegramId: string, message: string) {
    if (!this.bot || !telegramId) return;
    try {
      await this.bot.api.sendMessage(telegramId, message, { parse_mode: 'HTML' });
    } catch (err) {
      this.logger.error(`Alert failed for ${telegramId}`, err);
    }
  }

}
