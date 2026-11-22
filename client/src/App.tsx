import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AssistantAppMode,
  CameraMode,
  Esp32Packet,
  HealthResponse,
  InstagramPostEntry,
  MissionLogEntry,
  MissionPreset,
  ModelOption,
  ObsidianLogEntry,
  PerceptionReadout,
  RobotActionPlan,
  RobotCommandEvent,
  RobotEmotion,
  SafetyAuditReadout,
  TikTokScreenMode,
  TriadAgentTelemetry,
  TriadRole,
  TriggerType,
} from '@shared/types';
import {
  FALLBACK_MISSIONS,
  FALLBACK_MODELS,
  fetchHealth,
  fetchHistory,
  fetchMissions,
  streamRobotCommand,
} from '@/lib/api';
import {
  type FloorToolMode,
  type PhysicsSimState,
  advanceMirrorComment,
  applyActionPlanToSim,
  applyFirstStepImmediate,
  buildEsp32Packet,
  buildWorldStateSnapshot,
  createInitialPhysicsState,
  getActiveStep,
  hideDogBehindFurniture,
  triggerInstantPreReaction,
  triggerMirrorChatAction,
} from '@/lib/robotPhysics';
import { playDiscoveryChime, playRobotChirp, speakRobotSpeech } from '@/lib/soundFx';
import { CommandDock } from '@/components/CommandDock';
import { HardwareBrainDock } from '@/components/HardwareBrainDock';
import { Header } from '@/components/Header';
import { RobotArena3D } from '@/components/RobotArena3D';

const MAX_AUTO_REFLEX_CALLS = 4;

function nowTimestamp(): string {
  const d = new Date();
  return d.toTimeString().slice(0, 8);
}

export function App() {
  const simRef = useRef<PhysicsSimState>(createInitialPhysicsState());
  const capturePovSnapshotRef = useRef<(() => string) | null>(null);
  const sessionIdRef = useRef<string>(`walle-${Math.random().toString(36).slice(2, 8)}`);

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [missions, setMissions] = useState<MissionPreset[]>(FALLBACK_MISSIONS);
  const [history, setHistory] = useState<MissionLogEntry[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(FALLBACK_MODELS[0].id);

  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit');
  const [floorTool, setFloorTool] = useState<FloorToolMode>('none');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);

  // 6-Mode Embodied Assistant State (Eyes | TikTok | Insta | Code | Vault | Charts)
  const [activeAssistantApp, setActiveAssistantApp] = useState<AssistantAppMode>('eyes');
  const [tiktokTopic, setTiktokTopic] = useState<string>(
    '🤖 $25 DIY WALL-E Live on OpenClaw × Cerebras!'
  );
  const [tiktokScreenMode, setTiktokScreenMode] = useState<TikTokScreenMode>('pov');
  const [instagramPost, setInstagramPost] = useState<InstagramPostEntry>({
    id: 'ig-initial',
    createdAt: new Date().toISOString(),
    imageDataUrl: '',
    caption:
      'Live from my $25 DIY WALL-E chassis! Running a 3-Agent OpenClaw Triad at 1,500+ tok/s on Cerebras while cruising our 22m Smart Home Loft with A* pathfinding!',
    hashtags: ['#KimiOnCerebras', '#OpenClaw', '#WALLE', '#CerebrasHackathon', '#Robotics'],
    likes: 1428,
    published: false,
    comments: [
      { user: '@cerebras_fan', text: 'Real 3D front-lens POV capture from a $25 ESP32 bot?! 🔥' },
      { user: '@robotics_dev', text: 'A* reverse-and-detour around Biscuit is clean!! 🤖🐕' },
    ],
  });
  const [obsidianLogs, setObsidianLogs] = useState<ObsidianLogEntry[]>([
    {
      id: 'init-1',
      timestamp: nowTimestamp(),
      tag: 'boot',
      text: 'ClawBot WALL-E Twin online in 22m Smart Home Loft · OpenClaw 3-Agent Triad (:18789) + A* Nav ready.',
    },
    {
      id: 'init-2',
      timestamp: nowTimestamp(),
      tag: 'hardware',
      text: 'Verified TB6612FNG PWM bridge + 500ms hardware watchdog + HC-SR04 sonar cone.',
    },
  ]);

  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [streamText, setStreamText] = useState<string>('');
  const [tokensPerSec, setTokensPerSec] = useState<number>(0);
  const [peakTps, setPeakTps] = useState<number>(0);
  const [decodeMs, setDecodeMs] = useState<number>(0);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [completionTokens, setCompletionTokens] = useState<number>(0);
  const [speedupFactor, setSpeedupFactor] = useState<number>(0);
  const [savedSecondsVs40Tps, setSavedSecondsVs40Tps] = useState<number>(0);
  const [sessionKey, setSessionKey] = useState<string>(
    `agent:clawswarm:clawbot-${sessionIdRef.current}`
  );
  const [triad, setTriad] = useState<Record<TriadRole, TriadAgentTelemetry> | null>(null);
  const [perception, setPerception] = useState<PerceptionReadout | null>(null);
  const [safety, setSafety] = useState<SafetyAuditReadout | null>(null);

  const [packets, setPackets] = useState<Esp32Packet[]>(() => [
    buildEsp32Packet(simRef.current),
  ]);
  const [, setUiTick] = useState<number>(0);

  const [autoReflex, setAutoReflex] = useState<boolean>(false);
  const [reflexCount, setReflexCount] = useState<number>(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastReflexEpochRef = useRef<number>(0);
  const mutedRef = useRef<boolean>(false);

  const appendObsidianLog = useCallback((tag: string, text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setObsidianLogs((prev) => [
      {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: nowTimestamp(),
        tag,
        text: clean,
      },
      ...prev.slice(0, 24),
    ]);
  }, []);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    simRef.current.activeAssistantApp = activeAssistantApp;
    if (activeAssistantApp === 'tiktok_live') {
      simRef.current.isRecording = true;
    }
  }, [activeAssistantApp]);

  useEffect(() => {
    if (!isExpanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExpanded(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isExpanded]);

  const refreshHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const data = await fetchHealth();
      setHealth(data);
      if (data.defaultModel) {
        setSelectedModel((prev) => (prev === FALLBACK_MODELS[0].id ? data.defaultModel : prev));
      }
    } catch (err) {
      setHealth({
        ok: false,
        gatewayReachable: false,
        gatewayUrl: 'http://127.0.0.1:18789',
        defaultModel: FALLBACK_MODELS[0].id,
        availableModels: FALLBACK_MODELS,
        error: err instanceof Error ? err.message : 'Backend unreachable',
      });
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      const list = await fetchHistory();
      setHistory(list);
    } catch {
      // Keep current history
    }
  }, []);

  useEffect(() => {
    void refreshHealth();
    void (async () => {
      try {
        const remoteMissions = await fetchMissions();
        if (remoteMissions.length > 0) setMissions(remoteMissions);
      } catch {
        // Keep fallback missions
      }
    })();
    void refreshHistory();
  }, [refreshHealth, refreshHistory]);

  const handleSnapInstagramPhoto = useCallback(
    (overrideCaption?: string, overrideHashtags?: string[]) => {
      const snappedUrl = capturePovSnapshotRef.current?.() ?? '';
      setInstagramPost((prev) => ({
        ...prev,
        id: `ig-${Date.now()}`,
        createdAt: new Date().toISOString(),
        imageDataUrl: snappedUrl || prev.imageDataUrl,
        caption: overrideCaption?.trim() ? overrideCaption.trim() : prev.caption,
        hashtags:
          overrideHashtags && overrideHashtags.length > 0 ? overrideHashtags : prev.hashtags,
        published: false,
      }));
      if (snappedUrl) {
        playRobotChirp('excited', mutedRef.current);
      }
    },
    []
  );

  const handlePublishInstagramPost = useCallback(() => {
    setInstagramPost((prev) => ({
      ...prev,
      published: true,
      likes: prev.likes + 42,
      comments: [
        { user: '@kimi_builder', text: 'Just saw this drop on IG! #KimiOnCerebras 🚀⚡' },
        ...prev.comments.slice(0, 2),
      ],
    }));
    simRef.current.emotion = 'love';
    simRef.current.speech = 'Published to Instagram! Likes are climbing live from the Smart-Lab!';
    playRobotChirp('love', mutedRef.current);
    speakRobotSpeech('Published to Instagram! Check out our live 3D camera shot!', mutedRef.current);
    appendObsidianLog(
      'instagram-post',
      `Published 3D Robot POV photo to @clawbot.walle Instagram (${instagramPost.hashtags.slice(0, 3).join(' ')}).`
    );
    setUiTick((n) => n + 1);
  }, [appendObsidianLog, instagramPost.hashtags]);

  const handleSelectAssistantApp = useCallback(
    (app: AssistantAppMode) => {
      setActiveAssistantApp(app);
      simRef.current.activeAssistantApp = app;
      if (app === 'tiktok_live') {
        simRef.current.isRecording = true;
        simRef.current.emotion = 'excited';
        simRef.current.speech =
          'Hey chat! Welcome to ClawBot WALL-E Live with real front lens POV & Screen Share!';
        playRobotChirp('excited', mutedRef.current);
        speakRobotSpeech(simRef.current.speech, mutedRef.current);
        appendObsidianLog('tiktok-live', 'Launched TikTok Live Studio with real Robot POV & Screen Share.');
      } else if (app === 'instagram_post') {
        handleSnapInstagramPhoto();
        simRef.current.emotion = 'excited';
        simRef.current.speech =
          'Snapped a live 3D camera photo for Instagram Studio! Ready to publish!';
        speakRobotSpeech(simRef.current.speech, mutedRef.current);
        appendObsidianLog('instagram-snap', 'Captured live 3D Robot POV snapshot in Instagram Studio.');
      } else if (app === 'coding_agents') {
        simRef.current.emotion = 'focused';
        simRef.current.speech =
          'All 3 OpenClaw coding agents are green: PR 418 passed 18 of 18 tests with zero security criticals!';
        playRobotChirp('happy', mutedRef.current);
        speakRobotSpeech(simRef.current.speech, mutedRef.current);
      } else if (app === 'obsidian_vault') {
        simRef.current.emotion = 'curious';
        appendObsidianLog('vault-sync', 'Synced Obsidian backlink knowledge graph & daily mission log.');
      }
    },
    [appendObsidianLog, handleSnapInstagramPhoto]
  );

  const handleHideDog = useCallback(() => {
    hideDogBehindFurniture(simRef.current);
    playRobotChirp('curious', mutedRef.current);
    appendObsidianLog('search-setup', 'Hid Biscuit out of camera FOV behind room furniture.');
    setUiTick((n) => n + 1);
  }, [appendObsidianLog]);

  const handleTriggerMirrorChat = useCallback(() => {
    triggerMirrorChatAction(simRef.current);
    playRobotChirp('happy', mutedRef.current);
    speakRobotSpeech(
      'Rolling up to the Smart Mirror to check myself out and read live viewer comments!',
      mutedRef.current
    );
    appendObsidianLog(
      'smart-mirror',
      'Dispatched WALL-E to the West-Wall Smart Mirror for live interactive comment replies.'
    );
    setUiTick((n) => n + 1);
  }, [appendObsidianLog]);

  const handleNextMirrorComment = useCallback(() => {
    const item = advanceMirrorComment(simRef.current);
    playRobotChirp(item.emotion, mutedRef.current);
    setUiTick((n) => n + 1);
  }, []);

  const sendRobotCommand = useCallback(
    async (command: string, triggerType: TriggerType = 'user') => {
      const cleaned = command.trim();
      if (!cleaned) return;

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // <16ms Instant Pre-Reaction Reflex (auto-hides Biscuit out of FOV if launching a room search!)
      triggerInstantPreReaction(simRef.current, cleaned);
      playRobotChirp('curious', mutedRef.current);

      setIsThinking(true);
      setStreamText('');
      setUiTick((n) => n + 1);

      const worldState = buildWorldStateSnapshot(simRef.current);

      const handleEvent = (event: RobotCommandEvent) => {
        if (abortControllerRef.current !== controller) return;

        switch (event.type) {
          case 'thinking_start': {
            setSessionKey(event.sessionKey);
            break;
          }
          case 'thinking_delta': {
            setStreamText((prev) => prev + event.delta);
            setElapsedMs(event.elapsedMs);
            setCompletionTokens(event.completionTokens);
            setTokensPerSec((prev) => Math.max(prev, event.tokensPerSec));
            setPeakTps((prev) => Math.max(prev, event.tokensPerSec));
            break;
          }
          case 'triad_update': {
            setTriad(event.triad);
            if (event.aggregateTps > 0) {
              setTokensPerSec(event.aggregateTps);
              setPeakTps((prev) => Math.max(prev, event.aggregateTps));
            }
            if (event.perception) setPerception(event.perception);
            if (event.safety) setSafety(event.safety);
            break;
          }
          case 'step_ready': {
            applyFirstStepImmediate(
              simRef.current,
              event.step,
              event.speech,
              event.emotion
            );
            setUiTick((n) => n + 1);
            break;
          }
          case 'plan_ready': {
            setIsThinking(false);
            setStreamText('');
            const finalTps = event.aggregateTps ?? event.tokensPerSec;
            setTokensPerSec(finalTps);
            setPeakTps((prev) => Math.max(prev, finalTps));
            setDecodeMs(event.decodeMs ?? 0);
            setElapsedMs(event.elapsedMs);
            setCompletionTokens(event.completionTokens);
            setSpeedupFactor(event.speedupFactor);
            setSavedSecondsVs40Tps(event.savedSecondsVs40Tps);
            setSessionKey(event.sessionKey);
            if (event.triad) setTriad(event.triad);
            if (event.perception) setPerception(event.perception);
            if (event.safety) setSafety(event.safety);

            // Auto-switch Embodied Assistant App if OpenClaw requested one
            if (event.plan.assistantApp) {
              setActiveAssistantApp(event.plan.assistantApp);
              simRef.current.activeAssistantApp = event.plan.assistantApp;
            }
            if (event.plan.tiktokTopic) {
              setTiktokTopic(event.plan.tiktokTopic);
            }
            if (event.plan.tiktokScreenMode) {
              setTiktokScreenMode(event.plan.tiktokScreenMode);
            }
            if (event.plan.assistantApp === 'instagram_post') {
              handleSnapInstagramPhoto(
                event.plan.instagramCaption,
                event.plan.instagramHashtags
              );
            }

            applyActionPlanToSim(simRef.current, event.plan);
            playRobotChirp(event.plan.emotion, mutedRef.current);
            speakRobotSpeech(event.plan.speech, mutedRef.current);

            appendObsidianLog(
              event.plan.assistantApp && event.plan.assistantApp !== 'eyes'
                ? event.plan.assistantApp.replace('_', '-')
                : 'mission',
              event.plan.obsidianNote ||
                `${cleaned.slice(0, 60)} (${Math.round(finalTps)} tok/s · ${Math.round(event.decodeMs ?? event.elapsedMs)}ms)`
            );

            if (event.logEntry) {
              setHistory((prev) => [
                event.logEntry!,
                ...prev.filter((item) => item.id !== event.logEntry!.id),
              ]);
            } else {
              void refreshHistory();
            }
            break;
          }
          case 'command_error': {
            setIsThinking(false);
            simRef.current.preOrientTarget = null;
            simRef.current.speech = `Alert: ${event.error}`;
            simRef.current.emotion = 'alert';
            break;
          }
        }
      };

      try {
        await streamRobotCommand(
          {
            command: cleaned,
            worldState,
            model: selectedModel,
            sessionId: sessionIdRef.current,
            triggerType,
          },
          handleEvent,
          controller.signal
        );
        if (abortControllerRef.current === controller) {
          setIsThinking(false);
        }
      } catch (err) {
        if (abortControllerRef.current !== controller) return;
        setIsThinking(false);
        simRef.current.preOrientTarget = null;
        if (!controller.signal.aborted) {
          simRef.current.speech =
            err instanceof Error ? err.message : 'Failed to reach OpenClaw brain.';
        }
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [appendObsidianLog, handleSnapInstagramPhoto, refreshHistory, selectedModel]
  );

  const stopRobotCommand = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    simRef.current.preOrientTarget = null;
    setIsThinking(false);
  }, []);

  const handleSyncUiTick = useCallback(() => {
    const sim = simRef.current;

    // Handle one-shot Biscuit real-FOV discovery celebration!
    if (sim.dogDiscoveredEventPending) {
      sim.dogDiscoveredEventPending = false;
      playDiscoveryChime(mutedRef.current);
      speakRobotSpeech('Target acquired! I found Biscuit!', mutedRef.current);
      appendObsidianLog(
        'dog-found',
        `Real camera-FOV sweep spotted Biscuit in Zone ${(sim.searchZoneIndex % sim.searchTotalZones) + 1}/${sim.searchTotalZones} — target locked & chasing!`
      );
    }

    // Handle one-shot Smart Mirror live spoken reply!
    if (sim.mirrorSpeakEventPending) {
      const replyText = sim.mirrorSpeakEventPending;
      sim.mirrorSpeakEventPending = null;
      playRobotChirp(sim.emotion, mutedRef.current);
      speakRobotSpeech(replyText, mutedRef.current);
      if (sim.mirrorComment) {
        appendObsidianLog(
          'mirror-reply',
          `Replied in Smart Mirror to ${sim.mirrorComment.user}: "${replyText}"`
        );
      }
    }

    const pkt = buildEsp32Packet(sim);
    setPackets((prev) => [...prev.slice(-11), pkt]);
    setUiTick((n) => (n + 1) % 100000);
  }, [appendObsidianLog]);

  // Budget-Capped Auto-Reflex Watcher (max 4 automatic calls per session)
  useEffect(() => {
    if (!autoReflex || isThinking || reflexCount >= MAX_AUTO_REFLEX_CALLS) return;

    const timer = window.setInterval(() => {
      if (isThinking) return;
      const now = Date.now();
      if (now - lastReflexEpochRef.current < 10000) return;

      const sim = simRef.current;
      const distToDog = Math.hypot(sim.dogX - sim.x, sim.dogZ - sim.z);

      if (sim.ultrasonicCm < 38) {
        lastReflexEpochRef.current = now;
        setReflexCount((c) => {
          const next = c + 1;
          if (next >= MAX_AUTO_REFLEX_CALLS) setAutoReflex(false);
          return next;
        });
        void sendRobotCommand(
          `REFLEX: Obstacle detected at ${sim.ultrasonicCm}cm ahead! Dodge smoothly and continue exploring.`,
          'reflex'
        );
      } else if (sim.activeMode === 'idle' && sim.dogDiscovered && distToDog < 1.1) {
        lastReflexEpochRef.current = now;
        setReflexCount((c) => {
          const next = c + 1;
          if (next >= MAX_AUTO_REFLEX_CALLS) setAutoReflex(false);
          return next;
        });
        void sendRobotCommand(
          'REFLEX: Biscuit the dog just trotted close! React with excited eyes, follow playfully, and film a quick clip!',
          'reflex'
        );
      }
    }, 1500);

    return () => window.clearInterval(timer);
  }, [autoReflex, isThinking, reflexCount, sendRobotCommand]);

  const handleSelectEmotionPreview = useCallback((emotion: RobotEmotion) => {
    simRef.current.emotion = emotion;
    playRobotChirp(emotion, mutedRef.current);
    setUiTick((n) => n + 1);
  }, []);

  const handleReplayHistoryPlan = useCallback(
    (entry: MissionLogEntry) => {
      if (entry.plan.assistantApp) {
        setActiveAssistantApp(entry.plan.assistantApp);
        simRef.current.activeAssistantApp = entry.plan.assistantApp;
      }
      if (entry.plan.tiktokTopic) {
        setTiktokTopic(entry.plan.tiktokTopic);
      }
      if (entry.plan.tiktokScreenMode) {
        setTiktokScreenMode(entry.plan.tiktokScreenMode);
      }
      if (entry.plan.assistantApp === 'instagram_post') {
        handleSnapInstagramPhoto(entry.plan.instagramCaption, entry.plan.instagramHashtags);
      }
      applyActionPlanToSim(simRef.current, entry.plan);
      const tps = entry.aggregateTps ?? entry.tokensPerSec;
      setTokensPerSec(tps);
      setDecodeMs(entry.decodeMs ?? 0);
      setElapsedMs(entry.elapsedMs);
      setCompletionTokens(entry.completionTokens);
      if (entry.triad) setTriad(entry.triad);
      if (entry.perception) setPerception(entry.perception);
      if (entry.safety) setSafety(entry.safety);
      const baselineSec = entry.completionTokens / 40;
      const actualSec = Math.max(0.1, entry.elapsedMs / 1000);
      setSpeedupFactor(baselineSec / actualSec);
      setSavedSecondsVs40Tps(Math.max(0, baselineSec - actualSec));
      playRobotChirp(entry.plan.emotion, mutedRef.current);
      speakRobotSpeech(entry.plan.speech, mutedRef.current);
      setUiTick((n) => n + 1);
    },
    [handleSnapInstagramPhoto]
  );

  // Live climbing Instagram likes counter when viewing Instagram Studio
  useEffect(() => {
    if (activeAssistantApp !== 'instagram_post') return;
    const t = window.setInterval(() => {
      setInstagramPost((prev) => ({
        ...prev,
        likes: prev.likes + (prev.published ? 9 + Math.floor(Math.random() * 18) : 1),
      }));
    }, 1800);
    return () => window.clearInterval(t);
  }, [activeAssistantApp]);

  const handleToggleAutoReflex = useCallback(() => {
    setAutoReflex((prev) => {
      if (!prev && reflexCount >= MAX_AUTO_REFLEX_CALLS) {
        setReflexCount(0);
      }
      return !prev;
    });
  }, [reflexCount]);

  const availableModels: ModelOption[] =
    health?.availableModels && health.availableModels.length > 0
      ? health.availableModels
      : FALLBACK_MODELS;

  const sim = simRef.current;
  const activeStep = getActiveStep(sim);
  const activePlan: RobotActionPlan | null = sim.activePlan;

  return (
    <div className="walle-bg min-h-screen lg:h-screen lg:overflow-hidden flex flex-col text-slate-100">
      {/* Compact Top Mission Control Header */}
      <Header
        health={health}
        healthLoading={healthLoading}
        onRefreshHealth={() => void refreshHealth()}
        availableModels={availableModels}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        isThinking={isThinking}
        tokensPerSec={tokensPerSec}
        peakTps={peakTps}
        decodeMs={decodeMs}
        elapsedMs={elapsedMs}
        completionTokens={completionTokens}
        speedupFactor={speedupFactor}
        savedSecondsVs40Tps={savedSecondsVs40Tps}
        sessionKey={sessionKey}
        triad={triad}
      />

      {/* Split Layout: Left 67% (8 cols) 3D Arena + Command Dock | Right 33% (4 cols) Assistant & Hardware Dock */}
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-2.5 p-2.5 overflow-y-auto lg:overflow-hidden">
        <section className="lg:col-span-8 flex flex-col gap-2 min-h-[540px] lg:min-h-0">
          <RobotArena3D
            simRef={simRef}
            capturePovSnapshotRef={capturePovSnapshotRef}
            cameraMode={cameraMode}
            onCameraModeChange={setCameraMode}
            floorTool={floorTool}
            onFloorToolChange={setFloorTool}
            onHideDog={handleHideDog}
            onTriggerMirrorChat={handleTriggerMirrorChat}
            onNextMirrorComment={handleNextMirrorComment}
            isExpanded={isExpanded}
            onToggleExpanded={() => setIsExpanded((v) => !v)}
            isThinking={isThinking}
            activePlan={activePlan}
            activeStep={activeStep}
            activeStepIndex={sim.activeStepIndex}
            speech={sim.speech}
            tokensPerSec={tokensPerSec}
            decodeMs={decodeMs}
            elapsedMs={elapsedMs}
            speedupFactor={speedupFactor}
            triad={triad}
            history={history}
            obsidianLogs={obsidianLogs}
            activeAssistantApp={activeAssistantApp}
            tiktokTopic={tiktokTopic}
            tiktokScreenMode={tiktokScreenMode}
            onChangeTikTokScreenMode={(m) => {
              setTiktokScreenMode(m);
              if (m !== 'pov') {
                appendObsidianLog('tiktok-share', `Shared live ${m.toUpperCase()} screen on TikTok Live.`);
              }
            }}
            onCloseTikTok={() => setActiveAssistantApp('eyes')}
            onLogObsidian={appendObsidianLog}
            missions={missions}
            onTriggerMission={(preset) => void sendRobotCommand(preset.command, 'user')}
            onSyncUiTick={handleSyncUiTick}
          />

          <CommandDock
            missions={missions}
            isThinking={isThinking}
            onSendCommand={(cmd, trigger) => void sendRobotCommand(cmd, trigger)}
            onStopCommand={stopRobotCommand}
            autoReflex={autoReflex}
            reflexCount={reflexCount}
            maxReflexCount={MAX_AUTO_REFLEX_CALLS}
            onToggleAutoReflex={handleToggleAutoReflex}
          />
        </section>

        <section className="lg:col-span-4 min-h-[520px] lg:min-h-0">
          <HardwareBrainDock
            simRef={simRef}
            packets={packets}
            isThinking={isThinking}
            streamText={streamText}
            activePlan={activePlan}
            triad={triad}
            perception={perception}
            safety={safety}
            history={history}
            sessionKey={sessionKey}
            selectedModel={selectedModel}
            tokensPerSec={tokensPerSec}
            decodeMs={decodeMs}
            speedupFactor={speedupFactor}
            activeAssistantApp={activeAssistantApp}
            onSelectAssistantApp={handleSelectAssistantApp}
            obsidianLogs={obsidianLogs}
            instagramPost={instagramPost}
            onSnapInstagramPhoto={() => handleSnapInstagramPhoto()}
            onPublishInstagramPost={handlePublishInstagramPost}
            onUpdateInstagramCaption={(caption) =>
              setInstagramPost((prev) => ({ ...prev, caption }))
            }
            onLikeInstagramPost={() =>
              setInstagramPost((prev) => ({ ...prev, likes: prev.likes + 15 }))
            }
            muted={muted}
            onToggleMuted={() => setMuted((m) => !m)}
            onSelectEmotionPreview={handleSelectEmotionPreview}
            onReplayHistoryPlan={handleReplayHistoryPlan}
          />
        </section>
      </main>
    </div>
  );
}

export default App;
