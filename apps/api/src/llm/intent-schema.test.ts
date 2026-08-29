import { describe, expect, it } from 'vitest';
import { MAX_TOP, fieldNames } from '@saptalk/shared';
import { buildIntentJsonSchema, describeFields } from './intent-schema';
import { buildRetryPrompt, buildSystemPrompt } from './prompt';

const schema = buildIntentJsonSchema('BusinessPartner');
const props = schema.properties!;

describe('the schema meets OpenAI strict-mode rules', () => {
  it('forbids additional properties at the root', () => {
    expect(schema.additionalProperties).toBe(false);
  });

  it('marks every property required', () => {
    expect(new Set(schema.required)).toEqual(new Set(Object.keys(props)));
  });

  it('applies the same rules to nested objects', () => {
    for (const key of ['filters', 'orderBy'] as const) {
      const item = props[key].items!;
      expect(item.additionalProperties, key).toBe(false);
      expect(new Set(item.required), key).toEqual(new Set(Object.keys(item.properties!)));
    }
  });
});

describe('the schema is derived from the registry', () => {
  it('offers exactly the registry fields for select', () => {
    expect(new Set(props.select.items!.enum)).toEqual(new Set(fieldNames('BusinessPartner')));
  });

  it('constrains filter fields to an enum, so a hallucinated name cannot be emitted', () => {
    expect(props.filters.items!.properties!.field.enum).toBeDefined();
    expect(props.filters.items!.properties!.field.enum).not.toContain('Salary');
  });

  it('constrains sort direction', () => {
    expect(props.orderBy.items!.properties!.direction.enum).toEqual(['asc', 'desc']);
  });

  it('tells the model the row limit', () => {
    expect(props.top.description).toContain(String(MAX_TOP));
  });

  // The schema cannot express "contains is illegal on a date" -- operator
  // legality depends on the field, which JSON Schema enums cannot couple.
  // That is precisely why validateIntent still runs on every response.
  it('offers all operators regardless of field type', () => {
    const ops = props.filters.items!.properties!.op.enum!;
    expect(ops).toContain('contains');
    expect(ops).toContain('gte');
  });
});

describe('the field description carries meaning the schema cannot', () => {
  const text = describeFields('BusinessPartner');

  it('explains the category codes', () => {
    expect(text).toContain('1 = Person');
    expect(text).toContain('2 = Organisation');
  });

  it('lists operators per field type', () => {
    expect(text).toContain('date fields accept');
    expect(text).toContain('string fields accept');
  });

  it('includes the hint that stops the model picking the wrong name field', () => {
    expect(text).toContain('Only populated for organisations');
  });
});

describe('the system prompt', () => {
  const prompt = buildSystemPrompt({ entity: 'BusinessPartner', today: '2026-08-29' });

  it("anchors relative dates to today, so 'this year' is not invented", () => {
    expect(prompt).toContain('2026-08-29');
  });

  it('states that the model never writes a query language', () => {
    expect(prompt).toMatch(/never write/i);
  });

  it('embeds the field documentation', () => {
    expect(prompt).toContain('BusinessPartnerFullName');
  });
});

describe('the retry prompt', () => {
  it('passes validator errors through verbatim', () => {
    const errors = ['Unknown field "Salary" cannot be selected. Available fields: X, Y.'];
    expect(buildRetryPrompt(errors)).toContain(errors[0]);
  });

  it('lists every error, not just the first', () => {
    const prompt = buildRetryPrompt(['first problem', 'second problem']);
    expect(prompt).toContain('first problem');
    expect(prompt).toContain('second problem');
  });
});
