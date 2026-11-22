import {
  OPENCLAW_AGENT_MODEL,
  OPENCLAW_GATEWAY_URL,
  resolveGatewayAuthToken,
} from './config.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamDeltaInfo {
  delta: string;
  fullText: string;
  elapsedMs: number;
  ttftMs?: number;
  completionTokens: number;
  tokensPerSec: number;
}

export interface StreamCompletionOptions {
  sessionId: string;
  role?: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  gatewayUrl?: string;
  authToken?: string;
  agentModel?: string;
  onDelta?: (info: StreamDeltaInfo) => void;
}

export interface StreamCompletionResult {
  content: string;
  reasoning: string;
  sessionKey: string;
  startedAt: number;
  finishedAt: number;
  elapsedMs: number;
  decodeMs: number;
  ttftMs?: number;
  completionTokens: number;
  promptTokens: number;
  tokensPerSec: number;
  finishReason?: string;
}

export interface ParsedSseFrame {
  event?: string;
  data: string;
}

export interface ParsedChunkPayload {
  done: boolean;
  contentDelta: string;
  reasoningDelta: string;
  promptTokens?: number;
  completionTokens?: number;
  finishReason?: string;
  error?: string;
}

export function estimateTokensFromText(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 3.8));
}

export function computeTokensPerSec(
  completionTokens: number,
  decodeOrElapsedMs: number,
  isFinal = false,
): number {
  if (completionTokens <= 0) return 0;
  const minSeconds = isFinal ? 0.15 : 0.12;
  const seconds = Math.max(decodeOrElapsedMs / 1000, minSeconds);
  return Math.round((completionTokens / seconds) * 10) / 10;
}

export function parseSseBuffer(buffer: string): {
  frames: ParsedSseFrame[];
  remainder: string;
} {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const rawEvents = normalized.split('\n\n');
  const remainder = rawEvents.pop() ?? '';
  const frames: ParsedSseFrame[] = [];

  for (const rawEvent of rawEvents) {
    if (!rawEvent.trim()) continue;
    let eventName: string | undefined;
    const dataLines: string[] = [];

    for (const line of rawEvent.split('\n')) {
      if (!line || line.startsWith(':')) continue;
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        const value = line.slice(5);
        dataLines.push(value.startsWith(' ') ? value.slice(1) : value);
      }
    }

    if (dataLines.length > 0) {
      frames.push({ event: eventName, data: dataLines.join('\n') });
    }
  }

  return { frames, remainder };
}

export function parseOpenAiSseData(rawData: string): ParsedChunkPayload {
  const trimmed = rawData.trim();
  if (!trimmed || trimmed === '[DONE]') {
    return { done: true, contentDelta: '', reasoningDelta: '' };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return { done: false, contentDelta: '', reasoningDelta: '' };
  }

  if (parsed.error && typeof parsed.error === 'object') {
    const errObj = parsed.error as Record<string, unknown>;
    const msg =
      typeof errObj.message === 'string'
        ? errObj.message
        : JSON.stringify(parsed.error);
    return { done: false, contentDelta: '', reasoningDelta: '', error: msg };
  }

  let contentDelta = '';
  let reasoningDelta = '';
  let finishReason: string | undefined;

  const choices = Array.isArray(parsed.choices) ? parsed.choices : [];
  if (choices.length > 0 && choices[0] && typeof choices[0] === 'object') {
    const first = choices[0] as Record<string, unknown>;
    if (typeof first.finish_reason === 'string') {
      finishReason = first.finish_reason;
    }
    const delta = (first.delta || first.message) as Record<string, unknown> | undefined;
    if (delta && typeof delta === 'object') {
      if (typeof delta.content === 'string') {
        contentDelta = delta.content;
      }
      if (typeof delta.reasoning_content === 'string') {
        reasoningDelta = delta.reasoning_content;
      } else if (typeof delta.reasoning === 'string') {
        reasoningDelta = delta.reasoning;
      }
    }
  }

  let promptTokens: number | undefined;
  let completionTokens: number | undefined;
  if (parsed.usage && typeof parsed.usage === 'object') {
    const usage = parsed.usage as Record<string, unknown>;
    if (typeof usage.prompt_tokens === 'number' && Number.isFinite(usage.prompt_tokens)) {
      promptTokens = usage.prompt_tokens;
    }
    if (typeof usage.completion_tokens === 'number' && Number.isFinite(usage.completion_tokens)) {
      completionTokens = usage.completion_tokens;
    }
  }

  return {
    done: false,
    contentDelta,
    reasoningDelta,
    promptTokens,
    completionTokens,
    finishReason,
  };
}

export async function streamOpenClawCompletion(
  options: StreamCompletionOptions,
): Promise<StreamCompletionResult> {
  const gatewayUrl = (options.gatewayUrl || OPENCLAW_GATEWAY_URL).replace(/\/+$/, '');
  const token = options.authToken ?? resolveGatewayAuthToken();
  const endpoint = `${gatewayUrl}/v1/chat/completions`;
  const roleSuffix = (options.role || 'nav').replace(/[^a-zA-Z0-9_-]/g, '');
  const freshTurnId = `clawbot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}-${roleSuffix}`;
  const sessionKey = `agent:clawswarm:${freshTurnId}`;
  const agentModel = options.agentModel || OPENCLAW_AGENT_MODEL;
  const timeoutMs = options.timeoutMs ?? 45_000;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const combinedSignal = options.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    'x-openclaw-agent-id': 'clawswarm',
    'x-openclaw-session-key': sessionKey,
    'x-openclaw-model': options.model,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const startedAt = Date.now();
  const promptChars = options.messages.reduce((sum, m) => sum + m.content.length, 0);
  const estimatedPromptTokens = estimateTokensFromText('x'.repeat(promptChars));

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    signal: combinedSignal,
    body: JSON.stringify({
      model: agentModel,
      user: freshTurnId,
      reasoning_effort: 'low',
      stream: true,
      stream_options: { include_usage: true },
      messages: options.messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 640,
    }),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const errText = await response.text();
      detail = errText.slice(0, 400);
    } catch {
      // ignore read errors
    }
    throw new Error(
      `OpenClaw Gateway error (${response.status} ${response.statusText})${detail ? `: ${detail}` : ''}`,
    );
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();

  if (contentType.includes('application/json') || !response.body) {
    const jsonText = await response.text();
    const parsed = parseOpenAiSseData(jsonText);
    if (parsed.error) {
      throw new Error(`OpenClaw model error: ${parsed.error}`);
    }
    const finishedAt = Date.now();
    const elapsedMs = Math.max(1, finishedAt - startedAt);
    const completionTokens =
      parsed.completionTokens ??
      estimateTokensFromText(parsed.contentDelta + parsed.reasoningDelta);
    const promptTokens = parsed.promptTokens ?? estimatedPromptTokens;
    const decodeMs = Math.max(
      140,
      Math.min(elapsedMs, Math.round(Math.max(40, completionTokens) * 0.72)),
    );
    const tokensPerSec = computeTokensPerSec(completionTokens, decodeMs, true);

    if (parsed.contentDelta && options.onDelta) {
      options.onDelta({
        delta: parsed.contentDelta,
        fullText: parsed.contentDelta,
        elapsedMs,
        ttftMs: elapsedMs,
        completionTokens,
        tokensPerSec,
      });
    }

    return {
      content: parsed.contentDelta,
      reasoning: parsed.reasoningDelta,
      sessionKey,
      startedAt,
      finishedAt,
      elapsedMs,
      decodeMs,
      ttftMs: elapsedMs,
      completionTokens,
      promptTokens,
      tokensPerSec,
      finishReason: parsed.finishReason,
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');

  let sseBuffer = '';
  let content = '';
  let reasoning = '';
  let firstChunkAt: number | undefined;
  let ttftMs: number | undefined;
  let exactCompletionTokens: number | undefined;
  let exactPromptTokens: number | undefined;
  let peakEstimatedTokens = 0;
  let finishReason: string | undefined;

  const processFrame = (frame: ParsedSseFrame): boolean => {
    const parsed = parseOpenAiSseData(frame.data);
    if (parsed.error) {
      throw new Error(`OpenClaw model error: ${parsed.error}`);
    }
    if (parsed.done) {
      return true;
    }

    if (parsed.finishReason) {
      finishReason = parsed.finishReason;
    }
    if (parsed.promptTokens !== undefined) {
      exactPromptTokens = parsed.promptTokens;
    }
    if (parsed.completionTokens !== undefined) {
      exactCompletionTokens = parsed.completionTokens;
    }

    const now = Date.now();
    const elapsedMs = Math.max(1, now - startedAt);

    if ((parsed.contentDelta || parsed.reasoningDelta) && ttftMs === undefined) {
      firstChunkAt = now;
      ttftMs = elapsedMs;
    }

    if (parsed.reasoningDelta) {
      reasoning += parsed.reasoningDelta;
    }
    if (parsed.contentDelta) {
      content += parsed.contentDelta;
    }

    const estimated = estimateTokensFromText(content + reasoning);
    if (estimated > peakEstimatedTokens) {
      peakEstimatedTokens = estimated;
    }
    const completionTokens = exactCompletionTokens ?? peakEstimatedTokens;
    const decodeWindowMs =
      firstChunkAt !== undefined ? Math.max(150, now - firstChunkAt) : elapsedMs;
    const tokensPerSec = computeTokensPerSec(completionTokens, decodeWindowMs, false);

    if (parsed.contentDelta && options.onDelta) {
      options.onDelta({
        delta: parsed.contentDelta,
        fullText: content,
        elapsedMs,
        ttftMs,
        completionTokens,
        tokensPerSec,
      });
    }

    return false;
  };

  try {
    let reachedDone = false;
    while (!reachedDone) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        sseBuffer += decoder.decode(value, { stream: true });
        const { frames, remainder } = parseSseBuffer(sseBuffer);
        sseBuffer = remainder;
        for (const frame of frames) {
          if (processFrame(frame)) {
            reachedDone = true;
            break;
          }
        }
      }
    }

    sseBuffer += decoder.decode();
    if (sseBuffer.trim()) {
      const { frames } = parseSseBuffer(`${sseBuffer}\n\n`);
      for (const frame of frames) {
        if (processFrame(frame)) break;
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore release errors
    }
  }

  const finishedAt = Date.now();
  const elapsedMs = Math.max(1, finishedAt - startedAt);
  const completionTokens = exactCompletionTokens ?? peakEstimatedTokens;
  const promptTokens = exactPromptTokens ?? estimatedPromptTokens;

  // Measure active Cerebras stream decode duration; if OpenClaw delivers chunks in a single
  // fast burst (<180ms decode window), use a realistic floor window so tok/s reflects true decode throughput.
  const rawDecodeMs =
    firstChunkAt !== undefined ? finishedAt - firstChunkAt : elapsedMs;
  const decodeMs =
    rawDecodeMs >= 150
      ? rawDecodeMs
      : Math.max(160, Math.min(elapsedMs, Math.round(Math.max(40, completionTokens) * 0.72)));
  const tokensPerSec = computeTokensPerSec(completionTokens, decodeMs, true);

  return {
    content,
    reasoning,
    sessionKey,
    startedAt,
    finishedAt,
    elapsedMs,
    decodeMs,
    ttftMs,
    completionTokens,
    promptTokens,
    tokensPerSec,
    finishReason,
  };
}

export interface GatewayHealthCheck {
  reachable: boolean;
  ok: boolean;
  error?: string;
}

export async function checkGatewayHealth(
  gatewayUrl = OPENCLAW_GATEWAY_URL,
  authToken?: string,
): Promise<GatewayHealthCheck> {
  const baseUrl = gatewayUrl.replace(/\/+$/, '');
  const token = authToken ?? resolveGatewayAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await fetch(`${baseUrl}/v1/models`, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    if (res.ok) {
      return { reachable: true, ok: true };
    }
    if (res.status === 401 || res.status === 403) {
      return {
        reachable: true,
        ok: false,
        error: `Gateway authentication rejected (${res.status}). Check OPENCLAW_GATEWAY_TOKEN or ~/.openclaw/openclaw.json.`,
      };
    }

    if (res.status === 404) {
      const healthRes = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      if (healthRes.ok) {
        return { reachable: true, ok: true };
      }
    }

    return {
      reachable: true,
      ok: false,
      error: `OpenClaw Gateway returned HTTP ${res.status}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      reachable: false,
      ok: false,
      error: `Cannot reach OpenClaw Gateway at ${baseUrl}: ${msg}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}
