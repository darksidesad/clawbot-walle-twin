import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Brain,
  Cpu,
  Download,
  History,
  KeyRound,
  Play,
  PlugZap,
  ShieldCheck,
  Smartphone,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import type {
  AssistantAppMode,
  Esp32Packet,
  InstagramPostEntry,
  MissionLogEntry,
  ObsidianLogEntry,
  PerceptionReadout,
  RobotActionPlan,
  RobotEmotion,
  SafetyAuditReadout,
  TriadAgentTelemetry,
  TriadRole,
} from '@shared/types';
import { renderWalleEyes } from '@/lib/eyeRenderer';
import type { PhysicsSimState } from '@/lib/robotPhysics';
import {
  AnalyticsChartsPanel,
  AssistantModeSwitcher,
  CodingAgentsPanel,
  InstagramStudioPanel,
  ObsidianVaultPanel,
} from '@/components/AssistantStageOverlay';

interface WebSerialPort {
  open: (options: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
  readable?: ReadableStream<Uint8Array>;
  writable?: WritableStream<Uint8Array>;
}

interface HardwareBrainDockProps {
  simRef: React.MutableRefObject<PhysicsSimState>;
  packets: Esp32Packet[];
  isThinking: boolean;
  streamText: string;
  activePlan: RobotActionPlan | null;
  triad: Record<TriadRole, TriadAgentTelemetry> | null;
  perception: PerceptionReadout | null;
  safety: SafetyAuditReadout | null;
  history: MissionLogEntry[];
  sessionKey: string;
  selectedModel: string;
  tokensPerSec: number;
  decodeMs: number;
  speedupFactor: number;
  activeAssistantApp: AssistantAppMode;
  onSelectAssistantApp: (app: AssistantAppMode) => void;
  obsidianLogs: ObsidianLogEntry[];
  instagramPost: InstagramPostEntry;
  onSnapInstagramPhoto: () => void;
  onPublishInstagramPost: () => void;
  onUpdateInstagramCaption: (caption: string) => void;
  onLikeInstagramPost: () => void;
  muted: boolean;
  onToggleMuted: () => void;
  onSelectEmotionPreview: (emotion: RobotEmotion) => void;
  onReplayHistoryPlan: (entry: MissionLogEntry) => void;
}

const EMOTIONS: RobotEmotion[] = [
  'happy',
  'curious',
  'excited',
  'love',
  'focused',
  'alert',
  'sleepy',
  'neutral',
];

const TRIAD_CARDS: Array<{ role: TriadRole; code: string; title: string; color: string }> = [
  { role: 'nav', code: 'NAV', title: 'Planner', color: '#22d3ee' },
  { role: 'per', code: 'PER', title: 'Perception', color: '#fbbf24' },
  { role: 'saf', code: 'SAF', title: 'ESP32 Critic', color: '#34d399' },
];

export function HardwareBrainDock({
  simRef,
  packets,
  isThinking,
  streamText,
  activePlan,
  triad,
  perception,
  safety,
  history,
  sessionKey,
  selectedModel,
  tokensPerSec,
  decodeMs,
  speedupFactor,
  activeAssistantApp,
  onSelectAssistantApp,
  obsidianLogs,
  instagramPost,
  onSnapInstagramPhoto,
  onPublishInstagramPost,
  onUpdateInstagramCaption,
  onLikeInstagramPost,
  muted,
  onToggleMuted,
  onSelectEmotionPreview,
  onReplayHistoryPlan,
}: HardwareBrainDockProps) {
  const faceCanvasRef = useRef<HTMLCanvasElement>(null);
  const [activeBottomTab, setActiveBottomTab] = useState<'brain' | 'history'>('brain');

  // Real Web Serial API (navigator.serial) USB-C 115200 Baud state
  const [serialConnected, setSerialConnected] = useState(false);
  const [serialStatusNote, setSerialStatusNote] = useState<string | null>(null);
  const [lastRxLine, setLastRxLine] = useState<string | null>(null);
  const serialPortRef = useRef<WebSerialPort | null>(null);
  const serialWriterRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null);

  const showFaceMirror =
    activeAssistantApp === 'eyes' || activeAssistantApp === 'tiktok_live';

  // 60 FPS Android Phone Face Mirror Canvas loop (active when Face Mirror is visible)
  useEffect(() => {
    if (!showFaceMirror) return;
    const canvas = faceCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const draw = (now: number) => {
      const sim = simRef.current;
      renderWalleEyes(ctx, canvas.width, canvas.height, {
        emotion: sim.emotion,
        timeMs: now,
        gazeX: sim.gazeX,
        gazeY: sim.gazeY,
        isRecording: sim.isRecording,
        isThinking,
        batteryPct: sim.batteryPct,
      });
      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [isThinking, showFaceMirror, simRef]);

  // Stream live Esp32Packet JSON lines out over real USB-C Web Serial when connected!
  useEffect(() => {
    if (!serialConnected || !serialWriterRef.current || packets.length === 0) return;
    const latest = packets[packets.length - 1];
    const line = `${JSON.stringify({
      l: latest.l,
      r: latest.r,
      led: latest.led,
      wd: latest.wd,
      mode: latest.mode,
    })}\n`;
    const bytes = new TextEncoder().encode(line);
    void serialWriterRef.current.write(bytes).catch(() => {});
  }, [packets, serialConnected]);

  const handleToggleWebSerial = useCallback(async () => {
    if (serialConnected) {
      try {
        serialWriterRef.current?.releaseLock();
        serialWriterRef.current = null;
        await serialPortRef.current?.close();
      } catch {
        // Ignore close error
      }
      serialPortRef.current = null;
      setSerialConnected(false);
      setSerialStatusNote('USB-C Serial disconnected; simulated 115200 TX active.');
      return;
    }

    const navSerial = (
      navigator as unknown as {
        serial?: { requestPort: () => Promise<WebSerialPort> };
      }
    ).serial;

    if (!navSerial) {
      setSerialStatusNote('Web Serial API unavailable in this browser; streaming simulated 115200 TX.');
      return;
    }

    try {
      const port = await navSerial.requestPort();
      await port.open({ baudRate: 115200 });
      serialPortRef.current = port;
      if (port.writable) {
        serialWriterRef.current = port.writable.getWriter();
      }
      setSerialConnected(true);
      setSerialStatusNote('Live USB-C 115200 baud stream active to physical ESP32!');

      if (port.readable) {
        const reader = port.readable.getReader();
        const decoder = new TextDecoder();
        void (async () => {
          let buf = '';
          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              buf += decoder.decode(value, { stream: true });
              const lines = buf.split(/\r?\n/);
              buf = lines.pop() ?? '';
              for (const ln of lines) {
                if (ln.trim()) setLastRxLine(ln.trim());
              }
            }
          } catch {
            // Port closed
          } finally {
            reader.releaseLock();
          }
        })();
      }
    } catch {
      setSerialStatusNote('No physical ESP32 selected — streaming simulated 115200 baud TX.');
    }
  }, [serialConnected]);

  const sim = simRef.current;
  const leftPct = Math.round(Math.abs(sim.leftPwm) * 100);
  const rightPct = Math.round(Math.abs(sim.rightPwm) * 100);

  return (
    <aside className="flex flex-col gap-2 min-h-0 h-full">
      {/* SECTION 1: 5-Mode Embodied Assistant Deck (Eyes | TikTok | Coding | Obsidian | Charts) */}
      <div className="panel-surface shrink-0 rounded-xl p-2 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Smartphone className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-[11px] font-bold uppercase tracking-[0.11em] text-slate-200">
              Embodied Assistant Deck
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="rounded border border-amber-400/35 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-amber-300">
              {isThinking ? 'SCANNING' : sim.emotion}
            </span>
            <button
              type="button"
              onClick={onToggleMuted}
              className="rounded-md border border-slate-400/20 bg-slate-900/90 p-1 text-slate-300 hover:border-cyan-400/40 hover:text-white"
              title={muted ? 'Unmute WALL-E voice & synth chirps' : 'Mute WALL-E voice & audio'}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            >
              {muted ? (
                <VolumeX className="h-3.5 w-3.5 text-slate-500" />
              ) : (
                <Volume2 className="h-3.5 w-3.5 text-cyan-400" />
              )}
            </button>
          </div>
        </div>

        {/* 5-Mode Assistant Switcher */}
        <AssistantModeSwitcher
          activeApp={activeAssistantApp}
          onSelectApp={onSelectAssistantApp}
        />

        {/* Active Assistant View */}
        {showFaceMirror ? (
          <div>
            <div className="relative mx-auto overflow-hidden rounded-xl border-2 border-slate-700/90 bg-[#04070f] shadow-inner">
              <canvas
                ref={faceCanvasRef}
                width={360}
                height={132}
                className="w-full h-[94px] xl:h-[104px] block"
              />
            </div>

            <div className="mt-1.5 flex items-center gap-1 overflow-x-auto pb-0.5">
              {EMOTIONS.map((emo) => {
                const active = sim.emotion === emo;
                return (
                  <button
                    key={emo}
                    type="button"
                    onClick={() => onSelectEmotionPreview(emo)}
                    className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase transition-colors ${
                      active
                        ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/40'
                        : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {emo}
                  </button>
                );
              })}
            </div>
          </div>
        ) : activeAssistantApp === 'instagram_post' ? (
          <InstagramStudioPanel
            post={instagramPost}
            onSnapPhoto={onSnapInstagramPhoto}
            onPublishPost={onPublishInstagramPost}
            onUpdateCaption={onUpdateInstagramCaption}
            onLikeBoost={onLikeInstagramPost}
          />
        ) : activeAssistantApp === 'coding_agents' ? (
          <CodingAgentsPanel />
        ) : activeAssistantApp === 'obsidian_vault' ? (
          <ObsidianVaultPanel logs={obsidianLogs} />
        ) : (
          <AnalyticsChartsPanel
            tokensPerSec={tokensPerSec}
            decodeMs={decodeMs}
            speedupFactor={speedupFactor}
            triad={triad}
            history={history}
          />
        )}
      </div>

      {/* SECTION 2: ESP32 USB-C Hardware Serial Bridge (115200 Baud + Web Serial API!) */}
      <div className="panel-surface shrink-0 rounded-xl p-2">
        <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
          <div className="flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-200">
              ESP32 USB-C · 115200
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-500/12 px-1.5 py-0.5 font-mono text-[8.5px] font-bold text-emerald-300">
              <ShieldCheck className="h-2.5 w-2.5 text-emerald-400" />
              500ms WD
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void handleToggleWebSerial()}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[9.5px] font-bold transition-all ${
                serialConnected
                  ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200 shadow-glow-emerald'
                  : 'border-amber-400/35 bg-amber-500/12 text-amber-200 hover:bg-amber-500/25'
              }`}
              title="Pair a physical ESP32 over USB-C via Chrome Web Serial API (115200 baud)"
            >
              <PlugZap className="h-2.5 w-2.5" />
              {serialConnected ? 'USB-C LIVE' : 'Connect ESP32'}
            </button>
            <a
              href="/api/firmware"
              download="esp32_walle_bridge.ino"
              className="inline-flex items-center gap-1 rounded-md border border-cyan-400/30 bg-cyan-500/12 px-2 py-0.5 font-mono text-[9.5px] font-bold text-cyan-200 hover:bg-cyan-500/25 transition-colors"
              title="Download compiling Arduino ESP32 TB6612FNG firmware (.ino)"
            >
              <Download className="h-2.5 w-2.5" />
              .ino
            </a>
          </div>
        </div>

        {serialStatusNote && (
          <div className="mb-1.5 rounded border border-cyan-400/25 bg-cyan-500/10 px-2 py-0.5 font-mono text-[9px] text-cyan-200 truncate">
            {serialStatusNote}
          </div>
        )}

        <div className="grid grid-cols-3 gap-1.5 mb-1.5 font-mono text-[10px]">
          <div className="rounded-lg border border-slate-400/15 bg-[#060a14] p-1.5">
            <div className="flex items-center justify-between text-slate-400">
              <span>L_PWM</span>
              <span className="font-bold text-amber-300 tabular-nums">
                {sim.leftPwm >= 0 ? '+' : ''}
                {sim.leftPwm.toFixed(2)}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-amber-400 transition-all duration-100"
                style={{ width: `${leftPct}%` }}
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-400/15 bg-[#060a14] p-1.5">
            <div className="flex items-center justify-between text-slate-400">
              <span>R_PWM</span>
              <span className="font-bold text-cyan-300 tabular-nums">
                {sim.rightPwm >= 0 ? '+' : ''}
                {sim.rightPwm.toFixed(2)}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-cyan-400 transition-all duration-100"
                style={{ width: `${rightPct}%` }}
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-400/15 bg-[#060a14] p-1.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span>SONAR</span>
              <Activity className="h-3 w-3 text-emerald-400" />
            </div>
            <div className="font-bold text-emerald-300 tabular-nums text-xs">
              {sim.ultrasonicCm} cm
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-400/15 bg-[#04070e] p-1.5 font-mono text-[9.5px] leading-[1.35] text-emerald-300/90 h-[48px] overflow-hidden flex flex-col justify-end">
          {packets.slice(-3).map((pkt, idx) => (
            <div key={`${pkt.t}-${idx}`} className="truncate tabular-nums">
              <span className="text-slate-500">TX&gt; </span>
              {JSON.stringify({
                l: pkt.l,
                r: pkt.r,
                led: pkt.led,
                wd: pkt.wd,
                mode: pkt.mode,
              })}
            </div>
          ))}
          {lastRxLine && (
            <div className="truncate text-cyan-300 tabular-nums">
              <span className="text-amber-400">RX&lt; </span>
              {lastRxLine}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: 3-Agent OpenClaw Triad Brain & Mission History Tabs */}
      <div className="panel-surface flex-1 min-h-0 rounded-xl overflow-hidden flex flex-col">
        <div className="shrink-0 flex items-center justify-between gap-2 border-b border-slate-400/12 bg-[#0a101d]/95 px-2.5 py-1">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveBottomTab('brain')}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold transition-all ${
                activeBottomTab === 'brain'
                  ? 'border-cyan-400/40 bg-cyan-500/15 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Brain className="h-3.5 w-3.5 text-cyan-400" />
              <span>OpenClaw Triad</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveBottomTab('history')}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold transition-all ${
                activeBottomTab === 'history'
                  ? 'border-cyan-400/40 bg-cyan-500/15 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="h-3.5 w-3.5 text-amber-400" />
              <span>History</span>
              {history.length > 0 && (
                <span className="rounded bg-slate-800 px-1.5 py-0.2 font-mono text-[9.5px] font-bold text-slate-300 tabular-nums">
                  {history.length}
                </span>
              )}
            </button>
          </div>

          <span className="font-mono text-[9.5px] text-amber-300/90 truncate max-w-[125px]">
            {selectedModel.replace(/^cerebras\//, '')}
          </span>
        </div>

        {/* 3-Agent Parallel OpenClaw Triad Cards (NAV + PER + SAF) */}
        <div className="shrink-0 grid grid-cols-3 gap-1 border-b border-slate-400/10 bg-[#060a13] p-1.5 font-mono text-[9px]">
          {TRIAD_CARDS.map(({ role, code, title, color }) => {
            const info = triad?.[role];
            const isRun = isThinking && (!info || info.status === 'running');
            const isDone = info?.status === 'completed';
            return (
              <div
                key={role}
                className="rounded border border-slate-400/15 bg-[#091020] px-1.5 py-1 min-w-0"
                title={info?.sessionKey || `${sessionKey}-${role}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="inline-flex items-center gap-1 font-bold text-slate-200">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${isRun ? 'animate-ping' : ''}`}
                      style={{ backgroundColor: isDone ? '#34d399' : color }}
                    />
                    {code}
                  </span>
                  <span className="text-cyan-300 font-bold tabular-nums">
                    {info && info.tokensPerSec > 0 ? `${Math.round(info.tokensPerSec)}t/s` : title}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[8.5px] text-slate-400">
                  {info?.sessionKey || `agent:clawswarm:${code.toLowerCase()}`}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-[#04070e] p-2 font-mono text-[10.5px]">
          {activeBottomTab === 'brain' ? (
            <div className="space-y-1.5">
              {(safety || perception) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {safety && (
                    <span className="inline-flex items-center gap-1 rounded border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[9.5px] font-bold text-emerald-300">
                      <ShieldCheck className="h-3 w-3 text-emerald-400" />
                      SAFETY: {safety.status} · PWM ≤{safety.maxPwm}
                    </span>
                  )}
                  {perception && (
                    <span className="inline-flex items-center gap-1 rounded border border-amber-400/35 bg-amber-500/12 px-2 py-0.5 text-[9.5px] font-bold text-amber-200">
                      LOCK: {perception.targetLock} ({perception.confidencePct}%)
                    </span>
                  )}
                </div>
              )}

              {isThinking && !streamText ? (
                <div className="flex items-center gap-2 text-cyan-300 py-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>3 OpenClaw Triad sessions streaming in parallel...</span>
                </div>
              ) : streamText ? (
                <pre className="whitespace-pre-wrap break-words text-[10px] leading-relaxed text-slate-200">
                  {streamText}
                </pre>
              ) : activePlan ? (
                <div className="space-y-1.5">
                  <div className="text-xs font-sans font-semibold text-amber-300">
                    "{activePlan.speech}"
                  </div>
                  <div className="text-[10px] font-sans text-slate-400 leading-relaxed">
                    {activePlan.reasoning}
                  </div>
                  <pre className="rounded-lg border border-slate-800 bg-slate-950/90 p-1.5 text-[9.5px] text-cyan-200 overflow-x-auto">
                    {JSON.stringify(activePlan.steps, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="text-xs font-sans text-slate-400 leading-relaxed py-1">
                  Click any mission or speak in English/Spanish to dispatch the 3-Agent OpenClaw
                  Triad (<span className="text-cyan-300 font-semibold">NAV</span> +{' '}
                  <span className="text-amber-300 font-semibold">PER</span> +{' '}
                  <span className="text-emerald-300 font-semibold">SAF</span>).
                </div>
              )}

              <div className="pt-0.5 flex items-center gap-1 text-[9px] text-slate-500 truncate">
                <KeyRound className="h-2.5 w-2.5 text-cyan-400 shrink-0" />
                <span className="truncate">{sessionKey}</span>
              </div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-xs font-sans text-slate-500 py-4 text-center">
              No mission logs yet.
            </div>
          ) : (
            <div className="space-y-1.5">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-400/15 bg-[#080e1c] px-2.5 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-sans text-xs font-bold text-slate-100 truncate">
                      {entry.command}
                    </div>
                    <div className="flex items-center gap-2 text-[9.5px] text-slate-400 tabular-nums">
                      <span className="inline-flex items-center gap-0.5 text-cyan-300 font-bold">
                        <Zap className="h-2.5 w-2.5" />
                        {Math.round(entry.aggregateTps ?? entry.tokensPerSec)} tok/s
                      </span>
                      {entry.decodeMs && (
                        <span className="text-emerald-300 font-semibold">
                          {Math.round(entry.decodeMs)}ms decode
                        </span>
                      )}
                      <span className="uppercase text-amber-300">{entry.plan.emotion}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isThinking}
                    onClick={() => onReplayHistoryPlan(entry)}
                    className="inline-flex shrink-0 items-center gap-1 rounded border border-cyan-400/35 bg-cyan-500/15 px-2 py-1 font-sans text-[10.5px] font-semibold text-cyan-200 hover:bg-cyan-500/25"
                    title="Replay this mission plan in 3D with zero API credits"
                  >
                    <Play className="h-2.5 w-2.5 fill-current" />
                    Replay
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
