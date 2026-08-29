import type { ResolvedQueryIntent } from '@saptalk/shared';
import { Badge } from '@/components/ui/badge';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    // Stacked on a phone: a fixed label column leaves too little room for
    // field names like BusinessPartnerCategory, which then wrap mid-value.
    <div className="grid grid-cols-1 items-start gap-1 py-2 sm:grid-cols-[4.5rem_1fr] sm:gap-3 sm:py-1.5">
      <span className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground sm:pt-0.5">
        {label}
      </span>
      <div className="min-w-0 font-mono text-[13px]">{children}</div>
    </div>
  );
}

/**
 * What the model decided.
 *
 * Rendered as structure rather than raw JSON: a reader should be able to check
 * it against their question without parsing braces. The raw JSON is one tab
 * away for anyone who wants it.
 */
export function IntentPanel({ intent }: { intent: ResolvedQueryIntent }) {
  return (
    <div className="divide-y divide-border/60">
      <Row label="Entity">
        <span className="text-foreground">{intent.entity}</span>
      </Row>

      <Row label="Filters">
        {intent.filters.length === 0 ? (
          <span className="text-muted-foreground">none</span>
        ) : (
          <div className="flex flex-col gap-1.5">
            {intent.filters.map((filter, index) => (
              <div key={index} className="flex flex-wrap items-center gap-1.5">
                {index > 0 && (
                  <span className="text-[10px] uppercase text-muted-foreground">
                    {intent.filterLogic}
                  </span>
                )}
                <span className="text-foreground">{filter.field}</span>
                <Badge
                  variant="outline"
                  className="h-5 rounded border-primary/30 bg-primary/10 px-1.5 font-mono text-[11px] font-normal text-primary"
                >
                  {filter.op}
                </Badge>
                <span className="text-accent-foreground">{filter.value}</span>
              </div>
            ))}
          </div>
        )}
      </Row>

      <Row label="Sort">
        {intent.orderBy.length === 0 ? (
          <span className="text-muted-foreground">none</span>
        ) : (
          intent.orderBy.map((entry) => (
            <div key={entry.field} className="text-foreground">
              {entry.field}{' '}
              <span className="text-muted-foreground">{entry.direction}</span>
            </div>
          ))
        )}
      </Row>

      <Row label="Limit">
        <span className="tabular text-foreground">{intent.top}</span>
      </Row>

      <Row label="Columns">
        <span className="text-muted-foreground">
          {intent.select.length} field{intent.select.length === 1 ? '' : 's'}
        </span>
      </Row>
    </div>
  );
}
