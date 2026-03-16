import { OnModuleInit } from '@nestjs/common';
import { Model } from 'mongoose';
import { User } from '../../common/schemas/user.schema';
import { Position } from '../../common/schemas/position.schema';
import { AgentDecision } from '../../common/schemas/agent-decision.schema';
import { MarketSimulatorService } from '../../common/market/market-simulator.service';
import { LLMAdapter } from '../../common/llm/llm.adapter';
export declare class TelegramService implements OnModuleInit {
    private userModel;
    private positionModel;
    private decisionModel;
    private readonly market;
    private readonly llm;
    private readonly logger;
    private bot;
    private readonly history;
    constructor(userModel: Model<User>, positionModel: Model<Position>, decisionModel: Model<AgentDecision>, market: MarketSimulatorService, llm: LLMAdapter);
    onModuleInit(): Promise<void>;
    private setupHandlers;
    private chat;
    private buildSystemPrompt;
    private stubReply;
    private toHtml;
    broadcastAgentDecision(strategyId: 'guardian' | 'balancer' | 'hunter', decision: string, reasoning: string, currentAPY: number): Promise<void>;
    sendAlert(telegramId: string, message: string): Promise<void>;
}
