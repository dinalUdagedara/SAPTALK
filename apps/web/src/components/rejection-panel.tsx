import { ShieldCheck, TriangleAlert } from 'lucide-react';
import type { ApiError } from '@/lib/api';

/**
 * A rejected question.
 *
 * Presented as the system working rather than failing: the validator caught
 * something the model asked for and refused it, which is the design behaving
 * exactly as intended. The reasons are shown verbatim -- they name the field or
 * operator, which is what makes the refusal explainable.
 */
export function RejectionPanel({ error }: { error: ApiError }) {
  const blocked = error.reasons.length > 0;

  return (
    <div
      className={
        blocked
          ? 'rounded-lg border border-signal-warn/30 bg-signal-warn/[0.06] p-4'
          : 'rounded-lg border border-destructive/40 bg-destructive/[0.07] p-4'
      }
    >
      <div className="flex items-start gap-3">
        {blocked ? (
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-signal-warn" />
        ) : (
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{error.message}</p>

          {blocked && (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                The validator refused the query the model produced. Nothing was sent to SAP.
              </p>
              <ul className="mt-3 flex flex-col gap-1.5">
                {error.reasons.map((reason) => (
                  <li
                    key={reason}
                    className="rounded border border-border/60 bg-background/40 px-2.5 py-1.5 font-mono text-[12px] leading-relaxed text-muted-foreground"
                  >
                    {reason}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
