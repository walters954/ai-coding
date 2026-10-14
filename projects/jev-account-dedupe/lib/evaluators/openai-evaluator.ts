import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { CrmAccount, InboundAccount } from '@/types/crm';
import { EvaluationResult, mockEvaluateOpenAI } from './mock-evaluator';

export async function evaluateWithOpenAI(
  inbound: InboundAccount,
  candidate: CrmAccount | null,
  customApiKey?: string
): Promise<EvaluationResult> {
  const startTime = performance.now();

  if (!candidate) {
    return mockEvaluateOpenAI(inbound, null);
  }

  const apiKey =
    customApiKey ||
    process.env.OPENAI_API_KEY ||
    process.env.AI_GATEWAY_API_KEY;

  if (!apiKey) {
    return mockEvaluateOpenAI(inbound, candidate);
  }

  try {
    const openai = createOpenAI({
      apiKey,
      baseURL: process.env.AI_GATEWAY_API_KEY
        ? 'https://gateway.ai.cloudflare.com/v1/' // or AI gateway endpoint
        : undefined,
    });

    const result = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: z.object({
        score: z
          .number()
          .describe(
            'Score from 0.0 to 2.0 where 0 is unrelated, 1 is related/subsidiary, 2 is same entity duplicate'
          ),
        confidence: z.number().describe('Confidence from 0.0 to 1.0'),
        sameBrand: z.boolean(),
        sameDomain: z.boolean(),
        reason: z.string().describe('Short explanation of the decision'),
      }),
      prompt: `You are an enterprise CRM deduplication agent.
Evaluate if the following inbound lead record duplicates the existing CRM account.

Inbound Lead:
${JSON.stringify(inbound, null, 2)}

Existing CRM Account:
${JSON.stringify(candidate, null, 2)}
`,
    });

    const elapsed = Math.round(performance.now() - startTime);
    const usage = result.usage;
    const inputTokens = usage?.inputTokens ?? 280;
    const outputTokens = usage?.outputTokens ?? 90;
    const costUsd =
      (inputTokens / 1_000_000) * 0.15 + (outputTokens / 1_000_000) * 0.60;

    return {
      score: result.object.score,
      confidence: result.object.confidence,
      sameBrand: result.object.sameBrand,
      sameDomain: result.object.sameDomain,
      reason: result.object.reason,
      inputTokens,
      outputTokens,
      durationMs: elapsed,
      costUsd,
      isMock: false,
    };
  } catch (error: unknown) {
    console.warn(
      'Live OpenAI evaluation failed. Falling back to mock engine.',
      error instanceof Error ? error.message : error
    );
    return mockEvaluateOpenAI(inbound, candidate);
  }
}
