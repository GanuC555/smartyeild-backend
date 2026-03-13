import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { AgentService } from '../agent.service';

@Processor('guardian-agent')
export class GuardianProcessor {
  private readonly logger = new Logger('GuardianAgent');
  constructor(private agentService: AgentService) {}

  @Process('run-agent')
  async handle(job: Job) {
    this.logger.log('Guardian cycle start');
    try {
      const d = await this.agentService.runAgent('guardian');
      this.logger.log(`Guardian → ${d.decision}`);
    } catch (err) {
      this.logger.error('Guardian failed', err);
    }
  }
}
