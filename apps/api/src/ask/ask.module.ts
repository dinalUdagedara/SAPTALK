import { Module } from '@nestjs/common';
import { AskController } from './ask.controller';
import { LlmModule } from '../llm/llm.module';
import { SapModule } from '../sap/sap.module';

@Module({
  imports: [LlmModule, SapModule],
  controllers: [AskController],
})
export class AskModule {}
