import { BadRequestException, Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import type { AskResponse } from '@saptalk/shared';
import { AskThrottleGuard } from '../common/ask-throttle.guard';
import { BusinessPartnerService } from '../sap/business-partner.service';
import { IntentGeneratorService } from '../llm/intent-generator.service';

const MAX_QUESTION_LENGTH = 300;

@Controller('ask')
export class AskController {
  constructor(
    private readonly intents: IntentGeneratorService,
    private readonly businessPartners: BusinessPartnerService,
  ) {}

  /**
   * POST /api/ask  { "question": "organisations added this year" }
   *
   * The full path: question -> model -> intent -> validate -> compile -> SAP.
   * The response carries the intent and the generated query alongside the rows,
   * so a user can see what was decided on their behalf and check it followed.
   */
  @Post()
  @HttpCode(200)
  @UseGuards(AskThrottleGuard)
  async ask(@Body() body: unknown): Promise<AskResponse> {
    const question = readQuestion(body);
    const generated = await this.intents.generate(question);
    const envelope = await this.businessPartners.query(generated.intent);

    return {
      ...envelope,
      question,
      intent: generated.intent,
      attempts: generated.attempts,
      model: generated.model,
      modelMs: generated.modelMs,
    };
  }
}

/**
 * The question is free text and goes into a prompt, so it is bounded here.
 * Nothing else about it is trusted: it cannot reach a query except by way of an
 * intent that has passed the field allowlist.
 */
function readQuestion(body: unknown): string {
  const raw = (body as { question?: unknown } | null)?.question;
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new BadRequestException('Ask a question, for example "organisations added this year".');
  }
  const question = raw.trim();
  if (question.length > MAX_QUESTION_LENGTH) {
    throw new BadRequestException(
      `That question is ${question.length} characters; the limit is ${MAX_QUESTION_LENGTH}.`,
    );
  }
  return question;
}
