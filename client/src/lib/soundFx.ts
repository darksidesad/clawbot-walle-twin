import type { RobotEmotion } from '@shared/types';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor) {
      try {
        audioCtx = new Ctor();
      } catch {
        return null;
      }
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    void audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Plays an expressive frequency-modulated WALL-E / R2 synth chirp via Web Audio API.
 */
export function playRobotChirp(emotion: RobotEmotion, muted: boolean): void {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = emotion === 'alert' ? 'sawtooth' : 'sine';

    if (emotion === 'happy' || emotion === 'excited' || emotion === 'love') {
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(980, now + 0.09);
      osc.frequency.exponentialRampToValueAtTime(760, now + 0.16);
      osc.frequency.exponentialRampToValueAtTime(1240, now + 0.26);
    } else if (emotion === 'curious') {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(860, now + 0.22);
    } else if (emotion === 'alert') {
      osc.frequency.setValueAtTime(680, now);
      osc.frequency.setValueAtTime(480, now + 0.1);
      osc.frequency.setValueAtTime(680, now + 0.2);
    } else if (emotion === 'sleepy') {
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.28);
    } else {
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(740, now + 0.16);
    }

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.29);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  } catch {
    // Ignore audio context restrictions in headless environments
  }
}

/**
 * Plays a cheerful 3-note discovery chime when Biscuit enters WALL-E's real Camera FOV!
 */
export function playDiscoveryChime(muted: boolean): void {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const notes = [659.25, 880, 1318.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t0 = now + idx * 0.085;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.exponentialRampToValueAtTime(0.11, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.19);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.2);
    });
  } catch {
    // Ignore audio context restrictions
  }
}

const SPANISH_CUE_REGEX =
  /[áéíóúñ¿¡]|\b(hola|perro|busca|buscando|vamos|en vivo|gracias|listo|encontr[eé]|misi[oó]n|bater[ií]a|c[oó]digo|agentes|gr[aá]ficas|notas|saludos|amigos|comenzando)\b/i;

/**
 * Speaks WALL-E's line aloud using Web Speech API (auto-detecting Spanish or English).
 * Gracefully no-ops in headless browsers or when muted.
 */
export function speakRobotSpeech(text: string, muted: boolean): void {
  if (muted || !text || typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }

  // Strip asterisks / emoji symbols so speech synthesis sounds clean and natural
  const cleanText = text
    .replace(/\*[^*]+\*/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .trim();
  if (!cleanText) return;

  try {
    const synth = window.speechSynthesis;
    synth.cancel();

    const isSpanish = SPANISH_CUE_REGEX.test(cleanText);
    const targetPrefix = isSpanish ? 'es' : 'en';
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = isSpanish ? 'es-ES' : 'en-US';
    utterance.pitch = 1.12;
    utterance.rate = 1.08;
    utterance.volume = 0.72;

    const voices = synth.getVoices?.() ?? [];
    if (voices.length > 0) {
      const preferred =
        voices.find(
          (v) =>
            v.lang.toLowerCase().startsWith(targetPrefix) &&
            /google|natural|aria|neural|samantha|monica|helena/i.test(v.name)
        ) || voices.find((v) => v.lang.toLowerCase().startsWith(targetPrefix));
      if (preferred) {
        utterance.voice = preferred;
      }
    }

    synth.speak(utterance);
  } catch {
    // Ignore speech synthesis errors in headless/sandboxed contexts
  }
}

export const speakRobotLine = speakRobotSpeech;
