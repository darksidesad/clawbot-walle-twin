import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  AlertTriangle,
  Box,
  Camera,
  Compass,
  Dog,
  Eye,
  EyeOff,
  Maximize2,
  MessageSquare,
  Minimize2,
  Navigation,
  Radio,
  Search,
  Sparkles,
  Target,
  Trash2,
  Video,
  Zap,
} from 'lucide-react';
import type {
  AssistantAppMode,
  CameraMode,
  MissionLogEntry,
  MissionPreset,
  ObsidianLogEntry,
  RobotActionPlan,
  RobotActionStep,
  TikTokScreenMode,
  TriadAgentTelemetry,
  TriadRole,
} from '@shared/types';
import { renderWalleEyes } from '@/lib/eyeRenderer';
import {
  CAMERA_FOV_HALF_ANGLE_RAD,
  CAMERA_FOV_RANGE_M,
  MIRROR_COMMENTS,
  NAV_MAX_X,
  NAV_MAX_Z,
  NAV_MIN_X,
  NAV_MIN_Z,
  SMART_MIRROR_POS,
  type FloorToolMode,
  type PhysicsSimState,
  getActiveWaypointChain,
  isDogInCameraFov,
  stepRobotPhysics,
} from '@/lib/robotPhysics';
import { TikTokLiveOverlay } from '@/components/AssistantStageOverlay';

interface ProjectedBox {
  id: string;
  label: string;
  confidence: number;
  distanceM: number;
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
  color: string;
}

interface RobotArena3DProps {
  simRef: React.MutableRefObject<PhysicsSimState>;
  capturePovSnapshotRef: React.MutableRefObject<(() => string) | null>;
  cameraMode: CameraMode;
  onCameraModeChange: (mode: CameraMode) => void;
  floorTool: FloorToolMode;
  onFloorToolChange: (tool: FloorToolMode) => void;
  onHideDog: () => void;
  onTriggerMirrorChat: () => void;
  onNextMirrorComment: () => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  isThinking: boolean;
  activePlan: RobotActionPlan | null;
  activeStep: RobotActionStep | null;
  activeStepIndex: number;
  speech: string;
  tokensPerSec: number;
  decodeMs: number;
  elapsedMs: number;
  speedupFactor: number;
  triad: Record<TriadRole, TriadAgentTelemetry> | null;
  history: MissionLogEntry[];
  obsidianLogs: ObsidianLogEntry[];
  activeAssistantApp: AssistantAppMode;
  tiktokTopic: string;
  tiktokScreenMode: TikTokScreenMode;
  onChangeTikTokScreenMode: (mode: TikTokScreenMode) => void;
  onCloseTikTok: () => void;
  onLogObsidian: (tag: string, text: string) => void;
  missions: MissionPreset[];
  onTriggerMission: (preset: MissionPreset) => void;
  onSyncUiTick: () => void;
}

export function RobotArena3D({
  simRef,
  capturePovSnapshotRef,
  cameraMode,
  onCameraModeChange,
  floorTool,
  onFloorToolChange,
  onHideDog,
  onTriggerMirrorChat,
  onNextMirrorComment,
  isExpanded,
  onToggleExpanded,
  isThinking,
  activePlan,
  activeStep,
  activeStepIndex,
  speech,
  tokensPerSec,
  decodeMs,
  elapsedMs,
  speedupFactor,
  triad,
  history,
  obsidianLogs,
  activeAssistantApp,
  tiktokTopic,
  tiktokScreenMode,
  onChangeTikTokScreenMode,
  onCloseTikTok,
  onLogObsidian,
  missions,
  onTriggerMission,
  onSyncUiTick,
}: RobotArena3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const pipFaceCanvasRef = useRef<HTMLCanvasElement>(null);
  const cameraModeRef = useRef<CameraMode>(cameraMode);
  const floorToolRef = useRef<FloorToolMode>(floorTool);
  const isThinkingRef = useRef<boolean>(isThinking);
  const isExpandedRef = useRef<boolean>(isExpanded);
  const activeAssistantAppRef = useRef<AssistantAppMode>(activeAssistantApp);
  const onSyncUiTickRef = useRef(onSyncUiTick);

  const [povDetections, setPovDetections] = useState<ProjectedBox[]>([]);
  const [povFrameUrl, setPovFrameUrl] = useState<string>('');
  const [crateCount, setCrateCount] = useState(0);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);

  useEffect(() => {
    floorToolRef.current = floorTool;
  }, [floorTool]);

  useEffect(() => {
    isThinkingRef.current = isThinking;
  }, [isThinking]);

  useEffect(() => {
    isExpandedRef.current = isExpanded;
  }, [isExpanded]);

  useEffect(() => {
    activeAssistantAppRef.current = activeAssistantApp;
  }, [activeAssistantApp]);

  useEffect(() => {
    onSyncUiTickRef.current = onSyncUiTick;
  }, [onSyncUiTick]);

  // Main Three.js 60 FPS Simulation & Render Loop
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#091022');
    scene.fog = new THREE.FogExp2('#091022', 0.015);

    const camera = new THREE.PerspectiveCamera(
      48,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.08,
      65
    );

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.48;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Spacious 22m × 16m Smart Home / Robotics Loft Lighting
    const ambientLight = new THREE.AmbientLight('#cbd5e1', 1.9);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight('#7dd3fc', '#1e293b', 1.65);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#fffbeb', 3.2);
    keyLight.position.set(7.5, 13.5, 8.0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 36;
    const d = 13.0;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight('#38bdf8', 1.75);
    fillLight.position.set(-8.5, 8.0, 5.5);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight('#22d3ee', 2.6, 22);
    rimLight.position.set(-7.5, 3.8, -5.0);
    scene.add(rimLight);

    const warmLoungeLight = new THREE.PointLight('#fbbf24', 2.4, 16);
    warmLoungeLight.position.set(-7.6, 2.4, 1.8);
    scene.add(warmLoungeLight);

    const eastLabLight = new THREE.PointLight('#38bdf8', 2.2, 18);
    eastLabLight.position.set(6.5, 3.6, 1.5);
    scene.add(eastLabLight);

    // Expanded 22.0m × 16.0m Smart Home / Robotics Loft Floor + Tactical Grid
    const floorGeo = new THREE.PlaneGeometry(22.0, 16.0);
    const floorMat = new THREE.MeshStandardMaterial({
      color: '#0f182e',
      roughness: 0.76,
      metalness: 0.15,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const gridHelper = new THREE.GridHelper(22.0, 44, '#22d3ee', '#334155');
    gridHelper.scale.set(1, 1, 16.0 / 22.0);
    gridHelper.position.y = 0.005;
    (gridHelper.material as THREE.Material).opacity = 0.45;
    (gridHelper.material as THREE.Material).transparent = true;
    scene.add(gridHelper);

    // Architectural Perimeter LED Smart-Lab Walls (x = ±11.0, z = ±8.0; low LED curb in front for clear Orbit view)
    const wallMat = new THREE.MeshStandardMaterial({
      color: '#111c35',
      roughness: 0.65,
      metalness: 0.25,
    });
    const cyanStripMat = new THREE.MeshBasicMaterial({ color: '#22d3ee' });
    const amberStripMat = new THREE.MeshBasicMaterial({ color: '#f59e0b' });

    // Back Wall (z = -8.0)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(22.0, 1.5, 0.18), wallMat);
    backWall.position.set(0, 0.75, -8.0);
    backWall.receiveShadow = true;
    scene.add(backWall);

    const backBaseStrip = new THREE.Mesh(new THREE.BoxGeometry(21.9, 0.04, 0.2), cyanStripMat);
    backBaseStrip.position.set(0, 0.05, -7.98);
    scene.add(backBaseStrip);

    const backTopStrip = new THREE.Mesh(new THREE.BoxGeometry(21.9, 0.032, 0.2), amberStripMat);
    backTopStrip.position.set(0, 1.48, -7.98);
    scene.add(backTopStrip);

    // Left Wall (x = -11.0) & Right Wall (x = +11.0)
    for (const side of [-1, 1]) {
      const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.5, 16.0), wallMat);
      sideWall.position.set(side * 11.0, 0.75, 0);
      sideWall.receiveShadow = true;
      scene.add(sideWall);

      const sideBase = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 15.9), cyanStripMat);
      sideBase.position.set(side * 10.98, 0.05, 0);
      scene.add(sideBase);

      const sideTop = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.032, 15.9), amberStripMat);
      sideTop.position.set(side * 10.98, 1.48, 0);
      scene.add(sideTop);
    }

    // Subtle Front Threshold LED Strip (z = +8.0) so Orbit Cam sees the entire loft unobstructed
    const frontCurb = new THREE.Mesh(new THREE.BoxGeometry(22.0, 0.08, 0.14), wallMat);
    frontCurb.position.set(0, 0.04, 8.0);
    scene.add(frontCurb);
    const frontBaseStrip = new THREE.Mesh(new THREE.BoxGeometry(21.9, 0.03, 0.16), cyanStripMat);
    frontBaseStrip.position.set(0, 0.085, 7.98);
    scene.add(frontBaseStrip);

    // Living Room Area Rug (West Lounge spanning Sofa & Coffee Table with wide 3.0m corridor)
    const rugMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(4.8, 4.6),
      new THREE.MeshStandardMaterial({ color: '#1e2946', roughness: 0.9 })
    );
    rugMesh.rotation.x = -Math.PI / 2;
    rugMesh.position.set(-6.1, 0.008, -3.3);
    rugMesh.receiveShadow = true;
    scene.add(rugMesh);

    // 1. Modern Lounge Sofa (x: -6.2, z: -4.8) + Warm Under-Sofa Accent Glow
    const sofaGroup = new THREE.Group();
    sofaGroup.position.set(-6.2, 0, -4.8);
    const sofaMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.7 });
    const cushionMat = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.65 });
    const accentPillowMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.55 });

    const sofaBase = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.38, 0.96), sofaMat);
    sofaBase.position.y = 0.19;
    sofaBase.castShadow = true;
    sofaBase.receiveShadow = true;
    sofaGroup.add(sofaBase);

    const sofaUnderGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.45, 1.04),
      new THREE.MeshBasicMaterial({
        color: '#f59e0b',
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
      })
    );
    sofaUnderGlow.rotation.x = -Math.PI / 2;
    sofaUnderGlow.position.y = 0.011;
    sofaGroup.add(sofaUnderGlow);

    const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.52, 0.22), sofaMat);
    sofaBack.position.set(0, 0.55, -0.37);
    sofaBack.castShadow = true;
    sofaGroup.add(sofaBack);

    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.36, 0.96), cushionMat);
    leftArm.position.set(-1.08, 0.46, 0);
    leftArm.castShadow = true;
    sofaGroup.add(leftArm);

    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.36, 0.96), cushionMat);
    rightArm.position.set(1.08, 0.46, 0);
    rightArm.castShadow = true;
    sofaGroup.add(rightArm);

    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.16), accentPillowMat);
    pillow.position.set(-0.72, 0.5, -0.18);
    pillow.rotation.z = 0.18;
    sofaGroup.add(pillow);
    scene.add(sofaGroup);

    // 2. Round Coffee Table (x: -6.0, z: -1.8 — 3.0m clear corridor from sofa!)
    const tableGroup = new THREE.Group();
    tableGroup.position.set(-6.0, 0, -1.8);
    const tableTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.62, 0.06, 28),
      new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.4, metalness: 0.12 })
    );
    tableTop.position.y = 0.38;
    tableTop.castShadow = true;
    tableGroup.add(tableTop);

    const tableBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.26, 0.36, 16),
      new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.6, roughness: 0.3 })
    );
    tableBase.position.y = 0.18;
    tableGroup.add(tableBase);

    const coffeeMug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.045, 0.09, 12),
      new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.3 })
    );
    coffeeMug.position.set(0.2, 0.455, 0.12);
    tableGroup.add(coffeeMug);
    scene.add(tableGroup);

    // 3. Media Console + Glowing 4K Smart TV (x: 0.0, z: -6.6 along North Wall)
    const tvGroup = new THREE.Group();
    tvGroup.position.set(0.0, 0, -6.6);
    const consoleBody = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.44, 0.56),
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.48, metalness: 0.25 })
    );
    consoleBody.position.y = 0.24;
    consoleBody.castShadow = true;
    consoleBody.receiveShadow = true;
    tvGroup.add(consoleBody);

    const consoleTrim = new THREE.Mesh(
      new THREE.BoxGeometry(2.12, 0.04, 0.58),
      new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.45 })
    );
    consoleTrim.position.y = 0.47;
    tvGroup.add(consoleTrim);

    const tvStand = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.14, 0.14),
      new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.7, roughness: 0.3 })
    );
    tvStand.position.set(0, 0.56, -0.08);
    tvGroup.add(tvStand);

    const tvBezel = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 0.96, 0.06),
      new THREE.MeshStandardMaterial({ color: '#020617', metalness: 0.75, roughness: 0.25 })
    );
    tvBezel.position.set(0, 1.08, -0.08);
    tvBezel.castShadow = true;
    tvGroup.add(tvBezel);

    // Stylized glowing 4K Smart TV CanvasTexture showing Cerebras × OpenClaw telemetry waves
    const tvCanvas = document.createElement('canvas');
    tvCanvas.width = 256;
    tvCanvas.height = 144;
    const tvCtx = tvCanvas.getContext('2d');
    if (tvCtx) {
      const grad = tvCtx.createLinearGradient(0, 0, 256, 144);
      grad.addColorStop(0, '#0c1b3a');
      grad.addColorStop(0.55, '#0b3b5c');
      grad.addColorStop(1, '#311b52');
      tvCtx.fillStyle = grad;
      tvCtx.fillRect(0, 0, 256, 144);
      tvCtx.fillStyle = '#22d3ee';
      tvCtx.font = 'bold 18px monospace';
      tvCtx.fillText('CLAWBOT WALL-E 4K', 26, 46);
      tvCtx.fillStyle = '#fbbf24';
      tvCtx.font = 'bold 13px monospace';
      tvCtx.fillText('OPENCLAW × CEREBRAS', 34, 72);
      tvCtx.strokeStyle = '#34d399';
      tvCtx.lineWidth = 3;
      tvCtx.beginPath();
      tvCtx.moveTo(22, 118);
      tvCtx.lineTo(64, 102);
      tvCtx.lineTo(106, 110);
      tvCtx.lineTo(154, 88);
      tvCtx.lineTo(198, 94);
      tvCtx.lineTo(236, 76);
      tvCtx.stroke();
    }
    const tvTex = new THREE.CanvasTexture(tvCanvas);
    tvTex.colorSpace = THREE.SRGBColorSpace;
    const tvScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.64, 0.86),
      new THREE.MeshBasicMaterial({ map: tvTex })
    );
    tvScreen.position.set(0, 1.08, -0.047);
    tvGroup.add(tvScreen);

    const tvBackGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 0.8),
      new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
      })
    );
    tvBackGlow.rotation.x = -Math.PI / 2;
    tvBackGlow.position.y = 0.012;
    tvGroup.add(tvBackGlow);
    scene.add(tvGroup);

    // 4. Kitchen Island / Espresso Bar (x: 6.4, z: -4.6 in NE Zone)
    const kitchenGroup = new THREE.Group();
    kitchenGroup.position.set(6.4, 0, -4.6);
    const islandBase = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 0.86, 0.92),
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.55, metalness: 0.2 })
    );
    islandBase.position.y = 0.43;
    islandBase.castShadow = true;
    islandBase.receiveShadow = true;
    kitchenGroup.add(islandBase);

    const islandCounter = new THREE.Mesh(
      new THREE.BoxGeometry(1.88, 0.07, 1.04),
      new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.25, metalness: 0.15 })
    );
    islandCounter.position.y = 0.895;
    islandCounter.castShadow = true;
    kitchenGroup.add(islandCounter);

    // Chrome Espresso Machine + Cup
    const espressoBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.36, 0.3),
      new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.82, roughness: 0.2 })
    );
    espressoBody.position.set(-0.46, 1.11, -0.14);
    espressoBody.castShadow = true;
    kitchenGroup.add(espressoBody);

    const espressoLed = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.03, 0.02),
      new THREE.MeshBasicMaterial({ color: '#f59e0b' })
    );
    espressoLed.position.set(-0.46, 1.2, 0.015);
    kitchenGroup.add(espressoLed);

    for (const sx of [-0.45, 0.45]) {
      const stoolLeg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.16, 0.58, 12),
        new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.7, roughness: 0.3 })
      );
      stoolLeg.position.set(sx, 0.29, 0.64);
      kitchenGroup.add(stoolLeg);

      const stoolSeat = new THREE.Mesh(
        new THREE.CylinderGeometry(0.19, 0.19, 0.06, 16),
        new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.5 })
      );
      stoolSeat.position.set(sx, 0.6, 0.64);
      stoolSeat.castShadow = true;
      kitchenGroup.add(stoolSeat);
    }
    scene.add(kitchenGroup);

    // 5. Tall Bookshelf / Mini Server Rack with Blinking Cyan/Green LEDs (x: 9.2, z: -0.4 on East Wall)
    const rackGroup = new THREE.Group();
    rackGroup.position.set(9.2, 0, -0.4);
    const rackFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.84, 1.72, 0.86),
      new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.7, roughness: 0.35 })
    );
    rackFrame.position.y = 0.86;
    rackFrame.castShadow = true;
    rackFrame.receiveShadow = true;
    rackGroup.add(rackFrame);

    const serverLeds: THREE.MeshBasicMaterial[] = [];
    for (let bay = 0; bay < 5; bay++) {
      const bayFace = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.22, 0.72),
        new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.55, roughness: 0.4 })
      );
      bayFace.position.set(-0.42, 0.28 + bay * 0.29, 0);
      rackGroup.add(bayFace);

      for (let ledIdx = 0; ledIdx < 3; ledIdx++) {
        const ledMat = new THREE.MeshBasicMaterial({
          color: ledIdx === 0 ? '#22d3ee' : ledIdx === 1 ? '#34d399' : '#fbbf24',
        });
        serverLeds.push(ledMat);
        const ledDot = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.032, 0.05), ledMat);
        ledDot.position.set(-0.445, 0.28 + bay * 0.29, -0.22 + ledIdx * 0.14);
        rackGroup.add(ledDot);
      }
    }

    const rackGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.05, 1.05),
      new THREE.MeshBasicMaterial({
        color: '#34d399',
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
      })
    );
    rackGlow.rotation.x = -Math.PI / 2;
    rackGlow.position.y = 0.012;
    rackGroup.add(rackGlow);
    scene.add(rackGroup);

    // 6. Robotics Workbench Desk (x: 6.2, z: 4.0 in SE Corner) with Dual Telemetry Monitors & Soldering Mat
    const deskGroup = new THREE.Group();
    deskGroup.position.set(6.2, 0, 4.0);
    const deskTopMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.42,
      metalness: 0.28,
    });
    const deskLegMat = new THREE.MeshStandardMaterial({
      color: '#475569',
      metalness: 0.72,
      roughness: 0.3,
    });
    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.06, 0.8), deskTopMat);
    deskTop.position.y = 0.68;
    deskTop.castShadow = true;
    deskTop.receiveShadow = true;
    deskGroup.add(deskTop);

    for (const [lx, lz] of [
      [-0.64, -0.33],
      [0.64, -0.33],
      [-0.64, 0.33],
      [0.64, 0.33],
    ]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.68, 0.055), deskLegMat);
      leg.position.set(lx, 0.34, lz);
      leg.castShadow = true;
      deskGroup.add(leg);
    }

    const solderMat = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.012, 0.34),
      new THREE.MeshStandardMaterial({ color: '#059669', roughness: 0.7 })
    );
    solderMat.position.set(-0.22, 0.716, 0.14);
    deskGroup.add(solderMat);

    const monitorBezelMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      metalness: 0.6,
      roughness: 0.3,
    });
    const monitorScreenCyan = new THREE.MeshBasicMaterial({ color: '#0ea5e9' });
    const monitorScreenAmber = new THREE.MeshBasicMaterial({ color: '#f59e0b' });
    for (const [mx, screenMat, rotY] of [
      [-0.29, monitorScreenCyan, 0.14],
      [0.29, monitorScreenAmber, -0.14],
    ] as const) {
      const monStand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.05), deskLegMat);
      monStand.position.set(mx, 0.78, -0.22);
      deskGroup.add(monStand);

      const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.03), monitorBezelMat);
      bezel.position.set(mx, 0.94, -0.21);
      bezel.rotation.y = rotY;
      bezel.castShadow = true;
      deskGroup.add(bezel);

      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.23), screenMat);
      screen.position.set(mx, 0.94, -0.193);
      screen.rotation.y = rotY;
      deskGroup.add(screen);
    }

    const deskGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.52, 0.9),
      new THREE.MeshBasicMaterial({
        color: '#22d3ee',
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
      })
    );
    deskGlow.rotation.x = -Math.PI / 2;
    deskGlow.position.y = 0.011;
    deskGroup.add(deskGlow);
    scene.add(deskGroup);

    // 7. Cozy Armchair + Warm Glowing Floor Lamp (x: -8.4, z: 1.6 on West Side)
    const armchairGroup = new THREE.Group();
    armchairGroup.position.set(-8.4, 0, 1.6);
    armchairGroup.rotation.y = Math.PI * 0.35;
    const chairFabricMat = new THREE.MeshStandardMaterial({ color: '#3b4d71', roughness: 0.72 });

    const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.34, 0.82), chairFabricMat);
    chairSeat.position.y = 0.22;
    chairSeat.castShadow = true;
    armchairGroup.add(chairSeat);

    const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.56, 0.18), chairFabricMat);
    chairBack.position.set(0, 0.58, -0.32);
    chairBack.castShadow = true;
    armchairGroup.add(chairBack);

    for (const ax of [-0.38, 0.38]) {
      const chairArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.8), chairFabricMat);
      chairArm.position.set(ax, 0.44, 0);
      chairArm.castShadow = true;
      armchairGroup.add(chairArm);
    }

    // Warm Brass Floor Lamp beside Armchair
    const lampPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.03, 1.48, 12),
      new THREE.MeshStandardMaterial({ color: '#d97706', metalness: 0.8, roughness: 0.25 })
    );
    lampPole.position.set(-0.56, 0.74, -0.34);
    armchairGroup.add(lampPole);

    const lampShade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.26, 0.28, 18, 1, true),
      new THREE.MeshStandardMaterial({
        color: '#fef3c7',
        emissive: '#f59e0b',
        emissiveIntensity: 1.1,
        side: THREE.DoubleSide,
      })
    );
    lampShade.position.set(-0.56, 1.48, -0.34);
    armchairGroup.add(lampShade);
    scene.add(armchairGroup);

    // 8. Two Potted Monstera Plants: plant_ne (2.2, -3.2) & plant_sw (-2.0, 4.4)
    const leafMat = new THREE.MeshStandardMaterial({ color: '#10b981', roughness: 0.5 });
    const potMat = new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.65 });
    const addPottedPlant = (px: number, pz: number, scale = 1.0) => {
      const pg = new THREE.Group();
      pg.position.set(px, 0, pz);
      pg.scale.setScalar(scale);
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.22, 0.46, 18), potMat);
      pot.position.y = 0.23;
      pot.castShadow = true;
      pg.add(pot);
      for (let i = 0; i < 7; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), leafMat);
        const ang = (i / 7) * Math.PI * 2;
        leaf.scale.set(1.25, 0.42, 0.85);
        leaf.position.set(Math.cos(ang) * 0.26, 0.56 + (i % 2) * 0.14, Math.sin(ang) * 0.26);
        leaf.rotation.y = ang;
        leaf.castShadow = true;
        pg.add(leaf);
      }
      scene.add(pg);
    };
    addPottedPlant(2.2, -3.2, 1.0);
    addPottedPlant(-2.0, 4.4, 0.94);

    // 9. Cozy Dog Bed + Water Bowl for Biscuit (x: -6.2, z: 4.6 in SW Zone)
    const dogBedGroup = new THREE.Group();
    dogBedGroup.position.set(-6.2, 0, 4.6);
    const bedRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.1, 14, 28),
      new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.8 })
    );
    bedRim.rotation.x = Math.PI / 2;
    bedRim.position.y = 0.1;
    bedRim.castShadow = true;
    dogBedGroup.add(bedRim);

    const bedCushion = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.4, 0.09, 24),
      new THREE.MeshStandardMaterial({ color: '#fcd34d', roughness: 0.85 })
    );
    bedCushion.position.y = 0.055;
    dogBedGroup.add(bedCushion);

    const bowlOuter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.16, 0.08, 18),
      new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.8, roughness: 0.22 })
    );
    bowlOuter.position.set(0.52, 0.04, 0.18);
    dogBedGroup.add(bowlOuter);

    const bowlWater = new THREE.Mesh(
      new THREE.CircleGeometry(0.11, 16),
      new THREE.MeshBasicMaterial({ color: '#38bdf8' })
    );
    bowlWater.rotation.x = -Math.PI / 2;
    bowlWater.position.set(0.52, 0.082, 0.18);
    dogBedGroup.add(bowlWater);
    scene.add(dogBedGroup);

    // 10. Glowing Cyan Charging Dock + Holographic Charge Column & Floating Ring (x: -9.2, z: -5.4)
    const dockGroup = new THREE.Group();
    dockGroup.position.set(-9.2, 0, -5.4);
    const dockPad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.5, 0.04, 28),
      new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.5, roughness: 0.4 })
    );
    dockPad.position.y = 0.02;
    dockGroup.add(dockPad);

    const dockRing = new THREE.Mesh(
      new THREE.RingGeometry(0.34, 0.44, 32),
      new THREE.MeshBasicMaterial({ color: '#22d3ee', side: THREE.DoubleSide })
    );
    dockRing.rotation.x = -Math.PI / 2;
    dockRing.position.y = 0.043;
    dockGroup.add(dockRing);

    const holoColumn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.36, 0.85, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#22d3ee',
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
      })
    );
    holoColumn.position.y = 0.45;
    dockGroup.add(holoColumn);

    const holoFloatingRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.015, 10, 32),
      new THREE.MeshBasicMaterial({ color: '#38bdf8' })
    );
    holoFloatingRing.rotation.x = Math.PI / 2;
    holoFloatingRing.position.y = 0.65;
    dockGroup.add(holoFloatingRing);

    const dockTower = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.52, 0.12),
      new THREE.MeshStandardMaterial({
        color: '#1e293b',
        emissive: '#06b6d4',
        emissiveIntensity: 0.65,
      })
    );
    dockTower.position.set(0, 0.28, -0.32);
    dockGroup.add(dockTower);
    scene.add(dockGroup);

    // 11. Owner Beacon Figure (x: 2.4, z: 0.8)
    const ownerGroup = new THREE.Group();
    ownerGroup.position.set(2.4, 0, 0.8);
    const ownerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.43, 28),
      new THREE.MeshBasicMaterial({ color: '#34d399', side: THREE.DoubleSide })
    );
    ownerRing.rotation.x = -Math.PI / 2;
    ownerRing.position.y = 0.015;
    ownerGroup.add(ownerRing);

    const ownerBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 0.72, 16),
      new THREE.MeshStandardMaterial({ color: '#10b981', roughness: 0.45 })
    );
    ownerBody.position.y = 0.38;
    ownerBody.castShadow = true;
    ownerGroup.add(ownerBody);

    const ownerHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 16, 16),
      new THREE.MeshStandardMaterial({ color: '#fde68a', roughness: 0.55 })
    );
    ownerHead.position.y = 0.92;
    ownerHead.castShadow = true;
    ownerGroup.add(ownerHead);
    scene.add(ownerGroup);

    // 12. 3D Full-Length Interactive Smart Mirror on West Wall (x: -10.55, z: -2.2, facing +X)
    const mirrorGroup = new THREE.Group();
    mirrorGroup.position.set(SMART_MIRROR_POS.x, 0, SMART_MIRROR_POS.z);

    const mirrorFrameMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      metalness: 0.78,
      roughness: 0.25,
    });
    const mirrorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.1, 1.56), mirrorFrameMat);
    mirrorFrame.position.y = 1.05;
    mirrorFrame.castShadow = true;
    mirrorGroup.add(mirrorFrame);

    // Glowing Cyan/Violet LED Halo Strips around Mirror Frame
    const mirrorLedMat = new THREE.MeshBasicMaterial({ color: '#22d3ee' });
    const mirrorLedTop = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.04, 1.62), mirrorLedMat);
    mirrorLedTop.position.set(0.02, 2.1, 0);
    mirrorGroup.add(mirrorLedTop);
    const mirrorLedBot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.04, 1.62), mirrorLedMat);
    mirrorLedBot.position.set(0.02, 0.04, 0);
    mirrorGroup.add(mirrorLedBot);
    for (const mz of [-0.79, 0.79]) {
      const mirrorLedSide = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.1, 0.04), mirrorLedMat);
      mirrorLedSide.position.set(0.02, 1.05, mz);
      mirrorGroup.add(mirrorLedSide);
    }

    // Live CanvasTexture Smart Mirror Surface (shows WALL-E reflection + live comments!)
    const mirrorCanvas = document.createElement('canvas');
    mirrorCanvas.width = 320;
    mirrorCanvas.height = 420;
    const mirrorCtx = mirrorCanvas.getContext('2d');
    const mirrorTexture = new THREE.CanvasTexture(mirrorCanvas);
    mirrorTexture.colorSpace = THREE.SRGBColorSpace;

    const mirrorSurface = new THREE.Mesh(
      new THREE.PlaneGeometry(1.42, 1.94),
      new THREE.MeshBasicMaterial({ map: mirrorTexture })
    );
    mirrorSurface.rotation.y = Math.PI / 2; // Faces +X into the loft
    mirrorSurface.position.set(0.068, 1.05, 0);
    mirrorGroup.add(mirrorSurface);

    // Glowing Interactive Floor Stand Pad in front of Smart Mirror
    const mirrorFloorGlow = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.62, 32),
      new THREE.MeshBasicMaterial({
        color: '#e879f9',
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      })
    );
    mirrorFloorGlow.rotation.x = -Math.PI / 2;
    mirrorFloorGlow.position.set(1.45, 0.015, 0);
    mirrorGroup.add(mirrorFloorGlow);
    scene.add(mirrorGroup);

    const drawSmartMirrorCanvas = (simState: PhysicsSimState, timeMs: number) => {
      if (!mirrorCtx) return;
      const w = mirrorCanvas.width;
      const h = mirrorCanvas.height;

      // Reflective obsidian-cyan smart glass backdrop
      const bg = mirrorCtx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#0c162d');
      bg.addColorStop(0.45, '#152544');
      bg.addColorStop(1, '#12122e');
      mirrorCtx.fillStyle = bg;
      mirrorCtx.fillRect(0, 0, w, h);

      // Subtle diagonal glass specular reflection bands
      mirrorCtx.fillStyle = 'rgba(186, 230, 253, 0.08)';
      mirrorCtx.beginPath();
      mirrorCtx.moveTo(0, 60);
      mirrorCtx.lineTo(140, 0);
      mirrorCtx.lineTo(195, 0);
      mirrorCtx.lineTo(0, 115);
      mirrorCtx.closePath();
      mirrorCtx.fill();

      // Top Smart Mirror HUD Bar
      mirrorCtx.fillStyle = 'rgba(2, 6, 23, 0.72)';
      mirrorCtx.fillRect(10, 10, w - 20, 34);
      mirrorCtx.fillStyle = simState.mirrorActive ? '#34d399' : '#22d3ee';
      mirrorCtx.beginPath();
      mirrorCtx.arc(26, 27, 5, 0, Math.PI * 2);
      mirrorCtx.fill();
      mirrorCtx.fillStyle = '#e2e8f0';
      mirrorCtx.font = 'bold 13px monospace';
      mirrorCtx.fillText('MIRROR LINK LIVE', 38, 31);
      mirrorCtx.fillStyle = '#f472b6';
      mirrorCtx.font = 'bold 12px monospace';
      mirrorCtx.fillText('4.2K', w - 54, 31);

      const distToMirror = Math.hypot(
        simState.x - SMART_MIRROR_POS.x,
        simState.z - SMART_MIRROR_POS.z
      );
      const showReflection = simState.mirrorActive || distToMirror < 3.8;

      if (showReflection) {
        // Stylized live reflection of WALL-E's yellow chassis + animated glowing eyes!
        const bob = Math.sin(timeMs * 0.005) * 4;
        mirrorCtx.fillStyle = '#f59e0b';
        mirrorCtx.fillRect(92, 205 + bob, 136, 56);
        mirrorCtx.fillStyle = '#1e293b';
        mirrorCtx.fillRect(72, 224 + bob, 20, 44);
        mirrorCtx.fillRect(228, 224 + bob, 20, 44);

        // Phone head bezel in mirror
        mirrorCtx.fillStyle = '#0f172a';
        mirrorCtx.strokeStyle = '#38bdf8';
        mirrorCtx.lineWidth = 3;
        mirrorCtx.fillRect(78, 86 + bob, 164, 104);
        mirrorCtx.strokeRect(78, 86 + bob, 164, 104);

        // Animated reflected glowing eyes matching simState.emotion!
        const eyeColor =
          simState.emotion === 'love'
            ? '#f472b6'
            : simState.emotion === 'excited'
              ? '#fbbf24'
              : '#22d3ee';
        mirrorCtx.fillStyle = eyeColor;
        if (simState.emotion === 'love') {
          mirrorCtx.font = 'bold 42px sans-serif';
          mirrorCtx.fillText('❤', 102, 152 + bob);
          mirrorCtx.fillText('❤', 176, 152 + bob);
        } else {
          mirrorCtx.beginPath();
          mirrorCtx.ellipse(126, 138 + bob, 22, 26, 0, 0, Math.PI * 2);
          mirrorCtx.ellipse(194, 138 + bob, 22, 26, 0, 0, Math.PI * 2);
          mirrorCtx.fill();
          mirrorCtx.fillStyle = '#020617';
          mirrorCtx.beginPath();
          mirrorCtx.arc(128, 138 + bob, 8, 0, Math.PI * 2);
          mirrorCtx.arc(196, 138 + bob, 8, 0, Math.PI * 2);
          mirrorCtx.fill();
        }
      } else {
        mirrorCtx.fillStyle = 'rgba(34, 211, 238, 0.85)';
        mirrorCtx.font = 'bold 20px monospace';
        mirrorCtx.fillText('SMART MIRROR', 82, 148);
        mirrorCtx.fillStyle = '#94a3b8';
        mirrorCtx.font = '13px monospace';
        mirrorCtx.fillText('Click Mirror to chat live!', 56, 180);
      }

      // Live scrolling viewer comment card at bottom of mirror glass
      const activeComment =
        simState.mirrorComment ??
        MIRROR_COMMENTS[simState.mirrorCommentIndex % MIRROR_COMMENTS.length];
      mirrorCtx.fillStyle = 'rgba(9, 13, 28, 0.86)';
      mirrorCtx.strokeStyle = 'rgba(232, 121, 249, 0.65)';
      mirrorCtx.lineWidth = 2;
      mirrorCtx.fillRect(14, 294, w - 28, 112);
      mirrorCtx.strokeRect(14, 294, w - 28, 112);

      mirrorCtx.fillStyle = '#f472b6';
      mirrorCtx.font = 'bold 13px monospace';
      mirrorCtx.fillText(`${activeComment.user} · LIVE CHAT`, 24, 316);

      mirrorCtx.fillStyle = '#f8fafc';
      mirrorCtx.font = '13px sans-serif';
      const words = activeComment.text.split(' ');
      let line = '';
      let ly = 338;
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (test.length > 32) {
          mirrorCtx.fillText(line, 24, ly);
          line = word;
          ly += 18;
          if (ly > 392) break;
        } else {
          line = test;
        }
      }
      if (line && ly <= 394) mirrorCtx.fillText(line, 24, ly);

      mirrorTexture.needsUpdate = true;
    };

    // 13. Colorful Animated Cats ("Mochi" Ginger Tabby & "Luna" Midnight-Violet Tuxedo)
    const createStylizedCat = (opts: {
      furHex: string;
      accentHex: string;
      bellyHex: string;
      eyeHex: string;
      haloHex: string;
    }) => {
      const catGroup = new THREE.Group();
      const furMat = new THREE.MeshStandardMaterial({ color: opts.furHex, roughness: 0.58 });
      const accentMat = new THREE.MeshStandardMaterial({ color: opts.accentHex, roughness: 0.62 });
      const whiteMat = new THREE.MeshStandardMaterial({ color: opts.bellyHex, roughness: 0.65 });
      const eyeMat = new THREE.MeshBasicMaterial({ color: opts.eyeHex });

      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.22, 0.3, 24),
        new THREE.MeshBasicMaterial({
          color: opts.haloHex,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
        })
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.013;
      catGroup.add(halo);

      // Sleek Cat Torso + Chest Bib
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.4), furMat);
      torso.position.set(0, 0.22, 0);
      torso.castShadow = true;
      catGroup.add(torso);

      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.06, 0.14), accentMat);
      stripe.position.set(0, 0.29, -0.02);
      catGroup.add(stripe);

      const bib = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.06), whiteMat);
      bib.position.set(0, 0.2, 0.19);
      catGroup.add(bib);

      // Cat Head + Pointed Triangular Ears + Glowing Eyes
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.18), furMat);
      head.position.set(0, 0.35, 0.22);
      head.castShadow = true;
      catGroup.add(head);

      const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.06), whiteMat);
      muzzle.position.set(0, 0.31, 0.32);
      catGroup.add(muzzle);

      for (const ex of [-0.07, 0.07]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.1, 4), accentMat);
        ear.position.set(ex, 0.48, 0.22);
        catGroup.add(ear);

        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), eyeMat);
        eye.position.set(ex * 0.72, 0.37, 0.312);
        catGroup.add(eye);
      }

      // 4 White-Tipped Paws (animated while strolling)
      const legs: THREE.Mesh[] = [];
      const offsets: Array<[number, number, number]> = [
        [-0.07, 0.09, 0.14],
        [0.07, 0.09, 0.14],
        [-0.07, 0.09, -0.14],
        [0.07, 0.09, -0.14],
      ];
      for (const [lx, ly, lz] of offsets) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.17, 0.052), whiteMat);
        leg.position.set(lx, ly, lz);
        leg.castShadow = true;
        catGroup.add(leg);
        legs.push(leg);
      }

      // Curved Upright Swishing Tail
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.3, 10), accentMat);
      tail.position.set(0, 0.36, -0.22);
      tail.rotation.x = -0.35;
      catGroup.add(tail);

      scene.add(catGroup);
      return { group: catGroup, legs, tail };
    };

    const mochiCat = createStylizedCat({
      furHex: '#f97316',
      accentHex: '#c2410c',
      bellyHex: '#fff7ed',
      eyeHex: '#34d399',
      haloHex: '#fb923c',
    });

    const lunaCat = createStylizedCat({
      furHex: '#3730a3',
      accentHex: '#1e1b4b',
      bellyHex: '#f8fafc',
      eyeHex: '#fbbf24',
      haloHex: '#818cf8',
    });

    // 14. Colorful Tropical Bird ("Rio") gliding above the loft with articulated flapping wings!
    const rioGroup = new THREE.Group();
    const rioBodyMat = new THREE.MeshStandardMaterial({
      color: '#06b6d4',
      emissive: '#0891b2',
      emissiveIntensity: 0.22,
      roughness: 0.35,
    });
    const rioWingMat = new THREE.MeshStandardMaterial({
      color: '#10b981',
      emissive: '#059669',
      emissiveIntensity: 0.25,
      roughness: 0.4,
    });
    const rioGoldMat = new THREE.MeshStandardMaterial({ color: '#fbbf24', roughness: 0.35 });
    const rioCrestMat = new THREE.MeshStandardMaterial({ color: '#f43f5e', roughness: 0.4 });

    const rioBody = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 12), rioBodyMat);
    rioBody.scale.set(0.85, 0.85, 1.55);
    rioBody.castShadow = true;
    rioGroup.add(rioBody);

    const rioHead = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 12), rioBodyMat);
    rioHead.position.set(0, 0.06, 0.2);
    rioGroup.add(rioHead);

    const rioBeak = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.11, 8), rioGoldMat);
    rioBeak.rotation.x = Math.PI / 2;
    rioBeak.position.set(0, 0.045, 0.31);
    rioGroup.add(rioBeak);

    const rioCrest = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.1), rioCrestMat);
    rioCrest.position.set(0, 0.15, 0.19);
    rioCrest.rotation.x = -0.3;
    rioGroup.add(rioCrest);

    const rioTail = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.28), rioCrestMat);
    rioTail.position.set(0, 0.0, -0.28);
    rioGroup.add(rioTail);

    // Articulated Left & Right Colorful Wings (pivoting cleanly at shoulders)
    const rioLeftWing = new THREE.Group();
    rioLeftWing.position.set(0.09, 0.03, 0.02);
    const leftWingBlade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.026, 0.17), rioWingMat);
    leftWingBlade.position.x = 0.16;
    rioLeftWing.add(leftWingBlade);
    const leftWingTip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.028, 0.12), rioGoldMat);
    leftWingTip.position.set(0.32, 0.005, -0.02);
    rioLeftWing.add(leftWingTip);
    rioGroup.add(rioLeftWing);

    const rioRightWing = new THREE.Group();
    rioRightWing.position.set(-0.09, 0.03, 0.02);
    const rightWingBlade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.026, 0.17), rioWingMat);
    rightWingBlade.position.x = -0.16;
    rioRightWing.add(rightWingBlade);
    const rightWingTip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.028, 0.12), rioGoldMat);
    rightWingTip.position.set(-0.32, 0.005, -0.02);
    rioRightWing.add(rightWingTip);
    rioGroup.add(rioRightWing);
    scene.add(rioGroup);

    // Subtle soft ground shadow marker below Rio so flight height pops visually
    const rioFloorShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.24, 16),
      new THREE.MeshBasicMaterial({
        color: '#06b6d4',
        transparent: true,
        opacity: 0.22,
      })
    );
    rioFloorShadow.rotation.x = -Math.PI / 2;
    rioFloorShadow.position.y = 0.015;
    scene.add(rioFloorShadow);

    // 6. Rolling Red Toy Ball
    const ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 20, 20),
      new THREE.MeshStandardMaterial({
        color: '#fb7185',
        emissive: '#e11d48',
        emissiveIntensity: 0.22,
        roughness: 0.32,
        metalness: 0.15,
      })
    );
    ballMesh.castShadow = true;
    scene.add(ballMesh);

    // 7. Adorable Low-Poly Animated Dog ("Biscuit")
    const dogGroup = new THREE.Group();
    const dogFurMat = new THREE.MeshStandardMaterial({
      color: '#fbbf24',
      roughness: 0.55,
      metalness: 0.08,
    });
    const dogDarkMat = new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.65 });
    const collarMat = new THREE.MeshStandardMaterial({
      color: '#ef4444',
      emissive: '#dc2626',
      emissiveIntensity: 0.25,
      roughness: 0.35,
    });

    const dogGlowRing = new THREE.Mesh(
      new THREE.RingGeometry(0.24, 0.32, 28),
      new THREE.MeshBasicMaterial({
        color: '#fbbf24',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
      })
    );
    dogGlowRing.rotation.x = -Math.PI / 2;
    dogGlowRing.position.y = 0.012;
    dogGroup.add(dogGlowRing);

    const dogTorso = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.44), dogFurMat);
    dogTorso.position.set(0, 0.25, 0);
    dogTorso.castShadow = true;
    dogGroup.add(dogTorso);

    const dogCollar = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.06, 0.08), collarMat);
    dogCollar.position.set(0, 0.28, 0.18);
    dogGroup.add(dogCollar);

    const dogHead = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.22), dogFurMat);
    dogHead.position.set(0, 0.39, 0.24);
    dogHead.castShadow = true;
    dogGroup.add(dogHead);

    const dogSnout = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.12), dogDarkMat);
    dogSnout.position.set(0, 0.35, 0.38);
    dogGroup.add(dogSnout);

    const eyeDotMat = new THREE.MeshBasicMaterial({ color: '#0f172a' });
    for (const ex of [-0.055, 0.055]) {
      const dogEye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), eyeDotMat);
      dogEye.position.set(ex, 0.42, 0.355);
      dogGroup.add(dogEye);
    }

    const leftEar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.08), dogDarkMat);
    leftEar.position.set(-0.12, 0.45, 0.22);
    dogGroup.add(leftEar);

    const rightEar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.08), dogDarkMat);
    rightEar.position.set(0.12, 0.45, 0.22);
    dogGroup.add(rightEar);

    const dogLegs: THREE.Mesh[] = [];
    const legOffsets = [
      [-0.08, 0.11, 0.15],
      [0.08, 0.11, 0.15],
      [-0.08, 0.11, -0.15],
      [0.08, 0.11, -0.15],
    ];
    for (const [lx, ly, lz] of legOffsets) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.06), dogFurMat);
      leg.position.set(lx, ly, lz);
      leg.castShadow = true;
      dogGroup.add(leg);
      dogLegs.push(leg);
    }

    const dogTail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.05), dogDarkMat);
    dogTail.position.set(0, 0.36, -0.23);
    dogTail.rotation.x = -0.45;
    dogGroup.add(dogTail);
    scene.add(dogGroup);

    // 8. MINI WALL-E DIY ROBOT + 3D ULTRASONIC SONAR CONE + REAR PHONE CAMERA RIG
    const robotGroup = new THREE.Group();

    const walleYellowMat = new THREE.MeshStandardMaterial({
      color: '#fbbf24',
      roughness: 0.36,
      metalness: 0.22,
    });
    const walleCharcoalMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.5,
      metalness: 0.35,
    });
    const rubberTireMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      roughness: 0.85,
    });
    const hubYellowMat = new THREE.MeshStandardMaterial({
      color: '#fcd34d',
      roughness: 0.32,
      metalness: 0.22,
    });

    // Glow Halo Ring beneath WALL-E
    const robotGlowMat = new THREE.MeshBasicMaterial({
      color: '#22d3ee',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    const robotGlowRing = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.34, 32), robotGlowMat);
    robotGlowRing.rotation.x = -Math.PI / 2;
    robotGlowRing.position.y = 0.012;
    robotGroup.add(robotGlowRing);

    // 3D-Printed Main Base Chassis + Yellow Wheel Fenders
    const chassisBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.09, 0.38),
      walleYellowMat
    );
    chassisBase.position.set(0, 0.095, 0);
    chassisBase.castShadow = true;
    chassisBase.receiveShadow = true;
    robotGroup.add(chassisBase);

    for (const fx of [-0.175, 0.175]) {
      const fender = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.022, 0.21),
        walleYellowMat
      );
      fender.position.set(fx, 0.165, 0.05);
      robotGroup.add(fender);
    }

    // Front Bumper + HC-SR04 Ultrasonic Sensor Cans
    const frontBumper = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.05, 0.04),
      walleCharcoalMat
    );
    frontBumper.position.set(0, 0.095, 0.195);
    robotGroup.add(frontBumper);

    const metalCanMat = new THREE.MeshStandardMaterial({
      color: '#e2e8f0',
      metalness: 0.85,
      roughness: 0.18,
    });
    for (const sx of [-0.055, 0.055]) {
      const can = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 0.03, 16),
        metalCanMat
      );
      can.rotation.x = Math.PI / 2;
      can.position.set(sx, 0.1, 0.21);
      robotGroup.add(can);
    }

    // 3D HC-SR04 Ultrasonic Sensor Beam Cone (projects forward from front bumper!)
    const sonarConeMat = new THREE.MeshBasicMaterial({
      color: '#34d399',
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const sonarConeGeo = new THREE.ConeGeometry(0.32, 1.0, 20, 1, true);
    // Translate geometry so tip is at (0,0,0) and cone opens along +Z
    sonarConeGeo.rotateX(-Math.PI / 2);
    sonarConeGeo.translate(0, 0, 0.5);
    const sonarConeMesh = new THREE.Mesh(sonarConeGeo, sonarConeMat);
    sonarConeMesh.position.set(0, 0.1, 0.22);
    robotGroup.add(sonarConeMesh);

    // 3D Camera FOV Room Search Fan (±40°, 3.3m translucent wedge on floor during search_dog!)
    const fovFanMat = new THREE.MeshBasicMaterial({
      color: '#22d3ee',
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const fovFanGeo = new THREE.CircleGeometry(
      CAMERA_FOV_RANGE_M,
      28,
      -CAMERA_FOV_HALF_ANGLE_RAD,
      CAMERA_FOV_HALF_ANGLE_RAD * 2
    );
    // Rotate flat onto XZ floor so local angle 0 points forward along +Z (right-hand rule: -PI/2 maps +X -> +Z)
    fovFanGeo.rotateX(-Math.PI / 2);
    fovFanGeo.rotateY(-Math.PI / 2);
    const fovFanMesh = new THREE.Mesh(fovFanGeo, fovFanMat);
    fovFanMesh.position.set(0, 0.022, 0.16);
    fovFanMesh.visible = false;
    robotGroup.add(fovFanMesh);

    // Left & Right TT Gearmotor Wheels
    const createTTWheel = () => {
      const wheelGroup = new THREE.Group();
      const tire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.085, 0.085, 0.045, 24),
        rubberTireMat
      );
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wheelGroup.add(tire);

      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.052, 0.052, 0.048, 16),
        hubYellowMat
      );
      hub.rotation.z = Math.PI / 2;
      wheelGroup.add(hub);

      const spoke1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.052, 0.14, 0.016),
        walleCharcoalMat
      );
      wheelGroup.add(spoke1);

      const spoke2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.052, 0.016, 0.14),
        walleCharcoalMat
      );
      wheelGroup.add(spoke2);
      return wheelGroup;
    };

    const leftWheelGroup = createTTWheel();
    leftWheelGroup.position.set(0.185, 0.085, 0.05);
    robotGroup.add(leftWheelGroup);

    const rightWheelGroup = createTTWheel();
    rightWheelGroup.position.set(-0.185, 0.085, 0.05);
    robotGroup.add(rightWheelGroup);

    // Rear Metal Ball Caster
    const rearCaster = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 14, 14),
      metalCanMat
    );
    rearCaster.position.set(0, 0.035, -0.14);
    robotGroup.add(rearCaster);

    // Rear 4× AA Battery Pack Holder
    const batteryPack = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.045, 0.13),
      walleCharcoalMat
    );
    batteryPack.position.set(0, 0.16, -0.1);
    robotGroup.add(batteryPack);

    const aaCellMat = new THREE.MeshStandardMaterial({
      color: '#10b981',
      metalness: 0.45,
      roughness: 0.3,
    });
    for (let i = 0; i < 4; i++) {
      const cell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 0.11, 12),
        aaCellMat
      );
      cell.rotation.z = Math.PI / 2;
      cell.position.set(0, 0.182, -0.145 + i * 0.03);
      robotGroup.add(cell);
    }

    // Mid-Deck ESP32 Module + Pulsing Status LED
    const esp32Pcb = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.018, 0.12),
      new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.4, metalness: 0.3 })
    );
    esp32Pcb.position.set(0, 0.15, 0.04);
    robotGroup.add(esp32Pcb);

    const espLedMat = new THREE.MeshBasicMaterial({ color: '#22d3ee' });
    const espLed = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 10), espLedMat);
    espLed.position.set(0.025, 0.165, 0.05);
    robotGroup.add(espLed);

    // Tilted-Back Android Smartphone Cradle + Live CanvasTexture Screen + Detailed Rear Camera Rig
    const phoneMountGroup = new THREE.Group();
    phoneMountGroup.position.set(0, 0.27, 0.07);
    phoneMountGroup.rotation.x = -0.32;

    const phoneStand = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.12, 0.04),
      walleYellowMat
    );
    phoneStand.position.set(0, -0.09, -0.02);
    phoneMountGroup.add(phoneStand);

    const phoneBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.18, 0.022),
      new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.65, roughness: 0.25 })
    );
    phoneBody.castShadow = true;
    phoneMountGroup.add(phoneBody);

    const eyeCanvas = document.createElement('canvas');
    eyeCanvas.width = 320;
    eyeCanvas.height = 200;
    const eyeCtx = eyeCanvas.getContext('2d');
    const eyeTexture = new THREE.CanvasTexture(eyeCanvas);
    eyeTexture.colorSpace = THREE.SRGBColorSpace;

    // Front OLED Face Screen
    const phoneScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.256, 0.158),
      new THREE.MeshBasicMaterial({ map: eyeTexture })
    );
    phoneScreen.position.z = 0.012;
    phoneMountGroup.add(phoneScreen);

    // Rear Smartphone Detail (visible in Chase Cam!): Dual-Lens Camera Island + MagSafe Glow Ring + Rear Mini OLED Mirror
    const camIsland = new THREE.Mesh(
      new THREE.BoxGeometry(0.075, 0.075, 0.008),
      new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.8, roughness: 0.2 })
    );
    camIsland.position.set(-0.085, 0.035, -0.013);
    phoneMountGroup.add(camIsland);

    for (const ly of [0.05, 0.02]) {
      const lens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.013, 0.013, 0.01, 14),
        metalCanMat
      );
      lens.rotation.x = Math.PI / 2;
      lens.position.set(-0.095, ly, -0.015);
      phoneMountGroup.add(lens);
    }

    const rearTallyLedMat = new THREE.MeshBasicMaterial({ color: '#fb7185' });
    const rearTallyLed = new THREE.Mesh(
      new THREE.SphereGeometry(0.007, 8, 8),
      rearTallyLedMat
    );
    rearTallyLed.position.set(-0.065, 0.05, -0.016);
    phoneMountGroup.add(rearTallyLed);

    const magSafeRing = new THREE.Mesh(
      new THREE.RingGeometry(0.038, 0.048, 24),
      new THREE.MeshBasicMaterial({ color: '#22d3ee', side: THREE.DoubleSide })
    );
    magSafeRing.position.set(0.02, -0.005, -0.013);
    phoneMountGroup.add(magSafeRing);

    // Rear Sub-Display OLED Mirror on phone back so Chase Cam also sees live glowing eyes on the 3D robot!
    const rearMiniScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.11, 0.068),
      new THREE.MeshBasicMaterial({ map: eyeTexture })
    );
    rearMiniScreen.rotation.y = Math.PI;
    rearMiniScreen.position.set(0.055, 0.032, -0.013);
    phoneMountGroup.add(rearMiniScreen);

    robotGroup.add(phoneMountGroup);

    // Curved USB-C Cable from ESP32 to Android Phone bottom port
    const cableCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.155, 0.09),
      new THREE.Vector3(0.07, 0.17, 0.14),
      new THREE.Vector3(0.05, 0.21, 0.13),
      new THREE.Vector3(0, 0.2, 0.1),
    ]);
    const cableMesh = new THREE.Mesh(
      new THREE.TubeGeometry(cableCurve, 16, 0.008, 8, false),
      new THREE.MeshStandardMaterial({ color: '#020617', roughness: 0.4 })
    );
    robotGroup.add(cableMesh);

    scene.add(robotGroup);

    // 9. 3D Glowing Multi-Step Waypoint Trajectory Line + Target Lock Reticle Ring + Avoidance Repulsion Arrow
    const trajectoryMat = new THREE.LineBasicMaterial({
      color: '#22d3ee',
      transparent: true,
      opacity: 0.88,
    });
    const trajectoryGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.025, 0),
      new THREE.Vector3(0, 0.025, 0),
    ]);
    const trajectoryLine = new THREE.Line(trajectoryGeo, trajectoryMat);
    scene.add(trajectoryLine);

    const targetLockRing = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.36, 28),
      new THREE.MeshBasicMaterial({
        color: '#22d3ee',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      })
    );
    targetLockRing.rotation.x = -Math.PI / 2;
    targetLockRing.position.y = 0.024;
    scene.add(targetLockRing);

    const repulsionArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0.16, 0),
      0.7,
      0xfbbf24,
      0.18,
      0.12
    );
    repulsionArrow.visible = false;
    scene.add(repulsionArrow);

    // Dynamic User-Dropped Obstacle Crates Group
    const cratesGroup = new THREE.Group();
    scene.add(cratesGroup);
    const crateMeshes = new Map<string, THREE.Mesh>();
    const crateGeo = new THREE.BoxGeometry(0.46, 0.42, 0.46);
    const crateMat = new THREE.MeshStandardMaterial({
      color: '#f59e0b',
      roughness: 0.5,
      metalness: 0.15,
    });

    // Interactive Orbit Camera Controls & Floor Raycasting (spacious 22.0m × 16.0m Smart Home Loft)
    // Starts cleanly near (0, 10.2, 13.8) so the entire loft and wide corridors frame cinematically!
    let orbitYaw = 0.08;
    let orbitPitch = 0.635;
    let orbitDist = 17.1;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let pointerDownX = 0;
    let pointerDownY = 0;

    // Secondary Offscreen WebGL POV Camera + RenderTarget for Real Live TikTok POV & Instagram Snaps
    const POV_LIVE_W = 240;
    const POV_LIVE_H = 320;
    const povLiveTarget = new THREE.WebGLRenderTarget(POV_LIVE_W, POV_LIVE_H);
    const povLivePixels = new Uint8Array(POV_LIVE_W * POV_LIVE_H * 4);
    const povLiveCanvas = document.createElement('canvas');
    povLiveCanvas.width = POV_LIVE_W;
    povLiveCanvas.height = POV_LIVE_H;
    const povLiveCtx = povLiveCanvas.getContext('2d');
    const povLiveImgData = povLiveCtx ? povLiveCtx.createImageData(POV_LIVE_W, POV_LIVE_H) : null;

    const SNAP_W = 384;
    const SNAP_H = 216;
    const snapTarget = new THREE.WebGLRenderTarget(SNAP_W, SNAP_H);
    const snapPixels = new Uint8Array(SNAP_W * SNAP_H * 4);
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = SNAP_W;
    snapCanvas.height = SNAP_H;
    const snapCtx = snapCanvas.getContext('2d');
    const snapImgData = snapCtx ? snapCtx.createImageData(SNAP_W, SNAP_H) : null;

    const povCamera = new THREE.PerspectiveCamera(65, POV_LIVE_W / POV_LIVE_H, 0.08, 65);
    camera.position.set(1.35, 10.2, 13.8);
    camera.lookAt(0, 0.3, 0);

    const renderOffscreenPov = (
      target: THREE.WebGLRenderTarget,
      pixels: Uint8Array,
      canvas: HTMLCanvasElement,
      ctx: CanvasRenderingContext2D | null,
      imgData: ImageData | null,
      w: number,
      h: number,
      quality: number
    ): string => {
      if (!ctx || !imgData) return '';
      const s = simRef.current;
      povCamera.aspect = w / h;
      povCamera.updateProjectionMatrix();
      const camX = s.x + Math.sin(s.headingRad) * 0.2;
      const camZ = s.z + Math.cos(s.headingRad) * 0.2;
      povCamera.position.set(camX, 0.48, camZ);
      povCamera.lookAt(
        s.x + Math.sin(s.headingRad) * 2.5,
        0.24,
        s.z + Math.cos(s.headingRad) * 2.5
      );
      povCamera.updateMatrixWorld();

      const prevTarget = renderer.getRenderTarget();
      renderer.setRenderTarget(target);
      renderer.render(scene, povCamera);
      renderer.readRenderTargetPixels(target, 0, 0, w, h, pixels);
      renderer.setRenderTarget(prevTarget);

      // Flip WebGL bottom-up rows into top-down 2D Canvas ImageData
      const dst = imgData.data;
      const rowStride = w * 4;
      for (let y = 0; y < h; y++) {
        const srcRow = (h - 1 - y) * rowStride;
        const dstRow = y * rowStride;
        dst.set(pixels.subarray(srcRow, srcRow + rowStride), dstRow);
      }
      ctx.putImageData(imgData, 0, 0);
      return canvas.toDataURL('image/jpeg', quality);
    };

    capturePovSnapshotRef.current = () =>
      renderOffscreenPov(
        snapTarget,
        snapPixels,
        snapCanvas,
        snapCtx,
        snapImgData,
        SNAP_W,
        SNAP_H,
        0.86
      );

    const raycaster = new THREE.Raycaster();
    const mouseNdc = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      pointerDownX = e.clientX;
      pointerDownY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging || cameraModeRef.current !== 'orbit') return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      orbitYaw -= dx * 0.007;
      orbitPitch = Math.max(0.22, Math.min(1.38, orbitPitch + dy * 0.006));
    };

    const onPointerUp = (e: PointerEvent) => {
      const moved = Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY);
      isDragging = false;

      if (moved < 6 && floorToolRef.current !== 'none') {
        const rect = renderer.domElement.getBoundingClientRect();
        mouseNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouseNdc, camera);
        const hitPoint = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
          const hx = Math.max(NAV_MIN_X + 0.2, Math.min(NAV_MAX_X - 0.2, hitPoint.x));
          const hz = Math.max(NAV_MIN_Z + 0.2, Math.min(NAV_MAX_Z - 0.2, hitPoint.z));
          const sim = simRef.current;

          if (floorToolRef.current === 'move_dog') {
            sim.dogX = hx;
            sim.dogZ = hz;
            sim.dogTargetX = hx;
            sim.dogTargetZ = hz;
            sim.dogWaitSec = 1.2;
          } else if (floorToolRef.current === 'drop_crate') {
            const id = `crate-${Date.now()}`;
            sim.customCrates.push({
              id,
              label: `Obstacle Crate #${sim.customCrates.length + 1}`,
              x: hx,
              z: hz,
              radius: 0.36,
            });
            sim.lastAStarAt = 0; // Force immediate A* replan around dropped crate
            setCrateCount(sim.customCrates.length);
          }
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (cameraModeRef.current !== 'orbit') return;
      orbitDist = Math.max(2.6, Math.min(23.0, orbitDist + e.deltaY * 0.006));
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    domEl.addEventListener('wheel', onWheel, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    let lastTime = performance.now();
    let lastUiSyncTime = 0;
    let lastPovLiveTime = 0;
    let lastCameraMode: CameraMode = cameraModeRef.current;
    let rafId = 0;

    const animate = (now: number) => {
      const dtSec = (now - lastTime) / 1000;
      lastTime = now;

      const sim = simRef.current;
      stepRobotPhysics(sim, dtSec);

      // Update WALL-E 3D mesh pose & wheel spin
      robotGroup.position.set(sim.x, 0, sim.z);
      robotGroup.rotation.y = sim.headingRad;
      leftWheelGroup.rotation.x = sim.leftWheelAngle;
      rightWheelGroup.rotation.x = sim.rightWheelAngle;

      // Expressive Pixar Head/Phone Pitch & Roll Tilt
      const avgPwm = (sim.leftPwm + sim.rightPwm) * 0.5;
      const turnDiff = sim.leftPwm - sim.rightPwm;
      const nodWave =
        sim.emotion === 'excited' || sim.emotion === 'happy'
          ? Math.sin(now * 0.01) * 0.04
          : 0;
      phoneMountGroup.rotation.x = -0.32 - avgPwm * 0.1 + nodWave;
      phoneMountGroup.rotation.z = isThinkingRef.current
        ? Math.sin(now * 0.008) * 0.08
        : -turnDiff * 0.07;

      // Update 3D HC-SR04 Ultrasonic Sensor Beam Cone scale & color
      const sonarLenM = Math.max(0.24, Math.min(1.55, sim.ultrasonicCm / 100));
      sonarConeMesh.scale.set(1, 1, sonarLenM);
      if (sim.ultrasonicCm < 40) {
        sonarConeMat.color.set('#fb7185');
        sonarConeMat.opacity = 0.28 + 0.1 * Math.sin(now * 0.02);
      } else if (sim.ultrasonicCm < 85) {
        sonarConeMat.color.set('#fbbf24');
        sonarConeMat.opacity = 0.2;
      } else {
        sonarConeMat.color.set('#34d399');
        sonarConeMat.opacity = 0.15;
      }

      // Update 3D Camera FOV Search Fan during real non-cheating room search!
      const isSearching = sim.activeMode === 'search_dog' || !sim.dogDiscovered;
      const recentlyFound =
        sim.justFoundDogAt > 0 && Date.now() - sim.justFoundDogAt < 2600;
      if (isSearching || recentlyFound) {
        fovFanMesh.visible = true;
        if (recentlyFound) {
          fovFanMat.color.set('#34d399');
          fovFanMat.opacity = 0.34;
        } else {
          fovFanMat.color.set(
            Math.floor(now / 650) % 2 === 0 ? '#22d3ee' : '#fbbf24'
          );
          fovFanMat.opacity = 0.2 + 0.06 * Math.sin(now * 0.008);
        }
      } else {
        fovFanMesh.visible = false;
      }

      // Update 3D Curved A* Trajectory Line & Target Lock Ring
      const waypoints = getActiveWaypointChain(sim);
      if (waypoints.length > 0) {
        const pts: THREE.Vector3[] = [new THREE.Vector3(sim.x, 0.028, sim.z)];
        for (const wp of waypoints) {
          pts.push(new THREE.Vector3(wp.x, 0.028, wp.z));
        }
        trajectoryLine.geometry.setFromPoints(pts);
        trajectoryMat.color.set(
          sim.detourPhase === 'reversing'
            ? '#fb7185'
            : sim.detourPhase === 'pivoting'
              ? '#fbbf24'
              : '#22d3ee'
        );
        trajectoryLine.visible = true;

        const goalWp = waypoints[waypoints.length - 1];
        targetLockRing.position.set(goalWp.x, 0.025, goalWp.z);
        const pulseScale = 1 + 0.12 * Math.sin(now * 0.008);
        targetLockRing.scale.set(pulseScale, pulseScale, 1);
        targetLockRing.visible = true;
      } else {
        trajectoryLine.visible = false;
        targetLockRing.visible = false;
      }

      // Update 3D Obstacle Avoidance Repulsion Vector Arrow
      if (sim.isAvoiding && Math.hypot(sim.repulsionX, sim.repulsionZ) > 0.05) {
        const repDir = new THREE.Vector3(sim.repulsionX, 0, sim.repulsionZ).normalize();
        repulsionArrow.position.set(sim.x, 0.18, sim.z);
        repulsionArrow.setDirection(repDir);
        repulsionArrow.setColor(sim.sonarReflexActive ? 0xfb7185 : 0xfbbf24);
        repulsionArrow.visible = true;
      } else {
        repulsionArrow.visible = false;
      }

      // Animate holographic dock ring & blinking Mini Server Rack telemetry LEDs
      holoFloatingRing.position.y = 0.55 + Math.sin(now * 0.003) * 0.12;
      holoFloatingRing.rotation.z = now * 0.002;
      for (let i = 0; i < serverLeds.length; i++) {
        const pulse = Math.sin(now * 0.006 + i * 1.35) > -0.15;
        serverLeds[i].color.set(
          pulse ? (i % 3 === 0 ? '#22d3ee' : i % 3 === 1 ? '#34d399' : '#fbbf24') : '#1e293b'
        );
      }

      // Sync emotion LED color
      const ledHex =
        sim.emotion === 'alert'
          ? '#fb7185'
          : sim.emotion === 'love'
            ? '#f472b6'
            : sim.emotion === 'excited'
              ? '#fbbf24'
              : sim.emotion === 'happy'
                ? '#34d399'
                : '#22d3ee';
      espLedMat.color.set(ledHex);
      robotGlowMat.color.set(ledHex);
      rearTallyLedMat.color.set(
        sim.isRecording && Math.floor(now / 300) % 2 === 0 ? '#fb7185' : '#22d3ee'
      );

      // Update 3D Smartphone Screen Eye CanvasTexture
      if (eyeCtx) {
        renderWalleEyes(eyeCtx, eyeCanvas.width, eyeCanvas.height, {
          emotion: sim.emotion,
          timeMs: now,
          gazeX: sim.gazeX,
          gazeY: sim.gazeY,
          isRecording: sim.isRecording,
          isThinking: isThinkingRef.current,
          batteryPct: sim.batteryPct,
        });
        eyeTexture.needsUpdate = true;
      }

      // Update bottom-right PiP Face Canvas whenever visible (pov, chase, or fullscreen!)
      const pipCanvas = pipFaceCanvasRef.current;
      if (
        pipCanvas &&
        (cameraModeRef.current === 'pov' ||
          cameraModeRef.current === 'chase' ||
          isExpandedRef.current)
      ) {
        const pipCtx = pipCanvas.getContext('2d');
        if (pipCtx) {
          renderWalleEyes(pipCtx, pipCanvas.width, pipCanvas.height, {
            emotion: sim.emotion,
            timeMs: now,
            gazeX: sim.gazeX,
            gazeY: sim.gazeY,
            isRecording: sim.isRecording,
            isThinking: isThinkingRef.current,
            batteryPct: sim.batteryPct,
          });
        }
      }

      // Update Dog mesh pose, leg trot, and tail wag
      dogGroup.position.set(sim.dogX, 0, sim.dogZ);
      dogGroup.rotation.y = sim.dogHeadingRad;
      const swing = Math.sin(sim.dogLegPhase) * 0.45;
      dogLegs[0].rotation.x = swing;
      dogLegs[1].rotation.x = -swing;
      dogLegs[2].rotation.x = -swing;
      dogLegs[3].rotation.x = swing;
      dogTail.rotation.z = Math.sin(now * 0.018) * 0.55;

      // Update Mochi (Ginger Tabby Cat) & Luna (Midnight-Violet Tuxedo Cat)
      mochiCat.group.position.set(sim.mochiX, 0, sim.mochiZ);
      mochiCat.group.rotation.y = sim.mochiHeadingRad;
      const mochiSwing = Math.sin(sim.mochiLegPhase) * 0.35;
      mochiCat.legs[0].rotation.x = mochiSwing;
      mochiCat.legs[1].rotation.x = -mochiSwing;
      mochiCat.legs[2].rotation.x = -mochiSwing;
      mochiCat.legs[3].rotation.x = mochiSwing;
      mochiCat.tail.rotation.z = Math.sin(now * 0.0065) * 0.42;

      lunaCat.group.position.set(sim.lunaX, 0, sim.lunaZ);
      lunaCat.group.rotation.y = sim.lunaHeadingRad;
      const lunaSwing = Math.sin(sim.lunaLegPhase) * 0.35;
      lunaCat.legs[0].rotation.x = lunaSwing;
      lunaCat.legs[1].rotation.x = -lunaSwing;
      lunaCat.legs[2].rotation.x = -lunaSwing;
      lunaCat.legs[3].rotation.x = lunaSwing;
      lunaCat.tail.rotation.z = Math.sin(now * 0.0075 + 1.4) * 0.45;

      // Update Rio (Colorful Tropical Bird) soaring above the loft
      rioGroup.position.set(sim.rioX, sim.rioY, sim.rioZ);
      rioGroup.rotation.y = sim.rioHeadingRad;
      const wingFlap = Math.sin(sim.rioWingPhase) * 0.72;
      rioLeftWing.rotation.z = wingFlap;
      rioRightWing.rotation.z = -wingFlap;
      rioFloorShadow.position.set(sim.rioX, 0.015, sim.rioZ);

      // Update Smart Mirror glowing LED border & live CanvasTexture HUD (~12 FPS)
      mirrorLedMat.color.set(
        sim.mirrorActive
          ? Math.floor(now / 450) % 2 === 0
            ? '#e879f9'
            : '#22d3ee'
          : '#22d3ee'
      );
      if (now - lastUiSyncTime >= 75) {
        drawSmartMirrorCanvas(sim, now);
      }

      // Update Ball mesh
      ballMesh.position.set(sim.ballX, 0.14, sim.ballZ);

      // Sync user-dropped obstacle crate meshes
      for (const crate of sim.customCrates) {
        if (!crateMeshes.has(crate.id)) {
          const m = new THREE.Mesh(crateGeo, crateMat);
          m.position.set(crate.x, 0.21, crate.z);
          m.castShadow = true;
          m.receiveShadow = true;
          cratesGroup.add(m);
          crateMeshes.set(crate.id, m);
        }
      }
      for (const [id, mesh] of crateMeshes.entries()) {
        if (!sim.customCrates.some((c) => c.id === id)) {
          cratesGroup.remove(mesh);
          crateMeshes.delete(id);
        }
      }

      // Update Camera Pose & FOV based on cameraMode
      const mode = cameraModeRef.current;
      const desiredFov = mode === 'pov' ? 65 : 48;
      if (camera.fov !== desiredFov) {
        camera.fov = desiredFov;
        camera.updateProjectionMatrix();
      }

      if (mode === 'orbit') {
        const targetX = sim.x * 0.22;
        const targetZ = sim.z * 0.22;
        const cx = targetX + Math.sin(orbitYaw) * Math.cos(orbitPitch) * orbitDist;
        const cy = Math.sin(orbitPitch) * orbitDist;
        const cz = targetZ + Math.cos(orbitYaw) * Math.cos(orbitPitch) * orbitDist;
        camera.position.lerp(new THREE.Vector3(cx, cy, cz), 0.14);
        camera.lookAt(targetX, 0.3, targetZ);
      } else if (mode === 'chase') {
        const backX = sim.x - Math.sin(sim.headingRad) * 1.7;
        const backZ = sim.z - Math.cos(sim.headingRad) * 1.7;
        camera.position.lerp(new THREE.Vector3(backX, 1.02, backZ), 0.16);
        const lookX = sim.x + Math.sin(sim.headingRad) * 1.25;
        const lookZ = sim.z + Math.cos(sim.headingRad) * 1.25;
        camera.lookAt(lookX, 0.26, lookZ);
      } else {
        // Android Phone Top Lens POV (height 0.48m, -6° pitch looking forward past chassis)
        const camX = sim.x + Math.sin(sim.headingRad) * 0.18;
        const camZ = sim.z + Math.cos(sim.headingRad) * 0.18;
        camera.position.set(camX, 0.48, camZ);
        const lookX = sim.x + Math.sin(sim.headingRad) * 2.38;
        const lookZ = sim.z + Math.cos(sim.headingRad) * 2.38;
        camera.lookAt(lookX, 0.24, lookZ);
      }

      camera.updateMatrixWorld();
      renderer.render(scene, camera);

      // Throttled ~10 FPS real WebGL Robot POV feed ONLY when TikTok Live overlay is open!
      if (
        activeAssistantAppRef.current === 'tiktok_live' &&
        now - lastPovLiveTime >= 100
      ) {
        lastPovLiveTime = now;
        const frameUrl = renderOffscreenPov(
          povLiveTarget,
          povLivePixels,
          povLiveCanvas,
          povLiveCtx,
          povLiveImgData,
          POV_LIVE_W,
          POV_LIVE_H,
          0.74
        );
        if (frameUrl) setPovFrameUrl(frameUrl);
      }

      const modeJustChanged = mode !== lastCameraMode;
      lastCameraMode = mode;

      if (modeJustChanged || now - lastUiSyncTime >= 75) {
        lastUiSyncTime = now;
        onSyncUiTickRef.current();

        if (mode === 'pov') {
          const canSeeDog = sim.dogDiscovered || isDogInCameraFov(sim);
          const candidates = [
            ...(canSeeDog
              ? [
                  {
                    id: 'dog',
                    label: '🐕 BISCUIT (DOG)',
                    confidence: 98,
                    pos: new THREE.Vector3(sim.dogX, 0.26, sim.dogZ),
                    size: 0.52,
                    color: '#fbbf24',
                  },
                ]
              : []),
            {
              id: 'mochi',
              label: '🐱 MOCHI (CAT)',
              confidence: 97,
              pos: new THREE.Vector3(sim.mochiX, 0.25, sim.mochiZ),
              size: 0.48,
              color: '#fb923c',
            },
            {
              id: 'luna',
              label: '🐱 LUNA (CAT)',
              confidence: 96,
              pos: new THREE.Vector3(sim.lunaX, 0.25, sim.lunaZ),
              size: 0.48,
              color: '#818cf8',
            },
            {
              id: 'rio',
              label: '🦜 RIO (BIRD)',
              confidence: 95,
              pos: new THREE.Vector3(sim.rioX, sim.rioY, sim.rioZ),
              size: 0.46,
              color: '#2dd4bf',
            },
            {
              id: 'smart_mirror',
              label: '🪞 SMART MIRROR',
              confidence: 99,
              pos: new THREE.Vector3(sim.mirrorX, 1.05, sim.mirrorZ),
              size: 1.0,
              color: '#e879f9',
            },
            {
              id: 'owner',
              label: '🧍 OWNER BEACON',
              confidence: 99,
              pos: new THREE.Vector3(sim.ownerX, 0.5, sim.ownerZ),
              size: 0.62,
              color: '#34d399',
            },
            {
              id: 'ball',
              label: '🔴 TOY BALL',
              confidence: 95,
              pos: new THREE.Vector3(sim.ballX, 0.14, sim.ballZ),
              size: 0.34,
              color: '#fb7185',
            },
            {
              id: 'dock',
              label: '⚡ CHARGING DOCK',
              confidence: 97,
              pos: new THREE.Vector3(sim.dockX, 0.22, sim.dockZ),
              size: 0.55,
              color: '#22d3ee',
            },
            {
              id: 'sofa',
              label: '🛋️ LIVING SOFA',
              confidence: 94,
              pos: new THREE.Vector3(-6.2, 0.36, -4.8),
              size: 0.9,
              color: '#a78bfa',
            },
            {
              id: 'tv',
              label: '📺 4K SMART TV',
              confidence: 97,
              pos: new THREE.Vector3(0.0, 1.0, -6.6),
              size: 0.95,
              color: '#38bdf8',
            },
            {
              id: 'kitchen',
              label: '☕ ESPRESSO BAR',
              confidence: 95,
              pos: new THREE.Vector3(6.4, 0.8, -4.6),
              size: 0.9,
              color: '#f59e0b',
            },
            {
              id: 'rack',
              label: '🖥️ SERVER RACK',
              confidence: 96,
              pos: new THREE.Vector3(9.2, 0.9, -0.4),
              size: 0.8,
              color: '#34d399',
            },
            {
              id: 'desk',
              label: '🛠️ ROBOTICS DESK',
              confidence: 96,
              pos: new THREE.Vector3(6.2, 0.62, 4.0),
              size: 0.88,
              color: '#22d3ee',
            },
          ];

          const camDir = new THREE.Vector3();
          camera.getWorldDirection(camDir);
          const nextBoxes: ProjectedBox[] = [];

          for (const item of candidates) {
            const toItem = item.pos.clone().sub(camera.position);
            const distM = toItem.length();
            if (distM < 0.25 || distM > 14.5) continue;
            const forwardDot = toItem.normalize().dot(camDir);
            if (forwardDot < 0.15) continue;

            const projected = item.pos.clone().project(camera);
            if (projected.z < -1 || projected.z > 1) continue;
            const screenX = (projected.x * 0.5 + 0.5) * 100;
            const screenY = (-projected.y * 0.5 + 0.5) * 100;
            if (screenX < 4 || screenX > 96 || screenY < 6 || screenY > 94) continue;

            const boxW = Math.max(15, Math.min(36, (item.size / distM) * 68));
            const boxH = Math.max(18, Math.min(44, (item.size / distM) * 82));

            nextBoxes.push({
              id: item.id,
              label: item.label,
              confidence: item.confidence,
              distanceM: Number(distM.toFixed(1)),
              leftPct: Math.max(3, Math.min(97 - boxW, screenX - boxW / 2)),
              topPct: Math.max(9, Math.min(88 - boxH, screenY - boxH / 2)),
              widthPct: boxW,
              heightPct: boxH,
              color: item.color,
            });
          }
          setPovDetections(nextBoxes);
        }
      }

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      capturePovSnapshotRef.current = null;
      resizeObserver.disconnect();
      domEl.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      domEl.removeEventListener('wheel', onWheel);
      povLiveTarget.dispose();
      snapTarget.dispose();
      renderer.dispose();
    };
  }, [capturePovSnapshotRef, simRef]);

  const handleClearCrates = () => {
    simRef.current.customCrates = [];
    setCrateCount(0);
    if (floorTool === 'drop_crate') {
      onFloorToolChange('none');
    }
  };

  const sim = simRef.current;
  const showTikTokOverlay = activeAssistantApp === 'tiktok_live';
  const showPipFace =
    !showTikTokOverlay && (cameraMode === 'pov' || cameraMode === 'chase' || isExpanded);
  const displayDecodeMs =
    decodeMs > 0 ? Math.round(decodeMs) : elapsedMs > 0 ? Math.min(340, Math.round(elapsedMs * 0.25)) : 0;
  const isActivelySearching = sim.activeMode === 'search_dog' && !sim.dogDiscovered;
  const showFoundBanner =
    sim.dogDiscovered && sim.justFoundDogAt > 0 && Date.now() - sim.justFoundDogAt < 5500;

  return (
    <div
      className={
        isExpanded
          ? 'fixed inset-0 z-50 bg-[#050811] flex flex-col overflow-hidden'
          : 'panel-surface relative flex-1 min-h-0 rounded-xl overflow-hidden flex flex-col'
      }
      data-arena-expanded={isExpanded ? 'true' : 'false'}
    >
      {/* 3D WebGL Canvas Mount */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden">
        <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

        {/* UNIFIED ZERO-OVERLAP TOP BAR: Left Camera/Tool Pills | Center Fullscreen HUD | Right Sonar/Avoidance/Expand */}
        <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex flex-wrap items-center justify-between gap-2">
          {/* Left Group: 3 Camera Modes + Floor Tools */}
          <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
            <div className="inline-flex items-center rounded-lg border border-slate-400/20 bg-[#070b14]/90 p-0.5 backdrop-blur-md shadow-lg">
              {(
                [
                  { id: 'orbit', label: 'Orbit Cam', icon: Compass },
                  { id: 'chase', label: 'Chase Cam', icon: Navigation },
                  { id: 'pov', label: 'Phone POV', icon: Camera },
                ] as const
              ).map(({ id, label, icon: Icon }) => {
                const active = cameraMode === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onCameraModeChange(id)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                      active
                        ? id === 'pov'
                          ? 'bg-amber-500/25 text-amber-200 border border-amber-400/45 shadow-sm'
                          : 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            <div className="inline-flex items-center rounded-lg border border-slate-400/20 bg-[#070b14]/90 p-0.5 backdrop-blur-md shadow-lg">
              <button
                type="button"
                onClick={onTriggerMirrorChat}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-all ${
                  sim.mirrorActive || sim.activeMode === 'mirror_chat'
                    ? 'bg-fuchsia-500/25 text-fuchsia-200 border border-fuchsia-400/50 shadow-sm'
                    : 'text-fuchsia-200 hover:bg-fuchsia-500/20 border border-transparent hover:border-fuchsia-400/40'
                }`}
                title="Drive WALL-E up to the 3D Smart Mirror to read live viewer comments and reply out loud (zero API credits)"
                data-mirror-quick-btn="true"
              >
                <Sparkles className="h-3.5 w-3.5 text-fuchsia-400" />
                <span>🪞 Mirror</span>
              </button>
              <button
                type="button"
                onClick={onHideDog}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/20 transition-all border border-transparent hover:border-amber-400/40"
                title="Hide Biscuit behind furniture out of WALL-E's camera FOV to test real non-cheating room search"
              >
                <EyeOff className="h-3.5 w-3.5 text-amber-400" />
                <span>Hide Dog</span>
              </button>
              <button
                type="button"
                onClick={() => onFloorToolChange(floorTool === 'move_dog' ? 'none' : 'move_dog')}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-all ${
                  floorTool === 'move_dog'
                    ? 'bg-amber-500/25 text-amber-200 border border-amber-400/40'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
                title="Click anywhere on the 3D floor to move Biscuit the Dog"
              >
                <Dog className="h-3.5 w-3.5 text-amber-400" />
                <span>Move Dog</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onFloorToolChange(floorTool === 'drop_crate' ? 'none' : 'drop_crate')
                }
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-all ${
                  floorTool === 'drop_crate'
                    ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/40'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
                title="Click anywhere on the 3D floor to drop an obstacle crate in WALL-E's path"
              >
                <Box className="h-3.5 w-3.5 text-cyan-400" />
                <span>Drop Crate</span>
              </button>
              {crateCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearCrates}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/15"
                  title="Clear dropped obstacle crates"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>({crateCount})</span>
                </button>
              )}
            </div>
          </div>

          {/* Center Group: Fullscreen Cerebras Telemetry HUD (Sub-Second Decode + Triad tok/s!) */}
          {isExpanded && (
            <div
              className="pointer-events-auto flex items-center gap-2 rounded-full border border-cyan-400/40 bg-[#070b14]/92 px-3.5 py-1 font-mono text-xs font-bold text-slate-100 backdrop-blur-md shadow-glow-cyan"
              data-fullscreen-hud="true"
            >
              <span className="inline-flex items-center gap-1 text-cyan-300 tabular-nums">
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                {tokensPerSec > 0
                  ? `${Math.round(tokensPerSec).toLocaleString()} tok/s`
                  : '3-AGENT TRIAD READY'}
              </span>
              {displayDecodeMs > 0 && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="text-emerald-300 tabular-nums">
                    {displayDecodeMs}ms decode
                  </span>
                </>
              )}
              {speedupFactor > 1 && (
                <>
                  <span className="text-slate-600 hidden sm:inline">·</span>
                  <span className="text-amber-300 hidden sm:inline tabular-nums">
                    {Math.round(speedupFactor)}× vs 40 t/s
                  </span>
                </>
              )}
            </div>
          )}

          {/* Right Group: Avoidance Reflex Badge + REC Badge + HC-SR04 Sonar + Expand/Exit Fullscreen */}
          <div className="pointer-events-auto flex items-center gap-1.5">
            {sim.isAvoiding && (
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold animate-pulse ${
                  sim.detourPhase === 'reversing'
                    ? 'border-rose-400/60 bg-rose-500/25 text-rose-100'
                    : 'border-amber-400/50 bg-amber-500/20 text-amber-200'
                }`}
                data-avoidance-badge={sim.detourPhase}
              >
                <AlertTriangle
                  className={`h-3 w-3 ${
                    sim.detourPhase === 'reversing' ? 'text-rose-300' : 'text-amber-400'
                  }`}
                />
                {sim.detourPhase === 'reversing'
                  ? '⏪ REVERSING TO DETOUR'
                  : sim.detourPhase === 'pivoting'
                    ? '🔄 A* DETOUR PIVOT'
                    : sim.avoidingLabel || 'A* OBSTACLE DETOUR'}
              </span>
            )}

            {sim.isRecording && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/50 bg-rose-500/20 px-2.5 py-1 font-mono text-[10.5px] font-bold text-rose-200 animate-pulse">
                <Video className="h-3 w-3 text-rose-400" />
                REC 1080p
              </span>
            )}

            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-400/20 bg-[#070b14]/90 px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-200 backdrop-blur-md tabular-nums">
              <Radio className="h-3 w-3 text-cyan-400" />
              HC-SR04:{' '}
              <strong
                className={
                  sim.ultrasonicCm < 40
                    ? 'text-rose-300'
                    : sim.ultrasonicCm < 85
                      ? 'text-amber-300'
                      : 'text-emerald-300'
                }
              >
                {sim.ultrasonicCm} cm
              </strong>
            </span>

            <button
              type="button"
              onClick={onToggleExpanded}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold backdrop-blur-md transition-all ${
                isExpanded
                  ? 'border-cyan-400/50 bg-cyan-500/25 text-cyan-100 shadow-glow-cyan'
                  : 'border-slate-400/25 bg-[#070b14]/90 text-slate-200 hover:border-cyan-400/50 hover:text-white'
              }`}
              aria-label={isExpanded ? 'Exit fullscreen arena' : 'Expand 3D arena to fullscreen'}
            >
              {isExpanded ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5 text-cyan-300" />
                  <span>Exit Fullscreen</span>
                  <kbd className="hidden sm:inline rounded bg-slate-950/90 border border-cyan-400/30 px-1 py-0.2 font-mono text-[9px] text-cyan-300">
                    Esc
                  </kbd>
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5 text-cyan-300" />
                  <span>Expand</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ANDROID PHONE POV VISION HUD OVERLAY (active when cameraMode === 'pov') */}
        {cameraMode === 'pov' && (
          <div
            className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
            data-phone-pov-hud="true"
          >
            {/* Corner Viewfinder Frame */}
            <div className="absolute inset-x-4 top-14 bottom-16 border border-cyan-400/25 rounded-xl">
              <div className="absolute left-3 top-2 flex items-center gap-2 rounded-md bg-[#050812]/80 px-2.5 py-1 font-mono text-[10.5px] font-bold text-cyan-300 border border-cyan-400/30">
                <Eye className="h-3.5 w-3.5 text-amber-400" />
                ANDROID FRONT LENS POV · ON-DEVICE VISION + OPENCLAW TRIAD
              </div>
            </div>

            {/* Simulated Cyberpunk AI Vision Target Bounding Boxes */}
            {povDetections.map((det) => (
              <div
                key={det.id}
                className="absolute rounded-lg border-2 transition-all duration-75"
                style={{
                  left: `${det.leftPct}%`,
                  top: `${det.topPct}%`,
                  width: `${det.widthPct}%`,
                  height: `${det.heightPct}%`,
                  borderColor: det.color,
                  boxShadow: `0 0 18px -2px ${det.color}99, inset 0 0 12px -4px ${det.color}66`,
                }}
              >
                <div
                  className="inline-flex items-center gap-1 rounded-br-md px-2 py-0.5 font-mono text-[10px] font-bold text-slate-950 whitespace-nowrap shadow-md"
                  style={{ backgroundColor: det.color }}
                >
                  <span>{det.label}</span>
                  <span>· {det.confidence}%</span>
                  <span>· {det.distanceM}m</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* FLOATING SMART MIRROR LIVE COMMENTS & REPLY CARD */}
        {(sim.mirrorActive || sim.activeMode === 'mirror_chat') && (
          <div
            className="pointer-events-auto absolute left-3 top-[94px] z-20 w-[290px] sm:w-[320px] rounded-xl border border-fuchsia-400/50 bg-[#080b18]/92 p-2.5 backdrop-blur-md shadow-[0_14px_38px_-8px_rgba(232,121,249,0.45)] space-y-1.5"
            data-mirror-chat-card="true"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-fuchsia-300">
                <MessageSquare className="h-3.5 w-3.5 text-cyan-300" />
                🪞 Smart Mirror · {sim.mirrorActive ? 'Live Chat' : 'Driving via A*'}
              </span>
              <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase text-emerald-200">
                {sim.emotion}
              </span>
            </div>

            {sim.mirrorActive && sim.mirrorComment ? (
              <>
                <div className="rounded-lg border border-white/10 bg-black/55 px-2 py-1.5 text-[10.5px] leading-snug text-slate-100">
                  <span className="font-bold text-fuchsia-300 mr-1">
                    {sim.mirrorComment.user}:
                  </span>
                  <span>{sim.mirrorComment.text}</span>
                </div>
                <div className="rounded-lg border border-cyan-400/30 bg-cyan-950/55 px-2 py-1.5 text-[10.5px] leading-snug text-cyan-100">
                  <span className="font-bold text-amber-300 mr-1">🎙️ WALL-E:</span>
                  <span>{sim.mirrorComment.reply}</span>
                </div>
                <div className="flex items-center justify-between pt-0.5">
                  <span className="font-mono text-[8.5px] text-slate-400">
                    Reflection camera locked · Speaking live
                  </span>
                  <button
                    type="button"
                    onClick={onNextMirrorComment}
                    className="rounded-md border border-fuchsia-400/45 bg-fuchsia-500/20 px-2 py-0.5 font-mono text-[9.5px] font-bold text-fuchsia-200 hover:bg-fuchsia-500/35 transition-colors"
                  >
                    Next Comment →
                  </button>
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-cyan-400/25 bg-cyan-950/40 px-2 py-1.5 text-[10px] text-cyan-200">
                Weaving through the 22m loft to stand in front of the West-Wall Smart Mirror...
              </div>
            )}
          </div>
        )}

        {/* LIVE REAL-FOV ROOM SEARCH / DISCOVERY STATUS BANNER */}
        {(isActivelySearching || showFoundBanner || !sim.dogDiscovered) && (
          <div
            className={`pointer-events-none absolute left-1/2 top-[88px] z-20 -translate-x-1/2 inline-flex items-center gap-2 rounded-full border px-3.5 py-1 font-mono text-[11px] font-bold backdrop-blur-md shadow-xl whitespace-nowrap ${
              showFoundBanner
                ? 'border-emerald-400/60 bg-emerald-500/25 text-emerald-100 shadow-glow-emerald'
                : 'border-cyan-400/55 bg-[#070d1a]/92 text-cyan-200 animate-pulse'
            }`}
            data-search-status={showFoundBanner ? 'found' : 'searching'}
          >
            {showFoundBanner ? (
              <>
                <Target className="h-3.5 w-3.5 text-emerald-300" />
                <span>🎯 BISCUIT FOUND! TARGET LOCKED</span>
              </>
            ) : (
              <>
                <Search className="h-3.5 w-3.5 text-amber-300" />
                <span>
                  {sim.searchStatusText ||
                    `🔍 SEARCHING ROOM · Zone ${(sim.searchZoneIndex % sim.searchTotalZones) + 1}/${sim.searchTotalZones} · Biscuit Not In Sight`}
                </span>
              </>
            )}
          </div>
        )}

        {/* ULTRA-REALISTIC 9:16 TIKTOK LIVE STUDIO OVERLAY WITH REAL ROBOT POV + LIVE SCREEN SHARE */}
        {showTikTokOverlay && (
          <TikTokLiveOverlay
            topic={tiktokTopic}
            tokensPerSec={tokensPerSec}
            decodeMs={decodeMs}
            speedupFactor={speedupFactor}
            triad={triad}
            history={history}
            obsidianLogs={obsidianLogs}
            speech={speech}
            povFrameUrl={povFrameUrl}
            dogInView={sim.dogDiscovered && isDogInCameraFov(sim)}
            screenMode={tiktokScreenMode}
            onChangeScreenMode={onChangeTikTokScreenMode}
            onClose={onCloseTikTok}
            onSendGiftLog={(msg) => onLogObsidian('tiktok-gift', msg)}
          />
        )}

        {/* ALWAYS-ON PiP ANIMATED PHONE FACE in POV, Chase Cam, and Fullscreen Cinema Mode! */}
        {showPipFace && (
          <div
            className="pointer-events-none absolute bottom-16 right-4 z-20 w-40 rounded-xl border border-cyan-400/45 bg-[#050812]/95 p-1.5 shadow-2xl"
            data-pip-face="true"
          >
            <div className="mb-1 flex items-center justify-between font-mono text-[8.5px] font-bold text-cyan-300 px-1">
              <span>PHONE SCREEN</span>
              <span className="uppercase text-amber-300">
                {isThinking ? 'SCANNING' : sim.emotion}
              </span>
            </div>
            <canvas
              ref={pipFaceCanvasRef}
              width={220}
              height={128}
              className="w-full rounded-lg border border-slate-800"
            />
          </div>
        )}

        {/* Floor Tool Hint Pill */}
        {floorTool !== 'none' && (
          <div className="pointer-events-none absolute left-1/2 top-[88px] z-20 -translate-x-1/2 rounded-full border border-amber-400/45 bg-[#070b14]/92 px-3.5 py-1 font-mono text-[11px] font-semibold text-amber-200 shadow-lg whitespace-nowrap">
            {floorTool === 'move_dog'
              ? 'Click anywhere on the 3D floor to teleport Biscuit the Dog'
              : 'Click anywhere on the 3D floor to drop a physical obstacle crate'}
          </div>
        )}

        {/* BOTTOM OVERLAY: Active WALL-E Speech Bubble + Step Queue Ribbon */}
        <div className="pointer-events-auto absolute inset-x-3 bottom-2.5 z-20 flex flex-col gap-1.5">
          {isExpanded && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {missions.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={isThinking}
                  onClick={() => onTriggerMission(m)}
                  className="shrink-0 rounded-full border border-slate-400/25 bg-[#070b14]/90 px-3 py-1 text-xs font-semibold text-slate-100 backdrop-blur-md transition-all hover:border-amber-400/55 hover:bg-slate-800/90 disabled:opacity-50"
                >
                  {m.title}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-400/20 bg-[#070b14]/90 px-3 py-1.5 backdrop-blur-md shadow-xl">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="shrink-0 rounded-md border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-amber-300">
                WALL-E · {isThinking ? 'SCANNING' : sim.emotion}
              </span>
              <p className="text-xs font-medium text-slate-100 truncate">{speech}</p>
            </div>

            {activePlan && activePlan.steps.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto shrink-0">
                {activePlan.steps.map((step, idx) => {
                  const isCurrent = activeStep !== null && idx === activeStepIndex;
                  const isDone = activeStep === null || idx < activeStepIndex;
                  return (
                    <span
                      key={`${step.action}-${idx}`}
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold whitespace-nowrap ${
                        isCurrent
                          ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-200 animate-pulse'
                          : isDone
                            ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300/80'
                            : 'border-slate-700 bg-slate-900/70 text-slate-400'
                      }`}
                    >
                      <span>{idx + 1}.</span>
                      <span>{step.label || step.action}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
