import type { EntityName, FieldType } from './query-intent';

/**
 * One row, keyed by OData field name.
 *
 * Deliberately not a typed interface per entity. The point of the registry is
 * that adding an entity is a registry change and nothing else -- a hand-written
 * row type per entity would put that claim back in every layer that touches a
 * row.
 *
 * Values are strings because that is what the fields we expose are; dates are
 * normalised to ISO. Absent or empty becomes null so a renderer can tell "no
 * value" from "empty string".
 */
export type QueryRow = Record<string, string | null>;

/** Enough to render a column without knowing which entity produced it. */
export interface ColumnMeta {
  /** OData field name; the key into a QueryRow. */
  name: string;
  label: string;
  type: FieldType;
}

/**
 * Envelope returned by every SAPTalk query endpoint.
 *
 * `query` is always echoed back so the UI can show the user exactly what was
 * sent to SAP. That transparency is a product requirement, not a debug aid.
 */
/**
 * The first of two queries, when a question spanned two objects.
 *
 * Surfaced rather than hidden: the user is told a second request happened, what
 * it asked, how many matches it found, and -- crucially -- whether that list was
 * cut short.
 */
export interface RelatedStep {
  entity: EntityName;
  /** The URL of the first query, credential-free. */
  query: string;
  /** Distinct parents it matched. */
  matched: number;
  /**
   * True when more matches existed than could be carried into the second query.
   * The answer is then a subset, and the UI must say so.
   */
  truncated: boolean;
  /** Requests the second phase needed; more than one means ids were chunked. */
  requests: number;
  durationMs: number;
}

export interface QueryEnvelope {
  /** Fully-resolved request URL sent to SAP, minus credentials. */
  query: string;
  /** Wall-clock duration of the upstream call, in milliseconds. */
  durationMs: number;
  /** Number of records in `data`. */
  count: number;
  /** Which entity was queried. */
  entity: EntityName;
  /** Columns in `data`, in the order they should be shown. */
  columns: ColumnMeta[];
  /** Normalised records. */
  data: QueryRow[];
  /** Untouched upstream payload, for the transparency panel. */
  raw: unknown;
  /** Present when the question spanned two objects. */
  related?: RelatedStep;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string;
  /** Upstream SAP error detail, when the failure came from SAP. */
  sapError?: unknown;
}
