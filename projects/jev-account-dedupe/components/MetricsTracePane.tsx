'use client';

import React, { useState } from 'react';
import { DedupeResult, DedupeStrategy, InboundAccount } from '@/types/crm';
import {
  Activity,
  Zap,
  DollarSign,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  Sparkles,
  Info,
  BookOpen,
  Copy,
  Check,
  Cpu,
  Layers,
  ArrowRight,
  Coins,
  TrendingDown,
  BarChart3,
  PanelRightClose,
} from 'lucide-react';

interface MetricsTracePaneProps {
  results: Map<string, DedupeResult>;
  selectedInbound: InboundAccount | null;
  selectedResult: DedupeResult | null;
  currentStrategy: DedupeStrategy;
  onCollapse?: () => void;
}

export function MetricsTracePane({
  results,
  selectedInbound,
  selectedResult,
  currentStrategy,
  onCollapse,
}: MetricsTracePaneProps) {
  const [activeTab, setActiveTab] = useState<
    'primer' | 'trace' | 'cost' | 'request' | 'response' | 'raw'
  >('primer');
  const [primerModel, setPrimerModel] = useState<
    'jev' | 'openai' | 'deterministic'
  >('jev');
  const [copiedCode, setCopiedCode] = useState(false);

  // Compute aggregated stats
  const resultsArray = Array.from(results.values());
  const totalProcessed = resultsArray.length;

  const mergedCount = resultsArray.filter((r) => r.decision === 'merged').length;
  const reviewCount = resultsArray.filter(
    (r) => r.decision === 'review_queue'
  ).length;
  const createdCount = resultsArray.filter(
    (r) => r.decision === 'created'
  ).length;

  const missedDuplicatesCount = resultsArray.filter(
    (r) => r.isMissedDuplicate
  ).length;
  const missedReviewsCount = resultsArray.filter(
    (r) => r.isMissedReview
  ).length;
  const totalErrors = missedDuplicatesCount + missedReviewsCount;
  const accuracyRate =
    totalProcessed > 0
      ? Math.round(((totalProcessed - totalErrors) / totalProcessed) * 100)
      : 100;

  const totalLatency = resultsArray.reduce((acc, r) => acc + r.latencyMs, 0);
  const avgLatency =
    totalProcessed > 0 ? Math.round(totalLatency / totalProcessed) : 0;

  const totalCost = resultsArray.reduce((acc, r) => acc + r.costUsd, 0);

  // Comparative Model Pricing & Benchmarks
  const aiEvaluatedRecords = resultsArray.filter(
    (r) => (r.tokenUsage?.inputTokens ?? 0) > 0 || r.costUsd > 0
  ).length;
  const totalInputTokens = resultsArray.reduce(
    (acc, r) => acc + (r.tokenUsage?.inputTokens ?? 0),
    0
  );
  const evalCount =
    aiEvaluatedRecords > 0 ? aiEvaluatedRecords : Math.max(1, totalProcessed);
  const inputTokensEst =
    totalInputTokens > 0 ? totalInputTokens : evalCount * 450;

  // Actual Jev cost
  const jevTotalCost =
    totalCost > 0 ? totalCost : (evalCount * 450 * 0.042) / 1_000_000;

  // GPT-4o-mini ($0.15/1M in, $0.60/1M out, ~120 out tokens)
  const gpt4oMiniTotalCost =
    totalProcessed > 0
      ? (inputTokensEst * 0.15 + evalCount * 120 * 0.6) / 1_000_000
      : (evalCount * 450 * 0.15 + evalCount * 120 * 0.6) / 1_000_000;

  // Claude 3.5 Haiku ($0.80/1M in, $4.00/1M out, ~120 out tokens)
  const claudeHaikuTotalCost =
    totalProcessed > 0
      ? (inputTokensEst * 0.8 + evalCount * 120 * 4.0) / 1_000_000
      : (evalCount * 450 * 0.8 + evalCount * 120 * 4.0) / 1_000_000;

  // GPT-4o ($2.50/1M in, $10.00/1M out, ~120 out tokens)
  const gpt4oTotalCost =
    totalProcessed > 0
      ? (inputTokensEst * 2.5 + evalCount * 120 * 10.0) / 1_000_000
      : (evalCount * 450 * 2.5 + evalCount * 120 * 10.0) / 1_000_000;

  // Claude 3.5 Sonnet ($3.00/1M in, $15.00/1M out, ~120 out tokens)
  const claudeSonnetTotalCost =
    totalProcessed > 0
      ? (inputTokensEst * 3.0 + evalCount * 120 * 15.0) / 1_000_000
      : (evalCount * 450 * 3.0 + evalCount * 120 * 15.0) / 1_000_000;

  const costVsGpt4oMini = (
    gpt4oMiniTotalCost / Math.max(0.000001, jevTotalCost)
  ).toFixed(1);
  const costVsClaudeHaiku = (
    claudeHaikuTotalCost / Math.max(0.000001, jevTotalCost)
  ).toFixed(1);
  const costVsGpt4o = (
    gpt4oTotalCost / Math.max(0.000001, jevTotalCost)
  ).toFixed(1);
  const costVsClaudeSonnet = (
    claudeSonnetTotalCost / Math.max(0.000001, jevTotalCost)
  ).toFixed(1);

  const totalSavedVsGpt4oMini = Math.max(0, gpt4oMiniTotalCost - jevTotalCost);
  const totalSavedVsGpt4o = Math.max(0, gpt4oTotalCost - jevTotalCost);

  // Baseline cost if run with GPT-4o-mini
  const baselineCost = totalProcessed * 0.000108;
  const costSavingsMultiple =
    totalCost > 0 ? (baselineCost / totalCost).toFixed(1) : '15.0';

  // Educational Code Snippets
  const sampleInboundName = selectedInbound?.name || 'Claude AI by Anthropic';
  const sampleInboundDomain = selectedInbound?.website || 'claude.ai';
  const sampleCandidateName = selectedResult?.matchedAccountName || 'Anthropic PBC';
  const sampleCandidateDomain = 'anthropic.com';

  const jevSnippet = `// 1. Base Level: Import evaluation primitive from Vercel AI SDK
import { experimental_evaluate as evaluate } from 'ai';

// 2. INPUT: Provide State (the context to evaluate)
const state = {
  inbound_lead: {
    name: "${sampleInboundName}",
    domain: "${sampleInboundDomain}",
  },
  existing_account: {
    name: "${sampleCandidateName}",
    domain: "${sampleCandidateDomain}",
  }
};

// 3. INPUT: Provide Typed Questions (evaluated in parallel)
const questions = {
  // Score: Ordered rubric (0: Unrelated, 1: Review/Subsidiary, 2: Same Duplicate)
  duplicate_grade: {
    type: 'score',
    instructions: 'How do these two company records relate as CRM accounts?',
    criteria: [
      'Different and unrelated companies',
      'Related entity or corporate subsidiary needing review',
      'The same company entity (duplicate match)'
    ]
  },
  // Boolean: Calibrated probability (0.0 to 1.0)
  same_brand: {
    type: 'boolean',
    instructions: 'Do both records share the same commercial brand identity?'
  }
};

// 4. REQUEST: Send evaluation to Jev via Vercel AI Gateway
const result = await evaluate({
  model: 'typesafe-ai/jev', // $0.042 / 1M input tokens
  state,
  questions
});

// 5. OUTPUT: Direct typed numbers (ZERO output tokens generated!)
console.log(result.answers.duplicate_grade.score);       // e.g. 1.88
console.log(result.answers.duplicate_grade.confidence);  // e.g. 0.94
console.log(result.answers.same_brand.probability);      // e.g. 0.97`;

  const openaiSnippet = `// 1. Traditional Generative LLM with Structured Output
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// 2. REQUEST: Generates text token-by-token (~120 output tokens)
const result = await generateObject({
  model: openai('gpt-4o-mini'),
  schema: z.object({
    score: z.number().describe('0.0 (different) to 2.0 (same)'),
    confidence: z.number(),
    sameBrand: z.boolean(),
    reason: z.string(),
  }),
  prompt: \`Evaluate if "\${"${sampleInboundName}"}" duplicates "\${"${sampleCandidateName}"}".\`
});

// 3. OUTPUT: Decoded JSON object (High latency: ~850-1200ms)
console.log(result.object.score); // 1.9
console.log(result.usage.completionTokens); // ~110 output tokens billed`;

  const deterministicSnippet = `// 1. Pure Deterministic Logic (0 AI tokens, 0ms latency)
function checkDeterministic(inboundUrl, candidateDomain) {
  // Normalize hostname
  const inbHost = inboundUrl.replace(/^https?:\\/\\//, '').replace(/^www\\./, '').split('/')[0];
  const candHost = candidateDomain.replace(/^https?:\\/\\//, '').replace(/^www\\./, '');

  // Exact equality check
  if (inbHost === candHost) {
    return { isMatch: true, reason: 'Exact domain match' };
  }

  // LIMITATION: Fails on brand aliases, subdomains, typos, & subsidiaries!
  return { isMatch: false };
}`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Pane Header */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-zinc-100">
              Tracing & Educational Deep Dive
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              System One vs LLM
            </span>
            {onCollapse && (
              <button
                onClick={onCollapse}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                title="Collapse Inspector panel"
              >
                <PanelRightClose className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-[11px] font-medium">Avg Latency</span>
              <Gauge className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono text-zinc-100">
                {avgLatency}
              </span>
              <span className="text-xs text-zinc-500 font-mono">ms</span>
            </div>
            <div className="mt-1 text-[10px] text-emerald-400">
              {currentStrategy === 'deterministic_only'
                ? '0ms local rules'
                : avgLatency > 0 && avgLatency < 200
                ? '⚡ 10x faster than LLM baseline'
                : 'Autoregressive generation'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-[11px] font-medium">Total Cost</span>
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold font-mono text-emerald-400">
                ${totalCost.toFixed(6)}
              </span>
            </div>
            <div className="mt-1 text-[10px] text-zinc-400">
              {currentStrategy === 'deterministic_only'
                ? '$0 (but misses duplicates)'
                : totalProcessed > 0
                ? `${costSavingsMultiple}x cheaper than GPT-4o-mini`
                : '$0.042 / 1M input tokens'}
            </div>
          </div>
        </div>

        {/* Total Cost Comparison Card: Jev vs Other Models */}
        <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
              <Coins className="w-3.5 h-3.5 text-emerald-400" />
              <span>Total Cost vs Other Models</span>
            </div>
            <button
              onClick={() => setActiveTab('cost')}
              className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors"
            >
              {costVsGpt4oMini}x Cheaper · Breakdown →
            </button>
          </div>

          <div className="space-y-1.5 text-xs font-mono">
            {/* Jev */}
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-indigo-950/40 border border-indigo-500/30">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                <span className="text-indigo-200 font-semibold text-[11px]">Jev System One</span>
              </div>
              <div className="text-right flex items-baseline gap-1.5">
                <span className="text-emerald-400 font-bold">${jevTotalCost.toFixed(6)}</span>
                <span className="text-[10px] text-zinc-400">(0 out tokens)</span>
              </div>
            </div>

            {/* GPT-4o-mini */}
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-zinc-300 text-[11px]">GPT-4o-mini</span>
              </div>
              <div className="text-right flex items-baseline gap-1.5">
                <span className="text-zinc-300">${gpt4oMiniTotalCost.toFixed(6)}</span>
                <span className="text-[10px] text-amber-400 font-semibold">({costVsGpt4oMini}x)</span>
              </div>
            </div>

            {/* Claude 3.5 Haiku */}
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-400" />
                <span className="text-zinc-300 text-[11px]">Claude 3.5 Haiku</span>
              </div>
              <div className="text-right flex items-baseline gap-1.5">
                <span className="text-zinc-300">${claudeHaikuTotalCost.toFixed(6)}</span>
                <span className="text-[10px] text-amber-400 font-semibold">({costVsClaudeHaiku}x)</span>
              </div>
            </div>

            {/* GPT-4o */}
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-zinc-300 text-[11px]">GPT-4o</span>
              </div>
              <div className="text-right flex items-baseline gap-1.5">
                <span className="text-zinc-300">${gpt4oTotalCost.toFixed(6)}</span>
                <span className="text-[10px] text-red-400 font-semibold">({costVsGpt4o}x)</span>
              </div>
            </div>

            {/* Claude 3.5 Sonnet */}
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                <span className="text-zinc-300 text-[11px]">Claude 3.5 Sonnet</span>
              </div>
              <div className="text-right flex items-baseline gap-1.5">
                <span className="text-zinc-300">${claudeSonnetTotalCost.toFixed(6)}</span>
                <span className="text-[10px] text-red-400 font-semibold">({costVsClaudeSonnet}x)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Data Quality / Missed Duplicate Warning (if any) */}
        {totalProcessed > 0 && totalErrors > 0 && (
          <div className="p-3 rounded-xl bg-red-950/20 border border-red-500/30 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Data Quality Warning ({accuracyRate}% Accuracy)
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-300">
                {totalErrors} Errors
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-snug">
              {missedDuplicatesCount > 0 && (
                <span className="block text-red-300">
                  • <strong>{missedDuplicatesCount} Missed Duplicates:</strong> Failed exact rules and created duplicates.
                </span>
              )}
              {missedReviewsCount > 0 && (
                <span className="block text-amber-300">
                  • <strong>{missedReviewsCount} Missed Reviews:</strong> Regional subsidiaries incorrectly duplicated.
                </span>
              )}
            </p>
          </div>
        )}

        {/* Outcome Breakdown Bar */}
        <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-300">
            <span className="font-medium">Decisions Breakdown</span>
            <span className="text-zinc-500 font-mono text-[11px]">
              {totalProcessed} records
            </span>
          </div>

          <div className="h-2 rounded-full bg-zinc-800 flex overflow-hidden">
            {totalProcessed > 0 ? (
              <>
                <div
                  style={{
                    width: `${(mergedCount / totalProcessed) * 100}%`,
                  }}
                  className="bg-emerald-500 transition-all duration-300"
                  title={`Merged: ${mergedCount}`}
                />
                <div
                  style={{
                    width: `${(reviewCount / totalProcessed) * 100}%`,
                  }}
                  className="bg-amber-500 transition-all duration-300"
                  title={`Review Queue: ${reviewCount}`}
                />
                <div
                  style={{
                    width: `${(createdCount / totalProcessed) * 100}%`,
                  }}
                  className="bg-blue-500 transition-all duration-300"
                  title={`New Accounts: ${createdCount}`}
                />
              </>
            ) : (
              <div className="w-full bg-zinc-800" />
            )}
          </div>

          <div className="grid grid-cols-3 gap-1 pt-1 text-[11px]">
            <div className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              <span>{mergedCount} Merged</span>
            </div>
            <div className="flex items-center gap-1 text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              <span>{reviewCount} Review</span>
            </div>
            <div className="flex items-center gap-1 text-blue-400">
              <UserPlus className="w-3 h-3" />
              <span>{createdCount} Created</span>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span>Inspector & Educational Views</span>
            </div>

            <div className="flex items-center rounded-lg bg-zinc-900 border border-zinc-800 p-0.5 text-[11px]">
              <button
                onClick={() => setActiveTab('primer')}
                className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                  activeTab === 'primer'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>🎓 How Jev Works</span>
              </button>
              <button
                onClick={() => setActiveTab('cost')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  activeTab === 'cost'
                    ? 'bg-zinc-800 text-zinc-100 font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                💰 Cost vs Models
              </button>
              <button
                onClick={() => setActiveTab('trace')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  activeTab === 'trace'
                    ? 'bg-zinc-800 text-zinc-100 font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Live Trace
              </button>
              <button
                onClick={() => setActiveTab('request')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  activeTab === 'request'
                    ? 'bg-zinc-800 text-zinc-100 font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                API Request
              </button>
              <button
                onClick={() => setActiveTab('response')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  activeTab === 'response'
                    ? 'bg-zinc-800 text-zinc-100 font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Response Logits
              </button>
              <button
                onClick={() => setActiveTab('raw')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  activeTab === 'raw'
                    ? 'bg-zinc-800 text-zinc-100 font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                JSON
              </button>
            </div>
          </div>

          {/* TAB: EDUCATIONAL PRIMER */}
          {activeTab === 'primer' && (
            <div className="space-y-3">
              {/* Educational Model Selector */}
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
                <button
                  onClick={() => setPrimerModel('jev')}
                  className={`py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                    primerModel === 'jev'
                      ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Jev System One</span>
                </button>

                <button
                  onClick={() => setPrimerModel('openai')}
                  className={`py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                    primerModel === 'openai'
                      ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  <span>OpenAI LLM</span>
                </button>

                <button
                  onClick={() => setPrimerModel('deterministic')}
                  className={`py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                    primerModel === 'deterministic'
                      ? 'bg-zinc-800 text-zinc-200 border border-zinc-700 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Info className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Deterministic</span>
                </button>
              </div>

              {/* Jev Explanation Cards */}
              {primerModel === 'jev' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-500/30 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        The Core Concept: System One Evaluation
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-200">
                        Zero Output Tokens
                      </span>
                    </div>
                    <p className="text-zinc-300 leading-relaxed text-[11px]">
                      LLMs produce text for humans. When code needs a judgment, converting unstructured text to JSON is slow and error-prone. <strong>Jev is an evaluation model:</strong> it evaluates shared <code className="text-indigo-300 font-mono">state</code> against typed <code className="text-indigo-300 font-mono">questions</code> in parallel and directly outputs calibrated probabilities, rubric scores, and confidence.
                    </p>

                    <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[10px]">
                      <div className="p-2 rounded bg-zinc-900/90 border border-zinc-800">
                        <div className="text-zinc-400 font-bold">1. STATE</div>
                        <div className="text-zinc-300 mt-0.5">The pair being compared (Lead + Account)</div>
                      </div>
                      <div className="p-2 rounded bg-zinc-900/90 border border-zinc-800">
                        <div className="text-zinc-400 font-bold">2. QUESTIONS</div>
                        <div className="text-zinc-300 mt-0.5">Typed Score rubric & Boolean questions</div>
                      </div>
                      <div className="p-2 rounded bg-zinc-900/90 border border-zinc-800">
                        <div className="text-zinc-400 font-bold">3. OUTPUT</div>
                        <div className="text-emerald-400 mt-0.5">Direct numeric values (no text parsing!)</div>
                      </div>
                    </div>
                  </div>

                  {/* Code Snippet Box */}
                  <div className="rounded-xl bg-zinc-900/90 border border-zinc-800 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-zinc-950/60 border-b border-zinc-800">
                      <span className="text-[11px] font-mono text-zinc-300 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-indigo-400" />
                        Jev TypeScript Implementation (AI SDK 7+)
                      </span>
                      <button
                        onClick={() => copyToClipboard(jevSnippet)}
                        className="text-[10px] flex items-center gap-1 text-zinc-400 hover:text-zinc-200 font-mono"
                      >
                        {copiedCode ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Code</span>
                          </>
                        )}
                      </button>
                    </div>

                    <pre className="p-3 text-[10px] font-mono text-zinc-300 overflow-x-auto leading-relaxed max-h-72">
                      {jevSnippet}
                    </pre>
                  </div>
                </div>
              )}

              {/* OpenAI Explanation Cards */}
              {primerModel === 'openai' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                        How OpenAI Does It: Generative Chat Completion
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        ~120 Output Tokens
                      </span>
                    </div>
                    <p className="text-zinc-300 leading-relaxed text-[11px]">
                      OpenAI (GPT-4o-mini) treats deduplication as a text generation task. It must generate tokens sequentially (e.g. JSON strings), requiring <strong>~850ms–1,300ms</strong> and charging both input ($0.15/M) and output ($0.60/M) tokens.
                    </p>
                  </div>

                  <div className="rounded-xl bg-zinc-900/90 border border-zinc-800 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-zinc-950/60 border-b border-zinc-800">
                      <span className="text-[11px] font-mono text-zinc-300">
                        OpenAI Baseline Implementation
                      </span>
                      <button
                        onClick={() => copyToClipboard(openaiSnippet)}
                        className="text-[10px] flex items-center gap-1 text-zinc-400 hover:text-zinc-200 font-mono"
                      >
                        {copiedCode ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="p-3 text-[10px] font-mono text-zinc-300 overflow-x-auto leading-relaxed max-h-72">
                      {openaiSnippet}
                    </pre>
                  </div>
                </div>
              )}

              {/* Deterministic Explanation Cards */}
              {primerModel === 'deterministic' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-zinc-400" />
                        How Deterministic Rules Work
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                        0 Tokens, ~0ms
                      </span>
                    </div>
                    <p className="text-zinc-300 leading-relaxed text-[11px]">
                      Deterministic code runs regexes to strip protocols and legal suffixes. It works perfectly for exact URLs (`https://stripe.com` $\to$ `stripe.com`), but fails completely on brand aliases (`Claude AI` vs `Anthropic PBC`), regional subsidiaries, and typos.
                    </p>
                  </div>

                  <div className="rounded-xl bg-zinc-900/90 border border-zinc-800 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-zinc-950/60 border-b border-zinc-800">
                      <span className="text-[11px] font-mono text-zinc-300">
                        Deterministic Normalization
                      </span>
                      <button
                        onClick={() => copyToClipboard(deterministicSnippet)}
                        className="text-[10px] flex items-center gap-1 text-zinc-400 hover:text-zinc-200 font-mono"
                      >
                        {copiedCode ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="p-3 text-[10px] font-mono text-zinc-300 overflow-x-auto leading-relaxed max-h-72">
                      {deterministicSnippet}
                    </pre>
                  </div>
                </div>
              )}

              {/* Side-by-Side Comparison Matrix */}
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                <span className="text-[11px] font-semibold text-zinc-200">
                  Model & Method Comparison Matrix
                </span>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[10px] font-mono">
                    <thead>
                      <tr className="text-zinc-500 border-b border-zinc-800">
                        <th className="pb-1.5 font-normal">Method</th>
                        <th className="pb-1.5 font-normal">Output Tokens</th>
                        <th className="pb-1.5 font-normal">Avg Latency</th>
                        <th className="pb-1.5 font-normal">Cost / 1k Records</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                      <tr>
                        <td className="py-1.5 text-indigo-400 font-semibold">Jev System One</td>
                        <td className="py-1.5 text-emerald-400">0 tokens</td>
                        <td className="py-1.5">~75 ms</td>
                        <td className="py-1.5 text-emerald-400 font-semibold">~$0.005</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-emerald-400">GPT-4o-mini</td>
                        <td className="py-1.5 text-amber-400">~120 tokens</td>
                        <td className="py-1.5">~950 ms</td>
                        <td className="py-1.5 text-amber-400">~$0.110 (22x)</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-zinc-400">Deterministic</td>
                        <td className="py-1.5">0 tokens</td>
                        <td className="py-1.5">&lt;1 ms</td>
                        <td className="py-1.5">$0.00 (misses typos)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: COST BENCHMARK */}
          {activeTab === 'cost' && (
            <div className="space-y-3">
              {/* Summary Banner */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/40 via-indigo-950/30 to-purple-950/30 border border-emerald-500/30 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                    <TrendingDown className="w-4 h-4 text-emerald-400" />
                    Why Jev Is Dramatically Cheaper
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                    0 Output Tokens
                  </span>
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  Traditional LLMs (GPT-4o, Claude) generate decisions as freeform text or JSON schemas character-by-character (~120 tokens/call). Output tokens cost <strong>4x–5x more</strong> than input tokens and force high serial latency. Jev is a purpose-built discriminative model that evaluates direct logits and scores—charging <strong>$0.042/1M input tokens and $0 for output</strong>.
                </p>
              </div>

              {/* Live Run Comparison */}
              <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                    Total Cost for Current Run ({totalProcessed} Records)
                  </span>
                  <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                    Saved ${totalSavedVsGpt4oMini.toFixed(6)} vs 4o-mini
                  </span>
                </div>

                <div className="space-y-2">
                  {/* Jev */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-indigo-300 font-medium">Jev System One (Actual)</span>
                      <span className="text-emerald-400 font-bold">${jevTotalCost.toFixed(6)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div className="h-full bg-indigo-500 w-[5%]" />
                    </div>
                  </div>

                  {/* GPT-4o-mini */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-zinc-300">OpenAI GPT-4o-mini</span>
                      <span className="text-zinc-300 font-medium">${gpt4oMiniTotalCost.toFixed(6)} <span className="text-amber-400 text-[10px]">({costVsGpt4oMini}x)</span></span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div className="h-full bg-emerald-500/80 w-[20%]" />
                    </div>
                  </div>

                  {/* Claude 3.5 Haiku */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-zinc-300">Claude 3.5 Haiku</span>
                      <span className="text-zinc-300 font-medium">${claudeHaikuTotalCost.toFixed(6)} <span className="text-amber-400 text-[10px]">({costVsClaudeHaiku}x)</span></span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div className="h-full bg-orange-500/80 w-[45%]" />
                    </div>
                  </div>

                  {/* GPT-4o */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-zinc-300">OpenAI GPT-4o</span>
                      <span className="text-zinc-300 font-medium">${gpt4oTotalCost.toFixed(6)} <span className="text-red-400 text-[10px]">({costVsGpt4o}x)</span></span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div className="h-full bg-blue-500/80 w-[80%]" />
                    </div>
                  </div>

                  {/* Claude 3.5 Sonnet */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-zinc-300">Claude 3.5 Sonnet</span>
                      <span className="text-zinc-300 font-medium">${claudeSonnetTotalCost.toFixed(6)} <span className="text-red-400 text-[10px]">({costVsClaudeSonnet}x)</span></span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div className="h-full bg-purple-500/80 w-[100%]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Volume Scale Projections */}
              <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2.5">
                <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
                  Enterprise Scale Projections (Monthly Dedupe Volume)
                </span>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[10px] font-mono">
                    <thead>
                      <tr className="text-zinc-500 border-b border-zinc-800">
                        <th className="pb-1.5 font-normal">Model</th>
                        <th className="pb-1.5 font-normal">Pricing / 1M</th>
                        <th className="pb-1.5 font-normal">10k Records</th>
                        <th className="pb-1.5 font-normal">100k Records</th>
                        <th className="pb-1.5 font-normal">1M Records</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                      <tr className="bg-indigo-950/20">
                        <td className="py-2 text-indigo-300 font-semibold">Jev System One</td>
                        <td className="py-2 text-emerald-400">$0.042 (0 out)</td>
                        <td className="py-2 text-emerald-400 font-bold">$0.19</td>
                        <td className="py-2 text-emerald-400 font-bold">$1.89</td>
                        <td className="py-2 text-emerald-400 font-bold">$18.90</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-zinc-300">GPT-4o-mini</td>
                        <td className="py-2 text-zinc-400">$0.15 in / $0.60 out</td>
                        <td className="py-2 text-zinc-300">$1.25 (6.6x)</td>
                        <td className="py-2 text-zinc-300">$12.50 (6.6x)</td>
                        <td className="py-2 text-zinc-300">$125.00</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-zinc-300">Claude 3.5 Haiku</td>
                        <td className="py-2 text-zinc-400">$0.80 in / $4.00 out</td>
                        <td className="py-2 text-zinc-300">$7.60 (40x)</td>
                        <td className="py-2 text-zinc-300">$76.00 (40x)</td>
                        <td className="py-2 text-zinc-300">$760.00</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-zinc-300">GPT-4o</td>
                        <td className="py-2 text-zinc-400">$2.50 in / $10.00 out</td>
                        <td className="py-2 text-zinc-300">$20.75 (109x)</td>
                        <td className="py-2 text-zinc-300">$207.50 (109x)</td>
                        <td className="py-2 text-zinc-300">$2,075.00</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-zinc-300">Claude 3.5 Sonnet</td>
                        <td className="py-2 text-zinc-400">$3.00 in / $15.00 out</td>
                        <td className="py-2 text-zinc-300">$28.50 (150x)</td>
                        <td className="py-2 text-zinc-300">$285.00 (150x)</td>
                        <td className="py-2 text-zinc-300">$2,850.00</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: LIVE TRACE */}
          {activeTab === 'trace' && (
            <div className="space-y-2">
              {!selectedResult ? (
                <div className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-center text-zinc-500 text-xs">
                  Select an account from the center queue to view its step-by-step trace timeline.
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-zinc-400">
                        Target: {selectedResult.inboundAccount.name}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                        {selectedResult.latencyMs} ms
                      </span>
                    </div>
                    <div className="text-xs text-zinc-200 font-medium">
                      {selectedResult.reason}
                    </div>
                  </div>

                  <div className="space-y-2 relative before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-zinc-800">
                    {selectedResult.traces.map((trace, idx) => {
                      let stepColor = 'bg-zinc-800 text-zinc-300';
                      if (trace.status === 'match') {
                        stepColor = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
                      } else if (trace.status === 'evaluated') {
                        stepColor = 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
                      }

                      return (
                        <div key={idx} className="relative pl-7 text-xs space-y-1 group">
                          <div
                            className={`absolute left-1.5 top-1 w-3.5 h-3.5 rounded-full flex items-center justify-center -translate-x-1/2 text-[9px] font-bold ${stepColor}`}
                          >
                            {idx + 1}
                          </div>

                          <div className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800/80 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-zinc-200">
                                {trace.title}
                              </span>
                              <span className="font-mono text-[10px] text-zinc-500">
                                {trace.durationMs}ms
                              </span>
                            </div>

                            <div className="text-[11px] text-zinc-400 font-mono space-y-0.5">
                              {Object.entries(trace.details).map(([key, val]) => (
                                <div key={key} className="flex gap-2">
                                  <span className="text-zinc-500 shrink-0">
                                    {key}:
                                  </span>
                                  <span className="text-zinc-300 break-all">
                                    {typeof val === 'object'
                                      ? JSON.stringify(val)
                                      : String(val)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: API REQUEST PAYLOAD */}
          {activeTab === 'request' && (
            <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span className="font-mono text-purple-400">
                  {selectedResult?.strategy === 'deterministic_only'
                    ? 'Deterministic Rule Matrix Evaluated'
                    : selectedResult?.strategy === 'openai'
                    ? 'OpenAI Prompt & JSON Schema'
                    : 'Jev State & Question Payload'}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {selectedResult?.tokenUsage.inputTokens || 0} input tokens
                </span>
              </div>

              <pre className="text-[10px] font-mono text-zinc-300 overflow-x-auto p-2.5 rounded bg-zinc-950 border border-zinc-850 leading-relaxed max-h-80">
                {JSON.stringify(
                  selectedResult?.requestPayload || {
                    note: 'Select an account from center stream to inspect payload',
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          )}

          {/* TAB: RESPONSE DATA */}
          {activeTab === 'response' && (
            <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span className="font-mono text-emerald-400">
                  Model Answers & Confidence Logits
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {selectedResult?.tokenUsage.outputTokens || 0} output tokens
                </span>
              </div>

              <pre className="text-[10px] font-mono text-zinc-300 overflow-x-auto p-2.5 rounded bg-zinc-950 border border-zinc-850 leading-relaxed max-h-80">
                {JSON.stringify(
                  selectedResult?.responsePayload || {
                    note: 'Select an account from center stream to inspect response',
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          )}

          {/* TAB: RAW JSON */}
          {activeTab === 'raw' && (
            <pre className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-300 overflow-x-auto leading-relaxed max-h-96">
              {JSON.stringify(selectedResult || { note: 'Select a record to view raw JSON' }, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
