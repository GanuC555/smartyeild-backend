import { OnModuleInit } from '@nestjs/common';
import { Model } from 'mongoose';
import { User } from '../../common/schemas/user.schema';
import { Position } from '../../common/schemas/position.schema';
export declare class TelegramService implements OnModuleInit {
    private userModel;
    private positionModel;
    private readonly logger;
    private bot;
    constructor(userModel: Model<User>, positionModel: Model<Position>);
    onModuleInit(): Promise<void>;
    private setupCommands;
    sendAlert(telegramId: string, message: string): Promise<void>;
}
