import {
  CrmAccount,
  InboundAccount,
  DedupeStrategy,
  DedupeResult,
  DedupeTraceStep,
} from '@/types/crm';
import { deterministicCheck, retrieveCandidates } from './blocking';
import { normalizeDomain, normalizeCompanyName } from './normalizers';
import { evaluateWithJev } from './evaluators/jev-evaluator';
import { evaluateWithOpenAI } from './evaluators/openai-evaluator';

export async function processInboundAccount(
  inbound: InboundAccount,
  existingAccounts: CrmAccount[],
  strategy: DedupeStrategy,
  customApiKey?: string
): Promise<DedupeResult> {
  const startTime = performance.now();
  const traces: DedupeTraceStep[] = [];

  // =========================================================================
  // Strategy 0: Pure Deterministic Only (No AI Model Fallback)
  // =========================================================================
  if (strategy === 'deterministic_only') {
    const detStart = performance.now();
    const { matchedAccount: detMatch, reason: detReason } = deterministicCheck(
      inbound,
      existingAccounts
    );
    const detElapsed = Math.max(1, Math.round(performance.now() - detStart));

    const inbDomain = normalizeDomain(inbound.website);
    const inbName = normalizeCompanyName(inbound.name);

    const ruleTraceMatrix = {
      strategy: 'deterministic_only',
      description: 'Heuristic regex and exact normalized string comparisons only (0 AI tokens)',
      checks: [
        {
          rule: 'Exact Domain/Hostname Match',
          input: inbDomain.hostname,
          status: detMatch ? 'PASS' : 'FAIL',
        },
        {
          rule: 'Normalized Company Name Match',
          input: inbName,
          status: detMatch ? 'PASS' : 'FAIL',
        },
        {
          rule: 'Regional/Subsidiary Guardrail',
          country: inbound.country,
          status: 'Triggered (Deterministic rules cannot interpret corporate hierarchy)',
        },
      ],
      aiFallbackAvailable: false,
    };

    if (detMatch) {
      traces.push({
        step: 'deterministic',
        title: 'Deterministic Exact Match',
        durationMs: detElapsed,
        status: 'match',
        details: {
          rule: 'Exact Domain/Name Normalization',
          reason: detReason,
          matchedAccountId: detMatch.id,
          matchedAccountName: detMatch.name,
          cost: '$0.000000',
        },
      });

      const totalElapsed = Math.round(performance.now() - startTime);
      return {
        inboundId: inbound.id,
        inboundAccount: inbound,
        strategy,
        decision: 'merged',
        matchedAccountId: detMatch.id,
        matchedAccountName: detMatch.name,
        candidateAccountIds: [detMatch.id],
        confidence: 1.0,
        score: 2.0,
        reason: `Deterministic Match: ${detReason}`,
        latencyMs: totalElapsed,
        tokenUsage: { inputTokens: 0, outputTokens: 0 },
        costUsd: 0,
        traces,
        timestamp: new Date().toISOString(),
        requestPayload: { ruleMatrix: ruleTraceMatrix },
        responsePayload: { match: detMatch.id, status: 'EXACT_MATCH' },
      };
    }

    traces.push({
      step: 'deterministic',
      title: 'Deterministic Rule Evaluation (Failed)',
      durationMs: detElapsed,
      status: 'nomatch',
      details: {
        reason: 'No exact domain or name match found.',
        limitation:
          'Deterministic logic fails on fuzzy subdomains, name variations, typos, and corporate subsidiaries.',
      },
    });

    const isMissedDuplicate = inbound.expectedOutcome === 'merge';
    const isMissedReview = inbound.expectedOutcome === 'review';

    const totalElapsed = Math.round(performance.now() - startTime);
    return {
      inboundId: inbound.id,
      inboundAccount: inbound,
      strategy,
      decision: 'created',
      confidence: 0.5,
      score: 0.0,
      reason: isMissedDuplicate
        ? `MISSED DUPLICATE: Deterministic rules failed on variation "${inbound.name}". Created duplicate account.`
        : isMissedReview
        ? `MISSED REVIEW: Deterministic rules could not recognize regional subsidiary. Created duplicate account.`
        : 'No exact match found in database. Created as new account.',
      latencyMs: totalElapsed,
      tokenUsage: { inputTokens: 0, outputTokens: 0 },
      costUsd: 0,
      traces,
      timestamp: new Date().toISOString(),
      isMissedDuplicate,
      isMissedReview,
      requestPayload: { ruleMatrix: ruleTraceMatrix },
      responsePayload: { match: null, status: 'NO_EXACT_MATCH_CREATED' },
    };
  }

  // =========================================================================
  // Strategy 1: Hybrid Optimized (Deterministic Fast-Pass + Jev for Ambiguous)
  // =========================================================================
  if (strategy === 'hybrid_jev') {
    const detStart = performance.now();
    const { matchedAccount: detMatch, reason: detReason } = deterministicCheck(
      inbound,
      existingAccounts
    );
    const detElapsed = Math.max(1, Math.round(performance.now() - detStart));

    if (detMatch) {
      traces.push({
        step: 'deterministic',
        title: 'Deterministic Rule Match (Fast-Pass)',
        durationMs: detElapsed,
        status: 'match',
        details: {
          rule: 'Exact Domain/Name Normalization',
          reason: detReason,
          matchedAccountId: detMatch.id,
          matchedAccountName: detMatch.name,
          cost: '$0.000000',
        },
      });

      const totalElapsed = Math.round(performance.now() - startTime);
      return {
        inboundId: inbound.id,
        inboundAccount: inbound,
        strategy,
        decision: 'merged',
        matchedAccountId: detMatch.id,
        matchedAccountName: detMatch.name,
        confidence: 1.0,
        score: 2.0,
        reason: `Fast-Path Auto-Merge: ${detReason}`,
        latencyMs: totalElapsed,
        tokenUsage: { inputTokens: 0, outputTokens: 0 },
        costUsd: 0,
        traces,
        timestamp: new Date().toISOString(),
        requestPayload: {
          strategy: 'hybrid_jev',
          pathTaken: 'Deterministic Fast-Pass',
          checks: 'Domain Normalization & Exact Legal Name',
        },
        responsePayload: {
          ruleResult: 'MATCH_FOUND',
          matchedAccount: detMatch.name,
        },
      };
    }

    traces.push({
      step: 'deterministic',
      title: 'Deterministic Rule Check',
      durationMs: detElapsed,
      status: 'nomatch',
      details: {
        reason: 'No exact domain or name match found in fast pass.',
      },
    });

    // Stage 2: Candidate Blocking / Retrieval
    const blockStart = performance.now();
    const candidates = retrieveCandidates(inbound, existingAccounts, 3);
    const blockElapsed = Math.max(1, Math.round(performance.now() - blockStart));

    traces.push({
      step: 'candidate_retrieval',
      title: 'Candidate Blocking',
      durationMs: blockElapsed,
      status: candidates.length > 0 ? 'pass' : 'nomatch',
      details: {
        candidatesFound: candidates.length,
        topCandidate: candidates[0]?.account.name,
        reasons: candidates[0]?.matchReasons,
      },
    });

    // Stage 3: Jev System One Evaluation
    if (candidates.length === 0) {
      const totalElapsed = Math.round(performance.now() - startTime);
      return {
        inboundId: inbound.id,
        inboundAccount: inbound,
        strategy,
        decision: 'created',
        confidence: 0.99,
        score: 0.0,
        reason: 'No similar accounts identified in CRM database. Created new account.',
        latencyMs: totalElapsed,
        tokenUsage: { inputTokens: 0, outputTokens: 0 },
        costUsd: 0,
        traces,
        timestamp: new Date().toISOString(),
        isMissedDuplicate: inbound.expectedOutcome === 'merge',
        isMissedReview: inbound.expectedOutcome === 'review',
        requestPayload: {
          candidatesRetrieved: 0,
        },
        responsePayload: {
          action: 'CREATE_ACCOUNT',
        },
      };
    }

    const topCandidate = candidates[0].account;
    const evalResult = await evaluateWithJev(inbound, topCandidate, customApiKey);

    traces.push({
      step: 'model_evaluation',
      title: 'Jev System One Evaluation',
      durationMs: evalResult.durationMs,
      status: 'evaluated',
      details: {
        model: 'typesafe-ai/jev',
        score: evalResult.score,
        confidence: evalResult.confidence,
        sameBrand: evalResult.sameBrand,
        sameDomain: evalResult.sameDomain,
        inputTokens: evalResult.inputTokens,
        outputTokens: evalResult.outputTokens,
        cost: `$${evalResult.costUsd.toFixed(6)}`,
        isMock: evalResult.isMock,
      },
    });

    let decision: 'merged' | 'review_queue' | 'created';
    if (evalResult.score >= 1.6) {
      decision = 'merged';
    } else if (evalResult.score >= 0.8) {
      decision = 'review_queue';
    } else {
      decision = 'created';
    }

    const totalElapsed = Math.round(performance.now() - startTime);
    return {
      inboundId: inbound.id,
      inboundAccount: inbound,
      strategy,
      decision,
      matchedAccountId: decision !== 'created' ? topCandidate.id : undefined,
      matchedAccountName: decision !== 'created' ? topCandidate.name : undefined,
      candidateAccountIds: candidates.map((c) => c.account.id),
      confidence: evalResult.confidence,
      score: evalResult.score,
      reason: evalResult.reason,
      latencyMs: totalElapsed,
      tokenUsage: {
        inputTokens: evalResult.inputTokens,
        outputTokens: evalResult.outputTokens,
      },
      costUsd: evalResult.costUsd,
      traces,
      timestamp: new Date().toISOString(),
      isMissedDuplicate: inbound.expectedOutcome === 'merge' && decision === 'created',
      isMissedReview: inbound.expectedOutcome === 'review' && decision === 'created',
      isFalseMerge: inbound.expectedOutcome === 'create' && decision === 'merged',
      requestPayload: evalResult.requestPayload,
      responsePayload: evalResult.responsePayload,
    };
  }

  // =========================================================================
  // Strategy 2: Naive Jev (Skips deterministic rules, passes candidates to Jev)
  // =========================================================================
  if (strategy === 'naive_jev') {
    const blockStart = performance.now();
    const candidates = retrieveCandidates(inbound, existingAccounts, 3);
    const blockElapsed = Math.max(1, Math.round(performance.now() - blockStart));

    traces.push({
      step: 'candidate_retrieval',
      title: 'Candidate Retrieval (Direct AI Mode)',
      durationMs: blockElapsed,
      status: candidates.length > 0 ? 'pass' : 'nomatch',
      details: {
        candidatesFound: candidates.length,
        topCandidate: candidates[0]?.account.name,
      },
    });

    const candidate = candidates[0]?.account || null;
    const evalResult = await evaluateWithJev(inbound, candidate, customApiKey);

    traces.push({
      step: 'model_evaluation',
      title: 'Jev System One Evaluation',
      durationMs: evalResult.durationMs,
      status: 'evaluated',
      details: {
        model: 'typesafe-ai/jev',
        score: evalResult.score,
        confidence: evalResult.confidence,
        inputTokens: evalResult.inputTokens,
        outputTokens: evalResult.outputTokens,
        cost: `$${evalResult.costUsd.toFixed(6)}`,
        isMock: evalResult.isMock,
      },
    });

    let decision: 'merged' | 'review_queue' | 'created';
    if (evalResult.score >= 1.6 && candidate) {
      decision = 'merged';
    } else if (evalResult.score >= 0.8 && candidate) {
      decision = 'review_queue';
    } else {
      decision = 'created';
    }

    const totalElapsed = Math.round(performance.now() - startTime);
    return {
      inboundId: inbound.id,
      inboundAccount: inbound,
      strategy,
      decision,
      matchedAccountId: decision !== 'created' && candidate ? candidate.id : undefined,
      matchedAccountName: decision !== 'created' && candidate ? candidate.name : undefined,
      candidateAccountIds: candidates.map((c) => c.account.id),
      confidence: evalResult.confidence,
      score: evalResult.score,
      reason: evalResult.reason,
      latencyMs: totalElapsed,
      tokenUsage: {
        inputTokens: evalResult.inputTokens,
        outputTokens: evalResult.outputTokens,
      },
      costUsd: evalResult.costUsd,
      traces,
      timestamp: new Date().toISOString(),
      isMissedDuplicate: inbound.expectedOutcome === 'merge' && decision === 'created',
      isMissedReview: inbound.expectedOutcome === 'review' && decision === 'created',
      isFalseMerge: inbound.expectedOutcome === 'create' && decision === 'merged',
      requestPayload: evalResult.requestPayload,
      responsePayload: evalResult.responsePayload,
    };
  }

  // =========================================================================
  // Strategy 3: OpenAI Baseline (gpt-4o-mini structured JSON)
  // =========================================================================
  const blockStart = performance.now();
  const candidates = retrieveCandidates(inbound, existingAccounts, 3);
  const blockElapsed = Math.max(1, Math.round(performance.now() - blockStart));

  traces.push({
    step: 'candidate_retrieval',
    title: 'Candidate Retrieval (OpenAI Mode)',
    durationMs: blockElapsed,
    status: candidates.length > 0 ? 'pass' : 'nomatch',
    details: {
      candidatesFound: candidates.length,
      topCandidate: candidates[0]?.account.name,
    },
  });

  const candidate = candidates[0]?.account || null;
  const evalResult = await evaluateWithOpenAI(inbound, candidate, customApiKey);

  traces.push({
    step: 'model_evaluation',
    title: 'OpenAI GPT-4o-mini Evaluation',
    durationMs: evalResult.durationMs,
    status: 'evaluated',
    details: {
      model: 'openai/gpt-4o-mini',
      score: evalResult.score,
      confidence: evalResult.confidence,
      inputTokens: evalResult.inputTokens,
      outputTokens: evalResult.outputTokens,
      cost: `$${evalResult.costUsd.toFixed(6)}`,
      isMock: evalResult.isMock,
    },
  });

  let decision: 'merged' | 'review_queue' | 'created';
  if (evalResult.score >= 1.6 && candidate) {
    decision = 'merged';
  } else if (evalResult.score >= 0.8 && candidate) {
    decision = 'review_queue';
  } else {
    decision = 'created';
  }

  const totalElapsed = Math.round(performance.now() - startTime);
  return {
    inboundId: inbound.id,
    inboundAccount: inbound,
    strategy,
    decision,
    matchedAccountId: decision !== 'created' && candidate ? candidate.id : undefined,
    matchedAccountName: decision !== 'created' && candidate ? candidate.name : undefined,
    candidateAccountIds: candidates.map((c) => c.account.id),
    confidence: evalResult.confidence,
    score: evalResult.score,
    reason: evalResult.reason,
    latencyMs: totalElapsed,
    tokenUsage: {
      inputTokens: evalResult.inputTokens,
      outputTokens: evalResult.outputTokens,
    },
    costUsd: evalResult.costUsd,
    traces,
    timestamp: new Date().toISOString(),
    isMissedDuplicate: inbound.expectedOutcome === 'merge' && decision === 'created',
    isMissedReview: inbound.expectedOutcome === 'review' && decision === 'created',
    isFalseMerge: inbound.expectedOutcome === 'create' && decision === 'merged',
    requestPayload: evalResult.requestPayload,
    responsePayload: evalResult.responsePayload,
  };
}
