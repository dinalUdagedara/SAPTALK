'use client';

import { cn } from '@/lib/utils';

/**
 * Questions chosen to show range, not just success: a date filter, a substring
 * match, one that routes to the address object, one that spans both objects and
 * needs a join, and one the data genuinely cannot answer -- degrading honestly
 * is part of what this demonstrates.
 */
const EXAMPLES = [
  'organisations added this year, newest first',
  'companies with tech in the name',
  'partners in London created this year',
  'addresses in Germany, by postal code',
  'total revenue last quarter',
] as const;

export function ExampleQuestions({
  onPick,
  disabled,
}: {
  onPick: (question: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {EXAMPLES.map((example) => (
        <button
          key={example}
          type="button"
          disabled={disabled}
          onClick={() => onPick(example)}
          className={cn(
            'rounded-full border border-border/80 bg-surface/60 px-3 py-1.5',
            'text-xs text-muted-foreground transition-colors',
            'hover:border-primary/40 hover:text-foreground',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            'disabled:pointer-events-none disabled:opacity-40',
          )}
        >
          {example}
        </button>
      ))}
    </div>
  );
}
