import { Injectable } from '@nestjs/common';
import { MockPriceOracle } from '../../adapters/oracle/MockPriceOracle';
import { IPriceOracle } from '../../adapters/oracle/IPriceOracle';

@Injectable()
export class OracleService implements IPriceOracle {
  constructor(private readonly oracle: MockPriceOracle) {}

  getPTPrice(_market: string): Promise<bigint> {
    return this.oracle.getPTPrice();
  }
  getYTPrice(_market: string): Promise<bigint> {
    return this.oracle.getYTPrice();
  }
  getSrNUSDPrice(): Promise<bigint> {
    return this.oracle.getSrNUSDPrice();
  }
}
