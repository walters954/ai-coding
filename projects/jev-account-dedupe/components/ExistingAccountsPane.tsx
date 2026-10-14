'use client';

import React, { useState } from 'react';
import { CrmAccount } from '@/types/crm';
import {
  Database,
  Search,
  Code,
  Table as TableIcon,
  Globe,
  Radio,
  CheckCircle2,
  Sparkles,
  PanelLeftClose,
} from 'lucide-react';

interface ExistingAccountsPaneProps {
  accounts: CrmAccount[];
  highlightedAccountId?: string;
  candidateAccountIds?: string[];
  scanningAccountId?: string | null;
  activeComparingInboundName?: string | null;
  onCollapse?: () => void;
}

export function ExistingAccountsPane({
  accounts,
  highlightedAccountId,
  candidateAccountIds = [],
  scanningAccountId,
  activeComparingInboundName,
  onCollapse,
}: ExistingAccountsPaneProps) {
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<CrmAccount | null>(null);

  const filteredAccounts = accounts.filter(
    (acc) =>
      acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.industry.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.aliases?.some((a) => a.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-r border-zinc-800">
      {/* Pane Header */}
      <div className="p-3.5 border-b border-zinc-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-purple-400" />
            <h2 className="text-xs font-semibold text-zinc-100">
              CRM Accounts
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono">
              {filteredAccounts.length} / {accounts.length}
            </span>
          </div>

          <div className="flex items-center rounded-lg bg-zinc-900 border border-zinc-800 p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-zinc-800 text-zinc-100 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <TableIcon className="w-3 h-3" />
              <span>List</span>
            </button>
            <button
              onClick={() => setViewMode('json')}
              className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded-md transition-colors ${
                viewMode === 'json'
                  ? 'bg-zinc-800 text-zinc-100 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Code className="w-3 h-3" />
              <span>JSON</span>
            </button>
            {onCollapse && (
              <button
                onClick={onCollapse}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 transition-colors ml-1"
                title="Collapse CRM Accounts panel"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search accounts or domains..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-500/50"
          />
        </div>
      </div>

      {/* Real-Time Live Scan Radar Banner */}
      {activeComparingInboundName && (
        <div className="px-3 py-2 bg-gradient-to-r from-indigo-950/60 to-purple-950/40 border-b border-indigo-500/30 flex items-center justify-between text-xs text-indigo-300 transition-all animate-fadeIn">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <span className="font-mono text-[10px] text-zinc-300 truncate">
              Comparing: <strong className="text-indigo-300 font-semibold">{activeComparingInboundName}</strong>
            </span>
          </div>
          <span className="text-[10px] font-mono text-indigo-400 animate-pulse shrink-0">
            Searching...
          </span>
        </div>
      )}

      {/* Pane Content */}
      <div className="flex-1 overflow-y-auto">
        {viewMode === 'json' ? (
          <div className="p-4">
            <pre className="text-[10px] font-mono text-zinc-300 bg-zinc-900/60 p-3 rounded-lg border border-zinc-800/80 overflow-x-auto leading-relaxed">
              {JSON.stringify(filteredAccounts, null, 2)}
            </pre>
          </div>
        ) : (
          <div className="divide-y divide-zinc-900">
            {filteredAccounts.map((account) => {
              const isMatched = highlightedAccountId === account.id;
              const isCandidate = candidateAccountIds?.includes(account.id);
              const isCurrentlyScanning = scanningAccountId === account.id;

              let cardBg = 'hover:bg-zinc-900/50';
              let borderStyle = '';

              if (isCurrentlyScanning) {
                cardBg = 'bg-indigo-500/20 shadow-md shadow-indigo-500/20';
                borderStyle = 'border-l-4 border-indigo-400 ring-1 ring-indigo-500/50 animate-pulse';
              } else if (isMatched) {
                cardBg = 'bg-emerald-950/40 shadow-sm shadow-emerald-500/10';
                borderStyle = 'border-l-4 border-emerald-500 ring-1 ring-emerald-500/30';
              } else if (isCandidate) {
                cardBg = 'bg-amber-950/20';
                borderStyle = 'border-l-2 border-amber-500/60';
              }

              return (
                <div
                  key={account.id}
                  onClick={() => setSelectedAccount(account)}
                  className={`p-2.5 text-left transition-all duration-150 cursor-pointer ${cardBg} ${borderStyle}`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[9px] text-zinc-500">
                          {account.id}
                        </span>
                        <h3 className="text-xs font-semibold text-zinc-200 truncate">
                          {account.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 text-[10px] text-zinc-400">
                        <Globe className="w-2.5 h-2.5 text-zinc-500" />
                        <span className="text-indigo-400 font-mono truncate">
                          {account.domain}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {isCurrentlyScanning ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-200 border border-indigo-400/50">
                          <Radio className="w-2.5 h-2.5 animate-spin" />
                          <span>Checking</span>
                        </span>
                      ) : isMatched ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                          <span>Match</span>
                        </span>
                      ) : isCandidate ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                          <span>Candidate</span>
                        </span>
                      ) : (
                        <span className="inline-block text-[9px] font-medium px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-500 border border-zinc-800">
                          {account.headquarters.country}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[9px] text-zinc-500">
                    <span className="truncate max-w-[140px]">
                      {account.industry}
                    </span>
                    <span>{account.employees.toLocaleString()} emp</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Account Details Modal */}
      {selectedAccount && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-xs text-purple-400">
                  {selectedAccount.id}
                </span>
                <h3 className="text-base font-semibold text-zinc-100">
                  {selectedAccount.name}
                </h3>
                <p className="text-xs text-zinc-400 font-mono">
                  {selectedAccount.domain}
                </p>
              </div>
              <button
                onClick={() => setSelectedAccount(null)}
                className="text-zinc-400 hover:text-zinc-200 text-sm font-medium"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-zinc-800">
                <span className="text-zinc-400">Legal Entity:</span>
                <span className="text-zinc-200">
                  {selectedAccount.legalName || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800">
                <span className="text-zinc-400">Industry:</span>
                <span className="text-zinc-200">{selectedAccount.industry}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800">
                <span className="text-zinc-400">Headquarters:</span>
                <span className="text-zinc-200">
                  {selectedAccount.headquarters.city},{' '}
                  {selectedAccount.headquarters.country}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800">
                <span className="text-zinc-400">Headcount:</span>
                <span className="text-zinc-200">
                  {selectedAccount.employees.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800">
                <span className="text-zinc-400">Annual Revenue:</span>
                <span className="text-zinc-200">
                  {selectedAccount.annualRevenue || 'N/A'}
                </span>
              </div>
              <div className="py-1">
                <span className="text-zinc-400">Known Aliases:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedAccount.aliases?.map((alias) => (
                    <span
                      key={alias}
                      className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px]"
                    >
                      {alias}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedAccount(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
