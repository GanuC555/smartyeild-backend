import { NotificationGateway } from './notification.gateway';
export declare class NotificationService {
    private gateway;
    constructor(gateway: NotificationGateway);
    emitPortfolioUpdate(userId: string, data: any): void;
    emitAgentDecision(strategyId: string, decision: any): void;
    emitTransferComplete(userId: string, transfer: any): void;
}
