import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Query-string parameters for an OData request. Values are encoded for you. */
export type ODataParams = Record<string, string | number | undefined>;

export interface SapResponse {
  /** The URL that was called, safe to show a user (no credentials in it). */
  url: string;
  durationMs: number;
  payload: unknown;
}

const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Thin transport layer over the SAP sandbox.
 *
 * Deliberately knows nothing about Business Partners: it takes an entity set
 * and parameters, and returns the raw payload. The intent -> OData translation
 * that comes later builds the parameter map; this class stays dumb.
 */
@Injectable()
export class SapService {
  private readonly logger = new Logger(SapService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: ConfigService) {
    this.baseUrl = (
      config.get<string>('SAP_BP_BASE_URL') ??
      'https://sandbox.api.sap.com/s4hanacloud/sap/opu/odata/sap/API_BUSINESS_PARTNER'
    ).replace(/\/+$/, '');

    const apiKey = config.get<string>('SAP_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'SAP_API_KEY is not set. Copy .env.example to apps/api/.env and add your sandbox key.',
      );
    }
    this.apiKey = apiKey;
  }

  /** Build the request URL without performing it — used for the query preview. */
  buildUrl(entitySet: string, params: ODataParams = {}): string {
    const url = new URL(`${this.baseUrl}/${entitySet}`);
    // The sandbox defaults to XML; JSON is opt-in on every request.
    url.searchParams.set('$format', 'json');
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === '') continue;
      url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  async get(entitySet: string, params: ODataParams = {}): Promise<SapResponse> {
    const url = this.buildUrl(entitySet, params);
    const startedAt = Date.now();

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { APIKey: this.apiKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'TimeoutError';
      this.logger.error(`SAP request failed: ${url}`, error as Error);
      throw isTimeout
        ? new GatewayTimeoutException(
            `SAP sandbox did not respond within ${REQUEST_TIMEOUT_MS / 1000}s.`,
          )
        : new BadGatewayException('Could not reach the SAP sandbox.');
    }

    const durationMs = Date.now() - startedAt;
    const text = await response.text();

    if (!response.ok) {
      this.logger.error(`SAP ${response.status} for ${url}: ${text.slice(0, 500)}`);
      throw new BadGatewayException({
        message: `SAP returned ${response.status} ${response.statusText}.`,
        sapError: safeJson(text) ?? text.slice(0, 2000),
      });
    }

    const payload = safeJson(text);
    if (payload === undefined) {
      // A 200 with non-JSON usually means the APIKey header was rejected and
      // the gateway served an HTML error page instead.
      throw new BadGatewayException(
        'SAP returned a non-JSON body. Check that SAP_API_KEY is valid.',
      );
    }

    this.logger.log(`SAP ${response.status} in ${durationMs}ms: ${url}`);
    return { url, durationMs, payload };
  }
}

function safeJson(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
