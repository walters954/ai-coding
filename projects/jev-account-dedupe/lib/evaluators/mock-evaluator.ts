import { CrmAccount, InboundAccount } from '@/types/crm';

export interface EvaluationResult {
  score: number; // 0 (unrelated), 1 (subsidiary/review), 2 (same entity)
  confidence: number;
  sameBrand: boolean;
  sameDomain: boolean;
  reason: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  costUsd: number;
  isMock: boolean;
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
}

/**
 * Realistic Mock Engine for Jev System One evaluation.
 * Jev returns 0 output tokens, ~60-95ms latency, $0.042/1M input tokens.
 */
export async function mockEvaluateJev(
  inbound: InboundAccount,
  candidate: CrmAccount | null
): Promise<EvaluationResult> {
  // Realistic Jev latency (fast evaluation model without autoregressive token generation)
  const simulatedMs = Math.floor(Math.random() * 35) + 65; // 65-100ms
  await new Promise((r) => setTimeout(r, simulatedMs));

  const inputTokens = 120 + Math.floor(Math.random() * 30);
  const outputTokens = 0; // Jev produces zero output tokens!
  const costUsd = (inputTokens / 1_000_000) * 0.042; // $0.042 per 1M input tokens

  const mockRequestPayload = {
    model: 'typesafe-ai/jev',
    endpoint: 'https://gateway.ai.cloudflare.com/v1/.../typesafe-ai/evaluate',
    state: {
      inbound_lead: {
        id: inbound.id,
        name: inbound.name,
        website: inbound.website,
        city: inbound.city,
        country: inbound.country,
        industry: inbound.industry,
      },
      candidate_account: candidate
        ? {
            id: candidate.id,
            name: candidate.name,
            domain: candidate.domain,
            legalName: candidate.legalName,
            city: candidate.headquarters.city,
            country: candidate.headquarters.country,
          }
        : null,
    },
    questions: {
      duplicate_grade: {
        type: 'score',
        instructions:
          'How do these two company records relate as CRM accounts?',
        criteria: [
          'Different and unrelated companies.',
          'Related entities, corporate subsidiaries, or regional divisions requiring review.',
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
  };

  if (!candidate) {
    return {
      score: 0.05,
      confidence: 0.98,
      sameBrand: false,
      sameDomain: false,
      reason: 'No matching entity in existing CRM database.',
      inputTokens,
      outputTokens,
      durationMs: simulatedMs,
      costUsd,
      isMock: true,
      requestPayload: mockRequestPayload,
      responsePayload: {
        answers: {
          duplicate_grade: { type: 'score', score: 0.05, confidence: 0.98 },
          same_brand: { type: 'boolean', probability: 0.02 },
          same_domain_root: { type: 'boolean', probability: 0.01 },
        },
      },
    };
  }

  // Determine score based on ground truth scenario
  let score = 0.08;
  let confidence = 0.95;
  let sameBrand = false;
  let sameDomain = false;
  let reason = '';

  switch (inbound.scenarioType) {
    case 'exact_duplicate':
      score = 1.95;
      confidence = 0.98;
      sameBrand = true;
      sameDomain = true;
      reason = `High confidence match with ${candidate.name}. Identical brand identity and core domain presence.`;
      break;

    case 'fuzzy_duplicate':
      score = 1.88;
      confidence = 0.94;
      sameBrand = true;
      sameDomain = true;
      reason = `Matched ${candidate.name}. Suffix or subdomain variation recognized as the same operating corporate entity.`;
      break;

    case 'subsidiary_review':
      score = 1.15;
      confidence = 0.88;
      sameBrand = true;
      sameDomain = false;
      reason = `Related regional subsidiary/affiliate of ${candidate.name} (${inbound.city}, ${inbound.country}). Routed to human curator to decide on child account hierarchy.`;
      break;

    case 'false_positive_risk':
      score = 0.12;
      confidence = 0.96;
      sameBrand = false;
      sameDomain = false;
      reason = `Shared keyword with ${candidate.name}, but operates in a completely different industry (${inbound.industry}) with distinct web presence.`;
      break;

    case 'brand_new':
    default:
      score = 0.08;
      confidence = 0.97;
      sameBrand = false;
      sameDomain = false;
      reason = 'Distinct and new organization. Safe to create as new CRM account record.';
      break;
  }

  return {
    score,
    confidence,
    sameBrand,
    sameDomain,
    reason,
    inputTokens,
    outputTokens,
    durationMs: simulatedMs,
    costUsd,
    isMock: true,
    requestPayload: mockRequestPayload,
    responsePayload: {
      answers: {
        duplicate_grade: {
          type: 'score',
          score,
          confidence,
          probabilities: [
            Math.max(0, 1 - score / 2),
            Math.abs(1 - Math.abs(score - 1)),
            Math.min(1, score / 2),
          ],
        },
        same_brand: {
          type: 'boolean',
          probability: sameBrand ? 0.97 : 0.03,
        },
        same_domain_root: {
          type: 'boolean',
          probability: sameDomain ? 0.96 : 0.04,
        },
      },
    },
  };
}

/**
 * Realistic Mock Engine for OpenAI (GPT-4o-mini).
 * Latency ~850-1300ms, input tokens ~300, output tokens ~120, cost ~ $0.00012
 */
export async function mockEvaluateOpenAI(
  inbound: InboundAccount,
  candidate: CrmAccount | null
): Promise<EvaluationResult> {
  // Realistic LLM autoregressive text generation latency
  const simulatedMs = Math.floor(Math.random() * 450) + 850; // 850-1300ms
  await new Promise((r) => setTimeout(r, simulatedMs));

  const inputTokens = 290 + Math.floor(Math.random() * 40);
  const outputTokens = 110 + Math.floor(Math.random() * 30);
  // OpenAI gpt-4o-mini pricing: $0.15/1M input, $0.60/1M output
  const costUsd =
    (inputTokens / 1_000_000) * 0.15 + (outputTokens / 1_000_000) * 0.60;

  if (!candidate) {
    return {
      score: 0.0,
      confidence: 0.95,
      sameBrand: false,
      sameDomain: false,
      reason: 'No suitable candidate record found in existing database.',
      inputTokens,
      outputTokens,
      durationMs: simulatedMs,
      costUsd,
      isMock: true,
    };
  }

  const mockOpenAIRequest = {
    model: 'openai/gpt-4o-mini',
    mode: 'generateObject',
    messages: [
      {
        role: 'system',
        content:
          'You are an enterprise CRM deduplication assistant. Compare incoming lead against candidate CRM account and return structured JSON.',
      },
      {
        role: 'user',
        content: `Inbound Lead:\n${JSON.stringify(inbound, null, 2)}\n\nCandidate Account:\n${JSON.stringify(candidate, null, 2)}`,
      },
    ],
    schema: {
      score: 'number (0.0 to 2.0)',
      confidence: 'number (0.0 to 1.0)',
      sameBrand: 'boolean',
      sameDomain: 'boolean',
      reason: 'string',
    },
  };

  const isDuplicate =
    inbound.scenarioType === 'exact_duplicate' ||
    inbound.scenarioType === 'fuzzy_duplicate';
  const isReview = inbound.scenarioType === 'subsidiary_review';
  const score = isDuplicate ? 1.9 : isReview ? 1.2 : 0.1;
  const confidence = isDuplicate ? 0.95 : isReview ? 0.85 : 0.94;
  const sameBrand = isDuplicate || isReview;
  const sameDomain = isDuplicate;
  const reason = isDuplicate
    ? `GPT-4o-mini parsed fields and concluded entity is duplicate of ${candidate.name}.`
    : isReview
    ? `GPT-4o-mini flagged entity as potential subsidiary of ${candidate.name}.`
    : `GPT-4o-mini verified different corporate entities despite name overlap.`;

  return {
    score,
    confidence,
    sameBrand,
    sameDomain,
    reason,
    inputTokens,
    outputTokens,
    durationMs: simulatedMs,
    costUsd,
    isMock: true,
    requestPayload: mockOpenAIRequest,
    responsePayload: {
      object: {
        score,
        confidence,
        sameBrand,
        sameDomain,
        reason,
      },
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
    },
  };
}
