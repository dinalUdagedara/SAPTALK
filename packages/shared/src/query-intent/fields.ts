/**
 * The field registry: the allowlist an intent is validated against.
 *
 * Nothing outside this file is queryable. A field absent here cannot be
 * selected, filtered or sorted, no matter what the model produces -- which is
 * the whole point of translating to an intent rather than to a query string.
 *
 * Every field name below was confirmed against the live sandbox on 2026-08-29.
 */

export type FieldType = 'string' | 'enum' | 'date';

export interface EnumValue {
  /** Value as SAP stores it. */
  readonly value: string;
  /** What it means, for the UI and for the model's field list. */
  readonly label: string;
}

export interface FieldDef {
  /** Field name in the OData entity. Used verbatim when building queries. */
  readonly name: string;
  /** Human-readable name, shown in the UI and given to the model. */
  readonly label: string;
  readonly type: FieldType;
  /** May appear in `filters`. */
  readonly filterable: boolean;
  /** May appear in `orderBy`. */
  readonly sortable: boolean;
  /** Permitted values, for enum fields. Filtering is restricted to these. */
  readonly values?: readonly EnumValue[];
  /** Extra context to help the model choose the right field. */
  readonly hint?: string;
}

export const BUSINESS_PARTNER_FIELDS = {
  BusinessPartner: {
    name: 'BusinessPartner',
    label: 'ID',
    type: 'string',
    filterable: true,
    sortable: true,
    hint: 'Unique business partner number, e.g. 1000000.',
  },
  BusinessPartnerFullName: {
    name: 'BusinessPartnerFullName',
    label: 'Name',
    type: 'string',
    filterable: true,
    sortable: true,
    hint: 'Display name. Populated for both people and organisations, so it is the right field for a general name search.',
  },
  BusinessPartnerCategory: {
    name: 'BusinessPartnerCategory',
    label: 'Category',
    type: 'enum',
    filterable: true,
    sortable: true,
    values: [
      { value: '1', label: 'Person' },
      { value: '2', label: 'Organisation' },
      { value: '3', label: 'Group' },
    ],
    hint: 'Use this to separate people from companies.',
  },
  BusinessPartnerGrouping: {
    name: 'BusinessPartnerGrouping',
    label: 'Grouping',
    type: 'string',
    filterable: true,
    sortable: true,
    hint: 'Customer-defined classification code such as BP01 or BPEE. Not a fixed list, so it is treated as free text.',
  },
  OrganizationBPName1: {
    name: 'OrganizationBPName1',
    label: 'Company name',
    type: 'string',
    filterable: true,
    sortable: true,
    hint: 'Only populated for organisations. Prefer BusinessPartnerFullName unless the question is explicitly about companies.',
  },
  FirstName: {
    name: 'FirstName',
    label: 'First name',
    type: 'string',
    filterable: true,
    sortable: true,
    hint: 'Only populated for people.',
  },
  LastName: {
    name: 'LastName',
    label: 'Last name',
    type: 'string',
    filterable: true,
    sortable: true,
    hint: 'Only populated for people.',
  },
  CreatedByUser: {
    name: 'CreatedByUser',
    label: 'Created by',
    type: 'string',
    filterable: true,
    sortable: true,
  },
  CreationDate: {
    name: 'CreationDate',
    label: 'Created on',
    type: 'date',
    filterable: true,
    sortable: true,
    hint: 'Records in the sandbox span 2016 to 2026.',
  },
} as const satisfies Record<string, FieldDef>;

export type BusinessPartnerFieldName = keyof typeof BUSINESS_PARTNER_FIELDS;

/**
 * Addresses belonging to business partners.
 *
 * Field names and population rates were measured against the live sandbox on
 * 2026-08-29 across a 500-row sample; fields populated in fewer than a fifth of
 * rows are left out, because a queryable field that is almost always empty
 * produces confidently empty answers.
 */
export const BUSINESS_PARTNER_ADDRESS_FIELDS = {
  BusinessPartner: {
    name: 'BusinessPartner',
    label: 'Partner ID',
    type: 'string',
    filterable: true,
    sortable: true,
    hint: 'The business partner this address belongs to. Use it to tie an address back to a partner.',
  },
  AddressID: {
    name: 'AddressID',
    label: 'Address ID',
    type: 'string',
    filterable: true,
    sortable: true,
  },
  CityName: {
    name: 'CityName',
    label: 'City',
    type: 'string',
    filterable: true,
    sortable: true,
    hint: 'Populated on almost every address. The right field for "addresses in London".',
  },
  Country: {
    name: 'Country',
    label: 'Country',
    type: 'string',
    filterable: true,
    sortable: true,
    hint: 'Two-letter ISO code, upper case: DE, US, GB, FR. Never the country name.',
  },
  Region: {
    name: 'Region',
    label: 'Region',
    type: 'string',
    filterable: true,
    sortable: true,
    hint: 'State or province code within the country, such as GA or BW.',
  },
  PostalCode: {
    name: 'PostalCode',
    label: 'Postal code',
    type: 'string',
    filterable: true,
    sortable: true,
  },
  StreetName: {
    name: 'StreetName',
    label: 'Street',
    type: 'string',
    filterable: true,
    sortable: true,
  },
  HouseNumber: {
    name: 'HouseNumber',
    label: 'House number',
    type: 'string',
    filterable: true,
    sortable: true,
  },
  FullName: {
    name: 'FullName',
    label: 'Name',
    type: 'string',
    filterable: true,
    sortable: true,
    hint: 'Name held on the address record itself, which may differ from the partner name.',
  },
  Language: {
    name: 'Language',
    label: 'Language',
    type: 'string',
    filterable: true,
    sortable: true,
    hint: 'Two-letter code, upper case: EN, DE, FR.',
  },
  AddressTimeZone: {
    name: 'AddressTimeZone',
    label: 'Time zone',
    type: 'string',
    filterable: true,
    sortable: true,
    hint: 'SAP zone code such as CET, EST, GMTUK -- not an IANA name.',
  },
  ValidityStartDate: {
    name: 'ValidityStartDate',
    label: 'Valid from',
    type: 'date',
    filterable: true,
    sortable: true,
  },
} as const satisfies Record<string, FieldDef>;

export type BusinessPartnerAddressFieldName = keyof typeof BUSINESS_PARTNER_ADDRESS_FIELDS;

/**
 * Entities an intent may target.
 *
 * Everything downstream -- the model's schema, the validator, the compiler and
 * the table -- is generated from this map. Adding an entity here is the whole
 * change; no other file enumerates entities or fields.
 */
export const ENTITIES = {
  BusinessPartner: {
    /** OData entity set name. */
    entitySet: 'A_BusinessPartner',
    label: 'Business Partner',
    description: 'Companies and people the business deals with: customers, suppliers, contacts.',
    fields: BUSINESS_PARTNER_FIELDS as Record<string, FieldDef>,
    /** Projection used when an intent does not specify `select`. */
    defaultSelect: [
      'BusinessPartner',
      'BusinessPartnerFullName',
      'BusinessPartnerCategory',
      'BusinessPartnerGrouping',
      'CreatedByUser',
      'CreationDate',
    ],
  },
  BusinessPartnerAddress: {
    entitySet: 'A_BusinessPartnerAddress',
    label: 'Business Partner Address',
    description:
      'Where business partners are located: city, country, region, street, postal code.',
    fields: BUSINESS_PARTNER_ADDRESS_FIELDS as Record<string, FieldDef>,
    defaultSelect: [
      'BusinessPartner',
      'FullName',
      'CityName',
      'Region',
      'Country',
      'PostalCode',
    ],
  },
} as const;

export type EntityName = keyof typeof ENTITIES;

/**
 * How entities join to one another.
 *
 * OData V2 cannot filter across a navigation property -- the sandbox answers
 * `to_BusinessPartnerAddress/Country eq 'DE'` with "Left hand expression of
 * memberaccess operator has wrong cardinality", and it has no `any()` lambda.
 * So a question spanning two objects is answered as two queries joined on a
 * shared key, and this map is what declares that key.
 *
 * Symmetric on purpose: either object can be the one you are asking about.
 */
export const RELATIONS: Record<string, Partial<Record<EntityName, { joinField: string }>>> = {
  BusinessPartner: {
    BusinessPartnerAddress: { joinField: 'BusinessPartner' },
  },
  BusinessPartnerAddress: {
    BusinessPartner: { joinField: 'BusinessPartner' },
  },
};

/** The join between two entities, or undefined when they are not related. */
export function relationBetween(
  entity: EntityName,
  related: EntityName,
): { joinField: string } | undefined {
  return RELATIONS[entity]?.[related];
}

/** Entities that can be joined to this one. */
export function relatedEntities(entity: EntityName): EntityName[] {
  return Object.keys(RELATIONS[entity] ?? {}) as EntityName[];
}

export const ENTITY_NAMES = Object.keys(ENTITIES) as [EntityName, ...EntityName[]];

export function getEntity(entity: EntityName) {
  return ENTITIES[entity];
}

/** Look up a field, or undefined when it is not on the allowlist. */
export function getField(entity: EntityName, field: string): FieldDef | undefined {
  return ENTITIES[entity].fields[field];
}

export function fieldNames(entity: EntityName): string[] {
  return Object.keys(ENTITIES[entity].fields);
}

/** Column metadata for a projection, in the order the fields were selected. */
export function columnsFor(entity: EntityName, select: string[]) {
  const fields = ENTITIES[entity].fields;
  return select
    .map((name) => fields[name])
    .filter((field): field is FieldDef => Boolean(field))
    .map((field) => ({ name: field.name, label: field.label, type: field.type }));
}
