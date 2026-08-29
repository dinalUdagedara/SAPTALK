import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { validateIntent, type BusinessPartner, type QueryEnvelope } from '@saptalk/shared';
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

  /**
   * POST /api/sap/query
   *
   * Takes a query intent and runs it. This is the boundary: the body is
   * untrusted -- it will eventually come from a language model -- so it is
   * validated against the field allowlist before anything is compiled.
   *
   * A rejected intent returns the reasons, which are written to be shown to a
   * person and fed back to the model on a retry.
   */
  @Post('query')
  @HttpCode(200)
  query(@Body() body: unknown): Promise<QueryEnvelope<BusinessPartner>> {
    const result = validateIntent(body);
    if (!result.ok) {
      throw new BadRequestException({
        message: 'That query could not be run.',
        errors: result.errors,
      });
    }
    return this.businessPartners.query(result.intent);
  }
}
