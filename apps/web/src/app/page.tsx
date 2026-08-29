'use client';

import { useState } from 'react';
import type { BusinessPartner, QueryEnvelope } from '@saptalk/shared';
import { BusinessPartnerTable } from '@/components/BusinessPartnerTable';
import { ApiError, fetchBusinessPartners } from '@/lib/api';

export default function Home() {
  const [result, setResult] = useState<QueryEnvelope<BusinessPartner> | null>(null);
  const [error, setError] = useState<{ message: string; detail?: unknown } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      setResult(await fetchBusinessPartners(10));
    } catch (caught) {
      setResult(null);
      setError(
        caught instanceof ApiError
          ? { message: caught.message, detail: caught.detail }
          : { message: 'Something went wrong.' },
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">SAPTalk</h1>
        <p className="mt-1 text-sm text-muted">
          Milestone 1 — end-to-end pipe to the SAP Business Partner sandbox.
        </p>
      </header>

      <button
        onClick={run}
        disabled={loading}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {loading ? 'Fetching…' : 'Fetch business partners'}
      </button>

      {error && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">{error.message}</p>
          {error.detail != null && (
            <pre className="mt-2 overflow-x-auto text-xs text-red-700">
              {JSON.stringify(error.detail, null, 2)}
            </pre>
          )}
        </div>
      )}

      {result && (
        <section className="mt-8 space-y-6">
          {/* The generated query is shown on purpose: transparency is the point
              of the product, and it stays visible once the LLM writes it. */}
          <div>
            <h2 className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
              Generated query
            </h2>
            <code className="block overflow-x-auto rounded-lg border border-line bg-white p-3 font-mono text-xs">
              {result.query}
            </code>
            <p className="mt-2 text-xs text-muted">
              {result.count} record{result.count === 1 ? '' : 's'} in {result.durationMs}ms
            </p>
          </div>

          <BusinessPartnerTable rows={result.data} />

          <div>
            <button
              onClick={() => setShowRaw((value) => !value)}
              className="text-xs font-medium text-accent hover:underline"
            >
              {showRaw ? 'Hide' : 'Show'} raw SAP response
            </button>
            {showRaw && (
              <pre className="mt-2 max-h-96 overflow-auto rounded-lg border border-line bg-white p-3 font-mono text-xs">
                {JSON.stringify(result.raw, null, 2)}
              </pre>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
