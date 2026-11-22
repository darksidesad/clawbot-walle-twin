import type {
  AssistantAppMode,
  Esp32Packet,
  RobotActionPlan,
  RobotActionStep,
  RobotActionType,
  RobotEmotion,
  RobotTarget,
  RobotWorldState,
  WorldEntity,
} from '@shared/types';

export type FloorToolMode = 'none' | 'move_dog' | 'drop_crate';

export type DetourPhase = 'none' | 'reversing' | 'pivoting';

export interface ObstacleItem {
  id: string;
  label: string;
  x: number;
  z: number;
  radius: number;
}

export interface WaypointNode {
  x: number;
  z: number;
  label: string;
  active: boolean;
}

export interface Point2D {
  x: number;
  z: number;
}

export interface MirrorCommentItem {
  user: string;
  text: string;
  reply: string;
  emotion: RobotEmotion;
}

export const MIRROR_COMMENTS: MirrorCommentItem[] = [
  {
    user: '@maya_live',
    text: 'OMG WALL-E checking himself out in the smart mirror is TOO cute!! 😍',
    reply: 'Aww thank you Maya! Checking my yellow chassis in 4K — looking shiny at 1,500 tokens per second!',
    emotion: 'love',
  },
  {
    user: '@carlos_dev',
    text: '¡Hola WALL-E! Say hi to Mochi, Luna, and Rio flying around the loft! 🐱🦜',
    reply: 'Hey Carlos! Mochi and Luna are vibing on the rug while Rio is flying laps overhead!',
    emotion: 'happy',
  },
  {
    user: '@cerebras_fan',
    text: 'Wait — this $25 bot is seriously running 3 parallel OpenClaw agents?! ⚡',
    reply: 'Yes! Three parallel OpenClaw agents on Cerebras silicon — faster than you can blink!',
    emotion: 'excited',
  },
  {
    user: '@pet_lover',
    text: 'Give us heart eyes in the mirror right now!! ❤️🤖',
    reply: 'Heart eyes activated! Sending love straight through the Smart Mirror to everyone watching!',
    emotion: 'love',
  },
];

export const SMART_MIRROR_POS = { x: -10.55, z: -2.2 };
export const SMART_MIRROR_STAND = { x: -9.1, z: -2.2 };

export interface PhysicsSimState {
  x: number;
  z: number;
  headingRad: number; // 0 = +Z, +PI/2 = +X
  leftPwm: number;
  rightPwm: number;
  leftWheelAngle: number;
  rightWheelAngle: number;
  ultrasonicCm: number;
  batteryPct: number;
  activeMode: RobotActionType | 'idle';
  emotion: RobotEmotion;
  isRecording: boolean;
  speech: string;
  gazeX: number;
  gazeY: number;

  // Real Camera-FOV Room Search State (NO CHEATING!)
  dogDiscovered: boolean;
  searchZoneIndex: number;
  searchTotalZones: number;
  searchStatusText: string;
  justFoundDogAt: number;
  dogDiscoveredEventPending: boolean;
  searchZoneHoldMs: number;
  searchSweepPhase: number;
  activeAssistantApp: AssistantAppMode;

  // 2D Occupancy-Grid A* Pathfinding & Explicit Reverse-and-Detour Avoidance
  plannedPathPoints: Point2D[];
  detourPhase: DetourPhase;
  detourTimerMs: number;
  detourTargetAngle: number;
  lastAStarAt: number;
  lastAStarGoalX: number;
  lastAStarGoalZ: number;
  lastAStarCrateCount: number;
  isAvoiding: boolean;
  avoidingLabel: string | null;
  repulsionX: number;
  repulsionZ: number;
  sonarReflexActive: boolean;
  arrivalHoldMs: number;
  preOrientTarget: RobotTarget | null;

  // Active plan execution queue
  activePlan: RobotActionPlan | null;
  activeStepIndex: number;
  stepElapsedMs: number;
  patrolIndex: number;
  orbitAngle: number;
  streamingFirstStep: boolean;

  // Animated Dog state
  dogX: number;
  dogZ: number;
  dogHeadingRad: number;
  dogTargetX: number;
  dogTargetZ: number;
  dogWaitSec: number;
  dogLegPhase: number;

  // Animated Ginger Tabby Cat ("Mochi")
  mochiX: number;
  mochiZ: number;
  mochiHeadingRad: number;
  mochiTargetX: number;
  mochiTargetZ: number;
  mochiWaitSec: number;
  mochiLegPhase: number;

  // Animated Midnight-Violet Tuxedo Cat ("Luna")
  lunaX: number;
  lunaZ: number;
  lunaHeadingRad: number;
  lunaTargetX: number;
  lunaTargetZ: number;
  lunaWaitSec: number;
  lunaLegPhase: number;

  // Animated Colorful Tropical Bird ("Rio")
  rioX: number;
  rioY: number;
  rioZ: number;
  rioHeadingRad: number;
  rioPhase: number;
  rioWingPhase: number;

  // Interactive Smart Mirror State (West Wall: x=-10.55, z=-2.2)
  mirrorX: number;
  mirrorZ: number;
  mirrorActive: boolean;
  mirrorCommentIndex: number;
  mirrorCommentTimerMs: number;
  mirrorComment: MirrorCommentItem | null;
  mirrorSpeakEventPending: string | null;

  // Rolling Red Ball state
  ballX: number;
  ballZ: number;
  ballVx: number;
  ballVz: number;

  // Fixed room landmarks
  ownerX: number;
  ownerZ: number;
  dockX: number;
  dockZ: number;

  // User-dropped obstacle crates
  customCrates: ObstacleItem[];
}

// Expanded 22.0m × 16.0m Smart Home / Robotics Loft bounds (walls at ±11.0m × ±8.0m)
export const ROOM_HALF_W = 11.0;
export const ROOM_HALF_D = 8.0;
export const NAV_MIN_X = -9.6;
export const NAV_MAX_X = 9.6;
export const NAV_MIN_Z = -6.6;
export const NAV_MAX_Z = 6.6;

// Exact 10 well-spaced static furniture islands matching backend planParser & 3D loft meshes
export const STATIC_FURNITURE: ObstacleItem[] = [
  { id: 'sofa_l', label: 'Modern Sofa (West)', x: -6.8, z: -4.8, radius: 0.65 },
  { id: 'sofa_r', label: 'Modern Sofa (East)', x: -5.6, z: -4.8, radius: 0.65 },
  { id: 'table', label: 'Coffee Table', x: -6.0, z: -1.8, radius: 0.68 },
  { id: 'tv_console', label: '4K Smart TV Console', x: 0.0, z: -6.6, radius: 0.78 },
  { id: 'kitchen_island', label: 'Kitchen Espresso Bar', x: 6.4, z: -4.6, radius: 0.82 },
  { id: 'server_rack', label: 'Mini Server Rack', x: 9.2, z: -0.4, radius: 0.65 },
  { id: 'desk', label: 'Robotics Workbench', x: 6.2, z: 4.0, radius: 0.8 },
  { id: 'armchair', label: 'Lounge Armchair', x: -8.4, z: 1.6, radius: 0.65 },
  { id: 'plant_ne', label: 'Monstera Plant NE', x: 2.2, z: -3.2, radius: 0.5 },
  { id: 'plant_sw', label: 'Monstera Plant SW', x: -2.0, z: 4.4, radius: 0.5 },
  { id: 'dog_bed', label: 'Biscuit Dog Bed', x: -6.2, z: 4.6, radius: 0.52 },
];

// 7-Zone Room Exploration Sweep Grid covering the entire 22m × 16m Smart Home Loft
export const SEARCH_ZONES: Array<{ x: number; z: number; label: string }> = [
  { x: 0.2, z: 3.8, label: 'Zone 1/7 · South Center Lounge' },
  { x: -4.8, z: 2.4, label: 'Zone 2/7 · Southwest Armchair & Bed' },
  { x: -6.2, z: -3.2, label: 'Zone 3/7 · West Sofa Corridor' },
  { x: -1.4, z: -4.2, label: 'Zone 4/7 · North Media Lounge' },
  { x: 4.6, z: -5.0, label: 'Zone 5/7 · Northeast Espresso Bar' },
  { x: 7.4, z: -0.6, label: 'Zone 6/7 · East Server Wall' },
  { x: 4.0, z: 2.2, label: 'Zone 7/7 · Southeast Lab & Desk' },
];

const HIDING_SPOTS: Array<{ x: number; z: number }> = [
  { x: -8.2, z: -3.2 }, // West lounge flank between sofa & armchair
  { x: 8.2, z: -5.6 }, // Far northeast behind kitchen island
  { x: 8.0, z: 2.2 }, // East corridor between server rack & workbench
  { x: -7.8, z: 4.8 }, // Southwest corner beside dog bed
];

const PATROL_WAYPOINTS: Array<{ x: number; z: number }> = [
  { x: -6.2, z: -3.3 }, // Weaves cleanly between sofa and coffee table!
  { x: -4.4, z: 2.2 },
  { x: 0.6, z: 3.4 },
  { x: 4.4, z: 1.8 },
  { x: 7.2, z: -1.6 },
  { x: 3.8, z: -4.8 },
  { x: -1.8, z: -4.2 },
];

const EMOTION_LED_MAP: Record<RobotEmotion, string> = {
  neutral: 'cyan',
  happy: 'emerald',
  curious: 'sky',
  excited: 'amber',
  alert: 'crimson',
  love: 'pink',
  sleepy: 'violet',
  focused: 'cyan',
};

export const CAMERA_FOV_HALF_ANGLE_RAD = (40 * Math.PI) / 180; // ±40°
export const CAMERA_FOV_RANGE_M = 5.6;

const ROBOT_RADIUS_M = 0.3;
const ASTAR_CELL_M = 0.45;
const ASTAR_INFLATE_M = ROBOT_RADIUS_M + 0.24; // Threads wide corridors cleanly with zero clipping
const ASTAR_COLS = Math.floor((NAV_MAX_X - NAV_MIN_X) / ASTAR_CELL_M) + 1;
const ASTAR_ROWS = Math.floor((NAV_MAX_Z - NAV_MIN_Z) / ASTAR_CELL_M) + 1;

function normalizeAngle(rad: number): number {
  let a = rad;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function worldToGrid(x: number, z: number): { c: number; r: number } {
  const c = clamp(Math.round((x - NAV_MIN_X) / ASTAR_CELL_M), 0, ASTAR_COLS - 1);
  const r = clamp(Math.round((z - NAV_MIN_Z) / ASTAR_CELL_M), 0, ASTAR_ROWS - 1);
  return { c, r };
}

function gridToWorld(c: number, r: number): Point2D {
  return {
    x: NAV_MIN_X + c * ASTAR_CELL_M,
    z: NAV_MIN_Z + r * ASTAR_CELL_M,
  };
}

function isSegmentClear(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  obstacles: ObstacleItem[],
  inflateM: number
): boolean {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-6) return true;
  for (const obs of obstacles) {
    const t = clamp(((obs.x - ax) * dx + (obs.z - az) * dz) / lenSq, 0, 1);
    const cx = ax + t * dx;
    const cz = az + t * dz;
    const dist = Math.hypot(obs.x - cx, obs.z - cz);
    if (dist < obs.radius + inflateM) {
      return false;
    }
  }
  return true;
}

/**
 * Real 2D Occupancy-Grid A* Pathfinder with obstacle inflation, corner-cut guards,
 * and line-of-sight path smoothing for smooth curved obstacle detours.
 */
export function computeAStarPath(
  startX: number,
  startZ: number,
  goalX: number,
  goalZ: number,
  obstacles: ObstacleItem[]
): Point2D[] {
  const clampedGoalX = clamp(goalX, NAV_MIN_X, NAV_MAX_X);
  const clampedGoalZ = clamp(goalZ, NAV_MIN_Z, NAV_MAX_Z);

  // Fast path: direct line-of-sight with generous inflation clearance
  if (isSegmentClear(startX, startZ, clampedGoalX, clampedGoalZ, obstacles, ASTAR_INFLATE_M)) {
    return [{ x: clampedGoalX, z: clampedGoalZ }];
  }

  const totalCells = ASTAR_COLS * ASTAR_ROWS;
  const blocked = new Uint8Array(totalCells);

  for (let r = 0; r < ASTAR_ROWS; r++) {
    const wz = NAV_MIN_Z + r * ASTAR_CELL_M;
    for (let c = 0; c < ASTAR_COLS; c++) {
      const wx = NAV_MIN_X + c * ASTAR_CELL_M;
      for (const obs of obstacles) {
        const minR = obs.radius + ASTAR_INFLATE_M;
        const dx = wx - obs.x;
        const dz = wz - obs.z;
        if (dx * dx + dz * dz < minR * minR) {
          blocked[r * ASTAR_COLS + c] = 1;
          break;
        }
      }
    }
  }

  const findNearestFreeCell = (cell: { c: number; r: number }): { c: number; r: number } => {
    if (!blocked[cell.r * ASTAR_COLS + cell.c]) return cell;
    for (let rad = 1; rad <= 5; rad++) {
      let best: { c: number; r: number } | null = null;
      let bestDist = Infinity;
      for (let dr = -rad; dr <= rad; dr++) {
        for (let dc = -rad; dc <= rad; dc++) {
          const nc = cell.c + dc;
          const nr = cell.r + dr;
          if (nc < 0 || nc >= ASTAR_COLS || nr < 0 || nr >= ASTAR_ROWS) continue;
          if (!blocked[nr * ASTAR_COLS + nc]) {
            const d = dc * dc + dr * dr;
            if (d < bestDist) {
              bestDist = d;
              best = { c: nc, r: nr };
            }
          }
        }
      }
      if (best) return best;
    }
    return cell;
  };

  const startCell = findNearestFreeCell(worldToGrid(startX, startZ));
  const goalCell = findNearestFreeCell(worldToGrid(clampedGoalX, clampedGoalZ));
  const startIdx = startCell.r * ASTAR_COLS + startCell.c;
  const goalIdx = goalCell.r * ASTAR_COLS + goalCell.c;

  if (startIdx === goalIdx) {
    return [{ x: clampedGoalX, z: clampedGoalZ }];
  }

  const gScore = new Float32Array(totalCells);
  gScore.fill(Infinity);
  const fScore = new Float32Array(totalCells);
  fScore.fill(Infinity);
  const cameFrom = new Int32Array(totalCells);
  cameFrom.fill(-1);
  const closed = new Uint8Array(totalCells);
  const inOpen = new Uint8Array(totalCells);

  const openList: number[] = [startIdx];
  gScore[startIdx] = 0;
  fScore[startIdx] = Math.hypot(goalCell.c - startCell.c, goalCell.r - startCell.r);
  inOpen[startIdx] = 1;

  const DIRS: Array<[number, number, number]> = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2],
  ];

  let found = false;
  let iterations = 0;
  const MAX_ITERS = 2400;

  while (openList.length > 0 && iterations < MAX_ITERS) {
    iterations++;
    // Pop lowest fScore
    let bestPos = 0;
    let bestF = fScore[openList[0]];
    for (let i = 1; i < openList.length; i++) {
      const f = fScore[openList[i]];
      if (f < bestF) {
        bestF = f;
        bestPos = i;
      }
    }
    const curr = openList[bestPos];
    openList[bestPos] = openList[openList.length - 1];
    openList.pop();
    inOpen[curr] = 0;

    if (curr === goalIdx) {
      found = true;
      break;
    }

    closed[curr] = 1;
    const cr = Math.floor(curr / ASTAR_COLS);
    const cc = curr % ASTAR_COLS;

    for (const [dc, dr, stepCost] of DIRS) {
      const nc = cc + dc;
      const nr = cr + dr;
      if (nc < 0 || nc >= ASTAR_COLS || nr < 0 || nr >= ASTAR_ROWS) continue;
      const nIdx = nr * ASTAR_COLS + nc;
      if (closed[nIdx] || blocked[nIdx]) continue;

      // Prevent diagonal corner cutting through obstacles
      if (dc !== 0 && dr !== 0) {
        if (blocked[cr * ASTAR_COLS + nc] || blocked[nr * ASTAR_COLS + cc]) {
          continue;
        }
      }

      const tentativeG = gScore[curr] + stepCost;
      if (tentativeG < gScore[nIdx]) {
        cameFrom[nIdx] = curr;
        gScore[nIdx] = tentativeG;
        fScore[nIdx] = tentativeG + Math.hypot(goalCell.c - nc, goalCell.r - nr);
        if (!inOpen[nIdx]) {
          openList.push(nIdx);
          inOpen[nIdx] = 1;
        }
      }
    }
  }

  if (!found) {
    return [{ x: clampedGoalX, z: clampedGoalZ }];
  }

  // Reconstruct raw grid path
  const raw: Point2D[] = [];
  let trace = goalIdx;
  while (trace !== -1 && trace !== startIdx) {
    const tr = Math.floor(trace / ASTAR_COLS);
    const tc = trace % ASTAR_COLS;
    raw.push(gridToWorld(tc, tr));
    trace = cameFrom[trace];
  }
  raw.reverse();
  if (raw.length === 0) {
    return [{ x: clampedGoalX, z: clampedGoalZ }];
  }
  raw[raw.length - 1] = { x: clampedGoalX, z: clampedGoalZ };

  // Line-of-sight string-pulling smoothing so the rendered floor trajectory curves cleanly
  const smoothed: Point2D[] = [];
  let anchor: Point2D = { x: startX, z: startZ };
  let idx = 0;
  while (idx < raw.length) {
    let furthest = idx;
    for (let j = raw.length - 1; j > idx; j--) {
      if (isSegmentClear(anchor.x, anchor.z, raw[j].x, raw[j].z, obstacles, ASTAR_INFLATE_M * 0.92)) {
        furthest = j;
        break;
      }
    }
    smoothed.push(raw[furthest]);
    anchor = raw[furthest];
    idx = furthest + 1;
  }

  return smoothed.length > 0 ? smoothed : [{ x: clampedGoalX, z: clampedGoalZ }];
}

/**
 * Real Camera-FOV + Line-of-Sight Occlusion Check!
 * Returns true ONLY when Biscuit is within CAMERA_FOV_RANGE_M, inside ±40° of WALL-E's heading,
 * and NOT occluded by sofa, coffee table, plant, workbench desk, or user-dropped crates.
 */
export function isDogInCameraFov(sim: PhysicsSimState): boolean {
  const dx = sim.dogX - sim.x;
  const dz = sim.dogZ - sim.z;
  const dist = Math.hypot(dx, dz);
  if (dist > CAMERA_FOV_RANGE_M) return false;
  if (dist < 0.05) return true;

  const angleToDog = Math.atan2(dx, dz);
  const relAngle = Math.abs(normalizeAngle(angleToDog - sim.headingRad));
  if (relAngle > CAMERA_FOV_HALF_ANGLE_RAD) return false;

  const segLenSq = dx * dx + dz * dz;
  const obstacles = [...STATIC_FURNITURE, ...sim.customCrates];
  for (const obs of obstacles) {
    const t = clamp(((obs.x - sim.x) * dx + (obs.z - sim.z) * dz) / segLenSq, 0, 1);
    if (t <= 0.05 || t >= 0.95) continue;
    const closestX = sim.x + t * dx;
    const closestZ = sim.z + t * dz;
    const perpDist = Math.hypot(obs.x - closestX, obs.z - closestZ);
    if (perpDist < obs.radius * 0.88) {
      return false;
    }
  }
  return true;
}

/**
 * Hides Biscuit behind furniture or a far corner outside WALL-E's current camera FOV.
 * Guarantees room search is 100% authentic and genuinely explores the 15m × 11.5m room!
 */
export function hideDogBehindFurniture(sim: PhysicsSimState): void {
  let chosen = HIDING_SPOTS[0];
  let bestScore = -Infinity;

  for (const spot of HIDING_SPOTS) {
    const testSim = { ...sim, dogX: spot.x, dogZ: spot.z };
    const visibleNow = isDogInCameraFov(testSim);
    const dist = Math.hypot(spot.x - sim.x, spot.z - sim.z);
    const score = (visibleNow ? -12 : 12) + dist + Math.random() * 0.8;
    if (score > bestScore) {
      bestScore = score;
      chosen = spot;
    }
  }

  sim.dogX = chosen.x;
  sim.dogZ = chosen.z;
  sim.dogTargetX = chosen.x;
  sim.dogTargetZ = chosen.z;
  sim.dogWaitSec = 6.0;
  sim.dogDiscovered = false;
  sim.justFoundDogAt = 0;
  sim.dogDiscoveredEventPending = false;
  sim.searchZoneIndex = 0;
  sim.searchZoneHoldMs = 0;
  sim.plannedPathPoints = [];
  sim.searchStatusText = '🔍 Biscuit is hidden! Launch Search Room to find him.';
}

export function createInitialPhysicsState(): PhysicsSimState {
  const initX = 0.0;
  const initZ = 0.6;
  const dogX = 3.4;
  const dogZ = 2.4;
  const initHeading = Math.atan2(dogX - initX, dogZ - initZ);

  return {
    x: initX,
    z: initZ,
    headingRad: initHeading,
    leftPwm: 0,
    rightPwm: 0,
    leftWheelAngle: 0,
    rightWheelAngle: 0,
    ultrasonicCm: 165,
    batteryPct: 94,
    activeMode: 'idle',
    emotion: 'happy',
    isRecording: false,
    speech: 'WALL-E online in the 22m Smart Home Loft! Command my wheels, search for Biscuit, or go live.',
    gazeX: 0,
    gazeY: 0,

    dogDiscovered: true,
    searchZoneIndex: 0,
    searchTotalZones: SEARCH_ZONES.length,
    searchStatusText: '',
    justFoundDogAt: 0,
    dogDiscoveredEventPending: false,
    searchZoneHoldMs: 0,
    searchSweepPhase: 0,
    activeAssistantApp: 'eyes',

    plannedPathPoints: [],
    detourPhase: 'none',
    detourTimerMs: 0,
    detourTargetAngle: initHeading,
    lastAStarAt: 0,
    lastAStarGoalX: 0,
    lastAStarGoalZ: 0,
    lastAStarCrateCount: 0,
    isAvoiding: false,
    avoidingLabel: null,
    repulsionX: 0,
    repulsionZ: 0,
    sonarReflexActive: false,
    arrivalHoldMs: 0,
    preOrientTarget: null,

    activePlan: null,
    activeStepIndex: 0,
    stepElapsedMs: 0,
    patrolIndex: 0,
    orbitAngle: 0,
    streamingFirstStep: false,

    dogX,
    dogZ,
    dogHeadingRad: normalizeAngle(initHeading + Math.PI * 0.85),
    dogTargetX: 3.8,
    dogTargetZ: 1.8,
    dogWaitSec: 1.6,
    dogLegPhase: 0,

    mochiX: -3.2,
    mochiZ: -3.2,
    mochiHeadingRad: 0.65,
    mochiTargetX: -3.8,
    mochiTargetZ: -2.4,
    mochiWaitSec: 2.0,
    mochiLegPhase: 0,

    lunaX: 4.6,
    lunaZ: -1.8,
    lunaHeadingRad: -1.1,
    lunaTargetX: 4.2,
    lunaTargetZ: -2.6,
    lunaWaitSec: 1.8,
    lunaLegPhase: 0,

    rioX: 0.5,
    rioY: 1.82,
    rioZ: -1.2,
    rioHeadingRad: 0.4,
    rioPhase: 0,
    rioWingPhase: 0,

    mirrorX: SMART_MIRROR_POS.x,
    mirrorZ: SMART_MIRROR_POS.z,
    mirrorActive: false,
    mirrorCommentIndex: 0,
    mirrorCommentTimerMs: 0,
    mirrorComment: null,
    mirrorSpeakEventPending: null,

    ballX: -1.2,
    ballZ: 1.8,
    ballVx: 0,
    ballVz: 0,

    ownerX: 2.4,
    ownerZ: 0.8,
    dockX: -9.2,
    dockZ: -5.4,

    customCrates: [],
  };
}

/**
 * <16ms Instant Pre-Reaction Reflex when user clicks a mission or sends a command!
 */
export function triggerInstantPreReaction(sim: PhysicsSimState, command: string): void {
  const lower = command.toLowerCase();
  const isSearchCmd =
    lower.includes('search') ||
    lower.includes('sweep') ||
    lower.includes('busca') ||
    lower.includes('discover') ||
    (lower.includes('find') &&
      (lower.includes('dog') || lower.includes('biscuit') || lower.includes('perro')));

  if (isSearchCmd) {
    if (
      sim.dogDiscovered &&
      (isDogInCameraFov(sim) || Math.hypot(sim.dogX - sim.x, sim.dogZ - sim.z) < 3.2)
    ) {
      hideDogBehindFurniture(sim);
    } else {
      sim.dogDiscovered = false;
      sim.searchZoneIndex = 0;
      sim.searchZoneHoldMs = 0;
    }
    sim.preOrientTarget = null;
    sim.detourPhase = 'none';
    sim.emotion = 'curious';
    sim.searchStatusText = `🔍 EXPLORING ROOM · Zone 1/${sim.searchTotalZones} · Scanning for Biscuit...`;
    sim.speech = '🔍 Starting real camera-FOV room sweep with A* pathfinding to locate Biscuit...';
    return;
  }

  if (lower.includes('instagram') || lower.includes('selfie') || lower.includes('photo') || lower.includes('insta')) {
    sim.preOrientTarget = 'dog';
    sim.emotion = 'excited';
    sim.speech = '📸 Framing live 3D Robot POV photo for Instagram Studio!';
    return;
  }

  if (lower.includes('tiktok') || lower.includes('live')) {
    sim.preOrientTarget = 'center';
    sim.emotion = 'excited';
    sim.speech = '📱 Launching live Robot POV TikTok Stream on OpenClaw + Cerebras!';
    return;
  }

  if (
    lower.includes('mirror') ||
    lower.includes('espejo') ||
    lower.includes('reflejo')
  ) {
    sim.preOrientTarget = 'mirror';
    sim.emotion = 'love';
    sim.speech = '🪞 Rolling up to the Smart Mirror to check myself out and read live comments!';
    return;
  }

  if (lower.includes('cat') || lower.includes('gato') || lower.includes('mochi') || lower.includes('luna')) {
    sim.preOrientTarget = 'cat';
    sim.emotion = 'happy';
    sim.speech = '🐱 Spotting Mochi and Luna in the loft!';
    return;
  }

  if (lower.includes('bird') || lower.includes('pajaro') || lower.includes('pájaro') || lower.includes('rio')) {
    sim.preOrientTarget = 'bird';
    sim.emotion = 'curious';
    sim.speech = '🦜 Tracking Rio gliding overhead!';
    return;
  }

  if (lower.includes('dog') || lower.includes('biscuit') || lower.includes('chase')) {
    sim.preOrientTarget = 'dog';
    sim.emotion = 'excited';
  } else if (lower.includes('owner') || lower.includes('hello') || lower.includes('hi')) {
    sim.preOrientTarget = 'owner';
    sim.emotion = 'happy';
  } else if (lower.includes('dock') || lower.includes('battery') || lower.includes('charge')) {
    sim.preOrientTarget = 'dock';
    sim.emotion = 'focused';
  } else if (lower.includes('dance') || lower.includes('spin')) {
    sim.preOrientTarget = 'dog';
    sim.emotion = 'love';
  } else {
    sim.preOrientTarget = 'center';
    sim.emotion = 'focused';
  }
  sim.speech = '⚡ OpenClaw 3-Agent Triad locking target on Cerebras...';
}

export function applyFirstStepImmediate(
  sim: PhysicsSimState,
  step: RobotActionStep,
  speech?: string,
  emotion?: RobotEmotion
): void {
  if (sim.streamingFirstStep && sim.activePlan && sim.activePlan.steps.length >= 1) {
    return;
  }
  sim.streamingFirstStep = true;
  sim.preOrientTarget = null;
  sim.detourPhase = 'none';
  sim.lastAStarAt = 0;

  if (step.action === 'search_dog') {
    if (sim.dogDiscovered && isDogInCameraFov(sim)) {
      hideDogBehindFurniture(sim);
    } else {
      sim.dogDiscovered = false;
      sim.searchZoneIndex = 0;
      sim.searchZoneHoldMs = 0;
    }
    sim.searchStatusText = `🔍 EXPLORING ROOM · Zone 1/${sim.searchTotalZones} · Scanning for Biscuit...`;
  }

  sim.activePlan = {
    speech: speech || sim.speech,
    emotion: emotion || sim.emotion,
    recordVideo: step.action === 'record_video' || step.action === 'follow_dog',
    reasoning: 'Streaming live from OpenClaw NAV agent...',
    steps: [step],
  };
  sim.activeStepIndex = 0;
  sim.stepElapsedMs = 0;
  sim.arrivalHoldMs = 0;
  if (emotion) sim.emotion = emotion;
  if (speech) sim.speech = speech;
  sim.activeMode = step.action;
}

export function applyActionPlanToSim(sim: PhysicsSimState, plan: RobotActionPlan): void {
  const wasStreamingStep1 =
    sim.streamingFirstStep &&
    sim.activePlan &&
    sim.activeStepIndex === 0 &&
    plan.steps.length > 0 &&
    sim.activePlan.steps[0]?.action === plan.steps[0]?.action;

  sim.streamingFirstStep = false;
  sim.preOrientTarget = null;
  sim.activePlan = plan;
  if (!wasStreamingStep1) {
    sim.activeStepIndex = 0;
    sim.stepElapsedMs = 0;
    sim.arrivalHoldMs = 0;
    sim.detourPhase = 'none';
    sim.lastAStarAt = 0;
  }

  const active = plan.steps[sim.activeStepIndex] ?? plan.steps[0];
  if (active?.action === 'search_dog' && !wasStreamingStep1) {
    if (sim.dogDiscovered && isDogInCameraFov(sim)) {
      hideDogBehindFurniture(sim);
    } else {
      sim.dogDiscovered = false;
      sim.searchZoneIndex = 0;
      sim.searchZoneHoldMs = 0;
    }
    sim.searchStatusText = `🔍 EXPLORING ROOM · Zone 1/${sim.searchTotalZones} · Scanning for Biscuit...`;
  }

  sim.emotion = plan.emotion || 'happy';
  sim.isRecording = Boolean(plan.recordVideo);
  if (plan.speech) {
    sim.speech = plan.speech;
  }
  sim.activeMode = active ? active.action : 'idle';
}

export function triggerMirrorChatAction(sim: PhysicsSimState): void {
  sim.streamingFirstStep = false;
  sim.preOrientTarget = null;
  sim.detourPhase = 'none';
  sim.lastAStarAt = 0;
  sim.activePlan = {
    speech: '🪞 Rolling over to the Smart Mirror to check myself out and chat with live viewers!',
    emotion: 'happy',
    recordVideo: true,
    reasoning: 'Zero-token instant Smart Mirror interaction via 2D A* navigation.',
    steps: [
      {
        action: 'mirror_chat',
        target: 'mirror',
        x: SMART_MIRROR_STAND.x,
        z: SMART_MIRROR_STAND.z,
        durationMs: 22000,
        speed: 0.92,
        label: 'Smart Mirror Chat',
      },
    ],
  };
  sim.activeStepIndex = 0;
  sim.stepElapsedMs = 0;
  sim.arrivalHoldMs = 0;
  sim.activeMode = 'mirror_chat';
  sim.emotion = 'happy';
  sim.speech = sim.activePlan.speech;
  sim.isRecording = true;
}

export function advanceMirrorComment(sim: PhysicsSimState): MirrorCommentItem {
  sim.mirrorCommentIndex = (sim.mirrorCommentIndex + 1) % MIRROR_COMMENTS.length;
  sim.mirrorCommentTimerMs = 0;
  const item = MIRROR_COMMENTS[sim.mirrorCommentIndex];
  sim.mirrorComment = item;
  sim.emotion = item.emotion;
  sim.speech = item.reply;
  sim.mirrorSpeakEventPending = item.reply;
  return item;
}

export function getActiveStep(sim: PhysicsSimState): RobotActionStep | null {
  if (!sim.activePlan || sim.activeStepIndex >= sim.activePlan.steps.length) {
    return null;
  }
  return sim.activePlan.steps[sim.activeStepIndex];
}

export function resolveStepDestination(
  sim: PhysicsSimState,
  step: RobotActionStep
): { tx: number; tz: number; stopDist: number } {
  const CAMERA_STANDOFF_M = 1.2;
  if (step.action === 'search_dog') {
    const zone = SEARCH_ZONES[sim.searchZoneIndex % SEARCH_ZONES.length];
    return { tx: zone.x, tz: zone.z, stopDist: 0.38 };
  }
  if (typeof step.x === 'number' && typeof step.z === 'number') {
    return {
      tx: clamp(step.x, NAV_MIN_X + 0.4, NAV_MAX_X - 0.4),
      tz: clamp(step.z, NAV_MIN_Z + 0.4, NAV_MAX_Z - 0.4),
      stopDist: 0.42,
    };
  }
  if (step.action === 'mirror_chat') {
    return { tx: SMART_MIRROR_STAND.x, tz: SMART_MIRROR_STAND.z, stopDist: 0.42 };
  }
  if (step.action === 'return_to_dock') {
    return { tx: sim.dockX, tz: sim.dockZ, stopDist: 0.34 };
  }
  if (step.action === 'find_owner') {
    return { tx: sim.ownerX, tz: sim.ownerZ, stopDist: CAMERA_STANDOFF_M };
  }
  if (step.action === 'patrol') {
    const wp = PATROL_WAYPOINTS[sim.patrolIndex % PATROL_WAYPOINTS.length];
    return { tx: wp.x, tz: wp.z, stopDist: 0.38 };
  }
  switch (step.target) {
    case 'mirror':
      return { tx: SMART_MIRROR_STAND.x, tz: SMART_MIRROR_STAND.z, stopDist: 0.42 };
    case 'cat': {
      const dMochi = Math.hypot(sim.mochiX - sim.x, sim.mochiZ - sim.z);
      const dLuna = Math.hypot(sim.lunaX - sim.x, sim.lunaZ - sim.z);
      return dMochi <= dLuna
        ? { tx: sim.mochiX, tz: sim.mochiZ, stopDist: 1.1 }
        : { tx: sim.lunaX, tz: sim.lunaZ, stopDist: 1.1 };
    }
    case 'bird':
      return { tx: sim.rioX, tz: sim.rioZ, stopDist: 1.35 };
    case 'owner':
      return { tx: sim.ownerX, tz: sim.ownerZ, stopDist: CAMERA_STANDOFF_M };
    case 'dock':
      return { tx: sim.dockX, tz: sim.dockZ, stopDist: 0.34 };
    case 'ball':
      return { tx: sim.ballX, tz: sim.ballZ, stopDist: 0.9 };
    case 'center':
      return { tx: 0.0, tz: 0.4, stopDist: 0.38 };
    case 'dog':
    default:
      if (!sim.dogDiscovered) {
        const zone = SEARCH_ZONES[sim.searchZoneIndex % SEARCH_ZONES.length];
        return { tx: zone.x, tz: zone.z, stopDist: 0.38 };
      }
      return { tx: sim.dogX, tz: sim.dogZ, stopDist: CAMERA_STANDOFF_M };
  }
}

/**
 * Returns the live 3D curved A* path points (when actively navigating) or queued plan waypoints
 * for rendering on the 3D floor in RobotArena3D. Never reveals hidden Biscuit!
 */
export function getActiveWaypointChain(sim: PhysicsSimState): WaypointNode[] {
  const activeStep = getActiveStep(sim);

  if (sim.plannedPathPoints.length > 0 && activeStep) {
    return sim.plannedPathPoints.map((pt, i) => ({
      x: pt.x,
      z: pt.z,
      label: i === sim.plannedPathPoints.length - 1 ? activeStep.label || activeStep.action : `A* #${i + 1}`,
      active: i === sim.plannedPathPoints.length - 1,
    }));
  }

  if (activeStep?.action === 'search_dog' && !sim.dogDiscovered) {
    const chain: WaypointNode[] = [];
    for (let offset = 0; offset < 3; offset++) {
      const idx = (sim.searchZoneIndex + offset) % SEARCH_ZONES.length;
      const z = SEARCH_ZONES[idx];
      chain.push({ x: z.x, z: z.z, label: z.label, active: offset === 0 });
    }
    return chain;
  }

  if (!sim.activePlan || sim.activePlan.steps.length === 0) {
    if (sim.preOrientTarget) {
      const dummyStep: RobotActionStep = {
        action: 'go_to',
        target: sim.preOrientTarget,
        durationMs: 2000,
        speed: 0.7,
        label: 'Target Lock',
      };
      const dest = resolveStepDestination(sim, dummyStep);
      return [{ x: dest.tx, z: dest.tz, label: 'LOCK', active: true }];
    }
    return [];
  }

  const nodes: WaypointNode[] = [];
  for (let i = sim.activeStepIndex; i < sim.activePlan.steps.length; i++) {
    const st = sim.activePlan.steps[i];
    if (!sim.dogDiscovered && (st.action === 'follow_dog' || st.target === 'dog')) {
      continue;
    }
    const dest = resolveStepDestination(sim, st);
    nodes.push({
      x: dest.tx,
      z: dest.tz,
      label: `${i + 1}. ${st.label || st.action}`,
      active: i === sim.activeStepIndex,
    });
  }
  return nodes;
}

function pickNewDogTarget(sim: PhysicsSimState, keepPhotogenicArc: boolean): void {
  const obstacles = [...STATIC_FURNITURE, ...sim.customCrates];
  for (let attempt = 0; attempt < 18; attempt++) {
    const tx = -8.0 + Math.random() * 16.0;
    const tz = -5.4 + Math.random() * 10.8;
    const blocked = obstacles.some(
      (obs) => Math.hypot(tx - obs.x, tz - obs.z) < obs.radius + 0.72
    );
    if (blocked) continue;
    const distFromRobot = Math.hypot(tx - sim.x, tz - sim.z);
    if (distFromRobot < 1.35) continue;
    if (keepPhotogenicArc && distFromRobot > 4.6) continue;
    sim.dogTargetX = tx;
    sim.dogTargetZ = tz;
    return;
  }
  sim.dogTargetX = clamp(sim.x + 1.8, -8.0, 8.0);
  sim.dogTargetZ = clamp(sim.z + 1.2, -5.4, 5.4);
}

export function stepRobotPhysics(sim: PhysicsSimState, dtSec: number): void {
  const dt = Math.min(0.05, Math.max(0.001, dtSec));
  const nowMs = performance.now();

  // Reset per-frame avoidance flags (re-asserted below during detour/avoidance)
  sim.isAvoiding = false;
  sim.avoidingLabel = null;
  sim.repulsionX = 0;
  sim.repulsionZ = 0;
  sim.sonarReflexActive = false;

  const allObstacles = [...STATIC_FURNITURE, ...sim.customCrates];

  // 1. Update playful animated Dog ("Biscuit") with furniture collision guard
  const distRobotToDog = Math.hypot(sim.dogX - sim.x, sim.dogZ - sim.z);
  const beingChased =
    sim.dogDiscovered &&
    (sim.activeMode === 'follow_dog' || sim.activeMode === 'go_to') &&
    distRobotToDog < 1.45;

  if (sim.dogDiscovered && distRobotToDog < 1.05 && distRobotToDog > 0.01) {
    const awayX = (sim.dogX - sim.x) / distRobotToDog;
    const awayZ = (sim.dogZ - sim.z) / distRobotToDog;
    sim.dogX = clamp(sim.x + awayX * 1.12, NAV_MIN_X + 0.3, NAV_MAX_X - 0.3);
    sim.dogZ = clamp(sim.z + awayZ * 1.12, NAV_MIN_Z + 0.3, NAV_MAX_Z - 0.3);
    sim.dogLegPhase += dt * 15;
  }

  if (beingChased && sim.dogWaitSec > 0.35) {
    sim.dogWaitSec = 0.15;
    pickNewDogTarget(sim, true);
  }

  const dogDx = sim.dogTargetX - sim.dogX;
  const dogDz = sim.dogTargetZ - sim.dogZ;
  const dogDist = Math.hypot(dogDx, dogDz);

  if (dogDist < 0.28) {
    sim.dogWaitSec -= dt;
    const lookBackHeading = Math.atan2(sim.x - sim.dogX, sim.z - sim.dogZ);
    const lookDiff = normalizeAngle(lookBackHeading - sim.dogHeadingRad);
    sim.dogHeadingRad = normalizeAngle(sim.dogHeadingRad + lookDiff * Math.min(1, dt * 5));

    if (sim.dogDiscovered && sim.dogWaitSec <= 0) {
      pickNewDogTarget(sim, true);
      sim.dogWaitSec = beingChased ? 0.65 : 1.7 + Math.random() * 1.6;
    }
  } else {
    const desiredDogHeading = Math.atan2(dogDx, dogDz);
    const diff = normalizeAngle(desiredDogHeading - sim.dogHeadingRad);
    sim.dogHeadingRad = normalizeAngle(sim.dogHeadingRad + diff * Math.min(1, dt * 6.5));
    const dogSpeed = beingChased ? 1.08 : 0.62;
    let nextDogX = clamp(
      sim.dogX + Math.sin(sim.dogHeadingRad) * dogSpeed * dt,
      NAV_MIN_X + 0.3,
      NAV_MAX_X - 0.3
    );
    let nextDogZ = clamp(
      sim.dogZ + Math.cos(sim.dogHeadingRad) * dogSpeed * dt,
      NAV_MIN_Z + 0.3,
      NAV_MAX_Z - 0.3
    );
    for (const obs of allObstacles) {
      const cdx = nextDogX - obs.x;
      const cdz = nextDogZ - obs.z;
      const cdist = Math.hypot(cdx, cdz);
      const minD = obs.radius + 0.28;
      if (cdist < minD && cdist > 0.001) {
        nextDogX = obs.x + (cdx / cdist) * minD;
        nextDogZ = obs.z + (cdz / cdist) * minD;
        pickNewDogTarget(sim, true);
      }
    }
    sim.dogX = nextDogX;
    sim.dogZ = nextDogZ;
    sim.dogLegPhase += dt * (beingChased ? 16 : 10);
  }

  // 1b. Update Animated Cats ("Mochi" ginger tabby & "Luna" violet tuxedo) + Flying Bird ("Rio")
  const stepCat = (
    cx: number,
    cz: number,
    heading: number,
    tx: number,
    tz: number,
    waitSec: number,
    legPhase: number,
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number
  ) => {
    const dx = tx - cx;
    const dz = tz - cz;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.25) {
      const nextWait = waitSec - dt;
      if (nextWait <= 0) {
        let newTx = tx;
        let newTz = tz;
        for (let i = 0; i < 12; i++) {
          const rx = minX + Math.random() * (maxX - minX);
          const rz = minZ + Math.random() * (maxZ - minZ);
          const blocked = allObstacles.some(
            (obs) => Math.hypot(rx - obs.x, rz - obs.z) < obs.radius + 0.55
          );
          if (!blocked) {
            newTx = rx;
            newTz = rz;
            break;
          }
        }
        return {
          x: cx,
          z: cz,
          heading,
          tx: newTx,
          tz: newTz,
          waitSec: 2.2 + Math.random() * 2.4,
          legPhase,
        };
      }
      return { x: cx, z: cz, heading, tx, tz, waitSec: nextWait, legPhase };
    }
    const desiredH = Math.atan2(dx, dz);
    const diffH = normalizeAngle(desiredH - heading);
    const nextH = normalizeAngle(heading + diffH * Math.min(1, dt * 5.2));
    let nx = clamp(cx + Math.sin(nextH) * 0.44 * dt, NAV_MIN_X + 0.35, NAV_MAX_X - 0.35);
    let nz = clamp(cz + Math.cos(nextH) * 0.44 * dt, NAV_MIN_Z + 0.35, NAV_MAX_Z - 0.35);
    for (const obs of allObstacles) {
      const odx = nx - obs.x;
      const odz = nz - obs.z;
      const od = Math.hypot(odx, odz);
      const minD = obs.radius + 0.28;
      if (od < minD && od > 0.001) {
        nx = obs.x + (odx / od) * minD;
        nz = obs.z + (odz / od) * minD;
      }
    }
    return { x: nx, z: nz, heading: nextH, tx, tz, waitSec, legPhase: legPhase + dt * 9.5 };
  };

  const nextMochi = stepCat(
    sim.mochiX,
    sim.mochiZ,
    sim.mochiHeadingRad,
    sim.mochiTargetX,
    sim.mochiTargetZ,
    sim.mochiWaitSec,
    sim.mochiLegPhase,
    -5.4,
    -1.6,
    -4.2,
    0.2
  );
  sim.mochiX = nextMochi.x;
  sim.mochiZ = nextMochi.z;
  sim.mochiHeadingRad = nextMochi.heading;
  sim.mochiTargetX = nextMochi.tx;
  sim.mochiTargetZ = nextMochi.tz;
  sim.mochiWaitSec = nextMochi.waitSec;
  sim.mochiLegPhase = nextMochi.legPhase;

  const nextLuna = stepCat(
    sim.lunaX,
    sim.lunaZ,
    sim.lunaHeadingRad,
    sim.lunaTargetX,
    sim.lunaTargetZ,
    sim.lunaWaitSec,
    sim.lunaLegPhase,
    2.2,
    7.8,
    -3.2,
    1.8
  );
  sim.lunaX = nextLuna.x;
  sim.lunaZ = nextLuna.z;
  sim.lunaHeadingRad = nextLuna.heading;
  sim.lunaTargetX = nextLuna.tx;
  sim.lunaTargetZ = nextLuna.tz;
  sim.lunaWaitSec = nextLuna.waitSec;
  sim.lunaLegPhase = nextLuna.legPhase;

  // Colorful Tropical Bird ("Rio") gracefully soaring in a figure-8 loop above the 22m loft
  const prevRioX = sim.rioX;
  const prevRioZ = sim.rioZ;
  sim.rioPhase += dt * 0.42;
  sim.rioWingPhase += dt * 14.5;
  sim.rioX = Math.sin(sim.rioPhase) * 6.8;
  sim.rioZ = Math.sin(sim.rioPhase * 2) * 3.6 - 0.8;
  sim.rioY = 1.82 + Math.sin(sim.rioPhase * 3.2) * 0.24;
  if (Math.hypot(sim.rioX - prevRioX, sim.rioZ - prevRioZ) > 0.001) {
    sim.rioHeadingRad = Math.atan2(sim.rioX - prevRioX, sim.rioZ - prevRioZ);
  }

  // 2. Update rolling red ball physics across 15m × 11.5m floor
  const robotBallDist = Math.hypot(sim.ballX - sim.x, sim.ballZ - sim.z);
  if (robotBallDist < 0.54 && robotBallDist > 0.01) {
    const pushX = (sim.ballX - sim.x) / robotBallDist;
    const pushZ = (sim.ballZ - sim.z) / robotBallDist;
    sim.ballVx += pushX * 1.6;
    sim.ballVz += pushZ * 1.6;
  }
  const dogBallDist = Math.hypot(sim.ballX - sim.dogX, sim.ballZ - sim.dogZ);
  if (dogBallDist < 0.48 && dogBallDist > 0.01) {
    const pushX = (sim.ballX - sim.dogX) / dogBallDist;
    const pushZ = (sim.ballZ - sim.dogZ) / dogBallDist;
    sim.ballVx += pushX * 1.25;
    sim.ballVz += pushZ * 1.25;
  }

  sim.ballX += sim.ballVx * dt;
  sim.ballZ += sim.ballVz * dt;
  sim.ballVx *= Math.pow(0.2, dt);
  sim.ballVz *= Math.pow(0.2, dt);
  if (Math.abs(sim.ballX) > ROOM_HALF_W - 0.45) {
    sim.ballX = clamp(sim.ballX, -(ROOM_HALF_W - 0.45), ROOM_HALF_W - 0.45);
    sim.ballVx *= -0.6;
  }
  if (Math.abs(sim.ballZ) > ROOM_HALF_D - 0.45) {
    sim.ballZ = clamp(sim.ballZ, -(ROOM_HALF_D - 0.45), ROOM_HALF_D - 0.45);
    sim.ballVz *= -0.6;
  }

  // 3. Execute active RobotActionStep with 2D A* Pathfinding & Reverse-and-Detour Avoidance
  const step = getActiveStep(sim);
  let targetL = 0;
  let targetR = 0;
  let lookAtX = sim.dogDiscovered ? sim.dogX : sim.x + Math.sin(sim.headingRad) * 2.5;
  let lookAtZ = sim.dogDiscovered ? sim.dogZ : sim.z + Math.cos(sim.headingRad) * 2.5;
  const CAMERA_STANDOFF_M = 1.2;

  if (step) {
    sim.stepElapsedMs += dt * 1000;
    sim.activeMode = step.action;
    const baseSpeed = clamp(step.speed || 0.82, 0.3, 1.0);

    if (step.action === 'record_video') {
      sim.isRecording = true;
    }

    const driveToward = (
      tx: number,
      tz: number,
      stopDist: number,
      speed: number
    ): { arrived: boolean; dist: number } => {
      lookAtX = tx;
      lookAtZ = tz;
      const dx = tx - sim.x;
      const dz = tz - sim.z;
      const dist = Math.hypot(dx, dz);
      const desiredGoalHeading = Math.atan2(dx, dz);
      const goalAngleErr = normalizeAngle(desiredGoalHeading - sim.headingRad);

      if (dist <= stopDist) {
        sim.detourPhase = 'none';
        sim.plannedPathPoints = [];
        const backOffCmd = dist < stopDist - 0.16 ? -0.32 : 0;
        const turn = Math.abs(goalAngleErr) > 0.04 ? clamp(goalAngleErr * 1.15, -0.55, 0.55) : 0;
        targetL = clamp(backOffCmd + turn, -1, 1);
        targetR = clamp(backOffCmd - turn, -1, 1);
        return { arrived: true, dist };
      }

      // Refresh cached 2D A* path every 280ms or on target/crate change
      const goalMoved = Math.hypot(tx - sim.lastAStarGoalX, tz - sim.lastAStarGoalZ) > 0.42;
      const cratesChanged = sim.customCrates.length !== sim.lastAStarCrateCount;
      if (
        nowMs - sim.lastAStarAt > 280 ||
        goalMoved ||
        cratesChanged ||
        sim.plannedPathPoints.length === 0
      ) {
        sim.plannedPathPoints = computeAStarPath(sim.x, sim.z, tx, tz, allObstacles);
        sim.lastAStarAt = nowMs;
        sim.lastAStarGoalX = tx;
        sim.lastAStarGoalZ = tz;
        sim.lastAStarCrateCount = sim.customCrates.length;
      }

      // Trim already-reached intermediate A* waypoints
      while (
        sim.plannedPathPoints.length > 1 &&
        Math.hypot(sim.plannedPathPoints[0].x - sim.x, sim.plannedPathPoints[0].z - sim.z) < 0.45
      ) {
        sim.plannedPathPoints.shift();
      }

      const nextWp = sim.plannedPathPoints[0] ?? { x: tx, z: tz };

      // Check for imminent physical obstacle right in front (furniture or dropped crate)
      const fwdX = Math.sin(sim.headingRad);
      const fwdZ = Math.cos(sim.headingRad);
      let blockingObs: ObstacleItem | null = null;
      for (const obs of allObstacles) {
        const toX = obs.x - sim.x;
        const toZ = obs.z - sim.z;
        const odist = Math.hypot(toX, toZ);
        const proj = toX * fwdX + toZ * fwdZ;
        // Obstacle directly ahead within danger zone
        if (proj > 0 && odist < obs.radius + ROBOT_RADIUS_M + 0.34) {
          const perp = Math.abs(toX * fwdZ - toZ * fwdX);
          if (perp < obs.radius + ROBOT_RADIUS_M + 0.14) {
            blockingObs = obs;
            break;
          }
        }
      }

      // Trigger explicit visible REVERSE-AND-DETOUR recovery if obstacle/sonar blocked!
      const sonarBlocked = sim.ultrasonicCm < 44 && dist > stopDist + 0.45 && blockingObs !== null;
      if (sim.detourPhase === 'none' && (sonarBlocked || blockingObs !== null)) {
        sim.detourPhase = 'reversing';
        sim.detourTimerMs = 520;
        sim.plannedPathPoints = computeAStarPath(sim.x, sim.z, tx, tz, allObstacles);
        sim.lastAStarAt = nowMs;
        const detourWp = sim.plannedPathPoints[0] ?? { x: tx, z: tz };
        sim.detourTargetAngle = Math.atan2(detourWp.x - sim.x, detourWp.z - sim.z);
        sim.avoidingLabel = blockingObs
          ? `REVERSING TO DETOUR (${blockingObs.label})`
          : 'REVERSING TO DETOUR';
      }

      // Phase A: Explicit Visible Reversing!
      if (sim.detourPhase === 'reversing') {
        sim.detourTimerMs -= dt * 1000;
        sim.isAvoiding = true;
        sim.sonarReflexActive = true;
        sim.avoidingLabel = 'REVERSING TO DETOUR';
        sim.repulsionX = -fwdX;
        sim.repulsionZ = -fwdZ;
        // Back up straight with gentle bias away from obstacle
        targetL = -0.58;
        targetR = -0.58;
        if (sim.detourTimerMs <= 0) {
          sim.detourPhase = 'pivoting';
          sim.detourTimerMs = 520;
          sim.plannedPathPoints = computeAStarPath(sim.x, sim.z, tx, tz, allObstacles);
          const pivotWp = sim.plannedPathPoints[0] ?? { x: tx, z: tz };
          sim.detourTargetAngle = Math.atan2(pivotWp.x - sim.x, pivotWp.z - sim.z);
        }
        return { arrived: false, dist };
      }

      // Phase B: Pivot cleanly toward the open A* detour waypoint!
      if (sim.detourPhase === 'pivoting') {
        sim.detourTimerMs -= dt * 1000;
        sim.isAvoiding = true;
        sim.avoidingLabel = 'A* DETOUR PIVOT';
        const pivotErr = normalizeAngle(sim.detourTargetAngle - sim.headingRad);
        sim.repulsionX = Math.sin(sim.detourTargetAngle);
        sim.repulsionZ = Math.cos(sim.detourTargetAngle);
        const turn = clamp(pivotErr * 1.45, -0.78, 0.78);
        targetL = turn;
        targetR = -turn;
        if (Math.abs(pivotErr) < 0.24 || sim.detourTimerMs <= 0) {
          sim.detourPhase = 'none';
        }
        return { arrived: false, dist };
      }

      // Phase C: Smoothly track the curved A* waypoint with gentle side clearance buffer
      const wpDx = nextWp.x - sim.x;
      const wpDz = nextWp.z - sim.z;
      const wpDist = Math.max(0.01, Math.hypot(wpDx, wpDz));
      let steerX = wpDx / wpDist;
      let steerZ = wpDz / wpDist;

      let closestObsDist = Infinity;
      for (const obs of allObstacles) {
        const odx = sim.x - obs.x;
        const odz = sim.z - obs.z;
        const odist = Math.hypot(odx, odz);
        const buffer = obs.radius + ROBOT_RADIUS_M + 0.48;
        if (odist < buffer && odist > 0.01) {
          const strength = (buffer - odist) / buffer;
          const rx = odx / odist;
          const rz = odz / odist;
          steerX += rx * strength * 1.25;
          steerZ += rz * strength * 1.25;
          if (odist < closestObsDist) {
            closestObsDist = odist;
            sim.isAvoiding = true;
            sim.avoidingLabel = `A* DETOUR: ${obs.label}`;
            sim.repulsionX = rx * strength;
            sim.repulsionZ = rz * strength;
          }
        }
      }

      const steerHeading = Math.atan2(steerX, steerZ);
      const steerErr = normalizeAngle(steerHeading - sim.headingRad);
      const turnCmd = clamp(steerErr * 1.05, -0.82, 0.82);
      const forwardCmd =
        Math.abs(steerErr) > 1.25
          ? 0.08
          : speed * Math.max(0.24, Math.cos(Math.min(Math.PI / 2, Math.abs(steerErr))));

      targetL = clamp(forwardCmd + turnCmd, -1, 1);
      targetR = clamp(forwardCmd - turnCmd, -1, 1);
      return { arrived: false, dist };
    };

    let navResult = { arrived: false, dist: 0 };
    let searchFoundNow = false;
    const isNavGoalStep =
      step.action === 'go_to' ||
      step.action === 'find_owner' ||
      step.action === 'return_to_dock';

    switch (step.action) {
      case 'search_dog': {
        sim.emotion = 'curious';
        sim.searchSweepPhase += dt * 2.6;

        if (!sim.dogDiscovered && isDogInCameraFov(sim)) {
          sim.dogDiscovered = true;
          sim.justFoundDogAt = Date.now();
          sim.dogDiscoveredEventPending = true;
          sim.emotion = 'excited';
          sim.speech = 'Target acquired! I found Biscuit!';
          sim.searchStatusText = '🎯 BISCUIT FOUND! TARGET LOCKED';
          sim.plannedPathPoints = [];
          searchFoundNow = true;
          break;
        }

        if (sim.dogDiscovered) {
          searchFoundNow = true;
          break;
        }

        const zone = SEARCH_ZONES[sim.searchZoneIndex % SEARCH_ZONES.length];
        sim.searchStatusText = `🔍 EXPLORING ROOM · Zone ${(sim.searchZoneIndex % SEARCH_ZONES.length) + 1}/${SEARCH_ZONES.length} · Scanning for Biscuit...`;

        const zoneDist = Math.hypot(zone.x - sim.x, zone.z - sim.z);
        if (zoneDist > 0.48) {
          driveToward(zone.x, zone.z, 0.38, Math.max(0.84, baseSpeed));
          sim.searchZoneHoldMs = 0;
        } else {
          // Arrived at zone -> perform a 360° camera yaw scan sweep
          sim.searchZoneHoldMs += dt * 1000;
          targetL = 0.58;
          targetR = -0.58;
          if (sim.searchZoneHoldMs >= 1350) {
            sim.searchZoneIndex = (sim.searchZoneIndex + 1) % SEARCH_ZONES.length;
            sim.searchZoneHoldMs = 0;
            sim.lastAStarAt = 0;
          }
        }
        break;
      }
      case 'follow_dog':
      case 'record_video': {
        if (!sim.dogDiscovered) {
          if (isDogInCameraFov(sim)) {
            sim.dogDiscovered = true;
            sim.justFoundDogAt = Date.now();
            sim.dogDiscoveredEventPending = true;
            sim.searchStatusText = '🎯 BISCUIT FOUND! TARGET LOCKED';
          } else {
            const zone = SEARCH_ZONES[sim.searchZoneIndex % SEARCH_ZONES.length];
            const zd = Math.hypot(zone.x - sim.x, zone.z - sim.z);
            if (zd < 0.5) sim.searchZoneIndex = (sim.searchZoneIndex + 1) % SEARCH_ZONES.length;
            driveToward(zone.x, zone.z, 0.36, baseSpeed);
            break;
          }
        }
        navResult = driveToward(sim.dogX, sim.dogZ, CAMERA_STANDOFF_M, baseSpeed);
        break;
      }
      case 'mirror_chat': {
        const distToStand = Math.hypot(
          SMART_MIRROR_STAND.x - sim.x,
          SMART_MIRROR_STAND.z - sim.z
        );
        if (distToStand > 0.55) {
          navResult = driveToward(
            SMART_MIRROR_STAND.x,
            SMART_MIRROR_STAND.z,
            0.42,
            Math.max(0.88, baseSpeed)
          );
          sim.mirrorActive = false;
        } else {
          // Arrived in front of Smart Mirror -> face west (-PI/2), read live comments & emote!
          sim.plannedPathPoints = [];
          const mirrorFaceHeading = -Math.PI / 2;
          const err = normalizeAngle(mirrorFaceHeading - sim.headingRad);
          const turn = Math.abs(err) > 0.04 ? clamp(err * 1.4, -0.72, 0.72) : 0;
          targetL = turn;
          targetR = -turn;
          lookAtX = sim.mirrorX;
          lookAtZ = sim.mirrorZ;

          if (!sim.mirrorActive) {
            sim.mirrorActive = true;
            const current = MIRROR_COMMENTS[sim.mirrorCommentIndex % MIRROR_COMMENTS.length];
            sim.mirrorComment = current;
            sim.mirrorCommentTimerMs = 0;
            sim.emotion = current.emotion;
            sim.speech = current.reply;
            sim.mirrorSpeakEventPending = current.reply;
          } else {
            sim.mirrorCommentTimerMs += dt * 1000;
            if (sim.mirrorCommentTimerMs >= 4500) {
              advanceMirrorComment(sim);
            }
          }
          navResult = { arrived: true, dist: distToStand };
        }
        break;
      }
      case 'find_owner': {
        navResult = driveToward(sim.ownerX, sim.ownerZ, CAMERA_STANDOFF_M, baseSpeed);
        break;
      }
      case 'return_to_dock': {
        navResult = driveToward(sim.dockX, sim.dockZ, 0.34, baseSpeed * 0.9);
        if (navResult.dist < 0.45) {
          sim.batteryPct = Math.min(100, sim.batteryPct + dt * 4.5);
          sim.emotion = 'sleepy';
        }
        break;
      }
      case 'patrol': {
        const wp = PATROL_WAYPOINTS[sim.patrolIndex % PATROL_WAYPOINTS.length];
        if (Math.hypot(wp.x - sim.x, wp.z - sim.z) < 0.55) {
          sim.patrolIndex = (sim.patrolIndex + 1) % PATROL_WAYPOINTS.length;
          sim.lastAStarAt = 0;
        }
        const activeWp = PATROL_WAYPOINTS[sim.patrolIndex % PATROL_WAYPOINTS.length];
        navResult = driveToward(activeWp.x, activeWp.z, 0.38, baseSpeed);
        break;
      }
      case 'go_to': {
        const { tx, tz, stopDist } = resolveStepDestination(sim, step);
        navResult = driveToward(tx, tz, stopDist, baseSpeed);
        break;
      }
      case 'orbit_target': {
        const { tx, tz } = resolveStepDestination(sim, step);
        sim.orbitAngle += dt * 1.45;
        const orbitR = 1.35;
        const ox = clamp(tx + Math.cos(sim.orbitAngle) * orbitR, NAV_MIN_X + 0.5, NAV_MAX_X - 0.5);
        const oz = clamp(tz + Math.sin(sim.orbitAngle) * orbitR, NAV_MIN_Z + 0.5, NAV_MAX_Z - 0.5);
        driveToward(ox, oz, 0.22, baseSpeed);
        lookAtX = tx;
        lookAtZ = tz;
        break;
      }
      case 'spin_dance': {
        sim.plannedPathPoints = [];
        const stepDuration = step.durationMs || 3000;
        if (sim.stepElapsedMs > stepDuration - 750 && sim.dogDiscovered) {
          const toDogHeading = Math.atan2(sim.dogX - sim.x, sim.dogZ - sim.z);
          const err = normalizeAngle(toDogHeading - sim.headingRad);
          const turn = clamp(err * 1.4, -0.75, 0.75);
          targetL = turn;
          targetR = -turn;
        } else {
          const phase = Math.floor(sim.stepElapsedMs / 800) % 2;
          const spinSpeed = clamp(baseSpeed * 0.85, 0.55, 0.9);
          targetL = phase === 0 ? spinSpeed : -spinSpeed;
          targetR = phase === 0 ? -spinSpeed : spinSpeed;
        }
        break;
      }
      case 'guard': {
        sim.plannedPathPoints = [];
        const sweep = Math.sin(sim.stepElapsedMs * 0.0035) * 0.38;
        targetL = sweep;
        targetR = -sweep;
        break;
      }
      case 'stop':
      default: {
        sim.plannedPathPoints = [];
        targetL = 0;
        targetR = 0;
        break;
      }
    }

    if (isNavGoalStep && navResult.arrived) {
      sim.arrivalHoldMs += dt * 1000;
    } else {
      sim.arrivalHoldMs = 0;
    }

    const baseDuration = step.durationMs || 4000;
    const earlyArrivalComplete =
      isNavGoalStep && sim.arrivalHoldMs >= 700 && sim.stepElapsedMs >= 1300;
    const effectiveTimeout =
      step.action === 'search_dog'
        ? 28000 // Allow full 22m × 16m multi-zone exploration
        : step.action === 'mirror_chat'
          ? Math.max(baseDuration, 18000)
          : isNavGoalStep && !navResult.arrived
            ? Math.max(baseDuration, 11500)
            : baseDuration;

    if (
      !sim.streamingFirstStep &&
      (searchFoundNow || earlyArrivalComplete || sim.stepElapsedMs >= effectiveTimeout)
    ) {
      sim.activeStepIndex += 1;
      sim.stepElapsedMs = 0;
      sim.arrivalHoldMs = 0;
      sim.detourPhase = 'none';
      sim.lastAStarAt = 0;
      sim.plannedPathPoints = [];
      const next = getActiveStep(sim);
      if (!next) {
        sim.activeMode = 'idle';
        if (sim.activeAssistantApp !== 'tiktok_live') {
          sim.isRecording = false;
        }
      } else {
        sim.activeMode = next.action;
      }
    }
  } else {
    sim.activeMode = 'idle';
    sim.detourPhase = 'none';
    sim.plannedPathPoints = [];
    if (!sim.dogDiscovered && !sim.preOrientTarget) {
      targetL = 0;
      targetR = 0;
    } else {
      let targetX = sim.dogX;
      let targetZ = sim.dogZ;
      if (sim.preOrientTarget === 'mirror') {
        targetX = sim.mirrorX;
        targetZ = sim.mirrorZ;
      } else if (sim.preOrientTarget === 'cat') {
        targetX = sim.mochiX;
        targetZ = sim.mochiZ;
      } else if (sim.preOrientTarget === 'bird') {
        targetX = sim.rioX;
        targetZ = sim.rioZ;
      } else if (sim.preOrientTarget === 'owner') {
        targetX = sim.ownerX;
        targetZ = sim.ownerZ;
      } else if (sim.preOrientTarget === 'dock') {
        targetX = sim.dockX;
        targetZ = sim.dockZ;
      } else if (sim.preOrientTarget === 'ball') {
        targetX = sim.ballX;
        targetZ = sim.ballZ;
      } else if (sim.preOrientTarget === 'center') {
        targetX = 0.0;
        targetZ = 0.4;
      }
      lookAtX = targetX;
      lookAtZ = targetZ;

      const dx = targetX - sim.x;
      const dz = targetZ - sim.z;
      const dist = Math.hypot(dx, dz);
      const toTargetHeading = Math.atan2(dx, dz);
      const angleErr = normalizeAngle(toTargetHeading - sim.headingRad);
      const backOff = dist < 1.05 && !sim.preOrientTarget ? -0.25 : 0;
      const turnGain = sim.preOrientTarget ? 1.45 : 0.85;
      const maxTurn = sim.preOrientTarget ? 0.65 : 0.38;
      const turn = Math.abs(angleErr) > 0.05 ? clamp(angleErr * turnGain, -maxTurn, maxTurn) : 0;
      targetL = clamp(backOff + turn, -0.7, 0.7);
      targetR = clamp(backOff - turn, -0.7, 0.7);
    }
  }

  // Clear mirrorActive once WALL-E drives away from the Smart Mirror
  if (
    sim.mirrorActive &&
    sim.activeMode !== 'mirror_chat' &&
    Math.hypot(sim.x - SMART_MIRROR_STAND.x, sim.z - SMART_MIRROR_STAND.z) > 2.2
  ) {
    sim.mirrorActive = false;
  }

  // 4. Smoothly slew motor PWM and integrate differential-drive kinematics
  const pwmSlew = Math.min(1, dt * 12);
  sim.leftPwm += (targetL - sim.leftPwm) * pwmSlew;
  sim.rightPwm += (targetR - sim.rightPwm) * pwmSlew;
  if (Math.abs(sim.leftPwm) < 0.01) sim.leftPwm = 0;
  if (Math.abs(sim.rightPwm) < 0.01) sim.rightPwm = 0;

  const maxLinearSpeed = 2.4; // Crisp pace across the spacious 22m × 16m Smart Home Loft
  const wheelBase = 0.36;
  const vLeft = sim.leftPwm * maxLinearSpeed;
  const vRight = sim.rightPwm * maxLinearSpeed;
  const linearV = (vLeft + vRight) * 0.5;
  const angularW = (vLeft - vRight) / wheelBase;

  sim.headingRad = normalizeAngle(sim.headingRad + angularW * dt);
  let nextX = sim.x + Math.sin(sim.headingRad) * linearV * dt;
  let nextZ = sim.z + Math.cos(sim.headingRad) * linearV * dt;

  // Hard zero-clipping circle push-out (2 passes so WALL-E never penetrates ANY furniture or crate)
  for (let pass = 0; pass < 2; pass++) {
    for (const obs of allObstacles) {
      const cdx = nextX - obs.x;
      const cdz = nextZ - obs.z;
      const cdist = Math.hypot(cdx, cdz);
      const minDist = obs.radius + ROBOT_RADIUS_M;
      if (cdist < minDist && cdist > 0.001) {
        nextX = obs.x + (cdx / cdist) * minDist;
        nextZ = obs.z + (cdz / cdist) * minDist;
      }
    }
  }

  sim.x = clamp(nextX, NAV_MIN_X, NAV_MAX_X);
  sim.z = clamp(nextZ, NAV_MIN_Z, NAV_MAX_Z);

  sim.leftWheelAngle += (vLeft * dt) / 0.075;
  sim.rightWheelAngle += (vRight * dt) / 0.075;

  // 5. Compute expressive pupil gaze
  if (sim.activeMode === 'search_dog' && !sim.dogDiscovered) {
    sim.gazeX = Math.sin(sim.searchSweepPhase) * 0.85;
    sim.gazeY = 0.05;
  } else {
    const targetAngle = Math.atan2(lookAtX - sim.x, lookAtZ - sim.z);
    const relAngle = normalizeAngle(targetAngle - sim.headingRad);
    const desiredGazeX = clamp(relAngle / 1.1, -1, 1);
    sim.gazeX += (desiredGazeX - sim.gazeX) * Math.min(1, dt * 8);
    sim.gazeY = Math.sin(nowMs * 0.0018) * 0.15;
  }

  // 6. Simulate front HC-SR04 ultrasonic sensor distance (cm)
  let minRayDistM = 2.6;
  const dirX = Math.sin(sim.headingRad);
  const dirZ = Math.cos(sim.headingRad);

  const checkTargets = [
    ...allObstacles,
    { id: 'dog', label: 'Dog', x: sim.dogX, z: sim.dogZ, radius: 0.24 },
    { id: 'owner', label: 'Owner', x: sim.ownerX, z: sim.ownerZ, radius: 0.28 },
  ];

  for (const obj of checkTargets) {
    const toX = obj.x - sim.x;
    const toZ = obj.z - sim.z;
    const proj = toX * dirX + toZ * dirZ;
    if (proj > 0 && proj < minRayDistM) {
      const perpSq = toX * toX + toZ * toZ - proj * proj;
      const hitRadius = obj.radius + 0.24;
      if (perpSq <= hitRadius * hitRadius) {
        const surfaceDist = Math.max(0.18, proj - obj.radius);
        minRayDistM = Math.min(minRayDistM, surfaceDist);
      }
    }
  }

  if (Math.abs(dirX) > 0.05) {
    const wallX = dirX > 0 ? ROOM_HALF_W - 0.1 : -(ROOM_HALF_W - 0.1);
    const d = (wallX - sim.x) / dirX;
    if (d > 0) minRayDistM = Math.min(minRayDistM, d);
  }
  if (Math.abs(dirZ) > 0.05) {
    const wallZ = dirZ > 0 ? ROOM_HALF_D - 0.1 : -(ROOM_HALF_D - 0.1);
    const d = (wallZ - sim.z) / dirZ;
    if (d > 0) minRayDistM = Math.min(minRayDistM, d);
  }

  sim.ultrasonicCm = Math.round(clamp(minRayDistM * 100, 18, 250));
}

export function buildWorldStateSnapshot(sim: PhysicsSimState): RobotWorldState {
  const makeEntity = (
    id: string,
    kind: WorldEntity['kind'],
    label: string,
    ex: number,
    ez: number
  ): WorldEntity => {
    const dx = ex - sim.x;
    const dz = ez - sim.z;
    const distance = Number(Math.hypot(dx, dz).toFixed(2));
    const relRad = normalizeAngle(Math.atan2(dx, dz) - sim.headingRad);
    const angleDeg = Math.round((relRad * 180) / Math.PI);
    return {
      id,
      kind,
      label,
      x: Number(ex.toFixed(2)),
      z: Number(ez.toFixed(2)),
      distance,
      angleDeg,
    };
  };

  const entities: WorldEntity[] = [
    ...(sim.dogDiscovered
      ? [makeEntity('dog-1', 'dog', 'Playful Dog (Biscuit)', sim.dogX, sim.dogZ)]
      : []),
    makeEntity('cat-mochi', 'cat', 'Mochi (Ginger Cat)', sim.mochiX, sim.mochiZ),
    makeEntity('cat-luna', 'cat', 'Luna (Violet Tuxedo Cat)', sim.lunaX, sim.lunaZ),
    makeEntity('bird-rio', 'bird', 'Rio (Tropical Bird)', sim.rioX, sim.rioZ),
    makeEntity('smart-mirror', 'mirror', 'Interactive Smart Mirror', sim.mirrorX, sim.mirrorZ),
    makeEntity('owner-1', 'owner', 'Owner Beacon', sim.ownerX, sim.ownerZ),
    makeEntity('dock-1', 'dock', 'Charging Dock', sim.dockX, sim.dockZ),
    makeEntity('ball-1', 'ball', 'Red Toy Ball', sim.ballX, sim.ballZ),
    makeEntity('sofa', 'sofa', 'Modern Sofa', -6.2, -4.8),
    makeEntity('table', 'table', 'Coffee Table', -6.0, -1.8),
    makeEntity('tv_console', 'obstacle', '4K Smart TV Console', 0.0, -6.6),
    makeEntity('kitchen_island', 'obstacle', 'Kitchen Espresso Bar', 6.4, -4.6),
    makeEntity('server_rack', 'obstacle', 'Mini Server Rack', 9.2, -0.4),
    makeEntity('desk', 'obstacle', 'Robotics Workbench', 6.2, 4.0),
    makeEntity('armchair', 'obstacle', 'Lounge Armchair', -8.4, 1.6),
    makeEntity('plant_ne', 'plant', 'Monstera Plant NE', 2.2, -3.2),
    makeEntity('plant_sw', 'plant', 'Monstera Plant SW', -2.0, 4.4),
    makeEntity('dog_bed', 'obstacle', 'Biscuit Dog Bed', -6.2, 4.6),
    ...sim.customCrates.map((c) => makeEntity(c.id, 'obstacle', c.label, c.x, c.z)),
  ];

  return {
    x: Number(sim.x.toFixed(2)),
    z: Number(sim.z.toFixed(2)),
    headingDeg: Math.round((sim.headingRad * 180) / Math.PI),
    batteryPct: Math.round(sim.batteryPct),
    leftPwm: Number(sim.leftPwm.toFixed(2)),
    rightPwm: Number(sim.rightPwm.toFixed(2)),
    ultrasonicCm: sim.ultrasonicCm,
    activeMode: sim.activeMode,
    emotion: sim.emotion,
    isRecording: sim.isRecording,
    dogDiscovered: sim.dogDiscovered,
    searchZoneIndex: sim.searchZoneIndex,
    activeAssistantApp: sim.activeAssistantApp,
    entities,
  };
}

export function buildEsp32Packet(sim: PhysicsSimState): Esp32Packet {
  return {
    t: Date.now(),
    l: Number(sim.leftPwm.toFixed(2)),
    r: Number(sim.rightPwm.toFixed(2)),
    led: EMOTION_LED_MAP[sim.emotion] ?? 'cyan',
    wd: 500,
    mode: sim.activeMode,
  };
}
