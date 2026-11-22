import { useRef, useState } from 'react';
import {
  BarChart3,
  BatteryCharging,
  BookOpen,
  Camera,
  Code2,
  Dog,
  Mic,
  MicOff,
  Search,
  Send,
  Shield,
  Sparkles,
  Square,
  UserCheck,
  Video,
  Zap,
} from 'lucide-react';
import type { MissionPreset } from '@shared/types';

interface CommandDockProps {
  missions: MissionPreset[];
  isThinking: boolean;
  onSendCommand: (command: string, triggerType: 'user' | 'voice') => void;
  onStopCommand: () => void;
  autoReflex: boolean;
  reflexCount: number;
  maxReflexCount: number;
  onToggleAutoReflex: () => void;
}

function renderMissionIcon(icon: string, color: string) {
  const props = { className: 'h-3.5 w-3.5 shrink-0', style: { color } };
  switch (icon) {
    case 'search':
      return <Search {...props} />;
    case 'dog':
      return <Dog {...props} />;
    case 'video':
    case 'tiktok':
      return <Video {...props} />;
    case 'camera':
    case 'instagram':
      return <Camera {...props} />;
    case 'code':
    case 'terminal':
      return <Code2 {...props} />;
    case 'book':
    case 'obsidian':
      return <BookOpen {...props} />;
    case 'chart':
    case 'analytics':
      return <BarChart3 {...props} />;
    case 'sparkles':
    case 'mirror':
      return <Sparkles {...props} />;
    case 'shield':
      return <Shield {...props} />;
    case 'user':
      return <UserCheck {...props} />;
    case 'battery':
      return <BatteryCharging {...props} />;
    default:
      return <Zap {...props} />;
  }
}

export function CommandDock({
  missions,
  isThinking,
  onSendCommand,
  onStopCommand,
  autoReflex,
  reflexCount,
  maxReflexCount,
  onToggleAutoReflex,
}: CommandDockProps) {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = input.trim();
    if (!cleaned || isThinking) return;
    onSendCommand(cleaned, 'user');
    setInput('');
  };

  const toggleVoiceMic = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown })
        .webkitSpeechRecognition;

    if (!SpeechRec) {
      setInput('Sweep the room until you find Biscuit, then film him!');
      return;
    }

    try {
      const rec = new SpeechRec() as {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
      rec.lang = navigator.language?.startsWith('es') ? 'es-ES' : 'en-US';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim();
        if (transcript) {
          setInput(transcript);
          onSendCommand(transcript, 'voice');
        }
      };
      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
      setIsListening(true);
      rec.start();
    } catch {
      setIsListening(false);
    }
  };

  return (
    <div className="panel-surface shrink-0 rounded-xl p-2 space-y-1.5">
      {/* Row 1: 8 Compact One-Click Viral Mission Pills (4x2 tidy grid, zero overflow at 1440x900) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {missions.slice(0, 8).map((mission) => (
          <button
            key={mission.id}
            type="button"
            disabled={isThinking}
            onClick={() => onSendCommand(mission.command, 'user')}
            className="group flex items-center gap-2 rounded-lg border border-slate-400/15 bg-[#080e1c]/90 px-2.5 py-1 text-left transition-all hover:border-amber-400/45 hover:bg-[#0d1629] disabled:cursor-not-allowed disabled:opacity-50 min-w-0"
            title={mission.command}
          >
            {renderMissionIcon(mission.icon, mission.accent || '#f59e0b')}
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-slate-100 group-hover:text-white truncate">
                {mission.title}
              </div>
              <div className="text-[9px] text-slate-400 truncate">{mission.subtitle}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Row 2: Voice Mic (EN/ES) + Command Input + Auto-Reflex Toggle */}
      <form onSubmit={handleSubmit} className="flex flex-wrap sm:flex-nowrap items-center gap-1.5">
        <button
          type="button"
          onClick={toggleVoiceMic}
          disabled={isThinking}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all ${
            isListening
              ? 'border-rose-400/60 bg-rose-500/20 text-rose-200 animate-pulse'
              : 'border-slate-400/20 bg-[#050914] text-slate-300 hover:border-cyan-400/40 hover:text-white'
          }`}
          title="Speak a voice command in English or Spanish"
        >
          {isListening ? (
            <>
              <MicOff className="h-3.5 w-3.5 text-rose-400" />
              <span>Listening...</span>
            </>
          ) : (
            <>
              <Mic className="h-3.5 w-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Voice</span>
            </>
          )}
        </button>

        <div className="relative flex-1 min-w-[180px]">
          <input
            type="text"
            value={input}
            disabled={isThinking}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Command WALL-E in English or Spanish (e.g. 'Start a TikTok Live!' or 'Busca a Biscuit')..."
            className="w-full rounded-lg border border-slate-400/20 bg-[#050914] px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400/60 focus:outline-none disabled:opacity-60"
          />
        </div>

        {isThinking ? (
          <button
            type="button"
            onClick={onStopCommand}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-rose-400/50 bg-rose-500/20 px-3 py-1.5 text-xs font-bold text-rose-200 hover:bg-rose-500/30"
          >
            <Square className="h-3 w-3 fill-current" />
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-300/40 bg-gradient-to-r from-amber-500 to-cyan-500 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-glow-amber transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            <Send className="h-3.5 w-3.5" />
            Command
          </button>
        )}

        <button
          type="button"
          onClick={onToggleAutoReflex}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[10px] font-bold transition-all ${
            autoReflex
              ? 'border-emerald-400/45 bg-emerald-500/15 text-emerald-200 shadow-glow-emerald'
              : 'border-slate-700 bg-slate-900/70 text-slate-400 hover:text-slate-200'
          }`}
          title="When enabled, WALL-E autonomously triggers a Cerebras reflex when obstacles or Biscuit get close (capped at 4)"
        >
          <Zap className={`h-3 w-3 ${autoReflex ? 'text-emerald-400 animate-pulse' : ''}`} />
          <span>
            Auto-Reflex {autoReflex ? `ON (${reflexCount}/${maxReflexCount})` : 'OFF'}
          </span>
        </button>
      </form>
    </div>
  );
}
