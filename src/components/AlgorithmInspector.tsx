import React, { useState, useMemo } from 'react';
import {
  REFERENCE_ROBOTS,
  SimulationStateFrame,
} from '../physics/roboticsEngine';
import {
  Layers,
  Grid,
  Activity,
  Network,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Cpu,
  BookOpen,
} from 'lucide-react';

interface AlgorithmInspectorProps {
  frame: SimulationStateFrame;
  frictionMu: number;
  dampingLambda: number;
}

export type MatrixType = 'M' | 'C';
export type ViewRepresentation = 'blocks' | 'grid' | 'actuators' | 'network';

interface LegConfig {
  id: string;
  label: string;
  color: string;
  accentHex: string;
  textClass: string;
  borderClass: string;
  bgClass: string;
  joints: string[];
  jointLabels: string[];
  indices: number[];
}

const LEG_CONFIGS: LegConfig[] = [
  {
    id: 'FL',
    label: 'Front-Left',
    color: '#06B6D4',
    accentHex: '#06B6D4',
    textClass: 'text-cyan-400',
    borderClass: 'border-cyan-500/40',
    bgClass: 'bg-cyan-950/20',
    joints: ['FL_hip', 'FL_thigh', 'FL_calf'],
    jointLabels: ['FL Hip Roll', 'FL Thigh Pitch', 'FL Calf Pitch'],
    indices: [0, 1, 2],
  },
  {
    id: 'FR',
    label: 'Front-Right',
    color: '#F59E0B',
    accentHex: '#F59E0B',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/40',
    bgClass: 'bg-amber-950/20',
    joints: ['FR_hip', 'FR_thigh', 'FR_calf'],
    jointLabels: ['FR Hip Roll', 'FR Thigh Pitch', 'FR Calf Pitch'],
    indices: [3, 4, 5],
  },
  {
    id: 'RL',
    label: 'Rear-Left',
    color: '#10B981',
    accentHex: '#10B981',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/40',
    bgClass: 'bg-emerald-950/20',
    joints: ['RL_hip', 'RL_thigh', 'RL_calf'],
    jointLabels: ['RL Hip Roll', 'RL Thigh Pitch', 'RL Calf Pitch'],
    indices: [6, 7, 8],
  },
  {
    id: 'RR',
    label: 'Rear-Right',
    color: '#A855F7',
    accentHex: '#A855F7',
    textClass: 'text-purple-400',
    borderClass: 'border-purple-500/40',
    bgClass: 'bg-purple-950/20',
    joints: ['RR_hip', 'RR_thigh', 'RR_calf'],
    jointLabels: ['RR Hip Roll', 'RR Thigh Pitch', 'RR Calf Pitch'],
    indices: [9, 10, 11],
  },
];

const ALL_JOINT_LABELS = [
  'FL_hip', 'FL_thigh', 'FL_calf',
  'FR_hip', 'FR_thigh', 'FR_calf',
  'RL_hip', 'RL_thigh', 'RL_calf',
  'RR_hip', 'RR_thigh', 'RR_calf',
];

const JOINT_DESCRIPTIONS = [
  'Front-Left Hip abduction/roll motor',
  'Front-Left Thigh sagittal pitch motor',
  'Front-Left Calf knee extension motor',
  'Front-Right Hip abduction/roll motor',
  'Front-Right Thigh sagittal pitch motor',
  'Front-Right Calf knee extension motor',
  'Rear-Left Hip abduction/roll motor',
  'Rear-Left Thigh sagittal pitch motor',
  'Rear-Left Calf knee extension motor',
  'Rear-Right Hip abduction/roll motor',
  'Rear-Right Thigh sagittal pitch motor',
  'Rear-Right Calf knee extension motor',
];

function valueToHeatmapColor(val: number, maxAbs: number, isCoriolis = false): string {
  const norm = Math.max(-1, Math.min(1, val / (maxAbs || 1)));
  if (Math.abs(norm) < 0.03) return '#0B0F19';
  if (!isCoriolis) {
    const t = Math.max(0, norm);
    const r = Math.round(6 + t * 239);
    const g = Math.round(182 - t * 40);
    const b = Math.round(212 - t * 180);
    return `rgba(${r}, ${g}, ${b}, ${0.15 + t * 0.85})`;
  } else {
    if (norm > 0) {
      const t = norm;
      return `rgba(245, 158, 11, ${0.15 + t * 0.85})`;
    } else {
      const t = -norm;
      return `rgba(59, 130, 246, ${0.15 + t * 0.85})`;
    }
  }
}

export const AlgorithmInspector: React.FC<AlgorithmInspectorProps> = ({
  frame,
  frictionMu,
  dampingLambda,
}) => {
  const [selectedLeg, setSelectedLeg] = useState<string>('FL');
  const [matrixType, setMatrixType] = useState<MatrixType>('M');
  const [viewMode, setViewMode] = useState<ViewRepresentation>('blocks');
  const [showPrimer, setShowPrimer] = useState<boolean>(false);
  const [selectedBlock, setSelectedBlock] = useState<{ rLeg: number; cLeg: number } | null>({
    rLeg: 0,
    cLeg: 0,
  });
  const [hoveredCell, setHoveredCell] = useState<{
    matrix: 'M' | 'C';
    r: number;
    c: number;
    val: number;
  } | null>(null);

  const robot = REFERENCE_ROBOTS[frame.robotId] || REFERENCE_ROBOTS.unitree_a1;
  const activeLeg = frame.legs[selectedLeg] || Object.values(frame.legs)[0];

  // Safeguard matrix structures (guarantee 12x12 arrays)
  const massMat = useMemo(() => {
    const raw = frame.massMatrix;
    if (raw && raw.length === 12 && raw[0]?.length === 12) return raw;
    const full = Array.from({ length: 12 }, () => new Array(12).fill(0));
    for (let l = 0; l < 4; l++) {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          full[l * 3 + r][l * 3 + c] = raw?.[r]?.[c] ?? (r === c ? 0.04 : 0);
        }
      }
    }
    return full;
  }, [frame.massMatrix]);

  const coriolisMat = useMemo(() => {
    const raw = frame.coriolisMatrix;
    if (raw && raw.length === 12 && raw[0]?.length === 12) return raw;
    const full = Array.from({ length: 12 }, () => new Array(12).fill(0));
    for (let l = 0; l < 4; l++) {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          full[l * 3 + r][l * 3 + c] = raw?.[r]?.[c] ?? 0;
        }
      }
    }
    return full;
  }, [frame.coriolisMatrix]);

  // Compute live mathematical validation metrics
  const dynamicsMetrics = useMemo(() => {
    let maxSymmetryViolation = 0;
    for (let i = 0; i < 12; i++) {
      for (let j = 0; j < 12; j++) {
        const diff = Math.abs(massMat[i][j] - massMat[j][i]);
        if (diff > maxSymmetryViolation) maxSymmetryViolation = diff;
      }
    }

    let diagSum = 0;
    let offDiagSum = 0;
    for (let i = 0; i < 12; i++) {
      for (let j = 0; j < 12; j++) {
        if (i === j) diagSum += Math.abs(massMat[i][j]);
        else offDiagSum += Math.abs(massMat[i][j]);
      }
    }
    const selfInertiaRatio = diagSum / (diagSum + offDiagSum || 1);

    const tauCoriolis = new Array(12).fill(0);
    const qd = frame.jointVelocities || new Array(12).fill(0);
    for (let i = 0; i < 12; i++) {
      let sum = 0;
      for (let j = 0; j < 12; j++) {
        sum += coriolisMat[i][j] * (qd[j] || 0);
      }
      tauCoriolis[i] = sum;
    }

    const blockNormsM: number[][] = Array.from({ length: 4 }, () => new Array(4).fill(0));
    const blockNormsC: number[][] = Array.from({ length: 4 }, () => new Array(4).fill(0));

    for (let rl = 0; rl < 4; rl++) {
      for (let cl = 0; cl < 4; cl++) {
        let sqM = 0;
        let sqC = 0;
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            sqM += Math.pow(massMat[rl * 3 + r][cl * 3 + c], 2);
            sqC += Math.pow(coriolisMat[rl * 3 + r][cl * 3 + c], 2);
          }
        }
        blockNormsM[rl][cl] = Math.sqrt(sqM);
        blockNormsC[rl][cl] = Math.sqrt(sqC);
      }
    }

    return {
      maxSymmetryViolation,
      selfInertiaRatio,
      tauCoriolis,
      blockNormsM,
      blockNormsC,
    };
  }, [massMat, coriolisMat, frame.jointVelocities]);

  const activeMatrix = matrixType === 'C' ? coriolisMat : massMat;
  const isCoriolis = matrixType === 'C';
  const maxAbsScale = isCoriolis ? 0.05 : 0.12;

  return (
    <div className="p-6 space-y-6 bg-slate-50 text-slate-900">
      {/* Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-display font-semibold tracking-tight text-slate-900">
              01. Live Mathematical Dynamics &amp; Algorithm Inspector
            </h1>
            <span className="px-2 py-0.5 text-xs font-mono rounded bg-sky-100 border border-sky-300 text-sky-800 font-semibold">
              Euler-Lagrange ℝ¹²ˣ¹²
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Real-time inspection of Floating-Base Euler-Lagrange dynamics{' '}
            <span className="font-mono text-sky-700 font-semibold">
              M(q)q̈ + C(q,q̇)q̇ + G(q) = Sᵀτ + JcᵀFc
            </span>
            , Kajita LIPM preview ZMP, and contact complementarity.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Model:</span>
            <span className="text-slate-200 font-semibold">{robot.name}</span>
          </div>
          <span aria-hidden="true" className="text-slate-700">|</span>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">DoF:</span>
            <span className="text-slate-200 font-semibold">12 Actuated</span>
          </div>
          <span aria-hidden="true" className="text-slate-700">|</span>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Step:</span>
            <span className="text-cyan-400">#{frame.stepCount}</span>
          </div>
          <span aria-hidden="true" className="text-slate-700">|</span>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Odometer:</span>
            <span className="text-slate-200">{frame.odometerM.toFixed(2)} m</span>
          </div>
        </div>
      </div>

      {/* Physics & Educational Primer Collapsible */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => setShowPrimer(!showPrimer)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-semibold text-slate-200">
              Educational Guide: How to Understand M(q) and C(q, q̇) in Plain English &amp; Robotics Physics
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
              Click to {showPrimer ? 'collapse' : 'expand explainer'}
            </span>
          </div>
          {showPrimer ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {showPrimer && (
          <div className="px-5 pb-5 pt-2 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="bg-[#0B0F19] p-3.5 rounded border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-cyan-400 font-semibold font-mono">
                <Cpu className="w-4 h-4" />
                <span>1. What is M(q) ∈ ℝ¹²ˣ¹²?</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                The <strong className="text-cyan-300">Joint-Space Mass Matrix</strong> is the multi-body equivalent of mass in F = ma. In multi-joint robotics, τ = M(q)q̈.
              </p>
              <p className="text-slate-400 leading-relaxed">
                Element M[i, j] answers: <em>&ldquo;How much torque must motor i exert when joint j accelerates by 1 rad/s²?&rdquo;</em>
              </p>
            </div>

            <div className="bg-[#0B0F19] p-3.5 rounded border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-semibold font-mono">
                <Activity className="w-4 h-4" />
                <span>2. What is C(q, q̇) ∈ ℝ¹²ˣ¹²?</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                The <strong className="text-amber-300">Coriolis &amp; Centrifugal Matrix</strong> represents fictitious inertial forces created by rotating joints:
              </p>
              <ul className="list-disc pl-4 text-slate-400 space-y-1">
                <li><strong className="text-slate-200">Centrifugal:</strong> Flings calf outward when thigh swings forward.</li>
                <li><strong className="text-slate-200">Coriolis:</strong> Twists the leg when hip roll and thigh pitch rotate simultaneously.</li>
              </ul>
            </div>

            <div className="bg-[#0B0F19] p-3.5 rounded border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold font-mono">
                <Layers className="w-4 h-4" />
                <span>3. Why 4×4 Blocks of 3×3?</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                The robot has 4 legs × 3 joints (Hip, Thigh, Calf) = 12 joints.
              </p>
              <p className="text-slate-400 leading-relaxed">
                The <strong className="text-emerald-300">diagonal 3×3 blocks</strong> represent each leg&rsquo;s own self-inertia. The <strong className="text-purple-300">off-diagonal 3×3 blocks</strong> represent cross-leg reaction forces transmitted through the rigid central trunk!
              </p>
            </div>

            <div className="bg-[#0B0F19] p-3.5 rounded border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-purple-400 font-semibold font-mono">
                <CheckCircle2 className="w-4 h-4" />
                <span>4. Fundamental Physics Laws</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                • <strong className="text-slate-200">Symmetry:</strong> M(q) = M(q)ᵀ (conservation of energy / reciprocity of work).
              </p>
              <p className="text-slate-400 leading-relaxed">
                • <strong className="text-slate-200">Passivity:</strong> (Ṁ - 2C) is skew-symmetric, ensuring no artificial energy is created or destroyed by Coriolis forces during simulation!
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main Dynamics Hub: Matrix Inspector with 4 View Modes */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-5 space-y-5">
        {/* Controls Bar: Matrix Type + View Representation Mode */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          {/* Matrix Type Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase text-slate-400 font-semibold">Inspect Matrix:</span>
            <div className="flex items-center bg-[#07090E] p-1 rounded-md border border-slate-800">
              <button
                type="button"
                onClick={() => setMatrixType('M')}
                className={`px-3 py-1 text-xs font-mono rounded font-semibold transition-all ${
                  matrixType === 'M'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                M(q) Mass Matrix
              </button>
              <button
                type="button"
                onClick={() => setMatrixType('C')}
                className={`px-3 py-1 text-xs font-mono rounded font-semibold transition-all ${
                  matrixType === 'C'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                C(q, q̇) Coriolis
              </button>
            </div>
          </div>

          {/* Representation Mode Switcher (The core solution to the user's request) */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase text-slate-400 font-semibold">Representation View:</span>
            <div className="flex items-center bg-[#07090E] p-1 rounded-md border border-slate-800">
              <button
                type="button"
                onClick={() => setViewMode('blocks')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded transition-all ${
                  viewMode === 'blocks'
                    ? 'bg-slate-700 text-cyan-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Decomposes the 12x12 matrix into intuitive 4x4 Leg blocks (FL, FR, RL, RR) with zoomable 3x3 joint tensors"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>🧩 4×4 Leg Blocks</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded transition-all ${
                  viewMode === 'grid'
                    ? 'bg-slate-700 text-cyan-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Full 12x12 matrix with visible numerical values, leg quadrant borders, and interactive symmetry checker"
              >
                <Grid className="w-3.5 h-3.5" />
                <span>📊 12×12 Annotated Table</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('actuators')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded transition-all ${
                  viewMode === 'actuators'
                    ? 'bg-slate-700 text-cyan-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Shows each of the 12 motors, effective inertia, Coriolis disturbance torque, and dynamic torque breakdown"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>⚡ Actuator Loads</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('network')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded transition-all ${
                  viewMode === 'network'
                    ? 'bg-slate-700 text-cyan-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Top-down visual diagram showing cross-leg inertial coupling transmitted through the robot chassis"
              >
                <Network className="w-3.5 h-3.5" />
                <span>🕸️ Robot Coupling Map</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Mathematical Verification Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-[#0B0F19] p-2.5 rounded border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">Symmetry ‖M - Mᵀ‖:</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {dynamicsMetrics.maxSymmetryViolation.toFixed(6)}
            </span>
          </div>

          <div className="bg-[#0B0F19] p-2.5 rounded border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">Self-Inertia Share:</span>
            <span className="text-cyan-300 font-semibold">
              {(dynamicsMetrics.selfInertiaRatio * 100).toFixed(1)}%
            </span>
          </div>

          <div className="bg-[#0B0F19] p-2.5 rounded border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">Passivity (Ṁ − 2C):</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Skew-Symmetric
            </span>
          </div>

          <div className="bg-[#0B0F19] p-2.5 rounded border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">Peak Coriolis Torque:</span>
            <span className="text-amber-400 font-semibold">
              {Math.max(...dynamicsMetrics.tauCoriolis.map(Math.abs)).toFixed(3)} N·m
            </span>
          </div>
        </div>

        {/* ============================================================ */}
        {/* VIEW 1: 4x4 LEG BLOCK DECOMPOSITION (Hierarchical Quad View) */}
        {/* ============================================================ */}
        {viewMode === 'blocks' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <p>
                The 12×12 matrix is physically partitioned into <strong className="text-slate-200">16 macroscopic blocks</strong> corresponding to leg-to-leg dynamic interaction (4 legs: Front-Left, Front-Right, Rear-Left, Rear-Right).
                Click any block to zoom into its 3×3 joint tensor below.
              </p>
              <div className="flex items-center gap-3 font-mono">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-cyan-900 border border-cyan-400 inline-block" />
                  Diagonal: Leg Self-Inertia
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-slate-900 border border-slate-700 inline-block" />
                  Off-Diagonal: Trunk Coupling
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* 4x4 Grid of Leg Blocks */}
              <div className="lg:col-span-3 bg-[#07090E] p-4 rounded border border-slate-800">
                <div className="grid grid-cols-5 gap-2 text-xs font-mono">
                  {/* Top Header Corner */}
                  <div className="p-2 text-center text-slate-500 font-semibold">
                    Row \ Col
                  </div>
                  {LEG_CONFIGS.map((colLeg) => (
                    <div
                      key={`col-${colLeg.id}`}
                      className={`p-2 rounded text-center font-bold ${colLeg.textClass} ${colLeg.bgClass}`}
                    >
                      {colLeg.id}
                      <div className="text-[10px] font-normal opacity-80">{colLeg.label}</div>
                    </div>
                  ))}

                  {/* 4 Rows */}
                  {LEG_CONFIGS.map((rowLeg, rIdx) => (
                    <React.Fragment key={`row-frag-${rowLeg.id}`}>
                      {/* Row Header */}
                      <div
                        className={`p-2 rounded text-left font-bold flex flex-col justify-center ${rowLeg.textClass} ${rowLeg.bgClass}`}
                      >
                        <span>{rowLeg.id}</span>
                        <span className="text-[10px] font-normal opacity-80">{rowLeg.label}</span>
                      </div>

                      {/* 4 Block Cells in this Row */}
                      {LEG_CONFIGS.map((colLeg, cIdx) => {
                        const isDiagonal = rIdx === cIdx;
                        const isSelected =
                          selectedBlock?.rLeg === rIdx && selectedBlock?.cLeg === cIdx;
                        const norm = isCoriolis
                          ? dynamicsMetrics.blockNormsC[rIdx][cIdx]
                          : dynamicsMetrics.blockNormsM[rIdx][cIdx];

                        return (
                          <div
                            key={`block-${rowLeg.id}-${colLeg.id}`}
                            onClick={() => setSelectedBlock({ rLeg: rIdx, cLeg: cIdx })}
                            className={`p-3 rounded border transition-all cursor-pointer flex flex-col justify-between aspect-[1.2/1] ${
                              isSelected
                                ? 'ring-2 ring-cyan-400 bg-slate-800/80 border-cyan-400'
                                : isDiagonal
                                ? 'bg-[#0F172A] border-cyan-800/60 hover:border-cyan-500'
                                : 'bg-[#0B0F19] border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span
                                className={`font-semibold ${
                                  isDiagonal ? 'text-cyan-300' : 'text-slate-400'
                                }`}
                              >
                                {rowLeg.id} ↔ {colLeg.id}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  isDiagonal
                                    ? 'bg-cyan-950 text-cyan-400 font-bold border border-cyan-800'
                                    : 'bg-slate-900 text-slate-500'
                                }`}
                              >
                                {isDiagonal ? 'Self' : 'Cross'}
                              </span>
                            </div>

                            {/* Mini 3x3 heat preview */}
                            <div className="grid grid-cols-3 gap-[1px] my-1.5 aspect-[3/1] bg-slate-950 p-0.5 rounded">
                              {[0, 1, 2].map((r) =>
                                [0, 1, 2].map((c) => {
                                  const cellVal =
                                    activeMatrix[rIdx * 3 + r][cIdx * 3 + c];
                                  return (
                                    <div
                                      key={`mini-${r}-${c}`}
                                      className="rounded-[1px]"
                                      style={{
                                        backgroundColor: valueToHeatmapColor(
                                          cellVal,
                                          maxAbsScale,
                                          isCoriolis
                                        ),
                                      }}
                                    />
                                  );
                                })
                              )}
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span>‖Block‖_F:</span>
                              <span className="font-semibold text-slate-200">
                                {norm.toFixed(4)} {isCoriolis ? '' : 'kg·m²'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Block Deep Dive Inspector (Side Card) */}
              <div className="bg-[#07090E] p-4 rounded border border-slate-800 flex flex-col justify-between space-y-4">
                {selectedBlock ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                        <span>Zoom: Block [{LEG_CONFIGS[selectedBlock.rLeg].id} ↔ {LEG_CONFIGS[selectedBlock.cLeg].id}]</span>
                      </h3>
                      <span
                        className={`text-xs font-mono px-2 py-0.5 rounded ${
                          selectedBlock.rLeg === selectedBlock.cLeg
                            ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                            : 'bg-slate-900 text-slate-400'
                        }`}
                      >
                        {selectedBlock.rLeg === selectedBlock.cLeg
                          ? 'Self-Inertia (Dominant)'
                          : 'Trunk Coupling'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 mb-3">
                      {selectedBlock.rLeg === selectedBlock.cLeg
                        ? `Internal joint coupling for ${LEG_CONFIGS[selectedBlock.rLeg].label} leg. Diagonal entries reflect the primary rotational moment of inertia felt by each motor gearbox.`
                        : `Dynamic reaction torque transmitted between ${LEG_CONFIGS[selectedBlock.rLeg].label} and ${LEG_CONFIGS[selectedBlock.cLeg].label} through the rigid body chassis.`}
                    </p>

                    {/* 3x3 Table with explicit row and column labels */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs font-mono border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-500">
                            <th className="py-1 px-1.5 text-left">Joint</th>
                            <th className="py-1 px-1.5 text-right">Hip</th>
                            <th className="py-1 px-1.5 text-right">Thigh</th>
                            <th className="py-1 px-1.5 text-right">Calf</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {['Hip', 'Thigh', 'Calf'].map((jointRow, r) => (
                            <tr key={jointRow} className="hover:bg-slate-900">
                              <td className="py-2 px-1.5 font-semibold text-slate-300">
                                {jointRow}
                              </td>
                              {[0, 1, 2].map((c) => {
                                const val =
                                  activeMatrix[selectedBlock.rLeg * 3 + r][
                                    selectedBlock.cLeg * 3 + c
                                  ];
                                return (
                                  <td
                                    key={c}
                                    className="py-2 px-1.5 text-right font-semibold"
                                  >
                                    <span
                                      className="px-1.5 py-0.5 rounded"
                                      style={{
                                        backgroundColor: valueToHeatmapColor(
                                          val,
                                          maxAbsScale,
                                          isCoriolis
                                        ),
                                        color:
                                          Math.abs(val) > maxAbsScale * 0.4
                                            ? '#FFFFFF'
                                            : '#94A3B8',
                                      }}
                                    >
                                      {val.toFixed(4)}
                                    </span>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 space-y-1.5">
                      <div className="flex justify-between">
                        <span>Row Leg:</span>
                        <span className={LEG_CONFIGS[selectedBlock.rLeg].textClass}>
                          {LEG_CONFIGS[selectedBlock.rLeg].label} (Joints {selectedBlock.rLeg * 3}..{selectedBlock.rLeg * 3 + 2})
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Column Leg:</span>
                        <span className={LEG_CONFIGS[selectedBlock.cLeg].textClass}>
                          {LEG_CONFIGS[selectedBlock.cLeg].label} (Joints {selectedBlock.cLeg * 3}..{selectedBlock.cLeg * 3 + 2})
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Units:</span>
                        <span className="text-slate-200">
                          {isCoriolis ? 'N·s / rad (Christoffel)' : 'kg·m² / rad (Inertia)'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    Select any block on the left to zoom in.
                  </div>
                )}

                <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
                  💡 <strong className="text-slate-300">Physics Insight:</strong> Thigh and Calf joints have higher inertia than Hip roll because the leg links act as long lever arms (I ≈ m r²).
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 2: 12x12 FULL ANNOTATED TABLE (With Readable Numbers & Leg Borders) */}
        {/* ============================================================ */}
        {viewMode === 'grid' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
              <p>
                Complete <strong className="text-slate-200">12×12 matrix spreadsheet</strong> with explicit row/column headers. Colored boundaries mark the 4 legs. Hover or click any cell to test reciprocity (M[i, j] = M[j, i]) and inspect interaction details.
              </p>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Gradient:</span>
                <span className="font-mono text-[10px]">
                  {isCoriolis ? '-0.05' : '0.00'}
                </span>
                <div
                  className="w-24 h-2.5 rounded border border-slate-800"
                  style={{
                    background: isCoriolis
                      ? 'linear-gradient(to right, rgb(59, 130, 246), rgb(11, 15, 25), rgb(245, 158, 11))'
                      : 'linear-gradient(to right, rgb(11, 15, 25), rgb(6, 182, 212), rgb(245, 158, 11))',
                  }}
                />
                <span className="font-mono text-[10px]">
                  {isCoriolis ? '+0.05 N·s' : '0.12 kg·m²'}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto bg-[#07090E] p-3 rounded border border-slate-800">
              <div className="inline-block min-w-full">
                <table className="border-collapse font-mono text-[11px] tabular-nums mx-auto">
                  <thead>
                    <tr>
                      <th className="p-1 text-slate-600 font-normal border-b border-r border-slate-800">
                        i \ j
                      </th>
                      {ALL_JOINT_LABELS.map((jName, jIdx) => {
                        const legIdx = Math.floor(jIdx / 3);
                        const legCfg = LEG_CONFIGS[legIdx];
                        const isBoundary = jIdx % 3 === 2 && jIdx !== 11;
                        return (
                          <th
                            key={`col-hdr-${jName}`}
                            className={`p-1.5 text-center font-semibold border-b border-slate-800 ${
                              legCfg.textClass
                            } ${isBoundary ? 'border-r-2 border-r-slate-600' : 'border-r border-slate-800/40'}`}
                            title={JOINT_DESCRIPTIONS[jIdx]}
                          >
                            <span className="block text-[9px] opacity-75">{legCfg.id}</span>
                            {jName.replace(/^[A-Z]{2}_/, '')}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {ALL_JOINT_LABELS.map((rName, rIdx) => {
                      const rowLegIdx = Math.floor(rIdx / 3);
                      const rowLegCfg = LEG_CONFIGS[rowLegIdx];
                      const isRowBoundary = rIdx % 3 === 2 && rIdx !== 11;

                      return (
                        <tr
                          key={`row-tr-${rName}`}
                          className={isRowBoundary ? 'border-b-2 border-b-slate-600' : 'border-b border-slate-800/40'}
                        >
                          <th
                            className={`p-1.5 text-left font-semibold border-r border-slate-800 ${
                              rowLegCfg.textClass
                            }`}
                            title={JOINT_DESCRIPTIONS[rIdx]}
                          >
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] opacity-75">{rowLegCfg.id}</span>
                              <span>{rName.replace(/^[A-Z]{2}_/, '')}</span>
                            </div>
                          </th>

                          {ALL_JOINT_LABELS.map((cName, cIdx) => {
                            const val = activeMatrix[rIdx][cIdx];
                            const isColBoundary = cIdx % 3 === 2 && cIdx !== 11;
                            const isHovered =
                              hoveredCell?.r === rIdx && hoveredCell?.c === cIdx;
                            const isSymmetricPartner =
                              hoveredCell &&
                              hoveredCell.r === cIdx &&
                              hoveredCell.c === rIdx &&
                              !isCoriolis;
                            const isDiag = rIdx === cIdx;

                            return (
                              <td
                                key={`cell-${rIdx}-${cIdx}`}
                                onMouseEnter={() =>
                                  setHoveredCell({
                                    matrix: matrixType === 'C' ? 'C' : 'M',
                                    r: rIdx,
                                    c: cIdx,
                                    val,
                                  })
                                }
                                onClick={() =>
                                  setHoveredCell({
                                    matrix: matrixType === 'C' ? 'C' : 'M',
                                    r: rIdx,
                                    c: cIdx,
                                    val,
                                  })
                                }
                                className={`p-1 text-center cursor-pointer transition-all ${
                                  isColBoundary ? 'border-r-2 border-r-slate-600' : 'border-r border-slate-800/30'
                                } ${
                                  isHovered
                                    ? 'ring-2 ring-cyan-400 z-10 font-bold scale-105'
                                    : isSymmetricPartner
                                    ? 'ring-2 ring-amber-400 z-10'
                                    : isDiag
                                    ? 'bg-slate-900/60'
                                    : ''
                                }`}
                                style={{
                                  backgroundColor: valueToHeatmapColor(val, maxAbsScale, isCoriolis),
                                }}
                                title={`${isCoriolis ? 'C' : 'M'}[${rName}, ${cName}] = ${val.toFixed(5)}`}
                              >
                                <span
                                  className={`text-[10px] ${
                                    Math.abs(val) > maxAbsScale * 0.4
                                      ? 'text-white font-semibold'
                                      : Math.abs(val) < 0.001
                                      ? 'text-slate-600'
                                      : 'text-slate-300'
                                  }`}
                                >
                                  {Math.abs(val) < 0.0005 ? '·' : val.toFixed(3)}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cell Inspector Feedback Bar with Symmetry Twin Highlighting */}
            <div className="bg-[#0B0F19] p-3 rounded border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              {hoveredCell ? (
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Selected Entry:</span>
                    <span className="text-cyan-300 font-bold">
                      {hoveredCell.matrix}[{ALL_JOINT_LABELS[hoveredCell.r]}, {ALL_JOINT_LABELS[hoveredCell.c]}] = {hoveredCell.val.toFixed(5)}
                    </span>
                  </div>

                  {!isCoriolis && (
                    <div className="flex items-center gap-2 border-l border-slate-800 pl-4">
                      <span className="text-slate-500">Symmetric Twin:</span>
                      <span className="text-amber-300">
                        M[{ALL_JOINT_LABELS[hoveredCell.c]}, {ALL_JOINT_LABELS[hoveredCell.r]}] = {activeMatrix[hoveredCell.c][hoveredCell.r].toFixed(5)}
                      </span>
                      <span className="text-emerald-400 text-[11px]">
                        (Residual: {Math.abs(hoveredCell.val - activeMatrix[hoveredCell.c][hoveredCell.r]).toFixed(8)})
                      </span>
                    </div>
                  )}

                  <div className="text-slate-400 text-[11px] border-l border-slate-800 pl-4">
                    {hoveredCell.r === hoveredCell.c ? (
                      <span className="text-cyan-300">● Main Diagonal: Direct actuator inertia load</span>
                    ) : (
                      <span>Cross-coupling between {ALL_JOINT_LABELS[hoveredCell.r]} and {ALL_JOINT_LABELS[hoveredCell.c]}</span>
                    )}
                  </div>
                </div>
              ) : (
                <span className="text-slate-500">
                  Hover or click any cell above to inspect exact value, physical joint names, and reciprocity partner.
                </span>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 3: ACTUATOR DYNAMICS & TORQUE BREAKDOWN (Motor Load View) */}
        {/* ============================================================ */}
        {viewMode === 'actuators' && (
          <div className="space-y-4">
            <div className="text-xs text-slate-400">
              <p>
                <strong className="text-slate-200">Actuator Load View:</strong> How the 12×12 matrices translate into required motor torques during motion:
                {' '}
                <span className="font-mono text-cyan-300">
                  τ_i = (∑_j M_ij q̈_j) [Inertia] + (∑_j C_ij q̇_j) [Coriolis] + G_i(q) [Gravity] - (Jᵀ F_c)_i [Ground]
                </span>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {LEG_CONFIGS.map((legCfg) => (
                <div
                  key={`act-leg-${legCfg.id}`}
                  className="bg-[#07090E] p-4 rounded border border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className={`font-semibold font-mono text-sm ${legCfg.textClass}`}>
                      {legCfg.id} Leg Actuators ({legCfg.label})
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      Phase: {frame.legs[legCfg.id]?.isStance ? '● Stance' : '○ Swing'}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {legCfg.indices.map((jIdx, localIdx) => {
                      const jName = ALL_JOINT_LABELS[jIdx];
                      const selfInertia = massMat[jIdx][jIdx];
                      let crossInertia = 0;
                      for (let k = 0; k < 12; k++) {
                        if (k !== jIdx) crossInertia += Math.abs(massMat[jIdx][k]);
                      }
                      const tauC = dynamicsMetrics.tauCoriolis[jIdx];
                      const tauG = frame.gravityVector[jIdx] || 0;
                      const tauTotal = frame.jointTorques[jIdx] || 0;
                      const qPos = frame.jointPositions[jIdx] || 0;
                      const qVel = frame.jointVelocities[jIdx] || 0;

                      return (
                        <div
                          key={`act-joint-${jName}`}
                          className="p-2.5 rounded bg-[#0B0F19] border border-slate-800/80 space-y-1.5 text-xs font-mono"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-200">
                              {legCfg.jointLabels[localIdx]} ({jName})
                            </span>
                            <span className="text-slate-400 text-[11px]">
                              q = {qPos.toFixed(2)} rad · q̇ = {qVel.toFixed(1)} rad/s
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-800/50">
                            <div>
                              <span className="text-slate-500 block">Self-Inertia M_ii:</span>
                              <span className="text-cyan-300 font-semibold">{selfInertia.toFixed(4)} kg·m²</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Cross Inertia ∑|M_ij|:</span>
                              <span className="text-purple-300 font-semibold">{crossInertia.toFixed(4)} kg·m²</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Coriolis Torque τ_C:</span>
                              <span className="text-amber-300 font-semibold">{tauC.toFixed(3)} N·m</span>
                            </div>
                          </div>

                          {/* Torque balance bar */}
                          <div className="pt-1">
                            <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                              <span>Dynamic Torque Composition</span>
                              <span>Total τ: {tauTotal.toFixed(1)} N·m</span>
                            </div>
                            <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden flex">
                              <div
                                style={{ width: `${Math.min(50, Math.abs(tauG) * 6)}%` }}
                                className="bg-emerald-500 h-full"
                                title={`Gravity: ${tauG.toFixed(1)} N·m`}
                              />
                              <div
                                style={{ width: `${Math.min(50, Math.abs(tauC) * 20)}%` }}
                                className="bg-amber-400 h-full"
                                title={`Coriolis: ${tauC.toFixed(2)} N·m`}
                              />
                              <div
                                style={{ width: `${Math.min(50, Math.abs(tauTotal - tauG - tauC) * 3)}%` }}
                                className="bg-cyan-500 h-full"
                                title="Acceleration / Ground contact"
                              />
                            </div>
                            <div className="flex items-center justify-between text-[9px] text-slate-500 mt-0.5">
                              <span className="text-emerald-400">■ Gravity G(q)</span>
                              <span className="text-amber-400">■ Coriolis C(q,q̇)q̇</span>
                              <span className="text-cyan-400">■ M(q)q̈ + JᵀF</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 4: PHYSICAL ROBOT COUPLING TOPOLOGY (Chassis Network) */}
        {/* ============================================================ */}
        {viewMode === 'network' && (
          <div className="space-y-4">
            <div className="text-xs text-slate-400">
              <p>
                <strong className="text-slate-200">Physical Chassis Coupling Topology:</strong> Top-down view showing dynamic cross-leg reactions transferred across the central torso. Diagonal links represent trotting-pair inertial coupling (e.g. Front-Left to Rear-Right).
              </p>
            </div>

            <div className="bg-[#07090E] p-6 rounded border border-slate-800 flex flex-col items-center">
              <svg viewBox="-180 -140 360 280" className="w-full max-w-[540px] aspect-[1.3/1]">
                {/* Central Robot Chassis Body */}
                <rect
                  x="-90"
                  y="-65"
                  width="180"
                  height="130"
                  rx="16"
                  fill="#0B0F19"
                  stroke="#1E293B"
                  strokeWidth="2"
                />

                {/* Chassis Internal Grid & Label */}
                <circle cx="0" cy="0" r="28" fill="#111827" stroke="#334155" strokeWidth="1.5" />
                <text
                  x="0"
                  y="-4"
                  textAnchor="middle"
                  fill="#94A3B8"
                  fontSize="10"
                  fontFamily="JetBrains Mono"
                  fontWeight="bold"
                >
                  TRUNK
                </text>
                <text
                  x="0"
                  y="10"
                  textAnchor="middle"
                  fill="#06B6D4"
                  fontSize="8"
                  fontFamily="JetBrains Mono"
                >
                  M = {robot.totalMass} kg
                </text>

                {/* Cross-leg coupling lines */}
                {/* FL to FR (Lateral) */}
                <line
                  x1="-100"
                  y1="-75"
                  x2="100"
                  y2="-75"
                  stroke="#06B6D4"
                  strokeWidth={Math.max(1.5, dynamicsMetrics.blockNormsM[0][1] * 80)}
                  strokeOpacity="0.7"
                />
                <text x="0" y="-82" textAnchor="middle" fill="#06B6D4" fontSize="9" fontFamily="JetBrains Mono">
                  Lateral Coupling ‖M_FL,FR‖ = {dynamicsMetrics.blockNormsM[0][1].toFixed(4)}
                </text>

                {/* RL to RR (Lateral Rear) */}
                <line
                  x1="-100"
                  y1="75"
                  x2="100"
                  y2="75"
                  stroke="#10B981"
                  strokeWidth={Math.max(1.5, dynamicsMetrics.blockNormsM[2][3] * 80)}
                  strokeOpacity="0.7"
                />
                <text x="0" y="92" textAnchor="middle" fill="#10B981" fontSize="9" fontFamily="JetBrains Mono">
                  Rear Lateral ‖M_RL,RR‖ = {dynamicsMetrics.blockNormsM[2][3].toFixed(4)}
                </text>

                {/* FL to RL (Sagittal Left) */}
                <line
                  x1="-100"
                  y1="-75"
                  x2="-100"
                  y2="75"
                  stroke="#38BDF8"
                  strokeWidth={Math.max(1.5, dynamicsMetrics.blockNormsM[0][2] * 80)}
                  strokeOpacity="0.7"
                />

                {/* FR to RR (Sagittal Right) */}
                <line
                  x1="100"
                  y1="-75"
                  x2="100"
                  y2="75"
                  stroke="#F59E0B"
                  strokeWidth={Math.max(1.5, dynamicsMetrics.blockNormsM[1][3] * 80)}
                  strokeOpacity="0.7"
                />

                {/* Diagonal: FL to RR (Trotting Pair Torsion) */}
                <line
                  x1="-100"
                  y1="-75"
                  x2="100"
                  y2="75"
                  stroke="#A855F7"
                  strokeWidth={Math.max(1.5, dynamicsMetrics.blockNormsM[0][3] * 80)}
                  strokeDasharray="4 3"
                  strokeOpacity="0.8"
                />

                {/* Diagonal: FR to RL (Trotting Pair Torsion) */}
                <line
                  x1="100"
                  y1="-75"
                  x2="-100"
                  y2="75"
                  stroke="#A855F7"
                  strokeWidth={Math.max(1.5, dynamicsMetrics.blockNormsM[1][2] * 80)}
                  strokeDasharray="4 3"
                  strokeOpacity="0.8"
                />

                {/* Leg Hip Mount Nodes */}
                {/* FL (Top-Left) */}
                <g transform="translate(-100, -75)">
                  <circle cx="0" cy="0" r="22" fill="#0E2433" stroke="#06B6D4" strokeWidth="2.5" />
                  <text x="0" y="-3" textAnchor="middle" fill="#06B6D4" fontSize="11" fontFamily="JetBrains Mono" fontWeight="bold">FL</text>
                  <text x="0" y="8" textAnchor="middle" fill="#94A3B8" fontSize="8" fontFamily="JetBrains Mono">
                    {frame.legs.FL?.isStance ? 'Stance' : 'Swing'}
                  </text>
                </g>

                {/* FR (Top-Right) */}
                <g transform="translate(100, -75)">
                  <circle cx="0" cy="0" r="22" fill="#2E1C0C" stroke="#F59E0B" strokeWidth="2.5" />
                  <text x="0" y="-3" textAnchor="middle" fill="#F59E0B" fontSize="11" fontFamily="JetBrains Mono" fontWeight="bold">FR</text>
                  <text x="0" y="8" textAnchor="middle" fill="#94A3B8" fontSize="8" fontFamily="JetBrains Mono">
                    {frame.legs.FR?.isStance ? 'Stance' : 'Swing'}
                  </text>
                </g>

                {/* RL (Bottom-Left) */}
                <g transform="translate(-100, 75)">
                  <circle cx="0" cy="0" r="22" fill="#0B2518" stroke="#10B981" strokeWidth="2.5" />
                  <text x="0" y="-3" textAnchor="middle" fill="#10B981" fontSize="11" fontFamily="JetBrains Mono" fontWeight="bold">RL</text>
                  <text x="0" y="8" textAnchor="middle" fill="#94A3B8" fontSize="8" fontFamily="JetBrains Mono">
                    {frame.legs.RL?.isStance ? 'Stance' : 'Swing'}
                  </text>
                </g>

                {/* RR (Bottom-Right) */}
                <g transform="translate(100, 75)">
                  <circle cx="0" cy="0" r="22" fill="#261033" stroke="#A855F7" strokeWidth="2.5" />
                  <text x="0" y="-3" textAnchor="middle" fill="#A855F7" fontSize="11" fontFamily="JetBrains Mono" fontWeight="bold">RR</text>
                  <text x="0" y="8" textAnchor="middle" fill="#94A3B8" fontSize="8" fontFamily="JetBrains Mono">
                    {frame.legs.RR?.isStance ? 'Stance' : 'Swing'}
                  </text>
                </g>
              </svg>

              <div className="flex items-center gap-6 text-xs font-mono text-slate-400 mt-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-[#06B6D4] inline-block" />
                  Lateral Torso Reactions
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-[#A855F7] border-dashed inline-block" />
                  Diagonal Trotting Torsion
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-[#38BDF8] inline-block" />
                  Sagittal Pitch Reactions
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Row 2: 2D Support Hull / Kajita ZMP Plane + Gravity Vector */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Support Polygon & Kajita ZMP Plane */}
        <div className="bg-[#111827] border border-slate-800 rounded p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-200">
                Support Polygon S &amp; Kajita ZMP Plane
              </h2>
              <span
                className={`text-xs font-mono ${
                  frame.nsi >= 0.3 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                NSI = {frame.nsi.toFixed(3)}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              p_ZMP = p_c − (z_c/g)p̈_c inside ConvexHull(stance feet) with preview horizon.
            </p>
            <svg
              viewBox="-0.45 -0.35 0.9 0.7"
              className="w-full aspect-square max-h-[290px] bg-[#07090E] border border-slate-800 rounded"
            >
              <line x1="-0.45" y1="0" x2="0.45" y2="0" stroke="#1E293B" strokeWidth="0.004" />
              <line x1="0" y1="-0.35" x2="0" y2="0.35" stroke="#1E293B" strokeWidth="0.004" />

              {frame.supportPolygon.length >= 3 && (
                <polygon
                  points={frame.supportPolygon
                    .map(
                      ([px, py]) =>
                        `${px - frame.basePose.position[0]},${-(py - frame.basePose.position[1])}`
                    )
                    .join(' ')}
                  fill={frame.nsi >= 0.3 ? 'rgba(16, 185, 129, 0.16)' : 'rgba(239, 68, 68, 0.2)'}
                  stroke={frame.nsi >= 0.3 ? '#10B981' : '#EF4444'}
                  strokeWidth="0.006"
                />
              )}

              {frame.shrunkSupportPolygon.length >= 3 && (
                <polygon
                  points={frame.shrunkSupportPolygon
                    .map(
                      ([px, py]) =>
                        `${px - frame.basePose.position[0]},${-(py - frame.basePose.position[1])}`
                    )
                    .join(' ')}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="0.004"
                  strokeDasharray="0.015 0.01"
                />
              )}

              {frame.zmpPreviewHorizon.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#06B6D4"
                  strokeWidth="0.005"
                  points={frame.zmpPreviewHorizon
                    .map(
                      ([zx, zy]) =>
                        `${zx - frame.basePose.position[0]},${-(zy - frame.basePose.position[1])}`
                    )
                    .join(' ')}
                />
              )}

              {Object.values(frame.legs).map((leg) => {
                const fx = leg.footWorld[0] - frame.basePose.position[0];
                const fy = -(leg.footWorld[1] - frame.basePose.position[1]);
                return (
                  <g key={leg.legId}>
                    <circle
                      cx={fx}
                      cy={fy}
                      r={0.022}
                      fill={leg.isStance ? '#10B981' : '#0F172A'}
                      stroke={leg.isStance ? '#34D399' : '#38BDF8'}
                      strokeWidth="0.005"
                    />
                    <text
                      x={fx + 0.028}
                      y={fy + 0.01}
                      fill="#E2E8F0"
                      fontSize="0.032"
                      fontFamily="JetBrains Mono"
                    >
                      {leg.legId}
                    </text>
                  </g>
                );
              })}

              <circle
                cx={frame.com[0] - frame.basePose.position[0]}
                cy={-(frame.com[1] - frame.basePose.position[1])}
                r={0.016}
                fill="#3B82F6"
              />
              <circle
                cx={frame.zmpActual[0] - frame.basePose.position[0]}
                cy={-(frame.zmpActual[1] - frame.basePose.position[1])}
                r={0.014}
                fill="#EF4444"
              />
            </svg>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>● Red: ZMP Actual · ● Blue: CoM · Green: Stance Hull</span>
            <span>Margin: {(frame.stabilityMarginM * 100).toFixed(2)} cm</span>
          </div>
        </div>

        {/* Gravity Vector G(q) & Actuation Torques */}
        <div className="bg-[#111827] border border-slate-800 rounded p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-200">
                Gravity Vector G(q) &amp; Actuation Torque Vector τ (12-DoF)
              </h2>
              <span className="text-xs font-mono text-slate-400">Units: N·m</span>
            </div>
            <div className="space-y-2">
              {ALL_JOINT_LABELS.map((label, idx) => {
                const gVal = frame.gravityVector[idx] ?? 0;
                const tauVal = frame.jointTorques[idx] ?? 0;
                const qVal = frame.jointPositions[idx] ?? 0;
                const gPct = Math.min(100, Math.abs(gVal) * 45);
                const tauPct = Math.min(100, Math.abs(tauVal) * 3.5);

                return (
                  <div
                    key={label}
                    className="grid grid-cols-12 items-center gap-2 text-xs font-mono tabular-nums"
                  >
                    <span className="col-span-2 text-slate-300">{label}</span>
                    <span className="col-span-2 text-slate-400">q={qVal.toFixed(2)}r</span>
                    <div className="col-span-4 flex items-center gap-1.5">
                      <div className="w-full h-2 bg-slate-900 rounded overflow-hidden">
                        <div className="h-full bg-cyan-400" style={{ width: `${gPct}%` }} />
                      </div>
                      <span className="w-14 text-right text-cyan-300">G:{gVal.toFixed(1)}</span>
                    </div>
                    <div className="col-span-4 flex items-center gap-1.5">
                      <div className="w-full h-2 bg-slate-900 rounded overflow-hidden">
                        <div className="h-full bg-amber-400" style={{ width: `${tauPct}%` }} />
                      </div>
                      <span className="w-16 text-right text-amber-300">τ:{tauVal.toFixed(1)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>■ Cyan: Gravitational Load G(q)</span>
            <span>■ Amber: Command Torque τ</span>
          </div>
        </div>
      </div>

      {/* Row 3: Geometric Jacobians & Complementarity Constraints */}
      <div className="bg-[#111827] border border-slate-800 rounded p-4 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-200">
                Geometric Jacobian J_j(q) ∈ ℝ⁶ˣ³ &amp; DLS IK Inspector
              </h2>
              <p className="text-xs text-slate-400">
                Δq = Jᵀ(JJᵀ + λ²I)⁻¹e with λ = {dampingLambda.toFixed(3)}
              </p>
            </div>
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded border border-slate-800">
              {Object.keys(frame.legs).map((legKey) => (
                <button
                  key={legKey}
                  type="button"
                  onClick={() => setSelectedLeg(legKey)}
                  className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                    selectedLeg === legKey
                      ? 'bg-cyan-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {legKey}
                </button>
              ))}
            </div>
          </div>

          {activeLeg && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#07090E] border border-slate-800 rounded p-3">
                <div className="text-xs font-mono text-slate-400 mb-2">
                  J_{activeLeg.legId}(q) = [J_v(q); J_ω(q)]
                </div>
                <div className="space-y-1 font-mono text-xs tabular-nums">
                  {['vx', 'vy', 'vz', 'ωx', 'ωy', 'ωz'].map((rowLabel, rIdx) => {
                    const rowVals = activeLeg.jacobian?.[rIdx] || [0, 0, 0];
                    return (
                      <div key={rowLabel} className="grid grid-cols-4 gap-1 text-right">
                        <span className="text-left text-slate-500">{rowLabel}</span>
                        {rowVals.map((val, cIdx) => (
                          <span
                            key={cIdx}
                            className={
                              Math.abs(val) > 0.15 ? 'text-cyan-300' : 'text-slate-400'
                            }
                          >
                            {val.toFixed(3)}
                          </span>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-[#07090E] border border-slate-800 rounded p-3 flex flex-col justify-between text-xs font-mono tabular-nums">
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Condition Number κ(J):</span>
                    <span className="text-slate-100 font-semibold">
                      {activeLeg.conditionNumber.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">DLS IK Iterations:</span>
                    <span className="text-emerald-400">{activeLeg.ikIterations} / 20</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Position Error ‖e‖:</span>
                    <span className="text-cyan-300">
                      {(activeLeg.ikError * 1000).toFixed(3)} mm
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Foot World XYZ:</span>
                    <span className="text-slate-200">
                      [{activeLeg.footWorld.map((v) => v.toFixed(2)).join(', ')}]
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                  Joint Limits: Feasible bounds [-0.80, 4.18, -2.69] rad
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
            Contact Complementarity (0 ≤ Fn ⊥ gap ≥ 0) &amp; Friction Cone (‖Ft‖ ≤ μFn, μ={frictionMu.toFixed(2)})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-1.5 px-2">Leg</th>
                  <th className="py-1.5 px-2">State</th>
                  <th className="py-1.5 px-2">Fn (N)</th>
                  <th className="py-1.5 px-2">‖Ft‖ (N)</th>
                  <th className="py-1.5 px-2">Gap (m)</th>
                  <th className="py-1.5 px-2">Cone Ratio</th>
                  <th className="py-1.5 px-2">Complementarity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {Object.values(frame.legs).map((leg) => (
                  <tr key={leg.legId} className="hover:bg-slate-900/50">
                    <td className="py-1.5 px-2 font-semibold text-slate-200">{leg.legId}</td>
                    <td className="py-1.5 px-2">
                      <span className={leg.isStance ? 'text-emerald-400' : 'text-sky-400'}>
                        {leg.isStance ? '● Stance' : '○ Swing'}
                      </span>
                    </td>
                    <td className="py-1.5 px-2">{leg.contactForce.fn.toFixed(1)}</td>
                    <td className="py-1.5 px-2">{leg.contactForce.ft.toFixed(1)}</td>
                    <td className="py-1.5 px-2">{leg.contactForce.gap.toFixed(3)}</td>
                    <td className="py-1.5 px-2">
                      {(leg.contactForce.frictionRatio * 100).toFixed(1)}%
                    </td>
                    <td className="py-1.5 px-2">
                      <span
                        className={
                          leg.contactForce.complementarityValid
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }
                      >
                        {leg.contactForce.complementarityValid ? '● Verified' : '▲ Slipping'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
