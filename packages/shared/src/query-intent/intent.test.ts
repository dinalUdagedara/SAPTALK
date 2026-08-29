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

describe('entities are isolated from each other', () => {
  // The model's JSON schema offers every field from every entity, because
  // JSON Schema cannot tie one property's legal values to another's. So a
  // cross-entity intent is schema-valid and reaches the validator intact.
  // This is the check that stops it.
  it('rejects an address field on a partner query', () => {
    const errors = expectRejected({
      entity: 'BusinessPartner',
      filters: [{ field: 'CityName', op: 'eq', value: 'London' }],
    });
    expect(errors[0]).toContain('Unknown field "CityName"');
  });

  it('rejects a partner field on an address query', () => {
    const errors = expectRejected({
      entity: 'BusinessPartnerAddress',
      filters: [{ field: 'BusinessPartnerCategory', op: 'eq', value: '2' }],
    });
    expect(errors[0]).toContain('Unknown field "BusinessPartnerCategory"');
  });

  it('names the fields that DO exist on the chosen entity, so a retry can fix it', () => {
    const errors = expectRejected({
      entity: 'BusinessPartner',
      select: ['CityName'],
    });
    expect(errors[0]).toContain('BusinessPartnerFullName');
    expect(errors[0]).not.toContain('CityName cannot be');
  });

  it('accepts the same field name where both entities define it', () => {
    // BusinessPartner is a field on both, and means the same thing.
    expectOk({ entity: 'BusinessPartner', select: ['BusinessPartner'] });
    expectOk({ entity: 'BusinessPartnerAddress', select: ['BusinessPartner'] });
  });

  it('resolves a different default projection per entity', () => {
    const partner = expectOk({ entity: 'BusinessPartner' });
    const address = expectOk({ entity: 'BusinessPartnerAddress' });
    expect(partner.select).not.toEqual(address.select);
    expect(address.select).toContain('CityName');
  });
});

describe('the address entity', () => {
  it('validates a realistic address question', () => {
    const intent = expectOk({
      entity: 'BusinessPartnerAddress',
      filters: [
        { field: 'CityName', op: 'eq', value: 'London' },
        { field: 'Country', op: 'eq', value: 'GB' },
      ],
      orderBy: [{ field: 'PostalCode', direction: 'asc' }],
      top: 10,
    });
    expect(intent.entity).toBe('BusinessPartnerAddress');
    expect(intent.filters).toHaveLength(2);
  });

  it('allows contains on a city name', () => {
    expectOk({
      entity: 'BusinessPartnerAddress',
      filters: [{ field: 'CityName', op: 'contains', value: 'lon' }],
    });
  });

  it('rejects an ordering operator on a string field', () => {
    expectRejected({
      entity: 'BusinessPartnerAddress',
      filters: [{ field: 'CityName', op: 'gte', value: 'L' }],
    });
  });

  it('applies date rules to ValidityStartDate', () => {
    expectOk({
      entity: 'BusinessPartnerAddress',
      filters: [{ field: 'ValidityStartDate', op: 'gte', value: '2020-01-01' }],
    });
    expectRejected({
      entity: 'BusinessPartnerAddress',
      filters: [{ field: 'ValidityStartDate', op: 'gte', value: 'last year' }],
    });
  });
});

describe('cross-object conditions', () => {
  const spanning = {
    entity: 'BusinessPartner',
    filters: [{ field: 'BusinessPartnerCategory', op: 'eq', value: '2' }],
    related: {
      entity: 'BusinessPartnerAddress',
      filters: [{ field: 'Country', op: 'eq', value: 'DE' }],
    },
  };

  it('accepts a condition on a related object and resolves the join key', () => {
    const intent = expectOk(spanning);
    expect(intent.related?.entity).toBe('BusinessPartnerAddress');
    expect(intent.related?.joinField).toBe('BusinessPartner');
  });

  it('validates related fields against the RELATED object, not the main one', () => {
    // Country is an address field, illegal in the main filters...
    expectRejected({
      entity: 'BusinessPartner',
      filters: [{ field: 'Country', op: 'eq', value: 'DE' }],
    });
    // ...and legal in the related block.
    expectOk(spanning);
  });

  it('rejects an unknown field inside the related block', () => {
    const errors = expectRejected({
      ...spanning,
      related: {
        entity: 'BusinessPartnerAddress',
        filters: [{ field: 'Salary', op: 'eq', value: '1' }],
      },
    });
    expect(errors[0]).toContain('Unknown field "Salary"');
  });

  it('rejects an illegal operator inside the related block', () => {
    expectRejected({
      ...spanning,
      related: {
        entity: 'BusinessPartnerAddress',
        filters: [{ field: 'ValidityStartDate', op: 'contains', value: '2024' }],
      },
    });
  });

  it('rejects relating an object to itself', () => {
    const errors = expectRejected({
      ...spanning,
      related: {
        entity: 'BusinessPartner',
        filters: [{ field: 'BusinessPartnerCategory', op: 'eq', value: '2' }],
      },
    });
    expect(errors[0]).toContain('must differ');
  });

  // Strict-mode schemas cannot mark a property optional, so the model always
  // sends this object. An empty filter list is how it says "not needed".
  it('treats an empty related filter list as unused', () => {
    const intent = expectOk({
      entity: 'BusinessPartner',
      related: { entity: 'BusinessPartnerAddress', filters: [] },
    });
    expect(intent.related).toBeUndefined();
  });

  it('ignores the related entity entirely when there are no related filters', () => {
    // Even a self-reference is fine when unused, because it means nothing.
    const intent = expectOk({
      entity: 'BusinessPartner',
      related: { entity: 'BusinessPartner', filters: [] },
    });
    expect(intent.related).toBeUndefined();
  });
});
