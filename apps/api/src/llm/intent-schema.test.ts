import { describe, expect, it } from 'vitest';
import { ENTITY_NAMES, MAX_TOP, fieldNames } from '@saptalk/shared';
import { buildIntentJsonSchema, describeEntities } from './intent-schema';
import { buildRetryPrompt, buildSystemPrompt } from './prompt';

const schema = buildIntentJsonSchema();
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
  it('offers every entity', () => {
    expect(new Set(props.entity.enum)).toEqual(new Set(ENTITY_NAMES));
  });

  it('offers fields from both entities, so either can be queried', () => {
    const selectable = new Set(props.select.items!.enum);
    // unique to BusinessPartner
    expect(selectable).toContain('BusinessPartnerCategory');
    // unique to BusinessPartnerAddress
    expect(selectable).toContain('CityName');
  });

  it('covers every registry field with no invented extras', () => {
    const selectable = new Set(props.select.items!.enum);
    const registry = new Set(ENTITY_NAMES.flatMap((e) => fieldNames(e)));
    expect(selectable).toEqual(registry);
  });

  it('constrains filter fields to an enum, so a hallucinated name cannot be emitted', () => {
    expect(props.filters.items!.properties!.field.enum).not.toContain('Salary');
  });

  it('tells the model the row limit', () => {
    expect(props.top.description).toContain(String(MAX_TOP));
  });

  /*
   * The two things JSON Schema cannot express, and therefore the two reasons
   * validateIntent still runs on every response:
   *   1. operator legality depends on the field's type
   *   2. field legality depends on the chosen entity
   * Both are couplings between properties, which enums cannot represent.
   */
  it('offers all operators regardless of field type', () => {
    const ops = props.filters.items!.properties!.op.enum!;
    expect(ops).toContain('contains');
    expect(ops).toContain('gte');
  });

  it('cannot tie the field list to the chosen entity', () => {
    const selectable = new Set(props.select.items!.enum);
    // A partner field and an address field are both offered by the same schema,
    // so a cross-entity intent is schema-valid and must be caught downstream.
    expect(selectable).toContain('BusinessPartnerCategory');
    expect(selectable).toContain('CityName');
  });
});

describe('the description carries meaning the schema cannot', () => {
  const text = describeEntities();

  it('describes both entities', () => {
    for (const entity of ENTITY_NAMES) expect(text).toContain(entity);
  });

  it('explains the category codes', () => {
    expect(text).toContain('1 = Person');
    expect(text).toContain('2 = Organisation');
  });

  it('warns that country is a code, not a name', () => {
    expect(text).toContain('Two-letter ISO code');
  });

  it('lists operators per field type', () => {
    expect(text).toContain('date fields accept');
    expect(text).toContain('string fields accept');
  });
});

describe('the system prompt', () => {
  const prompt = buildSystemPrompt({ today: '2026-08-29' });

  it("anchors relative dates to today, so 'this year' is not invented", () => {
    expect(prompt).toContain('2026-08-29');
  });

  it('states that the model never writes a query language', () => {
    expect(prompt).toMatch(/never write/i);
  });

  it('tells the model how to choose between the entities', () => {
    expect(prompt).toContain('BusinessPartnerAddress');
    expect(prompt).toMatch(/cannot mix/i);
  });

  it('embeds the field documentation for both entities', () => {
    expect(prompt).toContain('BusinessPartnerFullName');
    expect(prompt).toContain('CityName');
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
