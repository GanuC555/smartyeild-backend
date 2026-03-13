import { AgentService } from './agent.service';
export declare class AgentController {
    private agentService;
    constructor(agentService: AgentService);
    getAllStatus(): Promise<any[]>;
    getDecisions(strategy: string): Promise<(import("mongoose").FlattenMaps<import("../../common/schemas/agent-decision.schema").AgentDecision> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    runAgent(strategy: string): Promise<import("../../common/schemas/agent-decision.schema").AgentDecision>;
}
