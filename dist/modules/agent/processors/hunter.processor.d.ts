import { Job } from 'bull';
import { AgentService } from '../agent.service';
export declare class HunterProcessor {
    private agentService;
    private readonly logger;
    constructor(agentService: AgentService);
    handle(job: Job): Promise<void>;
}
