import { describe, expect, it } from 'vitest';
import { validateIntent, type QueryIntent } from '@saptalk/shared';
import { compileIntent } from './intent-compiler';

/** Validate then compile, the way the endpoint does. */
function compile(intent: QueryIntent) {
  const result = validateIntent(intent);
  if (!result.ok) throw new Error(`intent was rejected: ${result.errors.join(' | ')}`);
  return compileIntent(result.intent);
}

const base = { entity: 'BusinessPartner' } as const;

describe('shape', () => {
  it('targets the right entity set', () => {
    expect(compile(base).entitySet).toBe('A_BusinessPartner');
  });

  it('always sends $select and $top', () => {
    const { params } = compile(base);
    expect(params.$select).toBeTruthy();
    expect(params.$top).toBe(25);
  });

  it('omits $filter, $orderby and $skip when there is nothing to say', () => {
    const { params } = compile(base);
    expect(params.$filter).toBeUndefined();
    expect(params.$orderby).toBeUndefined();
    expect(params.$skip).toBeUndefined();
  });

  it('sends $skip only when non-zero', () => {
    expect(compile({ ...base, skip: 40 }).params.$skip).toBe(40);
  });
});

describe('operator mapping', () => {
  const cases: [string, QueryIntent, string][] = [
    [
      'contains reverses its arguments for V2',
      { ...base, filters: [{ field: 'BusinessPartnerFullName', op: 'contains', value: 'tech' }] },
      "substringof('tech',BusinessPartnerFullName)",
    ],
    [
      'startsWith does not reverse',
      { ...base, filters: [{ field: 'BusinessPartnerFullName', op: 'startsWith', value: 'Steel' }] },
      "startswith(BusinessPartnerFullName,'Steel')",
    ],
    [
      'endsWith does not reverse',
      { ...base, filters: [{ field: 'BusinessPartnerFullName', op: 'endsWith', value: 'Ltd.' }] },
      "endswith(BusinessPartnerFullName,'Ltd.')",
    ],
    [
      'eq on a string',
      { ...base, filters: [{ field: 'CreatedByUser', op: 'eq', value: 'CB9980000065' }] },
      "CreatedByUser eq 'CB9980000065'",
    ],
    [
      'eq on an enum',
      { ...base, filters: [{ field: 'BusinessPartnerCategory', op: 'eq', value: '2' }] },
      "BusinessPartnerCategory eq '2'",
    ],
    [
      'ne',
      { ...base, filters: [{ field: 'BusinessPartnerCategory', op: 'ne', value: '1' }] },
      "BusinessPartnerCategory ne '1'",
    ],
    [
      'gte becomes ge with a datetime literal',
      { ...base, filters: [{ field: 'CreationDate', op: 'gte', value: '2025-01-01' }] },
      "CreationDate ge datetime'2025-01-01T00:00:00'",
    ],
    [
      'lte becomes le',
      { ...base, filters: [{ field: 'CreationDate', op: 'lte', value: '2025-12-31' }] },
      "CreationDate le datetime'2025-12-31T00:00:00'",
    ],
    [
      'gt and lt keep their names',
      { ...base, filters: [{ field: 'CreationDate', op: 'gt', value: '2024-06-01' }] },
      "CreationDate gt datetime'2024-06-01T00:00:00'",
    ],
  ];

  it.each(cases)('%s', (_label, intent, expected) => {
    expect(compile(intent).params.$filter).toBe(expected);
  });
});

describe('combining filters', () => {
  it('leaves a single clause unparenthesised', () => {
    const { params } = compile({
      ...base,
      filters: [{ field: 'BusinessPartnerCategory', op: 'eq', value: '2' }],
    });
    expect(params.$filter).toBe("BusinessPartnerCategory eq '2'");
  });

  it('parenthesises and joins with and', () => {
    const { params } = compile({
      ...base,
      filters: [
        { field: 'BusinessPartnerCategory', op: 'eq', value: '2' },
        { field: 'CreationDate', op: 'gte', value: '2026-01-01' },
      ],
    });
    expect(params.$filter).toBe(
      "(BusinessPartnerCategory eq '2') and (CreationDate ge datetime'2026-01-01T00:00:00')",
    );
  });

  it('honours or', () => {
    const { params } = compile({
      ...base,
      filterLogic: 'or',
      filters: [
        { field: 'BusinessPartnerCategory', op: 'eq', value: '1' },
        { field: 'BusinessPartnerCategory', op: 'eq', value: '2' },
      ],
    });
    expect(params.$filter).toContain(') or (');
  });
});

describe('sorting', () => {
  it('renders one sort field', () => {
    const { params } = compile({
      ...base,
      orderBy: [{ field: 'CreationDate', direction: 'desc' }],
    });
    expect(params.$orderby).toBe('CreationDate desc');
  });

  it('comma-separates two, preserving order', () => {
    const { params } = compile({
      ...base,
      orderBy: [
        { field: 'BusinessPartnerCategory', direction: 'asc' },
        { field: 'CreationDate', direction: 'desc' },
      ],
    });
    expect(params.$orderby).toBe('BusinessPartnerCategory asc,CreationDate desc');
  });

  it('defaults direction to asc', () => {
    const { params } = compile({ ...base, orderBy: [{ field: 'LastName' }] } as QueryIntent);
    expect(params.$orderby).toBe('LastName asc');
  });
});

describe('escaping — the injection boundary', () => {
  it("doubles a single quote so O'Brien is a value, not syntax", () => {
    const { params } = compile({
      ...base,
      filters: [{ field: 'LastName', op: 'eq', value: "O'Brien" }],
    });
    expect(params.$filter).toBe("LastName eq 'O''Brien'");
  });

  it('neutralises an attempt to close the literal and append a clause', () => {
    const { params } = compile({
      ...base,
      filters: [{ field: 'LastName', op: 'eq', value: "x' or '1' eq '1" }],
    });
    // The quote is doubled, so the whole thing stays one string literal.
    expect(params.$filter).toBe("LastName eq 'x'' or ''1'' eq ''1'");
    // No unescaped quote survives to terminate the literal early.
    expect(String(params.$filter).replace(/''/g, '')).toBe("LastName eq 'x or 1 eq 1'");
  });

  it('escapes inside function calls too', () => {
    const { params } = compile({
      ...base,
      filters: [{ field: 'BusinessPartnerFullName', op: 'contains', value: "O'Neill" }],
    });
    expect(params.$filter).toBe("substringof('O''Neill',BusinessPartnerFullName)");
  });

  it('passes other punctuation through untouched', () => {
    const { params } = compile({
      ...base,
      filters: [{ field: 'BusinessPartnerFullName', op: 'contains', value: 'Steel & Alloy' }],
    });
    // & is a query-string concern, encoded later by URLSearchParams, not here.
    expect(params.$filter).toBe("substringof('Steel & Alloy',BusinessPartnerFullName)");
  });
});

describe('a realistic question end to end', () => {
  // "Organisations added since January 2026, newest first"
  it('compiles to the query we expect', () => {
    const { entitySet, params } = compile({
      entity: 'BusinessPartner',
      select: ['BusinessPartner', 'BusinessPartnerFullName', 'CreationDate'],
      filters: [
        { field: 'BusinessPartnerCategory', op: 'eq', value: '2' },
        { field: 'CreationDate', op: 'gte', value: '2026-01-01' },
      ],
      orderBy: [{ field: 'CreationDate', direction: 'desc' }],
      top: 25,
    });

    expect(entitySet).toBe('A_BusinessPartner');
    expect(params).toEqual({
      $select: 'BusinessPartner,BusinessPartnerFullName,CreationDate',
      $top: 25,
      $filter:
        "(BusinessPartnerCategory eq '2') and (CreationDate ge datetime'2026-01-01T00:00:00')",
      $orderby: 'CreationDate desc',
    });
  });
});

describe('the address entity compiles too', () => {
  it('targets the right entity set', () => {
    expect(compile({ entity: 'BusinessPartnerAddress' }).entitySet).toBe(
      'A_BusinessPartnerAddress',
    );
  });

  it('uses the address default projection', () => {
    const { params } = compile({ entity: 'BusinessPartnerAddress' });
    expect(params.$select).toContain('CityName');
    expect(params.$select).not.toContain('BusinessPartnerCategory');
  });

  it('compiles a city filter', () => {
    const { params } = compile({
      entity: 'BusinessPartnerAddress',
      filters: [{ field: 'CityName', op: 'eq', value: 'London' }],
    });
    expect(params.$filter).toBe("CityName eq 'London'");
  });

  it('compiles contains on a city the same way it does on a partner name', () => {
    const { params } = compile({
      entity: 'BusinessPartnerAddress',
      filters: [{ field: 'CityName', op: 'contains', value: 'lon' }],
    });
    expect(params.$filter).toBe("substringof('lon',CityName)");
  });

  it('escapes address values, so the boundary holds on the new entity too', () => {
    const { params } = compile({
      entity: 'BusinessPartnerAddress',
      filters: [{ field: 'CityName', op: 'eq', value: "O'Fallon" }],
    });
    expect(params.$filter).toBe("CityName eq 'O''Fallon'");
  });

  it('renders its date field as a V2 datetime literal', () => {
    const { params } = compile({
      entity: 'BusinessPartnerAddress',
      filters: [{ field: 'ValidityStartDate', op: 'gte', value: '2020-01-01' }],
    });
    expect(params.$filter).toBe("ValidityStartDate ge datetime'2020-01-01T00:00:00'");
  });
});
