import { Module } from '@nestjs/common';
import { AskController } from './ask.controller';
import { AskThrottleGuard } from '../common/ask-throttle.guard';
import { LlmModule } from '../llm/llm.module';
import { SapModule } from '../sap/sap.module';

@Module({
  imports: [LlmModule, SapModule],
  controllers: [AskController],
  // Registered as a singleton so the counters survive between requests within
  // an instance; a per-request guard would reset them and count nothing.
  providers: [AskThrottleGuard],
})
export class AskModule {}
