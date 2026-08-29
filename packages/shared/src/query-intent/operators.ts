/**
 * Filter operators, and which field types accept them.
 *
 * Names here are our own vocabulary, not OData's -- `contains` reads naturally
 * for a model filling in an intent, and the compiler is responsible for knowing
 * it becomes `substringof` in OData V2. Keeping the two apart means the intent
 * format survives a change of backend dialect.
 *
 * Every operator was confirmed to work, and to actually filter, against the
 * live sandbox on 2026-08-29.
 */

import type { FieldType } from './fields';

export const OPERATORS = {
  eq: { label: 'is', types: ['string', 'enum', 'date'] },
  ne: { label: 'is not', types: ['string', 'enum', 'date'] },
  contains: { label: 'contains', types: ['string'] },
  startsWith: { label: 'starts with', types: ['string'] },
  endsWith: { label: 'ends with', types: ['string'] },
  gt: { label: 'after', types: ['date'] },
  gte: { label: 'on or after', types: ['date'] },
  lt: { label: 'before', types: ['date'] },
  lte: { label: 'on or before', types: ['date'] },
} as const satisfies Record<string, { label: string; types: readonly FieldType[] }>;

export type Operator = keyof typeof OPERATORS;

export const OPERATOR_NAMES = Object.keys(OPERATORS) as [Operator, ...Operator[]];

/** Whether an operator may be applied to a field of this type. */
export function operatorAllowedFor(op: Operator, type: FieldType): boolean {
  return (OPERATORS[op].types as readonly FieldType[]).includes(type);
}

/** Operators valid for a field type, for error messages and the model's prompt. */
export function operatorsFor(type: FieldType): Operator[] {
  return OPERATOR_NAMES.filter((op) => operatorAllowedFor(op, type));
}
