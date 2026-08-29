import { Injectable } from '@nestjs/common';
import {
  columnsFor,
  getEntity,
  getField,
  type EntityName,
  type QueryEnvelope,
  type QueryRow,
  type ResolvedQueryIntent,
} from '@saptalk/shared';
import { SapService, type ODataParams } from './sap.service';
import { compileIntent } from './intent-compiler';
import { parseEdmDate, unwrapCollection } from './odata-v2';

const DEFAULT_TOP = 10;
const MAX_TOP = 100;

/**
 * Runs queries against any entity in the registry.
 *
 * There is deliberately no per-entity service and no per-entity normaliser.
 * Normalisation is driven by the field's declared type, so an entity added to
 * the registry is queryable and renderable without a line of code here
 * changing -- which is the claim the registry design makes.
 */
@Injectable()
export class QueryService {
  constructor(private readonly sap: SapService) {}

  /** Run a validated intent. */
  async query(intent: ResolvedQueryIntent): Promise<QueryEnvelope> {
    const { entitySet, params } = compileIntent(intent);
    return this.run(intent.entity, intent.select, entitySet, params);
  }

  /**
   * Unfiltered first page of an entity, with no model involved.
   *
   * Useful on its own, and it keeps a path through the system that needs no
   * OpenAI key at all.
   */
  async list(entity: EntityName, top: number = DEFAULT_TOP): Promise<QueryEnvelope> {
    const def = getEntity(entity);
    const select = [...def.defaultSelect];
    return this.run(entity, select, def.entitySet, {
      $top: clamp(top, 1, MAX_TOP),
      $select: select.join(','),
    });
  }

  private async run(
    entity: EntityName,
    select: string[],
    entitySet: string,
    params: ODataParams,
  ): Promise<QueryEnvelope> {
    const { url, durationMs, payload } = await this.sap.get(entitySet, params);
    const rows = unwrapCollection<Record<string, unknown>>(payload);
    const data = rows.map((row) => normalise(entity, select, row));

    return {
      query: url,
      durationMs,
      count: data.length,
      entity,
      columns: columnsFor(entity, select),
      data,
      raw: payload,
    };
  }
}

/**
 * SAP's "no end date" sentinel, year 9999. Rendering it as a date is noise, so
 * the projection reports it as absent; the true value stays in `raw`.
 */
const FAR_FUTURE_YEAR = 9999;

/** Project one SAP row onto the selected fields, using each field's type. */
function normalise(
  entity: EntityName,
  select: string[],
  record: Record<string, unknown>,
): QueryRow {
  const row: QueryRow = {};

  for (const name of select) {
    const field = getField(entity, name);
    if (!field) continue;

    if (field.type === 'date') {
      const iso = parseEdmDate(record[name]);
      row[name] = iso && new Date(iso).getUTCFullYear() >= FAR_FUTURE_YEAR ? null : iso;
      continue;
    }

    const value = record[name];
    // SAP returns an empty string for an unset field; null distinguishes
    // "no value" from "the empty string" for whatever renders this.
    row[name] = typeof value === 'string' && value.length > 0 ? value : null;
  }

  return row;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TOP;
  return Math.min(Math.max(Math.trunc(value), min), max);
}
