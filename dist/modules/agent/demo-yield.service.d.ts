import { OnModuleInit } from '@nestjs/common';
import { Model } from 'mongoose';
import { Position } from '../../common/schemas/position.schema';
export declare class DemoYieldService implements OnModuleInit {
    private positionModel;
    private readonly logger;
    constructor(positionModel: Model<Position>);
    onModuleInit(): void;
    private accrueYield;
}
