import { Injectable } from '@nestjs/common';
import { IPriceOracle } from './IPriceOracle';

@Injectable()
export class MockPriceOracle implements IPriceOracle {
  // PT at 12% discount: 0.88 USDC per 1 PT face value
  async getPTPrice(): Promise<bigint> { return BigInt(Math.floor(0.88 * 1e18)); }
  // YT = 1 - PT (complementary)
  async getYTPrice(): Promise<bigint> { return BigInt(Math.floor(0.12 * 1e18)); }
  // srNUSD 1:1 with USDC on testnet
  async getSrNUSDPrice(): Promise<bigint> { return BigInt(1e18); }
}
// Production: RedStone Dynamic PT Oracle (pull model)
// Integration: attach RedStone payload to tx calldata via @redstone-finance/evm-connector
