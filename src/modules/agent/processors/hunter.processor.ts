import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { AgentService } from '../agent.service';

@Processor('hunter-agent')
export class HunterProcessor {
  private readonly logger = new Logger('HunterAgent');
  constructor(private agentService: AgentService) {}

  @Process('run-agent')
  async handle(job: Job) {
    this.logger.log('Hunter cycle start');
    try {
      await this.agentService.runAgent('hunter');
    } catch (err) {
      this.logger.error('Hunter failed', err);
    }
  }
}
