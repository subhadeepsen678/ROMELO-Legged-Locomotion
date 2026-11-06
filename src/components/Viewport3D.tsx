import React, { useEffect, useRef, useState } from 'react';
import { Camera, ChevronDown } from 'lucide-react';
import * as THREE from 'three';
import {
  LightingPreset,
  REFERENCE_ROBOTS,
  SimulationStateFrame,
  TerrainType,
  getTerrainHeight,
} from '../physics/roboticsEngine';

export interface OverlayVisibility {
  zmpMarker: boolean;
  supportPolygon: boolean;
  comTrail: boolean;
  worldTrajectory: boolean;
  contactForces: boolean;
  frictionCones: boolean;
  swingTrails: boolean;
  stanceDiscs: boolean;
  lidarCloud: boolean;
  imuTriad: boolean;
  sensorFrustum: boolean;
  collisionDebug: boolean;
  distanceMarkers: boolean;
}

export type CameraPreset = 'follow_orbit' | 'fixed_world' | 'chase_cam' | 'top_down';

interface Viewport3DProps {
  frame: SimulationStateFrame;
  overlays: OverlayVisibility;
  onToggleOverlay: (key: keyof OverlayVisibility) => void;
  lighting: LightingPreset;
  terrain: TerrainType;
  onApplyPush: (fx: number, fy: number) => void;
  onResetPosition: () => void;
  previewVariant?: 'preview_a' | 'preview_b';
  title?: string;
  portionLabel?: string;
}

const Tactical2DCanvas: React.FC<{
  frame: SimulationStateFrame;
  overlays: OverlayVisibility;
}> = ({ frame, overlays }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const render = () => {
      animId = requestAnimationFrame(render);
      const w = (canvas.width = canvas.clientWidth);
      const h = (canvas.height = canvas.clientHeight);
      if (w === 0 || h === 0) return;

      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(0, 0, w, h);

      const [bx, by] = frame.basePose.position;
      const scale = Math.min(w, h) / 3.2;
      const originX = w * 0.35 - bx * scale;
      const originY = h * 0.5 + by * scale;

      const toScreen = (x: number, y: number): [number, number] => [
        originX + x * scale,
        originY - y * scale,
      ];

      // Grid
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1;
      const startGridX = Math.floor(bx - 4);
      const endGridX = Math.ceil(bx + 8);
      for (let gx = startGridX; gx <= endGridX; gx += 0.5) {
        const [sx] = toScreen(gx, 0);
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, h);
        ctx.stroke();
      }
      for (let gy = -3; gy <= 3; gy += 0.5) {
        const [, sy] = toScreen(0, gy);
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(w, sy);
        ctx.stroke();
      }

      // Runway lane
      const [laneL, laneT] = toScreen(-2, 2.1);
      const [laneR, laneB] = toScreen(20, -2.1);
      ctx.fillStyle = 'rgba(2, 132, 199, 0.08)';
      ctx.fillRect(laneL, laneT, laneR - laneL, laneB - laneT);

      // Trajectory ribbon
      if (overlays.worldTrajectory && frame.worldTrajectory.length > 1) {
        ctx.strokeStyle = '#0284C7';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        frame.worldTrajectory.forEach(([tx, ty], i) => {
          const [sx, sy] = toScreen(tx, ty);
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.stroke();
      }

      // Support polygon
      if (overlays.supportPolygon && frame.supportPolygon.length >= 3) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        frame.supportPolygon.forEach(([px, py], i) => {
          const [sx, sy] = toScreen(px, py);
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Robot Chassis
      const [cx, cy] = toScreen(bx, by);
      const yaw = frame.basePose.rpy[2];
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-yaw);
      ctx.fillStyle = '#0F172A';
      const cW = 0.38 * scale;
      const cH = 0.19 * scale;
      ctx.fillRect(-cW / 2, -cH / 2, cW, cH);
      // Direction Arrow
      ctx.fillStyle = '#06B6D4';
      ctx.beginPath();
      ctx.moveTo(cW / 2 + 10, 0);
      ctx.lineTo(cW / 2 - 4, -6);
      ctx.lineTo(cW / 2 - 4, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Foot contacts
      for (const [key, leg] of Object.entries(frame.legs)) {
        const [fx, fy] = toScreen(leg.footWorld[0], leg.footWorld[1]);
        ctx.beginPath();
        ctx.arc(fx, fy, 6, 0, Math.PI * 2);
        ctx.fillStyle = leg.isStance ? '#10B981' : '#38BDF8';
        ctx.fill();
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#0F172A';
        ctx.font = '10px monospace';
        ctx.fillText(key, fx + 8, fy - 4);
      }

      // ZMP & CoM
      if (overlays.zmpMarker) {
        const [zx, zy] = toScreen(frame.zmpActual[0], frame.zmpActual[1]);
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(zx, zy, 5, 0, Math.PI * 2);
        ctx.fill();

        const [rx, ry] = toScreen(frame.zmpRef[0], frame.zmpRef[1]);
        ctx.strokeStyle = '#06B6D4';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(rx, ry, 7, 0, Math.PI * 2);
        ctx.stroke();
      }

      const [cmx, cmy] = toScreen(frame.com[0], frame.com[1]);
      ctx.fillStyle = '#2563EB';
      ctx.beginPath();
      ctx.arc(cmx, cmy, 4, 0, Math.PI * 2);
      ctx.fill();
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [frame, overlays]);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute bottom-10 left-3 bg-amber-500/20 border border-amber-600/40 text-amber-950 rounded px-2.5 py-1 text-xs font-mono font-medium shadow-sm">
        Tactical 2D Kinematics Radar (WebGL Hardware Fallback)
      </div>
    </div>
  );
};

export const Viewport3D: React.FC<Viewport3DProps> = ({
  frame,
  overlays,
  onToggleOverlay,
  lighting,
  terrain,
  onApplyPush,
  onResetPosition,
  previewVariant = 'preview_a',
  title,
  portionLabel,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<SimulationStateFrame>(frame);
  const overlaysRef = useRef<OverlayVisibility>(overlays);
  const terrainRef = useRef<TerrainType>(terrain);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>(
    previewVariant === 'preview_b' ? 'chase_cam' : 'follow_orbit'
  );
  const cameraPresetRef = useRef<CameraPreset>(cameraPreset);
  cameraPresetRef.current = cameraPreset;

  frameRef.current = frame;
  overlaysRef.current = overlays;
  terrainRef.current = terrain;

  const [webglReady, setWebglReady] = useState(true);
  const [showViewOptions, setShowViewOptions] = useState(false);
  const [cursorCoords, setCursorCoords] = useState<[number, number, number]>([0, 0, 0]);

  // Spherical camera control state
  const camState = useRef({
    radius: previewVariant === 'preview_b' ? 1.45 : 2.8,
    theta: previewVariant === 'preview_b' ? -1.57 : -0.78,
    phi: previewVariant === 'preview_b' ? 1.25 : 1.05,
    target: new THREE.Vector3(0, 0, 0.28),
    isDragging: false,
    lastX: 0,
    lastY: 0,
  });

  const sceneObjectsRef = useRef<{
    scene: THREE.Scene;
    dirLight: THREE.DirectionalLight;
    hemiLight: THREE.HemisphereLight;
    pointLight: THREE.PointLight;
    terrainMesh: THREE.Mesh;
    obstaclesGroup: THREE.Group;
  } | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'default',
        failIfMajorPerformanceCaveat: false,
      });
      if (!renderer.getContext()) {
        throw new Error('WebGL context unavailable');
      }
    } catch {
      setWebglReady(false);
      return;
    }

    const initW = Math.max(container.clientWidth, 10);
    const initH = Math.max(container.clientHeight, 10);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(initW, initH, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglReady(false);
    };
    const handleContextRestored = () => {
      setWebglReady(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

    const scene = new THREE.Scene();
    // High-contrast light laboratory simulation environment
    scene.background = new THREE.Color('#E2E8F0');
    scene.fog = new THREE.FogExp2('#E2E8F0', 0.025);

    const camera = new THREE.PerspectiveCamera(
      46,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.05,
      80
    );
    camera.up.set(0, 0, 1);

    // Studio & Arena Lighting
    const hemiLight = new THREE.HemisphereLight('#FFFFFF', '#CBD5E1', 0.95);
    hemiLight.position.set(0, 0, 15);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight('#FFFFFF', 1.35);
    dirLight.position.set(6.0, -8.0, 12.0);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 30;
    const d = 14;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    const pointLight = new THREE.PointLight('#38BDF8', 0.4, 20);
    pointLight.position.set(0, 0, 6.0);
    scene.add(pointLight);

    // Light High-Contrast Laboratory Floor & Test Track (28m x 18m)
    const floorGeo = new THREE.PlaneGeometry(36, 24, 72, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      color: '#F8FAFC', // Crisp light laboratory pearl floor
      roughness: 0.28,
      metalness: 0.12,
    });
    const terrainMesh = new THREE.Mesh(floorGeo, floorMat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    // Metric Grid Overlay (High-contrast slate grid on light floor)
    const gridHelper = new THREE.GridHelper(36, 36, '#94A3B8', '#CBD5E1');
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.z = 0.0015;
    scene.add(gridHelper);

    // Runway Centerline & Track Lanes
    const runwayGroup = new THREE.Group();
    const trackWidth = 4.2;
    const trackLength = 32;
    const laneMat = new THREE.MeshBasicMaterial({
      color: '#0284C7',
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    });
    const laneMesh = new THREE.Mesh(new THREE.PlaneGeometry(trackLength, trackWidth), laneMat);
    laneMesh.position.set(trackLength / 2 - 4, 0, 0.002);
    runwayGroup.add(laneMesh);

    // Start Line Pad (0m origin)
    const startPadMat = new THREE.MeshBasicMaterial({ color: '#10B981', side: THREE.DoubleSide });
    const startPad = new THREE.Mesh(new THREE.PlaneGeometry(0.35, trackWidth), startPadMat);
    startPad.position.set(0, 0, 0.003);
    runwayGroup.add(startPad);

    // Start Line Marker Pillars
    const pillarGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 16);
    const pillarMat = new THREE.MeshStandardMaterial({ color: '#10B981', roughness: 0.3 });
    const pillarLeft = new THREE.Mesh(pillarGeo, pillarMat);
    pillarLeft.rotation.x = Math.PI / 2;
    pillarLeft.position.set(0, trackWidth / 2, 0.3);
    const pillarRight = new THREE.Mesh(pillarGeo, pillarMat);
    pillarRight.rotation.x = Math.PI / 2;
    pillarRight.position.set(0, -trackWidth / 2, 0.3);
    runwayGroup.add(pillarLeft, pillarRight);

    scene.add(runwayGroup);

    // Light Outer Boundary Barrier Walls (PRD: "make the floor and outer boundary light")
    const boundaryGroup = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({
      color: '#E2E8F0', // Clean light boundary walls
      roughness: 0.35,
      metalness: 0.25,
    });
    const railMat = new THREE.MeshStandardMaterial({
      color: '#0284C7', // Light cyan boundary cap rail
      roughness: 0.2,
      metalness: 0.6,
      emissive: '#0284C7',
      emissiveIntensity: 0.25,
    });

    const createBoundaryWall = (w: number, l: number, h: number, x: number, y: number) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, l, h), wallMat);
      wall.position.set(x, y, h / 2);
      wall.castShadow = true;
      wall.receiveShadow = true;
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, l + 0.04, 0.06), railMat);
      rail.position.set(x, y, h + 0.03);
      boundaryGroup.add(wall, rail);
    };

    createBoundaryWall(36, 0.25, 0.65, 6, 12); // North
    createBoundaryWall(36, 0.25, 0.65, 6, -12); // South
    createBoundaryWall(0.25, 24, 0.65, -12, 0); // West (Behind start)
    createBoundaryWall(0.25, 24, 0.65, 24, 0); // East (Far finish)

    scene.add(boundaryGroup);

    // Obstacles Group
    const obstaclesGroup = new THREE.Group();
    scene.add(obstaclesGroup);

    // Dark Robot Group (High-contrast against light floor)
    const robotGroup = new THREE.Group();
    scene.add(robotGroup);

    const darkChassisMat = new THREE.MeshStandardMaterial({
      color: '#0F172A', // Deep obsidian dark chassis
      roughness: 0.32,
      metalness: 0.75,
    });
    const darkAccentMat = new THREE.MeshStandardMaterial({
      color: '#06B6D4',
      roughness: 0.2,
      metalness: 0.6,
      emissive: '#06B6D4',
      emissiveIntensity: 0.35,
    });
    const darkLimbMat = new THREE.MeshStandardMaterial({
      color: '#1E293B', // Dark carbon fiber limbs
      roughness: 0.45,
      metalness: 0.65,
    });
    const darkJointMat = new THREE.MeshStandardMaterial({
      color: '#334155', // Titanium joint actuators
      roughness: 0.3,
      metalness: 0.85,
    });
    const darkFootMat = new THREE.MeshStandardMaterial({
      color: '#090D16', // High-grip rubberized footpad
      roughness: 0.95,
      metalness: 0.05,
    });

    const trunkGroup = new THREE.Group();
    const mainChassis = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.19, 0.114), darkChassisMat);
    mainChassis.castShadow = true;
    mainChassis.receiveShadow = true;
    trunkGroup.add(mainChassis);

    // Top LiDAR Dome on trunk
    const lidarDome = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.042, 0.045, 20),
      darkJointMat
    );
    lidarDome.rotation.x = Math.PI / 2;
    lidarDome.position.set(0.11, 0, 0.075);
    trunkGroup.add(lidarDome);

    const lidarRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.039, 0.039, 0.012, 20),
      darkAccentMat
    );
    lidarRing.rotation.x = Math.PI / 2;
    lidarRing.position.set(0.11, 0, 0.078);
    trunkGroup.add(lidarRing);

    // Upper Torso for Cassie/Atlas
    const upperTorso = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.28, 0.36),
      darkChassisMat
    );
    upperTorso.position.set(0, 0, 0.22);
    upperTorso.castShadow = true;
    upperTorso.visible = false;
    trunkGroup.add(upperTorso);

    // IMU Triad on trunk
    const imuTriadGroup = new THREE.Group();
    const axisLen = 0.16;
    const xAxis = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 0.07),
      axisLen,
      0xef4444,
      0.035,
      0.02
    );
    const yAxis = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 0.07),
      axisLen,
      0x10b981,
      0.035,
      0.02
    );
    const zAxis = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, 0.07),
      axisLen,
      0x0284c7,
      0.035,
      0.02
    );
    imuTriadGroup.add(xAxis, yAxis, zAxis);
    trunkGroup.add(imuTriadGroup);

    // Camera Sensor Frustum
    const frustumPts = [
      new THREE.Vector3(0.19, 0, 0.02),
      new THREE.Vector3(0.55, 0.22, 0.16),
      new THREE.Vector3(0.19, 0, 0.02),
      new THREE.Vector3(0.55, -0.22, 0.16),
      new THREE.Vector3(0.19, 0, 0.02),
      new THREE.Vector3(0.55, 0.22, -0.14),
      new THREE.Vector3(0.19, 0, 0.02),
      new THREE.Vector3(0.55, -0.22, -0.14),
      new THREE.Vector3(0.55, 0.22, 0.16),
      new THREE.Vector3(0.55, -0.22, 0.16),
      new THREE.Vector3(0.55, -0.22, 0.16),
      new THREE.Vector3(0.55, -0.22, -0.14),
      new THREE.Vector3(0.55, -0.22, -0.14),
      new THREE.Vector3(0.55, 0.22, -0.14),
      new THREE.Vector3(0.55, 0.22, -0.14),
      new THREE.Vector3(0.55, 0.22, 0.16),
    ];
    const sensorFrustumLines = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(frustumPts),
      new THREE.LineBasicMaterial({ color: '#D97706', transparent: true, opacity: 0.85 })
    );
    trunkGroup.add(sensorFrustumLines);

    robotGroup.add(trunkGroup);

    // 4 Articulated Dark Legs Meshes
    const legKeys = ['FL', 'FR', 'RL', 'RR'];
    const legVisuals: Record<
      string,
      {
        hipMesh: THREE.Mesh;
        haaMotorMesh: THREE.Mesh;
        hipAbductMesh: THREE.Mesh;
        hfeMotorMesh: THREE.Mesh;
        thighMesh: THREE.Mesh;
        kneeMesh: THREE.Mesh;
        kneeMotorMesh: THREE.Mesh;
        calfMesh: THREE.Mesh;
        footMesh: THREE.Mesh;
        stanceDisc: THREE.Mesh;
        forceArrow: THREE.ArrowHelper;
        frictionCone: THREE.Mesh;
        swingLine: THREE.Line;
      }
    > = {};

    const unitCylGeo = new THREE.CylinderGeometry(1, 0.88, 1, 14);
    const actuatorCylGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.065, 16);
    const sphereGeo = new THREE.SphereGeometry(1, 14, 14);
    const discGeo = new THREE.CircleGeometry(0.04, 20);
    const coneGeo = new THREE.ConeGeometry(0.065, 0.12, 14, 1, true);

    for (const key of legKeys) {
      // 1. HAA Roll Joint cap & Actuator (Roll axis along robot X)
      const hipMesh = new THREE.Mesh(sphereGeo, darkJointMat);
      hipMesh.scale.setScalar(0.032);
      hipMesh.castShadow = true;

      const haaMotorMesh = new THREE.Mesh(actuatorCylGeo, darkAccentMat);
      haaMotorMesh.rotation.z = Math.PI / 2; // Aligned along X (Roll)
      haaMotorMesh.castShadow = true;

      // Lateral Hip Abduction Link connecting HAA to HFE along Y
      const hipAbductMesh = new THREE.Mesh(unitCylGeo, darkJointMat);
      hipAbductMesh.castShadow = true;

      // 2. HFE Pitch Actuator (Aligned along Y)
      const hfeMotorMesh = new THREE.Mesh(actuatorCylGeo, darkAccentMat);
      hfeMotorMesh.rotation.x = Math.PI / 2; // Aligned along Y (Pitch)
      hfeMotorMesh.castShadow = true;

      // 2. Thigh Link (Upper Leg Rod from HFE to Knee)
      const thighMesh = new THREE.Mesh(unitCylGeo, darkLimbMat);
      thighMesh.castShadow = true;

      // 3. Knee Joint cap & KFE Pitch Actuator
      const kneeMesh = new THREE.Mesh(sphereGeo, darkJointMat);
      kneeMesh.scale.setScalar(0.024);
      kneeMesh.castShadow = true;

      const kneeMotorMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.028, 0.055, 14),
        darkAccentMat
      );
      kneeMotorMesh.rotation.x = Math.PI / 2; // Aligned along Y (Pitch)
      kneeMotorMesh.castShadow = true;

      // 3. Calf Link (Lower Shank Rod from Knee to Foot)
      const calfMesh = new THREE.Mesh(unitCylGeo, darkLimbMat);
      calfMesh.castShadow = true;

      // 4. Distal Tip Spherical Compliant Rubber Foot
      const footMesh = new THREE.Mesh(sphereGeo, darkFootMat);
      footMesh.scale.setScalar(0.022);
      footMesh.castShadow = true;

      const stanceDisc = new THREE.Mesh(
        discGeo,
        new THREE.MeshBasicMaterial({
          color: '#10B981',
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide,
        })
      );

      const forceArrow = new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, 0),
        0.2,
        0x10b981,
        0.04,
        0.024
      );

      const frictionCone = new THREE.Mesh(
        coneGeo,
        new THREE.MeshBasicMaterial({
          color: '#0284C7',
          wireframe: true,
          transparent: true,
          opacity: 0.45,
        })
      );
      frictionCone.rotation.x = -Math.PI / 2;

      const swingPts = Array.from({ length: 12 }, () => new THREE.Vector3());
      const swingLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(swingPts),
        new THREE.LineBasicMaterial({ color: '#0284C7', transparent: true, opacity: 0.85 })
      );

      scene.add(
        hipMesh,
        haaMotorMesh,
        hipAbductMesh,
        hfeMotorMesh,
        thighMesh,
        kneeMesh,
        kneeMotorMesh,
        calfMesh,
        footMesh,
        stanceDisc,
        forceArrow,
        frictionCone,
        swingLine
      );

      legVisuals[key] = {
        hipMesh,
        haaMotorMesh,
        hipAbductMesh,
        hfeMotorMesh,
        thighMesh,
        kneeMesh,
        kneeMotorMesh,
        calfMesh,
        footMesh,
        stanceDisc,
        forceArrow,
        frictionCone,
        swingLine,
      };
    }

    // World Trajectory Ribbon Line (Complete displacement across the floor!)
    const worldTrajectoryLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: '#0284C7', linewidth: 2, transparent: true, opacity: 0.95 })
    );
    scene.add(worldTrajectoryLine);

    // ZMP Marker (Red) & Reference (Cyan) & CoM Marker (Blue)
    const zmpMarkerMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 16, 16),
      new THREE.MeshBasicMaterial({ color: '#EF4444' })
    );
    scene.add(zmpMarkerMesh);

    const zmpRefMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.024, 0.034, 24),
      new THREE.MeshBasicMaterial({ color: '#06B6D4', side: THREE.DoubleSide })
    );
    scene.add(zmpRefMesh);

    const zmpPreviewLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: '#22D3EE', transparent: true, opacity: 0.85 })
    );
    scene.add(zmpPreviewLine);

    const comMarkerMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.024, 16, 16),
      new THREE.MeshBasicMaterial({ color: '#2563EB' })
    );
    scene.add(comMarkerMesh);

    // Support Polygon Convex Hull on Ground
    const supportPolyGeo = new THREE.BufferGeometry();
    const supportPolyMat = new THREE.MeshBasicMaterial({
      color: '#10B981',
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
    });
    const supportPolyMesh = new THREE.Mesh(supportPolyGeo, supportPolyMat);
    scene.add(supportPolyMesh);

    const supportPolyOutline = new THREE.LineLoop(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: '#10B981', transparent: true, opacity: 0.9 })
    );
    scene.add(supportPolyOutline);

    // LiDAR Point Cloud
    const lidarMaxPts = 200;
    const lidarPositions = new Float32Array(lidarMaxPts * 3);
    const lidarColors = new Float32Array(lidarMaxPts * 3);
    const lidarGeo = new THREE.BufferGeometry();
    lidarGeo.setAttribute('position', new THREE.BufferAttribute(lidarPositions, 3));
    lidarGeo.setAttribute('color', new THREE.BufferAttribute(lidarColors, 3));
    const lidarPointsMesh = new THREE.Points(
      lidarGeo,
      new THREE.PointsMaterial({ size: 0.035, vertexColors: true, transparent: true, opacity: 0.85 })
    );
    scene.add(lidarPointsMesh);

    sceneObjectsRef.current = {
      scene,
      dirLight,
      hemiLight,
      pointLight,
      terrainMesh,
      obstaclesGroup,
    };

    const alignCylinder = (
      mesh: THREE.Mesh,
      pA: [number, number, number],
      pB: [number, number, number],
      radius: number
    ) => {
      const vA = new THREE.Vector3(...pA);
      const vB = new THREE.Vector3(...pB);
      const dir = new THREE.Vector3().subVectors(vB, vA);
      const len = dir.length();
      mesh.position.copy(vA).addScaledVector(dir, 0.5);
      mesh.scale.set(radius, Math.max(0.01, len), radius);
      if (len > 1e-4) {
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      }
    };

    // Pointer Drag / Orbit Controls
    const raycaster = new THREE.Raycaster();
    const groundPlaneMath = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

    const onPointerDown = (e: PointerEvent) => {
      camState.current.isDragging = true;
      camState.current.lastX = e.clientX;
      camState.current.lastY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const hit = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(groundPlaneMath, hit)) {
        const hz = getTerrainHeight(hit.x, hit.y, terrainRef.current);
        setCursorCoords([
          Number(hit.x.toFixed(2)),
          Number(hit.y.toFixed(2)),
          Number(hz.toFixed(2)),
        ]);
      }

      if (!camState.current.isDragging) return;
      const dx = e.clientX - camState.current.lastX;
      const dy = e.clientY - camState.current.lastY;
      camState.current.lastX = e.clientX;
      camState.current.lastY = e.clientY;

      camState.current.theta -= dx * 0.0075;
      camState.current.phi = Math.max(
        0.15,
        Math.min(Math.PI / 2 - 0.03, camState.current.phi - dy * 0.0065)
      );
    };

    const onPointerUp = () => {
      camState.current.isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camState.current.radius = Math.max(
        0.65,
        Math.min(14.0, camState.current.radius + e.deltaY * 0.002)
      );
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    domElem.addEventListener('wheel', onWheel, { passive: false });

    const handleResize = () => {
      if (!container) return;
      const w = Math.max(container.clientWidth, 10);
      const h = Math.max(container.clientHeight, 10);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(container);
    }
    window.addEventListener('resize', handleResize);

    // Render loop
    let animId = 0;
    const renderLoop = () => {
      animId = requestAnimationFrame(renderLoop);
      const curFrame = frameRef.current;
      const curOverlays = overlaysRef.current;
      const preset = cameraPresetRef.current;
      const robotSpec = REFERENCE_ROBOTS[curFrame.robotId] || REFERENCE_ROBOTS.unitree_a1;

      // Dark chassis finish & accents
      darkAccentMat.color.set(robotSpec.accentColor);
      darkAccentMat.emissive.set(robotSpec.accentColor);
      darkChassisMat.color.set(robotSpec.chassisColor);

      upperTorso.visible = robotSpec.morphology !== 'quadruped';
      if (robotSpec.morphology === 'biped') {
        mainChassis.scale.set(0.55, 0.85, 1.2);
      } else if (robotSpec.morphology === 'humanoid') {
        mainChassis.scale.set(0.65, 1.1, 1.3);
      } else {
        mainChassis.scale.set(1, 1, 1);
      }

      // Position and orient dark trunk
      const [bx, by, bz] = curFrame.basePose.position;
      const [qx, qy, qz, qw] = curFrame.basePose.quaternion;
      trunkGroup.position.set(bx, by, bz);
      trunkGroup.quaternion.set(qx, qy, qz, qw);

      imuTriadGroup.visible = curOverlays.imuTriad;
      sensorFrustumLines.visible = curOverlays.sensorFrustum;

      // Update Legs
      for (const key of legKeys) {
        const legData = curFrame.legs[key];
        const vis = legVisuals[key];
        if (!legData) {
          vis.hipMesh.visible = false;
          vis.haaMotorMesh.visible = false;
          vis.hipAbductMesh.visible = false;
          vis.hfeMotorMesh.visible = false;
          vis.thighMesh.visible = false;
          vis.kneeMesh.visible = false;
          vis.kneeMotorMesh.visible = false;
          vis.calfMesh.visible = false;
          vis.footMesh.visible = false;
          vis.stanceDisc.visible = false;
          vis.forceArrow.visible = false;
          vis.frictionCone.visible = false;
          vis.swingLine.visible = false;
          continue;
        }

        const hfePos: [number, number, number] = legData.hfeWorld || [
          legData.hipWorld[0],
          legData.hipWorld[1] + (key.includes('L') ? 0.08 : -0.08),
          legData.hipWorld[2],
        ];

        vis.hipMesh.visible = true;
        vis.haaMotorMesh.visible = true;
        vis.hipAbductMesh.visible = true;
        vis.hfeMotorMesh.visible = true;
        vis.thighMesh.visible = true;
        vis.kneeMesh.visible = true;
        vis.kneeMotorMesh.visible = true;
        vis.calfMesh.visible = true;
        vis.footMesh.visible = true;

        vis.hipMesh.position.set(...legData.hipWorld);
        vis.haaMotorMesh.position.set(...legData.hipWorld);
        vis.hfeMotorMesh.position.set(...hfePos);
        vis.kneeMesh.position.set(...legData.kneeWorld);
        vis.kneeMotorMesh.position.set(...legData.kneeWorld);
        vis.footMesh.position.set(...legData.footWorld);

        alignCylinder(vis.hipAbductMesh, legData.hipWorld, hfePos, 0.024);
        alignCylinder(vis.thighMesh, hfePos, legData.kneeWorld, 0.022);
        alignCylinder(vis.calfMesh, legData.kneeWorld, legData.footWorld, 0.015);

        vis.stanceDisc.visible = curOverlays.stanceDiscs && legData.isStance;
        vis.stanceDisc.position.set(
          legData.footWorld[0],
          legData.footWorld[1],
          legData.footWorld[2] + 0.002
        );

        const fn = legData.contactForce.fn;
        vis.forceArrow.visible = curOverlays.contactForces && legData.isStance && fn > 1;
        if (vis.forceArrow.visible) {
          vis.forceArrow.position.set(...legData.footWorld);
          const fVec = new THREE.Vector3(
            legData.contactForce.fx,
            legData.contactForce.fy,
            legData.contactForce.fn
          );
          const fLen = Math.min(0.42, Math.max(0.08, fVec.length() * 0.0038));
          vis.forceArrow.setDirection(fVec.normalize());
          vis.forceArrow.setLength(fLen, 0.042, 0.024);
          const ratio = Math.min(1, legData.contactForce.frictionRatio);
          const arrowColor = new THREE.Color().setHSL((1 - ratio) * 0.33, 0.9, 0.45);
          vis.forceArrow.setColor(arrowColor);
        }

        vis.frictionCone.visible = curOverlays.frictionCones && legData.isStance;
        vis.frictionCone.position.set(
          legData.footWorld[0],
          legData.footWorld[1],
          legData.footWorld[2] + 0.06
        );

        vis.swingLine.visible = curOverlays.swingTrails && !legData.isStance;
        if (vis.swingLine.visible && legData.swingTrajectory.length > 1) {
          const pts = legData.swingTrajectory.map(([sx, sy, sz]) => new THREE.Vector3(sx, sy, sz));
          vis.swingLine.geometry.setFromPoints(pts);
        }
      }

      // Complete Persistent World Trajectory Ribbon across the floor
      if (curOverlays.worldTrajectory && curFrame.worldTrajectory.length > 1) {
        worldTrajectoryLine.visible = true;
        const pts = curFrame.worldTrajectory.map(
          ([tx, ty, tz]) => new THREE.Vector3(tx, ty, tz - 0.22)
        );
        worldTrajectoryLine.geometry.setFromPoints(pts);
      } else {
        worldTrajectoryLine.visible = false;
      }

      // ZMP & CoM markers
      const groundAtZmp = getTerrainHeight(
        curFrame.zmpActual[0],
        curFrame.zmpActual[1],
        terrainRef.current
      );
      zmpMarkerMesh.visible = curOverlays.zmpMarker;
      zmpMarkerMesh.position.set(
        curFrame.zmpActual[0],
        curFrame.zmpActual[1],
        groundAtZmp + 0.015
      );

      zmpRefMesh.visible = curOverlays.zmpMarker;
      zmpRefMesh.position.set(curFrame.zmpRef[0], curFrame.zmpRef[1], groundAtZmp + 0.004);

      // Kajita Preview Horizon line in 3D
      if (curOverlays.zmpMarker && curFrame.zmpPreviewHorizon?.length > 1) {
        zmpPreviewLine.visible = true;
        const prevPts = curFrame.zmpPreviewHorizon.map(([px, py]) => {
          const pz = getTerrainHeight(px, py, terrainRef.current) + 0.006;
          return new THREE.Vector3(px, py, pz);
        });
        zmpPreviewLine.geometry.setFromPoints(prevPts);
      } else {
        zmpPreviewLine.visible = false;
      }

      comMarkerMesh.visible = curOverlays.comTrail || curOverlays.zmpMarker;
      comMarkerMesh.position.set(...curFrame.com);

      // Color coding based on ZMP safety
      const isZmpInside = curFrame.zmpDiagnostics?.isInsidePolygon ?? (curFrame.stabilityMarginM > 0);
      const isZmpSafe = isZmpInside && (curFrame.zmpDiagnostics?.signedMarginM ?? 0.04) > 0.025;
      (zmpMarkerMesh.material as THREE.MeshBasicMaterial).color.set(
        !isZmpInside ? '#EF4444' : isZmpSafe ? '#EAB308' : '#F59E0B'
      );

      // Support Polygon
      supportPolyMesh.visible = curOverlays.supportPolygon && curFrame.supportPolygon.length >= 3;
      supportPolyOutline.visible = supportPolyMesh.visible;
      if (supportPolyMesh.visible) {
        const poly = curFrame.supportPolygon;
        const vertices: number[] = [];
        const outlinePts: THREE.Vector3[] = [];
        for (const [px, py] of poly) {
          const pz = getTerrainHeight(px, py, terrainRef.current) + 0.003;
          outlinePts.push(new THREE.Vector3(px, py, pz));
        }
        for (let i = 1; i < outlinePts.length - 1; i++) {
          vertices.push(
            outlinePts[0].x,
            outlinePts[0].y,
            outlinePts[0].z,
            outlinePts[i].x,
            outlinePts[i].y,
            outlinePts[i].z,
            outlinePts[i + 1].x,
            outlinePts[i + 1].y,
            outlinePts[i + 1].z
          );
        }
        supportPolyMesh.geometry.setAttribute(
          'position',
          new THREE.Float32BufferAttribute(vertices, 3)
        );
        supportPolyOutline.geometry.setFromPoints(outlinePts);

        const polyColor = !isZmpInside ? '#EF4444' : isZmpSafe ? '#10B981' : '#F59E0B';
        supportPolyMat.color.set(polyColor);
        (supportPolyOutline.material as THREE.LineBasicMaterial).color.set(polyColor);
      }

      // LiDAR Point Cloud
      lidarPointsMesh.visible = curOverlays.lidarCloud;
      if (curOverlays.lidarCloud) {
        const pts = curFrame.lidarPoints;
        const posAttr = lidarGeo.getAttribute('position') as THREE.BufferAttribute;
        const colAttr = lidarGeo.getAttribute('color') as THREE.BufferAttribute;
        const count = Math.min(lidarMaxPts, pts.length);
        for (let i = 0; i < count; i++) {
          posAttr.setXYZ(i, pts[i].x, pts[i].y, pts[i].z + 0.015);
          const inten = pts[i].intensity;
          colAttr.setXYZ(i, 0.05 + inten * 0.9, 0.45, 0.85);
        }
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
        lidarGeo.setDrawRange(0, count);
      }

      // Camera Choreography per Preset
      if (preset === 'chase_cam') {
        // Tight Chase Cam: behind robot heading, smoothly interpolating
        const yaw = curFrame.basePose.rpy[2];
        const camDistance = 1.35;
        const camHeight = 0.65;
        const targetCamPos = new THREE.Vector3(
          bx - Math.cos(yaw) * camDistance,
          by - Math.sin(yaw) * camDistance,
          bz + camHeight
        );
        camera.position.lerp(targetCamPos, 0.14);
        camState.current.target.lerp(new THREE.Vector3(bx, by, bz), 0.18);
        camera.lookAt(camState.current.target);
      } else if (preset === 'top_down') {
        // Overhead Ortho-like top-down ZMP stability plane
        camState.current.target.lerp(new THREE.Vector3(bx, by, 0), 0.15);
        camera.position.set(camState.current.target.x, camState.current.target.y, 4.2);
        camera.lookAt(camState.current.target);
      } else if (preset === 'fixed_world') {
        // Static Observer Podium at [ -2, -3.5, 2.5 ]: watch robot walk across real world space!
        camera.position.set(-2.0, -3.8, 2.6);
        camera.lookAt(new THREE.Vector3(bx, by, bz));
      } else {
        // Follow-Orbit: spherical controls tracking the robot's real position
        camState.current.target.lerp(new THREE.Vector3(bx, by, bz * 0.85), 0.12);
        const { radius, theta, phi, target } = camState.current;
        const camX = target.x + radius * Math.sin(phi) * Math.cos(theta);
        const camY = target.y + radius * Math.sin(phi) * Math.sin(theta);
        const camZ = target.z + radius * Math.cos(phi);
        camera.position.set(camX, camY, camZ);
        camera.lookAt(target);
      }

      try {
        renderer.render(scene, camera);
      } catch (err) {
        console.warn('[LRSP Viewport3D] Frame render warning:', err);
      }
    };

    animId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animId);
      if (resizeObserver) resizeObserver.disconnect();
      domElem.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      domElem.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  // Update Lighting
  useEffect(() => {
    const refs = sceneObjectsRef.current;
    if (!refs) return;
    const { scene, dirLight, hemiLight, pointLight } = refs;

    if (lighting === 'indoor_lab') {
      scene.background = new THREE.Color('#E2E8F0');
      scene.fog = new THREE.FogExp2('#E2E8F0', 0.025);
      dirLight.intensity = 1.35;
      dirLight.color.set('#FFFFFF');
      hemiLight.color.set('#FFFFFF');
      hemiLight.groundColor.set('#CBD5E1');
      hemiLight.intensity = 0.95;
      pointLight.intensity = 0.4;
    } else if (lighting === 'outdoor_sunny') {
      scene.background = new THREE.Color('#E0F2FE');
      scene.fog = new THREE.FogExp2('#E0F2FE', 0.018);
      dirLight.intensity = 1.85;
      dirLight.color.set('#FEF08A');
      hemiLight.color.set('#E0F2FE');
      hemiLight.groundColor.set('#BBF7D0');
      hemiLight.intensity = 1.1;
      pointLight.intensity = 0.15;
    } else if (lighting === 'night') {
      scene.background = new THREE.Color('#1E293B');
      scene.fog = new THREE.FogExp2('#1E293B', 0.05);
      dirLight.intensity = 0.45;
      dirLight.color.set('#93C5FD');
      hemiLight.color.set('#334155');
      hemiLight.groundColor.set('#0F172A');
      hemiLight.intensity = 0.5;
      pointLight.intensity = 1.4;
    } else if (lighting === 'warehouse') {
      scene.background = new THREE.Color('#CBD5E1');
      scene.fog = new THREE.FogExp2('#CBD5E1', 0.03);
      dirLight.intensity = 0.95;
      dirLight.color.set('#F8FAFC');
      hemiLight.color.set('#E2E8F0');
      hemiLight.groundColor.set('#94A3B8');
      hemiLight.intensity = 0.8;
      pointLight.intensity = 0.85;
    }
  }, [lighting]);

  // Update Terrain
  useEffect(() => {
    const refs = sceneObjectsRef.current;
    if (!refs) return;
    const { terrainMesh, obstaclesGroup } = refs;
    const posAttr = terrainMesh.geometry.getAttribute('position') as THREE.BufferAttribute;

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const vz = getTerrainHeight(vx, vy, terrain);
      posAttr.setZ(i, vz);
    }
    posAttr.needsUpdate = true;
    terrainMesh.geometry.computeVertexNormals();

    obstaclesGroup.clear();
    if (terrain === 'stepped_obstacles') {
      const stepMat = new THREE.MeshStandardMaterial({
        color: '#CBD5E1',
        roughness: 0.5,
        metalness: 0.3,
      });
      const cylObs = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 0.055, 24),
        stepMat
      );
      cylObs.rotation.x = Math.PI / 2;
      cylObs.position.set(3.0, 0, 0.0275);
      obstaclesGroup.add(cylObs);

      const box1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.075), stepMat);
      box1.position.set(5.5, 0, 0.0375);
      obstaclesGroup.add(box1);

      const box2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.06), stepMat);
      box2.position.set(8.5, 0, 0.03);
      obstaclesGroup.add(box2);
    }
  }, [terrain]);

  const overlayButtons: { key: keyof OverlayVisibility; label: string }[] = [
    { key: 'worldTrajectory', label: 'Displacement Path' },
    { key: 'zmpMarker', label: 'ZMP & Ref' },
    { key: 'supportPolygon', label: 'Support Hull' },
    { key: 'contactForces', label: 'Force Vectors' },
    { key: 'frictionCones', label: 'Friction Cones' },
    { key: 'swingTrails', label: 'Swing Splines' },
    { key: 'imuTriad', label: 'IMU Triad' },
    { key: 'sensorFrustum', label: 'Cam Frustum' },
    { key: 'lidarCloud', label: 'LiDAR Cloud' },
  ];

  return (
    <div className="relative w-full h-full flex flex-col bg-[#E2E8F0] overflow-hidden select-none">
      {/* Docked Technical Top Toolbar */}
      <div className="w-full px-3 py-1.5 bg-white border-b border-slate-200 flex items-center justify-between gap-2 text-xs font-mono shrink-0 shadow-2xs z-20 overflow-x-auto">
        {/* Left: Identity, Position, Metrics & Quick Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          {portionLabel && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-slate-700 border border-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
              {portionLabel}
            </span>
          )}

          {title && (
            <span className="font-semibold text-slate-800 text-[11px] truncate max-w-[170px]">
              {title}
            </span>
          )}

          <div className="flex items-center gap-2 text-slate-600 text-[11px]">
            <span>Travel: <strong className="text-emerald-700 font-bold">{frame.odometerM.toFixed(2)}m</strong></span>
            <span className="text-slate-300">·</span>
            <span>Origin Δ: <strong className="text-sky-700 font-bold">{frame.displacementM.toFixed(2)}m</strong></span>
            <span className="text-slate-300 hidden md:inline">·</span>
            <span className="hidden md:inline">Speed: <strong className="text-slate-800 font-bold">{frame.speedMps.toFixed(2)}m/s</strong></span>
          </div>

          <div className="flex items-center gap-1 ml-1">
            <button
              type="button"
              onClick={onResetPosition}
              className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200 hover:text-slate-900 transition-colors shadow-2xs font-medium cursor-pointer text-[11px]"
              title="Reset robot position to [0, 0] start pad"
            >
              Reset (0,0)
            </button>
            <button
              type="button"
              onClick={() => onApplyPush(65, 30)}
              className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 transition-colors shadow-2xs font-medium cursor-pointer text-[11px]"
              title="Apply 65 N lateral perturbation"
            >
              Push 65N
            </button>
          </div>
        </div>

        {/* Right: Stance Indicator, Camera Selector, Overlays Dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Compact Stance Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-[11px]">
            <span className="text-slate-400">Stance:</span>
            <span className="text-sky-700 font-semibold">{frame.fsmStateLabel}</span>
            <div className="flex items-center gap-0.5 ml-1">
              {Object.values(frame.legs).map((leg) => (
                <span
                  key={leg.legId}
                  className={`px-1 py-0.2 rounded text-[9px] font-mono ${
                    leg.isStance ? 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-300' : 'text-slate-400 bg-slate-100'
                  }`}
                >
                  {leg.legId}
                </span>
              ))}
            </div>
          </div>

          {/* Camera Mode Segmented Switcher */}
          <div className="hidden sm:flex items-center gap-0.5 p-0.5 bg-slate-100 rounded border border-slate-200 text-[11px]">
            {(
              [
                { id: 'follow_orbit', label: 'Orbit' },
                { id: 'chase_cam', label: 'Chase' },
                { id: 'fixed_world', label: 'Fixed' },
                { id: 'top_down', label: 'Top' },
              ] as { id: CameraPreset; label: string }[]
            ).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCameraPreset(c.id)}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors whitespace-nowrap cursor-pointer ${
                  cameraPreset === c.id
                    ? 'bg-sky-600 text-white font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* View Options Toggle & Dropdown Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowViewOptions((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono border transition-all cursor-pointer ${
                showViewOptions
                  ? 'bg-sky-600 text-white border-sky-700 font-semibold'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-slate-950'
              }`}
              title="Camera & Visual Overlay Options"
            >
              <Camera className={`w-3.5 h-3.5 ${showViewOptions ? 'text-white' : 'text-sky-600'}`} />
              <span>Overlays ({Object.values(overlays).filter(Boolean).length})</span>
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showViewOptions ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Popover */}
            {showViewOptions && (
              <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-slate-300 rounded-xl p-3 shadow-2xl text-xs font-mono space-y-2.5 text-slate-800 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider pb-1 border-b border-slate-200">
                  <span>Visual Overlays</span>
                  <span className="text-[10px] text-slate-400 font-normal">Toggle layers</span>
                </div>
                <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                  {overlayButtons.map((item) => {
                    const active = overlays[item.key];
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => onToggleOverlay(item.key)}
                        className={`w-full flex items-center justify-between px-2.5 py-1 rounded-md text-[11px] transition-colors cursor-pointer ${
                          active
                            ? 'bg-sky-50 text-sky-900 border border-sky-300 font-semibold'
                            : 'bg-slate-50 text-slate-600 border border-slate-200 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <span>{item.label}</span>
                        <span className={`w-2 h-2 rounded-full ${active ? 'bg-sky-600' : 'bg-slate-300'}`} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3D Canvas Area: 100% Unblocked & Resizable */}
      <div className="relative flex-1 w-full h-full overflow-hidden cursor-crosshair">
        {webglReady ? (
          <div ref={mountRef} className="w-full h-full" />
        ) : (
          <Tactical2DCanvas frame={frame} overlays={overlays} />
        )}

        {/* Subtle Coordinate Probe Indicator */}
        <div className="absolute bottom-2 right-2 z-10 pointer-events-none text-[10px] font-mono text-slate-600 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded border border-slate-300 shadow-2xs">
          Probe: [{cursorCoords[0].toFixed(2)}, {cursorCoords[1].toFixed(2)}] m
        </div>
      </div>
    </div>
  );
};
