/**
 * Fixed-window rate limiting for the one endpoint that costs money per call.
 *
 * Kept as a pure class with an injected clock so the windows can be tested
 * without waiting for real time to pass.
 *
 * Honest limitation: this counts in process memory. On a serverless host each
 * instance keeps its own tally, so a burst spread across instances can exceed
 * the nominal limit. It is a speed bump against casual abuse, not a guarantee.
 * The actual guarantee has to come from a spend cap on the OpenAI account,
 * which is the one limit an attacker cannot route around.
 */

export interface RateLimitDecision {
  allowed: boolean;
  /** Why it was refused, phrased for the person who hit it. */
  reason?: string;
  /** Seconds until the caller may retry. */
  retryAfter?: number;
}

export interface RateLimiterOptions {
  /** Requests allowed per client per hour. */
  perClientPerHour: number;
  /** Requests allowed across all clients per day. */
  globalPerDay: number;
  now?: () => number;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

interface Window {
  count: number;
  resetsAt: number;
}

export class RateLimiter {
  private readonly clients = new Map<string, Window>();
  private globalWindow: Window;
  private readonly now: () => number;

  constructor(private readonly options: RateLimiterOptions) {
    this.now = options.now ?? Date.now;
    this.globalWindow = { count: 0, resetsAt: this.now() + DAY_MS };
  }

  check(clientId: string): RateLimitDecision {
    const now = this.now();

    if (now >= this.globalWindow.resetsAt) {
      this.globalWindow = { count: 0, resetsAt: now + DAY_MS };
    }
    if (this.globalWindow.count >= this.options.globalPerDay) {
      return {
        allowed: false,
        reason:
          'This demo has hit its daily question limit. It resets tomorrow — the code and the API are still yours to run locally.',
        retryAfter: Math.ceil((this.globalWindow.resetsAt - now) / 1000),
      };
    }

    let client = this.clients.get(clientId);
    if (!client || now >= client.resetsAt) {
      client = { count: 0, resetsAt: now + HOUR_MS };
      this.clients.set(clientId, client);
    }
    if (client.count >= this.options.perClientPerHour) {
      return {
        allowed: false,
        reason: `You have used all ${this.options.perClientPerHour} questions for this hour. Try again shortly.`,
        retryAfter: Math.ceil((client.resetsAt - now) / 1000),
      };
    }

    client.count += 1;
    this.globalWindow.count += 1;
    this.prune(now);
    return { allowed: true };
  }

  /** Drop expired client windows so the map cannot grow without bound. */
  private prune(now: number): void {
    if (this.clients.size < 1000) return;
    for (const [id, window] of this.clients) {
      if (now >= window.resetsAt) this.clients.delete(id);
    }
  }
}
