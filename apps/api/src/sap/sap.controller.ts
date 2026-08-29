import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from '@nestjs/common';
import type { BusinessPartner, QueryEnvelope } from '@saptalk/shared';
import { BusinessPartnerService } from './business-partner.service';

@Controller('sap')
export class SapController {
  constructor(private readonly businessPartners: BusinessPartnerService) {}

  /** GET /api/sap/business-partners?top=10 */
  @Get('business-partners')
  list(
    @Query('top', new DefaultValuePipe(10), ParseIntPipe) top: number,
  ): Promise<QueryEnvelope<BusinessPartner>> {
    return this.businessPartners.list(top);
  }
}
