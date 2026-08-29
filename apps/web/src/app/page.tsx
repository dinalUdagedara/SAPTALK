'use client';

import { useState } from 'react';
import type { AskResponse } from '@saptalk/shared';
import { AskBar } from '@/components/ask-bar';
import { EmptyState } from '@/components/empty-state';
import { ExampleQuestions } from '@/components/example-questions';
import { IntentPanel } from '@/components/intent-panel';
import { QueryPanel } from '@/components/query-panel';
import { RejectionPanel } from '@/components/rejection-panel';
import { ResultMetrics } from '@/components/result-metrics';
import { ResultsTable } from '@/components/results-table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiError, askQuestion } from '@/lib/api';

export default function Home() {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<AskResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);

  async function run(text: string = question) {
    const trimmed = text.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    try {
      setResult(await askQuestion(trimmed));
    } catch (caught) {
      setResult(null);
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError('Something went wrong.', 0),
      );
    } finally {
      setLoading(false);
    }
  }

  function pickExample(example: string) {
    setQuestion(example);
    void run(example);
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-baseline gap-2.5">
            <span className="text-[15px] font-semibold tracking-tight">SAPTalk</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              natural language to OData
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <span className="size-1.5 shrink-0 rounded-full bg-signal-ok" aria-hidden />
            <span className="truncate">{result?.model ?? 'Business Partner sandbox'}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6 sm:pt-12">
        <h1 className="text-balance text-xl font-semibold tracking-tight sm:text-[28px]">
          Ask about business partners
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Plain English in, a validated OData query out — and you see the query every time.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <AskBar
            value={question}
            onChange={setQuestion}
            onSubmit={() => void run()}
            loading={loading}
          />
          <ExampleQuestions onPick={pickExample} disabled={loading} />
        </div>

        <div className="mt-10">
          {loading && <LoadingState />}

          {!loading && error && <RejectionPanel error={error} />}

          {!loading && !error && !result && <EmptyState />}

          {!loading && result && <Result result={result} />}
        </div>
      </main>
    </div>
  );
}

function Result({ result }: { result: AskResponse }) {
  return (
    <div className="flex flex-col gap-5">
      <ResultMetrics result={result} />

      {/* Side by side on purpose: the left panel is what the model decided, the
          right is what our code built from it. Seeing both together is the
          product's whole argument. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Intent" subtitle="what the model produced">
          <IntentPanel intent={result.intent} />
        </Panel>
        <Panel title="OData" subtitle="what our code compiled">
          <QueryPanel url={result.query} />
        </Panel>
      </div>

      <Tabs defaultValue="results">
        <TabsList className="max-w-full justify-start overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsTrigger value="results">
            Results
            <span className="tabular ml-1.5 font-mono text-[11px] text-muted-foreground">
              {result.count}
            </span>
          </TabsTrigger>
          <TabsTrigger value="intent">Intent JSON</TabsTrigger>
          <TabsTrigger value="raw">Raw SAP</TabsTrigger>
        </TabsList>

        <TabsContent value="results">
          <div className="overflow-hidden rounded-lg border border-border bg-surface/40">
            <ResultsTable rows={result.data} />
          </div>
        </TabsContent>

        <TabsContent value="intent">
          <JsonBlock value={result.intent} />
        </TabsContent>

        <TabsContent value="raw">
          <JsonBlock value={result.raw} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface/40 p-3 sm:p-4">
      <header className="mb-3 flex items-baseline gap-2">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.12em] text-foreground">
          {title}
        </h2>
        <span className="text-[11px] text-muted-foreground">{subtitle}</span>
      </header>
      {children}
    </section>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[28rem] overflow-auto rounded-lg border border-border bg-surface/40 p-4 font-mono text-[12px] leading-relaxed text-muted-foreground">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Running your question</span>
      <Skeleton className="h-[4.5rem] w-full rounded-lg" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-52 rounded-lg" />
        <Skeleton className="h-52 rounded-lg" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
