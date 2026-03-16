import { OnModuleInit } from '@nestjs/common';
import { Model } from 'mongoose';
import { Position } from '../../common/schemas/position.schema';
import { MarketSimulatorService } from '../../common/market/market-simulator.service';
export declare class DemoYieldService implements OnModuleInit {
    private positionModel;
    private readonly market;
    private readonly logger;
    constructor(positionModel: Model<Position>, market: MarketSimulatorService);
    onModuleInit(): void;
    private accrueYield;
}
