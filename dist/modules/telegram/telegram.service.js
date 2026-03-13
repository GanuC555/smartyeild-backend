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
let TelegramService = class TelegramService {
    constructor(userModel, positionModel) {
        this.userModel = userModel;
        this.positionModel = positionModel;
        this.logger = new common_1.Logger('TelegramService');
        this.bot = null;
    }
    async onModuleInit() {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token ||
            token === 'your_telegram_bot_token_here') {
            this.logger.warn('Telegram bot disabled — set TELEGRAM_BOT_TOKEN to enable');
            return;
        }
        try {
            const { Bot } = await Promise.resolve().then(() => require('grammy'));
            this.bot = new Bot(token);
            this.setupCommands();
            this.bot.start();
            this.logger.log('Telegram bot started');
        }
        catch (err) {
            this.logger.error('Telegram bot failed to start', err);
        }
    }
    setupCommands() {
        if (!this.bot)
            return;
        this.bot.command('start', async (ctx) => {
            await ctx.reply('👋 Welcome to *OneYield&Spend*!\n\n' +
                'Commands:\n' +
                '/link <platform-id> — Link your account\n' +
                '/portfolio — View your portfolio\n' +
                '/yield — Check yield earned\n\n' +
                'Get your Platform ID from the web app *Settings* page.', { parse_mode: 'Markdown' });
        });
        this.bot.command('link', async (ctx) => {
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
            await ctx.reply(`✅ Account linked!\n\nPlatform ID: *${platformId}*\nYou'll receive yield alerts and agent updates here.`, { parse_mode: 'Markdown' });
        });
        this.bot.command('portfolio', async (ctx) => {
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
            await ctx.reply(`📊 *Your Portfolio*\n\n` +
                `💰 Principal: ${parseFloat(pos.depositedPrincipal).toFixed(2)} USDC\n` +
                `📈 Yield: ${parseFloat(pos.accruedYield).toFixed(6)} USDC\n` +
                `💧 Liquid: ${parseFloat(pos.liquidBalance).toFixed(2)} USDC\n` +
                `⚡ Strategy Pool: ${parseFloat(pos.strategyPoolBalance).toFixed(2)} USDC\n\n` +
                `Allocation: Guardian ${pos.strategyAllocation?.guardian || 0}% | ` +
                `Balancer ${pos.strategyAllocation?.balancer || 0}% | ` +
                `Hunter ${pos.strategyAllocation?.hunter || 0}%`, { parse_mode: 'Markdown' });
        });
        this.bot.command('yield', async (ctx) => {
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
                await ctx.reply('No deposits yet.');
                return;
            }
            const daily = (parseFloat(pos.depositedPrincipal) * 0.125) / 365;
            await ctx.reply(`💸 Yield Earned: *${parseFloat(pos.accruedYield).toFixed(6)} USDC*\n` +
                `📅 Daily Rate: ~${daily.toFixed(4)} USDC/day\n\n` +
                `Spend it via P2P Transfer on the web app!`, { parse_mode: 'Markdown' });
        });
    }
    async sendAlert(telegramId, message) {
        if (!this.bot || !telegramId)
            return;
        try {
            await this.bot.api.sendMessage(telegramId, message, {
                parse_mode: 'Markdown',
            });
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
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], TelegramService);
//# sourceMappingURL=telegram.service.js.map