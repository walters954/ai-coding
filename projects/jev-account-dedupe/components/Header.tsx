'use client';

import React from 'react';
import {
  Sparkles,
  Zap,
  ShieldCheck,
  Key,
  RefreshCw,
  Database,
  Inbox,
  Activity,
} from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
  onReset: () => void;
  isProcessing: boolean;
  hasCustomKey: boolean;
  envKeyProvider?: string | null;
  leftCollapsed: boolean;
  centerCollapsed: boolean;
  rightCollapsed: boolean;
  onToggleLeft: () => void;
  onToggleCenter: () => void;
  onToggleRight: () => void;
}

export function Header({
  onOpenSettings,
  onReset,
  isProcessing,
  hasCustomKey,
  envKeyProvider,
  leftCollapsed,
  centerCollapsed,
  rightCollapsed,
  onToggleLeft,
  onToggleCenter,
  onToggleRight,
}: HeaderProps) {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-30 px-6 py-3.5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-0.5 shadow-lg shadow-purple-500/20">
            <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-zinc-100 tracking-tight">
                Jev CRM Account Deduplication
              </h1>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                System One
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              TypeSafe AI decision model on Vercel AI Gateway · Ultra-fast, deterministic & calibrated evaluation
            </p>
          </div>
        </div>

        {/* Value metrics badges */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-zinc-400">Cost:</span>
            <span className="font-mono font-medium text-emerald-400">$0.042 / 1M</span>
            <span className="text-zinc-500 text-[10px]">tokens</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-zinc-400">Output Tokens:</span>
            <span className="font-mono font-medium text-indigo-300">0 tokens</span>
          </div>

          {/* Panel Visibility & Focus Controls */}
          <div className="flex items-center bg-zinc-900/90 border border-zinc-800 rounded-lg p-0.5 text-xs">
            <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider px-2 hidden 2xl:inline">
              Panels:
            </span>
            <button
              onClick={onToggleLeft}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all ${
                !leftCollapsed
                  ? 'bg-zinc-800 text-purple-300 font-medium shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title={leftCollapsed ? 'Expand CRM Accounts (Left)' : 'Collapse CRM Accounts (Left)'}
            >
              <Database className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[11px] font-medium">CRM</span>
            </button>
            <button
              onClick={onToggleCenter}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all ${
                !centerCollapsed
                  ? 'bg-zinc-800 text-indigo-300 font-medium shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title={centerCollapsed ? 'Expand Inbound Queue (Center)' : 'Collapse Inbound Queue (Center)'}
            >
              <Inbox className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[11px] font-medium">Queue</span>
            </button>
            <button
              onClick={onToggleRight}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all ${
                !rightCollapsed
                  ? 'bg-zinc-800 text-emerald-300 font-medium shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title={rightCollapsed ? 'Expand Inspector & Metrics (Right)' : 'Collapse Inspector & Metrics (Right)'}
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-medium">Inspector</span>
            </button>
          </div>

          <button
            onClick={onOpenSettings}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
              hasCustomKey || envKeyProvider
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/50'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-750 text-zinc-300'
            }`}
            title="Configure API Key"
          >
            <Key className="w-3.5 h-3.5" />
            <span>
              {hasCustomKey
                ? 'Custom Key'
                : envKeyProvider
                  ? `${envKeyProvider} (.env)`
                  : 'Mock Engine'}
            </span>
          </button>

          <button
            onClick={onReset}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 transition-colors disabled:opacity-50"
            title="Reset All"
          >
            <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </header>
  );
}
