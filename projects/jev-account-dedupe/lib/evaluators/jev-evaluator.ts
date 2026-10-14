import { experimental_evaluate as evaluate } from 'ai';
import {
  TypeSafeClient,
  score as scoreQuestion,
  noul as noulQuestion,
} from '@typesafe-ai/sdk';
import { CrmAccount, InboundAccount } from '@/types/crm';
import { EvaluationResult, mockEvaluateJev } from './mock-evaluator';

export async function evaluateWithJev(
  inbound: InboundAccount,
  candidate: CrmAccount | null,
  customApiKey?: string
): Promise<EvaluationResult> {
  const startTime = performance.now();

  if (!candidate) {
    return mockEvaluateJev(inbound, null);
  }

  const apiKey =
    customApiKey ||
    process.env.TYPESAFE_API_KEY ||
    process.env.AI_GATEWAY_API_KEY;

  if (!apiKey) {
    // No API key configured -> use realistic mock engine
    return mockEvaluateJev(inbound, candidate);
  }

  try {
    const state = {
      inbound_lead: {
        name: inbound.name,
        website: inbound.website,
        city: inbound.city,
        country: inbound.country,
        industry: inbound.industry ?? null,
      },
      existing_crm_account: {
        id: candidate.id,
        name: candidate.name,
        domain: candidate.domain,
        legal_name: candidate.legalName ?? null,
        city: candidate.headquarters.city,
        country: candidate.headquarters.country,
        industry: candidate.industry,
        aliases: candidate.aliases ?? null,
      },
    };

    let score = 0;
    let confidence = 0.9;
    let sameBrand = false;
    let sameDomain = false;
    let inputTokens = 0;
    let outputTokens = 0;

    const isDirectTypeSafe =
      apiKey.startsWith('apikey_') ||
      apiKey.startsWith('ts_') ||
      Boolean(
        process.env.TYPESAFE_API_KEY &&
          (!customApiKey || customApiKey === process.env.TYPESAFE_API_KEY)
      );

    if (isDirectTypeSafe) {
      const typeSafeKey =
        apiKey.startsWith('apikey_') || apiKey.startsWith('ts_')
          ? apiKey
          : process.env.TYPESAFE_API_KEY || apiKey;

      const client = new TypeSafeClient({ apiKey: typeSafeKey });
      const res = await client.systemOne({
        state,
        questions: {
          duplicate_grade: scoreQuestion(
            'How do these two company records relate as CRM accounts?',
            [
              'Different and unrelated companies.',
              'Related entities, corporate subsidiaries, or regional divisions requiring curator review.',
              'The same company entity with minor domain, name, or formatting differences.',
            ]
          ),
          same_brand: noulQuestion(
            'Are both records referring to the same commercial brand identity?'
          ),
          same_domain_root: noulQuestion(
            'Do both records point to the same root web domain or online service?'
          ),
        },
      });

      const gradeAnswer = res.answers?.duplicate_grade;
      score = gradeAnswer?.score ?? 0;
      confidence = gradeAnswer?.confidence ?? 0.9;
      const sameBrandAns = res.answers?.same_brand as
        | { noul?: number }
        | undefined;
      const sameDomainAns = res.answers?.same_domain_root as
        | { noul?: number }
        | undefined;
      sameBrand = (sameBrandAns?.noul ?? 0.5) >= 0.5;
      sameDomain = (sameDomainAns?.noul ?? 0.5) >= 0.5;
      inputTokens =
        res.usage?.input_tokens ??
        Math.max(110, Math.round(JSON.stringify(state).length / 3.8));
      outputTokens = res.usage?.output_tokens ?? 0;
    } else {
      // Call Jev through Vercel AI SDK experimental_evaluate
      const result = await evaluate({
        model: 'typesafe-ai/jev',
        state,
        questions: {
          duplicate_grade: {
            type: 'score',
            instructions:
              'How do these two company records relate as CRM accounts?',
            criteria: [
              'Different and unrelated companies.',
              'Related entities, corporate subsidiaries, or regional divisions requiring curator review.',
              'The same company entity with minor domain, name, or formatting differences.',
            ],
          },
          same_brand: {
            type: 'boolean',
            instructions:
              'Are both records referring to the same commercial brand identity?',
          },
          same_domain_root: {
            type: 'boolean',
            instructions:
              'Do both records point to the same root web domain or online service?',
          },
        },
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      const gradeAnswer = result.answers?.duplicate_grade as {
        score?: number;
        confidence?: number;
      } | undefined;
      const sameBrandAnswer = result.answers?.same_brand as {
        probability?: number;
      } | undefined;
      const sameDomainAnswer = result.answers?.same_domain_root as {
        probability?: number;
      } | undefined;

      score = gradeAnswer?.score ?? (gradeAnswer ? 1.0 : 0);
      confidence = gradeAnswer?.confidence ?? 0.9;
      sameBrand = (sameBrandAnswer?.probability ?? 0.5) >= 0.5;
      sameDomain = (sameDomainAnswer?.probability ?? 0.5) >= 0.5;

      const stateJson = JSON.stringify(state);
      inputTokens = Math.max(110, Math.round(stateJson.length / 3.8));
      outputTokens = 0; // Jev outputs zero generation tokens
    }

    const elapsed = Math.round(performance.now() - startTime);
    const costUsd = (inputTokens / 1_000_000) * 0.042;

    let reason = '';
    if (score >= 1.6) {
      reason = `Jev classified as exact duplicate (score: ${score.toFixed(2)}, confidence: ${confidence.toFixed(2)}). Same brand identity.`;
    } else if (score >= 0.8) {
      reason = `Jev flagged as related entity / regional subsidiary (score: ${score.toFixed(2)}). Routed to human review.`;
    } else {
      reason = `Jev determined entities are unrelated (score: ${score.toFixed(2)}). Different businesses.`;
    }

    return {
      score,
      confidence,
      sameBrand,
      sameDomain,
      reason,
      inputTokens,
      outputTokens,
      durationMs: elapsed,
      costUsd,
      isMock: false,
    };
  } catch (error: unknown) {
    console.warn(
      'Live Jev evaluation failed or unauthorized. Falling back to mock engine.',
      error instanceof Error ? error.message : error
    );
    return mockEvaluateJev(inbound, candidate);
  }
}
