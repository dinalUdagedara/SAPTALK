import { Module } from '@nestjs/common';
import { QueryService } from './query.service';
import { SapController } from './sap.controller';
import { SapService } from './sap.service';

@Module({
  controllers: [SapController],
  providers: [SapService, QueryService],
  exports: [SapService, QueryService],
})
export class SapModule {}
