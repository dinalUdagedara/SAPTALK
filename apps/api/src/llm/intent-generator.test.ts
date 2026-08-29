import { describe, expect, it, vi } from 'vitest';
import { UnprocessableEntityException } from '@nestjs/common';
import { IntentGeneratorService } from './intent-generator.service';
import type { OpenAiService, StructuredCompletion } from './openai.service';

/**
 * A stand-in for the model, so the retry loop can be exercised deterministically
 * and for free. Every response the real model could give is just a value here.
 */
function fakeOpenAi(responses: unknown[]): OpenAiService {
  let call = 0;
  return {
    modelName: 'fake-model',
    complete: vi.fn(async (): Promise<StructuredCompletion> => {
      const data = responses[Math.min(call, responses.length - 1)];
      call += 1;
      return { data, durationMs: 10 };
    }),
  } as unknown as OpenAiService;
}

const VALID = {
  entity: 'BusinessPartner',
  select: [],
  filters: [{ field: 'BusinessPartnerCategory', op: 'eq', value: '2' }],
  filterLogic: 'and',
  orderBy: [],
  top: 25,
};

/** Passes the JSON schema's shape but names a field that does not exist. */
const UNKNOWN_FIELD = { ...VALID, select: ['Salary'] };

/** Shape is fine; the operator is illegal for a date. */
const ILLEGAL_OPERATOR = {
  ...VALID,
  filters: [{ field: 'CreationDate', op: 'contains', value: '2024' }],
};

describe('first attempt succeeds', () => {
  it('returns the validated intent without retrying', async () => {
    const openai = fakeOpenAi([VALID]);
    const result = await new IntentGeneratorService(openai).generate('organisations');

    expect(result.attempts).toBe(1);
    expect(result.intent.filters[0].field).toBe('BusinessPartnerCategory');
    expect(openai.complete).toHaveBeenCalledTimes(1);
  });

  it('resolves defaults, so an empty select becomes the default projection', async () => {
    const result = await new IntentGeneratorService(fakeOpenAi([VALID])).generate('q');
    expect(result.intent.select.length).toBeGreaterThan(0);
  });
});

describe('the retry loop', () => {
  it('recovers when the first attempt names an unknown field', async () => {
    const openai = fakeOpenAi([UNKNOWN_FIELD, VALID]);
    const result = await new IntentGeneratorService(openai).generate('salaries please');

    expect(result.attempts).toBe(2);
    expect(openai.complete).toHaveBeenCalledTimes(2);
  });

  it('recovers from an illegal operator', async () => {
    const result = await new IntentGeneratorService(
      fakeOpenAi([ILLEGAL_OPERATOR, VALID]),
    ).generate('dates containing 2024');
    expect(result.attempts).toBe(2);
  });

  it('feeds the validator errors back verbatim, with the rejected intent', async () => {
    const openai = fakeOpenAi([UNKNOWN_FIELD, VALID]);
    await new IntentGeneratorService(openai).generate('q');

    const secondCall = vi.mocked(openai.complete).mock.calls[1];
    const messages = secondCall[0];

    // system, user, the rejected assistant reply, then the correction
    expect(messages).toHaveLength(4);
    expect(messages[2].role).toBe('assistant');
    expect(messages[2].content).toContain('Salary');
    expect(messages[3].content).toContain('Unknown field "Salary"');
    expect(messages[3].content).toContain('Available fields');
  });
});

describe('giving up', () => {
  it('stops after two attempts rather than looping', async () => {
    const openai = fakeOpenAi([UNKNOWN_FIELD, UNKNOWN_FIELD, VALID]);
    await expect(new IntentGeneratorService(openai).generate('q')).rejects.toThrow(
      UnprocessableEntityException,
    );
    expect(openai.complete).toHaveBeenCalledTimes(2);
  });

  it('reports why, so the failure is explainable rather than opaque', async () => {
    const service = new IntentGeneratorService(fakeOpenAi([UNKNOWN_FIELD]));
    await service.generate('q').then(
      () => expect.fail('should have thrown'),
      (error: UnprocessableEntityException) => {
        const body = error.getResponse() as { errors: string[]; attempts: number };
        expect(body.attempts).toBe(2);
        expect(body.errors[0]).toContain('Salary');
      },
    );
  });

  // The guarantee the whole design rests on.
  it('never returns an intent that failed validation', async () => {
    const openai = fakeOpenAi([ILLEGAL_OPERATOR, UNKNOWN_FIELD]);
    await expect(new IntentGeneratorService(openai).generate('q')).rejects.toThrow();
  });
});

describe('date handling', () => {
  it("anchors the prompt to the caller's clock, not the system clock", async () => {
    const openai = fakeOpenAi([VALID]);
    await new IntentGeneratorService(openai).generate('q', new Date('2031-03-07T12:00:00Z'));

    const messages = vi.mocked(openai.complete).mock.calls[0][0];
    expect(messages[0].content).toContain('2031-03-07');
  });
});
