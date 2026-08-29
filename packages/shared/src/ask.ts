import type { QueryEnvelope } from './api';
import type { ResolvedQueryIntent } from './query-intent';

/**
 * Response to a natural-language question.
 *
 * Carries the intent as well as the query, because showing both is what makes
 * the system inspectable: the intent is what the model decided, the query is
 * what our code built from it, and a user can see that the second follows from
 * the first.
 */
export interface AskResponse extends QueryEnvelope {
  question: string;
  intent: ResolvedQueryIntent;
  /** Model calls needed. 2 means the first attempt was rejected and corrected. */
  attempts: number;
  model: string;
  /** Time spent waiting on the model, separate from time spent waiting on SAP. */
  modelMs: number;
}

/** Body of a rejected question, after the model failed to produce a valid intent. */
export interface AskRejection {
  message: string;
  /** What was wrong with the model's final attempt. */
  errors: string[];
  attempts: number;
}
