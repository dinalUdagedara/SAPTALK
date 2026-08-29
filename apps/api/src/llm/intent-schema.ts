/**
 * Projects the field registry into the two things a model needs: a JSON schema
 * it must conform to, and a readable description of what the fields mean.
 *
 * Both are derived from the registry rather than written by hand, so adding a
 * field to fields.ts teaches the model about it automatically -- there is no
 * second list to forget to update.
 *
 * This is a prompt-engineering artifact, NOT a security boundary. The schema
 * constrains shape and vocabulary; it cannot express that `contains` is illegal
 * on a date, or that an enum value must be one of three codes. Those are
 * checked by validateIntent afterwards, on every response, always.
 */

import {
  ENTITY_NAMES,
  MAX_TOP,
  OPERATOR_NAMES,
  getEntity,
  operatorsFor,
  type EntityName,
  type FieldDef,
} from '@saptalk/shared';

/** A JSON Schema subset meeting OpenAI's structured-output "strict" rules. */
export interface JsonSchema {
  type: string;
  description?: string;
  enum?: string[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * Build the schema the model must fill in.
 *
 * Strict mode requires every property to be listed in `required` and forbids
 * additional properties, so nothing is optional here: the model returns empty
 * arrays rather than omitting keys. `validateIntent` treats an empty `select`
 * as "use the default projection", so this costs nothing downstream.
 */
export function buildIntentJsonSchema(entity: EntityName): JsonSchema {
  const def = getEntity(entity);
  const fields = Object.values(def.fields) as FieldDef[];

  const selectable = fields.map((f) => f.name);
  const filterable = fields.filter((f) => f.filterable).map((f) => f.name);
  const sortable = fields.filter((f) => f.sortable).map((f) => f.name);

  return {
    type: 'object',
    additionalProperties: false,
    required: ['entity', 'select', 'filters', 'filterLogic', 'orderBy', 'top'],
    properties: {
      entity: {
        type: 'string',
        enum: [...ENTITY_NAMES],
        description: 'The business object being asked about.',
      },
      select: {
        type: 'array',
        description:
          'Columns to show. Use an empty array for the sensible default set. ' +
          'Only add columns the question actually asks about.',
        items: { type: 'string', enum: selectable },
      },
      filters: {
        type: 'array',
        description:
          'Conditions the records must meet. Empty array when the question has no conditions.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['field', 'op', 'value'],
          properties: {
            field: { type: 'string', enum: filterable },
            op: { type: 'string', enum: [...OPERATOR_NAMES] },
            value: {
              type: 'string',
              description:
                'Always a string. Dates must be YYYY-MM-DD. For a coded field, ' +
                'use the code, not its label.',
            },
          },
        },
      },
      filterLogic: {
        type: 'string',
        enum: ['and', 'or'],
        description: 'How to combine multiple filters. Use "and" unless the question says otherwise.',
      },
      orderBy: {
        type: 'array',
        description: 'Sort order. Empty array when the question does not ask for one.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['field', 'direction'],
          properties: {
            field: { type: 'string', enum: sortable },
            direction: { type: 'string', enum: ['asc', 'desc'] },
          },
        },
      },
      top: {
        type: 'integer',
        description: `How many rows to return, 1 to ${MAX_TOP}. Use 25 unless the question asks for a specific number.`,
      },
    },
  };
}

/**
 * Describe the fields in prose.
 *
 * The JSON schema constrains vocabulary but carries no meaning: it cannot say
 * that OrganizationBPName1 is empty for people, or that category 2 means an
 * organisation. Without that, the model picks plausible-looking wrong fields.
 */
export function describeFields(entity: EntityName): string {
  const def = getEntity(entity);

  const lines = (Object.values(def.fields) as FieldDef[]).map((field) => {
    const parts = [`- ${field.name} (${field.type}) -- ${field.label}.`];
    if (field.values) {
      parts.push(`Values: ${field.values.map((v) => `${v.value} = ${v.label}`).join(', ')}.`);
    }
    if (field.hint) parts.push(field.hint);
    if (!field.filterable) parts.push('Cannot be filtered.');
    if (!field.sortable) parts.push('Cannot be sorted.');
    return parts.join(' ');
  });

  const operatorLines = (['string', 'enum', 'date'] as const).map(
    (type) => `- ${type} fields accept: ${operatorsFor(type).join(', ')}`,
  );

  return [
    `Fields on ${def.label}:`,
    ...lines,
    '',
    'Operators by field type:',
    ...operatorLines,
  ].join('\n');
}
