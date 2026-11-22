import type { RobotEmotion } from '@shared/types';

export interface EyeRenderOptions {
  emotion: RobotEmotion;
  timeMs: number;
  gazeX: number; // -1..1
  gazeY: number; // -1..1
  isRecording: boolean;
  isThinking: boolean;
  batteryPct: number;
}

const EMOTION_COLORS: Record<RobotEmotion, { primary: string; glow: string; pupil: string }> = {
  neutral: { primary: '#22d3ee', glow: 'rgba(34, 211, 238, 0.55)', pupil: '#e0f2fe' },
  happy: { primary: '#34d399', glow: 'rgba(52, 211, 153, 0.6)', pupil: '#d1fae5' },
  curious: { primary: '#38bdf8', glow: 'rgba(56, 189, 248, 0.6)', pupil: '#f0f9ff' },
  excited: { primary: '#fbbf24', glow: 'rgba(251, 191, 36, 0.65)', pupil: '#fef3c7' },
  alert: { primary: '#fb7185', glow: 'rgba(251, 113, 133, 0.65)', pupil: '#ffe4e6' },
  love: { primary: '#f472b6', glow: 'rgba(244, 114, 182, 0.65)', pupil: '#fce7f3' },
  sleepy: { primary: '#a78bfa', glow: 'rgba(167, 139, 250, 0.45)', pupil: '#ede9fe' },
  focused: { primary: '#22d3ee', glow: 'rgba(34, 211, 238, 0.7)', pupil: '#cffafe' },
};

function drawHeart(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.beginPath();
  const topCurveHeight = size * 0.3;
  ctx.moveTo(cx, cy + topCurveHeight);
  ctx.bezierCurveTo(cx, cy, cx - size / 2, cy, cx - size / 2, cy + topCurveHeight);
  ctx.bezierCurveTo(
    cx - size / 2,
    cy + (size + topCurveHeight) / 2,
    cx,
    cy + (size + topCurveHeight) / 1.45,
    cx,
    cy + size
  );
  ctx.bezierCurveTo(
    cx,
    cy + (size + topCurveHeight) / 1.45,
    cx + size / 2,
    cy + (size + topCurveHeight) / 2,
    cx + size / 2,
    cy + topCurveHeight
  );
  ctx.bezierCurveTo(cx + size / 2, cy, cx, cy, cx, cy + topCurveHeight);
  ctx.closePath();
  ctx.fill();
}

function drawRoundedEye(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  r: number
) {
  const x = cx - w / 2;
  const y = cy - h / 2;
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
}

/**
 * Renders expressive WALL-E Android phone screen eyes onto any 2D Canvas.
 * Includes high-speed Neural Radar Scan Line + Rotating Target Reticle while `isThinking` is true.
 */
export function renderWalleEyes(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  opts: EyeRenderOptions
): void {
  const { emotion, timeMs, gazeX, gazeY, isRecording, isThinking, batteryPct } = opts;
  const activeEmotion: RobotEmotion = isThinking ? 'focused' : emotion;
  const palette = EMOTION_COLORS[activeEmotion] ?? EMOTION_COLORS.neutral;

  // Deep OLED bezel background
  ctx.fillStyle = '#04070f';
  ctx.fillRect(0, 0, width, height);

  // Subtle scanline grid on phone OLED
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.048)';
  ctx.lineWidth = 1;
  const step = Math.max(10, Math.round(height / 14));
  for (let y = step; y < height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Periodic natural blink every 3.3s (stay wide open when thinking/scanning)
  const blinkCycle = timeMs % 3300;
  let blinkFactor = 1;
  if (!isThinking && blinkCycle > 3120) {
    const t = (blinkCycle - 3120) / 180;
    blinkFactor = Math.max(0.08, Math.abs(Math.cos(t * Math.PI)));
  }
  if (!isThinking && activeEmotion === 'sleepy') {
    blinkFactor = Math.min(blinkFactor, 0.36 + 0.08 * Math.sin(timeMs * 0.0025));
  }

  // Bounce & gaze offsets (high-speed radar sweep while isThinking!)
  const bounceY =
    activeEmotion === 'excited'
      ? Math.sin(timeMs * 0.014) * (height * 0.035)
      : Math.sin(timeMs * 0.003) * (height * 0.01);

  const effectiveGazeX = isThinking ? Math.sin(timeMs * 0.012) * 0.72 : gazeX;
  const gx = Math.max(-1, Math.min(1, effectiveGazeX)) * (width * 0.048);
  const gy = Math.max(-1, Math.min(1, gazeY)) * (height * 0.045) + bounceY;

  const baseEyeW = width * 0.245;
  const baseEyeH = height * 0.37;
  const leftCx = width * 0.32 + gx;
  const rightCx = width * 0.68 + gx;
  const centerCy = height * 0.54 + gy;

  ctx.save();
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = width * 0.065;
  ctx.fillStyle = palette.primary;
  ctx.strokeStyle = palette.primary;

  if (!isThinking && activeEmotion === 'happy') {
    // Joyful upward crescent arcs (^ ^)
    ctx.lineWidth = Math.max(4, width * 0.034);
    ctx.lineCap = 'round';
    for (const cx of [leftCx, rightCx]) {
      ctx.beginPath();
      ctx.arc(cx, centerCy + baseEyeH * 0.12, baseEyeW * 0.48, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
    }
  } else if (!isThinking && activeEmotion === 'love') {
    const pulse = 1 + 0.1 * Math.sin(timeMs * 0.01);
    const size = baseEyeW * 0.85 * pulse;
    drawHeart(ctx, leftCx, centerCy - size * 0.48, size);
    drawHeart(ctx, rightCx, centerCy - size * 0.48, size);
  } else {
    const leftScale = activeEmotion === 'curious' ? 0.82 : 1;
    const rightScale = activeEmotion === 'curious' ? 1.2 : 1;

    const lw = baseEyeW * leftScale;
    const lh = Math.max(4, baseEyeH * leftScale * blinkFactor);
    const rw = baseEyeW * rightScale;
    const rh = Math.max(4, baseEyeH * rightScale * blinkFactor);

    drawRoundedEye(ctx, leftCx, centerCy, lw, lh, lw * 0.34);
    drawRoundedEye(ctx, rightCx, centerCy, rw, rh, rw * 0.34);

    // Specular pupil highlights & Target-Lock Reticles
    if (blinkFactor > 0.35) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = palette.pupil;
      const pOffsetX = gx * 0.35;
      const pOffsetY = -lh * 0.18;
      ctx.beginPath();
      ctx.arc(leftCx - lw * 0.18 + pOffsetX, centerCy + pOffsetY, lw * 0.11, 0, Math.PI * 2);
      ctx.arc(rightCx - rw * 0.18 + pOffsetX, centerCy + pOffsetY, rw * 0.11, 0, Math.PI * 2);
      ctx.fill();

      if (activeEmotion === 'focused' || isThinking) {
        for (const [cx, eh] of [
          [leftCx, lh],
          [rightCx, rh],
        ] as const) {
          const r = baseEyeW * 0.24;
          ctx.save();
          ctx.translate(cx, centerCy);
          if (isThinking) {
            ctx.rotate(timeMs * 0.006);
          }
          ctx.strokeStyle = '#04070f';
          ctx.lineWidth = Math.max(1.6, width * 0.007);
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.moveTo(-r * 1.45, 0);
          ctx.lineTo(-r * 0.55, 0);
          ctx.moveTo(r * 0.55, 0);
          ctx.lineTo(r * 1.45, 0);
          ctx.moveTo(0, -r * 1.45);
          ctx.lineTo(0, -r * 0.55);
          ctx.moveTo(0, r * 0.55);
          ctx.lineTo(0, r * 1.45);
          ctx.stroke();
          ctx.restore();

          // Sweeping Neural Radar Scan Line inside each eye while thinking
          if (isThinking) {
            const scanOffset = (((timeMs * 0.18) % eh) - eh * 0.5) * 0.78;
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(cx - baseEyeW * 0.42, centerCy + scanOffset, baseEyeW * 0.84, 2.2);
          }
        }
      }
    }

    if (activeEmotion === 'alert' || activeEmotion === 'curious') {
      ctx.strokeStyle = palette.primary;
      ctx.lineWidth = Math.max(2.5, width * 0.015);
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (activeEmotion === 'alert') {
        ctx.moveTo(leftCx - lw * 0.5, centerCy - lh * 0.72);
        ctx.lineTo(leftCx + lw * 0.45, centerCy - lh * 0.52);
        ctx.moveTo(rightCx + rw * 0.5, centerCy - rh * 0.72);
        ctx.lineTo(rightCx - rw * 0.45, centerCy - rh * 0.52);
      } else {
        ctx.moveTo(leftCx - lw * 0.45, centerCy - lh * 0.62);
        ctx.lineTo(leftCx + lw * 0.45, centerCy - lh * 0.62);
        ctx.moveTo(rightCx - rw * 0.45, centerCy - rh * 0.58);
        ctx.lineTo(rightCx + rw * 0.45, centerCy - rh * 0.76);
      }
      ctx.stroke();
    }
  }
  ctx.restore();

  // Top Android Status Bar
  const fontSize = Math.max(8, Math.round(width * 0.036));
  ctx.font = `700 ${fontSize}px "JetBrains Mono", monospace`;
  ctx.fillStyle = isThinking ? '#22d3ee' : 'rgba(148, 163, 184, 0.78)';
  ctx.fillText(isThinking ? 'TRIAD NEURAL SCAN' : 'OPENCLAW BRAIN', width * 0.05, height * 0.13);

  // Battery / Thinking / Recording right status
  if (isRecording) {
    const pulseOn = Math.floor(timeMs / 350) % 2 === 0;
    ctx.fillStyle = pulseOn ? '#fb7185' : 'rgba(251, 113, 133, 0.35)';
    ctx.beginPath();
    ctx.arc(width * 0.79, height * 0.105, fontSize * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fecdd3';
    ctx.fillText('REC', width * 0.83, height * 0.13);
  } else if (isThinking) {
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('2000+ T/S', width * 0.72, height * 0.13);
  } else {
    ctx.fillStyle = '#34d399';
    ctx.fillText(`${Math.round(batteryPct)}%`, width * 0.84, height * 0.13);
  }
}
