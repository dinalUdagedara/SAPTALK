import type { AskResponse } from '@saptalk/shared';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

function Metric({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint: string;
  tone?: 'default' | 'warn';
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex flex-col gap-0.5 px-3 py-2.5 text-left sm:px-4">
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </span>
          <span
            className={cn(
              'tabular font-mono text-sm',
              tone === 'warn' ? 'text-signal-warn' : 'text-foreground',
            )}
          >
            {value}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">{hint}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Where the time went, and how many tries it took.
 *
 * Model and SAP time are separated on purpose: they are different costs with
 * different fixes, and averaging them into one number hides which is slow.
 */
export function ResultMetrics({ result }: { result: AskResponse }) {
  const retried = result.attempts > 1;

  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-border rounded-lg border border-border bg-surface/50 sm:flex sm:divide-y-0">
      <Metric label="Rows" value={String(result.count)} hint="Records returned by SAP." />
      <Metric
        label="Model"
        value={`${(result.modelMs / 1000).toFixed(1)}s`}
        hint={`Time spent in ${result.model} turning the question into an intent.`}
      />
      <Metric
        label="SAP"
        value={`${(result.durationMs / 1000).toFixed(1)}s`}
        hint="Time spent waiting on the SAP sandbox."
      />
      <Metric
        label="Attempts"
        value={String(result.attempts)}
        tone={retried ? 'warn' : 'default'}
        hint={
          retried
            ? 'The first intent was rejected by the validator and corrected on retry.'
            : 'The first intent passed validation.'
        }
      />
    </div>
  );
}
