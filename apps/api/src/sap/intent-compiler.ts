/**
 * Compiles a validated query intent into OData V2 query parameters.
 *
 * A pure function: same intent in, same parameters out, no I/O and no clock.
 * That is what makes the interesting half of this system testable without an
 * API key, a network, or a language model.
 *
 * It takes a ResolvedQueryIntent, which by construction has already passed the
 * field allowlist, so every field name here is known-good. Values are the part
 * that came from outside, and they are escaped rather than trusted.
 *
 * Dialect notes, all confirmed against the live sandbox on 2026-08-29:
 *   contains   -> substringof('value', Field)   -- argument order is reversed
 *   startsWith -> startswith(Field, 'value')    -- and here it is not
 *   gte / lte  -> ge / le
 *   dates      -> datetime'2025-01-01T00:00:00' literals, not quoted strings
 */

import {
  getEntity,
  getField,
  type Filter,
  type Operator,
  type ResolvedQueryIntent,
} from '@saptalk/shared';
import type { ODataParams } from './sap.service';

export interface CompiledQuery {
  /** OData entity set to read from, e.g. A_BusinessPartner. */
  entitySet: string;
  /** Query parameters, ready for SapService. */
  params: ODataParams;
}

/** Our operator names to their OData V2 comparison keywords. */
const COMPARISON: Partial<Record<Operator, string>> = {
  eq: 'eq',
  ne: 'ne',
  gt: 'gt',
  gte: 'ge',
  lt: 'lt',
  lte: 'le',
};

export function compileIntent(intent: ResolvedQueryIntent): CompiledQuery {
  const entity = getEntity(intent.entity);

  const params: ODataParams = {
    $select: intent.select.join(','),
    $top: intent.top,
  };

  if (intent.filters.length > 0) {
    params.$filter = compileFilters(intent);
  }

  if (intent.orderBy.length > 0) {
    params.$orderby = intent.orderBy
      .map((entry) => `${entry.field} ${entry.direction}`)
      .join(',');
  }

  // Omitted rather than sent as 0: it keeps the query the user is shown free of
  // parameters that do nothing.
  if (intent.skip > 0) {
    params.$skip = intent.skip;
  }

  return { entitySet: entity.entitySet, params };
}

function compileFilters(intent: ResolvedQueryIntent): string {
  const clauses = intent.filters.map((filter) => compileFilter(intent, filter));
  if (clauses.length === 1) return clauses[0];

  // Parenthesised so a future mix of and/or cannot change meaning by precedence.
  return clauses.map((clause) => `(${clause})`).join(` ${intent.filterLogic} `);
}

function compileFilter(intent: ResolvedQueryIntent, filter: Filter): string {
  const field = getField(intent.entity, filter.field);
  /* istanbul ignore next -- validation guarantees the field exists */
  if (!field) {
    throw new Error(`Cannot compile unknown field "${filter.field}".`);
  }

  switch (filter.op) {
    // V2 takes the substring first and the field second. This is the single
    // most common natural-language filter and the one V4 spells differently.
    case 'contains':
      return `substringof(${quote(filter.value)},${field.name})`;
    case 'startsWith':
      return `startswith(${field.name},${quote(filter.value)})`;
    case 'endsWith':
      return `endswith(${field.name},${quote(filter.value)})`;
    default: {
      const keyword = COMPARISON[filter.op];
      if (!keyword) {
        throw new Error(`No OData mapping for operator "${filter.op}".`);
      }
      const literal =
        field.type === 'date' ? dateLiteral(filter.value) : quote(filter.value);
      return `${field.name} ${keyword} ${literal}`;
    }
  }
}

/**
 * Render a string literal.
 *
 * OData escapes a single quote by doubling it. Without this, a name as ordinary
 * as O'Brien produces a malformed query -- and a value chosen deliberately
 * could close the literal and append its own clauses. Field names come from the
 * allowlist, so this is the only place untrusted text enters the query, and it
 * never leaves as syntax.
 */
function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Render a date literal.
 *
 * Intent dates are calendar days (YYYY-MM-DD); V2 wants an Edm.DateTime literal.
 * Midnight is implied, and the value is already validated as a real date.
 */
function dateLiteral(value: string): string {
  return `datetime'${value}T00:00:00'`;
}
