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
 * What our code built. The brightest element on the page, deliberately: the
 * whole product claim is that this is inspectable.
 */
export function QueryPanel({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
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
            {params.map(([key, value]) => (
              <span key={key} className="block pl-4">
                {/* The `?$key=` prefix must not break, or a long value pushes
                    the `?` onto a line of its own. Only the value wraps. */}
                <span className="whitespace-nowrap">
                  <span className="text-muted-foreground">?</span>
                  <span className="text-primary">{key}</span>
                  <span className="text-muted-foreground">=</span>
                </span>
                <span className="break-all text-foreground">{value}</span>
              </span>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}
