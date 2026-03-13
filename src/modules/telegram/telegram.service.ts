import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../common/schemas/user.schema';
import { Position } from '../../common/schemas/position.schema';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger('TelegramService');
  private bot: any = null;

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Position.name) private positionModel: Model<Position>,
  ) {}

  async onModuleInit() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (
      !token ||
      token === 'your_telegram_bot_token_here'
    ) {
      this.logger.warn('Telegram bot disabled — set TELEGRAM_BOT_TOKEN to enable');
      return;
    }

    try {
      const { Bot } = await import('grammy');
      this.bot = new Bot(token);
      this.setupCommands();
      this.bot.start();
      this.logger.log('Telegram bot started');
    } catch (err) {
      this.logger.error('Telegram bot failed to start', err);
    }
  }

  private setupCommands() {
    if (!this.bot) return;

    this.bot.command('start', async (ctx: any) => {
      await ctx.reply(
        '👋 Welcome to *OneYield&Spend*!\n\n' +
          'Commands:\n' +
          '/link <platform-id> — Link your account\n' +
          '/portfolio — View your portfolio\n' +
          '/yield — Check yield earned\n\n' +
          'Get your Platform ID from the web app *Settings* page.',
        { parse_mode: 'Markdown' },
      );
    });

    this.bot.command('link', async (ctx: any) => {
      const platformId = ctx.message.text.split(' ')[1]?.toUpperCase();
      if (!platformId) {
        await ctx.reply('Usage: /link OYS-XXXX\n\nFind your Platform ID in the web app Settings.');
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
      await ctx.reply(
        `✅ Account linked!\n\nPlatform ID: *${platformId}*\nYou'll receive yield alerts and agent updates here.`,
        { parse_mode: 'Markdown' },
      );
    });

    this.bot.command('portfolio', async (ctx: any) => {
      const user = await this.userModel.findOne({
        telegramId: ctx.from.id.toString(),
      });
      if (!user) {
        await ctx.reply('❌ Not linked. Use /link <platform-id>');
        return;
      }
      const pos = await this.positionModel.findOne({
        userId: user._id.toString(),
      });
      if (!pos) {
        await ctx.reply('No positions yet. Deposit USDC on the web app.');
        return;
      }
      await ctx.reply(
        `📊 *Your Portfolio*\n\n` +
          `💰 Principal: ${parseFloat(pos.depositedPrincipal).toFixed(2)} USDC\n` +
          `📈 Yield: ${parseFloat(pos.accruedYield).toFixed(6)} USDC\n` +
          `💧 Liquid: ${parseFloat(pos.liquidBalance).toFixed(2)} USDC\n` +
          `⚡ Strategy Pool: ${parseFloat(pos.strategyPoolBalance).toFixed(2)} USDC\n\n` +
          `Allocation: Guardian ${pos.strategyAllocation?.guardian || 0}% | ` +
          `Balancer ${pos.strategyAllocation?.balancer || 0}% | ` +
          `Hunter ${pos.strategyAllocation?.hunter || 0}%`,
        { parse_mode: 'Markdown' },
      );
    });

    this.bot.command('yield', async (ctx: any) => {
      const user = await this.userModel.findOne({
        telegramId: ctx.from.id.toString(),
      });
      if (!user) { await ctx.reply('❌ Not linked. Use /link <platform-id>'); return; }
      const pos = await this.positionModel.findOne({
        userId: user._id.toString(),
      });
      if (!pos) { await ctx.reply('No deposits yet.'); return; }
      const daily = (parseFloat(pos.depositedPrincipal) * 0.125) / 365;
      await ctx.reply(
        `💸 Yield Earned: *${parseFloat(pos.accruedYield).toFixed(6)} USDC*\n` +
          `📅 Daily Rate: ~${daily.toFixed(4)} USDC/day\n\n` +
          `Spend it via P2P Transfer on the web app!`,
        { parse_mode: 'Markdown' },
      );
    });
  }

  async sendAlert(telegramId: string, message: string) {
    if (!this.bot || !telegramId) return;
    try {
      await this.bot.api.sendMessage(telegramId, message, {
        parse_mode: 'Markdown',
      });
    } catch (err) {
      this.logger.error(`Alert failed for ${telegramId}`, err);
    }
  }
}
