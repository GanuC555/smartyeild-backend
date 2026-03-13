import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Position } from '../../common/schemas/position.schema';

const STRATEGY_APY = { guardian: 6.2, balancer: 12.8, hunter: 24.7 };

/** Simulates on-chain yield accrual every 30s in DEMO_MODE */
@Injectable()
export class DemoYieldService implements OnModuleInit {
  private readonly logger = new Logger('DemoYieldService');

  constructor(
    @InjectModel(Position.name) private positionModel: Model<Position>,
  ) {}

  onModuleInit() {
    if (process.env.DEMO_MODE !== 'true') return;
    this.logger.log('Demo yield accrual started (every 30s)');
    setInterval(() => this.accrueYield(), 30_000);
  }

  private async accrueYield() {
    const positions = await this.positionModel.find({ status: 'active' });
    for (const pos of positions) {
      const principal = parseFloat(pos.depositedPrincipal || '0');
      if (principal <= 0) continue;

      const alloc = pos.strategyAllocation || {
        guardian: 100,
        balancer: 0,
        hunter: 0,
      };
      const blendedAPY =
        (alloc.guardian * STRATEGY_APY.guardian +
          alloc.balancer * STRATEGY_APY.balancer +
          alloc.hunter * STRATEGY_APY.hunter) /
        100;

      // 30-second slice of annual yield
      const slice = (principal * (blendedAPY / 100)) / (365 * 24 * 120);
      pos.accruedYield = (
        parseFloat(pos.accruedYield || '0') + slice
      ).toFixed(8);
      await pos.save();
    }
  }
}
