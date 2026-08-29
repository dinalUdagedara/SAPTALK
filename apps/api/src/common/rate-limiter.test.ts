import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rate-limiter';

/** A controllable clock, so windows can be tested without waiting. */
function at(start = 0) {
  let now = start;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

const HOUR = 60 * 60 * 1000;

describe('per-client limit', () => {
  it('allows up to the limit then refuses', () => {
    const limiter = new RateLimiter({ perClientPerHour: 3, globalPerDay: 100 });
    expect([1, 2, 3].map(() => limiter.check('a').allowed)).toEqual([true, true, true]);
    expect(limiter.check('a').allowed).toBe(false);
  });

  it('counts clients separately', () => {
    const limiter = new RateLimiter({ perClientPerHour: 1, globalPerDay: 100 });
    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(false);
    expect(limiter.check('b').allowed).toBe(true);
  });

  it('refills after the hour', () => {
    const clock = at();
    const limiter = new RateLimiter({ perClientPerHour: 1, globalPerDay: 100, now: clock.now });
    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(false);
    clock.advance(HOUR + 1);
    expect(limiter.check('a').allowed).toBe(true);
  });

  it('says how long to wait', () => {
    const limiter = new RateLimiter({ perClientPerHour: 1, globalPerDay: 100 });
    limiter.check('a');
    const denied = limiter.check('a');
    expect(denied.retryAfter).toBeGreaterThan(0);
    expect(denied.retryAfter).toBeLessThanOrEqual(3600);
  });
});

describe('global daily cap', () => {
  it('stops everyone once the budget is spent', () => {
    const limiter = new RateLimiter({ perClientPerHour: 100, globalPerDay: 2 });
    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('b').allowed).toBe(true);
    // A fresh client is still refused: the cap protects the account, not a user.
    expect(limiter.check('c').allowed).toBe(false);
  });

  it('explains that the limit is the demo, not the user', () => {
    const limiter = new RateLimiter({ perClientPerHour: 100, globalPerDay: 1 });
    limiter.check('a');
    expect(limiter.check('b').reason).toContain('daily question limit');
  });

  it('resets the next day', () => {
    const clock = at();
    const limiter = new RateLimiter({ perClientPerHour: 100, globalPerDay: 1, now: clock.now });
    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(false);
    clock.advance(24 * HOUR + 1);
    expect(limiter.check('a').allowed).toBe(true);
  });

  // A refused request must not consume budget, or a burst of denials would
  // lock out the rest of the day.
  it('does not charge the global budget for a refused request', () => {
    const limiter = new RateLimiter({ perClientPerHour: 1, globalPerDay: 5 });
    limiter.check('a');
    for (let i = 0; i < 10; i++) limiter.check('a');
    expect([1, 2, 3, 4].map(() => limiter.check(`other-${Math.random()}`).allowed)).toEqual([
      true, true, true, true,
    ]);
  });
});
