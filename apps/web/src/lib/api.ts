import type { AskResponse, BusinessPartner, QueryEnvelope } from '@saptalk/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

/**
 * Error carrying the backend's own message, plus the validator's reasons when a
 * question was rejected. Those reasons are the useful part -- they say which
 * field or operator was not allowed.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly reasons: string[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ErrorBody {
  message?: string;
  errors?: string[];
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(`Could not reach the backend at ${API_URL}. Is it running?`, 0);
  }

  const payload = (await response.json().catch(() => null)) as ErrorBody | null;

  if (!response.ok) {
    throw new ApiError(
      payload?.message ?? `Request failed with ${response.status}.`,
      response.status,
      payload?.errors ?? [],
    );
  }

  return payload as T;
}

/** Ask a question in plain English. */
export function askQuestion(question: string): Promise<AskResponse> {
  return post<AskResponse>('/ask', { question });
}

/** Unfiltered first page, no model involved. */
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
  const payload = (await response.json().catch(() => null)) as ErrorBody | null;
  if (!response.ok) {
    throw new ApiError(payload?.message ?? `Request failed with ${response.status}.`, response.status);
  }
  return payload as unknown as QueryEnvelope<BusinessPartner>;
}
