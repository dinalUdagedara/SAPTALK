import type { BusinessPartner, QueryEnvelope } from '@saptalk/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

/** Error carrying the backend's message rather than a generic HTTP status. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function fetchBusinessPartners(
  top = 10,
): Promise<QueryEnvelope<BusinessPartner>> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/sap/business-partners?top=${top}`, {
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(`Could not reach the backend at ${API_URL}. Is it running?`, 0);
  }

  const body = (await response.json().catch(() => null)) as
    | { message?: string; sapError?: unknown }
    | null;

  if (!response.ok) {
    throw new ApiError(
      body?.message ?? `Request failed with ${response.status}.`,
      response.status,
      body?.sapError,
    );
  }

  return body as unknown as QueryEnvelope<BusinessPartner>;
}
