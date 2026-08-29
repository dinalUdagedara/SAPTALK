/**
 * Helpers for SAP's OData **V2** dialect.
 *
 * The Business Accelerator Hub sandbox for API_BUSINESS_PARTNER is V2, not V4.
 * That means: results are wrapped in `{ d: { results: [] } }`, `$format=json`
 * is required, `$inlinecount=allpages` replaces V4's `$count`, and dates arrive
 * as `/Date(1700000000000)/` rather than ISO-8601.
 */

/** Shape of a successful V2 collection response. */
interface ODataV2Collection<T> {
  d?: {
    results?: T[];
    __count?: string;
  };
}

/** Unwrap `{ d: { results: [...] } }`, tolerating single-entity responses. */
export function unwrapCollection<T>(payload: unknown): T[] {
  const body = payload as ODataV2Collection<T> | undefined;
  const d = body?.d;
  if (!d) return [];
  if (Array.isArray(d.results)) return d.results;
  // A single-entity read returns the entity directly under `d`.
  return [d as unknown as T];
}

/** Total row count from `$inlinecount=allpages`, when requested. */
export function readInlineCount(payload: unknown): number | null {
  const raw = (payload as ODataV2Collection<unknown> | undefined)?.d?.__count;
  if (raw === undefined) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

const EDM_DATE = /^\/Date\((-?\d+)([+-]\d+)?\)\/$/;

/** Convert `/Date(1700000000000)/` to an ISO-8601 string. */
export function parseEdmDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = EDM_DATE.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Read a string field, collapsing SAP's empty-string-for-null convention. */
export function str(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  return typeof value === 'string' ? value : '';
}
