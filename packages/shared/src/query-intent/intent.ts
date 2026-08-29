/**
 * The query intent: the only thing the language model is ever asked to produce.
 *
 * It describes WHAT was asked. It contains no OData, no URL fragments and no
 * SQL -- deciding HOW to ask SAP is the compiler's job, and deciding whether
 * the request is permitted at all is this file's job.
 *
 * Structural validation comes from Zod; everything that depends on the field
 * registry (does this field exist, may this operator touch it, is this value
 * legal for its type) is checked in the refinement below.
 */

import { z } from 'zod';
import {
  ENTITY_NAMES,
  getEntity,
  getField,
  type EntityName,
  type FieldDef,
} from './fields';
import { OPERATOR_NAMES, operatorAllowedFor, operatorsFor, type Operator } from './operators';

/** Hard ceiling on rows, whatever the intent asks for. */
export const MAX_TOP = 100;
export const DEFAULT_TOP = 25;
/** Caps that keep a malformed or adversarial intent from building a huge query. */
export const MAX_FILTERS = 5;
export const MAX_ORDER_BY = 2;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const filterSchema = z.object({
  field: z.string().min(1),
  op: z.enum(OPERATOR_NAMES),
  value: z.string().min(1).max(100),
});

const orderBySchema = z.object({
  field: z.string().min(1),
  direction: z.enum(['asc', 'desc']).default('asc'),
});

/** Structural shape. Field-level legality is applied by `validateIntent`. */
export const queryIntentSchema = z.object({
  entity: z.enum(ENTITY_NAMES),
  select: z.array(z.string().min(1)).max(20).optional(),
  filters: z.array(filterSchema).max(MAX_FILTERS).optional(),
  /** How multiple filters combine. SAP supports both; we default to `and`. */
  filterLogic: z.enum(['and', 'or']).default('and'),
  orderBy: z.array(orderBySchema).max(MAX_ORDER_BY).optional(),
  // Deliberately unbounded here: the ceiling is applied by clamping in
  // `validateIntent`, so there is exactly one rule about row limits.
  top: z.number().int().positive().optional(),
  skip: z.number().int().min(0).max(10_000).optional(),
});

export type QueryIntent = z.input<typeof queryIntentSchema>;
export type Filter = z.infer<typeof filterSchema>;
export type OrderBy = z.infer<typeof orderBySchema>;

/**
 * An intent with every optional field resolved, so the compiler is a total
 * function and never has to reapply defaults or re-check limits.
 */
export interface ResolvedQueryIntent {
  entity: EntityName;
  select: string[];
  filters: Filter[];
  filterLogic: 'and' | 'or';
  orderBy: OrderBy[];
  top: number;
  skip: number;
}

export type ValidationResult =
  | { ok: true; intent: ResolvedQueryIntent }
  | { ok: false; errors: string[] };

/**
 * Validate untrusted input against the field registry.
 *
 * Errors are written to be shown to a person and to be fed back to the model on
 * a retry, so they name the offending value and list the legal alternatives
 * rather than reporting a schema path.
 */
export function validateIntent(input: unknown): ValidationResult {
  const parsed = queryIntentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map(describeIssue) };
  }

  const intent = parsed.data;
  const entity = getEntity(intent.entity);
  const errors: string[] = [];

  const select = intent.select?.length ? dedupe(intent.select) : [...entity.defaultSelect];
  for (const name of select) {
    if (!getField(intent.entity, name)) {
      errors.push(unknownFieldMessage(intent.entity, name, 'selected'));
    }
  }

  const filters = intent.filters ?? [];
  for (const filter of filters) {
    const field = getField(intent.entity, filter.field);
    if (!field) {
      errors.push(unknownFieldMessage(intent.entity, filter.field, 'filtered on'));
      continue;
    }
    if (!field.filterable) {
      errors.push(`Field "${field.name}" cannot be filtered on.`);
      continue;
    }
    if (!operatorAllowedFor(filter.op, field.type)) {
      errors.push(
        `Operator "${filter.op}" cannot be used on "${field.name}" (${field.type}). ` +
          `Valid operators: ${operatorsFor(field.type).join(', ')}.`,
      );
      continue;
    }
    const valueError = checkValue(field, filter.value);
    if (valueError) errors.push(valueError);
  }

  const orderBy = intent.orderBy ?? [];
  for (const entry of orderBy) {
    const field = getField(intent.entity, entry.field);
    if (!field) {
      errors.push(unknownFieldMessage(intent.entity, entry.field, 'sorted by'));
    } else if (!field.sortable) {
      errors.push(`Field "${field.name}" cannot be sorted by.`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    intent: {
      entity: intent.entity,
      select,
      filters,
      filterLogic: intent.filterLogic,
      orderBy,
      // Clamped rather than rejected: asking for too many rows is a reasonable
      // request to answer partially, not a malformed one.
      top: Math.min(intent.top ?? DEFAULT_TOP, MAX_TOP),
      skip: intent.skip ?? 0,
    },
  };
}

/** Values must match their field's type; enums must be one of the known values. */
function checkValue(field: FieldDef, value: string): string | null {
  if (field.type === 'enum') {
    const allowed = field.values ?? [];
    if (!allowed.some((v) => v.value === value)) {
      const options = allowed.map((v) => `${v.value} (${v.label})`).join(', ');
      return `"${value}" is not a valid ${field.name}. Valid values: ${options}.`;
    }
    return null;
  }

  if (field.type === 'date') {
    if (!DATE_ONLY.test(value) || Number.isNaN(Date.parse(value))) {
      return `"${value}" is not a valid date for ${field.name}. Use YYYY-MM-DD.`;
    }
    return null;
  }

  return null;
}

function unknownFieldMessage(entity: EntityName, name: string, action: string): string {
  const available = Object.keys(getEntity(entity).fields).join(', ');
  return `Unknown field "${name}" cannot be ${action}. Available fields: ${available}.`;
}

function describeIssue(issue: z.core.$ZodIssue): string {
  const path = issue.path.length > 0 ? issue.path.join('.') : 'intent';
  return `${path}: ${issue.message}`;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
