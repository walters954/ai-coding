'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { EXISTING_ACCOUNTS } from '@/data/existing-accounts';
import { INBOUND_ACCOUNTS } from '@/data/inbound-accounts';
import { DedupeResult, DedupeStrategy } from '@/types/crm';
import { Header } from '@/components/Header';
import { ExistingAccountsPane } from '@/components/ExistingAccountsPane';
import { InboundSimulatorPane } from '@/components/InboundSimulatorPane';
import { MetricsTracePane } from '@/components/MetricsTracePane';
import { ApiKeyModal } from '@/components/ApiKeyModal';
import {
  GripVertical,
  PanelLeftOpen,
  PanelRightOpen,
  Maximize2,
  Database,
  Inbox,
  Activity,
} from 'lucide-react';

export default function Home() {
  const [strategy, setStrategy] = useState<DedupeStrategy>('hybrid_jev');
  const [results, setResults] = useState<Map<string, DedupeResult>>(new Map());
  const [activeProcessingId, setActiveProcessingId] = useState<string | null>(null);
  const [selectedInboundId, setSelectedInboundId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [serverEnvInfo, setServerEnvInfo] = useState<{
    hasGatewayKey: boolean;
    hasTypeSafeKey: boolean;
    hasEnvKey: boolean;
    envKeyProvider: string | null;
  } | null>(null);
  const [scanningAccountId, setScanningAccountId] = useState<string | null>(null);
  const [activeComparingInboundName, setActiveComparingInboundName] = useState<string | null>(null);

  // Resizable panel widths (percentages)
  // Default left panel reduced to 20% as requested!
  const [leftWidth, setLeftWidth] = useState<number>(20);
  const [centerWidth, setCenterWidth] = useState<number>(38);
  const [leftCollapsed, setLeftCollapsed] = useState<boolean>(false);
  const [centerCollapsed, setCenterCollapsed] = useState<boolean>(false);
  const [rightCollapsed, setRightCollapsed] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingLeft = useRef<boolean>(false);
  const isDraggingRight = useRef<boolean>(false);

  // Load saved API key from localStorage if present and check server env status
  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => setServerEnvInfo(data))
      .catch(() => {});

    try {
      const savedKey = localStorage.getItem('ai_gateway_api_key');
      if (savedKey) setApiKey(savedKey);

      const savedLeft = localStorage.getItem('pane_left_width');
      if (savedLeft) setLeftWidth(Number(savedLeft));

      const savedCenter = localStorage.getItem('pane_center_width');
      if (savedCenter) setCenterWidth(Number(savedCenter));

      const savedLeftCol = localStorage.getItem('pane_left_collapsed');
      if (savedLeftCol !== null) setLeftCollapsed(savedLeftCol === 'true');

      const savedCenterCol = localStorage.getItem('pane_center_collapsed');
      if (savedCenterCol !== null) setCenterCollapsed(savedCenterCol === 'true');

      const savedRightCol = localStorage.getItem('pane_right_collapsed');
      if (savedRightCol !== null) setRightCollapsed(savedRightCol === 'true');
    } catch {
      // localStorage unavailable or restricted
    }
  }, []);

  const handleToggleLeft = () => {
    setLeftCollapsed((prev) => {
      if (!prev && centerCollapsed && rightCollapsed) return prev;
      const next = !prev;
      try {
        localStorage.setItem('pane_left_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const handleToggleCenter = () => {
    setCenterCollapsed((prev) => {
      if (!prev && leftCollapsed && rightCollapsed) return prev;
      const next = !prev;
      try {
        localStorage.setItem('pane_center_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const handleToggleRight = () => {
    setRightCollapsed((prev) => {
      if (!prev && leftCollapsed && centerCollapsed) return prev;
      const next = !prev;
      try {
        localStorage.setItem('pane_right_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Drag handlers for resizing panels
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const totalWidth = rect.width;
      const mouseX = e.clientX - rect.left;

      if (isDraggingLeft.current) {
        // Adjust left panel width (min 14%, max 35%)
        const newLeftPct = Math.min(35, Math.max(14, (mouseX / totalWidth) * 100));
        setLeftWidth(newLeftPct);
        try {
          localStorage.setItem('pane_left_width', String(Math.round(newLeftPct)));
        } catch {}
      } else if (isDraggingRight.current) {
        // Adjust center panel width
        const leftPixels = (leftWidth / 100) * totalWidth;
        const centerPixels = mouseX - leftPixels;
        const newCenterPct = Math.min(
          55,
          Math.max(25, (centerPixels / totalWidth) * 100)
        );
        // Ensure right panel has at least 25%
        if (leftWidth + newCenterPct <= 75) {
          setCenterWidth(newCenterPct);
          try {
            localStorage.setItem(
              'pane_center_width',
              String(Math.round(newCenterPct))
            );
          } catch {}
        }
      }
    };

    const handleMouseUp = () => {
      isDraggingLeft.current = false;
      isDraggingRight.current = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [leftWidth]);

  const handleStartDragLeft = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingLeft.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleStartDragRight = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRight.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleSaveApiKey = (newKey: string) => {
    setApiKey(newKey);
    try {
      if (newKey) {
        localStorage.setItem('ai_gateway_api_key', newKey);
      } else {
        localStorage.removeItem('ai_gateway_api_key');
      }
    } catch {
      // ignore
    }
  };

  // Helper to process a list of inbound IDs with streaming response
  const processBatch = useCallback(
    async (inboundIdsToProcess: string[]) => {
      if (inboundIdsToProcess.length === 0 || isProcessing) return;

      setIsProcessing(true);

      const firstInbound = INBOUND_ACCOUNTS.find(
        (a) => a.id === inboundIdsToProcess[0]
      );
      if (firstInbound) {
        setActiveComparingInboundName(firstInbound.name);
      }

      // If single item step, run a visible scanning pulse across initial accounts
      if (inboundIdsToProcess.length === 1) {
        const sweepAccounts = EXISTING_ACCOUNTS.slice(0, 4);
        for (const acc of sweepAccounts) {
          setScanningAccountId(acc.id);
          await new Promise((r) => setTimeout(r, 35));
        }
      }

      try {
        const response = await fetch('/api/dedupe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inboundIds: inboundIdsToProcess,
            strategy,
            apiKey: apiKey || undefined,
          }),
        });

        if (!response.body) {
          throw new Error('ReadableStream not supported or empty response body');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            try {
              const parsed = JSON.parse(trimmed);
              if (parsed.error) {
                console.error('Error from stream item:', parsed);
                continue;
              }

              const dedupeRes = parsed as DedupeResult;
              setResults((prev) => {
                const next = new Map(prev);
                next.set(dedupeRes.inboundId, dedupeRes);
                return next;
              });

              setSelectedInboundId(dedupeRes.inboundId);
              setActiveProcessingId(dedupeRes.inboundId);
              setActiveComparingInboundName(dedupeRes.inboundAccount.name);
              setScanningAccountId(dedupeRes.matchedAccountId || null);
            } catch (jsonErr) {
              console.error('Failed to parse stream chunk:', jsonErr, trimmed);
            }
          }
        }
      } catch (err) {
        console.error('Failed batch processing:', err);
      } finally {
        setIsProcessing(false);
        setActiveProcessingId(null);
        setScanningAccountId(null);
        setActiveComparingInboundName(null);
      }
    },
    [apiKey, isProcessing, strategy]
  );

  const handleProcessNext = () => {
    const unprocessed = INBOUND_ACCOUNTS.filter((a) => !results.has(a.id));
    if (unprocessed.length > 0) {
      processBatch([unprocessed[0].id]);
    }
  };

  const handleProcessBatch = (count: number) => {
    const unprocessed = INBOUND_ACCOUNTS.filter((a) => !results.has(a.id));
    const slice = unprocessed.slice(0, count).map((a) => a.id);
    if (slice.length > 0) {
      processBatch(slice);
    }
  };

  const handleProcessAll = () => {
    const unprocessed = INBOUND_ACCOUNTS.filter((a) => !results.has(a.id)).map(
      (a) => a.id
    );
    if (unprocessed.length > 0) {
      processBatch(unprocessed);
    }
  };

  const handleResetQueue = () => {
    setResults(new Map());
    setSelectedInboundId(null);
    setActiveProcessingId(null);
  };

  const selectedInbound =
    INBOUND_ACCOUNTS.find((a) => a.id === selectedInboundId) || null;
  const selectedResult = selectedInboundId
    ? results.get(selectedInboundId) || null
    : null;

  const isOnlyLeft = !leftCollapsed && centerCollapsed && rightCollapsed;
  const isOnlyCenter = leftCollapsed && !centerCollapsed && rightCollapsed;
  const isOnlyRight = leftCollapsed && centerCollapsed && !rightCollapsed;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 font-sans select-none">
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        onReset={handleResetQueue}
        isProcessing={isProcessing}
        hasCustomKey={Boolean(apiKey)}
        envKeyProvider={serverEnvInfo?.envKeyProvider}
        leftCollapsed={leftCollapsed}
        centerCollapsed={centerCollapsed}
        rightCollapsed={rightCollapsed}
        onToggleLeft={handleToggleLeft}
        onToggleCenter={handleToggleCenter}
        onToggleRight={handleToggleRight}
      />

      {/* 3-Pane Adjustable Resizable Layout */}
      <main ref={containerRef} className="flex-1 flex overflow-hidden relative">
        {/* Left Pane: Existing CRM Accounts Database */}
        {leftCollapsed ? (
          <aside
            onClick={() => handleToggleLeft()}
            className="w-10 bg-zinc-950 border-r border-zinc-800 flex flex-col items-center py-3.5 justify-between hover:bg-zinc-900/60 cursor-pointer transition-colors group shrink-0 select-none z-10"
            title="Click to expand CRM Accounts panel"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleLeft();
              }}
              className="p-1 rounded text-zinc-400 hover:text-zinc-200 group-hover:bg-zinc-800 transition-colors"
              title="Expand CRM Accounts"
            >
              <PanelLeftOpen className="w-4 h-4 text-purple-400" />
            </button>
            <div className="flex flex-col items-center gap-2 py-4">
              <Database className="w-3.5 h-3.5 text-purple-400/80" />
              <span className="[writing-mode:vertical-lr] rotate-180 text-[11px] font-medium tracking-wide text-zinc-400 group-hover:text-zinc-200 uppercase">
                CRM Accounts
              </span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-500 group-hover:text-zinc-300 border border-zinc-800">
              {EXISTING_ACCOUNTS.length}
            </span>
          </aside>
        ) : (
          <section
            style={{ width: isOnlyLeft ? '100%' : `${leftWidth}%` }}
            className={`h-full overflow-hidden shrink-0 ${isOnlyLeft ? 'flex-1' : ''}`}
          >
            <ExistingAccountsPane
              accounts={EXISTING_ACCOUNTS}
              highlightedAccountId={selectedResult?.matchedAccountId}
              candidateAccountIds={selectedResult?.candidateAccountIds}
              scanningAccountId={scanningAccountId}
              activeComparingInboundName={activeComparingInboundName}
              onCollapse={() => handleToggleLeft()}
            />
          </section>
        )}

        {/* Draggable Divider 1 (between Left and adjacent open panel) */}
        {!leftCollapsed && (!centerCollapsed || !rightCollapsed) && (
          <div
            onMouseDown={handleStartDragLeft}
            className="w-1.5 hover:w-2 hover:bg-indigo-500/50 bg-zinc-800 transition-all cursor-col-resize shrink-0 flex items-center justify-center group z-20"
            title="Drag to resize CRM Accounts panel"
          >
            <div className="w-0.5 h-6 bg-zinc-600 rounded group-hover:bg-indigo-300" />
          </div>
        )}

        {/* Center Pane: Inbound Stream & Controls */}
        {centerCollapsed ? (
          <aside
            onClick={() => handleToggleCenter()}
            className="w-10 bg-zinc-950 border-r border-zinc-800 flex flex-col items-center py-3.5 justify-between hover:bg-zinc-900/60 cursor-pointer transition-colors group shrink-0 select-none z-10"
            title="Click to expand Inbound Stream panel"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleCenter();
              }}
              className="p-1 rounded text-zinc-400 hover:text-zinc-200 group-hover:bg-zinc-800 transition-colors"
              title="Expand Inbound Stream"
            >
              <Maximize2 className="w-4 h-4 text-indigo-400" />
            </button>
            <div className="flex flex-col items-center gap-2 py-4">
              <Inbox className="w-3.5 h-3.5 text-indigo-400/80" />
              <span className="[writing-mode:vertical-lr] rotate-180 text-[11px] font-medium tracking-wide text-zinc-400 group-hover:text-zinc-200 uppercase">
                Inbound Queue
              </span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-500 group-hover:text-zinc-300 border border-zinc-800">
              {results.size}/{INBOUND_ACCOUNTS.length}
            </span>
          </aside>
        ) : (
          <section
            style={{
              width:
                isOnlyCenter || (!leftCollapsed && rightCollapsed)
                  ? undefined
                  : leftCollapsed && !rightCollapsed
                    ? `${Math.max(45, centerWidth)}%`
                    : `${centerWidth}%`,
            }}
            className={`h-full overflow-hidden ${
              isOnlyCenter || (!leftCollapsed && rightCollapsed)
                ? 'flex-1'
                : 'shrink-0'
            }`}
          >
            <InboundSimulatorPane
              inboundAccounts={INBOUND_ACCOUNTS}
              results={results}
              activeProcessingId={activeProcessingId}
              strategy={strategy}
              onSelectStrategy={setStrategy}
              onProcessNext={handleProcessNext}
              onProcessBatch={handleProcessBatch}
              onProcessAll={handleProcessAll}
              onResetQueue={handleResetQueue}
              isProcessing={isProcessing}
              selectedInboundId={selectedInboundId}
              onSelectInboundId={setSelectedInboundId}
              onCollapse={() => handleToggleCenter()}
            />
          </section>
        )}

        {/* Draggable Divider 2 (between Center and Right) */}
        {!centerCollapsed && !rightCollapsed && (
          <div
            onMouseDown={handleStartDragRight}
            className="w-1.5 hover:w-2 hover:bg-purple-500/50 bg-zinc-800 transition-all cursor-col-resize shrink-0 flex items-center justify-center group z-20"
            title="Drag to resize Trace & Metrics panel"
          >
            <div className="w-0.5 h-6 bg-zinc-600 rounded group-hover:bg-purple-300" />
          </div>
        )}

        {/* Right Pane: Tracing, Deep Dive & Performance Metrics */}
        {rightCollapsed ? (
          <aside
            onClick={() => handleToggleRight()}
            className="w-10 bg-zinc-950 border-l border-zinc-800 flex flex-col items-center py-3.5 justify-between hover:bg-zinc-900/60 cursor-pointer transition-colors group shrink-0 select-none z-10"
            title="Click to expand Inspector & Metrics panel"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleRight();
              }}
              className="p-1 rounded text-zinc-400 hover:text-zinc-200 group-hover:bg-zinc-800 transition-colors"
              title="Expand Inspector & Metrics"
            >
              <PanelRightOpen className="w-4 h-4 text-emerald-400" />
            </button>
            <div className="flex flex-col items-center gap-2 py-4">
              <Activity className="w-3.5 h-3.5 text-emerald-400/80" />
              <span className="[writing-mode:vertical-lr] rotate-180 text-[11px] font-medium tracking-wide text-zinc-400 group-hover:text-zinc-200 uppercase">
                Inspector
              </span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-500 group-hover:text-zinc-300 border border-zinc-800">
              Live
            </span>
          </aside>
        ) : (
          <section
            className={`h-full overflow-hidden ${
              isOnlyRight || (!centerCollapsed && !rightCollapsed) || (centerCollapsed && !rightCollapsed)
                ? 'flex-1'
                : 'shrink-0'
            }`}
          >
            <MetricsTracePane
              results={results}
              selectedInbound={selectedInbound}
              selectedResult={selectedResult}
              currentStrategy={strategy}
              onCollapse={() => handleToggleRight()}
            />
          </section>
        )}
      </main>

      <ApiKeyModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKey={apiKey}
        onSaveKey={handleSaveApiKey}
        envKeyProvider={serverEnvInfo?.envKeyProvider}
      />
    </div>
  );
}
