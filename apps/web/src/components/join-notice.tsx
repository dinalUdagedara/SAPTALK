import { GitMerge, TriangleAlert } from 'lucide-react';
import type { RelatedStep } from '@saptalk/shared';
import { QueryPanel } from '@/components/query-panel';

/**
 * Shown when a question spanned two objects.
 *
 * The second query is surfaced rather than hidden: a user told "you see the
 * query every time" is owed both of them, and a join that happened silently
 * would make the transparency claim false.
 */
export function JoinNotice({ related }: { related: RelatedStep }) {
  return (
    <section className="rounded-lg border border-border bg-surface/40 p-3 sm:p-4">
      <header className="mb-3 flex flex-wrap items-baseline gap-2">
        <GitMerge className="size-3.5 shrink-0 translate-y-0.5 text-primary" aria-hidden />
        <h2 className="text-[11px] font-medium uppercase tracking-[0.12em] text-foreground">
          Related query
        </h2>
        <span className="text-[11px] text-muted-foreground">
          matched {related.matched} key{related.matched === 1 ? '' : 's'} on {related.entity} in{' '}
          {related.requests} request{related.requests === 1 ? '' : 's'}
        </span>
      </header>

      <p className="mb-3 max-w-prose text-xs text-muted-foreground">
        This question spanned two objects. OData V2 cannot filter across a relationship, so it
        ran as two queries joined on a shared key.
      </p>

      <QueryPanel url={related.query} />

      {related.truncated && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-signal-warn/30 bg-signal-warn/[0.06] p-2.5">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-signal-warn" aria-hidden />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">These results are incomplete.</span>{' '}
            More records matched than could be carried between the two queries, so rows beyond
            the scan limit were never considered. Narrow the question to get a complete answer.
          </p>
        </div>
      )}
    </section>
  );
}
