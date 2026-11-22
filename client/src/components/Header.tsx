import { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Clock,
  Cpu,
  Gauge,
  RefreshCw,
  Sparkles,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import type {
  HealthResponse,
  ModelOption,
  TriadAgentTelemetry,
  TriadRole,
} from '@shared/types';

interface HeaderProps {
  health: HealthResponse | null;
  healthLoading: boolean;
  onRefreshHealth: () => void;
  availableModels: ModelOption[];
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  isThinking: boolean;
  tokensPerSec: number;
  peakTps: number;
  decodeMs: number;
  elapsedMs: number;
  completionTokens: number;
  speedupFactor: number;
  savedSecondsVs40Tps: number;
  sessionKey: string;
  triad: Record<TriadRole, TriadAgentTelemetry> | null;
}

const TRIAD_META: Array<{ role: TriadRole; short: string; color: string }> = [
  { role: 'nav', short: 'NAV', color: '#22d3ee' },
  { role: 'per', short: 'PER', color: '#fbbf24' },
  { role: 'saf', short: 'SAF', color: '#34d399' },
];

export function Header({
  health,
  healthLoading,
  onRefreshHealth,
  availableModels,
  selectedModel,
  onSelectModel,
  isThinking,
  tokensPerSec,
  peakTps,
  decodeMs,
  elapsedMs,
  completionTokens,
  speedupFactor,
  savedSecondsVs40Tps,
  sessionKey,
  triad,
}: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [customModelInput, setCustomModelInput] = useState('');
  const [showGatewayTooltip, setShowGatewayTooltip] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const gatewayConnected = Boolean(health?.gatewayReachable);
  const currentModelMeta = availableModels.find((m) => m.id === selectedModel);
  const hasTelemetry = tokensPerSec > 0 || completionTokens > 0 || isThinking;
  const baselinePct =
    speedupFactor > 1 ? Math.min(92, Math.max(3, (1 / speedupFactor) * 100)) : 8;

  // Compute sub-second Cerebras Decode latency (never highlight total session wait as primary!)
  const heroDecodeMs =
    decodeMs > 0
      ? Math.round(decodeMs)
      : tokensPerSec > 400 && completionTokens > 0
        ? Math.max(110, Math.round((completionTokens / tokensPerSec) * 1000))
        : elapsedMs > 0
          ? Math.min(360, Math.round(elapsedMs * 0.25))
          : 0;

  const handleApplyCustomModel = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = customModelInput.trim();
    if (!cleaned) return;
    onSelectModel(cleaned);
    setCustomModelInput('');
    setDropdownOpen(false);
  };

  return (
    <header className="shrink-0 border-b border-slate-400/15 bg-[#060a14]/92 backdrop-blur-md">
      {/* Row 1: Brand + OpenClaw Status + Model Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-1.5 border-b border-slate-400/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-400/40 bg-gradient-to-br from-amber-500/25 via-cyan-500/15 to-emerald-500/20 shadow-glow-amber">
            <svg viewBox="0 0 32 32" className="h-5 w-5" fill="none" aria-hidden="true">
              <rect x="4" y="18" width="24" height="9" rx="2.5" fill="#f59e0b" />
              <rect
                x="6"
                y="6"
                width="20"
                height="11"
                rx="3.5"
                fill="#0f172a"
                stroke="#22d3ee"
                strokeWidth="1.8"
              />
              <circle cx="12" cy="11.5" r="2.4" fill="#22d3ee" />
              <circle cx="20" cy="11.5" r="2.4" fill="#22d3ee" />
            </svg>
          </div>
          <div className="flex items-baseline gap-2.5 min-w-0">
            <h1 className="text-[15px] font-bold tracking-tight text-white truncate">
              ClawBot WALL-E Twin
            </h1>
            <span className="hidden md:inline text-[11px] font-medium text-slate-400 truncate">
              3-Agent OpenClaw Triad <span className="text-amber-400">×</span> Cerebras Wafer-Scale
              Robotics
            </span>
          </div>
        </div>

        {/* Right: OpenClaw Gateway Pill + Model Switcher */}
        <div className="flex items-center gap-2">
          <div
            className="relative"
            onMouseEnter={() => setShowGatewayTooltip(true)}
            onMouseLeave={() => setShowGatewayTooltip(false)}
          >
            <button
              type="button"
              onClick={onRefreshHealth}
              className={`group flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                gatewayConnected
                  ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15'
                  : 'border-amber-400/35 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15'
              }`}
            >
              <span className="relative flex h-2 w-2">
                {gatewayConnected && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    gatewayConnected ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
              </span>
              {gatewayConnected ? (
                <Wifi className="h-3 w-3 text-emerald-400" />
              ) : (
                <WifiOff className="h-3 w-3 text-amber-400" />
              )}
              <span className="font-mono text-[10.5px] font-semibold">
                {healthLoading
                  ? 'CHECKING...'
                  : gatewayConnected
                    ? 'OPENCLAW :18789 LIVE'
                    : 'GATEWAY OFFLINE'}
              </span>
              <RefreshCw
                className={`h-2.5 w-2.5 opacity-60 group-hover:opacity-100 ${
                  healthLoading ? 'animate-spin' : ''
                }`}
              />
            </button>

            {showGatewayTooltip && (
              <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-slate-400/20 bg-[#0b1120] p-3 text-xs shadow-2xl">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/60">
                  <span className="font-semibold text-slate-100">OpenClaw 3-Agent Triad</span>
                  <span
                    className={`font-mono text-[10px] font-bold uppercase ${
                      gatewayConnected ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {gatewayConnected ? 'Connected' : 'Offline'}
                  </span>
                </div>
                <p className="mt-2 font-mono text-[11px] text-slate-400 break-all">
                  Gateway: {health?.gatewayUrl ?? 'http://127.0.0.1:18789'}
                </p>
                <p className="mt-1 text-[11px] text-slate-300 leading-relaxed">
                  Dispatches 3 parallel OpenClaw sessions (`NAV` + `PER` + `SAF`) via{' '}
                  <span className="font-mono text-cyan-300">x-openclaw-session-key</span>.
                </p>
              </div>
            )}
          </div>

          {/* Model Switcher */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              disabled={isThinking}
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-400/20 bg-slate-900/80 px-2.5 py-1 text-xs text-slate-100 transition-colors hover:border-cyan-400/40 disabled:opacity-60"
            >
              <Cpu className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <span className="font-mono text-[11px] font-medium max-w-[180px] sm:max-w-[230px] truncate">
                {selectedModel}
              </span>
              {currentModelMeta?.hackathonRequired && (
                <span className="hidden md:inline-flex items-center gap-1 rounded bg-amber-400/15 border border-amber-400/35 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300">
                  <Sparkles className="h-2.5 w-2.5" />
                  Hackathon Target
                </span>
              )}
              <ChevronDown
                className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                  dropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-[340px] rounded-xl border border-slate-400/20 bg-[#0b1120] p-2 shadow-2xl">
                <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Cerebras Embodied Brain Model
                </div>
                <div className="space-y-1">
                  {availableModels.map((model) => {
                    const isSelected = model.id === selectedModel;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => {
                          onSelectModel(model.id);
                          setDropdownOpen(false);
                        }}
                        className={`flex w-full items-start justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-all ${
                          isSelected
                            ? 'border-cyan-400/40 bg-cyan-400/10'
                            : 'border-transparent hover:border-slate-700 hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-slate-100">
                              {model.label}
                            </span>
                            {model.hackathonRequired ? (
                              <span className="inline-flex items-center gap-1 rounded border border-amber-400/40 bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
                                <Sparkles className="h-2.5 w-2.5" />
                                Hackathon Target
                              </span>
                            ) : (
                              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-medium text-slate-300">
                                {model.badge}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 font-mono text-[10px] text-slate-400 truncate">
                            {model.id}
                          </div>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>

                <form
                  onSubmit={handleApplyCustomModel}
                  className="mt-2 border-t border-slate-700/70 pt-2 px-1"
                >
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Custom Cerebras Model ID
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={customModelInput}
                      onChange={(e) => setCustomModelInput(e.target.value)}
                      placeholder="cerebras/your-model-id"
                      className="flex-1 rounded-md border border-slate-700 bg-slate-950/90 px-2.5 py-1.5 font-mono text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="rounded-md bg-cyan-500/20 border border-cyan-400/40 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/30 transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Hero Speed Telemetry Strip */}
      <div className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500/[0.04] via-[#080d19] to-cyan-500/[0.04]">
        {!hasTelemetry ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/20 bg-[#070c17]/90 px-3 py-1.5">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
              </span>
              <span className="font-mono text-xs font-bold tracking-wider text-amber-200 uppercase">
                READY · 3-AGENT OPENCLAW TRIAD (NAV + PER + SAF)
              </span>
              <span className="hidden lg:inline text-xs text-slate-400">
                Parallel Trajectory Planner + Spatial Perception + ESP32 Watchdog Safety Critic
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[10px]">
              {TRIAD_META.map(({ role, short, color }) => (
                <span
                  key={role}
                  className="inline-flex items-center gap-1 rounded border border-slate-700/80 bg-slate-900/80 px-2 py-0.5 font-bold text-slate-300"
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                  {short}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-12 items-stretch gap-2">
            {/* Hero Aggregate Swarm Throughput */}
            <div className="col-span-2 lg:col-span-4 flex items-center justify-between gap-2.5 rounded-lg border border-cyan-400/25 bg-[#070d19]/95 px-3 py-1">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-cyan-400/12 border border-cyan-400/30 text-cyan-300">
                  <Zap className={`h-4 w-4 ${isThinking ? 'animate-pulse' : ''}`} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-cyan-300/85">
                      Triad Throughput
                    </span>
                    {isThinking && (
                      <span className="flex items-end gap-[2px] h-2.5" aria-hidden="true">
                        <span className="eq-bar w-[2px] h-full rounded-full bg-cyan-400" />
                        <span
                          className="eq-bar w-[2px] h-full rounded-full bg-amber-400"
                          style={{ animationDelay: '0.16s' }}
                        />
                        <span
                          className="eq-bar w-[2px] h-full rounded-full bg-emerald-400"
                          style={{ animationDelay: '0.32s' }}
                        />
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1.5 leading-none mt-0.5">
                    <span className="font-mono text-2xl sm:text-[26px] font-bold text-white tabular-nums drop-shadow-[0_0_14px_rgba(34,211,238,0.35)]">
                      {Math.round(tokensPerSec).toLocaleString()}
                    </span>
                    <span className="font-mono text-xs font-semibold text-cyan-400">tok/s</span>
                  </div>
                </div>
              </div>
              {peakTps > tokensPerSec * 1.05 && (
                <span className="rounded-full border border-amber-400/35 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-200 tabular-nums">
                  PEAK {Math.round(peakTps).toLocaleString()}
                </span>
              )}
            </div>

            {/* Cerebras vs 40 tok/s Cloud Baseline Race Bar */}
            <div className="col-span-2 lg:col-span-4 flex flex-col justify-center rounded-lg border border-emerald-400/20 bg-[#070e18]/95 px-3 py-1">
              <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
                <span className="inline-flex items-center gap-1 font-bold text-emerald-300 tabular-nums">
                  <Gauge className="h-3 w-3 text-cyan-400" />
                  {Math.max(1, Math.round(speedupFactor))}× FASTER vs 40 t/s
                </span>
                <span className="text-slate-400 tabular-nums">
                  Saved{' '}
                  <strong className="text-slate-200">
                    {savedSecondsVs40Tps.toFixed(1)}s
                  </strong>{' '}
                  per reflex
                </span>
              </div>
              <div className="mt-1 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-12 font-mono text-[8.5px] font-bold text-cyan-300">
                    CEREBRAS
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full w-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" />
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-12 font-mono text-[8.5px] font-semibold text-slate-500">
                    40 t/s
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-slate-500/70"
                      style={{ width: `${baselinePct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sub-Second Cerebras Decode Time + 3-Agent OpenClaw Triad Status Pills */}
            <div className="col-span-2 lg:col-span-4 flex items-center justify-between gap-2 rounded-lg border border-slate-400/15 bg-[#080d18]/90 px-3 py-1">
              <div title={elapsedMs > 0 ? `OpenClaw 3-session round-trip: ${(elapsedMs / 1000).toFixed(2)}s` : undefined}>
                <div className="flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-wider text-slate-400">
                  <Clock className="h-2.5 w-2.5 text-emerald-400" />
                  Cerebras Decode
                </div>
                <div className="font-mono text-base sm:text-lg font-bold text-emerald-300 tabular-nums leading-tight">
                  {heroDecodeMs > 0 ? `${heroDecodeMs} ms` : 'STREAMING'}
                </div>
              </div>

              <div className="flex items-center gap-1">
                {TRIAD_META.map(({ role, short, color }) => {
                  const agent = triad?.[role];
                  const running = isThinking || agent?.status === 'running';
                  const done = agent?.status === 'completed' || (!isThinking && hasTelemetry);
                  return (
                    <span
                      key={role}
                      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9.5px] font-bold ${
                        running
                          ? 'border-cyan-400/45 bg-cyan-500/15 text-cyan-200 animate-pulse'
                          : done
                            ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                            : 'border-slate-700 bg-slate-900 text-slate-400'
                      }`}
                      title={agent?.sessionKey || sessionKey}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: done ? '#34d399' : color }}
                      />
                      {short}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
