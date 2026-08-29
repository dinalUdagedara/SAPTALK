import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { validateIntent, type ResolvedQueryIntent } from '@saptalk/shared';
import { OpenAiService, type ChatMessage } from './openai.service';
import { buildIntentJsonSchema } from './intent-schema';
import { buildRetryPrompt, buildSystemPrompt, buildUserPrompt } from './prompt';

export interface GeneratedIntent {
  intent: ResolvedQueryIntent;
  attempts: number;
  modelMs: number;
  model: string;
}

/** One retry. A second failure on the same errors is unlikely to be a third. */
const MAX_ATTEMPTS = 2;

/**
 * Turns a question into a validated intent.
 *
 * The model is asked for an intent; the intent is validated; if validation
 * fails the errors are handed back and it is asked again, once. What is
 * returned has always passed validateIntent -- callers never see a raw model
 * response, and there is no path here that skips the check.
 */
@Injectable()
export class IntentGeneratorService {
  private readonly logger = new Logger(IntentGeneratorService.name);

  constructor(private readonly openai: OpenAiService) {}

  async generate(question: string, now: Date = new Date()): Promise<GeneratedIntent> {
    // The model now chooses the entity too, so nothing here names one.
    const schema = buildIntentJsonSchema();
    const messages: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt({ today: isoDate(now) }) },
      { role: 'user', content: buildUserPrompt(question) },
    ];

    let modelMs = 0;
    let lastErrors: string[] = [];

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const completion = await this.openai.complete(messages, 'query_intent', schema);
      modelMs += completion.durationMs;

      const result = validateIntent(completion.data);
      if (result.ok) {
        if (attempt > 1) {
          this.logger.log(`Question resolved on attempt ${attempt} after: ${lastErrors.join('; ')}`);
        }
        return {
          intent: result.intent,
          attempts: attempt,
          modelMs,
          model: this.openai.modelName,
        };
      }

      lastErrors = result.errors;
      this.logger.warn(`Attempt ${attempt} rejected: ${result.errors.join('; ')}`);

      // Feed the rejection back verbatim. The validator's messages already name
      // the bad value and list the alternatives, which is what a retry needs.
      messages.push(
        { role: 'assistant', content: JSON.stringify(completion.data) },
        { role: 'user', content: buildRetryPrompt(result.errors) },
      );
    }

    throw new UnprocessableEntityException({
      message: 'That question could not be turned into a query I am allowed to run.',
      errors: lastErrors,
      attempts: MAX_ATTEMPTS,
    });
  }
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
