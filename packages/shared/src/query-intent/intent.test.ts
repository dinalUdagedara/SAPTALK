import { describe, expect, it } from 'vitest';
import { DEFAULT_TOP, MAX_FILTERS, MAX_TOP, validateIntent } from './intent';

/** Minimal valid intent, spread into cases that vary one thing. */
const base = { entity: 'BusinessPartner' } as const;

function expectOk(input: unknown) {
  const result = validateIntent(input);
  if (!result.ok) throw new Error(`expected valid, got: ${result.errors.join(' | ')}`);
  return result.intent;
}

function expectRejected(input: unknown) {
  const result = validateIntent(input);
  if (result.ok) throw new Error('expected rejection, but the intent validated');
  return result.errors;
}

describe('defaults', () => {
  it('fills in select, top and skip when omitted', () => {
    const intent = expectOk(base);
    expect(intent.select.length).toBeGreaterThan(0);
    expect(intent.top).toBe(DEFAULT_TOP);
    expect(intent.skip).toBe(0);
    expect(intent.filterLogic).toBe('and');
  });

  it('clamps an oversized top rather than rejecting it', () => {
    expect(expectOk({ ...base, top: 5000 }).top).toBe(MAX_TOP);
  });

  it('removes duplicate select entries', () => {
    const intent = expectOk({ ...base, select: ['FirstName', 'FirstName', 'LastName'] });
    expect(intent.select).toEqual(['FirstName', 'LastName']);
  });
});

describe('the field allowlist', () => {
  it('rejects an unknown field in select', () => {
    const errors = expectRejected({ ...base, select: ['Salary'] });
    expect(errors[0]).toContain('Unknown field "Salary"');
  });

  it('rejects an unknown field in a filter', () => {
    expectRejected({
      ...base,
      filters: [{ field: 'CreditLimit', op: 'eq', value: '5' }],
    });
  });

  it('rejects an unknown field in orderBy', () => {
    expectRejected({ ...base, orderBy: [{ field: 'Nope', direction: 'asc' }] });
  });

  it('rejects an unknown entity', () => {
    expectRejected({ entity: 'SalesOrder' });
  });

  it('lists the available fields so the model can retry', () => {
    const errors = expectRejected({ ...base, select: ['Salary'] });
    expect(errors[0]).toContain('BusinessPartnerFullName');
  });

  // The value is data, never syntax -- it cannot reach the query as an operator.
  it('treats OData injected through a field name as an unknown field', () => {
    const errors = expectRejected({
      ...base,
      filters: [{ field: "BusinessPartner eq '1' or '1' eq '1", op: 'eq', value: 'x' }],
    });
    expect(errors[0]).toContain('Unknown field');
  });
});

describe('operator legality', () => {
  it('allows contains on a string field', () => {
    expectOk({
      ...base,
      filters: [{ field: 'BusinessPartnerFullName', op: 'contains', value: 'tech' }],
    });
  });

  it('rejects contains on a date field', () => {
    const errors = expectRejected({
      ...base,
      filters: [{ field: 'CreationDate', op: 'contains', value: '2024' }],
    });
    expect(errors[0]).toContain('cannot be used on "CreationDate"');
  });

  it('names the valid operators when one is rejected', () => {
    const errors = expectRejected({
      ...base,
      filters: [{ field: 'CreationDate', op: 'startsWith', value: '2024' }],
    });
    expect(errors[0]).toContain('gte');
  });

  it('rejects an ordering operator on an enum field', () => {
    expectRejected({
      ...base,
      filters: [{ field: 'BusinessPartnerCategory', op: 'gt', value: '1' }],
    });
  });

  it('rejects an operator that does not exist', () => {
    expectRejected({
      ...base,
      filters: [{ field: 'BusinessPartnerFullName', op: 'regex', value: '.*' }],
    });
  });
});

describe('value legality', () => {
  it('accepts a known enum value', () => {
    expectOk({
      ...base,
      filters: [{ field: 'BusinessPartnerCategory', op: 'eq', value: '2' }],
    });
  });

  it('rejects an enum value outside the list and shows the options', () => {
    const errors = expectRejected({
      ...base,
      filters: [{ field: 'BusinessPartnerCategory', op: 'eq', value: '9' }],
    });
    expect(errors[0]).toContain('Person');
    expect(errors[0]).toContain('Organisation');
  });

  it('accepts an ISO date', () => {
    expectOk({
      ...base,
      filters: [{ field: 'CreationDate', op: 'gte', value: '2025-01-01' }],
    });
  });

  it.each(['01/01/2025', 'January 2025', '2025', '2025-13-45'])(
    'rejects the unusable date %s',
    (value) => {
      const errors = expectRejected({
        ...base,
        filters: [{ field: 'CreationDate', op: 'gte', value }],
      });
      expect(errors[0]).toContain('YYYY-MM-DD');
    },
  );
});

describe('structural limits', () => {
  it(`rejects more than ${MAX_FILTERS} filters`, () => {
    expectRejected({
      ...base,
      filters: Array.from({ length: MAX_FILTERS + 1 }, () => ({
        field: 'BusinessPartnerFullName',
        op: 'contains',
        value: 'a',
      })),
    });
  });

  it('rejects more than two sort fields', () => {
    expectRejected({
      ...base,
      orderBy: [
        { field: 'CreationDate', direction: 'desc' },
        { field: 'LastName', direction: 'asc' },
        { field: 'FirstName', direction: 'asc' },
      ],
    });
  });

  it('rejects a non-integer top', () => {
    expectRejected({ ...base, top: 10.5 });
  });

  it('rejects a negative skip', () => {
    expectRejected({ ...base, skip: -1 });
  });

  it('rejects junk input entirely', () => {
    expectRejected(null);
    expectRejected('give me everything');
    expectRejected({});
  });
});

describe('a realistic question', () => {
  // "Organisations added since January 2026, newest first"
  it('validates and resolves', () => {
    const intent = expectOk({
      entity: 'BusinessPartner',
      select: ['BusinessPartner', 'BusinessPartnerFullName', 'CreationDate'],
      filters: [
        { field: 'BusinessPartnerCategory', op: 'eq', value: '2' },
        { field: 'CreationDate', op: 'gte', value: '2026-01-01' },
      ],
      orderBy: [{ field: 'CreationDate', direction: 'desc' }],
      top: 25,
    });

    expect(intent.filters).toHaveLength(2);
    expect(intent.orderBy[0]).toEqual({ field: 'CreationDate', direction: 'desc' });
    expect(intent.top).toBe(25);
  });

  it('reports every problem at once rather than the first', () => {
    const errors = expectRejected({
      ...base,
      select: ['Salary'],
      filters: [{ field: 'CreationDate', op: 'contains', value: 'nope' }],
      orderBy: [{ field: 'Unknown', direction: 'asc' }],
    });
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});
