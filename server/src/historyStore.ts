import fs from 'node:fs/promises';
import type { MissionLogEntry } from '../../shared/types.js';
import { HISTORY_FILE_PATH, MISSION_LOGS_DIR } from './config.js';

const MAX_HISTORY_ENTRIES = 30;

export async function ensureMissionLogsDir(): Promise<void> {
  await fs.mkdir(MISSION_LOGS_DIR, { recursive: true });
}

export async function listMissionHistory(): Promise<MissionLogEntry[]> {
  try {
    await ensureMissionLogsDir();
    const raw = await fs.readFile(HISTORY_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_HISTORY_ENTRIES) as MissionLogEntry[];
  } catch {
    return [];
  }
}

export async function appendMissionHistory(entry: MissionLogEntry): Promise<MissionLogEntry[]> {
  await ensureMissionLogsDir();
  const current = await listMissionHistory();
  const updated = [entry, ...current.filter((e) => e.id !== entry.id)].slice(
    0,
    MAX_HISTORY_ENTRIES,
  );
  await fs.writeFile(HISTORY_FILE_PATH, JSON.stringify(updated, null, 2), 'utf8');
  return updated;
}
