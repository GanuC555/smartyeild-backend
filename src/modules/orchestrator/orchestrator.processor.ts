import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';

@Processor('orchestrator-queue')
@Injectable()
export class OrchestratorProcessor {
  private readonly logger = new Logger('OrchestratorProcessor');
  constructor(private readonly orchestratorService: OrchestratorService) {}

  @Process('lane-allocation-decision')
  async handleDecision(job: Job) {
    this.logger.log('Orchestrator allocation decision starting...');
    return this.orchestratorService.runAllocationDecision(job.data?.userId);
  }
}
