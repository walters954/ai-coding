'use client';

import React, { useState } from 'react';
import { InboundAccount, DedupeStrategy, DedupeResult } from '@/types/crm';
import {
  Inbox,
  Play,
  FastForward,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Clock,
  Sparkles,
  Zap,
  Cpu,
  Filter,
  Minimize2,
} from 'lucide-react';

interface InboundSimulatorPaneProps {
  inboundAccounts: InboundAccount[];
  results: Map<string, DedupeResult>;
  activeProcessingId: string | null;
  strategy: DedupeStrategy;
  onSelectStrategy: (strat: DedupeStrategy) => void;
  onProcessNext: () => void;
  onProcessBatch: (count: number) => void;
  onProcessAll: () => void;
  onResetQueue: () => void;
  isProcessing: boolean;
  selectedInboundId: string | null;
  onSelectInboundId: (id: string) => void;
  onCollapse?: () => void;
}

export function InboundSimulatorPane({
  inboundAccounts,
  results,
  activeProcessingId,
  strategy,
  onSelectStrategy,
  onProcessNext,
  onProcessBatch,
  onProcessAll,
  onResetQueue,
  isProcessing,
  selectedInboundId,
  onSelectInboundId,
  onCollapse,
}: InboundSimulatorPaneProps) {
  const [filterScenario, setFilterScenario] = useState<string>('all');

  const filteredInbound = inboundAccounts.filter((inb) => {
    if (filterScenario === 'all') return true;
    return inb.scenarioType === filterScenario;
  });

  const processedCount = results.size;
  const progressPercent = Math.round(
    (processedCount / inboundAccounts.length) * 100
  );

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-r border-zinc-800">
      {/* Pane Header & Strategy Selector */}
      <div className="p-4 border-b border-zinc-800 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-zinc-100">
              Inbound Account Stream
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono">
              {processedCount} / {inboundAccounts.length} processed
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onResetQueue}
              disabled={isProcessing || processedCount === 0}
              className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
            {onCollapse && (
              <button
                onClick={onCollapse}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors ml-1"
                title="Collapse Inbound Stream panel"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Strategy Selector Pills */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-medium text-zinc-400 flex items-center justify-between">
            <span>Deduplication Pipeline Strategy:</span>
            <span className="text-[10px] text-zinc-500">Compare latency & accuracy</span>
          </span>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 p-1 rounded-lg bg-zinc-900 border border-zinc-800">
            <button
              onClick={() => onSelectStrategy('deterministic_only')}
              disabled={isProcessing}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-md text-center transition-all ${
                strategy === 'deterministic_only'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-750 font-medium ring-1 ring-zinc-600'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center gap-1 text-[11px]">
                <span>📏</span>
                <span>Deterministic</span>
              </div>
              <span className="text-[9px] text-zinc-500 font-mono mt-0.5">
                Exact Rules Only
              </span>
            </button>

            <button
              onClick={() => onSelectStrategy('hybrid_jev')}
              disabled={isProcessing}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-md text-center transition-all ${
                strategy === 'hybrid_jev'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-indigo-500/40 font-medium ring-1 ring-indigo-500/50'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center gap-1 text-[11px]">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>Deterministic + Jev</span>
              </div>
              <span className="text-[9px] text-emerald-400 font-mono mt-0.5 font-medium">
                Fast & Accurate
              </span>
            </button>

            <button
              onClick={() => onSelectStrategy('naive_jev')}
              disabled={isProcessing}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-md text-center transition-all ${
                strategy === 'naive_jev'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-purple-500/40 font-medium ring-1 ring-purple-500/50'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center gap-1 text-[11px]">
                <Sparkles className="w-3 h-3 text-purple-400" />
                <span>Naive Jev</span>
              </div>
              <span className="text-[9px] text-zinc-400 font-mono mt-0.5">
                0 Output Tokens
              </span>
            </button>

            <button
              onClick={() => onSelectStrategy('openai')}
              disabled={isProcessing}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-md text-center transition-all ${
                strategy === 'openai'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-emerald-500/40 font-medium ring-1 ring-emerald-500/50'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center gap-1 text-[11px]">
                <Cpu className="w-3 h-3 text-emerald-400" />
                <span>OpenAI Baseline</span>
              </div>
              <span className="text-[9px] text-amber-400 font-mono mt-0.5">
                GPT-4o-mini
              </span>
            </button>
          </div>
        </div>

        {/* Execution Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onProcessNext}
            disabled={isProcessing || processedCount >= inboundAccounts.length}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-750 text-xs font-medium text-zinc-200 disabled:opacity-40 transition-colors"
          >
            <Play className="w-3 h-3 text-indigo-400 fill-indigo-400" />
            <span>Process 1</span>
          </button>

          <button
            onClick={() => onProcessBatch(10)}
            disabled={isProcessing || processedCount >= inboundAccounts.length}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-750 text-xs font-medium text-zinc-200 disabled:opacity-40 transition-colors"
          >
            <FastForward className="w-3 h-3 text-purple-400" />
            <span>Batch (10)</span>
          </button>

          <button
            onClick={onProcessAll}
            disabled={isProcessing || processedCount >= inboundAccounts.length}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-xs font-medium text-white disabled:opacity-40 transition-all shadow-md shadow-indigo-500/20"
          >
            <Sparkles className="w-3 h-3" />
            <span>Process All ({inboundAccounts.length - processedCount})</span>
          </button>
        </div>

        {/* Scenario Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-none">
          <Filter className="w-3 h-3 text-zinc-500 shrink-0" />
          {[
            { id: 'all', label: 'All (50)' },
            { id: 'exact_duplicate', label: 'Exact (10)' },
            { id: 'fuzzy_duplicate', label: 'Fuzzy (10)' },
            { id: 'subsidiary_review', label: 'Subsidiaries (10)' },
            { id: 'false_positive_risk', label: 'False Positives (10)' },
            { id: 'brand_new', label: 'New Entities (10)' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilterScenario(item.id)}
              className={`px-2 py-0.5 rounded-full whitespace-nowrap transition-colors ${
                filterScenario === item.id
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inbound List */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-900">
        {filteredInbound.map((inb) => {
          const res = results.get(inb.id);
          const isCurrentProcessing = activeProcessingId === inb.id;
          const isSelected = selectedInboundId === inb.id;

          let badgeColor = 'bg-zinc-800 text-zinc-400';
          let badgeText = 'Pending';
          let StatusIcon = Clock;

          if (isCurrentProcessing) {
            badgeColor = 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 animate-pulse';
            badgeText = 'Processing...';
            StatusIcon = Sparkles;
          } else if (res) {
            if (res.decision === 'merged') {
              badgeColor = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
              badgeText = `Merged (${res.latencyMs}ms)`;
              StatusIcon = CheckCircle2;
            } else if (res.decision === 'review_queue') {
              badgeColor = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
              badgeText = `Review Queue (${res.latencyMs}ms)`;
              StatusIcon = AlertCircle;
            } else {
              badgeColor = 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
              badgeText = `New Account (${res.latencyMs}ms)`;
              StatusIcon = PlusCircle;
            }
          }

          return (
            <div
              key={inb.id}
              onClick={() => onSelectInboundId(inb.id)}
              className={`p-3 text-left transition-colors cursor-pointer hover:bg-zinc-900/50 ${
                isSelected ? 'bg-indigo-950/20 border-l-2 border-indigo-500' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] text-zinc-500">
                      {inb.id}
                    </span>
                    <h3 className="text-xs font-semibold text-zinc-200 truncate">
                      {inb.name}
                    </h3>
                  </div>
                  <p className="text-[11px] font-mono text-zinc-400 truncate mt-0.5">
                    {inb.website}
                  </p>
                </div>

                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${badgeColor}`}
                  >
                    <StatusIcon className="w-2.5 h-2.5" />
                    <span>{badgeText}</span>
                  </span>

                  {res?.isMissedDuplicate && (
                    <span className="inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                      ⚠️ Missed Duplicate
                    </span>
                  )}
                  {res?.isMissedReview && (
                    <span className="inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      ⚠️ Missed Review
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between text-[10px]">
                <span className="text-zinc-500">
                  {inb.city}, {inb.country}
                </span>

                {res && res.matchedAccountName && (
                  <span className="font-mono text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                    → {res.matchedAccountName}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
