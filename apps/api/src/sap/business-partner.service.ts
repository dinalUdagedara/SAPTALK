import { Injectable } from '@nestjs/common';
import {
  fieldNames,
  getEntity,
  type BusinessPartner,
  type QueryEnvelope,
  type ResolvedQueryIntent,
} from '@saptalk/shared';
import { SapService, type ODataParams } from './sap.service';
import { compileIntent } from './intent-compiler';
import { parseEdmDate, str, unwrapCollection } from './odata-v2';

const ENTITY = 'BusinessPartner' as const;
const DEFAULT_TOP = 10;
const MAX_TOP = 100;

@Injectable()
export class BusinessPartnerService {
  constructor(private readonly sap: SapService) {}

  /**
   * Unfiltered read of the first page, used by the milestone-1 button.
   *
   * Projects every registry field so the normalised row is fully populated.
   */
  async list(top: number = DEFAULT_TOP): Promise<QueryEnvelope<BusinessPartner>> {
    return this.run(getEntity(ENTITY).entitySet, {
      $top: clamp(top, 1, MAX_TOP),
      $select: fieldNames(ENTITY).join(','),
    });
  }

  /**
   * Run a validated intent.
   *
   * The intent has already cleared the field allowlist, so this method's only
   * job is to compile and execute. Nothing here re-checks permission -- that
   * decision was made before we got the intent.
   */
  async query(intent: ResolvedQueryIntent): Promise<QueryEnvelope<BusinessPartner>> {
    const { entitySet, params } = compileIntent(intent);
    return this.run(entitySet, params);
  }

  private async run(
    entitySet: string,
    params: ODataParams,
  ): Promise<QueryEnvelope<BusinessPartner>> {
    const { url, durationMs, payload } = await this.sap.get(entitySet, params);
    const data = unwrapCollection<Record<string, unknown>>(payload).map(toBusinessPartner);
    return { query: url, durationMs, count: data.length, data, raw: payload };
  }
}

/**
 * Map an SAP row onto our shape.
 *
 * Fields outside the query's projection come back absent, and normalise to an
 * empty string rather than undefined, so the table never renders a hole.
 */
function toBusinessPartner(record: Record<string, unknown>): BusinessPartner {
  return {
    businessPartner: str(record, 'BusinessPartner'),
    businessPartnerFullName: str(record, 'BusinessPartnerFullName'),
    businessPartnerCategory: str(record, 'BusinessPartnerCategory'),
    businessPartnerGrouping: str(record, 'BusinessPartnerGrouping'),
    organizationBPName1: str(record, 'OrganizationBPName1'),
    firstName: str(record, 'FirstName'),
    lastName: str(record, 'LastName'),
    createdByUser: str(record, 'CreatedByUser'),
    createdOn: parseEdmDate(record['CreationDate']),
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TOP;
  return Math.min(Math.max(Math.trunc(value), min), max);
}
