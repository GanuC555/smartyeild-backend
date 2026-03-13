import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { StrategyService } from './strategy.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('strategies')
export class StrategyController {
  constructor(private strategyService: StrategyService) {}

  @Get()
  getStrategies() {
    return this.strategyService.getStrategies();
  }

  @Get('my-allocation')
  @UseGuards(JwtAuthGuard)
  getMyAllocation(@Req() req: any) {
    return this.strategyService.getMyAllocation(req.user.sub);
  }

  @Post('allocate')
  @UseGuards(JwtAuthGuard)
  allocate(
    @Body()
    body: { guardian?: number; balancer?: number; hunter?: number },
    @Req() req: any,
  ) {
    return this.strategyService.allocate(req.user.sub, body);
  }
}
