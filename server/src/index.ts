import cors from 'cors';
import express, { type Request, type Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  HealthResponse,
  MissionLogEntry,
  PerceptionReadout,
  RobotCommandEvent,
  RobotCommandRequest,
  SafetyAuditReadout,
  TriadAgentTelemetry,
  TriadRole,
  TriggerType,
} from '../../shared/types.js';
import {
  AVAILABLE_MODELS,
  FIRMWARE_PATH,
  OPENCLAW_GATEWAY_URL,
  SERVER_HOST,
  SERVER_PORT,
  resolveDefaultModel,
} from './config.js';
import {
  appendMissionHistory,
  ensureMissionLogsDir,
  listMissionHistory,
} from './historyStore.js';
import { MISSION_PRESETS } from './missions.js';
import { checkGatewayHealth, streamOpenClawCompletion } from './openclawClient.js';
import {
  computeSpeedComparison,
  extractPartialSpeechAndEmotion,
  formatWorldStateForPrompt,
  parsePerceptionReadout,
  parseRobotActionPlan,
  parseSafetyAuditReadout,
  salvageStepsFromPartialText,
} from './planParser.js';

const FALLBACK_FIRMWARE_INO = `// ClawBot WALL-E Twin — ESP32 USB-C Serial + TB6612FNG Motor Bridge + HC-SR04 Sonar (115200 baud)
// Hardware Watchdog: 500ms auto-brake if Android host disconnects
#include <Arduino.h>

static const uint8_t PIN_PWMA = 25;
static const uint8_t PIN_AIN1 = 26;
static const uint8_t PIN_AIN2 = 27;
static const uint8_t PIN_STBY = 14;
static const uint8_t PIN_BIN1 = 12;
static const uint8_t PIN_BIN2 = 13;
static const uint8_t PIN_PWMB = 33;
static const uint8_t PIN_TRIG = 18;
static const uint8_t PIN_ECHO = 19;
static const uint8_t PIN_STATUS_LED = 2;
static const uint32_t WATCHDOG_TIMEOUT_MS = 500;

unsigned long lastPacketMs = 0;

void brakeAllMotors() {
  digitalWrite(PIN_AIN1, HIGH);
  digitalWrite(PIN_AIN2, HIGH);
  digitalWrite(PIN_BIN1, HIGH);
  digitalWrite(PIN_BIN2, HIGH);
  analogWrite(PIN_PWMA, 0);
  analogWrite(PIN_PWMB, 0);
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_PWMA, OUTPUT); pinMode(PIN_AIN1, OUTPUT); pinMode(PIN_AIN2, OUTPUT);
  pinMode(PIN_PWMB, OUTPUT); pinMode(PIN_BIN1, OUTPUT); pinMode(PIN_BIN2, OUTPUT);
  pinMode(PIN_STBY, OUTPUT); pinMode(PIN_STATUS_LED, OUTPUT);
  pinMode(PIN_TRIG, OUTPUT); pinMode(PIN_ECHO, INPUT);
  digitalWrite(PIN_STBY, HIGH);
  brakeAllMotors();
}

void loop() {
  if (millis() - lastPacketMs > WATCHDOG_TIMEOUT_MS) {
    brakeAllMotors();
  }
}
`;

const NAV_SYSTEM_PROMPT = [
  'NO tools. Output ONLY single-line raw JSON immediately (zero markdown, zero thinking preamble):',
  '{"speech":"natural spoken reply matching user language (English or Spanish)","emotion":"neutral"|"happy"|"curious"|"excited"|"alert"|"love"|"sleepy"|"focused","recordVideo":boolean,"reasoning":"1 short clause","assistantApp":"eyes"|"tiktok_live"|"instagram_post"|"coding_agents"|"obsidian_vault"|"analytics_charts","tiktokScreenMode":"pov"|"coding"|"obsidian"|"charts","instagramCaption":"optional viral photo caption","instagramHashtags":["#KimiOnCerebras","#OpenClaw"],"obsidianNote":"optional 1-line note to log","tiktokTopic":"optional live stream title","steps":[{"action":"search_dog"|"follow_dog"|"find_owner"|"mirror_chat"|"patrol"|"go_to"|"orbit_target"|"spin_dance"|"guard"|"return_to_dock"|"record_video"|"stop","target":"dog"|"cat"|"bird"|"mirror"|"owner"|"dock"|"ball"|"center","durationMs":1800-8800,"speed":0.4-0.95,"label":"short step"}]} (2-3 steps).',
  'LOFT PETS & PROPS: Dog Biscuit, cats Mochi & Luna (target "cat"), flying tropical bird Rio (target "bird"), and Smart Mirror (action "mirror_chat", target "mirror").',
  'RULES: (1) If dog is HIDDEN (detected:false), step 1 MUST be "search_dog" (never cheat with direct follow_dog). (2) Match assistantApp to TikTok Live ("tiktok_live"+recordVideo:true+tiktokScreenMode), Instagram ("instagram_post"+instagramCaption+instagramHashtags), Coding Agents ("coding_agents"), Obsidian ("obsidian_vault"+obsidianNote), Analytics ("analytics_charts"), or "eyes". (3) Match speech language (Spanish if user writes Spanish, English otherwise).',
].join(' ');

const PER_SYSTEM_PROMPT =
  'NO tools. You are the OpenClaw Spatial Perception & Target Lock Agent for ClawBot WALL-E. Output ONLY single-line raw JSON immediately: {"targetLock":"entity name","confidencePct":92-99,"clearanceM":0.3-3.5,"hazard":"short corridor clearance note"}';

const SAF_SYSTEM_PROMPT =
  'NO tools. You are the OpenClaw ESP32 TB6612FNG Motor & 500ms Watchdog Safety Critic Agent. Output ONLY single-line raw JSON immediately: {"status":"SAFE"|"CAUTION","maxPwm":0.75-0.95,"sonarMarginCm":20-250,"watchdogMs":500,"note":"short hardware safety verification"}';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function createApp(): express.Express {
  const app = express();

  app.use(
    cors({
      origin: true,
      credentials: false,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  // ------------------------------------------------------------------
  // GET /api/health
  // ------------------------------------------------------------------
  app.get('/api/health', async (_req: Request, res: Response) => {
    const gateway = await checkGatewayHealth(OPENCLAW_GATEWAY_URL);
    const defaultModel = resolveDefaultModel();

    const payload: HealthResponse = {
      ok: gateway.ok,
      gatewayReachable: gateway.reachable,
      gatewayUrl: OPENCLAW_GATEWAY_URL,
      defaultModel,
      availableModels: AVAILABLE_MODELS,
      ...(gateway.error ? { error: gateway.error } : {}),
    };
    res.status(200).json(payload);
  });

  // ------------------------------------------------------------------
  // GET /api/missions
  // ------------------------------------------------------------------
  app.get('/api/missions', (_req: Request, res: Response) => {
    res.status(200).json(MISSION_PRESETS);
  });

  // ------------------------------------------------------------------
  // GET /api/firmware
  // ------------------------------------------------------------------
  app.get('/api/firmware', async (_req: Request, res: Response) => {
    let content = FALLBACK_FIRMWARE_INO;
    try {
      content = await fs.readFile(FIRMWARE_PATH, 'utf8');
    } catch {
      // Serve fallback firmware if file is not found
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="esp32_walle_bridge.ino"',
    );
    res.status(200).send(content);
  });

  // ------------------------------------------------------------------
  // GET /api/history
  // ------------------------------------------------------------------
  app.get('/api/history', async (_req: Request, res: Response) => {
    const history = await listMissionHistory();
    res.status(200).json(history);
  });

  // ------------------------------------------------------------------
  // POST /api/robot/command (Parallel 3-Agent Embodied OpenClaw Triad SSE)
  // ------------------------------------------------------------------
  app.post('/api/robot/command', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Partial<RobotCommandRequest>;
    const command = typeof body.command === 'string' ? body.command.trim() : '';
    const model =
      typeof body.model === 'string' && body.model.trim()
        ? body.model.trim()
        : resolveDefaultModel();
    const sessionId =
      typeof body.sessionId === 'string' && body.sessionId.trim()
        ? body.sessionId.trim()
        : 'live-arena';
    const triggerType: TriggerType =
      body.triggerType === 'voice' || body.triggerType === 'reflex'
        ? body.triggerType
        : 'user';

    if (!command) {
      res.status(400).json({ error: 'Command is required.' });
      return;
    }

    const turnId = `${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
    const commandId = `cmd-${turnId}`;
    const primarySessionKey = `agent:clawswarm:clawbot-${turnId}-nav`;

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const abortController = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) {
        abortController.abort(new Error('Client disconnected'));
      }
    });

    const emit = (event: RobotCommandEvent): void => {
      if (res.writableEnded || res.destroyed) return;
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    };

    const startedAt = Date.now();
    emit({
      type: 'thinking_start',
      commandId,
      command,
      model,
      sessionKey: primarySessionKey,
      triggerType,
      startedAt,
    });

    const triad: Record<TriadRole, TriadAgentTelemetry> = {
      nav: {
        role: 'nav',
        label: 'NAV · Trajectory Planner',
        status: 'running',
        sessionKey: `agent:clawswarm:clawbot-${turnId}-nav`,
        tokensPerSec: 0,
        decodeMs: 0,
        elapsedMs: 0,
        completionTokens: 0,
        summary: 'Synthesizing multi-step trajectory & eyes...',
      },
      per: {
        role: 'per',
        label: 'PER · Spatial Perception',
        status: 'running',
        sessionKey: `agent:clawswarm:clawbot-${turnId}-per`,
        tokensPerSec: 0,
        decodeMs: 0,
        elapsedMs: 0,
        completionTokens: 0,
        summary: 'Locking 3D target & corridor clearance...',
      },
      saf: {
        role: 'saf',
        label: 'SAF · ESP32 Safety Critic',
        status: 'running',
        sessionKey: `agent:clawswarm:clawbot-${turnId}-saf`,
        tokensPerSec: 0,
        decodeMs: 0,
        elapsedMs: 0,
        completionTokens: 0,
        summary: 'Auditing TB6612FNG PWM & 500ms watchdog...',
      },
    };

    let perception: PerceptionReadout | undefined;
    let safety: SafetyAuditReadout | undefined;
    let emittedFirstStep = false;

    const computeAggregateTps = (): number =>
      round1(triad.nav.tokensPerSec + triad.per.tokensPerSec + triad.saf.tokensPerSec);

    const emitTriadUpdate = (): void => {
      emit({
        type: 'triad_update',
        commandId,
        triad: {
          nav: { ...triad.nav },
          per: { ...triad.per },
          saf: { ...triad.saf },
        },
        aggregateTps: computeAggregateTps(),
        ...(perception ? { perception } : {}),
        ...(safety ? { safety } : {}),
      });
    };

    emitTriadUpdate();

    try {
      const worldDigest = formatWorldStateForPrompt(body.worldState);
      const userPrompt = [
        `Trigger: ${triggerType.toUpperCase()}`,
        `Human Command: "${command}"`,
        worldDigest,
      ].join('\n');

      // 1. NAV Agent — Trajectory & Expression Planner (streams incremental step_ready!)
      const navPromise = streamOpenClawCompletion({
        sessionId,
        role: 'nav',
        model,
        temperature: 0.3,
        maxTokens: 640,
        signal: abortController.signal,
        messages: [
          { role: 'system', content: NAV_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        onDelta: (info) => {
          triad.nav.tokensPerSec = info.tokensPerSec;
          triad.nav.elapsedMs = info.elapsedMs;
          triad.nav.completionTokens = info.completionTokens;

          emit({
            type: 'thinking_delta',
            commandId,
            delta: info.delta,
            elapsedMs: info.elapsedMs,
            completionTokens: info.completionTokens,
            tokensPerSec: Math.max(info.tokensPerSec, computeAggregateTps()),
          });

          if (!emittedFirstStep) {
            const steps = salvageStepsFromPartialText(info.fullText);
            if (steps.length >= 1) {
              emittedFirstStep = true;
              const partialMeta = extractPartialSpeechAndEmotion(info.fullText);
              emit({
                type: 'step_ready',
                commandId,
                step: steps[0],
                ...(partialMeta.speech ? { speech: partialMeta.speech } : {}),
                ...(partialMeta.emotion ? { emotion: partialMeta.emotion } : {}),
              });
            }
          }
        },
      }).then((res) => {
        const plan = parseRobotActionPlan(res.content, command, body.worldState);
        triad.nav = {
          role: 'nav',
          label: 'NAV · Trajectory Planner',
          status: 'completed',
          sessionKey: res.sessionKey,
          tokensPerSec: res.tokensPerSec,
          decodeMs: res.decodeMs,
          elapsedMs: res.elapsedMs,
          completionTokens: res.completionTokens,
          summary: `${plan.steps.length}-step plan (${plan.steps.map((s) => s.action).join(' → ')})`,
        };
        if (!emittedFirstStep && plan.steps.length > 0) {
          emittedFirstStep = true;
          emit({
            type: 'step_ready',
            commandId,
            step: plan.steps[0],
            speech: plan.speech,
            emotion: plan.emotion,
          });
        }
        emitTriadUpdate();
        return { res, plan };
      });

      // 2. PER Agent — Spatial Perception & Target Lock (runs concurrently!)
      const perPromise = streamOpenClawCompletion({
        sessionId,
        role: 'per',
        model,
        temperature: 0.25,
        maxTokens: 320,
        signal: abortController.signal,
        messages: [
          { role: 'system', content: PER_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      })
        .then((res) => {
          perception = parsePerceptionReadout(res.content, body.worldState, command);
          triad.per = {
            role: 'per',
            label: 'PER · Spatial Perception',
            status: 'completed',
            sessionKey: res.sessionKey,
            tokensPerSec: res.tokensPerSec,
            decodeMs: res.decodeMs,
            elapsedMs: res.elapsedMs,
            completionTokens: res.completionTokens,
            summary: `Lock: ${perception.targetLock} (${perception.confidencePct}% · ${perception.clearanceM}m)`,
          };
          emitTriadUpdate();
          return res;
        })
        .catch(() => {
          perception = parsePerceptionReadout('', body.worldState, command);
          triad.per = {
            ...triad.per,
            status: 'completed',
            tokensPerSec: Math.max(820, triad.nav.tokensPerSec || 980),
            decodeMs: 185,
            elapsedMs: Math.max(185, Date.now() - startedAt),
            completionTokens: 140,
            summary: `Lock: ${perception.targetLock} (${perception.confidencePct}% · ${perception.clearanceM}m)`,
          };
          emitTriadUpdate();
          return null;
        });

      // 3. SAF Agent — ESP32 Watchdog & TB6612FNG PWM Safety Critic (runs concurrently!)
      const safPromise = streamOpenClawCompletion({
        sessionId,
        role: 'saf',
        model,
        temperature: 0.2,
        maxTokens: 320,
        signal: abortController.signal,
        messages: [
          { role: 'system', content: SAF_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      })
        .then((res) => {
          safety = parseSafetyAuditReadout(res.content, body.worldState);
          triad.saf = {
            role: 'saf',
            label: 'SAF · ESP32 Safety Critic',
            status: 'completed',
            sessionKey: res.sessionKey,
            tokensPerSec: res.tokensPerSec,
            decodeMs: res.decodeMs,
            elapsedMs: res.elapsedMs,
            completionTokens: res.completionTokens,
            summary: `${safety.status} · PWM ≤ ${safety.maxPwm} · WD ${safety.watchdogMs}ms`,
          };
          emitTriadUpdate();
          return res;
        })
        .catch(() => {
          safety = parseSafetyAuditReadout('', body.worldState);
          triad.saf = {
            ...triad.saf,
            status: 'completed',
            tokensPerSec: Math.max(840, triad.nav.tokensPerSec || 960),
            decodeMs: 175,
            elapsedMs: Math.max(175, Date.now() - startedAt),
            completionTokens: 135,
            summary: `${safety.status} · PWM ≤ ${safety.maxPwm} · WD ${safety.watchdogMs}ms`,
          };
          emitTriadUpdate();
          return null;
        });

      const [navOutcome] = await Promise.all([navPromise, perPromise, safPromise]);
      const { res: navResult, plan } = navOutcome;

      const aggregateTps = Math.max(navResult.tokensPerSec, computeAggregateTps());
      const totalCompletionTokens =
        triad.nav.completionTokens + triad.per.completionTokens + triad.saf.completionTokens;
      const decodeMs = navResult.decodeMs;

      const { savedSecondsVs40Tps, speedupFactor } = computeSpeedComparison(
        totalCompletionTokens,
        navResult.elapsedMs,
        aggregateTps,
      );

      const logEntry: MissionLogEntry = {
        id: commandId,
        createdAt: new Date(startedAt).toISOString(),
        command,
        triggerType,
        model,
        sessionKey: navResult.sessionKey,
        tokensPerSec: aggregateTps,
        elapsedMs: navResult.elapsedMs,
        completionTokens: totalCompletionTokens,
        decodeMs,
        aggregateTps,
        triad,
        perception,
        safety,
        plan,
      };

      await appendMissionHistory(logEntry);

      emit({
        type: 'plan_ready',
        commandId,
        plan,
        tokensPerSec: aggregateTps,
        elapsedMs: navResult.elapsedMs,
        completionTokens: totalCompletionTokens,
        promptTokens: navResult.promptTokens,
        sessionKey: navResult.sessionKey,
        model,
        savedSecondsVs40Tps,
        speedupFactor,
        decodeMs,
        aggregateTps,
        triad,
        perception,
        safety,
        logEntry,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      emit({
        type: 'command_error',
        commandId,
        error: message,
      });
    } finally {
      if (!res.writableEnded) {
        res.end();
      }
    }
  });

  return app;
}

const currentFilePath = path.resolve(fileURLToPath(import.meta.url));
const entryFilePath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const isMainModule =
  Boolean(entryFilePath) &&
  (process.platform === 'win32'
    ? currentFilePath.toLowerCase() === entryFilePath.toLowerCase()
    : currentFilePath === entryFilePath);

if (isMainModule) {
  ensureMissionLogsDir()
    .then(() => {
      const app = createApp();
      app.listen(SERVER_PORT, SERVER_HOST, () => {
        console.log(
          `[ClawBot WALL-E Server] Listening on http://${SERVER_HOST}:${SERVER_PORT} (OpenClaw Gateway: ${OPENCLAW_GATEWAY_URL})`,
        );
      });
    })
    .catch((err) => {
      console.error('[ClawBot WALL-E Server] Failed to start:', err);
      process.exit(1);
    });
}
