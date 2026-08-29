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
