'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Break a query URL into readable parts.
 *
 * The URL arrives percent-encoded and on one line, which is unreadable at the
 * size that matters. Decoding and splitting is presentation only -- the string
 * copied to the clipboard is the real one.
 */
function splitQuery(url: string): { base: string; params: [string, string][] } {
  const [base, search = ''] = url.split('?');
  const params = search
    .split('&')
    .filter(Boolean)
    .map((pair): [string, string] => {
      const index = pair.indexOf('=');
      return [decodePart(pair.slice(0, index)), decodePart(pair.slice(index + 1))];
    });
  return { base, params };
}

/**
 * Decode one query-string component.
 *
 * A query string encodes a space as `+`, which decodeURIComponent leaves alone
 * -- so a filter renders as `BusinessPartnerCategory+eq+'2'` without this.
 */
function decodePart(part: string): string {
  return decodeURIComponent(part.replace(/\+/g, ' '));
}

/** Shorten the host and service path; the entity set is the part that matters. */
function shortenBase(base: string): string {
  const match = /\/([A-Za-z_]+)$/.exec(base);
  return match ? `…/${match[1]}` : base;
}

/**
 * Values longer than this are collapsed by default.
 *
 * A join restricts by an or-chain of up to a hundred keys, which runs to
 * thousands of characters and buries the condition the user actually asked
 * about. Collapsing keeps the panel readable; the full text is one click away
 * and the copy button always copies the real URL.
 */
const COLLAPSE_OVER = 240;

/**
 * What our code built. The brightest element on the page, deliberately: the
 * whole product claim is that this is inspectable.
 */
export function QueryPanel({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { base, params } = splitQuery(url);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked by permissions; the query is on screen anyway.
    }
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={copy}
        aria-label={copied ? 'Query copied' : 'Copy full query URL'}
        className="absolute right-0 top-0 size-7 text-muted-foreground hover:text-foreground"
      >
        {copied ? <Check className="size-3.5 text-signal-ok" /> : <Copy className="size-3.5" />}
      </Button>

      <div className="pr-8">
        <pre className="whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed">
          <code>
            <span className="text-muted-foreground">{shortenBase(base)}</span>
            {params.map(([key, value]) => {
              const long = value.length > COLLAPSE_OVER;
              const open = expanded[key] ?? false;
              const shown = long && !open ? value.slice(0, COLLAPSE_OVER) : value;

              return (
                <span key={key} className="block pl-4">
                  {/* The `?$key=` prefix must not break, or a long value pushes
                      the `?` onto a line of its own. Only the value wraps. */}
                  <span className="whitespace-nowrap">
                    <span className="text-muted-foreground">?</span>
                    <span className="text-primary">{key}</span>
                    <span className="text-muted-foreground">=</span>
                  </span>
                  <span className="break-all text-foreground">{shown}</span>
                  {long && (
                    <>
                      {!open && <span className="text-muted-foreground">…</span>}{' '}
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded((current) => ({ ...current, [key]: !open }))
                        }
                        className="rounded text-[11px] text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        {open
                          ? 'show less'
                          : `show all ${value.length.toLocaleString()} characters`}
                      </button>
                    </>
                  )}
                </span>
              );
            })}
          </code>
        </pre>
      </div>
    </div>
  );
}
