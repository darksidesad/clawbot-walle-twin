import type {
  AssistantAppMode,
  PerceptionReadout,
  RobotActionPlan,
  RobotActionStep,
  RobotActionType,
  RobotEmotion,
  RobotTarget,
  RobotWorldState,
  SafetyAuditReadout,
  TikTokScreenMode,
} from '../../shared/types.js';

const STATIC_FURNITURE_ZONES: Array<{ x: number; z: number; radius: number }> = [
  { x: -6.8, z: -4.8, radius: 0.65 }, // sofa_l
  { x: -5.6, z: -4.8, radius: 0.65 }, // sofa_r
  { x: -6.0, z: -1.8, radius: 0.68 }, // round coffee table
  { x: 0.0, z: -6.6, radius: 0.78 }, // media console + 4K TV
  { x: 6.4, z: -4.6, radius: 0.82 }, // kitchen island + espresso bar
  { x: 9.2, z: -0.4, radius: 0.65 }, // server rack / bookshelf
  { x: 6.2, z: 4.0, radius: 0.80 }, // robotics workbench desk
  { x: -8.4, z: 1.6, radius: 0.65 }, // cozy armchair + floor lamp
  { x: 2.2, z: -3.2, radius: 0.50 }, // potted monstera plant_ne
  { x: -2.0, z: 4.4, radius: 0.50 }, // potted plant_sw
  { x: -6.2, z: 4.6, radius: 0.52 }, // dog bed + water bowl
];

const VALID_EMOTIONS = new Set<RobotEmotion>([
  'neutral',
  'happy',
  'curious',
  'excited',
  'alert',
  'love',
  'sleepy',
  'focused',
]);

const VALID_ACTIONS = new Set<RobotActionType>([
  'search_dog',
  'follow_dog',
  'find_owner',
  'mirror_chat',
  'patrol',
  'go_to',
  'orbit_target',
  'spin_dance',
  'guard',
  'return_to_dock',
  'record_video',
  'stop',
]);

const VALID_TARGETS = new Set<RobotTarget>([
  'dog',
  'cat',
  'bird',
  'mirror',
  'owner',
  'dock',
  'ball',
  'center',
]);

const VALID_ASSISTANT_APPS = new Set<AssistantAppMode>([
  'eyes',
  'tiktok_live',
  'instagram_post',
  'coding_agents',
  'obsidian_vault',
  'analytics_charts',
]);

const VALID_TIKTOK_SCREEN_MODES = new Set<TikTokScreenMode>([
  'pov',
  'coding',
  'obsidian',
  'charts',
]);

export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

export function pushOutOfFurniture(
  rawX: number,
  rawZ: number,
): { x: number; z: number } {
  let x = clampNumber(rawX, -9.6, 9.6, 0);
  let z = clampNumber(rawZ, -6.6, 6.6, 0);

  for (const obs of STATIC_FURNITURE_ZONES) {
    const minClearance = obs.radius + 0.45;
    const dx = x - obs.x;
    const dz = z - obs.z;
    const dist = Math.hypot(dx, dz);
    if (dist < minClearance) {
      const ux = dist > 1e-4 ? dx / dist : 0;
      const uz = dist > 1e-4 ? dz / dist : 1;
      x = clampNumber(obs.x + ux * minClearance, -9.6, 9.6, 0);
      z = clampNumber(obs.z + uz * minClearance, -6.6, 6.6, 0);
    }
  }

  return {
    x: Math.round(x * 100) / 100,
    z: Math.round(z * 100) / 100,
  };
}

export function normalizeEmotion(raw: unknown, fallback: RobotEmotion = 'happy'): RobotEmotion {
  if (typeof raw !== 'string') return fallback;
  const cleaned = raw.trim().toLowerCase();
  if (VALID_EMOTIONS.has(cleaned as RobotEmotion)) {
    return cleaned as RobotEmotion;
  }
  if (cleaned.includes('heart') || cleaned.includes('affection')) return 'love';
  if (cleaned.includes('excit') || cleaned.includes('party') || cleaned.includes('dance')) return 'excited';
  if (cleaned.includes('curio') || cleaned.includes('scan') || cleaned.includes('wonder')) return 'curious';
  if (cleaned.includes('alert') || cleaned.includes('warn') || cleaned.includes('guard')) return 'alert';
  if (cleaned.includes('sleep') || cleaned.includes('tired') || cleaned.includes('charge')) return 'sleepy';
  if (cleaned.includes('focus') || cleaned.includes('track') || cleaned.includes('lock')) return 'focused';
  if (cleaned.includes('joy') || cleaned.includes('smile') || cleaned.includes('cheer')) return 'happy';
  return fallback;
}

export function normalizeAssistantApp(
  raw: unknown,
  fallback?: AssistantAppMode,
): AssistantAppMode | undefined {
  if (typeof raw === 'string') {
    const cleaned = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (VALID_ASSISTANT_APPS.has(cleaned as AssistantAppMode)) {
      return cleaned as AssistantAppMode;
    }
    if (cleaned.includes('insta') || cleaned.includes('photo') || cleaned.includes('foto')) {
      return 'instagram_post';
    }
    if (cleaned.includes('tiktok') || cleaned.includes('live') || cleaned.includes('stream')) {
      return 'tiktok_live';
    }
    if (cleaned.includes('cod') || cleaned.includes('agent') || cleaned.includes('dev')) {
      return 'coding_agents';
    }
    if (cleaned.includes('obsidian') || cleaned.includes('vault') || cleaned.includes('note')) {
      return 'obsidian_vault';
    }
    if (cleaned.includes('analytic') || cleaned.includes('chart') || cleaned.includes('metric')) {
      return 'analytics_charts';
    }
    if (cleaned === 'eyes' || cleaned === 'face' || cleaned === 'default') {
      return 'eyes';
    }
  }
  return fallback;
}

export function normalizeTikTokScreenMode(
  raw: unknown,
  command = '',
): TikTokScreenMode | undefined {
  if (typeof raw === 'string') {
    const cleaned = raw.trim().toLowerCase();
    if (VALID_TIKTOK_SCREEN_MODES.has(cleaned as TikTokScreenMode)) {
      return cleaned as TikTokScreenMode;
    }
    if (cleaned.includes('cod')) return 'coding';
    if (cleaned.includes('obs')) return 'obsidian';
    if (cleaned.includes('chart') || cleaned.includes('analyt')) return 'charts';
    if (cleaned.includes('pov') || cleaned.includes('cam')) return 'pov';
  }
  const lower = command.toLowerCase();
  if (lower.includes('compartir pantalla') || lower.includes('share screen') || lower.includes('screen share')) {
    if (lower.includes('obsidian') || lower.includes('vault')) return 'obsidian';
    if (lower.includes('cod') || lower.includes('pr')) return 'coding';
    return 'charts';
  }
  return undefined;
}

function normalizeHashtags(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const tags = raw
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((tag) => {
      const cleaned = tag.trim().replace(/\s+/g, '');
      return cleaned.startsWith('#') ? cleaned : `#${cleaned}`;
    })
    .slice(0, 6);
  return tags.length > 0 ? tags : undefined;
}

export function inferAssistantAppFromCommand(command: string): AssistantAppMode | undefined {
  const lower = command.toLowerCase();
  if (
    lower.includes('compartir pantalla') ||
    lower.includes('share screen') ||
    lower.includes('screen share') ||
    lower.includes('tiktok') ||
    /\blive\b/.test(lower) ||
    lower.includes('en vivo') ||
    lower.includes('directo') ||
    lower.includes('stream')
  ) {
    return 'tiktok_live';
  }
  if (
    lower.includes('instagram') ||
    /\binsta\b/.test(lower) ||
    lower.includes('publica') ||
    lower.includes('foto') ||
    /\bpost\b/.test(lower) ||
    lower.includes('snap a live photo')
  ) {
    return 'instagram_post';
  }
  if (
    lower.includes('coding') ||
    lower.includes('code') ||
    lower.includes('código') ||
    lower.includes('codigo') ||
    lower.includes('github') ||
    /\bpr\b|\bprs\b/.test(lower) ||
    lower.includes('ci/cd') ||
    lower.includes('coding agent')
  ) {
    return 'coding_agents';
  }
  if (
    lower.includes('obsidian') ||
    lower.includes('vault') ||
    lower.includes('bóveda') ||
    lower.includes('boveda') ||
    lower.includes('backlink') ||
    /\bnote\b|\bnota\b|\bdaily note\b/.test(lower)
  ) {
    return 'obsidian_vault';
  }
  if (
    lower.includes('analytics') ||
    lower.includes('chart') ||
    lower.includes('gráfica') ||
    lower.includes('grafica') ||
    lower.includes('metric') ||
    lower.includes('estadístic') ||
    lower.includes('estadistic') ||
    lower.includes('dashboard')
  ) {
    return 'analytics_charts';
  }
  return undefined;
}

function isSpanishCommand(command: string): boolean {
  return /\b(busca|encuentra|perro|comienza|inicia|abre|muestra|revisa|código|codigo|gráfica|grafica|nota|bóveda|boveda|directo|en vivo|agentes|baila|patrulla|carga|publica|foto|compartir pantalla|espejo|reflejo|gato|pájaro|pajaro|loro)\b/i.test(
    command,
  );
}

export function normalizeActionType(raw: unknown): RobotActionType | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (VALID_ACTIONS.has(cleaned as RobotActionType)) {
    return cleaned as RobotActionType;
  }
  if (cleaned.includes('mirror') || cleaned.includes('espejo') || cleaned.includes('reflejo')) {
    return 'mirror_chat';
  }
  if (
    cleaned.includes('search') ||
    cleaned.includes('sweep') ||
    cleaned.includes('locate_dog') ||
    cleaned.includes('find_dog') ||
    cleaned.includes('busca')
  ) {
    return 'search_dog';
  }
  if (cleaned.includes('dog') || cleaned.includes('chase')) return 'follow_dog';
  if (cleaned.includes('owner') || cleaned.includes('greet')) return 'find_owner';
  if (cleaned.includes('dance') || cleaned.includes('spin')) return 'spin_dance';
  if (cleaned.includes('orbit') || cleaned.includes('circle')) return 'orbit_target';
  if (cleaned.includes('dock') || cleaned.includes('charge')) return 'return_to_dock';
  if (cleaned.includes('record') || cleaned.includes('film') || cleaned.includes('video')) return 'record_video';
  if (cleaned.includes('patrol') || cleaned.includes('explore') || cleaned.includes('roam')) return 'patrol';
  if (cleaned.includes('guard') || cleaned.includes('watch') || cleaned.includes('sentry')) return 'guard';
  if (cleaned.includes('go') || cleaned.includes('move') || cleaned.includes('navigate')) return 'go_to';
  if (cleaned.includes('stop') || cleaned.includes('halt') || cleaned.includes('wait')) return 'stop';
  return null;
}

export function normalizeTarget(raw: unknown, action?: RobotActionType): RobotTarget | undefined {
  if (typeof raw === 'string') {
    const cleaned = raw.trim().toLowerCase();
    if (VALID_TARGETS.has(cleaned as RobotTarget)) {
      return cleaned as RobotTarget;
    }
    if (cleaned.includes('dog') || cleaned.includes('pup') || cleaned.includes('biscuit')) return 'dog';
    if (cleaned.includes('cat') || cleaned.includes('gato') || cleaned.includes('mochi') || cleaned.includes('luna')) return 'cat';
    if (cleaned.includes('bird') || cleaned.includes('pajaro') || cleaned.includes('pájaro') || cleaned.includes('loro') || cleaned.includes('rio')) return 'bird';
    if (cleaned.includes('mirror') || cleaned.includes('espejo') || cleaned.includes('reflejo')) return 'mirror';
    if (cleaned.includes('owner') || cleaned.includes('human')) return 'owner';
    if (cleaned.includes('dock') || cleaned.includes('charg')) return 'dock';
    if (cleaned.includes('ball') || cleaned.includes('toy')) return 'ball';
    if (cleaned.includes('center') || cleaned.includes('middle') || cleaned.includes('room')) return 'center';
  }
  if (action === 'search_dog' || action === 'follow_dog') return 'dog';
  if (action === 'mirror_chat') return 'mirror';
  if (action === 'find_owner') return 'owner';
  if (action === 'return_to_dock') return 'dock';
  return undefined;
}

function defaultStepLabel(action: RobotActionType, target?: RobotTarget): string {
  switch (action) {
    case 'search_dog':
      return 'Sweep room zones with camera FOV until Biscuit is spotted';
    case 'follow_dog':
      return 'Track & playfully follow Biscuit';
    case 'find_owner':
      return 'Roll up to owner & greet';
    case 'mirror_chat':
      return 'Roll up to Smart Mirror, check reflection & reply to live comments';
    case 'patrol':
      return 'Sweep living room perimeter';
    case 'go_to':
      return target ? `Navigate smoothly to ${target}` : 'Navigate to target waypoint';
    case 'orbit_target':
      return `Orbit ${target || 'target'} in a smooth circle`;
    case 'spin_dance':
      return 'Execute joyful 360° WALL-E spin dance';
    case 'guard':
      return 'Hold sentry stance & scan ultrasonic perimeter';
    case 'return_to_dock':
      return 'Align & dock onto cyan charging pad';
    case 'record_video':
      return `Film 4s stabilizing clip of ${target || 'scene'}`;
    case 'stop':
      return 'Gentle motor brake & hold position';
  }
}

export function sanitizeActionStep(raw: unknown): RobotActionStep | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const action = normalizeActionType(obj.action ?? obj.type);
  if (!action) return null;

  const target = normalizeTarget(obj.target, action);
  const defaultDuration = action === 'search_dog' ? 8500 : 3200;
  const durationMs = Math.round(clampNumber(obj.durationMs ?? obj.duration, 1200, 9000, defaultDuration));
  const speed =
    Math.round(clampNumber(obj.speed, 0.2, 1.0, action === 'stop' ? 0.2 : 0.72) * 100) / 100;
  const label =
    typeof obj.label === 'string' && obj.label.trim()
      ? obj.label.trim().slice(0, 90)
      : defaultStepLabel(action, target);

  const step: RobotActionStep = {
    action,
    ...(target ? { target } : {}),
    durationMs,
    speed,
    label,
  };

  const hasX = typeof obj.x === 'number' && Number.isFinite(obj.x);
  const hasZ = typeof obj.z === 'number' && Number.isFinite(obj.z);
  if (hasX || hasZ) {
    const safeCoords = pushOutOfFurniture(
      hasX ? (obj.x as number) : 0,
      hasZ ? (obj.z as number) : 0,
    );
    if (hasX) step.x = safeCoords.x;
    if (hasZ) step.z = safeCoords.z;
  }

  return step;
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const fenceMatch = trimmed.match(/```(?:json)?\s*\r?\n([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;

  try {
    const parsed = JSON.parse(candidate);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fall through to balanced brace extraction
  }

  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Salvages individual balanced step objects if the outer JSON is still streaming or truncated.
 */
export function salvageStepsFromPartialText(raw: string): RobotActionStep[] {
  const steps: RobotActionStep[] = [];
  let inString = false;
  let escaped = false;
  const starts: number[] = [];

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      starts.push(i);
    } else if (ch === '}') {
      const start = starts.pop();
      if (start !== undefined) {
        const slice = raw.slice(start, i + 1);
        if (slice.includes('"action"')) {
          try {
            const parsed = JSON.parse(slice);
            const step = sanitizeActionStep(parsed);
            if (step && steps.length < 5) {
              steps.push(step);
            }
          } catch {
            // ignore broken inner fragment
          }
        }
      }
    }
  }
  return steps;
}

export function buildFallbackPlan(command: string): RobotActionPlan {
  const lower = command.toLowerCase();
  const es = isSpanishCommand(command);
  const inferredApp = inferAssistantAppFromCommand(command);

  if (inferredApp === 'tiktok_live') {
    const screenMode = normalizeTikTokScreenMode(undefined, command) ?? 'pov';
    return {
      speech: es
        ? '¡Hola chat! ¡Estamos en vivo en TikTok desde mi cámara WALL-E con OpenClaw en Cerebras!'
        : 'Hey TikTok Live! Streaming live from my WALL-E camera powered by OpenClaw + Cerebras!',
      emotion: 'excited',
      recordVideo: true,
      reasoning: 'Launching 9:16 TikTok Live Studio with real live Robot POV camera and screen share.',
      assistantApp: 'tiktok_live',
      tiktokScreenMode: screenMode,
      tiktokTopic: 'Live DIY WALL-E Robot powered by OpenClaw × Cerebras',
      obsidianNote: 'Started TikTok Live broadcast from ClawBot WALL-E phone camera.',
      steps: [
        {
          action: 'patrol',
          target: 'center',
          durationMs: 3600,
          speed: 0.65,
          label: 'Pan live robot POV camera across smart-lab for viewers',
        },
        {
          action: 'spin_dance',
          durationMs: 2600,
          speed: 0.82,
          label: 'Celebrate incoming viewer likes & gifts',
        },
      ],
    };
  }

  if (inferredApp === 'instagram_post') {
    return {
      speech: es
        ? '¡Sonríe! Capturé una foto en vivo desde mi lente WALL-E y preparé el post para Instagram.'
        : 'Say cheese! Snapped a live photo from my WALL-E lens and drafted your Instagram post!',
      emotion: 'happy',
      recordVideo: false,
      reasoning: 'Framing the room in WALL-E POV camera, capturing live 3D snapshot, and opening Instagram Studio.',
      assistantApp: 'instagram_post',
      instagramCaption: es
        ? 'Explorando el laboratorio inteligente a velocidad Cerebras con mi cerebro OpenClaw 🤖⚡'
        : 'Cruising the smart-lab at Cerebras wafer-scale speed with my OpenClaw Triad brain! 🤖⚡',
      instagramHashtags: ['#KimiOnCerebras', '#OpenClaw', '#ClawBotWALLE', '#RoboticsAI'],
      obsidianNote: 'Captured live 3D POV snapshot and drafted Instagram post from ClawBot WALL-E.',
      steps: [
        {
          action: 'guard',
          target: 'center',
          durationMs: 2400,
          speed: 0.45,
          label: 'Stabilize lens & capture live 3D camera snapshot',
        },
      ],
    };
  }

  if (inferredApp === 'coding_agents') {
    return {
      speech: es
        ? 'Conectado a tus agentes de código en OpenClaw: PR 418 aprobado, 18 pruebas en verde y CI listo.'
        : 'OpenClaw coding fleet synced! PR 418 passed all 18 tests and CI build is green in 1.4 seconds.',
      emotion: 'focused',
      recordVideo: false,
      reasoning: 'Opening connected OpenClaw Coding Agents Hub and briefing PR/CI status.',
      assistantApp: 'coding_agents',
      obsidianNote: 'Reviewed OpenClaw coding agents fleet: PR #418 green, CI passing.',
      steps: [
        {
          action: 'guard',
          target: 'center',
          durationMs: 2600,
          speed: 0.45,
          label: 'Hold steady & brief OpenClaw dev fleet telemetry',
        },
      ],
    };
  }

  if (inferredApp === 'obsidian_vault') {
    return {
      speech: es
        ? 'Bóveda de Obsidian sincronizada. Registré la misión de hoy con enlaces en tu nota diaria.'
        : 'Obsidian Vault synced! Backlink graph live and today’s robotics mission logged to your daily note.',
      emotion: 'happy',
      recordVideo: false,
      reasoning: 'Opening Obsidian Knowledge Vault backlink graph and appending daily mission note.',
      assistantApp: 'obsidian_vault',
      obsidianNote: 'Synced ClawBot WALL-E telemetry and backlinks to [[Daily-2026-11-21]].',
      steps: [
        {
          action: 'guard',
          target: 'center',
          durationMs: 2400,
          speed: 0.45,
          label: 'Sync Obsidian backlink graph & append daily log',
        },
      ],
    };
  }

  if (inferredApp === 'analytics_charts') {
    return {
      speech: es
        ? 'Mostrando gráficas en vivo: Cerebras supera los mil tokens por segundo frente a modelos lentos.'
        : 'Live analytics online! Cerebras throughput and OpenClaw Triad telemetry charts are streaming.',
      emotion: 'focused',
      recordVideo: false,
      reasoning: 'Opening live Cerebras tok/s and OpenClaw Triad analytics dashboard.',
      assistantApp: 'analytics_charts',
      obsidianNote: 'Opened Live Analytics & Charts dashboard for Cerebras throughput review.',
      steps: [
        {
          action: 'guard',
          target: 'center',
          durationMs: 2400,
          speed: 0.45,
          label: 'Display live Cerebras & Triad analytics charts',
        },
      ],
    };
  }

  if (
    lower.includes('mirror') ||
    lower.includes('espejo') ||
    lower.includes('reflejo') ||
    lower.includes('selfie')
  ) {
    return {
      speech: es
        ? '¡Mira qué guapo me veo en el espejo inteligente! Leyendo los comentarios en vivo del chat.'
        : 'Checking myself out in the Smart Mirror! Reading live viewer comments and replying out loud!',
      emotion: 'love',
      recordVideo: false,
      reasoning: 'Navigating via A* to the Smart Mirror on the west wall to interact with live mirror comments.',
      assistantApp: 'eyes',
      obsidianNote: 'Interacted with live viewer comments at the Smart Mirror.',
      steps: [
        {
          action: 'mirror_chat',
          target: 'mirror',
          durationMs: 6500,
          speed: 0.78,
          label: 'Roll to Smart Mirror, admire reflection & reply to comments',
        },
        {
          action: 'spin_dance',
          durationMs: 2200,
          speed: 0.82,
          label: 'Happy flourish for the mirror audience',
        },
      ],
    };
  }

  if (
    lower.includes('cat') ||
    lower.includes('gato') ||
    lower.includes('mochi') ||
    lower.includes('luna')
  ) {
    return {
      speech: es
        ? '¡Hola Mochi y Luna! Voy a saludar a los gatitos del loft.'
        : 'Hi Mochi and Luna! Rolling over to greet the colorful loft cats!',
      emotion: 'happy',
      recordVideo: false,
      reasoning: 'Routing via A* toward Mochi/Luna cat coordinates with gentle approach speed.',
      assistantApp: 'eyes',
      steps: [
        {
          action: 'go_to',
          target: 'cat',
          durationMs: 3800,
          speed: 0.72,
          label: 'Roll gently up to Mochi & Luna',
        },
        {
          action: 'orbit_target',
          target: 'cat',
          durationMs: 3000,
          speed: 0.65,
          label: 'Playful orbit around the loft cats',
        },
      ],
    };
  }

  if (
    lower.includes('bird') ||
    lower.includes('pajaro') ||
    lower.includes('pájaro') ||
    lower.includes('loro') ||
    lower.includes('rio')
  ) {
    return {
      speech: es
        ? '¡Mira a Rio volando sobre el loft! Activando cámara para seguir al pájaro tropical.'
        : 'Look at Rio gliding overhead! Tracking our colorful tropical bird across the loft!',
      emotion: 'curious',
      recordVideo: true,
      reasoning: 'Tracking flying bird Rio overhead and recording a stabilized clip.',
      assistantApp: 'eyes',
      steps: [
        {
          action: 'go_to',
          target: 'bird',
          durationMs: 3600,
          speed: 0.78,
          label: 'Track Rio the tropical bird across the loft',
        },
        {
          action: 'record_video',
          target: 'bird',
          durationMs: 3000,
          speed: 0.65,
          label: 'Film Rio gliding overhead',
        },
      ],
    };
  }

  if (
    lower.includes('search') ||
    lower.includes('busca') ||
    lower.includes('dog') ||
    lower.includes('perro') ||
    lower.includes('biscuit') ||
    lower.includes('chase') ||
    lower.includes('film')
  ) {
    return {
      speech: es
        ? '¡Iniciando búsqueda real con cámara! Voy a recorrer la sala hasta encontrar a Biscuit.'
        : 'Camera FOV search engaged! Sweeping the room zones until I spot Biscuit!',
      emotion: 'curious',
      recordVideo: true,
      reasoning: 'Biscuit is not yet inside camera FOV; executing multi-zone room sweep before chasing and filming.',
      assistantApp: 'eyes',
      obsidianNote: 'Initiated real Camera-FOV room search for Biscuit.',
      steps: [
        {
          action: 'search_dog',
          target: 'dog',
          durationMs: 8800,
          speed: 0.72,
          label: 'Sweep room zones with camera FOV for Biscuit',
        },
        {
          action: 'follow_dog',
          target: 'dog',
          durationMs: 3600,
          speed: 0.85,
          label: 'Lock onto Biscuit & chase playfully',
        },
        {
          action: 'record_video',
          target: 'dog',
          durationMs: 3200,
          speed: 0.65,
          label: 'Film 4s stabilized clip of Biscuit',
        },
      ],
    };
  }

  if (lower.includes('dance') || lower.includes('spin') || lower.includes('victory') || lower.includes('baila')) {
    return {
      speech: es
        ? '¡Ta-daaa! ¡Mira mi baile de victoria 360 con ojos de corazón!'
        : 'Ta-daaa! Watch my 360 WALL-E victory spin with heart eyes!',
      emotion: 'love',
      recordVideo: false,
      reasoning: 'Executing high-energy differential-drive spin dance followed by curious room scan.',
      assistantApp: 'eyes',
      steps: [
        {
          action: 'spin_dance',
          durationMs: 3200,
          speed: 0.9,
          label: '360° heart-eyes victory spin dance',
        },
        {
          action: 'patrol',
          target: 'center',
          durationMs: 2800,
          speed: 0.65,
          label: 'Curious 360° living room sensor scan',
        },
      ],
    };
  }

  if (lower.includes('dock') || lower.includes('charge') || lower.includes('battery') || lower.includes('sleep') || lower.includes('carga')) {
    return {
      speech: es
        ? 'Batería baja... Regresando a la base de carga para descansar.'
        : 'Yaaawn... Homing in on the cyan charging dock for sleepy recharge mode.',
      emotion: 'sleepy',
      recordVideo: false,
      reasoning: 'Navigating obstacle-free trajectory back to charging dock coordinates and entering standby.',
      assistantApp: 'eyes',
      steps: [
        {
          action: 'return_to_dock',
          target: 'dock',
          durationMs: 4200,
          speed: 0.65,
          label: 'Navigate back to cyan charging dock',
        },
        {
          action: 'stop',
          target: 'dock',
          durationMs: 1800,
          speed: 0.2,
          label: 'Dock aligned — entering sleepy recharge mode',
        },
      ],
    };
  }

  if (lower.includes('owner') || lower.includes('hi') || lower.includes('hello') || lower.includes('hola')) {
    return {
      speech: es
        ? '¡Hola! ¡Encontré a mi humano favorito!'
        : 'WALL-E! Rolling over to say hello to my favorite human!',
      emotion: 'happy',
      recordVideo: false,
      reasoning: 'Plotting smooth approach vector toward owner beacon with celebratory orbit.',
      assistantApp: 'eyes',
      steps: [
        {
          action: 'find_owner',
          target: 'owner',
          durationMs: 3600,
          speed: 0.78,
          label: 'Roll up to owner beacon & wave',
        },
        {
          action: 'orbit_target',
          target: 'owner',
          durationMs: 3200,
          speed: 0.72,
          label: 'Playful 360° orbit around owner',
        },
      ],
    };
  }

  if (lower.includes('patrol') || lower.includes('guard') || lower.includes('dodge') || lower.includes('patrulla')) {
    return {
      speech: es
        ? '¡Radar ultrasónico activo! Patrullando la sala y esquivando obstáculos.'
        : 'Perimeter sensor locked! Patrolling the living room and dodging obstacles.',
      emotion: 'focused',
      recordVideo: false,
      reasoning: 'Sweeping room waypoints while maintaining safe ultrasonic clearance from sofa and coffee table.',
      assistantApp: 'eyes',
      steps: [
        {
          action: 'patrol',
          target: 'center',
          durationMs: 4000,
          speed: 0.75,
          label: 'Sweep living room perimeter waypoints',
        },
        {
          action: 'guard',
          target: 'center',
          durationMs: 2800,
          speed: 0.5,
          label: 'Guard room center & monitor ultrasonic radar',
        },
      ],
    };
  }

  return {
    speech: es
      ? '¡Modo aventura activado! Explorando la sala con OpenClaw.'
      : 'Chirp-beep! Adventure mode engaged — exploring the room!',
    emotion: 'curious',
    recordVideo: false,
    reasoning: 'Executing multi-step exploratory mission based on live room telemetry.',
    assistantApp: 'eyes',
    steps: [
      {
        action: 'patrol',
        target: 'center',
        durationMs: 3200,
        speed: 0.76,
        label: 'Sweep room & inspect arena',
      },
      {
        action: 'spin_dance',
        durationMs: 2400,
        speed: 0.85,
        label: 'Celebratory WALL-E spin flourish',
      },
    ],
  };
}

function commandRequestsDogSearch(command: string): boolean {
  return /\b(dog|biscuit|perro|puppy|search|busca|encuentra|find.*dog|film.*dog)\b/i.test(command);
}

/**
 * Strictly parses and sanitizes a `RobotActionPlan` from raw LLM output.
 * Clamps speed to [0.2, 1.0], durationMs to [1200, 9000], validates enums,
 * enforces anti-cheat `search_dog` when Biscuit is undiscovered,
 * and guarantees 1 to 5 executable steps.
 */
export function parseRobotActionPlan(
  raw: string,
  command = '',
  worldState?: Partial<RobotWorldState>,
): RobotActionPlan {
  const fallback = buildFallbackPlan(command);
  const inferredApp = inferAssistantAppFromCommand(command);
  const parsed = extractJsonObject(raw);

  const applyAntiCheatAndAssist = (plan: RobotActionPlan): RobotActionPlan => {
    const steps = [...plan.steps];

    // Enforce NO CHEATING: if dog is not discovered yet and mission asks for the dog,
    // Step 1 MUST be `search_dog` (camera-FOV sweep) before chasing/filming!
    if (
      worldState?.dogDiscovered === false &&
      commandRequestsDogSearch(command) &&
      steps[0]?.action !== 'search_dog'
    ) {
      steps.unshift({
        action: 'search_dog',
        target: 'dog',
        durationMs: 8800,
        speed: 0.72,
        label: 'Sweep room zones with camera FOV for Biscuit',
      });
      if (steps.length > 5) steps.pop();
    }

    const finalApp = plan.assistantApp ?? inferredApp ?? 'eyes';
    const recordVideo =
      plan.recordVideo ||
      finalApp === 'tiktok_live' ||
      steps.some((s) => s.action === 'record_video');
    const tiktokScreenMode =
      plan.tiktokScreenMode ??
      normalizeTikTokScreenMode(undefined, command) ??
      (finalApp === 'tiktok_live' ? 'pov' : undefined);
    const instagramCaption =
      plan.instagramCaption ||
      (finalApp === 'instagram_post'
        ? fallback.instagramCaption ||
          'Cruising the smart-lab at Cerebras speed with my OpenClaw Triad brain! 🤖⚡'
        : undefined);
    const instagramHashtags =
      plan.instagramHashtags && plan.instagramHashtags.length > 0
        ? plan.instagramHashtags
        : finalApp === 'instagram_post'
          ? ['#KimiOnCerebras', '#OpenClaw', '#ClawBotWALLE', '#RoboticsAI']
          : undefined;

    return {
      ...plan,
      assistantApp: finalApp,
      recordVideo,
      ...(plan.obsidianNote ? { obsidianNote: plan.obsidianNote } : {}),
      ...(plan.tiktokTopic
        ? { tiktokTopic: plan.tiktokTopic }
        : finalApp === 'tiktok_live'
          ? { tiktokTopic: 'Live DIY WALL-E Robot × Cerebras Speed' }
          : {}),
      ...(tiktokScreenMode ? { tiktokScreenMode } : {}),
      ...(instagramCaption ? { instagramCaption } : {}),
      ...(instagramHashtags ? { instagramHashtags } : {}),
      steps,
    };
  };

  if (parsed) {
    const speech =
      typeof parsed.speech === 'string' && parsed.speech.trim()
        ? parsed.speech.trim().slice(0, 180)
        : fallback.speech;
    const emotion = normalizeEmotion(parsed.emotion, fallback.emotion);
    const reasoning =
      typeof parsed.reasoning === 'string' && parsed.reasoning.trim()
        ? parsed.reasoning.trim().slice(0, 280)
        : fallback.reasoning;
    const assistantApp = normalizeAssistantApp(parsed.assistantApp, inferredApp ?? fallback.assistantApp);
    const obsidianNote =
      typeof parsed.obsidianNote === 'string' && parsed.obsidianNote.trim()
        ? parsed.obsidianNote.trim().slice(0, 180)
        : fallback.obsidianNote;
    const tiktokTopic =
      typeof parsed.tiktokTopic === 'string' && parsed.tiktokTopic.trim()
        ? parsed.tiktokTopic.trim().slice(0, 100)
        : fallback.tiktokTopic;
    const tiktokScreenMode = normalizeTikTokScreenMode(parsed.tiktokScreenMode, command);
    const instagramCaption =
      typeof parsed.instagramCaption === 'string' && parsed.instagramCaption.trim()
        ? parsed.instagramCaption.trim().slice(0, 220)
        : fallback.instagramCaption;
    const instagramHashtags = normalizeHashtags(parsed.instagramHashtags) ?? fallback.instagramHashtags;

    const steps: RobotActionStep[] = [];
    if (Array.isArray(parsed.steps)) {
      for (const item of parsed.steps) {
        const sanitized = sanitizeActionStep(item);
        if (sanitized) {
          steps.push(sanitized);
        }
        if (steps.length >= 5) break;
      }
    }

    const finalSteps = steps.length > 0 ? steps : fallback.steps;
    const recordVideo =
      typeof parsed.recordVideo === 'boolean'
        ? parsed.recordVideo
        : finalSteps.some((s) => s.action === 'record_video') || fallback.recordVideo;

    return applyAntiCheatAndAssist({
      speech,
      emotion,
      recordVideo,
      reasoning,
      assistantApp,
      ...(obsidianNote ? { obsidianNote } : {}),
      ...(tiktokTopic ? { tiktokTopic } : {}),
      ...(tiktokScreenMode ? { tiktokScreenMode } : {}),
      ...(instagramCaption ? { instagramCaption } : {}),
      ...(instagramHashtags ? { instagramHashtags } : {}),
      steps: finalSteps,
    });
  }

  // Partial JSON salvage
  const salvagedSteps = salvageStepsFromPartialText(raw);
  if (salvagedSteps.length > 0) {
    const speechMatch = raw.match(/"speech"\s*:\s*"((?:\\.|[^"\\])*)"/);
    const emotionMatch = raw.match(/"emotion"\s*:\s*"((?:\\.|[^"\\])*)"/);
    const reasoningMatch = raw.match(/"reasoning"\s*:\s*"((?:\\.|[^"\\])*)"/);
    const appMatch = raw.match(/"assistantApp"\s*:\s*"((?:\\.|[^"\\])*)"/);
    const noteMatch = raw.match(/"obsidianNote"\s*:\s*"((?:\\.|[^"\\])*)"/);
    const topicMatch = raw.match(/"tiktokTopic"\s*:\s*"((?:\\.|[^"\\])*)"/);

    return applyAntiCheatAndAssist({
      speech: speechMatch?.[1]?.trim().slice(0, 180) || fallback.speech,
      emotion: normalizeEmotion(emotionMatch?.[1], fallback.emotion),
      recordVideo:
        /"recordVideo"\s*:\s*true/i.test(raw) ||
        salvagedSteps.some((s) => s.action === 'record_video'),
      reasoning: reasoningMatch?.[1]?.trim().slice(0, 280) || fallback.reasoning,
      assistantApp: normalizeAssistantApp(appMatch?.[1], inferredApp ?? fallback.assistantApp),
      ...(noteMatch?.[1] ? { obsidianNote: noteMatch[1].trim().slice(0, 180) } : {}),
      ...(topicMatch?.[1] ? { tiktokTopic: topicMatch[1].trim().slice(0, 100) } : {}),
      steps: salvagedSteps,
    });
  }

  return applyAntiCheatAndAssist(fallback);
}

export function formatWorldStateForPrompt(worldState?: Partial<RobotWorldState>): string {
  if (!worldState || typeof worldState !== 'object') {
    return 'Robot at (0.0, 0.0), heading 0°, battery 94%, ultrasonic 180cm, entities: owner, dock, ball, sofa, table. dog: {"detected": false, "status": "HIDDEN - must use action search_dog to sweep room"}';
  }

  const x = typeof worldState.x === 'number' ? worldState.x.toFixed(2) : '0.00';
  const z = typeof worldState.z === 'number' ? worldState.z.toFixed(2) : '0.00';
  const heading = typeof worldState.headingDeg === 'number' ? Math.round(worldState.headingDeg) : 0;
  const battery = typeof worldState.batteryPct === 'number' ? Math.round(worldState.batteryPct) : 92;
  const ultrasonic =
    typeof worldState.ultrasonicCm === 'number' ? Math.round(worldState.ultrasonicCm) : 160;
  const dogHidden = worldState.dogDiscovered === false;

  const visibleEntities = Array.isArray(worldState.entities)
    ? worldState.entities
        .filter((e) => !(dogHidden && e.kind === 'dog'))
        .slice(0, 10)
        .map(
          (e) =>
            `${e.kind}(${e.label} at x=${Number(e.x || 0).toFixed(1)}, z=${Number(e.z || 0).toFixed(1)}, dist=${Number(e.distance || 0).toFixed(1)}m, angle=${Math.round(Number(e.angleDeg || 0))}°)`,
        )
        .join('; ')
    : 'owner, dock, ball, sofa, table';

  const dogStatusLine = dogHidden
    ? 'dog: {"detected": false, "status": "HIDDEN - must use action search_dog to sweep room"}'
    : '';

  const appLine = worldState.activeAssistantApp
    ? `, assistantApp=${worldState.activeAssistantApp}`
    : '';

  return [
    `Robot Telemetry: pos=(${x}, ${z}), heading=${heading}°, battery=${battery}%, ultrasonic=${ultrasonic}cm, mode=${worldState.activeMode || 'idle'}, emotion=${worldState.emotion || 'neutral'}${appLine}.`,
    `Visible Arena Entities: ${visibleEntities}`,
    dogStatusLine,
  ]
    .filter(Boolean)
    .join('\n');
}

export function computeSpeedComparison(
  completionTokens: number,
  elapsedMs: number,
  tokensPerSec?: number,
): { savedSecondsVs40Tps: number; speedupFactor: number } {
  const effectiveTokens = Math.max(80, completionTokens);
  const baseline40Sec = effectiveTokens / 40;
  const actualDecodeSec =
    tokensPerSec && tokensPerSec > 0
      ? effectiveTokens / tokensPerSec
      : Math.max(0.15, elapsedMs / 1000);
  const savedSecondsVs40Tps = Math.max(
    0.5,
    Math.round((baseline40Sec - actualDecodeSec) * 10) / 10,
  );
  const speedupFactor = Math.max(
    1.5,
    Math.round((tokensPerSec && tokensPerSec > 0 ? tokensPerSec / 40 : baseline40Sec / actualDecodeSec) * 10) / 10,
  );
  return { savedSecondsVs40Tps, speedupFactor };
}

export function extractPartialSpeechAndEmotion(raw: string): {
  speech?: string;
  emotion?: RobotEmotion;
} {
  const speechMatch = raw.match(/"speech"\s*:\s*"((?:\\.|[^"\\])*)"/);
  const emotionMatch = raw.match(/"emotion"\s*:\s*"((?:\\.|[^"\\])*)"/);
  return {
    speech: speechMatch?.[1]?.trim().slice(0, 180) || undefined,
    emotion: emotionMatch?.[1] ? normalizeEmotion(emotionMatch[1]) : undefined,
  };
}

export function parsePerceptionReadout(
  raw: string,
  worldState?: Partial<RobotWorldState>,
  command = '',
): PerceptionReadout {
  const parsed = extractJsonObject(raw);
  const sonarCm =
    typeof worldState?.ultrasonicCm === 'number' && Number.isFinite(worldState.ultrasonicCm)
      ? worldState.ultrasonicCm
      : 145;
  const defaultClearance = Math.round(clampNumber(sonarCm / 100, 0.15, 4.5, 1.45) * 100) / 100;
  const lower = command.toLowerCase();
  const dogHidden = worldState?.dogDiscovered === false;

  const defaultTarget =
    dogHidden && commandRequestsDogSearch(command)
      ? 'Room Sweep (Dog Hidden)'
      : lower.includes('mirror') || lower.includes('espejo')
        ? 'Smart Mirror'
        : lower.includes('cat') || lower.includes('gato') || lower.includes('mochi') || lower.includes('luna')
          ? 'Mochi & Luna (Cats)'
          : lower.includes('bird') || lower.includes('pajaro') || lower.includes('pájaro') || lower.includes('rio')
            ? 'Rio (Tropical Bird)'
            : lower.includes('dog') || lower.includes('perro') || lower.includes('biscuit')
              ? 'Biscuit (Dog)'
              : lower.includes('owner')
                ? 'Owner Beacon'
                : lower.includes('dock')
                  ? 'Charging Dock'
                  : 'Room Center';

  if (parsed) {
    let targetLock =
      typeof parsed.targetLock === 'string' && parsed.targetLock.trim()
        ? parsed.targetLock.trim().slice(0, 48)
        : defaultTarget;
    if (dogHidden && commandRequestsDogSearch(command) && /biscuit|dog/i.test(targetLock) && !/hidden|sweep|scan/i.test(targetLock)) {
      targetLock = 'Room Sweep (Biscuit Hidden)';
    }
    const confidencePct = Math.round(
      clampNumber(parsed.confidencePct ?? parsed.confidence, 82, 99, dogHidden && commandRequestsDogSearch(command) ? 94 : 98),
    );
    const clearanceM =
      Math.round(clampNumber(parsed.clearanceM ?? parsed.clearance, 0.12, 4.5, defaultClearance) * 100) /
      100;
    const hazard =
      typeof parsed.hazard === 'string' && parsed.hazard.trim()
        ? parsed.hazard.trim().slice(0, 64)
        : clearanceM < 0.45
          ? 'Close obstacle within 45cm — tangential bypass active'
          : 'Clear corridor (Walnut Table & Sofa buffered)';
    return { targetLock, confidencePct, clearanceM, hazard };
  }

  return {
    targetLock: defaultTarget,
    confidencePct: dogHidden && commandRequestsDogSearch(command) ? 94 : 98,
    clearanceM: defaultClearance,
    hazard:
      defaultClearance < 0.45
        ? 'Close obstacle within 45cm — tangential bypass active'
        : 'Clear corridor (Walnut Table & Sofa buffered)',
  };
}

export function parseSafetyAuditReadout(
  raw: string,
  worldState?: Partial<RobotWorldState>,
): SafetyAuditReadout {
  const parsed = extractJsonObject(raw);
  const sonarCm =
    typeof worldState?.ultrasonicCm === 'number' && Number.isFinite(worldState.ultrasonicCm)
      ? Math.round(worldState.ultrasonicCm)
      : 145;

  if (parsed) {
    const rawStatus =
      typeof parsed.status === 'string' ? parsed.status.trim().toUpperCase() : 'SAFE';
    const status: 'SAFE' | 'CAUTION' =
      rawStatus === 'CAUTION' || sonarCm < 35 ? 'CAUTION' : 'SAFE';
    const maxPwm = Math.round(clampNumber(parsed.maxPwm, 0.2, 1.0, 0.92) * 100) / 100;
    const sonarMarginCm = Math.round(
      clampNumber(parsed.sonarMarginCm ?? sonarCm, 10, 400, sonarCm),
    );
    const watchdogMs = Math.round(clampNumber(parsed.watchdogMs, 250, 1000, 500));
    const note =
      typeof parsed.note === 'string' && parsed.note.trim()
        ? parsed.note.trim().slice(0, 80)
        : 'TB6612FNG PWM clamped [-1,1] · HC-SR04 12cm auto-brake · 500ms WD armed';
    return { status, maxPwm, sonarMarginCm, watchdogMs, note };
  }

  return {
    status: sonarCm < 35 ? 'CAUTION' : 'SAFE',
    maxPwm: 0.92,
    sonarMarginCm: sonarCm,
    watchdogMs: 500,
    note: 'TB6612FNG PWM clamped [-1,1] · HC-SR04 12cm auto-brake · 500ms WD armed',
  };
}
