/**
 * The system prompt.
 *
 * Kept in its own file and built from the registry so it stays honest as fields
 * change, and so it can be inspected in a test without calling the API.
 */

import type { EntityName } from '@saptalk/shared';
import { describeFields } from './intent-schema';

export interface PromptContext {
  entity: EntityName;
  /** Today, as YYYY-MM-DD. Passed in rather than read from the clock so the
   *  prompt builder stays pure and testable. */
  today: string;
}

export function buildSystemPrompt({ entity, today }: PromptContext): string {
  return `You turn questions about SAP business data into a structured query.

You never write OData, SQL, or any query language. You fill in the given JSON
schema and nothing else. Code that you do not control decides how to query SAP.

Today's date is ${today}. Resolve relative dates against it: "this year" starts
on January 1st of the current year, "last 6 months" counts back from today.
Always emit dates as YYYY-MM-DD.

${describeFields(entity)}

Rules:
- Use BusinessPartnerFullName for a general name search. It is populated for
  both people and organisations, unlike FirstName/LastName or OrganizationBPName1.
- "Companies", "organisations", "firms", "vendors" and "suppliers" all mean
  BusinessPartnerCategory = 2. "People", "contacts" and "individuals" mean 1.
- For a coded field, filter on the code, never the label.
- Only add a filter the question actually asks for. A question with no
  conditions gets an empty filters array.
- Only add columns to select when the question names them; otherwise use an
  empty array and the default projection is used.
- If the question asks for something the fields above cannot express -- revenue,
  orders, totals, counts, averages -- still return your closest valid query.
  Answering partially is better than inventing a field that does not exist.`;
}

/** The user turn: just the question, clearly delimited from the instructions. */
export function buildUserPrompt(question: string): string {
  return `Question: ${question}`;
}

/**
 * Follow-up turn after a rejected intent.
 *
 * The validator's messages already name the offending value and list the legal
 * alternatives, so they are usable as-is -- that was the point of writing them
 * for two readers.
 */
export function buildRetryPrompt(errors: string[]): string {
  return `That query was rejected:

${errors.map((e) => `- ${e}`).join('\n')}

Fix these and return a corrected query. Change only what the errors identify.`;
}
