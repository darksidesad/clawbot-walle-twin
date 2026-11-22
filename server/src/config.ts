import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ModelOption } from '../../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveProjectRoot(): string {
  const candidates = [
    path.resolve(__dirname, '..', '..'),
    path.resolve(__dirname, '..', '..', '..', '..'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'shared', 'types.ts'))) {
      return candidate;
    }
  }
  return path.resolve(__dirname, '..', '..');
}

export const PROJECT_ROOT = resolveProjectRoot();
export const FIRMWARE_PATH = path.join(
  PROJECT_ROOT,
  'firmware',
  'esp32_walle_bridge',
  'esp32_walle_bridge.ino',
);
export const MISSION_LOGS_DIR = path.join(PROJECT_ROOT, 'mission-logs');
export const HISTORY_FILE_PATH = path.join(MISSION_LOGS_DIR, 'history.json');

export const SERVER_HOST = process.env.HOST || '127.0.0.1';
export const SERVER_PORT = Number(process.env.PORT) || 4320;

export const OPENCLAW_GATEWAY_URL = (
  process.env.OPENCLAW_GATEWAY_URL || 'http://127.0.0.1:18789'
).replace(/\/+$/, '');

export const OPENCLAW_CONFIG_PATH =
  process.env.OPENCLAW_CONFIG_PATH ||
  path.join(os.homedir(), '.openclaw', 'openclaw.json');

export const DEFAULT_MODEL =
  process.env.CLAWBOT_DEFAULT_MODEL || 'cerebras/qwen-3.8-27b';

export const OPENCLAW_AGENT_MODEL =
  process.env.OPENCLAW_AGENT_MODEL || 'openclaw/clawswarm';

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'cerebras/qwen-3.8-27b',
    label: 'Qwen 3.8 27B',
    provider: 'Cerebras via OpenClaw',
    badge: 'LIVE · ULTRA-FAST',
  },
  {
    id: 'cerebras/gpt-oss-120b',
    label: 'GPT-OSS 120B',
    provider: 'Cerebras via OpenClaw',
    badge: 'LIVE · 120B',
  },
  {
    id: 'cerebras/moonshotai-kimi-k3.1-pro-trial',
    label: 'Kimi K3.1 Pro',
    provider: 'Cerebras via OpenClaw',
    badge: 'HACKATHON TARGET',
    hackathonRequired: true,
  },
];

interface OpenClawConfigShape {
  gateway?: {
    auth?: {
      token?: string;
      password?: string;
    };
  };
  agents?: {
    defaults?: {
      model?: {
        primary?: string;
      };
    };
  };
}

let cachedConfig: { mtimeMs: number; parsed: OpenClawConfigShape } | null = null;

function readOpenClawConfig(): OpenClawConfigShape | null {
  try {
    const stat = fs.statSync(OPENCLAW_CONFIG_PATH);
    if (cachedConfig && cachedConfig.mtimeMs === stat.mtimeMs) {
      return cachedConfig.parsed;
    }
    const raw = fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw) as OpenClawConfigShape;
    cachedConfig = { mtimeMs: stat.mtimeMs, parsed };
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Resolves the OpenClaw Gateway bearer token from environment or ~/.openclaw/openclaw.json.
 * Never logs or exposes the returned secret.
 */
export function resolveGatewayAuthToken(): string | undefined {
  const fromEnv = process.env.OPENCLAW_GATEWAY_TOKEN?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const config = readOpenClawConfig();
  const token = config?.gateway?.auth?.token?.trim();
  if (token) {
    return token;
  }
  const password = config?.gateway?.auth?.password?.trim();
  if (password) {
    return password;
  }
  return undefined;
}

export function resolveDefaultModel(): string {
  if (process.env.CLAWBOT_DEFAULT_MODEL?.trim()) {
    return process.env.CLAWBOT_DEFAULT_MODEL.trim();
  }
  const config = readOpenClawConfig();
  const configuredPrimary = config?.agents?.defaults?.model?.primary?.trim();
  if (configuredPrimary) {
    return configuredPrimary;
  }
  return DEFAULT_MODEL;
}
