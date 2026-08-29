/**
 * Subset of the A_BusinessPartner entity we surface today.
 *
 * The sandbox entity has ~90 fields; we project a small, stable slice so the
 * table stays readable. Widen this list as the query layer grows.
 */
export interface BusinessPartner {
  businessPartner: string;
  businessPartnerFullName: string;
  businessPartnerCategory: string;
  businessPartnerGrouping: string;
  organizationBPName1: string;
  firstName: string;
  lastName: string;
  createdByUser: string;
  /** ISO-8601 string, or null when SAP returned no date. */
  createdOn: string | null;
}

/** Field names as they appear in the OData V2 entity, for query building. */
export const BUSINESS_PARTNER_FIELDS = [
  'BusinessPartner',
  'BusinessPartnerFullName',
  'BusinessPartnerCategory',
  'BusinessPartnerGrouping',
  'OrganizationBPName1',
  'FirstName',
  'LastName',
  'CreatedByUser',
  'CreationDate',
] as const;

export type BusinessPartnerField = (typeof BUSINESS_PARTNER_FIELDS)[number];
