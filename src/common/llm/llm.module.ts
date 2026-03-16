import { Global, Module } from '@nestjs/common';
import { LLMAdapter } from './llm.adapter';

@Global()
@Module({
  providers: [LLMAdapter],
  exports: [LLMAdapter],
})
export class LLMModule {}
