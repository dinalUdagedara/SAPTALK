'use client';

import { ArrowUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AskBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

/**
 * The primary input. Deliberately the largest thing on the page -- everything
 * else on screen is a consequence of what is typed here.
 */
export function AskBar({ value, onChange, onSubmit, loading }: AskBarProps) {
  const canSubmit = value.trim().length > 0 && !loading;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) onSubmit();
      }}
      className={cn(
        'group relative flex w-full items-center gap-2 rounded-xl border border-border bg-surface py-2 pl-3 pr-2 sm:pl-4',
        'transition-colors focus-within:border-primary/60',
        'focus-within:shadow-[0_0_0_4px_oklch(0.812_0.128_182/0.10)]',
      )}
    >
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={loading}
        maxLength={300}
        placeholder="Ask about business partners…"
        aria-label="Ask a question about business partners"
        className={cn(
          'h-10 flex-1 bg-transparent text-[15px] text-foreground outline-none',
          'placeholder:text-muted-foreground/70 disabled:opacity-60',
        )}
      />
      <Button
        type="submit"
        size="icon"
        disabled={!canSubmit}
        aria-label="Run question"
        className="size-9 shrink-0 rounded-lg"
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ArrowUp className="size-4" />
        )}
      </Button>
    </form>
  );
}
