import { ArrowRight } from 'lucide-react';

interface Stage {
  who: string;
  what: string;
  /** The trust boundary, drawn differently from the steps around it. */
  gate?: boolean;
}

const STAGES: Stage[] = [
  { who: 'You', what: 'A question' },
  { who: 'Model', what: 'A query intent' },
  { who: 'Our code', what: 'Validate', gate: true },
  { who: 'Our code', what: 'Compile to OData' },
  { who: 'SAP', what: 'Rows' },
];

/**
 * Shown before the first question.
 *
 * The pipeline is the product's argument, so it is stated once, compactly,
 * where a first-time visitor will read it -- and then never repeated once
 * there are results to look at.
 */
export function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface/30 px-4 py-5 sm:px-5 sm:py-6">
      <p className="text-xs text-muted-foreground">
        The model never writes the query. It fills in a structured intent, which our own code
        checks against a field allowlist before compiling anything.
      </p>

      <div className="mt-4 flex flex-wrap items-stretch gap-1.5">
        {STAGES.map((stage, index) => (
          <div key={stage.what} className="flex items-stretch gap-1.5">
            {index > 0 && (
              <ArrowRight className="my-auto size-3 shrink-0 text-border" aria-hidden />
            )}
            <div
              className={
                stage.gate
                  ? 'rounded-md border border-primary/40 bg-primary/[0.08] px-2.5 py-1.5'
                  : 'rounded-md border border-border/70 px-2.5 py-1.5'
              }
            >
              <div
                className={
                  stage.gate
                    ? 'text-[9px] uppercase tracking-[0.1em] text-primary'
                    : 'text-[9px] uppercase tracking-[0.1em] text-muted-foreground'
                }
              >
                {stage.who}
              </div>
              <div className="text-[12px] text-foreground">{stage.what}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
