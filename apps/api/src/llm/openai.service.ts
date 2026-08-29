import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JsonSchema } from './intent-schema';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StructuredCompletion {
  /** Parsed JSON object the model produced. */
  data: unknown;
  durationMs: number;
  /** Token usage, for cost visibility. */
  usage?: { prompt: number; completion: number };
}

const REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_MODEL = 'gpt-4.1-mini';

/**
 * Thin transport over the OpenAI chat completions API.
 *
 * Native fetch, matching SapService: the request is a single POST and an SDK
 * would add a dependency without removing any real work.
 *
 * Structured outputs with `strict: true` mean the model's reply is guaranteed
 * to parse and to match the schema's shape. That guarantee covers shape only --
 * whether the content is *permissible* is a separate question, answered by
 * validateIntent, never here.
 */
@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
  private readonly apiKey: string;
  private readonly model: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'OPENAI_API_KEY is not set. Add it to apps/api/.env to enable natural-language questions.',
      );
    }
    this.apiKey = apiKey;
    this.model = config.get<string>('OPENAI_MODEL') ?? DEFAULT_MODEL;
  }

  get modelName(): string {
    return this.model;
  }

  async complete(
    messages: ChatMessage[],
    schemaName: string,
    schema: JsonSchema,
  ): Promise<StructuredCompletion> {
    const startedAt = Date.now();

    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          // Deterministic-ish: the same question should produce the same query.
          temperature: 0,
          response_format: {
            type: 'json_schema',
            json_schema: { name: schemaName, strict: true, schema },
          },
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'TimeoutError';
      this.logger.error('OpenAI request failed', error as Error);
      throw isTimeout
        ? new GatewayTimeoutException(
            `The model did not respond within ${REQUEST_TIMEOUT_MS / 1000}s.`,
          )
        : new BadGatewayException('Could not reach the model.');
    }

    const durationMs = Date.now() - startedAt;
    const text = await response.text();

    if (!response.ok) {
      this.logger.error(`OpenAI ${response.status}: ${text.slice(0, 400)}`);
      throw new BadGatewayException({
        message: `The model returned ${response.status}.`,
        detail: safeJson(text) ?? text.slice(0, 500),
      });
    }

    const body = safeJson(text) as OpenAiResponse | undefined;
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new BadGatewayException('The model returned no content.');
    }

    // strict mode guarantees this parses; a failure here means the contract
    // changed, and is worth surfacing loudly rather than swallowing.
    const data = safeJson(content);
    if (data === undefined) {
      throw new BadGatewayException('The model returned content that was not valid JSON.');
    }

    this.logger.log(
      `model ${this.model} responded in ${durationMs}ms ` +
        `(${body?.usage?.prompt_tokens ?? '?'} prompt / ${body?.usage?.completion_tokens ?? '?'} completion tokens)`,
    );

    return {
      data,
      durationMs,
      usage: body?.usage
        ? { prompt: body.usage.prompt_tokens, completion: body.usage.completion_tokens }
        : undefined,
    };
  }
}

interface OpenAiResponse {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens: number; completion_tokens: number };
}

function safeJson(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
