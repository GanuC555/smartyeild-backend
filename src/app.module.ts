import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { HealthModule } from './modules/health/health.module';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { VaultModule } from './modules/vault/vault.module';
import { StrategyModule } from './modules/strategy/strategy.module';
import { AgentModule } from './modules/agent/agent.module';
import { TransferModule } from './modules/transfer/transfer.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { NotificationModule } from './modules/notification/notification.module';
import { LaneModule } from './modules/lane/lane.module';
import { OrchestratorModule } from './modules/orchestrator/orchestrator.module';
import { ProtocolModule } from './modules/protocol/protocol.module';
import { SpendBufferModule } from './modules/spend-buffer/spend-buffer.module';
import { OneChainModule } from './modules/onechain/onechain.module';

@Module({
  imports: [
    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/smartyield',
    ),
    BullModule.forRoot({
      redis: process.env.REDIS_URL || 'redis://localhost:6379',
    }),
    HealthModule,
    UserModule,
    AuthModule,
    VaultModule,
    StrategyModule,
    AgentModule,
    TransferModule,
    TelegramModule,
    NotificationModule,
    LaneModule,
    OrchestratorModule,
    ProtocolModule,
    SpendBufferModule,
    OneChainModule,
  ],
})
export class AppModule {}
