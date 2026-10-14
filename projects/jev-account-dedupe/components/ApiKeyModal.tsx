'use client';

import React, { useState, useEffect } from 'react';
import { Key, Shield, Check, AlertCircle } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveKey: (key: string) => void;
  envKeyProvider?: string | null;
}

export function ApiKeyModal({
  isOpen,
  onClose,
  apiKey,
  onSaveKey,
  envKeyProvider,
}: ApiKeyModalProps) {
  const [inputValue, setInputValue] = useState(apiKey);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setInputValue(apiKey);
  }, [apiKey]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveKey(inputValue.trim());
    onClose();
  };

  const handleClear = () => {
    setInputValue('');
    onSaveKey('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-100">
                AI Gateway & Model Configuration
              </h3>
              <p className="text-xs text-zinc-400">
                Configure your Vercel AI Gateway or TypeSafe credentials
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 text-sm font-medium"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              API Gateway API Key (or TypeSafe API Key)
            </label>
            <input
              type="password"
              placeholder="vck_... or ts_..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-2 text-xs text-zinc-400">
            {envKeyProvider ? (
              <div className="flex items-start gap-2 text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg mb-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Server Connected:</strong> Active <code className="text-emerald-200 font-mono font-medium">{envKeyProvider}</code> detected from environment. Requests will run live.
                </span>
              </div>
            ) : null}

            <div className="flex items-start gap-2 text-zinc-300">
              <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Zero Configuration Needed:</strong> If you add{' '}
                <code className="text-zinc-200 font-mono bg-zinc-800 px-1 py-0.5 rounded">
                  TYPESAFE_API_KEY
                </code>{' '}
                or{' '}
                <code className="text-zinc-200 font-mono bg-zinc-800 px-1 py-0.5 rounded">
                  AI_GATEWAY_API_KEY
                </code>{' '}
                in your <code className="text-zinc-200 font-mono">.env.local</code> / <code className="text-zinc-200 font-mono">.env</code> file, the server reads it automatically.
              </span>
            </div>

            <div className="flex items-start gap-2 text-zinc-400">
              <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>
                <strong>Mock Engine Fallback:</strong> When no API key is set, the app runs in full-fidelity sandbox mode with calibrated latencies (~75ms for Jev, ~950ms for OpenAI) and realistic score distributions.
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handleClear}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Clear Key (Use Mock)
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-xs text-zinc-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-xs font-medium text-white transition-all shadow-md shadow-purple-500/20"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
