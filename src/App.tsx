import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  Square,
  Paperclip,
  Mic,
  MicOff,
  Minimize2,
  X,
  RotateCcw,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Cpu,
  Globe,
  ShieldCheck,
  Eye,
  Terminal,
  Activity,
  Zap,
  Settings,
  Pin,
  RefreshCw,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import * as THREE from 'three';
import logoImg from '../assets/kauvery-logo.png';
import CaptchaDashboard from './CaptchaDashboard';
import ScrapingConsole from './ScrapingConsole';
import AutonomousBrowserStudio from './AutonomousBrowserStudio';

declare global {
  interface Window {
    kauveryDesktop?: {
      resizeWindow: (width: number, height: number) => void;
      collapseWindow: () => void;
      expandWindow: (width?: number, height?: number) => void;
      minimize: () => void;
      close: () => void;
      toggleAlwaysOnTop: (always: boolean) => void;
      dragWindow: (movementX: number, movementY: number) => void;
      saveExportedFile: (data: { filename: string; content: string; type: string }) => Promise<{ success: boolean; filePath?: string; filename?: string; error?: string }>;
      openExternal: (url: string) => void;
      onShortcutTriggered: (callback: () => void) => void;
      isElectron?: boolean;
    };
  }
}

type RobotState = 'idle' | 'listening' | 'thinking' | 'working' | 'collaborating' | 'completed' | 'error';

interface AgentStatus {
  id: string;
  name: string;
  role: string;
  state: 'idle' | 'active' | 'processing' | 'done' | 'error';
  color: string;
  activity: string;
  progress: number;
}

interface TaskStep {
  id: number;
  label: string;
  agent: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  time?: string;
  detail: string;
}

interface TaskExecution {
  id: string;
  title: string;
  status: 'planning' | 'running' | 'completed' | 'failed';
  activeAgentId: string;
  currentOperation: string;
  progress: number;
  steps: TaskStep[];
  logs: string[];
  startTime: number;
  completedTime?: number;
  result?: {
    recordsCount: number;
    duration: string;
    files: Array<{ name: string; type: string; size: string; content?: string; url?: string }>;
    sources: Array<{ name: string; url: string }>;
    summary: string;
  };
}

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  task?: TaskExecution;
}

// =============================================================
// ULTRA-PREMIUM 3D KAUVERY ROBOT COMPONENT (Three.js WebGL Engine)
// Wide View Range (Zero Wing Clipping), Fluttering Petals,
// Luminous Eyes & Antigravity Halo
// =============================================================
const KauveryRobotCanvas: React.FC<{
  robotState: RobotState;
  isExpanded: boolean;
  size?: number;
}> = ({ robotState, isExpanded, size = 230 }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<RobotState>(robotState);
  stateRef.current = robotState;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const width = container.clientWidth || size;
    const height = container.clientHeight || size;

    const scene = new THREE.Scene();
    // Wide FOV 42 & distance 5.85: Guarantees generous 25%+ margin on all sides during flying animation!
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, -0.15, 5.85);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    container.appendChild(renderer.domElement);

    // --- BRIGHT BALANCED STUDIO LIGHTING ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.3);
    scene.add(ambientLight);

    const frontLight = new THREE.DirectionalLight(0xffffff, 3.2);
    frontLight.position.set(2, 3, 4);
    scene.add(frontLight);

    const fillLight = new THREE.PointLight(0xffb81c, 4.5, 12);
    fillLight.position.set(-3.5, 1, 3);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0xd80064, 5.0, 10);
    rimLight.position.set(3, 2, -2);
    scene.add(rimLight);

    const topBackLight = new THREE.PointLight(0xe6007a, 4.0, 8);
    topBackLight.position.set(0, 4, -2);
    scene.add(topBackLight);

    const underLight = new THREE.PointLight(0xf85a28, 4.5, 7);
    underLight.position.set(0, -2.5, 1);
    scene.add(underLight);

    // Robot Root Group
    const robotRoot = new THREE.Group();
    scene.add(robotRoot);

    // 1. Chassis Body: Pearl White Ceramic
    const bodyGeometry = new THREE.SphereGeometry(1.0, 64, 64);
    bodyGeometry.scale(0.96, 1.08, 0.92);
    const chassisMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xfdfdfd,
      emissive: 0x2a0c24,
      emissiveIntensity: 0.12,
      roughness: 0.1,
      metalness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      reflectivity: 0.98,
    });
    const chassisMesh = new THREE.Mesh(bodyGeometry, chassisMaterial);
    robotRoot.add(chassisMesh);

    // 2. Collar & Chest Emblem Trims
    const collarGeo = new THREE.TorusGeometry(0.85, 0.035, 16, 64);
    const collarMat = new THREE.MeshPhysicalMaterial({
      color: 0xd80064,
      emissive: 0xd80064,
      emissiveIntensity: 0.6,
      metalness: 0.8,
      roughness: 0.2,
    });
    const collarMesh = new THREE.Mesh(collarGeo, collarMat);
    collarMesh.rotation.x = Math.PI / 2.2;
    collarMesh.position.set(0, -0.25, 0.2);
    robotRoot.add(collarMesh);

    const chestCoreGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.05, 32);
    const chestCoreMat = new THREE.MeshBasicMaterial({ color: 0xffb81c });
    const chestCore = new THREE.Mesh(chestCoreGeo, chestCoreMat);
    chestCore.rotation.x = Math.PI / 2;
    chestCore.position.set(0, -0.42, 0.88);
    robotRoot.add(chestCore);

    const chestRingGeo = new THREE.TorusGeometry(0.24, 0.025, 16, 32);
    const chestRingMat = new THREE.MeshBasicMaterial({ color: 0xd80064 });
    const chestRing = new THREE.Mesh(chestRingGeo, chestRingMat);
    chestRing.position.set(0, -0.42, 0.89);
    robotRoot.add(chestRing);

    // 3. Side Antenna Pods
    const createEarPod = (xPos: number) => {
      const earGroup = new THREE.Group();
      const podGeo = new THREE.CylinderGeometry(0.12, 0.18, 0.16, 24);
      const podMat = new THREE.MeshPhysicalMaterial({
        color: 0xd80064,
        emissive: 0x6b0f48,
        emissiveIntensity: 0.4,
        metalness: 0.8,
        roughness: 0.2,
      });
      const pod = new THREE.Mesh(podGeo, podMat);
      pod.rotation.z = Math.PI / 2;
      earGroup.add(pod);

      const tipGeo = new THREE.SphereGeometry(0.08, 16, 16);
      const tipMat = new THREE.MeshBasicMaterial({ color: 0xffb81c });
      const tip = new THREE.Mesh(tipGeo, tipMat);
      tip.position.x = xPos > 0 ? 0.14 : -0.14;
      earGroup.add(tip);

      earGroup.position.set(xPos, 0.25, 0.05);
      return earGroup;
    };
    robotRoot.add(createEarPod(0.96));
    robotRoot.add(createEarPod(-0.96));

    // 4. Visor Bezel & Glass
    const visorBezelGeo = new THREE.SphereGeometry(0.74, 48, 48);
    visorBezelGeo.scale(1.02, 0.68, 0.65);
    const visorBezelMat = new THREE.MeshPhysicalMaterial({
      color: 0x2d0526,
      emissive: 0xd80064,
      emissiveIntensity: 0.3,
      roughness: 0.15,
      metalness: 0.9,
    });
    const visorBezel = new THREE.Mesh(visorBezelGeo, visorBezelMat);
    visorBezel.position.set(0, 0.22, 0.48);
    robotRoot.add(visorBezel);

    const visorGeometry = new THREE.SphereGeometry(0.72, 48, 48);
    visorGeometry.scale(1.0, 0.66, 0.66);
    const visorMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x140416,
      roughness: 0.05,
      metalness: 0.95,
      transmission: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });
    const visorMesh = new THREE.Mesh(visorGeometry, visorMaterial);
    visorMesh.position.set(0, 0.22, 0.52);
    robotRoot.add(visorMesh);

    // 5. Dynamic Eyes Canvas
    const eyeCanvas = document.createElement('canvas');
    eyeCanvas.width = 512;
    eyeCanvas.height = 256;
    const eyeCtx = eyeCanvas.getContext('2d')!;
    const eyeTexture = new THREE.CanvasTexture(eyeCanvas);

    const eyeScreenGeo = new THREE.PlaneGeometry(0.95, 0.48);
    const eyeScreenMat = new THREE.MeshBasicMaterial({
      map: eyeTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const eyeScreen = new THREE.Mesh(eyeScreenGeo, eyeScreenMat);
    eyeScreen.position.set(0, 0.23, 1.02);
    eyeScreen.renderOrder = 10;
    robotRoot.add(eyeScreen);

    // 6. KAUVERY BUTTERFLY WINGS (Tuned size & range so they NEVER cut off!)
    const wingGroup = new THREE.Group();
    robotRoot.add(wingGroup);

    const createPetalMesh = (colorHex: number, emissiveHex: number, scaleX: number, scaleY: number) => {
      const petalShape = new THREE.Shape();
      petalShape.moveTo(0, 0);
      petalShape.bezierCurveTo(0.4, 0.4, 0.9, 0.8, 0.8, 1.4);
      petalShape.bezierCurveTo(0.7, 1.8, 0.2, 1.9, -0.2, 1.6);
      petalShape.bezierCurveTo(-0.6, 1.2, -0.4, 0.5, 0, 0);

      const petalGeo = new THREE.ShapeGeometry(petalShape, 32);
      const petalMat = new THREE.MeshPhysicalMaterial({
        color: colorHex,
        emissive: emissiveHex,
        emissiveIntensity: 0.85,
        transmission: 0.8,
        opacity: 0.92,
        transparent: true,
        roughness: 0.12,
        metalness: 0.05,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(petalGeo, petalMat);
      mesh.scale.set(scaleX, scaleY, 1);
      return mesh;
    };

    // Upper Wings: Scale increased to 0.92 for magnificent, grand Kauvery butterfly petals
    const leftUpperWing = createPetalMesh(0xd80064, 0xe6007a, 0.92, 0.92);
    leftUpperWing.position.set(-0.35, 0.32, -0.35);
    leftUpperWing.rotation.set(0.2, -0.38, 0.85);
    wingGroup.add(leftUpperWing);

    const rightUpperWing = createPetalMesh(0xd80064, 0xe6007a, 0.92, 0.92);
    rightUpperWing.position.set(0.35, 0.32, -0.35);
    rightUpperWing.rotation.set(0.2, 0.38, -0.85);
    wingGroup.add(rightUpperWing);

    // Lower Wings: Scale increased to 0.68
    const leftLowerWing = createPetalMesh(0xffb81c, 0xf85a28, 0.68, 0.68);
    leftLowerWing.position.set(-0.30, -0.14, -0.3);
    leftLowerWing.rotation.set(-0.1, -0.28, 1.55);
    wingGroup.add(leftLowerWing);

    const rightLowerWing = createPetalMesh(0xffb81c, 0xf85a28, 0.68, 0.68);
    rightLowerWing.position.set(0.30, -0.14, -0.3);
    rightLowerWing.rotation.set(-0.1, 0.28, -1.55);
    wingGroup.add(rightLowerWing);

    // 7. Antigravity Propulsion Rings
    const ringGeo = new THREE.TorusGeometry(0.72, 0.045, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffb81c });
    const thrustRing = new THREE.Mesh(ringGeo, ringMat);
    thrustRing.rotation.x = Math.PI / 2;
    thrustRing.position.y = -1.15;
    robotRoot.add(thrustRing);

    const innerRingGeo = new THREE.TorusGeometry(0.48, 0.035, 16, 48);
    const innerRingMat = new THREE.MeshBasicMaterial({ color: 0xd80064 });
    const innerThrustRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerThrustRing.rotation.x = Math.PI / 2;
    innerThrustRing.position.y = -1.25;
    robotRoot.add(innerThrustRing);

    // 8. Glowing Stardust
    const particleCount = 28;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 2.8;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 2.8 - 0.5;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 2.0;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xffb81c,
      size: 0.075,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    robotRoot.add(particles);

    let clock = new THREE.Clock();
    let blinkTimer = 0;
    let isBlinking = false;
    let mousePos = { x: 0, y: 0 };
    let targetRotation = { x: 0, y: 0 };

    const drawEyes = (time: number, state: RobotState) => {
      eyeCtx.clearRect(0, 0, 512, 256);

      const eyeColor =
        state === 'completed'
          ? '#FFB81C'
          : state === 'error'
          ? '#F85A28'
          : state === 'working' || state === 'thinking'
          ? '#FF8400'
          : state === 'listening'
          ? '#FF1493'
          : '#00F5FF';

      eyeCtx.shadowColor = eyeColor;
      eyeCtx.shadowBlur = 24;
      eyeCtx.fillStyle = eyeColor;
      eyeCtx.strokeStyle = eyeColor;
      eyeCtx.lineWidth = 10;

      const eyeWidth = isBlinking ? 56 : 52;
      const eyeHeight = isBlinking ? 6 : 74;
      const leftX = 170 + mousePos.x * 24;
      const rightX = 342 + mousePos.x * 24;
      const centerY = 128 + mousePos.y * 16;

      if (state === 'completed') {
        eyeCtx.beginPath();
        eyeCtx.arc(leftX, centerY + 14, 34, Math.PI, 0, false);
        eyeCtx.stroke();
        eyeCtx.beginPath();
        eyeCtx.arc(rightX, centerY + 14, 34, Math.PI, 0, false);
        eyeCtx.stroke();
      } else if (state === 'thinking') {
        const angle = time * 6.5;
        [leftX, rightX].forEach((x) => {
          eyeCtx.save();
          eyeCtx.translate(x, centerY);
          eyeCtx.rotate(angle);
          eyeCtx.beginPath();
          eyeCtx.arc(0, 0, 32, 0, Math.PI * 1.5);
          eyeCtx.stroke();
          eyeCtx.beginPath();
          eyeCtx.arc(0, 0, 10, 0, Math.PI * 2);
          eyeCtx.fill();
          eyeCtx.restore();
        });
      } else if (state === 'listening') {
        [leftX, rightX].forEach((x) => {
          for (let b = -2; b <= 2; b++) {
            const h = Math.abs(Math.sin(time * 10 + b * 0.8)) * 52 + 18;
            eyeCtx.beginPath();
            eyeCtx.roundRect(x + b * 14 - 4, centerY - h / 2, 8, h, 4);
            eyeCtx.fill();
          }
        });
      } else if (state === 'working') {
        [leftX, rightX].forEach((x) => {
          eyeCtx.save();
          eyeCtx.translate(x, centerY);
          eyeCtx.rotate(Math.PI / 4);
          eyeCtx.beginPath();
          eyeCtx.roundRect(-24, -24, 48, 48, 10);
          eyeCtx.fill();
          eyeCtx.restore();
        });
      } else {
        [leftX, rightX].forEach((x) => {
          eyeCtx.beginPath();
          eyeCtx.roundRect(x - eyeWidth / 2, centerY - eyeHeight / 2, eyeWidth, eyeHeight, isBlinking ? 4 : 26);
          eyeCtx.fill();

          if (!isBlinking) {
            eyeCtx.fillStyle = '#FFFFFF';
            eyeCtx.beginPath();
            eyeCtx.arc(x - 10, centerY - 14, 8, 0, Math.PI * 2);
            eyeCtx.fill();
            eyeCtx.fillStyle = eyeColor;
          }
        });
      }

      eyeTexture.needsUpdate = true;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const margin = 20; // Active interactive hover range
      const isInside =
        e.clientX >= rect.left - margin &&
        e.clientX <= rect.right + margin &&
        e.clientY >= rect.top - margin &&
        e.clientY <= rect.bottom + margin;

      if (isInside) {
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
        mousePos = { x: THREE.MathUtils.clamp(x, -1, 1), y: THREE.MathUtils.clamp(y, -1, 1) };
        targetRotation.y = mousePos.x * 0.44;
        targetRotation.x = -mousePos.y * 0.32;
      } else {
        // Once cursor leaves the robot range, smoothly look straight ahead (normal face pose)
        targetRotation.x = 0;
        targetRotation.y = 0;
        mousePos = { x: 0, y: 0 };
      }
    };

    const handleMouseLeave = () => {
      // Instantly direct head & eye targets back to normal straight-facing pose
      targetRotation.x = 0;
      targetRotation.y = 0;
      mousePos = { x: 0, y: 0 };
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseleave', handleMouseLeave);

    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();
      const currentState = stateRef.current;

      const floatSpeed = currentState === 'working' ? 4.5 : 2.0;
      const floatAmp = currentState === 'working' ? 0.12 : 0.08;
      robotRoot.position.y = Math.sin(elapsedTime * floatSpeed) * floatAmp;

      // Smooth glide to target pose: tracks cursor when inside, glides straight forward when outside!
      robotRoot.rotation.y = THREE.MathUtils.lerp(robotRoot.rotation.y, targetRotation.y, 0.08);
      robotRoot.rotation.x = THREE.MathUtils.lerp(robotRoot.rotation.x, targetRotation.x, 0.08);

      const flutterSpeed = currentState === 'working' ? 8.0 : currentState === 'completed' ? 6.0 : 3.2;
      const flutterAngle = Math.sin(elapsedTime * flutterSpeed) * 0.18;
      leftUpperWing.rotation.z = 0.85 + flutterAngle;
      rightUpperWing.rotation.z = -0.85 - flutterAngle;
      leftLowerWing.rotation.z = 1.55 + flutterAngle * 0.8;
      rightLowerWing.rotation.z = -1.55 - flutterAngle * 0.8;

      thrustRing.rotation.z = elapsedTime * 1.8;
      innerThrustRing.rotation.z = -elapsedTime * 2.4;
      const ringScale = 1 + Math.sin(elapsedTime * 5) * 0.05;
      thrustRing.scale.set(ringScale, ringScale, 1);

      chestRing.rotation.z = elapsedTime * 2.0;

      const positions = particleGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3 + 1] -= 0.006;
        if (positions[i * 3 + 1] < -1.6) {
          positions[i * 3 + 1] = 1.4;
        }
      }
      particleGeo.attributes.position.needsUpdate = true;

      blinkTimer += 0.016;
      if (blinkTimer > 3.6) {
        isBlinking = true;
        if (blinkTimer > 3.8) {
          isBlinking = false;
          blinkTimer = 0;
        }
      }

      drawEyes(elapsedTime, currentState);
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseleave', handleMouseLeave);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [size]);

  return (
    <div
      ref={mountRef}
      className={`relative pointer-events-none transition-transform duration-300 ${
        isExpanded ? 'w-20 h-20' : 'w-56 h-56'
      }`}
    >
      <div
        className={`absolute inset-0 rounded-full blur-2xl transition-all duration-700 pointer-events-none -z-10 ${
          robotState === 'completed'
            ? 'bg-kauvery-amber/50'
            : robotState === 'working' || robotState === 'thinking'
            ? 'bg-kauvery-coral/55'
            : robotState === 'listening'
            ? 'bg-kauvery-fuchsia/60'
            : 'bg-gradient-to-tr from-kauvery-amber/40 via-kauvery-coral/40 to-kauvery-magenta/50'
        }`}
      />
    </div>
  );
};

// =============================================================
// MAIN APPLICATION COMPONENT (KAUVERY AGENT)
// =============================================================
export default function App() {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [robotState, setRobotState] = useState<RobotState>('idle');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [showLiveRun, setShowLiveRun] = useState<boolean>(true);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState<boolean>(true);
  const [mainView, setMainView] = useState<'workspace' | 'browser' | 'captcha' | 'scraping'>('workspace');
  const [selectedAgentTab, setSelectedAgentTab] = useState<string>('brain');
  const [activeTask, setActiveTask] = useState<TaskExecution | null>(null);
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState<string>('http://localhost:5678/webhook/kauvery-task');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [assistantMode, setAssistantMode] = useState<'autonomous' | 'deep_research' | 'excel_analytics'>('autonomous');
  const [backendUrl, setBackendUrl] = useState<string>('http://localhost:8000');
  const [liveScreenshot, setLiveScreenshot] = useState<string | null>(null);
  const [humanChallenge, setHumanChallenge] = useState<{
    runId: string;
    image: string;
    message: string;
  } | null>(null);
  const [challengeInputText, setChallengeInputText] = useState<string>('');
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const activeEventSourceRef = useRef<EventSource | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-welcome',
      sender: 'agent',
      text: `👋 **Welcome to Kauvery Agent.**\n\nI am your autonomous Agentic AI RPA & desktop automation companion. Give me any task — web scraping, YouTube video listing, e-commerce data extraction, Excel reports, or form automation — and I will autonomously execute it.`,
      timestamp: 'Just now',
    },
  ]);

  const [agents, setAgents] = useState<Record<string, AgentStatus>>({
    brain: {
      id: 'brain',
      name: 'Brain Agent',
      role: 'Master Orchestrator & Task Decomposition',
      state: 'idle',
      color: '#D80064',
      activity: 'Standing by for instructions',
      progress: 0,
    },
    scraper: {
      id: 'scraper',
      name: 'Web Scraping Agent',
      role: 'DOM Crawler & Medical Data Extraction',
      state: 'idle',
      color: '#F85A28',
      activity: 'Ready for browser automation',
      progress: 0,
    },
    excel: {
      id: 'excel',
      name: 'Excel Agent',
      role: 'Spreadsheet Analytics & Audit Engine',
      state: 'idle',
      color: '#FFB81C',
      activity: 'Ready to generate .xlsx reports',
      progress: 0,
    },
    screen: {
      id: 'screen',
      name: 'Screen Interaction Agent',
      role: 'Desktop Vision & UI Automation',
      state: 'idle',
      color: '#E6007A',
      activity: 'Desktop visual observer idle',
      progress: 0,
    },
    captcha: {
      id: 'captcha',
      name: 'CAPTCHA Agent',
      role: 'Neural Vision & Security Solver',
      state: 'idle',
      color: '#FFC83B',
      activity: 'Neural bypass ready',
      progress: 0,
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeTask?.logs, activeTask?.steps]);

  useEffect(() => {
    if (window.kauveryDesktop) {
      window.kauveryDesktop.onShortcutTriggered(() => {
        handleToggleExpand();
      });
    }
  }, [isExpanded]);

  const handleToggleExpand = useCallback(() => {
    if (isExpanded) {
      setIsExpanded(false);
      window.kauveryDesktop?.collapseWindow();
    } else {
      setIsExpanded(true);
      // Compact medium size: 400px width x 600px height
      window.kauveryDesktop?.expandWindow(400, 600);
    }
  }, [isExpanded]);

  // =============================================================
  // SMOOTH DRAG & DROP ANYWHERE ON SCREEN (Single-click / Left-click drag)
  // Double-click to open/expand!
  // =============================================================
  const handleRobotMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only primary left-click
    e.preventDefault();

    isDraggingRef.current = false;
    let lastX = e.screenX;
    let lastY = e.screenY;
    dragStartPosRef.current = { x: lastX, y: lastY };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const movementX = moveEvent.screenX - lastX;
      const movementY = moveEvent.screenY - lastY;

      if (
        Math.abs(moveEvent.screenX - dragStartPosRef.current!.x) > 3 ||
        Math.abs(moveEvent.screenY - dragStartPosRef.current!.y) > 3
      ) {
        isDraggingRef.current = true;
      }

      lastX = moveEvent.screenX;
      lastY = moveEvent.screenY;

      if (window.kauveryDesktop) {
        window.kauveryDesktop.dragWindow(movementX, movementY);
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 60);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Header drag for expanded mode
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.no-drag')) return;
    handleRobotMouseDown(e);
  };

  const playGlassChime = (type: 'send' | 'complete' | 'alert') => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'send') {
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
      } else if (type === 'complete') {
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1318.5, audioCtx.currentTime + 0.35);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.6);
      } else {
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(330, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      }
    } catch {
      // Audio fallback
    }
  };

  const handleStopTask = async () => {
    if (activeRunId) {
      try {
        await fetch(`${backendUrl}/api/run/${activeRunId}/stop`, { method: 'POST' });
      } catch (err) {
        console.error('Failed to trigger stop on backend:', err);
      }
    }
    if (activeEventSourceRef.current) {
      activeEventSourceRef.current.close();
      activeEventSourceRef.current = null;
    }
    setActiveTask((prev) => (prev ? { ...prev, status: 'failed', currentOperation: 'Task cancelled by user.' } : null));
    setRobotState('idle');
    setActiveRunId(null);
    setHumanChallenge(null);
    setMessages((prev) => [
      ...prev,
      {
        id: `stop-${Date.now()}`,
        sender: 'system',
        text: '⏹️ **Task stopped.** Execution was cancelled by the user.',
        timestamp: 'Just now',
      },
    ]);
  };

  const executeAutonomousTask = async (taskQuery: string) => {
    const taskId = `KAUV-${Math.floor(1000 + Math.random() * 9000)}`;
    const startTime = Date.now();

    playGlassChime('send');
    setRobotState('thinking');

    const initialSteps: TaskStep[] = [
      {
        id: 1,
        label: 'Task Planning & Intent Analysis',
        agent: 'Brain Agent',
        status: 'running',
        detail: `Synthesizing execution plan for: "${taskQuery.slice(0, 45)}"`,
      },
      {
        id: 2,
        label: 'Browser Navigation & Content Inspection',
        agent: 'Web Scraping Agent',
        status: 'pending',
        detail: 'Connecting to target website and verifying page structure',
      },
      {
        id: 3,
        label: 'Autonomous Data Extraction',
        agent: 'Web Scraping Agent',
        status: 'pending',
        detail: 'Extracting structured records, cards, or tabular data',
      },
      {
        id: 4,
        label: 'Data Processing & Excel Formatting',
        agent: 'Excel Agent',
        status: 'pending',
        detail: 'Compiling structured dataset into formatted workbook',
      },
      {
        id: 5,
        label: 'Verification & Delivery',
        agent: 'Brain Agent',
        status: 'pending',
        detail: 'Validating output files and providing desktop download',
      },
    ];

    const newTask: TaskExecution = {
      id: taskId,
      title: taskQuery,
      status: 'in_progress',
      activeAgentId: 'brain',
      currentOperation: 'Brain Agent is orchestrating workflow pipeline...',
      progress: 8,
      steps: initialSteps,
      logs: [
        `[${new Date().toLocaleTimeString()}] [System] Task #${taskId} initialized.`,
        `[${new Date().toLocaleTimeString()}] [Brain Agent] Model decomposed objective into 5 atomic DAG nodes.`,
        `[${new Date().toLocaleTimeString()}] [Brain Agent] Routing execution to local agents & n8n webhook listener...`,
      ],
      startTime,
    };

    setActiveTask(newTask);

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: taskQuery,
      timestamp: 'Just now',
    };

    const agentMsgId = `agent-${Date.now()}`;
    const agentMsg: Message = {
      id: agentMsgId,
      sender: 'agent',
      text: `Initiating execution for: **${taskQuery}**\n\nKauvery Autonomous Core is dispatching cooperating sub-agents now.`,
      timestamp: 'Just now',
      task: newTask,
    };

    setMessages((prev) => [...prev, userMsg, agentMsg]);
    setInputPrompt('');

    // Live Python Backend Integration (SSE)
    try {
      const healthCheck = await fetch(`${backendUrl}/api/health`, {
        signal: AbortSignal.timeout(1200),
      });
      if (healthCheck.ok) {
        let targetUrl = '';
        const urlMatch = taskQuery.match(/https?:\/\/[^\s]+/i);
        const domainMatch = taskQuery.match(/\b([a-zA-Z0-9-]+\.(?:com|org|dev|net|in|io|co|ai|edu|gov|app|me|info|biz|hospital)(?:\/[^\s]*)?)\b/i);
        const qLower = taskQuery.toLowerCase();

        if (urlMatch) {
          targetUrl = urlMatch[0];
        } else if (domainMatch) {
          targetUrl = `https://${domainMatch[1]}`;
        } else if (qLower.includes('gmail') || qLower.includes('mail') || qLower.includes('email') || qLower.includes('inbox')) {
          targetUrl = 'https://mail.google.com/';
        } else if (qLower.includes('google drive') || qLower.includes('drive')) {
          targetUrl = 'https://drive.google.com/';
        } else if (qLower.includes('google doc') || qLower.includes('docs')) {
          targetUrl = 'https://docs.google.com/';
        } else if (qLower.includes('google sheet') || qLower.includes('sheets')) {
          targetUrl = 'https://sheets.google.com/';
        } else if (qLower.includes('whatsapp')) {
          targetUrl = 'https://web.whatsapp.com/';
        } else if (qLower.includes('trycap')) {
          targetUrl = 'https://trycap.dev/';
        } else if (qLower.includes('youtube') || qLower.includes('yt')) {
          targetUrl = 'https://www.youtube.com/';
        } else if (qLower.includes('amazon')) {
          targetUrl = 'https://www.amazon.in/';
        } else if (qLower.includes('flipkart')) {
          targetUrl = 'https://www.flipkart.com/';
        } else if (qLower.includes('kauvery')) {
          targetUrl = 'https://www.kauveryhospital.com/';
        } else if (qLower.includes('google')) {
          targetUrl = 'https://www.google.com/';
        } else if (qLower.includes('github')) {
          targetUrl = 'https://github.com/';
        } else if (qLower.includes('quotes') || qLower.includes('toscrape')) {
          targetUrl = 'https://quotes.toscrape.com/login';
        } else {
          const cleanQ = taskQuery.replace(/\b(open|search|site|la|ku|po|irukkum|atha|clear|pannu|paaru|kaatu|eduthu|kudu|podu|anupu|check|ennoda)\b/gi, '').trim();
          targetUrl = `https://www.google.com/search?q=${encodeURIComponent(cleanQ || taskQuery)}`;
        }

        const runRes = await fetch(`${backendUrl}/api/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: taskQuery,
            url: targetUrl,
          }),
        });

        if (runRes.ok) {
          const { run_id } = await runRes.json();
          setActiveRunId(run_id);

          if (activeEventSourceRef.current) {
            activeEventSourceRef.current.close();
          }

          const es = new EventSource(`${backendUrl}/api/run/${run_id}/events`);
          activeEventSourceRef.current = es;

          const collectedFiles: Array<{ name: string; type: string; size: string; url: string }> = [];

          es.onmessage = (e) => {
            try {
              const ev = JSON.parse(e.data);
              if (ev.type === 'thought') {
                const agRole = ev.agent === 'browser' ? 'Web Scraping Agent' : ev.agent === 'challenge' ? 'CAPTCHA Agent' : ev.agent === 'excel' ? 'Excel Agent' : 'Brain Agent';
                const agId = ev.agent === 'browser' ? 'scraper' : ev.agent === 'challenge' ? 'captcha' : ev.agent === 'excel' ? 'excel' : 'brain';
                
                if (ev.agent === 'browser') setRobotState('working');
                else if (ev.agent === 'challenge') setRobotState('collaborating');
                else if (ev.agent === 'excel') setRobotState('working');
                else setRobotState('thinking');

                setActiveTask((prev) => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    activeAgentId: agId,
                    currentOperation: `[${agRole}] ${ev.message}`,
                    progress: Math.min(prev.progress + 6, 94),
                    logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] [${agRole}] ${ev.message}`],
                  };
                });
              } else if (ev.type === 'action') {
                setActiveTask((prev) => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] [${ev.agent.toUpperCase()} ACTION] ${ev.message}`],
                  };
                });
              } else if (ev.type === 'screenshot') {
                if (ev.data?.image) {
                  setLiveScreenshot(ev.data.image);
                }
              } else if (ev.type === 'need_human') {
                setRobotState('listening');
                playGlassChime('alert');
                setHumanChallenge({
                  runId: run_id,
                  image: ev.data?.image || '',
                  message: ev.message,
                });
                setActiveTask((prev) => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    currentOperation: 'Human verification required',
                    logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] [HUMAN REQUIRED] ${ev.message}`],
                  };
                });
              } else if (ev.type === 'file') {
                const f = ev.data.name;
                collectedFiles.push({
                  name: f,
                  type: f.endsWith('.xlsx') ? 'xlsx' : 'csv',
                  size: 'Spreadsheet',
                  url: `${backendUrl}${ev.data.url}`,
                });
              } else if (ev.type === 'final') {
                es.close();
                activeEventSourceRef.current = null;
                setRobotState('completed');
                playGlassChime('complete');
                confetti({
                  particleCount: 50,
                  spread: 60,
                  origin: { y: 0.8 },
                  colors: ['#FFB81C', '#F85A28', '#D80064', '#6B0F48'],
                });
                const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1) + 's';
                const rowsCount = ev.data?.rows || 0;
                const finalSummary = ev.data?.summary || ev.message || 'Automation completed successfully.';

                if (collectedFiles.length === 0 && ev.data?.files) {
                  for (const f of ev.data.files) {
                    collectedFiles.push({
                      name: f,
                      type: f.endsWith('.xlsx') ? 'xlsx' : 'csv',
                      size: 'Spreadsheet',
                      url: `${backendUrl}/api/files/${f}`,
                    });
                  }
                }

                const taskResult = {
                  recordsCount: rowsCount,
                  duration: totalDuration,
                  files: collectedFiles,
                  sources: [{ name: targetUrl, url: targetUrl }],
                  summary: finalSummary,
                };

                setActiveTask((prev) => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    status: 'completed',
                    progress: 100,
                    currentOperation: 'Task successfully completed!',
                    completedTime: Date.now(),
                    result: taskResult,
                    steps: prev.steps.map((s) => ({ ...s, status: 'completed' })),
                  };
                });

                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === agentMsgId
                      ? {
                          ...m,
                          text: `✅ **Task Completed in ${totalDuration}!**\n\n${finalSummary}`,
                          task: {
                            ...newTask,
                            status: 'completed',
                            progress: 100,
                            currentOperation: 'Task successfully completed!',
                            steps: initialSteps.map((s) => ({ ...s, status: 'completed' })),
                            result: taskResult,
                          },
                        }
                      : m
                  )
                );
                setTimeout(() => setRobotState('idle'), 4000);
              } else if (ev.type === 'error') {
                es.close();
                activeEventSourceRef.current = null;
                setRobotState('error');
                playGlassChime('alert');
                setActiveTask((prev) => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    status: 'failed',
                    currentOperation: `Error: ${ev.message}`,
                    logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] [ERROR] ${ev.message}`],
                  };
                });
              }
            } catch (err) {
              console.error('SSE event parse error:', err);
            }
          };

          es.onerror = () => {
            console.warn('SSE disconnected');
          };

          return; // Connected to live backend!
        } else {
          const errData = await runRes.json().catch(() => ({}));
          throw new Error(errData.detail || `Server returned error ${runRes.status}`);
        }
      } else {
        throw new Error('Python Automation Backend (server.py) is not responding on port 8000.');
      }
    } catch (err: any) {
      console.error('Backend execution failed:', err);
      setRobotState('error');
      playGlassChime('alert');
      setActiveTask((prev) =>
        prev
          ? {
              ...prev,
              status: 'failed',
              currentOperation: `Error: ${err?.message || 'Cannot reach Python backend'}`,
              logs: [
                ...prev.logs,
                `[${new Date().toLocaleTimeString()}] [ERROR] ${err?.message || 'Connection failed'}`,
                `[${new Date().toLocaleTimeString()}] [INFO] Please verify Python server is running: python server.py`,
              ],
            }
          : null
      );
      setMessages((prev) =>
        prev.map((m) =>
          m.id === agentMsgId
            ? {
                ...m,
                text: `❌ **Automation Backend Disconnected**\n\nCould not connect to the Python Automation Core at \`${backendUrl}\`.\n\n*Error: ${err?.message || 'Server not reachable'}*\n\nPlease make sure \`python server.py\` is running on port 8000.`,
              }
            : m
        )
      );
    }
  };

  const handleDownloadFile = async (file: { name: string; content?: string; type: string; url?: string }) => {
    if (file.url) {
      if (window.kauveryDesktop?.openExternal) {
        window.kauveryDesktop.openExternal(file.url);
      } else {
        const link = document.createElement('a');
        link.href = file.url;
        link.setAttribute('download', file.name);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      return;
    }
    if (window.kauveryDesktop?.saveExportedFile) {
      const res = await window.kauveryDesktop.saveExportedFile({
        filename: file.name,
        content: file.content || '',
        type: file.type,
      });
      if (res.success) {
        alert(`Saved ${res.filename} to your Downloads folder!`);
      } else {
        alert(`Export note: ${res.error || 'Saved'}`);
      }
    } else {
      const blob = new Blob([file.content || ''], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.name);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleOpenLink = (url: string) => {
    if (window.kauveryDesktop?.openExternal) {
      window.kauveryDesktop.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const handleToggleVoice = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this environment. Please type your command.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      setRobotState('idle');
      return;
    }

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      setIsListening(true);
      setRobotState('listening');

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputPrompt(transcript);
        }
        setIsListening(false);
        setRobotState('idle');
      };

      recognition.onerror = () => {
        setIsListening(false);
        setRobotState('idle');
      };

      recognition.onend = () => {
        setIsListening(false);
        setRobotState('idle');
      };

      recognition.start();
    } catch {
      setIsListening(false);
      setRobotState('idle');
    }
  };

  // -------------------------------------------------------------
  // RENDER: COMPACT FLOATING ROBOT OVERLAY (Collapsed Mode)
  // Fix 1: Wings never cut off (increased bounds & camera distance)
  // Fix 2: Single-click/Left-click drag anywhere on screen
  // Fix 3: Double-click only to open the chat panel
  // -------------------------------------------------------------
  if (!isExpanded) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-2 relative select-none">
        <div
          onMouseDown={handleRobotMouseDown}
          onDoubleClick={(e) => {
            e.stopPropagation();
            handleToggleExpand();
          }}
          className="relative group cursor-grab active:cursor-grabbing flex flex-col items-center justify-center"
          title="Double-click to open Kauvery Agent • Drag to move anywhere on screen"
        >
          {/* Luminous Kauvery Multi-Color Gradient Halo */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-kauvery-amber/50 via-kauvery-coral/50 to-kauvery-magenta/60 opacity-60 blur-2xl group-hover:opacity-90 transition-opacity duration-500 animate-pulse-slow" />

          {/* 3D Robot Companion with Zero Clipping */}
          <div className="relative z-10 filter drop-shadow-[0_12px_24px_rgba(216,0,100,0.35)]">
            <KauveryRobotCanvas
              robotState={robotState}
              isExpanded={false}
              size={220}
            />
          </div>

          {/* Status Pill: High Contrast, Legible, with double-click hint */}
          <div className="absolute -bottom-2 z-20 px-3 py-1 rounded-full bg-neutral-950/95 border border-kauvery-magenta shadow-[0_0_15px_rgba(216,0,100,0.45)] backdrop-blur-xl flex items-center space-x-2 transition-transform duration-300 group-hover:scale-105 pointer-events-none">
            <span
              className={`w-2 h-2 rounded-full ${
                robotState === 'completed'
                  ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                  : robotState === 'working' || robotState === 'thinking'
                  ? 'bg-kauvery-amber animate-ping shadow-[0_0_8px_#ffb81c]'
                  : 'bg-kauvery-magenta animate-pulse shadow-[0_0_8px_#d80064]'
              }`}
            />
            <span className="text-[10px] font-extrabold tracking-wider text-white uppercase font-mono drop-shadow">
              {robotState === 'idle' ? 'Kauvery Agent' : robotState}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: COMPACT MEDIUM EXPANDED OVERLAY ASSISTANT (400px x 600px)
  // Perfectly proportioned for any screen resolution
  // -------------------------------------------------------------
  const isTaskRunning = Boolean(
    activeTask &&
      (activeTask.status === 'in_progress' ||
        activeTask.status === 'planning' ||
        activeTask.status === 'running')
  );

  return (
    <div className="w-full h-full p-2 flex flex-col select-none overflow-hidden font-sans">
      <div className="w-full h-full flex flex-col rounded-2xl glass-panel relative overflow-hidden shadow-2xl border border-white/10">
        <div className="absolute -top-32 -left-20 w-72 h-72 rounded-full bg-kauvery-plum/40 blur-3xl pointer-events-none" />
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-kauvery-coral/25 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/3 w-80 h-80 rounded-full bg-kauvery-magenta/15 blur-3xl pointer-events-none" />

        {/* 1. Compact Header with Kauvery Hospital Branding & Controls */}
        <header
          onMouseDown={handleHeaderMouseDown}
          className="cursor-move px-3 py-2 flex items-center justify-between border-b border-white/10 bg-kauvery-deep/85 backdrop-blur-xl relative z-20"
        >
          <div className="flex items-center space-x-2.5 no-drag">
            <div className="relative group">
              <div className="w-8 h-8 rounded-xl p-0.5 bg-gradient-to-br from-kauvery-amber via-kauvery-coral to-kauvery-magenta shadow-kauvery-glow flex items-center justify-center overflow-hidden">
                <img
                  src={logoImg}
                  alt="Kauvery Agent"
                  className="w-full h-full object-contain filter drop-shadow"
                />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-kauvery-deep animate-pulse" />
            </div>

            <div className="flex flex-col">
              <div className="flex items-center space-x-1.5">
                <h1 className="text-xs font-extrabold tracking-wide uppercase text-white font-mono flex items-center space-x-1">
                  <span className="text-kauvery-gradient">KAUVERY</span>
                  <span className="text-gray-200">AGENT</span>
                </h1>
                <span className="px-1.5 py-0.2 rounded text-[8.5px] font-semibold bg-kauvery-magenta/25 text-kauvery-pink border border-kauvery-magenta/40 font-mono">
                  v2.5
                </span>
              </div>
              <div className="flex items-center space-x-1.5 text-[9.5px] text-gray-400">
                <span className="flex items-center space-x-1">
                  <Activity className="w-2.5 h-2.5 text-kauvery-amber animate-pulse" />
                  <span className="text-gray-300">5 Agents</span>
                </span>
                <span>•</span>
                <span className="text-emerald-400 font-mono">Online</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1 no-drag">
            {isTaskRunning && (
              <button
                onClick={handleStopTask}
                title="Stop current running task"
                className="flex items-center space-x-1 px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[9.5px] font-bold animate-pulse transition-all shadow-md mr-1 border border-rose-400/50"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                <span>Stop</span>
              </button>
            )}
            <button
              onClick={() => {
                const nextState = !isAlwaysOnTop;
                setIsAlwaysOnTop(nextState);
                window.kauveryDesktop?.toggleAlwaysOnTop(nextState);
              }}
              title={isAlwaysOnTop ? 'Always on Top: ON' : 'Always on Top: OFF'}
              className={`p-1 rounded-lg transition-colors ${
                isAlwaysOnTop
                  ? 'bg-kauvery-magenta/30 text-kauvery-pink border border-kauvery-magenta/40'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Pin className="w-3 h-3" />
            </button>

            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              title="Agent & n8n Settings"
              className={`p-1 rounded-lg transition-colors ${
                isSettingsOpen
                  ? 'bg-kauvery-coral/30 text-kauvery-amber'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Settings className="w-3 h-3" />
            </button>

            <button
              onClick={handleToggleExpand}
              title="Minimize to Floating Companion"
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Minimize2 className="w-3 h-3" />
            </button>

            <button
              onClick={() => window.kauveryDesktop?.close()}
              title="Close Application"
              className="p-1 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </header>

        {/* 2. n8n & Backend Settings Drawer */}
        {isSettingsOpen && (
          <div className="p-2.5 bg-neutral-950/95 border-b border-kauvery-magenta/30 z-20 text-[11px] text-gray-300 space-y-1.5 backdrop-blur-2xl">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white flex items-center space-x-1.5">
                <Zap className="w-3 h-3 text-kauvery-amber" />
                <span>Backend Orchestration & n8n Link</span>
              </span>
              <span className="text-[9px] text-kauvery-coral font-mono">LOCAL REST/WS</span>
            </div>
            <div>
              <label className="text-[9px] text-gray-400 block mb-0.5">n8n / Local Webhook Endpoint:</label>
              <input
                type="text"
                value={n8nWebhookUrl}
                onChange={(e) => setN8nWebhookUrl(e.target.value)}
                className="w-full bg-black/60 border border-white/15 rounded-lg px-2 py-0.5 text-white font-mono text-[10px] focus:outline-none focus:border-kauvery-magenta"
                placeholder="http://localhost:5678/webhook/..."
              />
            </div>
            <div className="flex items-center justify-between pt-0.5">
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => setAssistantMode('autonomous')}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                    assistantMode === 'autonomous'
                      ? 'bg-kauvery-magenta text-white'
                      : 'bg-white/5 text-gray-400'
                  }`}
                >
                  Autonomous
                </button>
                <button
                  onClick={() => setAssistantMode('deep_research')}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                    assistantMode === 'deep_research'
                      ? 'bg-kauvery-coral text-white'
                      : 'bg-white/5 text-gray-400'
                  }`}
                >
                  Deep Web
                </button>
                <button
                  onClick={() => setAssistantMode('excel_analytics')}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                    assistantMode === 'excel_analytics'
                      ? 'bg-kauvery-amber text-black font-bold'
                      : 'bg-white/5 text-gray-400'
                  }`}
                >
                  Excel Engine
                </button>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-[9px] text-gray-400 hover:text-white underline"
              >
                Done
              </button>
            </div>

            <div className="pt-1.5 mt-1 border-t border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[9.5px] text-gray-200 font-semibold block flex items-center space-x-1">
                  <span>Google Chrome & Gmail Session</span>
                </span>
                <span className="text-[8.5px] text-emerald-400 font-mono">Profile 1 (ssahayarajdgl@gmail.com)</span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch(`${backendUrl}/api/chrome/launch-debug`, { method: 'POST' });
                    const d = await res.json();
                    alert(d.message || 'Chrome debug session connected');
                  } catch (e: any) {
                    alert('Error connecting Chrome: ' + e.message);
                  }
                }}
                className="px-2 py-0.5 rounded bg-kauvery-magenta/30 hover:bg-kauvery-magenta border border-kauvery-magenta/50 text-white text-[9px] font-semibold transition-all shadow-sm"
              >
                Connect Chrome
              </button>
            </div>
          </div>
        )}

        {/* 2.5 Navigation View Switcher */}
        <div className="px-3 py-1 bg-black/60 border-b border-white/10 flex items-center justify-between z-10">
          <div className="flex items-center space-x-1">
            <button
              onClick={() => {
                setMainView('workspace');
                window.kauveryDesktop?.resizeWindow(400, 600);
              }}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center space-x-1 transition-all ${
                mainView === 'workspace'
                  ? 'bg-gradient-to-r from-kauvery-coral to-kauvery-magenta text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Terminal className="w-2.5 h-2.5" />
              <span>Agent Hub</span>
            </button>
            <button
              onClick={() => {
                setMainView('browser');
                window.kauveryDesktop?.resizeWindow(980, 740);
              }}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center space-x-1 transition-all ${
                mainView === 'browser'
                  ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Globe className="w-2.5 h-2.5" />
              <span>Browser Studio</span>
            </button>
            <button
              onClick={() => {
                setMainView('captcha');
                window.kauveryDesktop?.resizeWindow(840, 680);
              }}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center space-x-1 transition-all ${
                mainView === 'captcha'
                  ? 'bg-gradient-to-r from-kauvery-magenta to-kauvery-plum text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <ShieldCheck className="w-2.5 h-2.5" />
              <span>CAPTCHA Intel</span>
            </button>
            <button
              onClick={() => {
                setMainView('scraping');
                window.kauveryDesktop?.resizeWindow(840, 680);
              }}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center space-x-1 transition-all ${
                mainView === 'scraping'
                  ? 'bg-gradient-to-r from-kauvery-amber to-kauvery-coral text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <FileSpreadsheet className="w-2.5 h-2.5" />
              <span>Web Scraper</span>
            </button>
          </div>
          <span className="text-[8.5px] text-gray-500 font-mono tracking-wider">v2.5 AUTONOMOUS</span>
        </div>

        {mainView === 'browser' ? (
          <div className="flex-1 overflow-hidden p-2">
            <AutonomousBrowserStudio apiBase={backendUrl} />
          </div>
        ) : mainView === 'captcha' ? (
          <div className="flex-1 overflow-y-auto p-2">
            <CaptchaDashboard isVisible={true} apiBase={backendUrl} runId={activeRunId || undefined} />
          </div>
        ) : mainView === 'scraping' ? (
          <div className="flex-1 overflow-y-auto p-2">
            <ScrapingConsole isVisible={true} apiBase={backendUrl} />
          </div>
        ) : (
          <>
            {/* 3. Compact Interactive Robot Banner */}
            <div className="px-3 py-1.5 bg-gradient-to-r from-kauvery-deep via-kauvery-darkplum/60 to-kauvery-deep border-b border-white/5 flex items-center justify-between relative overflow-hidden">
          <div className="flex items-center space-x-2.5">
            <div className="cursor-pointer" onClick={() => setRobotState(robotState === 'idle' ? 'thinking' : 'idle')}>
              <KauveryRobotCanvas
                robotState={robotState}
                isExpanded={true}
                size={64}
              />
            </div>

            <div className="flex flex-col">
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] font-bold text-white tracking-wide">Kauvery Companion</span>
                <span
                  className={`text-[8.5px] uppercase px-1.5 py-0.2 rounded-full font-mono font-semibold ${
                    robotState === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : robotState === 'working'
                      ? 'bg-kauvery-coral/20 text-kauvery-amber border border-kauvery-coral/30'
                      : robotState === 'listening'
                      ? 'bg-kauvery-fuchsia/20 text-kauvery-pink border border-kauvery-fuchsia/30'
                      : 'bg-white/10 text-gray-200'
                  }`}
                >
                  {robotState}
                </span>
              </div>
              <p className="text-[10px] text-gray-300 max-w-[210px] truncate">
                {robotState === 'idle' && 'Ready on desktop. Type or speak below.'}
                {robotState === 'listening' && 'Listening to audio stream...'}
                {robotState === 'thinking' && 'Decomposing task dependencies...'}
                {robotState === 'working' && 'Executing multi-agent automated workflow...'}
                {robotState === 'completed' && 'Execution completed with 100% verification.'}
                {robotState === 'error' && 'Execution warning encountered.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setMessages([
                {
                  id: `welcome-${Date.now()}`,
                  sender: 'agent',
                  text: 'Chat history cleared. Ready for your next autonomous task.',
                  timestamp: 'Just now',
                },
              ]);
              setActiveTask(null);
            }}
            title="Clear and start new session"
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>

        {/* 4. Compact 5-Agent Topology Bar */}
        <div className="px-2.5 py-1.5 bg-black/40 border-b border-white/5 flex items-center space-x-1 overflow-x-auto no-scrollbar">
          {Object.values(agents).map((agent) => {
            const isAgentActive = activeTask?.activeAgentId === agent.id;
            return (
              <button
                key={agent.id}
                onClick={() => setSelectedAgentTab(agent.id)}
                className={`px-2 py-1 rounded-lg flex items-center space-x-1 transition-all text-left whitespace-nowrap text-[9.5px] font-medium border ${
                  isAgentActive
                    ? 'bg-kauvery-magenta/25 border-kauvery-magenta text-white shadow-kauvery-glow'
                    : selectedAgentTab === agent.id
                    ? 'bg-white/10 border-white/20 text-white'
                    : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor: agent.color,
                    boxShadow: isAgentActive ? `0 0 8px ${agent.color}` : 'none',
                  }}
                />
                <span className="font-semibold text-gray-200">{agent.name.replace(' Agent', '')}</span>
                {isAgentActive && <span className="animate-spin text-kauvery-amber text-[9px]">⟳</span>}
              </button>
            );
          })}
        </div>

        {/* 5. Compact Chat History & Task Stream */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 relative">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
              >
                <div className="flex items-center space-x-1 text-[9px] text-gray-400 px-1 font-mono">
                  <span>{isUser ? 'You' : 'Kauvery Agent'}</span>
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                </div>

                <div
                  className={`max-w-[92%] rounded-xl p-2.5 text-[11px] leading-relaxed ${
                    isUser
                      ? 'bg-gradient-to-r from-kauvery-plum to-kauvery-magenta text-white rounded-tr-sm shadow-md'
                      : 'glass-card text-gray-200 rounded-tl-sm shadow-lg'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.text}</p>

                  {/* ADVANCED LIVE TASK MONITOR CARD */}
                  {msg.task && (
                    <div className="mt-2.5 pt-2.5 border-t border-white/10 space-y-2.5 font-sans">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <div className="p-0.5 rounded-md bg-kauvery-magenta/20 text-kauvery-pink">
                            <Activity className="w-3 h-3 animate-pulse" />
                          </div>
                          <div>
                            <span className="font-bold text-white text-[10px] block">{msg.task.title}</span>
                            <span className="text-[8.5px] text-kauvery-amber font-mono">TASK #{msg.task.id}</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          {msg.task.status === 'in_progress' && (
                            <button
                              onClick={handleStopTask}
                              className="px-1.5 py-0.5 rounded-md bg-rose-600/80 hover:bg-rose-600 text-[9px] text-white border border-rose-500/40 flex items-center space-x-1 transition-all"
                              title="Stop Task"
                            >
                              <Square className="w-2 h-2 fill-current" />
                              <span>Stop</span>
                            </button>
                          )}
                          <button
                            onClick={() => setShowLiveRun(!showLiveRun)}
                            className="px-1.5 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-[9px] text-kauvery-coral border border-kauvery-coral/30 flex items-center space-x-1 transition-all"
                          >
                            <Terminal className="w-2.5 h-2.5" />
                            <span>{showLiveRun ? 'Hide' : 'Live'}</span>
                            {showLiveRun ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[9px]">
                          <span className="text-gray-300 truncate max-w-[260px]">{msg.task.currentOperation}</span>
                          <span className="font-mono text-kauvery-amber font-bold">{msg.task.progress}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-black/60 overflow-hidden p-0.5 border border-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-kauvery-amber via-kauvery-coral to-kauvery-magenta transition-all duration-500 shadow-kauvery-glow"
                            style={{ width: `${msg.task.progress}%` }}
                          />
                        </div>
                      </div>

                      <div className="space-y-1 pt-0.5">
                        {msg.task.steps.map((step) => (
                          <div
                            key={step.id}
                            className={`p-1.5 rounded-lg flex items-start space-x-1.5 text-[10px] transition-all ${
                              step.status === 'running'
                                ? 'bg-kauvery-magenta/20 border border-kauvery-magenta/40 text-white shadow-kauvery-glow'
                                : step.status === 'completed'
                                ? 'bg-white/5 border border-white/5 text-gray-300'
                                : 'bg-transparent text-gray-500'
                            }`}
                          >
                            <div className="mt-0.5">
                              {step.status === 'completed' && (
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              )}
                              {step.status === 'running' && (
                                <RefreshCw className="w-3 h-3 text-kauvery-amber animate-spin" />
                              )}
                              {step.status === 'pending' && (
                                <Clock className="w-3 h-3 text-gray-500" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-white">{step.label}</span>
                                <span className="text-[8.5px] font-mono text-kauvery-coral">
                                  {step.agent} {step.time ? `(${step.time})` : ''}
                                </span>
                              </div>
                              <p className="text-[9px] text-gray-400 mt-0.5">{step.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {showLiveRun && (
                        <div className="rounded-lg bg-black/80 border border-kauvery-magenta/30 p-2 font-mono text-[9px] text-gray-300 space-y-0.5 max-h-28 overflow-y-auto">
                          <div className="flex items-center justify-between text-kauvery-coral text-[8.5px] pb-0.5 border-b border-white/10 font-bold tracking-wider">
                            <span className="flex items-center space-x-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                              <span>TELEMETRY STREAM</span>
                            </span>
                            <span>WS://ACTIVE</span>
                          </div>
                          {msg.task.logs.map((log, i) => (
                            <div key={i} className="leading-tight text-gray-400 hover:text-white">
                              {log}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* LIVE BROWSER VIEWPORT PREVIEW */}
                      {liveScreenshot && (
                        <div className="rounded-lg overflow-hidden border border-kauvery-coral/40 bg-black/90 p-1 space-y-1">
                          <div className="flex items-center justify-between px-1 text-[8.5px] text-kauvery-coral font-mono">
                            <span className="flex items-center space-x-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                              <span>LIVE BROWSER VIEWPORT</span>
                            </span>
                            <span className="text-gray-400">Playwright Chromium</span>
                          </div>
                          <img
                            src={`data:image/jpeg;base64,${liveScreenshot}`}
                            alt="Browser Viewport"
                            className="w-full rounded border border-white/10 object-contain max-h-48"
                          />
                        </div>
                      )}

                      {/* HUMAN HANDOFF / CHALLENGE SOLVING OVERLAY */}
                      {humanChallenge && (
                        <div className="rounded-xl border-2 border-kauvery-amber bg-neutral-950/95 p-2.5 space-y-2 shadow-2xl backdrop-blur-xl">
                          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                            <div className="flex items-center space-x-1.5 text-kauvery-amber">
                              <ShieldCheck className="w-4 h-4 animate-bounce" />
                              <span className="font-bold text-[10.5px] text-white">Human Verification Required</span>
                            </div>
                            <span className="text-[8.5px] font-mono text-kauvery-coral px-1.5 py-0.5 rounded bg-kauvery-coral/10 border border-kauvery-coral/20">
                              CHALLENGE AGENT
                            </span>
                          </div>
                          
                          <p className="text-[9.5px] text-gray-300 leading-snug">
                            {humanChallenge.message || 'Please solve the verification challenge below, then press Resume.'}
                          </p>

                          {humanChallenge.image && (
                            <div className="relative group cursor-crosshair overflow-hidden rounded-lg border border-white/20 bg-black">
                              <img
                                src={`data:image/jpeg;base64,${humanChallenge.image}`}
                                alt="Challenge Screen"
                                className="w-full object-contain max-h-56"
                                onClick={async (e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const clickX = Math.round(((e.clientX - rect.left) / rect.width) * 1024);
                                  const clickY = Math.round(((e.clientY - rect.top) / rect.height) * (1024 * (rect.height / rect.width)));
                                  try {
                                    await fetch(`${backendUrl}/api/run/${humanChallenge.runId}/input`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ type: 'click', x: clickX, y: clickY }),
                                    });
                                  } catch (err) {
                                    console.error('Failed to forward click:', err);
                                  }
                                }}
                              />
                              <div className="absolute top-1 right-1 pointer-events-none px-1.5 py-0.5 rounded bg-black/75 text-[8px] font-mono text-kauvery-amber border border-white/20">
                                Click image to interact
                              </div>
                            </div>
                          )}

                          <div className="flex items-center space-x-1 pt-1">
                            <input
                              type="text"
                              value={challengeInputText}
                              onChange={(e) => setChallengeInputText(e.target.value)}
                              placeholder="Type captcha text or code..."
                              className="flex-1 bg-black/60 border border-white/20 rounded-lg px-2 py-1 text-[10px] text-white placeholder-gray-500 focus:outline-none focus:border-kauvery-magenta"
                              onKeyDown={async (e) => {
                                if (e.key === 'Enter' && challengeInputText.trim()) {
                                  try {
                                    await fetch(`${backendUrl}/api/run/${humanChallenge.runId}/input`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ type: 'type', text: challengeInputText.trim() }),
                                    });
                                    setChallengeInputText('');
                                  } catch (err) {
                                    console.error('Failed to forward text:', err);
                                  }
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                if (challengeInputText.trim()) {
                                  try {
                                    await fetch(`${backendUrl}/api/run/${humanChallenge.runId}/input`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ type: 'type', text: challengeInputText.trim() }),
                                    });
                                    setChallengeInputText('');
                                  } catch (err) {
                                    console.error('Failed to forward text:', err);
                                  }
                                }
                              }}
                              className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[9.5px] font-semibold transition-colors"
                            >
                              Send
                            </button>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await fetch(`${backendUrl}/api/run/${humanChallenge.runId}/stop`, { method: 'POST' });
                                  setHumanChallenge(null);
                                } catch (err) {
                                  console.error('Failed to stop run:', err);
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[9.5px] font-semibold transition-colors"
                            >
                              Stop Run
                            </button>

                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await fetch(`${backendUrl}/api/run/${humanChallenge.runId}/resume`, { method: 'POST' });
                                  setHumanChallenge(null);
                                } catch (err) {
                                  console.error('Failed to resume run:', err);
                                }
                              }}
                              className="px-3 py-1 rounded-lg bg-gradient-to-r from-kauvery-amber via-kauvery-coral to-kauvery-magenta text-white text-[9.5px] font-bold shadow-md hover:brightness-110 active:scale-95 transition-all"
                            >
                              Resume Execution
                            </button>
                          </div>
                        </div>
                      )}

                      {/* FINAL RESULT UI CARD */}
                      {msg.task.result && (
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-kauvery-darkplum/80 via-kauvery-deep to-black border border-kauvery-amber/30 space-y-2 shadow-kauvery-card">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1.5">
                              <div className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                                <CheckCircle2 className="w-3 h-3" />
                              </div>
                              <span className="font-bold text-white text-[11px]">
                                Task Complete & Verified
                              </span>
                            </div>
                            <span className="text-[9px] font-mono text-kauvery-amber px-1.5 py-0.2 rounded-full bg-kauvery-amber/10 border border-kauvery-amber/30">
                              {msg.task.result.duration}
                            </span>
                          </div>

                          <p className="text-[10px] text-gray-300 leading-relaxed">
                            {msg.task.result.summary}
                          </p>

                          <div className="grid grid-cols-3 gap-1.5 py-0.5">
                            <div className="p-1 rounded-lg bg-white/5 border border-white/5 text-center">
                              <span className="block text-[8px] text-gray-400 uppercase">Records</span>
                              <span className="text-[11px] font-bold font-mono text-kauvery-amber">
                                {msg.task.result.recordsCount}
                              </span>
                            </div>
                            <div className="p-1 rounded-lg bg-white/5 border border-white/5 text-center">
                              <span className="block text-[8px] text-gray-400 uppercase">Accuracy</span>
                              <span className="text-[11px] font-bold font-mono text-emerald-400">100%</span>
                            </div>
                            <div className="p-1 rounded-lg bg-white/5 border border-white/5 text-center">
                              <span className="block text-[8px] text-gray-400 uppercase">Agents</span>
                              <span className="text-[11px] font-bold font-mono text-kauvery-pink">5 Units</span>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[9px] font-semibold text-gray-400 block uppercase tracking-wider">
                              Generated Deliverables
                            </span>
                            {msg.task.result.files.map((file, idx) => (
                              <div
                                key={idx}
                                className="p-1.5 rounded-lg bg-black/50 border border-white/10 hover:border-kauvery-magenta/50 flex items-center justify-between transition-all group"
                              >
                                <div className="flex items-center space-x-1.5">
                                  <div className="p-1 rounded-md bg-kauvery-magenta/20 text-kauvery-pink group-hover:scale-110 transition-transform">
                                    <FileSpreadsheet className="w-3.5 h-3.5" />
                                  </div>
                                  <div>
                                    <span className="font-semibold text-white text-[10px] block truncate max-w-[190px]">
                                      {file.name}
                                    </span>
                                    <span className="text-[8.5px] text-gray-400 font-mono">
                                      {file.size} • {file.type.toUpperCase()}
                                    </span>
                                  </div>
                                </div>

                                <button
                                  onClick={() => handleDownloadFile(file)}
                                  className="px-2 py-0.5 rounded-md bg-gradient-to-r from-kauvery-coral to-kauvery-magenta text-white text-[9px] font-bold flex items-center space-x-1 shadow-md hover:brightness-110 active:scale-95 transition-all"
                                >
                                  <Download className="w-2.5 h-2.5" />
                                  <span>Get</span>
                                </button>
                              </div>
                            ))}
                          </div>

                          <div className="pt-0.5 space-y-0.5">
                            <span className="text-[9px] font-semibold text-gray-400 block uppercase tracking-wider">
                              Verified External Sources
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {msg.task.result.sources.map((source, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => handleOpenLink(source.url)}
                                  className="px-1.5 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-[9px] text-kauvery-amber flex items-center space-x-1 border border-white/10"
                                >
                                  <ExternalLink className="w-2 h-2" />
                                  <span className="truncate max-w-[170px]">{source.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* 7. Compact Input Area */}
        <div className="p-2.5 bg-neutral-950/95 border-t border-white/10 relative z-20">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (inputPrompt.trim()) {
                executeAutonomousTask(inputPrompt.trim());
              }
            }}
            className="flex items-center space-x-1.5"
          >
            <button
              type="button"
              onClick={() => {
                alert('Task attachment: Select CSV/Excel data source or credentials to inject into the workflow.');
              }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Attach File or Clinical Dataset"
            >
              <Paperclip className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleToggleVoice}
              className={`p-1.5 rounded-lg transition-all ${
                isListening
                  ? 'bg-kauvery-fuchsia text-white animate-pulse'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              title={isListening ? 'Listening...' : 'Voice Dictate Command'}
            >
              {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>

            <div className="flex-1 relative">
              <input
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                placeholder=""
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                className="w-full bg-white/5 border border-white/15 focus:border-kauvery-magenta rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-kauvery-magenta transition-all"
              />
            </div>

            {isTaskRunning ? (
              <button
                type="button"
                onClick={handleStopTask}
                className="p-1.5 rounded-lg flex items-center justify-center bg-rose-600 hover:bg-rose-500 text-white shadow-lg active:scale-95 transition-all border border-rose-400/50"
                title="Stop current running task"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!inputPrompt.trim()}
                className={`p-1.5 rounded-lg flex items-center justify-center transition-all ${
                  inputPrompt.trim()
                    ? 'bg-gradient-to-r from-kauvery-coral via-kauvery-magenta to-kauvery-plum text-white shadow-kauvery-glow hover:brightness-110 active:scale-95'
                    : 'bg-white/5 text-gray-600 cursor-not-allowed'
                }`}
                title="Send Command"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          <div className="flex items-center justify-between text-[8.5px] text-gray-400 pt-1.5 px-0.5 font-mono">
            <span>Alt+K to toggle overlay</span>
            <span className="flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-kauvery-amber" />
              <span>Kauvery Healthcare Autonomous System</span>
            </span>
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
