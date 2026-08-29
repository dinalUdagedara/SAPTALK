import { Module } from '@nestjs/common';
import { IntentGeneratorService } from './intent-generator.service';
import { OpenAiService } from './openai.service';

@Module({
  providers: [OpenAiService, IntentGeneratorService],
  exports: [IntentGeneratorService],
})
export class LlmModule {}
