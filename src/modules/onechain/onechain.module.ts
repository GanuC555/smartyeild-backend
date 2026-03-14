import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OneChainAdapterService } from '../../adapters/onechain/OneChainAdapterService';
import { OneChainService } from './onechain.service';
import { OneChainController } from './onechain.controller';

@Module({
  imports: [ConfigModule],
  providers: [OneChainAdapterService, OneChainService],
  controllers: [OneChainController],
  exports: [OneChainService, OneChainAdapterService],
})
export class OneChainModule {}
