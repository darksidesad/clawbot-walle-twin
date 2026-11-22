import type {
  HealthResponse,
  MissionLogEntry,
  MissionPreset,
  ModelOption,
  RobotCommandEvent,
  RobotCommandRequest,
} from '@shared/types';

export const FALLBACK_MODELS: ModelOption[] = [
  {
    id: 'cerebras/qwen-3.8-27b',
    label: 'Qwen 3.8 27B',
    provider: 'Cerebras',
    badge: 'Active Default',
  },
  {
    id: 'cerebras/gpt-oss-120b',
    label: 'GPT-OSS 120B',
    provider: 'Cerebras',
    badge: 'High Reasoning',
  },
  {
    id: 'cerebras/moonshotai-kimi-k3.1-pro-trial',
    label: 'Kimi K3.1 Pro Trial',
    provider: 'Cerebras',
    badge: 'Hackathon Target',
    hackathonRequired: true,
  },
];

export const FALLBACK_MISSIONS: MissionPreset[] = [
  {
    id: 'search-dog',
    title: 'Search Room & Film Dog',
    subtitle: 'Real FOV sweep -> discover & film Biscuit',
    icon: 'search',
    command:
      'Sweep the entire room with your camera until you discover Biscuit, then chase and film him!',
    accent: '#f59e0b',
  },
  {
    id: 'tiktok-live',
    title: 'Start TikTok Live!',
    subtitle: 'Live Robot POV + Screen Share',
    icon: 'video',
    command:
      'Start a realistic TikTok Live stream right now! Greet the viewers with your live front lens POV and hype up Cerebras speed!',
    accent: '#fb7185',
  },
  {
    id: 'instagram-post',
    title: 'Post to Instagram',
    subtitle: 'Snap real 3D camera photo + publish',
    icon: 'camera',
    command:
      'Snap a live 3D camera photo of the room and Biscuit right now, write a viral Instagram caption with hashtags, and open Instagram Studio to post it!',
    accent: '#e879f9',
  },
  {
    id: 'coding-agents',
    title: 'Coding Agents Briefing',
    subtitle: 'Check active PRs, CI & security audit',
    icon: 'code',
    command:
      'Connect to my OpenClaw coding agents, check active PRs and CI status, and give me a spoken engineering briefing!',
    accent: '#22d3ee',
  },
  {
    id: 'obsidian-sync',
    title: 'Obsidian Vault Sync',
    subtitle: 'Backlink graph + daily note auto-log',
    icon: 'book',
    command:
      "Open my Obsidian knowledge vault, show the backlink graph, and log today's robotics mission to my daily note!",
    accent: '#a78bfa',
  },
  {
    id: 'analytics-charts',
    title: 'Live Analytics & Charts',
    subtitle: 'Cerebras tok/s curves & Triad metrics',
    icon: 'chart',
    command:
      'Open the live performance analytics dashboard with Cerebras tok/s charts and mission telemetry!',
    accent: '#34d399',
  },
  {
    id: 'victory-dance',
    title: 'WALL-E Victory Dance',
    subtitle: 'Excited spin dance with heart eyes',
    icon: 'sparkles',
    command: 'Do an excited spin dance with heart eyes, then scan the room curiously!',
    accent: '#f472b6',
  },
  {
    id: 'mirror-chat',
    title: 'Smart Mirror Chat',
    subtitle: 'Check mirror, read comments & reply',
    icon: 'mirror',
    command:
      'Roll up to the smart mirror, check yourself out, read the live viewer comments on the mirror, and reply out loud!',
    accent: '#e879f9',
  },
];

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return `HTTP ${res.status} ${res.statusText}`;
    try {
      const json = JSON.parse(text) as { error?: string; message?: string };
      return json.error || json.message || text;
    } catch {
      return text;
    }
  } catch {
    return `HTTP ${res.status} ${res.statusText}`;
  }
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health', { cache: 'no-store' });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return (await res.json()) as HealthResponse;
}

export async function fetchMissions(): Promise<MissionPreset[]> {
  const res = await fetch('/api/missions', { cache: 'no-store' });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const data = (await res.json()) as MissionPreset[] | { missions?: MissionPreset[] };
  return Array.isArray(data) ? data : data.missions ?? [];
}

export async function fetchHistory(): Promise<MissionLogEntry[]> {
  const res = await fetch('/api/history', { cache: 'no-store' });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const data = (await res.json()) as MissionLogEntry[] | { history?: MissionLogEntry[] };
  return Array.isArray(data) ? data : data.history ?? [];
}

export async function streamRobotCommand(
  request: RobotCommandRequest,
  onEvent: (event: RobotCommandEvent) => void,
  signal: AbortSignal
): Promise<void> {
  const res = await fetch('/api/robot/command', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(request),
    signal,
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  if (!res.body) {
    throw new Error('Empty SSE stream body from server.');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  const dispatchBlock = (rawBlock: string) => {
    const lines = rawBlock.split(/\r?\n/);
    const dataLines: string[] = [];
    for (const line of lines) {
      if (!line || line.startsWith(':')) continue;
      if (line.startsWith('data:')) {
        const val = line.slice(5);
        dataLines.push(val.startsWith(' ') ? val.slice(1) : val);
      }
    }
    if (dataLines.length === 0) return;
    const payload = dataLines.join('\n').trim();
    if (!payload || payload === '[DONE]') return;
    try {
      const parsed = JSON.parse(payload) as RobotCommandEvent;
      if (parsed && typeof parsed.type === 'string') {
        onEvent(parsed);
      }
    } catch {
      // Ignore partial trailing fragment
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? '';
      for (const block of blocks) {
        if (block.trim()) dispatchBlock(block);
      }
    }
    const tail = decoder.decode();
    if (tail) buffer += tail;
    if (buffer.trim()) dispatchBlock(buffer);
  } finally {
    reader.releaseLock();
  }
}
