import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
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
}
