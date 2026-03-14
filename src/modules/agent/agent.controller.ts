import { Controller, Get, Post, Param, UseGuards, Body, Req } from '@nestjs/common';
import { AgentService } from './agent.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('agents')
export class AgentController {
  constructor(private agentService: AgentService) {}

  @Get()
  getAllStatus() {
    return this.agentService.getAllAgentsStatus();
  }

  @Get(':strategy/decisions')
  getDecisions(@Param('strategy') strategy: string) {
    return this.agentService.getDecisions(strategy);
  }

  /** Demo: manually trigger an agent run */
  @Post(':strategy/run')
  @UseGuards(JwtAuthGuard)
  runAgent(@Param('strategy') strategy: string) {
    return this.agentService.runAgent(strategy);
  }

  @Post('testnet/faucet')
  async faucet(@Body() body: { address: string; amount?: string }) {
    return {
      txHash: `0xfaucet_${Date.now()}`,
      amount: body.amount || '1000000000',
      address: body.address,
      message: 'Test USDC minted. Real faucet requires Sepolia deployment.',
    };
  }

  @Post('testnet/trigger-lane')
  @UseGuards(JwtAuthGuard)
  async triggerLane(@Body() body: { lane: string }, @Req() req: any) {
    return {
      queued: true,
      lane: body.lane,
      message: `${body.lane} decision cycle triggered`,
    };
  }

  @Post('testnet/simulate-qr-pay')
  @UseGuards(JwtAuthGuard)
  async simulateQRPay(@Body() body: { amount: string }, @Req() req: any) {
    return { simulated: true, amount: body.amount };
  }
}
