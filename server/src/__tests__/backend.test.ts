import assert from 'node:assert/strict';
import http from 'node:http';
import { describe, it } from 'node:test';
import { createApp } from '../index.js';
import {
  parseOpenAiSseData,
  parseSseBuffer,
  streamOpenClawCompletion,
} from '../openclawClient.js';
import {
  computeSpeedComparison,
  formatWorldStateForPrompt,
  parsePerceptionReadout,
  parseRobotActionPlan,
  parseSafetyAuditReadout,
  pushOutOfFurniture,
  salvageStepsFromPartialText,
  sanitizeActionStep,
} from '../planParser.js';

describe('planParser', () => {
  it('parses fenced RobotActionPlan JSON and clamps speed & durationMs', () => {
    const raw = `\`\`\`json
    {
      "speech": "BEEP! Chasing the puppy!",
      "emotion": "excited",
      "recordVideo": true,
      "reasoning": "Dog is 1.4m ahead at 15 degrees.",
      "steps": [
        { "action": "follow_dog", "target": "dog", "durationMs": 15000, "speed": 2.5, "label": "Full throttle dog chase" },
        { "action": "record_video", "target": "dog", "durationMs": 400, "speed": 0.05, "label": "Quick clip" }
      ]
    }
    \`\`\``;
    const plan = parseRobotActionPlan(raw, 'Chase the dog');
    assert.equal(plan.emotion, 'excited');
    assert.equal(plan.recordVideo, true);
    assert.equal(plan.steps.length, 2);
    assert.equal(plan.steps[0].action, 'follow_dog');
    assert.equal(plan.steps[0].durationMs, 9000);
    assert.equal(plan.steps[0].speed, 1.0);
    assert.equal(plan.steps[1].durationMs, 1200);
    assert.equal(plan.steps[1].speed, 0.2);
  });

  it('normalizes synonym actions/emotions and salvages truncated JSON steps', () => {
    const truncated = `{"speech":"Heart eyes spin!","emotion":"heart","steps":[
      {"action":"spin_dance","durationMs":2500,"speed":0.85,"label":"360 spin"},
      {"action":"find_owner","target":"owner","durationMs":3000,"speed":0.7,"label":"Wave at human"},
      {"action":"truncated`;
    const plan = parseRobotActionPlan(truncated, 'Dance');
    assert.equal(plan.emotion, 'love');
    assert.equal(plan.steps.length, 2);
    assert.equal(plan.steps[0].action, 'spin_dance');
    assert.equal(plan.steps[1].action, 'find_owner');
  });

  it('synthesizes a smart multi-step fallback plan when output is non-JSON', () => {
    const dogFallback = parseRobotActionPlan('oops no json', 'Search Room & Film Dog');
    assert.equal(dogFallback.recordVideo, true);
    assert.ok(dogFallback.steps.length >= 2);
    assert.equal(dogFallback.steps[0].action, 'search_dog');

    const dockFallback = parseRobotActionPlan('', 'Return to Charging Dock');
    assert.equal(dockFallback.emotion, 'sleepy');
    assert.equal(dockFallback.steps[0].action, 'return_to_dock');
  });

  it('enforces NO CHEATING search_dog & redacts dog coordinates when dogDiscovered is false', () => {
    const hiddenWorld = {
      x: 0,
      z: 0,
      headingDeg: 0,
      batteryPct: 95,
      leftPwm: 0,
      rightPwm: 0,
      ultrasonicCm: 180,
      activeMode: 'idle' as const,
      emotion: 'neutral' as const,
      isRecording: false,
      dogDiscovered: false,
      entities: [
        { id: 'dog', kind: 'dog' as const, label: 'Biscuit', x: -2.8, z: -1.1, distance: 3.01, angleDeg: -115 },
        { id: 'owner', kind: 'owner' as const, label: 'Owner', x: 2.2, z: 1.5, distance: 2.66, angleDeg: 35 },
      ],
    };

    const redactedPrompt = formatWorldStateForPrompt(hiddenWorld);
    assert.ok(!redactedPrompt.includes('-2.8'));
    assert.ok(!redactedPrompt.includes('Biscuit'));
    assert.ok(redactedPrompt.includes('"detected": false'));
    assert.ok(redactedPrompt.includes('search_dog'));
    assert.ok(redactedPrompt.includes('Owner'));

    const visiblePrompt = formatWorldStateForPrompt({ ...hiddenWorld, dogDiscovered: true });
    assert.ok(visiblePrompt.includes('-2.8'));
    assert.ok(visiblePrompt.includes('Biscuit'));

    // Even if LLM tries to cheat with follow_dog while dogDiscovered === false, parser prepends search_dog!
    const cheatJson = JSON.stringify({
      speech: 'Going right to Biscuit!',
      emotion: 'excited',
      recordVideo: true,
      reasoning: 'Chasing dog',
      steps: [{ action: 'follow_dog', target: 'dog', durationMs: 3000, speed: 0.85, label: 'Chase' }],
    });
    const plan = parseRobotActionPlan(cheatJson, 'Find and film the dog', hiddenWorld);
    assert.equal(plan.steps[0].action, 'search_dog');
    assert.equal(plan.steps[1].action, 'follow_dog');
  });

  it('parses assistantApp, obsidianNote, tiktokTopic and infers bilingual EN/ES assistant modes', () => {
    const rawTikTok = JSON.stringify({
      speech: '¡Hola TikTok Live!',
      emotion: 'excited',
      recordVideo: false,
      reasoning: 'Launching live stream',
      assistantApp: 'tiktok_live',
      tiktokTopic: 'Cerebras × OpenClaw WALL-E Live',
      obsidianNote: 'Broadcasted live robotics demo',
      steps: [{ action: 'patrol', target: 'center', durationMs: 3000, speed: 0.65, label: 'Pan camera' }],
    });
    const parsed = parseRobotActionPlan(rawTikTok, 'Comienza un live en TikTok');
    assert.equal(parsed.assistantApp, 'tiktok_live');
    assert.equal(parsed.recordVideo, true);
    assert.equal(parsed.tiktokTopic, 'Cerebras × OpenClaw WALL-E Live');
    assert.equal(parsed.obsidianNote, 'Broadcasted live robotics demo');

    assert.equal(parseRobotActionPlan('', 'Check my coding agents').assistantApp, 'coding_agents');
    assert.equal(parseRobotActionPlan('', 'Revisa mis agentes de código').assistantApp, 'coding_agents');
    assert.equal(parseRobotActionPlan('', 'Log this in Obsidian vault').assistantApp, 'obsidian_vault');
    assert.equal(parseRobotActionPlan('', 'Muéstrame las gráficas de analytics').assistantApp, 'analytics_charts');

    const instaPlan = parseRobotActionPlan('', 'Publica una foto de Biscuit en Instagram');
    assert.equal(instaPlan.assistantApp, 'instagram_post');
    assert.ok(instaPlan.instagramCaption && instaPlan.instagramCaption.length > 5);
    assert.ok(Array.isArray(instaPlan.instagramHashtags) && instaPlan.instagramHashtags.length >= 2);

    const screenSharePlan = parseRobotActionPlan('', 'Start TikTok Live and share screen with charts');
    assert.equal(screenSharePlan.assistantApp, 'tiktok_live');
    assert.equal(screenSharePlan.tiktokScreenMode, 'charts');

    const mirrorPlan = parseRobotActionPlan('', 'Acércate al espejo y lee los comentarios');
    assert.equal(mirrorPlan.steps[0].action, 'mirror_chat');
    assert.equal(mirrorPlan.steps[0].target, 'mirror');

    const catPlan = parseRobotActionPlan('', 'Go say hi to Mochi the cat');
    assert.equal(catPlan.steps[0].target, 'cat');

    const birdPlan = parseRobotActionPlan('', 'Track Rio el pájaro volando');
    assert.equal(birdPlan.steps[0].target, 'bird');
  });

  it('clamps waypoint coordinates to spacious 22m x 16m loft bounds, pushes waypoints out of all 10 furniture items, and computes speed comparison', () => {
    const step = sanitizeActionStep({
      action: 'go_to',
      x: 15.4,
      z: -12.8,
      durationMs: 3000,
      speed: 0.75,
      label: 'Corner waypoint',
    });
    assert.ok(step);
    assert.equal(step.x, 9.6);
    assert.equal(step.z, -6.6);

    // Waypoint placed inside coffee table (-6.0, -1.8, radius 0.68) is pushed outward >= 1.13m away
    const pushedTable = pushOutOfFurniture(-6.0, -1.8);
    const distFromTable = Math.hypot(pushedTable.x - -6.0, pushedTable.z - -1.8);
    assert.ok(distFromTable >= 1.11);

    // Waypoint placed inside kitchen island (6.4, -4.6, radius 0.82) is pushed outward >= 1.27m away
    const pushedIsland = pushOutOfFurniture(6.4, -4.6);
    const distFromIsland = Math.hypot(pushedIsland.x - 6.4, pushedIsland.z - -4.6);
    assert.ok(distFromIsland >= 1.25);

    // Waypoint placed inside robotics workbench desk (6.2, 4.0, radius 0.80) is pushed outward >= 1.25m away
    const pushedDesk = pushOutOfFurniture(6.2, 4.0);
    const distFromDesk = Math.hypot(pushedDesk.x - 6.2, pushedDesk.z - 4.0);
    assert.ok(distFromDesk >= 1.23);

    const cmp = computeSpeedComparison(800, 1000, 1600);
    assert.equal(cmp.speedupFactor, 40);
    assert.ok(cmp.savedSecondsVs40Tps > 15);
  });

  it('parses Triad perception, safety readouts, and incremental first step', () => {
    const steps = salvageStepsFromPartialText(
      '{"speech":"Chirp!","emotion":"excited","steps":[{"action":"follow_dog","target":"dog","durationMs":3000,"speed":0.8,"label":"Chase"}, {"action":"incomp',
    );
    assert.equal(steps.length, 1);
    assert.equal(steps[0].action, 'follow_dog');

    const per = parsePerceptionReadout(
      '{"targetLock":"Biscuit (Dog)","confidencePct":98,"clearanceM":1.15,"hazard":"Clear corridor"}',
    );
    assert.equal(per.targetLock, 'Biscuit (Dog)');
    assert.equal(per.confidencePct, 98);

    const saf = parseSafetyAuditReadout(
      '{"status":"SAFE","maxPwm":0.9,"sonarMarginCm":112,"watchdogMs":500,"note":"TB6612FNG nominal"}',
    );
    assert.equal(saf.status, 'SAFE');
    assert.equal(saf.watchdogMs, 500);
  });
});

describe('openclawClient SSE streaming', () => {
  it('parses chunked SSE frames and streams with clawbot session header', async () => {
    const chunk = 'data: {"choices":[{"delta":{"content":"{\\"speech\\":"}}]}\n\ndata: [DONE]\n\n';
    const { frames } = parseSseBuffer(chunk);
    assert.equal(frames.length, 2);
    assert.equal(parseOpenAiSseData(frames[0].data).contentDelta, '{"speech":');
    assert.equal(parseOpenAiSseData(frames[1].data).done, true);

    let seenHeaders: http.IncomingHttpHeaders = {};
    let seenBody: Record<string, unknown> = {};

    const server = http.createServer((req, res) => {
      seenHeaders = req.headers;
      let raw = '';
      req.on('data', (c) => {
        raw += c;
      });
      req.on('end', () => {
        seenBody = JSON.parse(raw) as Record<string, unknown>;
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write('data: {"choices":[{"delta":{"content":"{\\"speech\\":\\"Beep!\\"}"}}]}\n\n');
        res.write('data: {"choices":[],"usage":{"prompt_tokens":120,"completion_tokens":44}}\n\n');
        res.write('data: [DONE]\n\n');
        res.end();
      });
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    assert.ok(addr && typeof addr !== 'string');

    try {
      const result = await streamOpenClawCompletion({
        sessionId: 'walle-demo-1',
        model: 'cerebras/qwen-3.8-27b',
        gatewayUrl: `http://127.0.0.1:${addr.port}`,
        authToken: 'test-token',
        messages: [{ role: 'user', content: 'Spin dance' }],
      });

      assert.equal(seenHeaders['x-openclaw-model'], 'cerebras/qwen-3.8-27b');
      assert.equal(seenHeaders['x-openclaw-agent-id'], 'clawswarm');
      assert.ok(
        typeof seenHeaders['x-openclaw-session-key'] === 'string' &&
          seenHeaders['x-openclaw-session-key'].startsWith('agent:clawswarm:clawbot-'),
      );
      assert.equal(seenBody.model, 'openclaw/clawswarm');
      assert.equal(seenBody.reasoning_effort, 'low');
      assert.ok(typeof seenBody.user === 'string' && seenBody.user.startsWith('clawbot-'));
      assert.ok(result.sessionKey.startsWith('agent:clawswarm:clawbot-'));
      assert.ok(result.decodeMs >= 140);
      assert.equal(result.completionTokens, 44);
    } finally {
      server.close();
    }
  });
});

describe('Express API routes', () => {
  it('serves 8 viral missions, downloadable ESP32 firmware, history, and validates commands', async () => {
    const app = createApp();
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    assert.ok(addr && typeof addr !== 'string');
    const base = `http://127.0.0.1:${addr.port}`;

    try {
      const missionsRes = await fetch(`${base}/api/missions`);
      assert.equal(missionsRes.status, 200);
      const missions = (await missionsRes.json()) as Array<{ id: string }>;
      assert.equal(missions.length, 8);

      const fwRes = await fetch(`${base}/api/firmware`);
      assert.equal(fwRes.status, 200);
      const fwText = await fwRes.text();
      assert.ok(fwText.includes('115200'));
      assert.ok(fwText.includes('PWMA'));

      const histRes = await fetch(`${base}/api/history`);
      assert.equal(histRes.status, 200);
      const hist = await histRes.json();
      assert.ok(Array.isArray(hist));

      const badCmd = await fetch(`${base}/api/robot/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: '   ' }),
      });
      assert.equal(badCmd.status, 400);
    } finally {
      server.close();
    }
  });
});
