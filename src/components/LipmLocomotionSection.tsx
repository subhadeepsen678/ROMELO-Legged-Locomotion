import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Compass,
  Gauge,
  Info,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Sliders,
  Sparkles,
  Zap,
} from 'lucide-react';
import { SimControlConfig, SimulationStateFrame } from '../physics/roboticsEngine';

interface LipmLocomotionSectionProps {
  frame: SimulationStateFrame;
  config: SimControlConfig;
  onUpdateConfig?: (partial: Partial<SimControlConfig>) => void;
}

interface Footprint {
  id: string;
  x: number;
  y: number;
  stepIndex: number;
  isLeft: boolean;
  legLabel: string;
}

export const LipmLocomotionSection: React.FC<LipmLocomotionSectionProps> = ({
  frame,
  config,
  onUpdateConfig,
}) => {
  // -------------------------------------------------------------
  // Mode: Interactive Sandbox vs Live Robot Telemetry Sync
  // -------------------------------------------------------------
  const [sourceMode, setSourceMode] = useState<'sandbox' | 'live_telemetry'>('sandbox');
  const [lipmGait, setLipmGait] = useState<'trot' | 'walk' | 'pace'>('trot');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  // -------------------------------------------------------------
  // LIPM Model Physical Parameters
  // -------------------------------------------------------------
  const [zc, setZc] = useState<number>(0.32); // CoM height (m)
  const [stepPeriod, setStepPeriod] = useState<number>(0.34); // Step duration T_step (s)
  const [targetSpeedX, setTargetSpeedX] = useState<number>(0.65); // Desired forward speed (m/s)
  const [targetSpeedY, setTargetSpeedY] = useState<number>(0.0); // Desired lateral speed (m/s)
  const [stanceWidth, setStanceWidth] = useState<number>(0.24); // Quadruped stance width (m)
  const [frictionCoeff, setFrictionCoeff] = useState<number>(0.75); // Ground friction mu

  const robotMassKg = frame.robotId.includes('silo') ? 30.0 : 13.5;
  const gravity = 9.81;

  // Natural pendulum frequency: omega_0 = sqrt(g / zc)
  const omega0 = useMemo(() => Math.sqrt(gravity / Math.max(0.05, zc)), [gravity, zc]);
  const timeConstant = useMemo(() => 1 / omega0, [omega0]);

  // -------------------------------------------------------------
  // Sandbox State (Analytical Integration of LIPM Walking)
  // -------------------------------------------------------------
  const [simTime, setSimTime] = useState<number>(0);
  const [phaseTime, setPhaseTime] = useState<number>(0.0);
  const [stepCount, setStepCount] = useState<number>(0);

  // CoM State in Sandbox
  const [comX, setComX] = useState<number>(0.0);
  const [comY, setComY] = useState<number>(0.0);
  const [velX, setVelX] = useState<number>(0.65);
  const [velY, setVelY] = useState<number>(0.0);

  // Current Ground Pivot / ZMP
  const [pivotX, setPivotX] = useState<number>(0.0);
  const [pivotY, setPivotY] = useState<number>(-0.12);
  const [isLeftStance, setIsLeftStance] = useState<boolean>(false);

  // Footsteps History (Past 10 footprints)
  const [footprints, setFootprints] = useState<Footprint[]>([
    { id: 'f0', x: -0.22, y: 0.12, stepIndex: -1, isLeft: true, legLabel: 'FL+RR' },
    { id: 'f1', x: 0.0, y: -0.12, stepIndex: 0, isLeft: false, legLabel: 'FR+RL' },
  ]);

  // Phase Space Trail: rolling [(x - px), vx]
  const [phaseTrail, setPhaseTrail] = useState<{ dx: number; vx: number }[]>([]);

  // Perturbation Toast / Flash Alert
  const [perturbationAlert, setPerturbationAlert] = useState<string | null>(null);

  // Sync with Live Robot Telemetry when in 'live_telemetry' mode
  const effectiveZc = sourceMode === 'live_telemetry' ? Math.max(0.12, frame.com[2]) : zc;
  const effectiveOmega0 = Math.sqrt(gravity / effectiveZc);

  const effectiveComX = sourceMode === 'live_telemetry' ? frame.com[0] : comX;
  const effectiveComY = sourceMode === 'live_telemetry' ? frame.com[1] : comY;
  const effectiveVelX = sourceMode === 'live_telemetry' ? frame.comVel[0] : velX;
  const effectiveVelY = sourceMode === 'live_telemetry' ? frame.comVel[1] : velY;

  const effectivePivotX = sourceMode === 'live_telemetry' ? frame.zmpActual[0] : pivotX;
  const effectivePivotY = sourceMode === 'live_telemetry' ? frame.zmpActual[1] : pivotY;

  // -------------------------------------------------------------
  // Analytical LIPM Derived Quantities
  // -------------------------------------------------------------
  // Divergent Component of Motion (DCM) / Capture Point: xi = x + v / omega0
  const capturePointX = effectiveComX + effectiveVelX / effectiveOmega0;
  const capturePointY = effectiveComY + effectiveVelY / effectiveOmega0;

  // Relative offsets from ground pivot
  const relX = effectiveComX - effectivePivotX;
  const relY = effectiveComY - effectivePivotY;

  // Instantaneous horizontal acceleration: a = omega0^2 * (x - p)
  const accelX = Math.pow(effectiveOmega0, 2) * relX;
  const accelY = Math.pow(effectiveOmega0, 2) * relY;
  const totalAccelMag = Math.sqrt(accelX * accelX + accelY * accelY);

  // Orbital Energy: E = 0.5 * v^2 - 0.5 * omega0^2 * (x - p)^2
  const orbitalEnergyX = 0.5 * Math.pow(effectiveVelX, 2) - 0.5 * Math.pow(effectiveOmega0, 2) * Math.pow(relX, 2);
  const orbitalEnergyY = 0.5 * Math.pow(effectiveVelY, 2) - 0.5 * Math.pow(effectiveOmega0, 2) * Math.pow(relY, 2);

  // Pendulum rod length and 3D angle from vertical
  const pendulumRodLength = Math.sqrt(relX * relX + relY * relY + effectiveZc * effectiveZc);
  const pendulumAngleDeg = (Math.atan2(Math.sqrt(relX * relX + relY * relY), effectiveZc) * 180) / Math.PI;
  const maxFrictionAngleDeg = (Math.atan(frictionCoeff) * 180) / Math.PI;
  const isInsideFrictionCone = pendulumAngleDeg <= maxFrictionAngleDeg;

  // Predicted Next Footstep from Capture Point terminal condition
  // p_next = xi_end - (v_des / omega0)
  const timeRemaining = Math.max(0.01, stepPeriod - phaseTime);
  const predictedTerminalCaptureX =
    effectivePivotX + (effectiveComX - effectivePivotX + effectiveVelX / effectiveOmega0) * Math.exp(effectiveOmega0 * timeRemaining);
  const nextTargetFootX = predictedTerminalCaptureX - targetSpeedX / effectiveOmega0;
  const nextStanceSign = isLeftStance ? -1 : 1;
  const nextTargetFootY = effectiveComY + (nextStanceSign * stanceWidth) / 2 + (targetSpeedY / effectiveOmega0);

  // -------------------------------------------------------------
  // Sandbox Animation & Physics Stepping Loop (40 Hz)
  // -------------------------------------------------------------
  useEffect(() => {
    if (sourceMode !== 'sandbox' || !isPlaying) return;

    const dt = 0.025 * playbackSpeed;
    const interval = setInterval(() => {
      setSimTime((prev) => prev + dt);
      setPhaseTime((prevPhase) => {
        const nextPhase = prevPhase + dt;

        if (nextPhase >= stepPeriod) {
          // STEP TRIGGER EVENT: Transition to next footstep
          setStepCount((cnt) => cnt + 1);

          // Calculate foot landing point from Capture Point formulation
          const currentXiX = comX + velX / omega0;
          const currentXiY = comY + velY / omega0;
          const nextPivotX = currentXiX + targetSpeedX * 0.15;
          const nextIsLeft = !isLeftStance;
          const nextPivotY = comY + (nextIsLeft ? 1 : -1) * (stanceWidth / 2) + targetSpeedY * 0.1;

          setPivotX(nextPivotX);
          setPivotY(nextPivotY);
          setIsLeftStance(nextIsLeft);

          // Append to footprint history (keep last 8)
          const newFoot: Footprint = {
            id: 'f_' + Date.now(),
            x: nextPivotX,
            y: nextPivotY,
            stepIndex: stepCount + 1,
            isLeft: nextIsLeft,
            legLabel: nextIsLeft ? 'FL+RR' : 'FR+RL',
          };
          setFootprints((fp) => [...fp.slice(-7), newFoot]);

          return 0.0;
        }

        // Analytical integration of state within the current step phase
        // ddot(x) = omega0^2 * (x - px)
        const ddotX = Math.pow(omega0, 2) * (comX - pivotX);
        const ddotY = Math.pow(omega0, 2) * (comY - pivotY);

        const newVelX = velX + ddotX * dt;
        const newVelY = velY + ddotY * dt;
        const newComX = comX + newVelX * dt;
        const newComY = comY + newVelY * dt;

        setVelX(newVelX);
        setVelY(newVelY);
        setComX(newComX);
        setComY(newComY);

        // Update phase space rolling trail
        setPhaseTrail((tr) => [...tr.slice(-35), { dx: newComX - pivotX, vx: newVelX }]);

        return nextPhase;
      });
    }, 25);

    return () => clearInterval(interval);
  }, [
    sourceMode,
    isPlaying,
    playbackSpeed,
    stepPeriod,
    omega0,
    comX,
    comY,
    velX,
    velY,
    pivotX,
    pivotY,
    isLeftStance,
    stepCount,
    stanceWidth,
    targetSpeedX,
    targetSpeedY,
  ]);

  // Handle External Perturbations
  const applyPerturbation = (dvX: number, dvY: number, label: string) => {
    if (sourceMode === 'sandbox') {
      setVelX((vx) => vx + dvX);
      setVelY((vy) => vy + dvY);
      setPerturbationAlert(`Impulse Applied: ${label} (Δvx=${dvX > 0 ? '+' : ''}${dvX.toFixed(2)}m/s, Δvy=${dvY > 0 ? '+' : ''}${dvY.toFixed(2)}m/s)`);
      setTimeout(() => setPerturbationAlert(null), 3500);
    } else if (onUpdateConfig) {
      // In live telemetry mode, trigger the real physics simulation push!
      onUpdateConfig({
        externalPush: { fx: dvX * 100, fy: dvY * 100, decayRemaining: 1.0 },
      });
      setPerturbationAlert(`Live Physics Perturbation: Applied ${label} to Quadruped Simulation!`);
      setTimeout(() => setPerturbationAlert(null), 3500);
    }
  };

  // Reset sandbox pendulum
  const handleResetSandbox = () => {
    setComX(0.0);
    setComY(0.0);
    setVelX(targetSpeedX);
    setVelY(targetSpeedY);
    setPivotX(0.0);
    setPivotY(-stanceWidth / 2);
    setIsLeftStance(false);
    setPhaseTime(0.0);
    setStepCount(0);
    setPhaseTrail([]);
    setFootprints([
      { id: 'f0', x: -0.22, y: stanceWidth / 2, stepIndex: -1, isLeft: true, legLabel: 'FL+RR' },
      { id: 'f1', x: 0.0, y: -stanceWidth / 2, stepIndex: 0, isLeft: false, legLabel: 'FR+RL' },
    ]);
  };

  // -------------------------------------------------------------
  // Coordinate Transforms for SVG Rendering
  // -------------------------------------------------------------
  // Side Profile Canvas (Sagittal View): X horizontal, Z vertical
  const sideSvgW = 460;
  const sideSvgH = 260;
  const sideScale = 240; // pixels per meter
  const sideOriginX = 180;
  const sideGroundY = 220;

  const toSideSvgX = (xM: number) => sideOriginX + (xM - effectivePivotX) * sideScale;
  const toSideSvgZ = (zM: number) => sideGroundY - zM * sideScale;

  // Top-Down Horizontal Corridor: X forward (left to right), Y lateral (up/down)
  const topSvgW = 460;
  const topSvgH = 260;
  const topScale = 220; // pixels per meter
  const topCenterY = 130;
  const topCenterX = 220;

  const toTopSvgX = (xM: number) => topCenterX + (xM - effectiveComX) * topScale;
  const toTopSvgY = (yM: number) => topCenterY - (yM - effectiveComY) * topScale;

  // Phase Space Canvas: dx horizontal [-0.25, +0.25], vx vertical [-1.5, +1.5]
  const phaseSvgW = 340;
  const phaseSvgH = 210;
  const phaseCenterX = phaseSvgW / 2;
  const phaseCenterY = phaseSvgH / 2;
  const phaseScaleX = 550; // pixels per meter of offset
  const phaseScaleY = 55; // pixels per m/s of velocity

  const toPhaseSvgX = (dxM: number) => phaseCenterX + dxM * phaseScaleX;
  const toPhaseSvgY = (vxM: number) => phaseCenterY - vxM * phaseScaleY;

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. Header Toolbar: Mode Toggle, Presets, and Perturbations */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
              <Zap className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  LIPM Quadruped Locomotion &amp; Stepping Engine
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  Kajita 2001 · Pratt 2006
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Linear Inverted Pendulum Model: orbital energy conservation, Divergent Component of Motion (DCM), and Capture Point foot placement.
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-2">
            <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs font-mono">
              <button
                type="button"
                onClick={() => setSourceMode('sandbox')}
                className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                  sourceMode === 'sandbox'
                    ? 'bg-amber-500 text-slate-950 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                🔬 Interactive Sandbox
              </button>
              <button
                type="button"
                onClick={() => setSourceMode('live_telemetry')}
                className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                  sourceMode === 'live_telemetry'
                    ? 'bg-sky-600 text-white font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                📡 Live Quadruped Telemetry
              </button>
            </div>
          </div>
        </div>

        {/* Quick Actions & Impulse Perturbation Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px]">Gait Pattern:</span>
            <div className="flex items-center gap-1">
              {(['trot', 'walk', 'pace'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setLipmGait(g)}
                  className={`px-2 py-0.5 rounded uppercase text-[10px] transition-colors cursor-pointer ${
                    lipmGait === g
                      ? 'bg-slate-800 text-white font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-slate-200 mx-1" />

            {/* Playback Toggles (Sandbox only) */}
            {sourceMode === 'sandbox' && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsPlaying((p) => !p)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] cursor-pointer transition-colors ${
                    isPlaying
                      ? 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200'
                      : 'bg-emerald-600 text-white border-emerald-700 font-semibold'
                  }`}
                >
                  {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  <span>{isPlaying ? 'Pause' : 'Resume'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPlaybackSpeed((s) => (s === 1.0 ? 0.4 : s === 0.4 ? 0.2 : 1.0))}
                  className="px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 text-[10px] cursor-pointer"
                  title="Toggle playback speed (1.0x -> 0.4x -> 0.2x slow motion)"
                >
                  {playbackSpeed}x Speed
                </button>

                <button
                  type="button"
                  onClick={handleResetSandbox}
                  className="p-1 rounded bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 border border-slate-200 cursor-pointer"
                  title="Reset pendulum state"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Perturbation Buttons */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px] mr-1">Inject Push:</span>
            <button
              type="button"
              onClick={() => applyPerturbation(0, 0.45, 'Lateral Push +45N')}
              className="px-2 py-1 rounded bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 transition-colors cursor-pointer text-[11px] font-medium"
              title="Apply sudden lateral disturbance (+0.45 m/s)"
            >
              Lateral Push (+45N)
            </button>
            <button
              type="button"
              onClick={() => applyPerturbation(0, -0.45, 'Lateral Push -45N')}
              className="px-2 py-1 rounded bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 transition-colors cursor-pointer text-[11px] font-medium"
              title="Apply sudden lateral disturbance (-0.45 m/s)"
            >
              Lateral Push (-45N)
            </button>
            <button
              type="button"
              onClick={() => applyPerturbation(-0.4, 0, 'Head-On Brake (-35N)')}
              className="px-2 py-1 rounded bg-rose-50 text-rose-900 border border-rose-300 hover:bg-rose-100 transition-colors cursor-pointer text-[11px] font-medium"
              title="Apply sudden head-on deceleration impulse"
            >
              Brake Push (-35N)
            </button>
            <button
              type="button"
              onClick={() => applyPerturbation(0.4, 0, 'Forward Surge (+35N)')}
              className="px-2 py-1 rounded bg-emerald-50 text-emerald-900 border border-emerald-300 hover:bg-emerald-100 transition-colors cursor-pointer text-[11px] font-medium"
              title="Apply sudden forward acceleration impulse"
            >
              Surge Push (+35N)
            </button>
          </div>
        </div>

        {/* Dynamic Perturbation Banner */}
        {perturbationAlert && (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs font-mono flex items-center justify-between animate-in slide-in-from-top-1 duration-150">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 animate-spin" />
              <span>{perturbationAlert}</span>
            </div>
            <span className="text-[10px] text-amber-700 font-semibold">Active Balance Compensation</span>
          </div>
        )}
      </div>

      {/* 2. Main Visual Canvas Row: Sagittal Inverted Pendulum View & Top-Down Footstep Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Visualizer A: Sagittal Side Elevation (Physical Inverted Pendulum & Force Vectors) */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Sagittal Inverted Pendulum (Side Elevation)
                </h3>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  zc = {effectiveZc.toFixed(2)}m
                </span>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  isInsideFrictionCone ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}
              >
                {isInsideFrictionCone ? '✓ Friction Cone Safe' : '⚠ Foot Slip Risk'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-2">
              Mass concentrated at CoM height z_c. Ground Reaction Force (F_GRF) acts along virtual telescopic strut through ground pivot p.
            </p>

            <div className="relative w-full h-[260px] bg-slate-900 rounded-lg overflow-hidden border border-slate-800 select-none">
              <svg viewBox={`0 0 ${sideSvgW} ${sideSvgH}`} className="w-full h-full">
                {/* Background Grid */}
                <line x1={0} y1={sideGroundY} x2={sideSvgW} y2={sideGroundY} stroke="#475569" strokeWidth="2" />
                <line
                  x1={0}
                  y1={toSideSvgZ(effectiveZc)}
                  x2={sideSvgW}
                  y2={toSideSvgZ(effectiveZc)}
                  stroke="#0284C7"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                />
                <text x={10} y={toSideSvgZ(effectiveZc) - 6} fill="#38BDF8" fontSize="10" fontFamily="monospace">
                  Constraint Plane z = {effectiveZc.toFixed(2)} m
                </text>

                {/* Ground Hatch Pattern */}
                {Array.from({ length: 24 }).map((_, i) => (
                  <line
                    key={i}
                    x1={i * 20}
                    y1={sideGroundY}
                    x2={i * 20 - 10}
                    y2={sideGroundY + 12}
                    stroke="#334155"
                    strokeWidth="1"
                  />
                ))}

                {/* Ground Pivot Point p (ZMP) */}
                <circle cx={toSideSvgX(effectivePivotX)} cy={sideGroundY} r="7" fill="#F59E0B" />
                <circle cx={toSideSvgX(effectivePivotX)} cy={sideGroundY} r="12" fill="#F59E0B" opacity="0.25" />
                <text
                  x={toSideSvgX(effectivePivotX) + 10}
                  y={sideGroundY + 16}
                  fill="#FBBF24"
                  fontSize="11"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  Pivot p (ZMP)
                </text>

                {/* Friction Cone Polygon */}
                {(() => {
                  const px = toSideSvgX(effectivePivotX);
                  const coneH = 90;
                  const coneHalfW = coneH * frictionCoeff;
                  return (
                    <polygon
                      points={`${px},${sideGroundY} ${px - coneHalfW},${sideGroundY - coneH} ${px + coneHalfW},${sideGroundY - coneH}`}
                      fill="rgba(56, 189, 248, 0.08)"
                      stroke="#0284C7"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                  );
                })()}

                {/* Pendulum Telescoping Strut */}
                <line
                  x1={toSideSvgX(effectivePivotX)}
                  y1={sideGroundY}
                  x2={toSideSvgX(effectiveComX)}
                  y2={toSideSvgZ(effectiveZc)}
                  stroke="#38BDF8"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />

                {/* Gravity Vector mg (Amber) */}
                <line
                  x1={toSideSvgX(effectiveComX)}
                  y1={toSideSvgZ(effectiveZc)}
                  x2={toSideSvgX(effectiveComX)}
                  y2={toSideSvgZ(effectiveZc) + 45}
                  stroke="#F59E0B"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <polygon
                  points={`${toSideSvgX(effectiveComX)},${toSideSvgZ(effectiveZc) + 50} ${toSideSvgX(effectiveComX) - 4},${toSideSvgZ(effectiveZc) + 42} ${toSideSvgX(effectiveComX) + 4},${toSideSvgZ(effectiveZc) + 42}`}
                  fill="#F59E0B"
                />
                <text x={toSideSvgX(effectiveComX) + 6} y={toSideSvgZ(effectiveZc) + 36} fill="#FCD34D" fontSize="10" fontFamily="monospace">
                  mg ({(robotMassKg * 9.81).toFixed(0)}N)
                </text>

                {/* Horizontal Acceleration Vector ddot(x) (Rose) */}
                {Math.abs(accelX) > 0.1 && (
                  <g>
                    <line
                      x1={toSideSvgX(effectiveComX)}
                      y1={toSideSvgZ(effectiveZc)}
                      x2={toSideSvgX(effectiveComX) + Math.min(80, Math.max(-80, accelX * 18))}
                      y2={toSideSvgZ(effectiveZc)}
                      stroke="#F43F5E"
                      strokeWidth="2"
                    />
                    <text
                      x={toSideSvgX(effectiveComX) + (accelX > 0 ? 15 : -65)}
                      y={toSideSvgZ(effectiveZc) - 12}
                      fill="#FDA4AF"
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      ddot(x) = {accelX.toFixed(2)} m/s²
                    </text>
                  </g>
                )}

                {/* Velocity Vector (Emerald) */}
                <line
                  x1={toSideSvgX(effectiveComX)}
                  y1={toSideSvgZ(effectiveZc)}
                  x2={toSideSvgX(effectiveComX) + Math.min(60, effectiveVelX * 28)}
                  y2={toSideSvgZ(effectiveZc)}
                  stroke="#10B981"
                  strokeWidth="2.5"
                />

                {/* CoM Mass Sphere (Glowing Blue) */}
                <circle cx={toSideSvgX(effectiveComX)} cy={toSideSvgZ(effectiveZc)} r="14" fill="#0284C7" opacity="0.3" />
                <circle cx={toSideSvgX(effectiveComX)} cy={toSideSvgZ(effectiveZc)} r="9" fill="#0EA5E9" stroke="#FFFFFF" strokeWidth="2" />
                <text
                  x={toSideSvgX(effectiveComX) + 12}
                  y={toSideSvgZ(effectiveZc) + 4}
                  fill="#FFFFFF"
                  fontSize="11"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  CoM ({robotMassKg}kg)
                </text>

                {/* Ground Projected CoM */}
                <line
                  x1={toSideSvgX(effectiveComX)}
                  y1={toSideSvgZ(effectiveZc)}
                  x2={toSideSvgX(effectiveComX)}
                  y2={sideGroundY}
                  stroke="#64748B"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <circle cx={toSideSvgX(effectiveComX)} cy={sideGroundY} r="4" fill="#38BDF8" />

                {/* Capture Point / DCM Marker on Ground (Purple) */}
                <circle cx={toSideSvgX(capturePointX)} cy={sideGroundY} r="6" fill="#A855F7" />
                <line
                  x1={toSideSvgX(capturePointX)}
                  y1={sideGroundY - 8}
                  x2={toSideSvgX(capturePointX)}
                  y2={sideGroundY + 8}
                  stroke="#C084FC"
                  strokeWidth="2"
                />
                <text
                  x={toSideSvgX(capturePointX) - 10}
                  y={sideGroundY - 12}
                  fill="#D8B4FE"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  ξ (Capture Point)
                </text>

                {/* Capture Distance Bracket */}
                <line
                  x1={toSideSvgX(effectiveComX)}
                  y1={sideGroundY + 6}
                  x2={toSideSvgX(capturePointX)}
                  y2={sideGroundY + 6}
                  stroke="#C084FC"
                  strokeWidth="1"
                />
              </svg>

              {/* Floating Stat Overlay */}
              <div className="absolute top-2 right-2 p-2 rounded bg-slate-900/90 border border-slate-800 text-[10px] font-mono text-slate-300 space-y-0.5">
                <div>Natural Freq ω₀: <strong className="text-amber-400">{effectiveOmega0.toFixed(2)} rad/s</strong></div>
                <div>Time Const τ: <strong className="text-cyan-400">{timeConstant.toFixed(3)} s</strong></div>
                <div>Pendulum Angle θ: <strong className={isInsideFrictionCone ? 'text-emerald-400' : 'text-rose-400'}>{pendulumAngleDeg.toFixed(1)}°</strong> (max {maxFrictionAngleDeg.toFixed(1)}°)</div>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-mono text-slate-500">
            <span>Height Constraint Plane: zc = {effectiveZc.toFixed(2)} m</span>
            <span>GRF: {(robotMassKg * 9.81 * (1 / Math.cos((pendulumAngleDeg * Math.PI) / 180))).toFixed(1)} N</span>
          </div>
        </div>

        {/* Visualizer B: Top-Down Stepping & Footfall Planner Map */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Horizontal Stepping &amp; Capture Foot Placement
                </h3>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 border border-sky-200">
                  Step #{stepCount} · {isLeftStance ? 'FL+RR Stance' : 'FR+RL Stance'}
                </span>
              </div>
              <span className="text-xs font-mono text-slate-500">
                Phase: {Math.round((phaseTime / stepPeriod) * 100)}%
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-2">
              Foot placement formula p_next = ξ(T) - (v_des / ω₀) automatically steps to absorb perturbations and track desired forward velocity.
            </p>

            <div className="relative w-full h-[260px] bg-slate-900 rounded-lg overflow-hidden border border-slate-800 select-none">
              <svg viewBox={`0 0 ${topSvgW} ${topSvgH}`} className="w-full h-full">
                {/* Center Corridor Guideline */}
                <line x1={0} y1={topCenterY} x2={topSvgW} y2={topCenterY} stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />

                {/* Stance Rails */}
                <line x1={0} y1={topCenterY - (stanceWidth / 2) * topScale} x2={topSvgW} y2={topCenterY - (stanceWidth / 2) * topScale} stroke="#1E293B" strokeWidth="1" />
                <line x1={0} y1={topCenterY + (stanceWidth / 2) * topScale} x2={topSvgW} y2={topCenterY + (stanceWidth / 2) * topScale} stroke="#1E293B" strokeWidth="1" />

                {/* Past Footprint History */}
                {footprints.map((fp) => {
                  const fx = toTopSvgX(fp.x);
                  const fy = toTopSvgY(fp.y);
                  const isCurrent = Math.abs(fp.x - effectivePivotX) < 0.01 && Math.abs(fp.y - effectivePivotY) < 0.01;
                  return (
                    <g key={fp.id}>
                      <rect
                        x={fx - 14}
                        y={fy - 7}
                        width="28"
                        height="14"
                        rx="4"
                        fill={isCurrent ? '#F59E0B' : fp.isLeft ? '#0284C7' : '#0EA5E9'}
                        opacity={isCurrent ? 0.9 : 0.45}
                        stroke={isCurrent ? '#FFFFFF' : '#38BDF8'}
                        strokeWidth={isCurrent ? 2 : 1}
                      />
                      <text x={fx} y={fy + 3} fill="#FFFFFF" fontSize="8" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                        {fp.legLabel}
                      </text>
                    </g>
                  );
                })}

                {/* Support Line connecting active pivot pair */}
                <line
                  x1={toTopSvgX(effectivePivotX)}
                  y1={toTopSvgY(effectivePivotY)}
                  x2={toTopSvgX(effectiveComX)}
                  y2={toTopSvgY(effectiveComY)}
                  stroke="#F59E0B"
                  strokeWidth="2"
                  strokeDasharray="3 2"
                />

                {/* Next Predicted Landing Footprint (Purple Target) */}
                {sourceMode === 'sandbox' && (
                  <g>
                    <rect
                      x={toTopSvgX(nextTargetFootX) - 16}
                      y={toTopSvgY(nextTargetFootY) - 8}
                      width="32"
                      height="16"
                      rx="4"
                      fill="none"
                      stroke="#C084FC"
                      strokeWidth="2"
                      strokeDasharray="4 2"
                    />
                    <text
                      x={toTopSvgX(nextTargetFootX)}
                      y={toTopSvgY(nextTargetFootY) + 3}
                      fill="#D8B4FE"
                      fontSize="8"
                      fontFamily="monospace"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      p_next
                    </text>
                  </g>
                )}

                {/* CoM Position on Top-Down Canvas */}
                <circle cx={toTopSvgX(effectiveComX)} cy={toTopSvgY(effectiveComY)} r="8" fill="#38BDF8" stroke="#FFFFFF" strokeWidth="2" />
                <text
                  x={toTopSvgX(effectiveComX) + 12}
                  y={toTopSvgY(effectiveComY) + 3}
                  fill="#38BDF8"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  CoM
                </text>

                {/* CoM Velocity Vector Arrow */}
                <line
                  x1={toTopSvgX(effectiveComX)}
                  y1={toTopSvgY(effectiveComY)}
                  x2={toTopSvgX(effectiveComX) + effectiveVelX * 35}
                  y2={toTopSvgY(effectiveComY) - effectiveVelY * 35}
                  stroke="#10B981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Capture Point Marker on Horizontal Plane (Purple Diamond) */}
                <g>
                  <circle cx={toTopSvgX(capturePointX)} cy={toTopSvgY(capturePointY)} r="6" fill="#A855F7" />
                  <circle cx={toTopSvgX(capturePointX)} cy={toTopSvgY(capturePointY)} r="10" fill="none" stroke="#C084FC" strokeWidth="1" />
                  <text
                    x={toTopSvgX(capturePointX) + 10}
                    y={toTopSvgY(capturePointY) - 8}
                    fill="#E9D5FF"
                    fontSize="10"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    DCM (ξ)
                  </text>
                </g>

                {/* Lead Vector from CoM to DCM */}
                <line
                  x1={toTopSvgX(effectiveComX)}
                  y1={toTopSvgY(effectiveComY)}
                  x2={toTopSvgX(capturePointX)}
                  y2={toTopSvgY(capturePointY)}
                  stroke="#C084FC"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                />
              </svg>

              {/* Status Pill in Canvas */}
              <div className="absolute bottom-2 left-2 p-2 rounded bg-slate-900/90 border border-slate-800 text-[10px] font-mono text-slate-300 space-y-0.5">
                <div>CoM Position: <strong className="text-sky-400">[{effectiveComX.toFixed(2)}, {effectiveComY.toFixed(2)}] m</strong></div>
                <div>Velocity: <strong className="text-emerald-400">{effectiveVelX.toFixed(2)} m/s</strong> (v_des={targetSpeedX.toFixed(2)})</div>
                <div>Capture Point (ξ): <strong className="text-purple-400">[{capturePointX.toFixed(2)}, {capturePointY.toFixed(2)}] m</strong></div>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-mono text-slate-500">
            <span>DCM Lead: {((effectiveVelX / effectiveOmega0) * 100).toFixed(1)} cm ahead of CoM</span>
            <span>Target Speed: {targetSpeedX.toFixed(2)} m/s</span>
          </div>
        </div>
      </div>

      {/* 3. Bottom Row: Phase Portrait Diagram & Live Mathematical Formulation Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Phase Space Hyperbolic Portrait (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Phase Portrait: (x - p, ẋ) Hyperbolic Orbits
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                E_orb = {orbitalEnergyX.toFixed(3)} J/kg
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-2">
              Hyperbolic trajectories in (x - p, ẋ) phase plane. Green line is the stable eigenvector (ẋ = -ω₀ Δx), red is unstable (ẋ = +ω₀ Δx).
            </p>

            <div className="relative w-full h-[210px] bg-slate-900 rounded-lg overflow-hidden border border-slate-800 select-none">
              <svg viewBox={`0 0 ${phaseSvgW} ${phaseSvgH}`} className="w-full h-full">
                {/* Grid Axes */}
                <line x1={0} y1={phaseCenterY} x2={phaseSvgW} y2={phaseCenterY} stroke="#475569" strokeWidth="1" />
                <line x1={phaseCenterX} y1={0} x2={phaseCenterX} y2={phaseSvgH} stroke="#475569" strokeWidth="1" />
                <text x={phaseSvgW - 40} y={phaseCenterY - 6} fill="#94A3B8" fontSize="9" fontFamily="monospace">
                  +Δx (m)
                </text>
                <text x={phaseCenterX + 6} y={14} fill="#94A3B8" fontSize="9" fontFamily="monospace">
                  +v (m/s)
                </text>

                {/* Stable Asymptote: v = -omega0 * dx (Green) */}
                <line
                  x1={toPhaseSvgX(-0.25)}
                  y1={toPhaseSvgY(0.25 * effectiveOmega0)}
                  x2={toPhaseSvgX(0.25)}
                  y2={toPhaseSvgY(-0.25 * effectiveOmega0)}
                  stroke="#10B981"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />

                {/* Unstable Asymptote: v = +omega0 * dx (Red) */}
                <line
                  x1={toPhaseSvgX(-0.25)}
                  y1={toPhaseSvgY(-0.25 * effectiveOmega0)}
                  x2={toPhaseSvgX(0.25)}
                  y2={toPhaseSvgY(0.25 * effectiveOmega0)}
                  stroke="#EF4444"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />

                {/* Background Hyperbolic Streamlines (E_orb levels) */}
                {[-0.4, -0.15, 0.15, 0.4].map((eLvl) => {
                  const pts: string[] = [];
                  for (let dx = -0.22; dx <= 0.22; dx += 0.02) {
                    const v2 = 2 * eLvl + Math.pow(effectiveOmega0, 2) * Math.pow(dx, 2);
                    if (v2 >= 0) {
                      const vPos = Math.sqrt(v2);
                      pts.push(`${toPhaseSvgX(dx)},${toPhaseSvgY(vPos)}`);
                    }
                  }
                  if (pts.length < 2) return null;
                  return (
                    <polyline
                      key={'h_' + eLvl}
                      points={pts.join(' ')}
                      fill="none"
                      stroke="#334155"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                  );
                })}

                {/* Phase Trail History */}
                {phaseTrail.map((pt, idx) => {
                  if (idx === 0) return null;
                  const prev = phaseTrail[idx - 1];
                  const alpha = (idx / phaseTrail.length) * 0.8;
                  return (
                    <line
                      key={'pt_' + idx}
                      x1={toPhaseSvgX(prev.dx)}
                      y1={toPhaseSvgY(prev.vx)}
                      x2={toPhaseSvgX(pt.dx)}
                      y2={toPhaseSvgY(pt.vx)}
                      stroke="#F59E0B"
                      strokeWidth="1.5"
                      strokeOpacity={alpha}
                    />
                  );
                })}

                {/* Current State Marker on Phase Plane */}
                <circle cx={toPhaseSvgX(relX)} cy={toPhaseSvgY(effectiveVelX)} r="6" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="1.5" />
                <circle cx={toPhaseSvgX(relX)} cy={toPhaseSvgY(effectiveVelX)} r="11" fill="#F59E0B" opacity="0.25" />
              </svg>

              {/* Inset Orbital Energy Gauge Indicator */}
              <div className="absolute bottom-2 right-2 p-2 rounded bg-slate-900/90 border border-slate-800 text-[10px] font-mono text-slate-300">
                <div>Δx = <strong className="text-slate-100">{relX.toFixed(3)} m</strong></div>
                <div>vx = <strong className="text-emerald-400">{effectiveVelX.toFixed(2)} m/s</strong></div>
                <div>Regime: <strong className={orbitalEnergyX > 0 ? 'text-amber-400' : 'text-rose-400'}>
                  {orbitalEnergyX > 0 ? 'Forward Pass-Through' : 'Sub-Critical Turnaround'}
                </strong></div>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-mono text-slate-500">
            <span>Stable Line: v = -{effectiveOmega0.toFixed(2)}·Δx</span>
            <span>Unstable Line: v = +{effectiveOmega0.toFixed(2)}·Δx</span>
          </div>
        </div>

        {/* Live Mathematical Formulations & Interactive Parameter Sliders (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Interactive LIPM Dynamics &amp; Parameter Controls
            </h3>
            <span className="text-xs font-mono text-sky-700 font-semibold">
              Closed-Form Preview Control
            </span>
          </div>

          {/* Sliders Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
            {/* Height Slider */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">CoM Height (z_c):</span>
                <span className="text-sky-700 font-bold">{zc.toFixed(2)} m</span>
              </div>
              <input
                type="range"
                min="0.18"
                max="0.50"
                step="0.01"
                value={zc}
                onChange={(e) => setZc(parseFloat(e.target.value))}
                disabled={sourceMode === 'live_telemetry'}
                className="w-full accent-sky-600 cursor-pointer disabled:opacity-50"
              />
              <div className="text-[10px] text-slate-400 flex justify-between">
                <span>0.18m (Crouch)</span>
                <span>0.50m (Tall)</span>
              </div>
            </div>

            {/* Step Duration Slider */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Step Period (T_step):</span>
                <span className="text-amber-700 font-bold">{stepPeriod.toFixed(2)} s</span>
              </div>
              <input
                type="range"
                min="0.18"
                max="0.65"
                step="0.01"
                value={stepPeriod}
                onChange={(e) => setStepPeriod(parseFloat(e.target.value))}
                disabled={sourceMode === 'live_telemetry'}
                className="w-full accent-amber-600 cursor-pointer disabled:opacity-50"
              />
              <div className="text-[10px] text-slate-400 flex justify-between">
                <span>0.18s (Fast Trot)</span>
                <span>0.65s (Slow Walk)</span>
              </div>
            </div>

            {/* Desired Forward Speed */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Desired Speed (v_x,des):</span>
                <span className="text-emerald-700 font-bold">{targetSpeedX.toFixed(2)} m/s</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.8"
                step="0.05"
                value={targetSpeedX}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setTargetSpeedX(val);
                  if (sourceMode === 'sandbox') setVelX(val);
                }}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="text-[10px] text-slate-400 flex justify-between">
                <span>0.0 m/s (Halt)</span>
                <span>1.8 m/s (Fast)</span>
              </div>
            </div>

            {/* Stance Width */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Stance Width (W_stance):</span>
                <span className="text-indigo-700 font-bold">{stanceWidth.toFixed(2)} m</span>
              </div>
              <input
                type="range"
                min="0.16"
                max="0.36"
                step="0.01"
                value={stanceWidth}
                onChange={(e) => setStanceWidth(parseFloat(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="text-[10px] text-slate-400 flex justify-between">
                <span>0.16m (Narrow)</span>
                <span>0.36m (Wide Base)</span>
              </div>
            </div>
          </div>

          {/* Mathematical Formulations Display Card */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs font-mono">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center justify-between">
              <span>LIPM Closed-Form Equations of Motion</span>
              <span className="text-sky-600 font-normal">Kajita (2001) Formulation</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 bg-white rounded border border-slate-200">
                <div className="text-slate-400 text-[10px]">Differential Equation:</div>
                <div className="font-bold text-slate-800 mt-0.5">
                  ẍ = ω₀² (x - p_x) = (g / z_c)(x - p_x)
                </div>
              </div>

              <div className="p-2 bg-white rounded border border-slate-200">
                <div className="text-slate-400 text-[10px]">Capture Point (DCM):</div>
                <div className="font-bold text-purple-700 mt-0.5">
                  ξ = x + (ẋ / ω₀) = {capturePointX.toFixed(2)} m
                </div>
              </div>

              <div className="p-2 bg-white rounded border border-slate-200">
                <div className="text-slate-400 text-[10px]">Next Footstep Location:</div>
                <div className="font-bold text-indigo-700 mt-0.5">
                  p_next = ξ(T) - (v_des / ω₀) = {nextTargetFootX.toFixed(2)} m
                </div>
              </div>

              <div className="p-2 bg-white rounded border border-slate-200">
                <div className="text-slate-400 text-[10px]">Orbital Energy Invariant:</div>
                <div className="font-bold text-amber-700 mt-0.5">
                  E = ½ ẋ² - ½ ω₀² (x - p)² = {orbitalEnergyX.toFixed(2)} J/kg
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
