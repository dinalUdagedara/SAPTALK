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

/** Entities an intent may target. One for now; the shape allows more. */
export const ENTITIES = {
  BusinessPartner: {
    /** OData entity set name. */
    entitySet: 'A_BusinessPartner',
    label: 'Business Partner',
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
} as const;

export type EntityName = keyof typeof ENTITIES;

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
