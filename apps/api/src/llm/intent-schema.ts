/**
 * Projects the field registry into the two things a model needs: a JSON schema
 * it must conform to, and a readable description of what the fields mean.
 *
 * Both are derived from the registry rather than written by hand, so adding an
 * entity to fields.ts teaches the model about it automatically -- there is no
 * second list to forget to update.
 *
 * This is a prompt-engineering artifact, NOT a security boundary. It cannot
 * express that `contains` is illegal on a date, nor that CityName belongs to
 * addresses and not to partners: JSON Schema has no way to make one property's
 * legal values depend on another's. Those are checked by validateIntent
 * afterwards, on every response, always.
 */

import {
  ENTITIES,
  ENTITY_NAMES,
  MAX_TOP,
  OPERATOR_NAMES,
  getEntity,
  operatorsFor,
  relatedEntities,
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

function fieldsOf(entity: EntityName): FieldDef[] {
  return Object.values(getEntity(entity).fields) as FieldDef[];
}

/** Every field name across every entity, deduplicated. */
function allFieldNames(predicate: (field: FieldDef) => boolean): string[] {
  const names = new Set<string>();
  for (const entity of ENTITY_NAMES) {
    for (const field of fieldsOf(entity)) {
      if (predicate(field)) names.add(field.name);
    }
  }
  return [...names];
}

/**
 * Build the schema the model must fill in.
 *
 * Field enums are the union across entities, because JSON Schema cannot tie
 * the legal field list to the chosen entity. The union still rules out invented
 * field names, and mixing an address field into a partner query is caught by
 * the validator, which says so precisely enough for the retry to fix it.
 *
 * Strict mode requires every property in `required` and forbids extra
 * properties, so nothing is optional: the model returns empty arrays rather
 * than omitting keys.
 */
export function buildIntentJsonSchema(): JsonSchema {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['entity', 'select', 'filters', 'filterLogic', 'orderBy', 'top', 'related'],
    properties: {
      entity: {
        type: 'string',
        enum: [...ENTITY_NAMES],
        description:
          'Which business object the question is about. Every field you use must belong to it.',
      },
      select: {
        type: 'array',
        description:
          'Columns to show. Use an empty array for the sensible default set. ' +
          'Only add columns the question actually asks about.',
        items: { type: 'string', enum: allFieldNames(() => true) },
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
            field: { type: 'string', enum: allFieldNames((f) => f.filterable) },
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
        description:
          'How to combine multiple filters. Use "and" unless the question says otherwise.',
      },
      orderBy: {
        type: 'array',
        description: 'Sort order. Empty array when the question does not ask for one.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['field', 'direction'],
          properties: {
            field: { type: 'string', enum: allFieldNames((f) => f.sortable) },
            direction: { type: 'string', enum: ['asc', 'desc'] },
          },
        },
      },
      top: {
        type: 'integer',
        description: `How many rows to return, 1 to ${MAX_TOP}. Use 25 unless the question asks for a specific number.`,
      },
      related: {
        type: 'object',
        additionalProperties: false,
        required: ['entity', 'filters'],
        description:
          'Conditions on a DIFFERENT object, when the question spans two. ' +
          'When the question concerns only one object, return an empty filters ' +
          'array here; the entity value is then ignored.',
        properties: {
          entity: {
            type: 'string',
            enum: [...ENTITY_NAMES],
            description: 'The other object. Must differ from the main entity.',
          },
          filters: {
            type: 'array',
            description: 'Conditions on that other object. Empty when unused.',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['field', 'op', 'value'],
              properties: {
                field: { type: 'string', enum: allFieldNames((f) => f.filterable) },
                op: { type: 'string', enum: [...OPERATOR_NAMES] },
                value: { type: 'string' },
              },
            },
          },
        },
      },
    },
  };
}

/** Describe one entity and its fields in prose. */
function describeEntity(entity: EntityName): string {
  const def = ENTITIES[entity];
  const lines = fieldsOf(entity).map((field) => {
    const parts = [`  - ${field.name} (${field.type}) -- ${field.label}.`];
    if (field.values) {
      parts.push(`Values: ${field.values.map((v) => `${v.value} = ${v.label}`).join(', ')}.`);
    }
    if (field.hint) parts.push(field.hint);
    if (!field.filterable) parts.push('Cannot be filtered.');
    if (!field.sortable) parts.push('Cannot be sorted.');
    return parts.join(' ');
  });
  const related = relatedEntities(entity);
  const joins = related.length
    ? [`  Can be combined with: ${related.join(', ')}.`]
    : [];
  return [`${entity} -- ${def.description}`, ...lines, ...joins].join('\n');
}

/**
 * Describe every entity.
 *
 * The JSON schema constrains vocabulary but carries no meaning: it cannot say
 * that CityName lives on addresses, or that category 2 means an organisation.
 * Without that, the model picks plausible-looking wrong fields.
 */
export function describeEntities(): string {
  const operatorLines = (['string', 'enum', 'date'] as const).map(
    (type) => `- ${type} fields accept: ${operatorsFor(type).join(', ')}`,
  );

  return [
    'Available business objects and their fields:',
    '',
    ENTITY_NAMES.map(describeEntity).join('\n\n'),
    '',
    'Operators by field type:',
    ...operatorLines,
  ].join('\n');
}
