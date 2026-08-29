import { Injectable } from '@nestjs/common';
import {
  columnsFor,
  getEntity,
  getField,
  type EntityName,
  type QueryEnvelope,
  type QueryRow,
  type RelatedStep,
  type ResolvedQueryIntent,
  type ResolvedRelated,
} from '@saptalk/shared';
import { SapService, type ODataParams } from './sap.service';
import { compileIntent } from './intent-compiler';
import { parseEdmDate, unwrapCollection } from './odata-v2';

const DEFAULT_TOP = 10;
const MAX_TOP = 100;

/**
 * Ids per request when restricting to parents from a related query.
 *
 * Measured against the sandbox: an or-chain of 100 ids is a 3,296-character
 * filter and returns 200; 200 ids is 6,596 characters and returns 414 URI Too
 * Long. 100 is the last size that works, not a round number chosen for looks.
 */
const IDS_PER_REQUEST = 100;

/**
 * Requests the second phase may make.
 *
 * More parents than fit in one filter are queried in chunks and merged, rather
 * than dropped. Truncating instead would produce a confidently wrong answer:
 * "German companies with tech in the name" matches 402 German parents, and
 * keeping only the first 100 returned zero rows -- not because none exist, but
 * because none were in the arbitrary hundred we kept.
 */
const MAX_CHUNKS = 5;

/** Rows the related query reads before deduplicating to parent ids. */
const RELATED_SCAN_ROWS = 1000;

/** Rows the leading query reads when the question's own conditions run first. */
const PRIMARY_SCAN_ROWS = 500;

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

  /**
   * Run a validated intent.
   *
   * A question spanning two objects becomes two requests: OData V2 cannot
   * filter across a navigation property (the sandbox answers "wrong
   * cardinality") and has no `any()` lambda, so the join happens here on a
   * shared key.
   *
   * Which side runs first matters more than it looks. Leading with the broad
   * side is what makes such answers unreliable: "German companies with tech in
   * the name" matches 902 German parents but only 13 tech organisations, so
   * starting from the 902 carries an arbitrary subset into the second request,
   * while starting from the 13 is exact.
   *
   * So: when the question states its own conditions, they lead -- a condition
   * the user actually named is the better bet for selectivity. When it states
   * none, the related condition is the only filter available and has to lead.
   */
  async query(intent: ResolvedQueryIntent): Promise<QueryEnvelope> {
    if (!intent.related) {
      const { entitySet, params } = compileIntent(intent);
      return this.run(intent.entity, intent.select, entitySet, params);
    }
    return intent.filters.length > 0
      ? this.joinFromPrimary(intent, intent.related)
      : this.joinFromRelated(intent, intent.related);
  }

  /**
   * Filter the asked-for object first, then keep only rows whose key also
   * satisfies the related condition.
   *
   * Exact whenever the leading query fits inside the scan limit, which is the
   * normal case for a question specific enough to state two conditions.
   */
  private async joinFromPrimary(
    intent: ResolvedQueryIntent,
    related: ResolvedRelated,
  ): Promise<QueryEnvelope> {
    const joinField = related.joinField;
    // The join key must come back even when the question did not ask for it.
    const select = intent.select.includes(joinField)
      ? intent.select
      : [...intent.select, joinField];

    const { entitySet, params } = compileIntent({ ...intent, select, top: PRIMARY_SCAN_ROWS });
    const primary = await this.sap.get(entitySet, params);
    const records = unwrapCollection<Record<string, unknown>>(primary.payload);
    const rows = records.map((record) => normalise(intent.entity, select, record));

    const ids = [...new Set(rows.map((row) => row[joinField]).filter(isId))];
    const matched = await this.matchingIds(related, joinField, ids);
    const kept = rows.filter((row) => isId(row[joinField]) && matched.ids.has(row[joinField]!));

    return {
      query: primary.url,
      durationMs: primary.durationMs + matched.durationMs,
      count: Math.min(kept.length, intent.top),
      entity: intent.entity,
      columns: columnsFor(intent.entity, intent.select),
      data: kept.slice(0, intent.top),
      raw: primary.payload,
      related: {
        entity: related.entity,
        query: matched.url,
        matched: matched.ids.size,
        // Only the leading query can overflow here, and it is the one carrying
        // the user's own conditions.
        truncated: records.length >= PRIMARY_SCAN_ROWS,
        requests: matched.requests,
        durationMs: matched.durationMs,
      },
    };
  }

  /** Of these keys, which satisfy the related condition? */
  private async matchingIds(
    related: ResolvedRelated,
    joinField: string,
    ids: string[],
  ): Promise<{ ids: Set<string>; url: string; requests: number; durationMs: number }> {
    const found = new Set<string>();
    let url = '';
    let requests = 0;
    let durationMs = 0;

    for (let i = 0; i < ids.length; i += IDS_PER_REQUEST) {
      const { entitySet, params } = compileIntent(
        {
          entity: related.entity,
          select: [joinField],
          filters: related.filters,
          filterLogic: 'and',
          orderBy: [],
          top: PRIMARY_SCAN_ROWS,
          skip: 0,
        },
        { field: joinField, values: ids.slice(i, i + IDS_PER_REQUEST) },
      );
      const result = await this.sap.get(entitySet, { ...params, $select: joinField });
      requests += 1;
      durationMs += result.durationMs;
      if (!url) url = result.url;
      for (const row of unwrapCollection<Record<string, unknown>>(result.payload)) {
        if (isId(row[joinField])) found.add(row[joinField] as string);
      }
    }

    return { ids: found, url, requests, durationMs };
  }

  /**
   * No conditions on the asked-for object, so the related one leads.
   *
   * Parents beyond a single request are chunked and merged rather than dropped.
   */
  private async joinFromRelated(
    intent: ResolvedQueryIntent,
    related: ResolvedRelated,
  ): Promise<QueryEnvelope> {
    const step = await this.resolveRelated(related);

    // Nothing matched the related condition, so nothing can match the whole
    // question. Skipping the second request is faster and safer: running it
    // unrestricted would answer a wider question than the one asked.
    if (step.ids.length === 0) {
      const { entitySet, params } = compileIntent(intent);
      return {
        query: this.sap.buildUrl(entitySet, params),
        durationMs: step.meta.durationMs,
        count: 0,
        entity: intent.entity,
        columns: columnsFor(intent.entity, intent.select),
        data: [],
        raw: null,
        related: step.meta,
      };
    }

    return this.runChunked(intent, related.joinField, step);
  }

  /**
   * Second phase: query the parents in chunks and merge.
   *
   * Ordering is applied across the merged set rather than trusted from any one
   * chunk -- each request sorts only what it saw, so a global "newest first"
   * would otherwise be wrong the moment more than one chunk was needed.
   */
  private async runChunked(
    intent: ResolvedQueryIntent,
    joinField: string,
    step: { ids: string[]; meta: RelatedStep },
  ): Promise<QueryEnvelope> {
    const chunks: string[][] = [];
    for (let i = 0; i < step.ids.length; i += IDS_PER_REQUEST) {
      chunks.push(step.ids.slice(i, i + IDS_PER_REQUEST));
    }

    let queryUrl = '';
    let durationMs = 0;
    let raw: unknown = null;
    const rows: QueryRow[] = [];

    for (const chunk of chunks) {
      const { entitySet, params } = compileIntent(intent, { field: joinField, values: chunk });
      const result = await this.sap.get(entitySet, params);
      durationMs += result.durationMs;
      // The first chunk's URL and payload represent the query in the UI; the
      // rest differ only in which ids they name.
      if (!queryUrl) {
        queryUrl = result.url;
        raw = result.payload;
      }
      for (const record of unwrapCollection<Record<string, unknown>>(result.payload)) {
        rows.push(normalise(intent.entity, intent.select, record));
      }
    }

    const ordered = sortRows(rows, intent);
    const data = ordered.slice(0, intent.top);

    return {
      query: queryUrl,
      durationMs,
      count: data.length,
      entity: intent.entity,
      columns: columnsFor(intent.entity, intent.select),
      data,
      raw,
      related: { ...step.meta, requests: chunks.length },
    };
  }

  /** Run the related query and collect the distinct parent ids it matched. */
  private async resolveRelated(
    related: ResolvedRelated,
  ): Promise<{ ids: string[]; meta: RelatedStep }> {
    const def = getEntity(related.entity);
    const { entitySet, params } = compileIntent({
      entity: related.entity,
      select: [related.joinField],
      filters: related.filters,
      filterLogic: 'and',
      orderBy: [],
      top: RELATED_SCAN_ROWS,
      skip: 0,
    });

    const { url, durationMs, payload } = await this.sap.get(entitySet, {
      ...params,
      $select: related.joinField,
    });

    const seen = new Set<string>();
    for (const row of unwrapCollection<Record<string, unknown>>(payload)) {
      const value = row[related.joinField];
      if (typeof value === 'string' && value.length > 0) seen.add(value);
    }

    const all = [...seen];
    const ids = all.slice(0, IDS_PER_REQUEST * MAX_CHUNKS);

    return {
      ids,
      meta: {
        entity: related.entity,
        query: url,
        matched: all.length,
        // Only true once even chunking cannot cover the matches. Stated rather
        // than hidden: past this point the answer is a subset, and a user who
        // is not told that will read it as complete.
        truncated: all.length > IDS_PER_REQUEST * MAX_CHUNKS,
        requests: 0,
        durationMs,
      },
    };
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

/**
 * Apply the intent's ordering to merged rows.
 *
 * Only needed on the chunked path. Values are strings here, and the fields we
 * sort on are ISO dates or codes, both of which order correctly as strings.
 */
function sortRows(rows: QueryRow[], intent: ResolvedQueryIntent): QueryRow[] {
  if (intent.orderBy.length === 0) return rows;

  return [...rows].sort((a, b) => {
    for (const { field, direction } of intent.orderBy) {
      const left = a[field] ?? '';
      const right = b[field] ?? '';
      if (left === right) continue;
      const comparison = left < right ? -1 : 1;
      return direction === 'desc' ? -comparison : comparison;
    }
    return 0;
  });
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TOP;
  return Math.min(Math.max(Math.trunc(value), min), max);
}
