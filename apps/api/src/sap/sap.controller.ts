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
import {
  ENTITY_NAMES,
  validateIntent,
  type EntityName,
  type QueryEnvelope,
} from '@saptalk/shared';
import { QueryService } from './query.service';

@Controller('sap')
export class SapController {
  constructor(private readonly queries: QueryService) {}

  /** GET /api/sap/rows?entity=BusinessPartnerAddress&top=10 */
  @Get('rows')
  list(
    @Query('entity', new DefaultValuePipe('BusinessPartner')) entity: string,
    @Query('top', new DefaultValuePipe(10), ParseIntPipe) top: number,
  ): Promise<QueryEnvelope> {
    return this.queries.list(readEntity(entity), top);
  }

  /**
   * POST /api/sap/query
   *
   * Takes a query intent and runs it. This is the boundary: the body is
   * untrusted -- it will eventually come from a language model -- so it is
   * validated against the field allowlist before anything is compiled.
   */
  @Post('query')
  @HttpCode(200)
  query(@Body() body: unknown): Promise<QueryEnvelope> {
    const result = validateIntent(body);
    if (!result.ok) {
      throw new BadRequestException({
        message: 'That query could not be run.',
        errors: result.errors,
      });
    }
    return this.queries.query(result.intent);
  }
}

function readEntity(value: string): EntityName {
  if ((ENTITY_NAMES as readonly string[]).includes(value)) return value as EntityName;
  throw new BadRequestException(
    `Unknown entity "${value}". Available: ${ENTITY_NAMES.join(', ')}.`,
  );
}
