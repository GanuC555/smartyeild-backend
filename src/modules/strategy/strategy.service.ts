import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Position } from '../../common/schemas/position.schema';
import { MarketSimulatorService } from '../../common/market/market-simulator.service';

export const STRATEGIES = {
  guardian: {
    id: 'guardian',
    name: 'The Guardian',
    emoji: '🛡️',
    riskLevel: 1,
    targetAPYMin: 5,
    targetAPYMax: 8,
    currentAPY: 6.2,
    description:
      'Invests in tokenized US Treasury bills and USDC lending. No prediction markets, no volatile assets.',
    protocols: [
      {
        name: 'sUSDS (Tokenized US T-bills)',
        description: 'Your USDC earns yield from actual US government bonds.',
        apy: 5.1,
      },
      {
        name: 'Navi Protocol USDC Pool',
        description: 'Lending protocol — borrowers pay interest on USDC.',
        apy: 7.3,
      },
    ],
    whitelistedAddresses: ['0xsUSDS', '0xNAVI_USDC', '0xMOCK_STRATEGY'],
    rebalanceThreshold: 2,
    maxSingleAllocation: 80,
    minIdlePercent: 20,
    rebalanceInterval: 30,
  },
  balancer: {
    id: 'balancer',
    name: 'The Balancer',
    emoji: '⚖️',
    riskLevel: 2,
    targetAPYMin: 10,
    targetAPYMax: 15,
    currentAPY: 12.8,
    description:
      'Maintains a 30% T-bill floor while reaching higher returns through stablecoin DEX liquidity.',
    protocols: [
      {
        name: 'sUSDS (RWA Floor)',
        description: '30% always in T-bills as safety floor.',
        apy: 5.1,
      },
      {
        name: 'Navi Protocol USDC Pool',
        description: 'USDC lending.',
        apy: 7.3,
      },
      {
        name: 'OneDex USDC/USDT Stable LP',
        description:
          'Liquidity on stable trading pair — minimal impermanent loss.',
        apy: 12.4,
      },
    ],
    whitelistedAddresses: [
      '0xsUSDS',
      '0xNAVI_USDC',
      '0xONEDEX_STABLE',
      '0xMOCK_STRATEGY',
    ],
    rebalanceThreshold: 4,
    maxSingleAllocation: 60,
    minIdlePercent: 20,
    rebalanceInterval: 360,
  },
  hunter: {
    id: 'hunter',
    name: 'The Hunter',
    emoji: '🎯',
    riskLevel: 3,
    targetAPYMin: 20,
    targetAPYMax: 35,
    currentAPY: 24.7,
    description:
      'Maximum yield using volatile DEX pairs and prediction market liquidity. High risk, high reward.',
    protocols: [
      {
        name: 'OneDex OCT/USDC LP',
        description:
          'Volatile trading pair LP — higher fees, higher impermanent loss risk.',
        apy: 28.3,
      },
      {
        name: 'OnePredice Markets',
        description:
          'AI identifies high-confidence prediction market outcomes as liquidity provider.',
        apy: 22.1,
      },
    ],
    whitelistedAddresses: [
      '0xONEDEX_VOLATILE',
      '0xONEPREDICE',
      '0xMOCK_STRATEGY',
    ],
    rebalanceThreshold: 5,
    maxSingleAllocation: 60,
    minIdlePercent: 15,
    rebalanceInterval: 15,
  },
};

@Injectable()
export class StrategyService {
  constructor(
    @InjectModel(Position.name) private positionModel: Model<Position>,
    private readonly market: MarketSimulatorService,
  ) {}

  getStrategies() {
    const mkt = this.market.getState();
    return Object.values(STRATEGIES).map((s) => ({
      ...s,
      currentAPY:
        s.id === 'guardian' ? mkt.guardianAPY :
        s.id === 'balancer' ? mkt.balancerAPY :
        mkt.hunterAPY,
    }));
  }

  getStrategy(id: string) {
    const s = STRATEGIES[id];
    if (!s) return null;
    const mkt = this.market.getState();
    return {
      ...s,
      currentAPY:
        id === 'guardian' ? mkt.guardianAPY :
        id === 'balancer' ? mkt.balancerAPY :
        mkt.hunterAPY,
    };
  }

  async allocate(
    userId: string,
    allocation: { guardian?: number; balancer?: number; hunter?: number },
  ) {
    const total =
      (allocation.guardian || 0) +
      (allocation.balancer || 0) +
      (allocation.hunter || 0);
    if (Math.abs(total - 100) > 0.5) {
      throw new BadRequestException(
        `Allocation must sum to 100%. Got ${total}%`,
      );
    }

    const position = await this.positionModel.findOne({ userId });
    if (!position)
      throw new BadRequestException(
        'No position found. Make a deposit first.',
      );

    position.strategyAllocation = {
      guardian: allocation.guardian || 0,
      balancer: allocation.balancer || 0,
      hunter: allocation.hunter || 0,
    };
    await position.save();

    return {
      message: 'Strategy allocation updated',
      allocation: position.strategyAllocation,
      blendedAPY: this.calculateBlendedAPY(position.strategyAllocation),
    };
  }

  async getMyAllocation(userId: string) {
    const position = await this.positionModel.findOne({ userId }).lean();
    if (!position)
      return {
        allocation: { guardian: 0, balancer: 0, hunter: 0 },
        capital: {},
        blendedAPY: 0,
      };

    const stratPool = parseFloat(position.strategyPoolBalance || '0');
    const alloc = position.strategyAllocation || {
      guardian: 100,
      balancer: 0,
      hunter: 0,
    };

    return {
      allocation: alloc,
      capital: {
        guardian: ((alloc.guardian / 100) * stratPool).toFixed(6),
        balancer: ((alloc.balancer / 100) * stratPool).toFixed(6),
        hunter: ((alloc.hunter / 100) * stratPool).toFixed(6),
      },
      strategyPoolTotal: stratPool.toFixed(6),
      blendedAPY: this.calculateBlendedAPY(alloc),
    };
  }

  calculateBlendedAPY(alloc: {
    guardian: number;
    balancer: number;
    hunter: number;
  }) {
    const mkt = this.market.getState();
    return parseFloat(
      (
        (alloc.guardian / 100) * mkt.guardianAPY +
        (alloc.balancer / 100) * mkt.balancerAPY +
        (alloc.hunter / 100) * mkt.hunterAPY
      ).toFixed(2),
    );
  }

  isWhitelisted(strategyId: string, address: string): boolean {
    return (
      STRATEGIES[strategyId]?.whitelistedAddresses.includes(address) ?? false
    );
  }
}
