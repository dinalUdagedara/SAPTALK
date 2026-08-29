import { Injectable } from '@nestjs/common';
import {
  BUSINESS_PARTNER_FIELDS,
  type BusinessPartner,
  type QueryEnvelope,
} from '@saptalk/shared';
import { SapService } from './sap.service';
import { parseEdmDate, str, unwrapCollection } from './odata-v2';

const ENTITY_SET = 'A_BusinessPartner';
const DEFAULT_TOP = 10;
const MAX_TOP = 100;

@Injectable()
export class BusinessPartnerService {
  constructor(private readonly sap: SapService) {}

  /**
   * Milestone 1: an unfiltered read of the first page of business partners.
   *
   * `$select` is pinned to the fields we actually render — the full entity is
   * ~90 columns and makes the raw-JSON panel unreadable.
   */
  async list(top: number = DEFAULT_TOP): Promise<QueryEnvelope<BusinessPartner>> {
    const safeTop = clamp(top, 1, MAX_TOP);

    const { url, durationMs, payload } = await this.sap.get(ENTITY_SET, {
      $top: safeTop,
      $select: BUSINESS_PARTNER_FIELDS.join(','),
    });

    const rows = unwrapCollection<Record<string, unknown>>(payload);
    const data = rows.map(toBusinessPartner);

    return { query: url, durationMs, count: data.length, data, raw: payload };
  }
}

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
