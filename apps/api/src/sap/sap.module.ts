import { Module } from '@nestjs/common';
import { BusinessPartnerService } from './business-partner.service';
import { SapController } from './sap.controller';
import { SapService } from './sap.service';

@Module({
  controllers: [SapController],
  providers: [SapService, BusinessPartnerService],
  exports: [SapService, BusinessPartnerService],
})
export class SapModule {}
