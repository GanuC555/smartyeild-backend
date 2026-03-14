import { Controller, Get, Param } from '@nestjs/common';
import { OneChainService } from './onechain.service';

@Controller('onechain')
export class OneChainController {
  constructor(private readonly svc: OneChainService) {}

  @Get('health')
  async health() {
    const online = await this.svc.isOnline();
    return { online, packageId: this.svc.getPackageId() };
  }

  @Get('balance/:address')
  async balance(@Param('address') address: string) {
    const bal = await this.svc.getSpendBalance(address);
    return {
      yieldBalance: bal.yieldBalance.toString(),
      advanceBalance: bal.advanceBalance.toString(),
    };
  }

  @Get('position/:address')
  async position(@Param('address') address: string) {
    const pos = await this.svc.getVaultPosition(address);
    if (!pos) return { found: false };
    return {
      found: true,
      depositAmount: pos.depositAmount.toString(),
      seniorBps: pos.seniorBps,
      juniorBps: pos.juniorBps,
      maturityMs: pos.maturityMs,
      advanceAmount: pos.advanceAmount.toString(),
    };
  }

  @Get('deposits')
  async totalDeposits() {
    const total = await this.svc.getTotalDeposits();
    return { totalDeposits: total.toString() };
  }
}
