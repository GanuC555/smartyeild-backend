import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { AgentService } from '../agent.service';

@Processor('balancer-agent')
export class BalancerProcessor {
  private readonly logger = new Logger('BalancerAgent');
  constructor(private agentService: AgentService) {}

  @Process('run-agent')
  async handle(job: Job) {
    this.logger.log('Balancer cycle start');
    try {
      await this.agentService.runAgent('balancer');
    } catch (err) {
      this.logger.error('Balancer failed', err);
    }
  }
}
