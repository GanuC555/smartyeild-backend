import { Injectable } from '@nestjs/common';
import { NotificationGateway } from './notification.gateway';

@Injectable()
export class NotificationService {
  constructor(private gateway: NotificationGateway) {}

  emitPortfolioUpdate(userId: string, data: any) {
    this.gateway.server
      ?.to(`portfolio:${userId}`)
      .emit('portfolio:update', data);
  }

  emitAgentDecision(strategyId: string, decision: any) {
    this.gateway.server?.emit('agent:decision', {
      strategy: strategyId,
      ...decision,
    });
  }

  emitTransferComplete(userId: string, transfer: any) {
    this.gateway.server
      ?.to(`portfolio:${userId}`)
      .emit('transfer:complete', transfer);
  }
}
