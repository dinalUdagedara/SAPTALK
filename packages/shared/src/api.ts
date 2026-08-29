/**
 * Envelope returned by every SAPTalk backend endpoint.
 *
 * `query` is always echoed back so the UI can show the user exactly what was
 * sent to SAP. That transparency is a product requirement, not a debug aid.
 */
export interface QueryEnvelope<T> {
  /** Fully-resolved request URL sent to SAP, minus credentials. */
  query: string;
  /** Wall-clock duration of the upstream call, in milliseconds. */
  durationMs: number;
  /** Number of records in `data`. */
  count: number;
  /** Normalised records. */
  data: T[];
  /** Untouched upstream payload, for the transparency panel. */
  raw: unknown;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string;
  /** Upstream SAP error detail, when the failure came from SAP. */
  sapError?: unknown;
}
