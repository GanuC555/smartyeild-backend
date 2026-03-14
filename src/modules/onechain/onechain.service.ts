import { Injectable } from '@nestjs/common';
import { OneChainAdapterService } from '../../adapters/onechain/OneChainAdapterService';
import { SpendBalance, VaultPosition } from '../../adapters/onechain/IOneChainAdapter';

@Injectable()
export class OneChainService {
  constructor(private readonly adapter: OneChainAdapterService) {}

  async isOnline(): Promise<boolean> {
    return this.adapter.ping();
  }

  async getSpendBalance(userAddress: string): Promise<SpendBalance> {
    return this.adapter.getSpendBalance(userAddress);
  }

  async getVaultPosition(userAddress: string): Promise<VaultPosition | null> {
    return this.adapter.getVaultPosition(userAddress);
  }

  async getTotalDeposits(): Promise<bigint> {
    return this.adapter.getTotalDeposits();
  }

  getPackageId(): string {
    return this.adapter.getPackageId();
  }
}
