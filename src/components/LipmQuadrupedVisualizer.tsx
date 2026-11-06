import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Compass,
  Layers,
  RotateCcw,
  ShieldCheck,
  Sigma,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  SimControlConfig,
  SimulationStateFrame,
} from '../physics/roboticsEngine';

export interface LipmQuadrupedVisualizerProps {
  portion1Frame: SimulationStateFrame;
  portion1Config: SimControlConfig;
  portion2Frame: SimulationStateFrame;
  portion2Config: SimControlConfig;
  activePortionSource: 'dynamic' | 'mathematical';
  onSwitchPortionSource: (src: 'dynamic' | 'mathematical') => void;
  onApplyPush?: (fx: number, fy: number) => void;
  onUpdateConfig?: (partial: Partial<SimControlConfig>) => void;
}

export type LipmViewMode = 'cockpit' | 'sagittal' | 'coronal' | 'overhead' | 'phase_portrait';

export const LipmQuadrupedVisualizer: React.FC<LipmQuadrupedVisualizerProps> = ({
  portion1Frame,
  portion1Config,
  portion2Frame,
  portion2Config,
  activePortionSource,
  onSwitchPortionSource,
  onApplyPush,
  onUpdateConfig,
}) => {
  const [viewMode, setViewMode] = useState<LipmViewMode>('cockpit');
  const [showDualCompare, setShowDualCompare] = useState<boolean>(false);
  const [cartHeightOverride, setCartHeightOverride] = useState<number>(0.30);
  const [phaseHistory, setPhaseHistory] = useState<{ x: number; vNorm: number; time: number }[]>([]);

  // Toggles for visual layers
  const [layers, setLayers] = useState({
    pendulumRod: true,
    forceVectors: true,
    capturePoint: true,
    quadrupedChassis: true,
    previewHorizon: true,
    phaseTrail: true,
  });

  const activeFrame = activePortionSource === 'dynamic' ? portion1Frame : portion2Frame;
  const activeConfig = activePortionSource === 'dynamic' ? portion1Config : portion2Config;
  const isDynamic = activePortionSource === 'dynamic';

  // Gravitational constant & LIPM Cart-Table Parameters
  const g = 9.81;
  const zc = cartHeightOverride || 0.30;
  const omega = Math.sqrt(g / Math.max(0.05, zc)); // Natural frequency (rad/s)
  const eigenPeriod = (2 * Math.PI) / omega; // Eigen-period of pendulum (s)

  // Primary Kinematics
  const com = activeFrame.com;
  const vel = activeFrame.comVel;
  const speed = Math.hypot(vel[0], vel[1]);
  const zmp = activeFrame.zmpActual || [com[0], com[1]];
  const zmpRef = activeFrame.zmpRef || [com[0], com[1]];

  // Inverted Pendulum Displacements
  const dX = com[0] - zmp[0];
  const dY = com[1] - zmp[1];
  const rodLength = Math.sqrt(Math.pow(dX, 2) + Math.pow(dY, 2) + Math.pow(com[2], 2));

  // Instantaneous Capture Point (DCM - Divergent Component of Motion)
  // xi = x + v / omega
  const xiX = com[0] + vel[0] / omega;
  const xiY = com[1] + vel[1] / omega;

  // Orbital Energy: E = 0.5 * v^2 - (g / (2*zc)) * (x - p)^2
  const orbitalEnergyX = 0.5 * Math.pow(vel[0], 2) - (g / (2 * zc)) * Math.pow(dX, 2);
  const orbitalEnergyY = 0.5 * Math.pow(vel[1], 2) - (g / (2 * zc)) * Math.pow(dY, 2);
  const totalOrbitalEnergy = orbitalEnergyX + orbitalEnergyY;

  // Sagittal (X-Z) and Coronal (Y-Z) Pendulum Angles
  const thetaSagittalDeg = (Math.atan2(dX, Math.max(0.05, com[2])) * 180) / Math.PI;
  const thetaCoronalDeg = (Math.atan2(dY, Math.max(0.05, com[2])) * 180) / Math.PI;

  // Secondary Compare Frame Kinematics (for Dual Compare Mode)
  const compareFrame = isDynamic ? portion2Frame : portion1Frame;
  const compCom = compareFrame.com;
  const compVel = compareFrame.comVel;
  const compZmp = compareFrame.zmpActual || [compCom[0], compCom[1]];
  const compXiX = compCom[0] + compVel[0] / omega;
  const compXiY = compCom[1] + compVel[1] / omega;

  // Rolling Phase Plane Trail Buffer
  useEffect(() => {
    const item = {
      x: dX,
      vNorm: vel[0] / omega,
      time: activeFrame.simTime,
    };
    setPhaseHistory((prev) => [...prev.slice(-60), item]);
  }, [dX, vel, omega, activeFrame.simTime]);

  // Handle Push Impulse
  const handleTriggerPush = (fx: number, fy: number) => {
    if (onApplyPush) {
      onApplyPush(fx, fy);
    } else if (onUpdateConfig) {
      onUpdateConfig({
        externalPush: { fx, fy, decayRemaining: 1.0 },
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Educational Confirmation Banner: YES, LIPM IS USED */}
      <div className="bg-gradient-to-r from-sky-50 via-indigo-50 to-emerald-50 border border-sky-200 rounded-xl p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-sky-600 text-white shadow-2xs shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Yes, Active 3D Linear Inverted Pendulum Model (LIPM) Control is Deployed Here
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-100 text-sky-800 border border-sky-300">
                  Kajita Cart-Table
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed max-w-4xl">
                The quadruped’s multi-body mass is reduced to an equivalent <strong>Inverted Pendulum with constant CoM height constraint (zc = {zc.toFixed(2)} m)</strong>.
                Dynamic balance is governed by <span className="font-mono font-semibold text-slate-800">ẍ = ω²(x - p_ZMP)</span> where <span className="font-mono font-semibold text-slate-800">ω = √(g/zc) = {omega.toFixed(2)} rad/s</span>.
                The ground anchor tracks the Center of Pressure (ZMP), while the instantaneous <strong>Capture Point (DCM ξ = x + v/ω)</strong> dictates where feet must step to arrest horizontal momentum.
              </p>
            </div>
          </div>

          {/* Quick Dual-Portion Comparison Button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowDualCompare((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                showDualCompare
                  ? 'bg-indigo-600 text-white border-indigo-700 font-semibold shadow-xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{showDualCompare ? 'Exit Dual View' : 'Compare Portions Side-by-Side'}</span>
            </button>
          </div>
        </div>

        {/* Dynamic vs Math Solver Comparison Chips */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-3 border-t border-sky-200/60 text-xs">
          <div className={`p-2.5 rounded-lg border ${isDynamic ? 'bg-amber-50/80 border-amber-300 ring-1 ring-amber-200' : 'bg-white/80 border-slate-200'}`}>
            <div className="flex items-center justify-between font-semibold mb-1">
              <span className="flex items-center gap-1 text-amber-900">
                <Zap className="w-3.5 h-3.5 text-amber-600" /> Portion 1: Dynamic Contact Solver
              </span>
              <span className="text-[10px] font-mono text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                240 Hz Rigid-Body
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug">
              LIPM preview control feeds desired CoM accelerations. Actual ground reaction forces ($F_n$), Coulomb friction cones ($\mu$), and contact compliance generate real-world settling and foot micro-slip.
            </p>
          </div>

          <div className={`p-2.5 rounded-lg border ${!isDynamic ? 'bg-sky-50/80 border-sky-300 ring-1 ring-sky-200' : 'bg-white/80 border-slate-200'}`}>
            <div className="flex items-center justify-between font-semibold mb-1">
              <span className="flex items-center gap-1 text-sky-900">
                <Sigma className="w-3.5 h-3.5 text-sky-600" /> Portion 2: Mathematical Closed-Form
              </span>
              <span className="text-[10px] font-mono text-sky-700 bg-sky-100 px-1.5 py-0.2 rounded">
                Hyperbolic &amp; Fuzzy
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug">
              Exact hyperbolic integration <span className="font-mono text-slate-800">$x(t) = x_0\cosh(\omega t) + \frac&#123;\dot&#123;x&#125;_0&#125;&#123;\omega&#125;\sinh(\omega t)$</span> with exact constant height constraint ($z \equiv z_c$) and Mamdani Fuzzy lateral roll stabilization.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Top Control Bar: Portion Switcher, View Selector, Push Impulse */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        {/* Left: Source Portion Switcher */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Inspected Model:
          </span>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-mono">
            <button
              type="button"
              onClick={() => onSwitchPortionSource('dynamic')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors cursor-pointer ${
                isDynamic
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>Portion 1 (Dynamic)</span>
            </button>
            <button
              type="button"
              onClick={() => onSwitchPortionSource('mathematical')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors cursor-pointer ${
                !isDynamic
                  ? 'bg-sky-600 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Sigma className="w-3 h-3" />
              <span>Portion 2 (Math)</span>
            </button>
          </div>
        </div>

        {/* Center: View Projection Selector */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-mono">
          {(
            [
              { id: 'cockpit', label: 'Multi-View Cockpit' },
              { id: 'sagittal', label: 'Sagittal (X-Z)' },
              { id: 'coronal', label: 'Coronal (Y-Z)' },
              { id: 'overhead', label: 'Support Radar (X-Y)' },
              { id: 'phase_portrait', label: 'Phase Plane' },
            ] as { id: LipmViewMode; label: string }[]
          ).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setViewMode(v.id)}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === v.id
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Right: Quick Action Buttons (Push Perturbation) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleTriggerPush(0, 65)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 transition-colors text-xs font-mono font-semibold cursor-pointer shadow-2xs"
            title="Apply 65 N lateral force to perturb the pendulum and observe orbital recovery"
          >
            <span>+65N Lateral Push</span>
          </button>
          <button
            type="button"
            onClick={() => handleTriggerPush(80, 0)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 text-sky-900 border border-sky-300 hover:bg-sky-100 transition-colors text-xs font-mono font-semibold cursor-pointer shadow-2xs"
            title="Apply 80 N forward thrust to test forward capture point excursion"
          >
            <span>+80N Forward Push</span>
          </button>
        </div>
      </div>

      {/* 3. Real-Time LIPM Pendulum State Telemetry Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs font-mono">
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
          <div className="text-[10px] uppercase text-slate-500 font-semibold">Natural Frequency $\omega$</div>
          <div className="text-base font-bold text-sky-700 mt-0.5">{omega.toFixed(2)} <span className="text-xs font-normal text-slate-500">rad/s</span></div>
          <div className="text-[10px] text-slate-400 mt-1">Eigen-Period: {eigenPeriod.toFixed(2)} s</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
          <div className="text-[10px] uppercase text-slate-500 font-semibold">Telescopic Rod $L$</div>
          <div className="text-base font-bold text-slate-800 mt-0.5">{(rodLength * 100).toFixed(1)} <span className="text-xs font-normal text-slate-500">cm</span></div>
          <div className="text-[10px] text-slate-400 mt-1">Height $z_c$: {(com[2] * 100).toFixed(1)} cm</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
          <div className="text-[10px] uppercase text-slate-500 font-semibold">Pendulum Angles</div>
          <div className="text-base font-bold text-indigo-700 mt-0.5">
            {thetaSagittalDeg > 0 ? '+' : ''}{thetaSagittalDeg.toFixed(1)}° <span className="text-xs font-normal text-slate-400">/</span> {thetaCoronalDeg > 0 ? '+' : ''}{thetaCoronalDeg.toFixed(1)}°
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Sagittal (X) / Coronal (Y)</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
          <div className="text-[10px] uppercase text-slate-500 font-semibold">Capture Point (DCM $\xi$)</div>
          <div className="text-base font-bold text-emerald-700 mt-0.5">
            [{xiX.toFixed(2)}, {xiY.toFixed(2)}] <span className="text-xs font-normal text-slate-500">m</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Distance to CoM: {(Math.hypot(xiX - com[0], xiY - com[1]) * 100).toFixed(1)} cm</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
          <div className="text-[10px] uppercase text-slate-500 font-semibold">Total Orbital Energy $E$</div>
          <div className={`text-base font-bold mt-0.5 ${totalOrbitalEnergy >= 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
            {totalOrbitalEnergy.toFixed(3)} <span className="text-xs font-normal text-slate-500">J/kg</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            {totalOrbitalEnergy >= 0 ? 'Divergent (Needs Step)' : 'Bounded (Recovers)'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
          <div className="text-[10px] uppercase text-slate-500 font-semibold">ZMP Tracking Error</div>
          <div className="text-base font-bold text-slate-800 mt-0.5">
            {(Math.hypot(zmp[0] - zmpRef[0], zmp[1] - zmpRef[1]) * 100).toFixed(1)} <span className="text-xs font-normal text-slate-500">cm</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Signed Margin: {((activeFrame.zmpDiagnostics?.signedMarginM ?? 0.04) * 100).toFixed(1)} cm</div>
        </div>
      </div>

      {/* 4. Main LIPM Simulation Canvas Area */}
      {showDualCompare ? (
        /* DUAL PORTION SYNCHRONIZED COMPARISON VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Portion 1 (Dynamic) */}
          <div className="bg-white border border-amber-200 rounded-2xl p-4 shadow-sm flex flex-col space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-amber-100">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-amber-900">
                  Portion 1: Dynamic Contact Physics Model
                </h4>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                Δz compliance: {((portion1Frame.com[2] - zc) * 1000).toFixed(1)} mm
              </span>
            </div>

            <LipmSingleCanvas
              frame={portion1Frame}
              config={portion1Config}
              zc={zc}
              omega={omega}
              viewMode="sagittal"
              layers={layers}
              accentColor="#D97706"
              label="Portion 1 (Dynamic)"
            />

            <div className="grid grid-cols-3 gap-2 text-[11px] font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <div><span className="text-slate-500">CoM X:</span> <strong className="text-slate-800">{portion1Frame.com[0].toFixed(2)}m</strong></div>
              <div><span className="text-slate-500">Speed:</span> <strong className="text-slate-800">{portion1Frame.speedMps.toFixed(2)}m/s</strong></div>
              <div><span className="text-slate-500">ZMP Margin:</span> <strong className="text-emerald-700">{((portion1Frame.zmpDiagnostics?.signedMarginM ?? 0.04) * 100).toFixed(1)}cm</strong></div>
            </div>
          </div>

          {/* Right: Portion 2 (Mathematical) */}
          <div className="bg-white border border-sky-200 rounded-2xl p-4 shadow-sm flex flex-col space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-sky-100">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
                <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-sky-900">
                  Portion 2: Mathematical Closed-Form LIPM
                </h4>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200">
                Height: z ≡ {zc.toFixed(2)} m
              </span>
            </div>

            <LipmSingleCanvas
              frame={portion2Frame}
              config={portion2Config}
              zc={zc}
              omega={omega}
              viewMode="sagittal"
              layers={layers}
              accentColor="#0284C7"
              label="Portion 2 (Math)"
            />

            <div className="grid grid-cols-3 gap-2 text-[11px] font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <div><span className="text-slate-500">CoM X:</span> <strong className="text-slate-800">{portion2Frame.com[0].toFixed(2)}m</strong></div>
              <div><span className="text-slate-500">Speed:</span> <strong className="text-slate-800">{portion2Frame.speedMps.toFixed(2)}m/s</strong></div>
              <div><span className="text-slate-500">ZMP Margin:</span> <strong className="text-emerald-700">{((portion2Frame.zmpDiagnostics?.signedMarginM ?? 0.04) * 100).toFixed(1)}cm</strong></div>
            </div>
          </div>
        </div>
      ) : viewMode === 'cockpit' ? (
        /* MULTI-VIEW COCKPIT (Sagittal + Coronal + Top-Down Support) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Sagittal (Side X-Z) View (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-800">
                  Sagittal Inverted Pendulum View (Side: X-Z)
                </h4>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  Cart Height $z_c = {zc.toFixed(2)}\,\text&#123;m&#125;$
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className="text-emerald-700 font-semibold">Rod Tilt: {thetaSagittalDeg.toFixed(1)}°</span>
                <span className="text-slate-400">·</span>
                <span className="text-sky-700 font-semibold">Capture $\xi_x$: {xiX.toFixed(2)}m</span>
              </div>
            </div>

            <LipmSingleCanvas
              frame={activeFrame}
              config={activeConfig}
              zc={zc}
              omega={omega}
              viewMode="sagittal"
              layers={layers}
              accentColor={isDynamic ? '#D97706' : '#0284C7'}
              label={`${activePortionSource.toUpperCase()} Sagittal`}
            />

            <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono px-1">
              <span>Ground ZMP Pivot: $p_x = {zmp[0].toFixed(2)}\,\text&#123;m&#125;$</span>
              <span>CoM Position: $x_c = {com[0].toFixed(2)}\,\text&#123;m&#125;$</span>
              <span>DCM Advance: ${(xiX - com[0]).toFixed(3)}\,\text&#123;m&#125;$</span>
            </div>
          </div>

          {/* Right Column: Coronal View (Front Y-Z) & Phase Plane (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Coronal Frontal View */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-800">
                  Coronal Lateral Sway (Front: Y-Z)
                </h4>
                <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                  Mamdani Balance
                </span>
              </div>

              <LipmSingleCanvas
                frame={activeFrame}
                config={activeConfig}
                zc={zc}
                omega={omega}
                viewMode="coronal"
                layers={layers}
                accentColor="#6366F1"
                label="Coronal Lateral Sway"
              />

              <div className="flex justify-between text-[11px] text-slate-500 font-mono px-1">
                <span>Lateral Offset: $y_c = {(com[1] * 100).toFixed(1)}\,\text&#123;cm&#125;$</span>
                <span>Lateral ZMP: $p_y = {(zmp[1] * 100).toFixed(1)}\,\text&#123;cm&#125;$</span>
              </div>
            </div>

            {/* Support Polygon & Phase Plane Strip */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-800">
                  LIPM Orbital Phase Plane ($x - p_x$ vs $\dot&#123;x&#125;/\omega$)
                </h4>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                  totalOrbitalEnergy >= 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  $E_&#123;orb&#125; = {totalOrbitalEnergy.toFixed(3)}$
                </span>
              </div>

              <LipmPhasePortrait
                dX={dX}
                vNorm={vel[0] / omega}
                history={phaseHistory}
                orbitalEnergy={orbitalEnergyX}
              />
            </div>
          </div>
        </div>
      ) : (
        /* SINGLE DEDICATED PROJECTION VIEW */
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold font-mono uppercase tracking-wider text-slate-800">
              {viewMode === 'sagittal' && 'Sagittal Inverted Pendulum View (X-Z)'}
              {viewMode === 'coronal' && 'Coronal Lateral View (Y-Z)'}
              {viewMode === 'overhead' && 'Top-Down Support Polygon & Kajita Preview Horizon (X-Y)'}
              {viewMode === 'phase_portrait' && 'LIPM Orbital Phase Plane Portrait'}
            </h4>
            <span className="text-xs font-mono text-slate-500">
              Mode: {activePortionSource.toUpperCase()}
            </span>
          </div>

          {viewMode === 'phase_portrait' ? (
            <div className="max-w-2xl mx-auto py-4">
              <LipmPhasePortrait
                dX={dX}
                vNorm={vel[0] / omega}
                history={phaseHistory}
                orbitalEnergy={orbitalEnergyX}
                large
              />
            </div>
          ) : (
            <LipmSingleCanvas
              frame={activeFrame}
              config={activeConfig}
              zc={zc}
              omega={omega}
              viewMode={viewMode as 'sagittal' | 'coronal' | 'overhead'}
              layers={layers}
              accentColor={isDynamic ? '#D97706' : '#0284C7'}
              label={`${activePortionSource.toUpperCase()} ${viewMode.toUpperCase()}`}
              large
            />
          )}
        </div>
      )}

      {/* 5. Interactive Visual Layers & Physics Parameters Adjuster */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        {/* Layer Checkboxes */}
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-slate-500 font-semibold uppercase text-[10px]">Visual Layers:</span>
          {[
            { key: 'pendulumRod' as const, label: 'Pendulum Rod & Cart' },
            { key: 'forceVectors' as const, label: 'Force Vectors (mg, F_R)' },
            { key: 'capturePoint' as const, label: 'Capture Point (DCM $\\xi$)' },
            { key: 'quadrupedChassis' as const, label: 'Quadruped Silhouette' },
            { key: 'previewHorizon' as const, label: '16-Step Preview Ribbon' },
          ].map((item) => (
            <label key={item.key} className="flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-slate-950">
              <input
                type="checkbox"
                checked={layers[item.key]}
                onChange={() => setLayers((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>

        {/* Nominal CoM Height Slider */}
        <div className="flex items-center gap-3">
          <span className="text-slate-500">Cart Height $z_c$:</span>
          <input
            type="range"
            min={0.20}
            max={0.42}
            step={0.01}
            value={cartHeightOverride}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setCartHeightOverride(val);
              if (onUpdateConfig) onUpdateConfig({ comHeightOffset: val - 0.30 });
            }}
            className="w-28 cursor-pointer"
          />
          <span className="font-bold text-sky-700 w-12 text-right">{(cartHeightOverride * 100).toFixed(0)} cm</span>
        </div>
      </div>
    </div>
  );
};

// =====================================================================
// Helper Component: Single Projection Canvas (Sagittal / Coronal / Overhead)
// =====================================================================
interface LipmSingleCanvasProps {
  frame: SimulationStateFrame;
  config: SimControlConfig;
  zc: number;
  omega: number;
  viewMode: 'sagittal' | 'coronal' | 'overhead';
  layers: {
    pendulumRod: boolean;
    forceVectors: boolean;
    capturePoint: boolean;
    quadrupedChassis: boolean;
    previewHorizon: boolean;
  };
  accentColor: string;
  label: string;
  large?: boolean;
}

const LipmSingleCanvas: React.FC<LipmSingleCanvasProps> = ({
  frame,
  config,
  zc,
  omega,
  viewMode,
  layers,
  accentColor,
  label,
  large,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = (canvas.width = canvas.clientWidth);
    const h = (canvas.height = canvas.clientHeight);
    ctx.clearRect(0, 0, w, h);

    const com = frame.com;
    const vel = frame.comVel;
    const zmp = frame.zmpActual || [com[0], com[1]];
    const zmpRef = frame.zmpRef || [com[0], com[1]];
    const xiX = com[0] + vel[0] / omega;
    const xiY = com[1] + vel[1] / omega;

    // Coordinate mapping helper
    if (viewMode === 'sagittal') {
      // Sagittal View: X (horizontal, world displacement) vs Z (vertical, height)
      // Center horizontally relative to moving CoM
      const scaleX = large ? 380 : 300;
      const scaleZ = large ? 420 : 340;
      const originX = w * 0.45;
      const groundY = h * 0.82;

      const toScreen = (xRel: number, z: number): [number, number] => [
        originX + xRel * scaleX,
        groundY - z * scaleZ,
      ];

      // 1. Ground Plane
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(w, groundY);
      ctx.stroke();

      // Ground hatching
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1;
      for (let gx = -0.6; gx <= 0.6; gx += 0.1) {
        const [sx] = toScreen(gx, 0);
        ctx.beginPath();
        ctx.moveTo(sx, groundY);
        ctx.lineTo(sx - 10, groundY + 12);
        ctx.stroke();
      }

      // Constant Height Cart-Table Rail line
      ctx.strokeStyle = 'rgba(2, 132, 199, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      const [, railY] = toScreen(0, zc);
      ctx.beginPath();
      ctx.moveTo(0, railY);
      ctx.lineTo(w, railY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#0284C7';
      ctx.font = '10px monospace';
      ctx.fillText(`Rail: zc = ${(zc * 100).toFixed(0)}cm`, 12, railY - 6);

      // 2. Quadruped Silhouette & Legs
      const [comSx, comSz] = toScreen(0, com[2]);
      const [zmpSx, zmpSz] = toScreen(zmp[0] - com[0], 0);
      const [zmpRefSx] = toScreen(zmpRef[0] - com[0], 0);
      const [xiSx] = toScreen(xiX - com[0], 0);

      if (layers.quadrupedChassis) {
        // Quadruped Body Trunk
        const trunkLen = 0.36 * scaleX;
        const trunkH = 0.08 * scaleZ;
        ctx.fillStyle = 'rgba(241, 245, 249, 0.95)';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(comSx - trunkLen / 2, comSz - trunkH / 2, trunkLen, trunkH, 8);
        ctx.fill();
        ctx.stroke();

        // 4 Legs
        const legOffsets: { id: string; xRel: number; isFront: boolean }[] = [
          { id: 'FL', xRel: 0.18, isFront: true },
          { id: 'FR', xRel: 0.18, isFront: true },
          { id: 'RL', xRel: -0.18, isFront: false },
          { id: 'RR', xRel: -0.18, isFront: false },
        ];

        legOffsets.forEach((l) => {
          const leg = frame.legs[l.id as keyof typeof frame.legs];
          const isStance = leg?.isStance ?? true;
          const hipX = comSx + l.xRel * scaleX;
          const hipY = comSz;
          const footXRel = l.xRel + (isStance ? 0 : Math.sin(frame.simTime * 8) * 0.06);
          const footZ = isStance ? 0 : 0.05 * Math.sin(leg?.phase ? leg.phase * Math.PI : 0);
          const [footSx, footSz] = toScreen(footXRel, footZ);

          // Knee inverse kinematics bend
          const kneeSx = (hipX + footSx) / 2 + (l.isFront ? -12 : 12);
          const kneeSz = (hipY + footSz) / 2;

          ctx.strokeStyle = isStance ? '#10B981' : '#F59E0B';
          ctx.lineWidth = isStance ? 3 : 2;
          ctx.beginPath();
          ctx.moveTo(hipX, hipY);
          ctx.lineTo(kneeSx, kneeSz);
          ctx.lineTo(footSx, footSz);
          ctx.stroke();

          // Foot pad
          ctx.fillStyle = isStance ? '#059669' : '#D97706';
          ctx.beginPath();
          ctx.arc(footSx, footSz, isStance ? 5 : 3.5, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // 3. Inverted Pendulum Telescopic Rod & CoM Cart
      if (layers.pendulumRod) {
        // Pendulum Rod (from ground ZMP to CoM)
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(zmpSx, groundY);
        ctx.lineTo(comSx, comSz);
        ctx.stroke();

        // Ground ZMP Anchor Pad
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(zmpSx, groundY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Reference ZMP cross
        ctx.strokeStyle = '#0284C7';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(zmpRefSx, groundY, 4, 0, Math.PI * 2);
        ctx.stroke();

        // CoM Cart Sphere
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.arc(comSx, comSz, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CoM', comSx, comSz + 3);
      }

      // 4. Force Vectors (Gravity, Inertial, Ground Reaction)
      if (layers.forceVectors) {
        // Gravity arrow: straight down from CoM
        ctx.strokeStyle = '#DC2626';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(comSx, comSz);
        ctx.lineTo(comSx, comSz + 45);
        ctx.stroke();
        ctx.fillStyle = '#DC2626';
        ctx.beginPath();
        ctx.moveTo(comSx, comSz + 50);
        ctx.lineTo(comSx - 4, comSz + 42);
        ctx.lineTo(comSx + 4, comSz + 42);
        ctx.fill();
        ctx.font = '9px monospace';
        ctx.fillText('mg', comSx + 12, comSz + 45);

        // Inertial Acceleration arrow: m*a
        const accelX = Math.pow(omega, 2) * (com[0] - zmp[0]);
        const aLen = Math.max(-50, Math.min(50, accelX * 25));
        ctx.strokeStyle = '#D97706';
        ctx.beginPath();
        ctx.moveTo(comSx, comSz);
        ctx.lineTo(comSx + aLen, comSz);
        ctx.stroke();
      }

      // 5. Instantaneous Capture Point (DCM xi)
      if (layers.capturePoint) {
        ctx.fillStyle = '#047857';
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(xiSx, groundY, 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(xiSx - 9, groundY);
        ctx.lineTo(xiSx + 9, groundY);
        ctx.moveTo(xiSx, groundY - 9);
        ctx.lineTo(xiSx, groundY + 9);
        ctx.stroke();
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#047857';
        ctx.fillText('DCM ξ', xiSx, groundY - 12);
      }
    } else if (viewMode === 'coronal') {
      // Coronal View: Lateral Y (sway) vs Z (height)
      const scaleY = large ? 520 : 420;
      const scaleZ = large ? 420 : 340;
      const originX = w * 0.5;
      const groundY = h * 0.82;

      const toScreen = (yRel: number, z: number): [number, number] => [
        originX + yRel * scaleY,
        groundY - z * scaleZ,
      ];

      // Ground plane
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(w, groundY);
      ctx.stroke();

      // Mamdani Roll Stability corridor
      const [leftCorridorX] = toScreen(-0.14, 0);
      const [rightCorridorX] = toScreen(0.14, 0);
      ctx.fillStyle = 'rgba(99, 102, 241, 0.08)';
      ctx.fillRect(leftCorridorX, 0, rightCorridorX - leftCorridorX, groundY);

      // CoM and Lateral ZMP
      const [comSx, comSz] = toScreen(0, com[2]);
      const [zmpSx] = toScreen(zmp[1] - com[1], 0);
      const [xiSx] = toScreen(xiY - com[1], 0);

      // Chassis front profile
      ctx.fillStyle = 'rgba(241, 245, 249, 0.95)';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(comSx - 45, comSz - 20, 90, 40, 6);
      ctx.fill();
      ctx.stroke();

      // Left & Right Legs
      [-0.12, 0.12].forEach((offsetY) => {
        const [hipSx, hipSz] = toScreen(offsetY, com[2]);
        const [footSx, footSz] = toScreen(offsetY * 1.15, 0);
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(hipSx, hipSz);
        ctx.lineTo(footSx, footSz);
        ctx.stroke();
      });

      // Pendulum Rod
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(zmpSx, groundY);
      ctx.lineTo(comSx, comSz);
      ctx.stroke();

      // Ground ZMP Anchor
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(zmpSx, groundY, 6, 0, Math.PI * 2);
      ctx.fill();

      // CoM Orb
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(comSx, comSz, 10, 0, Math.PI * 2);
      ctx.fill();

      // Capture Point
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(xiSx, groundY, 7, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Overhead Radar View: X vs Y
      const scale = large ? 320 : 250;
      const centerX = w * 0.5;
      const centerY = h * 0.5;

      const toScreen = (xRel: number, yRel: number): [number, number] => [
        centerX + xRel * scale,
        centerY - yRel * scale,
      ];

      // Coordinate Grid
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      for (let r = 0.1; r <= 0.4; r += 0.1) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r * scale, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Support Polygon
      if (frame.supportPolygon && frame.supportPolygon.length >= 3) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        frame.supportPolygon.forEach(([px, py], i) => {
          const [sx, sy] = toScreen(px - com[0], py - com[1]);
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // 16-Step Preview Horizon Ribbon
      if (layers.previewHorizon && frame.zmpPreviewHorizon) {
        ctx.strokeStyle = '#0284C7';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        frame.zmpPreviewHorizon.forEach(([px, py], i) => {
          const [sx, sy] = toScreen(px - com[0], py - com[1]);
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Pendulum Ground Ground line (from ZMP to CoM projection)
      const [comSx, comSy] = toScreen(0, 0);
      const [zmpSx, zmpSy] = toScreen(zmp[0] - com[0], zmp[1] - com[1]);
      const [xiSx, xiSy] = toScreen(xiX - com[0], xiY - com[1]);

      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(zmpSx, zmpSy);
      ctx.lineTo(comSx, comSy);
      ctx.stroke();

      // ZMP marker
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(zmpSx, zmpSy, 6, 0, Math.PI * 2);
      ctx.fill();

      // CoM marker
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(comSx, comSy, 7, 0, Math.PI * 2);
      ctx.fill();

      // Capture Point crosshair
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(xiSx, xiSy, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [frame, config, zc, omega, viewMode, layers, accentColor, large]);

  return (
    <div className={`relative w-full ${large ? 'h-96' : 'h-64'} bg-slate-50/70 border border-slate-200 rounded-xl overflow-hidden`}>
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-white/90 border border-slate-200 text-[10px] font-mono text-slate-700 shadow-2xs">
        {label}
      </div>
    </div>
  );
};

// =====================================================================
// Helper Component: LIPM Phase Portrait (x - p_x vs v / omega)
// =====================================================================
interface LipmPhasePortraitProps {
  dX: number;
  vNorm: number;
  history: { x: number; vNorm: number; time: number }[];
  orbitalEnergy: number;
  large?: boolean;
}

const LipmPhasePortrait: React.FC<LipmPhasePortraitProps> = ({
  dX,
  vNorm,
  history,
  orbitalEnergy,
  large,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = (canvas.width = canvas.clientWidth);
    const h = (canvas.height = canvas.clientHeight);
    ctx.clearRect(0, 0, w, h);

    const cx = w * 0.5;
    const cy = h * 0.5;
    const scale = large ? 700 : 500; // pixels per meter

    // Axes
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = '#64748B';
    ctx.font = '10px monospace';
    ctx.fillText('Position Err (x - px)', w - 110, cy - 6);
    ctx.fillText('Velocity (v / ω)', cx + 6, 14);

    // Asymptotes (Stable manifold: v/w = -(x-p), Unstable: v/w = (x-p))
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(cx - 150, cy + 150);
    ctx.lineTo(cx + 150, cy - 150);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.beginPath();
    ctx.moveTo(cx - 150, cy - 150);
    ctx.lineTo(cx + 150, cy + 150);
    ctx.stroke();
    ctx.setLineDash([]);

    // Trail of past phase points
    if (history.length > 1) {
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      history.forEach((pt, idx) => {
        const sx = cx + pt.x * scale;
        const sy = cy - pt.vNorm * scale;
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();
    }

    // Current State Dot
    const currSx = cx + dX * scale;
    const currSy = cy - vNorm * scale;
    ctx.fillStyle = orbitalEnergy >= 0 ? '#D97706' : '#10B981';
    ctx.beginPath();
    ctx.arc(currSx, currSy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [dX, vNorm, history, orbitalEnergy, large]);

  return (
    <div className={`relative w-full ${large ? 'h-80' : 'h-48'} bg-slate-50/80 border border-slate-200 rounded-xl overflow-hidden`}>
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute bottom-2 left-2 text-[10px] font-mono text-slate-500 bg-white/90 px-1.5 py-0.5 rounded border border-slate-200">
        Phase: [{(dX * 100).toFixed(1)}cm, {(vNorm * 100).toFixed(1)}cm]
      </div>
    </div>
  );
};
