export interface CrmAccount {
  id: string;
  name: string;
  domain: string;
  legalName?: string;
  industry: string;
  headquarters: {
    city: string;
    state?: string;
    country: string;
  };
  employees: number;
  annualRevenue?: string;
  aliases?: string[];
  status: 'active' | 'churned' | 'prospect';
  createdAt: string;
}

export interface InboundAccount {
  id: string;
  name: string;
  website: string;
  legalName?: string;
  city: string;
  country: string;
  industry?: string;
  scenarioType: 'exact_duplicate' | 'fuzzy_duplicate' | 'subsidiary_review' | 'false_positive_risk' | 'brand_new';
  expectedMatchId?: string; // id of existing account if duplicate
  expectedOutcome: 'merge' | 'review' | 'create';
  notes: string;
}

export type DedupeStrategy = 'deterministic_only' | 'hybrid_jev' | 'naive_jev' | 'openai';

export interface DedupeTraceStep {
  step: 'deterministic' | 'candidate_retrieval' | 'model_evaluation' | 'decision';
  title: string;
  durationMs: number;
  status: 'pass' | 'match' | 'nomatch' | 'evaluated' | 'skipped';
  details: Record<string, unknown>;
}

export interface DedupeResult {
  inboundId: string;
  inboundAccount: InboundAccount;
  strategy: DedupeStrategy;
  decision: 'merged' | 'review_queue' | 'created';
  matchedAccountId?: string;
  matchedAccountName?: string;
  candidateAccountIds?: string[];
  confidence?: number;
  score?: number;
  reason: string;
  latencyMs: number;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
  };
  costUsd: number;
  traces: DedupeTraceStep[];
  timestamp: string;
  // Accuracy & deep inspection metadata
  isMissedDuplicate?: boolean;
  isFalseMerge?: boolean;
  isMissedReview?: boolean;
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
}

export interface BatchSummary {
  totalProcessed: number;
  mergedCount: number;
  reviewCount: number;
  createdCount: number;
  totalLatencyMs: number;
  avgLatencyMs: number;
  totalCostUsd: number;
  totalTokens: number;
}
