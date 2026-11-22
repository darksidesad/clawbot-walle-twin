export type RobotEmotion =
  | 'neutral'
  | 'happy'
  | 'curious'
  | 'excited'
  | 'alert'
  | 'love'
  | 'sleepy'
  | 'focused';

export type RobotActionType =
  | 'search_dog'
  | 'follow_dog'
  | 'find_owner'
  | 'mirror_chat'
  | 'patrol'
  | 'go_to'
  | 'orbit_target'
  | 'spin_dance'
  | 'guard'
  | 'return_to_dock'
  | 'record_video'
  | 'stop';

export type AssistantAppMode =
  | 'eyes'
  | 'tiktok_live'
  | 'instagram_post'
  | 'coding_agents'
  | 'obsidian_vault'
  | 'analytics_charts';

export type TikTokScreenMode = 'pov' | 'coding' | 'obsidian' | 'charts';

export type CameraMode = 'orbit' | 'chase' | 'pov';

export type WorldEntityKind =
  | 'dog'
  | 'cat'
  | 'bird'
  | 'mirror'
  | 'owner'
  | 'dock'
  | 'sofa'
  | 'table'
  | 'plant'
  | 'ball'
  | 'obstacle';

export interface WorldEntity {
  id: string;
  kind: WorldEntityKind;
  label: string;
  x: number;
  z: number;
  distance: number;
  angleDeg: number;
}

export interface RobotWorldState {
  x: number;
  z: number;
  headingDeg: number;
  batteryPct: number;
  leftPwm: number;
  rightPwm: number;
  ultrasonicCm: number;
  activeMode: RobotActionType | 'idle';
  emotion: RobotEmotion;
  isRecording: boolean;
  dogDiscovered?: boolean;
  searchZoneIndex?: number;
  activeAssistantApp?: AssistantAppMode;
  entities: WorldEntity[];
}

export type RobotTarget = 'dog' | 'cat' | 'bird' | 'mirror' | 'owner' | 'dock' | 'ball' | 'center';

export interface RobotActionStep {
  action: RobotActionType;
  target?: RobotTarget;
  x?: number;
  z?: number;
  durationMs: number;
  speed: number;
  label: string;
}

export interface RobotActionPlan {
  speech: string;
  emotion: RobotEmotion;
  recordVideo: boolean;
  reasoning: string;
  assistantApp?: AssistantAppMode;
  obsidianNote?: string;
  tiktokTopic?: string;
  tiktokScreenMode?: TikTokScreenMode;
  instagramCaption?: string;
  instagramHashtags?: string[];
  steps: RobotActionStep[];
}

export interface ObsidianLogEntry {
  id: string;
  timestamp: string;
  tag: string;
  text: string;
}

export interface InstagramPostEntry {
  id: string;
  createdAt: string;
  imageDataUrl: string;
  caption: string;
  hashtags: string[];
  likes: number;
  published: boolean;
  comments: Array<{ user: string; text: string }>;
}

export interface Esp32Packet {
  t: number;
  l: number;
  r: number;
  led: string;
  wd: number;
  mode: string;
}

export interface MissionPreset {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  command: string;
  accent: string;
}

export interface ModelOption {
  id: string;
  label: string;
  provider: string;
  badge: string;
  hackathonRequired?: boolean;
}

export type TriggerType = 'user' | 'voice' | 'reflex';

export type TriadRole = 'nav' | 'per' | 'saf';

export type TriadAgentStatus = 'idle' | 'running' | 'completed' | 'error';

export interface TriadAgentTelemetry {
  role: TriadRole;
  label: string;
  status: TriadAgentStatus;
  sessionKey: string;
  tokensPerSec: number;
  decodeMs: number;
  elapsedMs: number;
  completionTokens: number;
  summary: string;
}

export interface PerceptionReadout {
  targetLock: string;
  confidencePct: number;
  clearanceM: number;
  hazard: string;
}

export interface SafetyAuditReadout {
  status: 'SAFE' | 'CAUTION';
  maxPwm: number;
  sonarMarginCm: number;
  watchdogMs: number;
  note: string;
}

export interface RobotCommandRequest {
  command: string;
  worldState: RobotWorldState;
  model: string;
  sessionId: string;
  triggerType?: TriggerType;
}

export interface MissionLogEntry {
  id: string;
  createdAt: string;
  command: string;
  triggerType: TriggerType;
  model: string;
  sessionKey: string;
  tokensPerSec: number;
  elapsedMs: number;
  completionTokens: number;
  decodeMs?: number;
  aggregateTps?: number;
  triad?: Record<TriadRole, TriadAgentTelemetry>;
  perception?: PerceptionReadout;
  safety?: SafetyAuditReadout;
  plan: RobotActionPlan;
}

export type RobotCommandEvent =
  | {
      type: 'thinking_start';
      commandId: string;
      command: string;
      model: string;
      sessionKey: string;
      triggerType: TriggerType;
      startedAt: number;
    }
  | {
      type: 'thinking_delta';
      commandId: string;
      delta: string;
      elapsedMs: number;
      completionTokens: number;
      tokensPerSec: number;
    }
  | {
      type: 'triad_update';
      commandId: string;
      triad: Record<TriadRole, TriadAgentTelemetry>;
      aggregateTps: number;
      perception?: PerceptionReadout;
      safety?: SafetyAuditReadout;
    }
  | {
      type: 'step_ready';
      commandId: string;
      step: RobotActionStep;
      speech?: string;
      emotion?: RobotEmotion;
    }
  | {
      type: 'plan_ready';
      commandId: string;
      plan: RobotActionPlan;
      tokensPerSec: number;
      elapsedMs: number;
      completionTokens: number;
      promptTokens?: number;
      sessionKey: string;
      model: string;
      savedSecondsVs40Tps: number;
      speedupFactor: number;
      decodeMs?: number;
      aggregateTps?: number;
      triad?: Record<TriadRole, TriadAgentTelemetry>;
      perception?: PerceptionReadout;
      safety?: SafetyAuditReadout;
      logEntry?: MissionLogEntry;
    }
  | {
      type: 'command_error';
      commandId: string;
      error: string;
    };

export type RobotCommandEventType = RobotCommandEvent['type'];

export interface HealthResponse {
  ok: boolean;
  gatewayReachable: boolean;
  gatewayUrl: string;
  defaultModel: string;
  availableModels: ModelOption[];
  error?: string;
}
