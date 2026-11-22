import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Bookmark,
  Camera,
  CheckCircle2,
  Code2,
  Eye,
  Flame,
  Gift,
  GitPullRequest,
  Heart,
  MessageCircle,
  MonitorUp,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Terminal,
  Users,
  X,
  Zap,
} from 'lucide-react';
import type {
  AssistantAppMode,
  InstagramPostEntry,
  MissionLogEntry,
  ObsidianLogEntry,
  TikTokScreenMode,
  TriadAgentTelemetry,
  TriadRole,
} from '@shared/types';

/* =========================================================================
 * 6-Mode Embodied Assistant Switcher
 * (Eyes | TikTok | Insta | Code | Vault | Charts)
 * ========================================================================= */
interface AssistantSwitcherProps {
  activeApp: AssistantAppMode;
  onSelectApp: (app: AssistantAppMode) => void;
}

const APP_TABS: Array<{
  id: AssistantAppMode;
  label: string;
  short: string;
  icon: typeof Eye;
  activeClass: string;
}> = [
  {
    id: 'eyes',
    label: 'Eyes',
    short: 'Eyes',
    icon: Eye,
    activeClass: 'border-cyan-400/45 bg-cyan-500/20 text-cyan-200',
  },
  {
    id: 'tiktok_live',
    label: 'TikTok Live',
    short: 'TikTok',
    icon: Radio,
    activeClass: 'border-rose-400/50 bg-rose-500/20 text-rose-200',
  },
  {
    id: 'instagram_post',
    label: 'Instagram Studio',
    short: 'Insta',
    icon: Camera,
    activeClass: 'border-fuchsia-400/50 bg-fuchsia-500/20 text-fuchsia-200',
  },
  {
    id: 'coding_agents',
    label: 'Coding',
    short: 'Code',
    icon: Code2,
    activeClass: 'border-emerald-400/45 bg-emerald-500/20 text-emerald-200',
  },
  {
    id: 'obsidian_vault',
    label: 'Obsidian',
    short: 'Vault',
    icon: BookOpen,
    activeClass: 'border-violet-400/50 bg-violet-500/20 text-violet-200',
  },
  {
    id: 'analytics_charts',
    label: 'Analytics',
    short: 'Charts',
    icon: BarChart3,
    activeClass: 'border-amber-400/45 bg-amber-500/20 text-amber-200',
  },
];

export function AssistantModeSwitcher({ activeApp, onSelectApp }: AssistantSwitcherProps) {
  return (
    <div
      className="grid grid-cols-6 gap-0.5 rounded-lg border border-slate-400/15 bg-[#050914] p-0.5"
      role="tablist"
      aria-label="Embodied Assistant Apps"
    >
      {APP_TABS.map(({ id, label, short, icon: Icon, activeClass }) => {
        const active = activeApp === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            title={label}
            aria-selected={active}
            onClick={() => onSelectApp(id)}
            className={`inline-flex items-center justify-center gap-0.5 rounded-md border px-1 py-1 text-[9.5px] font-bold transition-all whitespace-nowrap ${
              active
                ? `${activeClass} shadow-sm`
                : 'border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <Icon className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{short}</span>
          </button>
        );
      })}
    </div>
  );
}

/* =========================================================================
 * 1. Ultra-Realistic 9:16 TikTok Live Studio Overlay
 *    - Real Live Robot POV Video Stream (WebGL offscreen lens)
 *    - Live Screen Share Mode (POV | Code | Obsidian | Charts) + Robot POV PiP
 * ========================================================================= */
interface TikTokLiveOverlayProps {
  topic: string;
  tokensPerSec: number;
  decodeMs: number;
  speedupFactor: number;
  triad: Record<TriadRole, TriadAgentTelemetry> | null;
  history: MissionLogEntry[];
  obsidianLogs: ObsidianLogEntry[];
  speech: string;
  povFrameUrl: string;
  dogInView: boolean;
  screenMode: TikTokScreenMode;
  onChangeScreenMode: (mode: TikTokScreenMode) => void;
  onClose: () => void;
  onSendGiftLog?: (giftText: string) => void;
}

const LIVE_CHAT_FEED = [
  { user: '@dev_maya', color: '#f472b6', msg: 'NO WAY that is WALL-E real front lens POV at 1,500+ tok/s!! 🤯' },
  { user: '@carlos_robotics', color: '#38bdf8', msg: '¡Brutal! ¿Puede compartir su pantalla de Obsidian y Charts en vivo?! 🔥' },
  { user: '@kimi_builder', color: '#fbbf24', msg: 'BISCUIT THE DOG IS ON CAMERA 😂🐕 A* pathfinding around the desk!' },
  { user: '@sarah_ml', color: '#34d399', msg: '3 parallel OpenClaw agents on a $25 chassis is peak hackathon' },
  { user: '@diego_ai', color: '#a78bfa', msg: '¡Saludame WALL-E! 900ms decode speed es una locura ⚡' },
  { user: '@hardware_joe', color: '#22d3ee', msg: 'Wait it even streams 115200 baud over Web Serial USB-C?!' },
  { user: '@lin_vision', color: '#fb7185', msg: 'Real FOV room search + reverse-and-detour avoidance! Respect 🙌' },
  { user: '@cerebras_fan', color: '#fbbf24', msg: 'Instant upvote on r/cerebras 🚀🔥 #KimiOnCerebras' },
];

const GIFT_EVENTS = [
  { user: '@dev_maya', gift: '🌹 Rose ×5', coins: 5 },
  { user: '@carlos_robotics', gift: '🚀 Galaxy Rocket', coins: 1000 },
  { user: '@kimi_builder', gift: '⚡ Cerebras Wafer', coins: 500 },
  { user: '@sarah_ml', gift: '💎 Diamond Paw ×3', coins: 99 },
];

const TIKTOK_SCREEN_TABS: Array<{ id: TikTokScreenMode; label: string }> = [
  { id: 'pov', label: '📷 POV' },
  { id: 'coding', label: '💻 Code' },
  { id: 'obsidian', label: '🟣 Obsidian' },
  { id: 'charts', label: '📊 Charts' },
];

export function TikTokLiveOverlay({
  topic,
  tokensPerSec,
  decodeMs,
  speedupFactor,
  triad,
  history,
  obsidianLogs,
  speech,
  povFrameUrl,
  dogInView,
  screenMode,
  onChangeScreenMode,
  onClose,
  onSendGiftLog,
}: TikTokLiveOverlayProps) {
  const [viewers, setViewers] = useState(2480);
  const [likes, setLikes] = useState(14200);
  const [chatIndex, setChatIndex] = useState(3);
  const [giftToast, setGiftToast] = useState(GIFT_EVENTS[0]);
  const [particles, setParticles] = useState<Array<{ id: number; icon: string; right: number }>>([
    { id: 1, icon: '❤️', right: 12 },
    { id: 2, icon: '🔥', right: 26 },
  ]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setViewers((v) => Math.min(9840, v + 65 + Math.floor(Math.random() * 145)));
      setLikes((l) => l + 80 + Math.floor(Math.random() * 160));
      setChatIndex((i) => (i + 1) % LIVE_CHAT_FEED.length);
      setParticles((prev) => [
        ...prev.slice(-7),
        {
          id: Date.now() + Math.random(),
          icon: ['❤️', '🌹', '🔥', '⚡', '🤖'][Math.floor(Math.random() * 5)],
          right: 8 + Math.floor(Math.random() * 26),
        },
      ]);
    }, 1500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const giftTimer = window.setInterval(() => {
      setGiftToast(GIFT_EVENTS[Math.floor(Math.random() * GIFT_EVENTS.length)]);
    }, 4200);
    return () => window.clearInterval(giftTimer);
  }, []);

  const visibleMessages = useMemo(() => {
    const out = [];
    for (let i = 0; i < 3; i++) {
      out.push(LIVE_CHAT_FEED[(chatIndex + i) % LIVE_CHAT_FEED.length]);
    }
    return out;
  }, [chatIndex]);

  const spawnBurst = (icon: string, isGift = false) => {
    setLikes((l) => l + (isGift ? 500 : 120));
    setViewers((v) => v + (isGift ? 180 : 35));
    const burst = Array.from({ length: 4 }, (_, idx) => ({
      id: Date.now() + idx + Math.random(),
      icon,
      right: 6 + idx * 8,
    }));
    setParticles((prev) => [...prev.slice(-6), ...burst]);
    if (isGift) {
      const nextGift = { user: '@you_live', gift: '🌹 Rose Bouquet ×10', coins: 250 };
      setGiftToast(nextGift);
      onSendGiftLog?.(
        `TikTok Live Gift burst: ${nextGift.gift} (${(viewers / 1000).toFixed(1)}K viewers)`
      );
    }
  };

  const isScreenSharing = screenMode !== 'pov';

  return (
    <div
      className="pointer-events-auto absolute right-3 top-14 bottom-16 z-30 w-[300px] sm:w-[318px] rounded-2xl border border-rose-400/50 bg-[#070a14] shadow-[0_18px_45px_-8px_rgba(244,63,94,0.48)] flex flex-col justify-between overflow-hidden"
      data-tiktok-live="true"
      data-tiktok-screen-mode={screenMode}
    >
      {/* BACKGROUND LAYER: Real Live Robot POV Video Feed (full-bleed when screenMode === 'pov') */}
      {!isScreenSharing && (
        <div className="absolute inset-0 z-0 bg-[#050814]">
          {povFrameUrl ? (
            <img
              src={povFrameUrl}
              alt="Live WALL-E Front Camera POV"
              data-tiktok-pov-feed="true"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-mono text-[10px] text-cyan-300/80">
              Initializing WALL-E Front Lens POV...
            </div>
          )}
          {/* Cinematic top/bottom vignette scrims so HUD & chat stay ultra-legible */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/75 via-black/15 to-black/88" />
        </div>
      )}

      {/* TOP CREATOR BAR + SCREEN SHARE SWITCHER */}
      <div className="relative z-10 p-2 space-y-1.5">
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-rose-500 bg-gradient-to-br from-amber-500 to-cyan-500 text-[11px] font-black text-slate-950">
              W
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[11.5px] font-bold text-white whitespace-nowrap drop-shadow">
                  @clawbot.walle
                </span>
                <span className="rounded bg-cyan-400/25 px-1 font-mono text-[8px] font-bold text-cyan-200 shrink-0">
                  AI
                </span>
              </div>
              <div className="text-[9.5px] font-medium text-rose-200 truncate drop-shadow">
                {(likes / 1000).toFixed(1)}K likes ·{' '}
                {tokensPerSec > 0 ? `${Math.round(tokensPerSec)} t/s` : 'Cerebras'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-1.5 py-0.5 font-mono text-[9px] font-extrabold text-white animate-pulse shadow">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              LIVE
            </span>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-black/75 border border-white/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-100 tabular-nums">
              <Users className="h-2.5 w-2.5 text-rose-300" />
              {(viewers / 1000).toFixed(1)}K
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-black/75 p-1 text-slate-200 hover:bg-rose-500/50 hover:text-white"
              title="End TikTok Live"
              aria-label="End TikTok Live"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Inline Live Screen Share Switcher (POV | Code | Obsidian | Charts) */}
        <div className="grid grid-cols-4 gap-1 rounded-lg border border-white/15 bg-black/65 p-0.5 backdrop-blur-md">
          {TIKTOK_SCREEN_TABS.map((tab) => {
            const active = screenMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeScreenMode(tab.id)}
                className={`rounded-md px-1 py-0.5 text-[9px] font-bold transition-all whitespace-nowrap ${
                  active
                    ? tab.id === 'pov'
                      ? 'bg-rose-500/80 text-white shadow'
                      : 'bg-cyan-500/80 text-slate-950 shadow'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Live Source Status Strip (LIVE ROBOT POV or SHARING SCREEN) + Audio EQ */}
        <div className="flex items-center justify-between gap-1.5 rounded-lg border border-white/12 bg-black/60 px-2 py-1 backdrop-blur-sm">
          {isScreenSharing ? (
            <span
              className="inline-flex items-center gap-1 font-mono text-[9px] font-extrabold text-cyan-300 uppercase"
              data-tiktok-sharing-badge="true"
            >
              <MonitorUp className="h-3 w-3 text-emerald-400 animate-pulse" />
              🖥️ SHARING SCREEN · {screenMode.toUpperCase()}
            </span>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="shrink-0 rounded bg-cyan-500/25 border border-cyan-400/40 px-1 py-0.2 font-mono text-[8.5px] font-bold text-cyan-200">
                📡 LIVE POV
              </span>
              {dogInView ? (
                <span className="shrink-0 rounded bg-emerald-500/25 border border-emerald-400/45 px-1 py-0.2 font-mono text-[8.5px] font-bold text-emerald-200">
                  🐕 BISCUIT 98%
                </span>
              ) : (
                <span className="text-[9.5px] font-semibold text-amber-200 truncate">
                  {topic || '🤖 $25 DIY WALL-E Live!'}
                </span>
              )}
            </div>
          )}

          <span className="flex items-end gap-[2px] h-3 shrink-0" aria-hidden="true">
            <span className="eq-bar w-[2px] h-full rounded-full bg-rose-400" />
            <span
              className="eq-bar w-[2px] h-full rounded-full bg-cyan-400"
              style={{ animationDelay: '0.15s' }}
            />
            <span
              className="eq-bar w-[2px] h-full rounded-full bg-amber-400"
              style={{ animationDelay: '0.3s' }}
            />
          </span>
        </div>

        {/* Gift Alert Toast Banner */}
        <div className="flex items-center justify-between gap-2 rounded-full border border-amber-400/45 bg-gradient-to-r from-rose-600/85 via-amber-500/80 to-pink-600/85 px-2.5 py-0.5 text-[9.5px] font-bold text-white shadow-lg">
          <span className="inline-flex items-center gap-1 truncate">
            <Gift className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {giftToast.user} sent {giftToast.gift}
            </span>
          </span>
          <Flame className="h-3 w-3 shrink-0 text-yellow-200 animate-bounce" />
        </div>
      </div>

      {/* CENTER STAGE: Shared Screen App + Live Robot POV Corner PiP (or transparent POV stage + floating particles) */}
      <div className="relative z-10 flex-1 min-h-[36px] px-2 overflow-hidden flex flex-col justify-center">
        {isScreenSharing && (
          <div className="relative rounded-xl border border-cyan-400/35 bg-[#060b16]/95 p-1.5 shadow-xl overflow-y-auto max-h-full">
            {/* Corner Robot POV Facecam PiP while sharing screen */}
            {povFrameUrl && (
              <div
                className="absolute right-1.5 top-1.5 z-20 w-[68px] h-[88px] overflow-hidden rounded-lg border-2 border-rose-400/80 bg-black shadow-lg"
                data-tiktok-pov-pip="true"
              >
                <img
                  src={povFrameUrl}
                  alt="WALL-E POV PiP"
                  className="h-full w-full object-cover"
                />
                <span className="absolute bottom-0.5 left-0.5 rounded bg-rose-600/90 px-1 font-mono text-[7px] font-bold text-white">
                  POV
                </span>
              </div>
            )}

            <div className="pr-1">
              {screenMode === 'coding' ? (
                <CodingAgentsPanel compact />
              ) : screenMode === 'obsidian' ? (
                <ObsidianVaultPanel logs={obsidianLogs} compact />
              ) : (
                <AnalyticsChartsPanel
                  tokensPerSec={tokensPerSec}
                  decodeMs={decodeMs}
                  speedupFactor={speedupFactor}
                  triad={triad}
                  history={history}
                  compact
                />
              )}
            </div>
          </div>
        )}

        {/* Rising Hearts / Roses / Fire Particles */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {particles.map((p) => (
            <span
              key={p.id}
              className="animate-float-particle absolute bottom-0 text-base select-none"
              style={{ right: `${p.right}px` }}
            >
              {p.icon}
            </span>
          ))}
        </div>
      </div>

      {/* BOTTOM LIVE SPEECH CAPTION + SCROLLING CHAT + LIKE/GIFT CONTROLS */}
      <div className="relative z-10 p-2 space-y-1.5 bg-gradient-to-t from-black/92 via-black/70 to-transparent">
        <div className="rounded-lg border border-cyan-400/30 bg-cyan-950/70 px-2 py-1 text-[9.5px] font-medium text-cyan-100 line-clamp-2 backdrop-blur-sm">
          🎙️ <strong className="text-amber-300">WALL-E:</strong> {speech}
        </div>

        {/* Live Scrolling Audience Chat */}
        <div className="space-y-1 max-h-[84px] overflow-hidden">
          {visibleMessages.map((c, idx) => (
            <div
              key={`${c.user}-${idx}`}
              className="rounded-lg bg-black/60 px-2 py-0.5 text-[9.5px] leading-snug text-slate-100 border border-white/10 backdrop-blur-sm"
            >
              <span className="font-bold mr-1" style={{ color: c.color }}>
                {c.user}
              </span>
              <span>{c.msg}</span>
            </div>
          ))}
        </div>

        {/* Interactive Demo Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => spawnBurst('❤️', false)}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-full border border-rose-400/50 bg-rose-500/25 py-1 text-[10px] font-bold text-rose-100 hover:bg-rose-500/40 transition-colors backdrop-blur-sm"
          >
            <Heart className="h-3 w-3 fill-current text-rose-400" />
            Send Likes
          </button>
          <button
            type="button"
            onClick={() => spawnBurst('🌹', true)}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-full border border-amber-400/50 bg-amber-500/25 py-1 text-[10px] font-bold text-amber-100 hover:bg-amber-500/40 transition-colors backdrop-blur-sm"
          >
            <Gift className="h-3 w-3 text-amber-300" />
            Send Gift
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
 * 2. Visual Instagram Studio Panel (Real 3D Camera Capture + Publish)
 * ========================================================================= */
interface InstagramStudioPanelProps {
  post: InstagramPostEntry;
  onSnapPhoto: () => void;
  onPublishPost: () => void;
  onUpdateCaption: (caption: string) => void;
  onLikeBoost: () => void;
}

export function InstagramStudioPanel({
  post,
  onSnapPhoto,
  onPublishPost,
  onUpdateCaption,
  onLikeBoost,
}: InstagramStudioPanelProps) {
  const [flash, setFlash] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);

  const handleRetake = () => {
    setFlash(true);
    onSnapPhoto();
    window.setTimeout(() => setFlash(false), 260);
  };

  return (
    <div className="space-y-1.5" data-assistant-panel="instagram_post">
      {/* Instagram Post Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600 p-[1.5px]">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-950 text-[10px] font-black text-amber-300">
              W
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-bold text-white truncate">@clawbot.walle</span>
              <BadgeCheck className="h-3 w-3 shrink-0 text-sky-400" />
            </div>
            <div className="text-[8.5px] font-mono text-slate-400 truncate">
              Smart-Lab 3D · Cerebras Lens
            </div>
          </div>
        </div>

        {post.published ? (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-emerald-400/50 bg-emerald-500/20 px-2 py-0.5 font-mono text-[8.5px] font-bold text-emerald-200"
            data-instagram-published="true"
          >
            <CheckCircle2 className="h-2.5 w-2.5 text-emerald-300" />
            Published ✓
          </span>
        ) : (
          <span className="rounded-full border border-fuchsia-400/40 bg-fuchsia-500/15 px-2 py-0.5 font-mono text-[8.5px] font-bold text-fuchsia-200">
            DRAFT · 3D POV
          </span>
        )}
      </div>

      {/* Real Captured 3D Camera Photo Frame */}
      <div className="relative overflow-hidden rounded-lg border border-fuchsia-400/30 bg-[#04070e] aspect-[16/9]">
        {post.imageDataUrl ? (
          <img
            src={post.imageDataUrl}
            alt="WALL-E 3D POV Instagram capture"
            data-instagram-photo="true"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400">
            <Camera className="h-5 w-5 text-fuchsia-400" />
            <span className="font-mono text-[9.5px]">Click Retake Photo to snap 3D lens</span>
          </div>
        )}

        {flash && <div className="pointer-events-none absolute inset-0 bg-white/80 transition-opacity" />}

        <div className="pointer-events-none absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-black/70 border border-white/15 px-1.5 py-0.5 font-mono text-[8px] font-bold text-cyan-200">
          <Sparkles className="h-2.5 w-2.5 text-amber-300" />
          WALL-E 3D CAMERA CAPTURE
        </div>
      </div>

      {/* Action Icons + Live Animated Likes Counter */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onLikeBoost}
            className="inline-flex items-center gap-1 text-rose-400 hover:scale-110 transition-transform"
            title="Like this post"
          >
            <Heart className="h-3.5 w-3.5 fill-current" />
            <span className="font-mono text-[10px] font-bold text-slate-100 tabular-nums">
              {post.likes.toLocaleString()}
            </span>
          </button>
          <span className="inline-flex items-center gap-1 text-slate-400 text-[10px] font-mono">
            <MessageCircle className="h-3.5 w-3.5" />
            {post.comments.length}
          </span>
          <Send className="h-3.5 w-3.5 text-slate-400" />
        </div>
        <Bookmark className="h-3.5 w-3.5 text-slate-400" />
      </div>

      {/* Caption & Hashtags (Click to Edit or Auto-Generated by OpenClaw) */}
      <div className="rounded-lg border border-slate-400/15 bg-[#050914] p-1.5 space-y-1">
        {editingCaption ? (
          <textarea
            value={post.caption}
            onChange={(e) => onUpdateCaption(e.target.value)}
            onBlur={() => setEditingCaption(false)}
            rows={2}
            className="w-full rounded border border-fuchsia-400/40 bg-slate-950 px-1.5 py-1 text-[10px] text-slate-100 focus:outline-none"
            autoFocus
          />
        ) : (
          <p
            onClick={() => setEditingCaption(true)}
            className="text-[10px] leading-snug text-slate-200 cursor-text line-clamp-2"
            title="Click to edit Instagram caption"
          >
            <strong className="text-white mr-1">clawbot.walle</strong>
            {post.caption}
          </p>
        )}
        <div className="flex flex-wrap gap-1 font-mono text-[8.5px] font-semibold text-cyan-300">
          {post.hashtags.slice(0, 5).map((tag) => (
            <span key={tag}>{tag.startsWith('#') ? tag : `#${tag}`}</span>
          ))}
        </div>
      </div>

      {/* Mini Comments Preview */}
      {post.comments.length > 0 && (
        <div className="space-y-0.5 px-0.5 text-[9.5px] text-slate-300">
          {post.comments.slice(0, 2).map((c, idx) => (
            <div key={idx} className="truncate">
              <span className="font-bold text-amber-200 mr-1">{c.user}</span>
              <span>{c.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Retake Photo & Publish Post Controls */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleRetake}
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-cyan-400/40 bg-cyan-500/15 py-1 text-[10px] font-bold text-cyan-200 hover:bg-cyan-500/25 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          📸 Retake Photo
        </button>
        <button
          type="button"
          onClick={onPublishPost}
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-fuchsia-400/50 bg-gradient-to-r from-fuchsia-600/85 to-rose-500/85 py-1 text-[10px] font-bold text-white hover:brightness-110 transition-all shadow"
        >
          <Send className="h-3 w-3" />
          {post.published ? 'Published to IG ✓' : '🚀 Publish Post'}
        </button>
      </div>
    </div>
  );
}

/* =========================================================================
 * 3. Coding Agents Hub Panel
 * ========================================================================= */
const CODING_FLEET = [
  {
    id: 'pr-418',
    title: 'PR #418 · Auth Session Refactor',
    branch: 'feat/openclaw-oauth',
    status: '18/18 tests ✓',
    color: '#34d399',
  },
  {
    id: 'ci-pipe',
    title: 'CI/CD Pipeline · Production Build',
    branch: 'main · 1.4s build',
    status: 'GREEN',
    color: '#22d3ee',
  },
  {
    id: 'sec-audit',
    title: 'Kimi K3.1 Pro · Security Audit',
    branch: 'zero-trust scan',
    status: '0 criticals',
    color: '#fbbf24',
  },
];

const DIFF_LINES = [
  '  [openclaw-coder] diff --git a/src/auth/tokenGuard.ts',
  '- const ttl = config.sessionTtl || 3600;',
  '+ const ttl = Math.min(config.sessionTtl ?? 1800, 3600);',
  '+ assertSafeOrigin(req.headers.origin);',
  '  [vitest] PASS src/auth/__tests__/tokenGuard.test.ts (18/18)',
  '  [kimi-audit] Zero SSRF / injection vectors · ready to merge ✓',
];

export function CodingAgentsPanel({ compact = false }: { compact?: boolean }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => (n + 1) % DIFF_LINES.length), 1400);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="space-y-1.5" data-assistant-panel="coding_agents">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-emerald-300">
          <Terminal className="h-3 w-3" />
          OpenClaw Coding Fleet
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[8.5px] font-bold text-emerald-300">
          <CheckCircle2 className="h-2.5 w-2.5" />
          ALL GREEN
        </span>
      </div>

      <div className="space-y-1">
        {CODING_FLEET.slice(0, compact ? 2 : 3).map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-slate-400/15 bg-[#070d1a] px-2 py-1"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-100 truncate">
                <GitPullRequest className="h-3 w-3 shrink-0" style={{ color: item.color }} />
                <span className="truncate">{item.title}</span>
              </div>
              <div className="font-mono text-[8.5px] text-slate-400">{item.branch}</div>
            </div>
            <span
              className="shrink-0 rounded border px-1 py-0.5 font-mono text-[8.5px] font-bold"
              style={{
                color: item.color,
                borderColor: `${item.color}55`,
                backgroundColor: `${item.color}18`,
              }}
            >
              {item.status}
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-emerald-400/20 bg-[#04070e] p-1.5 font-mono text-[9px] leading-relaxed">
        {DIFF_LINES.slice(0, compact ? 4 : 6).map((line, idx) => (
          <div
            key={idx}
            className={`truncate ${
              line.startsWith('+')
                ? 'text-emerald-300'
                : line.startsWith('-')
                  ? 'text-rose-300'
                  : idx === tick
                    ? 'text-cyan-200 font-bold'
                    : 'text-slate-400'
            }`}
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================================
 * 4. Obsidian Knowledge Vault Panel (Interactive SVG Backlink Graph + Daily Note)
 * ========================================================================= */
interface ObsidianVaultPanelProps {
  logs: ObsidianLogEntry[];
  compact?: boolean;
}

const VAULT_NODES = [
  { id: 'walle', label: 'ClawBot-WALL-E', x: 165, y: 58, color: '#a78bfa' },
  { id: 'cerebras', label: 'Cerebras-Hackathon', x: 64, y: 26, color: '#22d3ee' },
  { id: 'daily', label: 'Daily-2026-11-22', x: 268, y: 28, color: '#34d399' },
  { id: 'esp32', label: 'ESP32-Pinout', x: 66, y: 94, color: '#f59e0b' },
  { id: 'social', label: 'TikTok-IG-Live', x: 266, y: 94, color: '#fb7185' },
];

const VAULT_EDGES: Array<[string, string]> = [
  ['walle', 'cerebras'],
  ['walle', 'daily'],
  ['walle', 'esp32'],
  ['walle', 'social'],
  ['cerebras', 'daily'],
  ['daily', 'social'],
];

export function ObsidianVaultPanel({ logs, compact = false }: ObsidianVaultPanelProps) {
  const [selectedNode, setSelectedNode] = useState<string>('walle');

  const nodeMap = useMemo(() => new Map(VAULT_NODES.map((n) => [n.id, n])), []);

  return (
    <div className="space-y-1.5" data-assistant-panel="obsidian_vault">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-violet-300">
          <BookOpen className="h-3 w-3" />
          Obsidian Vault · Graph
        </span>
        <span className="rounded border border-violet-400/35 bg-violet-500/15 px-1.5 py-0.5 font-mono text-[8.5px] font-bold text-violet-200">
          Daily-2026-11-22.md
        </span>
      </div>

      {/* Interactive SVG Backlink Knowledge Graph */}
      <div className="rounded-lg border border-violet-400/25 bg-[#080614] p-1">
        <svg viewBox="0 0 332 118" className={`w-full select-none ${compact ? 'h-[78px]' : 'h-[94px]'}`}>
          {VAULT_EDGES.map(([aId, bId], i) => {
            const a = nodeMap.get(aId)!;
            const b = nodeMap.get(bId)!;
            const linked = aId === selectedNode || bId === selectedNode;
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={linked ? '#a78bfa' : 'rgba(148,163,184,0.22)'}
                strokeWidth={linked ? 1.6 : 1}
              />
            );
          })}
          {VAULT_NODES.map((node) => {
            const active = node.id === selectedNode;
            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => setSelectedNode(node.id)}
                className="cursor-pointer"
              >
                {active && <circle r="11" fill={node.color} opacity="0.24" />}
                <circle
                  r={active ? 6.5 : 4.8}
                  fill={node.color}
                  stroke="#0f172a"
                  strokeWidth="1.5"
                />
                <text
                  y={node.y > 70 ? 15 : -10}
                  textAnchor="middle"
                  fill={active ? '#f8fafc' : '#cbd5e1'}
                  fontSize="8.5"
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight={active ? '700' : '500'}
                >
                  [[{node.label}]]
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Auto-Appended Markdown Daily Note */}
      <div
        className={`rounded-lg border border-violet-400/20 bg-[#05040d] p-1.5 font-mono text-[9px] space-y-1 overflow-y-auto ${
          compact ? 'max-h-[58px]' : 'max-h-[82px]'
        }`}
      >
        <div className="text-violet-300 font-bold"># Daily Mission Log · [[ClawBot-WALL-E]]</div>
        {logs.slice(0, compact ? 3 : 6).map((entry) => (
          <div key={entry.id} className="text-slate-200 leading-snug">
            <span className="text-slate-500">- [{entry.timestamp}] </span>
            <span className="text-violet-300 font-semibold">#{entry.tag} </span>
            <span>{entry.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================================
 * 5. Live Analytics & Performance Charts Panel
 * ========================================================================= */
interface AnalyticsChartsPanelProps {
  tokensPerSec: number;
  decodeMs: number;
  speedupFactor: number;
  triad: Record<TriadRole, TriadAgentTelemetry> | null;
  history: MissionLogEntry[];
  compact?: boolean;
}

export function AnalyticsChartsPanel({
  tokensPerSec,
  decodeMs,
  speedupFactor,
  triad,
  history,
  compact = false,
}: AnalyticsChartsPanelProps) {
  const tpsPoints = useMemo(() => {
    const histVals = history
      .slice(0, 6)
      .reverse()
      .map((h) => Math.round(h.aggregateTps ?? h.tokensPerSec));
    const current = Math.round(tokensPerSec || 1473);
    const merged = histVals.length >= 3 ? [...histVals, current] : [980, 1240, 1473, 1890, current];
    return merged.slice(-6);
  }, [history, tokensPerSec]);

  const maxTps = Math.max(2200, ...tpsPoints);
  const sparkCoords = tpsPoints
    .map((val, idx) => {
      const x = 10 + (idx / Math.max(1, tpsPoints.length - 1)) * 145;
      const y = 54 - (val / maxTps) * 44;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const navTok = triad?.nav?.completionTokens || 420;
  const perTok = triad?.per?.completionTokens || 240;
  const safTok = triad?.saf?.completionTokens || 210;
  const sumTok = Math.max(1, navTok + perTok + safTok);
  const navPct = Math.round((navTok / sumTok) * 100);
  const perPct = Math.round((perTok / sumTok) * 100);
  const safPct = Math.max(1, 100 - navPct - perPct);

  const circum = 2 * Math.PI * 18;
  const navDash = (navPct / 100) * circum;
  const perDash = (perPct / 100) * circum;
  const safDash = (safPct / 100) * circum;

  const displayTps = Math.round(tokensPerSec || tpsPoints[tpsPoints.length - 1] || 1473);
  const displayDecode = Math.round(decodeMs || 620);
  const displaySpeedup = Math.max(12, Math.round(speedupFactor || displayTps / 40));

  return (
    <div className="space-y-1.5" data-assistant-panel="analytics_charts">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-amber-300">
          <BarChart3 className="h-3 w-3" />
          Cerebras × OpenClaw
        </span>
        <span className="inline-flex items-center gap-1 font-mono text-[9px] font-bold text-cyan-300 tabular-nums">
          <Zap className="h-3 w-3 text-amber-400" />
          {displayTps.toLocaleString()} tok/s
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {/* Chart 1: Cerebras tok/s Sparkline */}
        <div className="rounded-lg border border-cyan-400/20 bg-[#050914] p-1.5">
          <div className="flex items-center justify-between font-mono text-[8.5px] text-slate-400 mb-0.5">
            <span>TOK/S CURVE</span>
            <span className="text-cyan-300 font-bold tabular-nums">{displaySpeedup}×</span>
          </div>
          <svg viewBox="0 0 165 62" className={`w-full ${compact ? 'h-[44px]' : 'h-[54px]'}`}>
            <defs>
              <linearGradient id="tpsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <polygon points={`10,56 ${sparkCoords} 155,56`} fill="url(#tpsGrad)" />
            <polyline
              points={sparkCoords}
              fill="none"
              stroke="#22d3ee"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Chart 2: OpenClaw Triad Token Donut */}
        <div className="rounded-lg border border-emerald-400/20 bg-[#050914] p-1.5 flex items-center gap-1.5">
          <svg viewBox="0 0 48 48" className="h-11 w-11 shrink-0 -rotate-90">
            <circle
              cx="24"
              cy="24"
              r="18"
              fill="none"
              stroke="#22d3ee"
              strokeWidth="6"
              strokeDasharray={`${navDash} ${circum}`}
            />
            <circle
              cx="24"
              cy="24"
              r="18"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="6"
              strokeDasharray={`${perDash} ${circum}`}
              strokeDashoffset={-navDash}
            />
            <circle
              cx="24"
              cy="24"
              r="18"
              fill="none"
              stroke="#34d399"
              strokeWidth="6"
              strokeDasharray={`${safDash} ${circum}`}
              strokeDashoffset={-(navDash + perDash)}
            />
          </svg>
          <div className="font-mono text-[8px] space-y-0.5 tabular-nums min-w-0">
            <div className="text-slate-400 font-bold uppercase">Triad</div>
            <div className="text-cyan-300">NAV {navPct}%</div>
            <div className="text-amber-300">PER {perPct}%</div>
            <div className="text-emerald-300">SAF {safPct}%</div>
          </div>
        </div>
      </div>

      {/* Chart 3 & 4: Latency Savings Bar + TikTok Viewer Growth Curve */}
      {!compact && (
        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-lg border border-slate-400/15 bg-[#050914] p-1.5 font-mono text-[8.5px] space-y-1">
            <div className="flex items-center justify-between text-slate-300">
              <span className="inline-flex items-center gap-1">
                <Activity className="h-3 w-3 text-emerald-400" />
                vs 40 tok/s
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="w-11 text-cyan-300 font-bold">Cerebras</span>
                <div className="h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full w-[10%] rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" />
                </div>
                <span className="text-cyan-200 tabular-nums">{displayDecode}ms</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-11 text-slate-500">40 t/s</span>
                <div className="h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full w-[94%] rounded-full bg-rose-500/70" />
                </div>
                <span className="text-rose-300 tabular-nums">22.0s</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-rose-400/20 bg-[#050914] p-1.5">
            <div className="flex items-center justify-between font-mono text-[8.5px] text-slate-400 mb-0.5">
              <span>LIVE VIEWERS</span>
              <span className="text-rose-300 font-bold tabular-nums">8.9K ↑</span>
            </div>
            <svg viewBox="0 0 140 38" className="w-full h-[32px]">
              <defs>
                <linearGradient id="viewerGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fb7185" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#fb7185" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <polygon
                points="4,36 4,30 30,26 56,22 84,14 112,8 136,4 136,36"
                fill="url(#viewerGrad)"
              />
              <polyline
                points="4,30 30,26 56,22 84,14 112,8 136,4"
                fill="none"
                stroke="#fb7185"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between font-mono text-[8.5px] text-slate-400 px-0.5">
        <span className="inline-flex items-center gap-1 text-emerald-300">
          <ShieldCheck className="h-3 w-3" />
          Watchdog 500ms · 0 Faults
        </span>
        <span>Missions: {Math.max(1, history.length)}</span>
      </div>
    </div>
  );
}
