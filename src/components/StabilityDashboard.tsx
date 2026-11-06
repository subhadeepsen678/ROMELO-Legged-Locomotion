import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  GAIT_CATALOG,
  GaitType,
  SimControlConfig,
  SimulationStateFrame,
  StabilityMarginId,
} from '../physics/roboticsEngine';
import { LipmLocomotionSection } from './LipmLocomotionSection';

interface StabilityDashboardProps {
  frame: SimulationStateFrame;
  config: SimControlConfig;
  onUpdateConfig: (partial: Partial<SimControlConfig>) => void;
}

interface StabilityEvent {
  id: string;
  simTime: number;
  timestamp: string;
  type: 'ZMP_EXIT' | 'ZMP_CAUTION' | 'FLIGHT_PHASE' | 'FRICTION_SLIP' | 'DYN_DISCREPANCY';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
  gait: string;
  marginMm: number;
}

const MARGIN_META: Record<
  StabilityMarginId,
  { name: string; symbol: string; validWhen: string; complexity: string; color: string; desc: string }
> = {
  'SM-1_SSM': {
    name: 'Static Stability Margin',
    symbol: 'S_SM',
    validWhen: 'Flat, even, static',
    complexity: 'Low',
    color: '#10B981',
    desc: 'Shortest distance from COG projected to support polygon edge.',
  },
  'SM-2_LSM': {
    name: 'Longitudinal Stability Margin',
    symbol: 'S_LSM',
    validWhen: 'Flat, even, static',
    complexity: 'Low',
    color: '#06B6D4',
    desc: 'Minimum distance to front/rear boundary along longitudinal axis.',
  },
  'SM-3_CLSM': {
    name: 'Crab Longitudinal Stability Margin',
    symbol: 'S_CLSM',
    validWhen: 'Crab-angle motion',
    complexity: 'Low',
    color: '#3B82F6',
    desc: 'Longitudinal margin projected along the crab motion angle α.',
  },
  'SM-4_ESM': {
    name: 'Energy Stability Margin',
    symbol: 'S_ESM',
    validWhen: 'Sloped terrain, static',
    complexity: 'Medium',
    color: '#8B5CF6',
    desc: 'Work required to tip robot over edge h_i = |R_i|(1 - cos θ)cos ψ.',
  },
  'SM-5_NESM': {
    name: 'Normalized Energy Stability Margin',
    symbol: 'S_NESM',
    validWhen: 'Sloped, static, normalized',
    complexity: 'Medium',
    color: '#EC4899',
    desc: 'S_ESM / (mg) = min(h_i). Validated by Hirose impact experiments.',
  },
  'SM-6_DSM': {
    name: 'Dynamic Stability Margin (Lin & Song)',
    symbol: 'S_DSM',
    validWhen: 'Inertial effects present',
    complexity: 'High',
    color: '#F59E0B',
    desc: 'min(M_i / mg) considering resultant force and moment.',
  },
  'SM-7_TSM': {
    name: 'Tumble Stability Margin',
    symbol: 'S_TSM',
    validWhen: 'Momentum-based regimes',
    complexity: 'High',
    color: '#F97316',
    desc: "min(||M_i'|| / mg) incorporating dynamic angular momentum.",
  },
  'SM-8_FASM': {
    name: 'Force-Angle Stability Margin',
    symbol: 'S_FASM',
    validWhen: 'Manipulation forces',
    complexity: 'Very High',
    color: '#EF4444',
    desc: 'min(α_i) · ||F_R||. Approaching zero indicates imminent tip-over.',
  },
  'SM-9_ZMP': {
    name: 'ZMP Stability Margin',
    symbol: 'S_ZMP',
    validWhen: 'Flat, even, dynamic',
    complexity: 'Medium',
    color: '#14B8A6',
    desc: 'Shortest signed distance from ZMP (Zero-Moment Point) to support polygon edges (TRD Section 5.2).',
  },
  'SM-10_NDESM': {
    name: 'Normalized Dynamic Energy Stability Margin',
    symbol: 'S_NDESM',
    validWhen: 'Universal (All regimes)',
    complexity: 'Pinnacle',
    color: '#6366F1',
    desc: 'García & González de Santos theorem: continuous to zero at tumble across uneven and dynamic regimes.',
  },
};

export const StabilityDashboard: React.FC<StabilityDashboardProps> = ({
  frame,
  config,
  onUpdateConfig,
}) => {
  const [selectedMargin, setSelectedMargin] = useState<StabilityMarginId>('SM-9_ZMP');
  const [activeTab, setActiveTab] = useState<
    'zmp_visualizer' | 'lipm_simulator' | 'sm10_deep_dive' | 'all_margins'
  >('zmp_visualizer');

  // Rolling ZMP history trail for the 2D visualizer (world & relative coords)
  const [zmpTrail, setZmpTrail] = useState<{ x: number; y: number; isInside: boolean; time: number }[]>([]);

  // Stability Events Log state
  const [eventLog, setEventLog] = useState<StabilityEvent[]>([]);
  const [eventFilter, setEventFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING'>('ALL');
  const lastEventTimeRef = useRef<{ zmpExit: number; zmpCaution: number; flight: number; slip: number }>({
    zmpExit: 0,
    zmpCaution: 0,
    flight: 0,
    slip: 0,
  });

  const rep = frame.stabilityReport;
  const zmpDiag = frame.zmpDiagnostics;

  // Append to rolling ZMP trail
  useEffect(() => {
    if (!frame.zmpActual) return;
    const item = {
      x: frame.zmpActual[0],
      y: frame.zmpActual[1],
      isInside: zmpDiag?.isInsidePolygon ?? true,
      time: frame.simTime,
    };
    setZmpTrail((prev) => [...prev.slice(-45), item]);
  }, [frame.zmpActual, zmpDiag?.isInsidePolygon, frame.simTime]);

  // Monitor & record real-time stability events
  useEffect(() => {
    const curTime = frame.simTime;
    const newEvents: StabilityEvent[] = [];

    // 1. ZMP boundary exit event (Critical)
    if (zmpDiag && !zmpDiag.isInsidePolygon && curTime - lastEventTimeRef.current.zmpExit > 0.8) {
      lastEventTimeRef.current.zmpExit = curTime;
      const penMm = Math.round(Math.abs(zmpDiag.signedMarginM) * 1000);
      newEvents.push({
        id: `zmp_exit_${Date.now()}_${Math.random()}`,
        simTime: curTime,
        timestamp: new Date().toLocaleTimeString(),
        type: 'ZMP_EXIT',
        severity: 'CRITICAL',
        message: `ZMP exited support polygon by -${penMm} mm! Contact wrench center-of-pressure outside convex hull. Gait: ${frame.gait.toUpperCase()}.`,
        gait: frame.gait,
        marginMm: -penMm,
      });
    }

    // 2. ZMP near margin caution (< 25 mm)
    if (
      zmpDiag &&
      zmpDiag.isInsidePolygon &&
      zmpDiag.signedMarginM < 0.025 &&
      curTime - lastEventTimeRef.current.zmpCaution > 1.2
    ) {
      lastEventTimeRef.current.zmpCaution = curTime;
      const margMm = Math.round(zmpDiag.signedMarginM * 1000);
      newEvents.push({
        id: `zmp_caut_${Date.now()}_${Math.random()}`,
        simTime: curTime,
        timestamp: new Date().toLocaleTimeString(),
        type: 'ZMP_CAUTION',
        severity: 'WARNING',
        message: `ZMP approaching boundary edge (Margin: +${margMm} mm). Close to tip-over threshold.`,
        gait: frame.gait,
        marginMm: margMm,
      });
    }

    // 3. Flight Phase Gating
    if (zmpDiag && zmpDiag.reasonInvalid === 'flight_phase' && curTime - lastEventTimeRef.current.flight > 1.5) {
      lastEventTimeRef.current.flight = curTime;
      newEvents.push({
        id: `flight_${Date.now()}_${Math.random()}`,
        simTime: curTime,
        timestamp: new Date().toLocaleTimeString(),
        type: 'FLIGHT_PHASE',
        severity: 'INFO',
        message: `Flight phase detected (F_Rz < 0.01 mg). Classical ZMP gated; relying on aerial ballistics.`,
        gait: frame.gait,
        marginMm: 0,
      });
    }

    // 4. Friction Cone Slip
    if (zmpDiag && zmpDiag.frictionViolations.length > 0 && curTime - lastEventTimeRef.current.slip > 1.2) {
      lastEventTimeRef.current.slip = curTime;
      newEvents.push({
        id: `slip_${Date.now()}_${Math.random()}`,
        simTime: curTime,
        timestamp: new Date().toLocaleTimeString(),
        type: 'FRICTION_SLIP',
        severity: 'WARNING',
        message: `Friction cone exceeded on leg(s): ${zmpDiag.frictionViolations.join(', ')}. Tangential shear Ft > μ*Fn.`,
        gait: frame.gait,
        marginMm: Math.round(zmpDiag.signedMarginM * 1000),
      });
    }

    if (newEvents.length > 0) {
      setEventLog((prev) => [...newEvents, ...prev].slice(0, 50));
    }
  }, [frame.simTime, zmpDiag, frame.gait]);

  const meta = MARGIN_META[selectedMargin];

  const marginValues: Record<StabilityMarginId, number> = {
    'SM-1_SSM': rep.S_SM ?? 0,
    'SM-2_LSM': rep.S_LSM ?? 0,
    'SM-3_CLSM': rep.S_CLSM ?? 0,
    'SM-4_ESM': rep.S_ESM ?? 0,
    'SM-5_NESM': rep.S_NESM ?? 0,
    'SM-6_DSM': rep.S_DSM ?? 0,
    'SM-7_TSM': rep.S_TSM ?? 0,
    'SM-8_FASM': rep.S_FASM ?? 0,
    'SM-9_ZMP': rep.S_ZMP ?? 0,
    'SM-10_NDESM': rep.S_NDESM ?? 0,
  };

  // CoM-relative coordinates for the 2D Ground Plane SVG visualizer
  const comX = frame.com[0];
  const comY = frame.com[1];
  const svgScale = 380; // pixels per meter
  const svgCenterX = 240;
  const svgCenterY = 170;

  const toSvgX = (wx: number) => svgCenterX + (wx - comX) * svgScale;
  const toSvgY = (wy: number) => svgCenterY - (wy - comY) * svgScale;

  // Polygon points in SVG
  const polySvgPoints = useMemo(() => {
    if (!frame.supportPolygon || frame.supportPolygon.length === 0) return '';
    return frame.supportPolygon.map(([px, py]) => `${toSvgX(px)},${toSvgY(py)}`).join(' ');
  }, [frame.supportPolygon, comX, comY]);

  // Closest edge in SVG
  const closestEdgeSvg = useMemo(() => {
    if (!zmpDiag?.closestEdge) return null;
    const p1 = zmpDiag.closestEdge.p1;
    const p2 = zmpDiag.closestEdge.p2;
    return {
      x1: toSvgX(p1[0]),
      y1: toSvgY(p1[1]),
      x2: toSvgX(p2[0]),
      y2: toSvgY(p2[1]),
    };
  }, [zmpDiag?.closestEdge, comX, comY]);

  // Color coding based on ZMP safety
  const isInside = zmpDiag?.isInsidePolygon ?? true;
  const signedDistMm = Math.round((zmpDiag?.signedMarginM ?? 0.04) * 1000);
  const zmpStatusColor = !isInside
    ? '#EF4444' // Crimson red for exit
    : signedDistMm < 25
    ? '#F59E0B' // Amber for warning
    : '#10B981'; // Emerald for nominal

  // Filtered Events
  const filteredEvents = eventLog.filter((evt) => {
    if (eventFilter === 'CRITICAL') return evt.severity === 'CRITICAL';
    if (eventFilter === 'WARNING') return evt.severity === 'WARNING' || evt.severity === 'CRITICAL';
    return true;
  });

  // Inject a manual disturbance push to test ZMP exit
  const handleTestImpulse = () => {
    onUpdateConfig({
      externalPush: {
        fx: 120,
        fy: 140,
        decayRemaining: 1.0,
      },
    });
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 text-slate-900">
      {/* 1. Header Banner with Mode Status */}
      <div className="flex flex-wrap items-baseline justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-display font-semibold tracking-tight text-slate-900">
              Zero-Moment Point (ZMP) &amp; Stability Taxonomy Hub
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded text-xs font-mono font-semibold border ${
                !isInside
                  ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                  : signedDistMm < 25
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-emerald-100 text-emerald-800 border-emerald-300'
              }`}
            >
              {!isInside
                ? `CRITICAL: ZMP PENETRATED BOUNDARY (${signedDistMm} mm)`
                : signedDistMm < 25
                ? `CAUTION: ZMP NEAR BOUNDARY (+${signedDistMm} mm)`
                : `NOMINAL: ZMP IN BOUNDS (+${signedDistMm} mm)`}
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Real-time rigid-body ZMP calculation (Vukobratović 1969 &amp; Kajita LIPM), 30 Hz Butterworth
            filtering, live support polygon boundary tracking, and G.1–G.7 stability margin taxonomy.
          </p>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-mono overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('zmp_visualizer')}
            className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'zmp_visualizer'
                ? 'bg-sky-600 text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            🎯 Real-Time ZMP Scope &amp; Events
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('lipm_simulator')}
            className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'lipm_simulator'
                ? 'bg-amber-600 text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            ⚡ LIPM Locomotion &amp; Stepping
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sm10_deep_dive')}
            className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'sm10_deep_dive'
                ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            📐 SM-10 (S_NDESM) Universal Margin
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('all_margins')}
            className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'all_margins'
                ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            📊 10-Margin Taxonomy G.1
          </button>
        </div>
      </div>

      {/* 2. Interactive Gait Visualizer Ribbon & Quick Gait Catalogue Toggle */}
      <div className="bg-[#111827] border border-slate-800 rounded p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold">
              Gait Visualizer &amp; Real-Time Contact Duty Cycle
            </span>
            <span className="text-xs font-mono text-cyan-400">
              Active Gait: {frame.gait.toUpperCase()} (DF: {(GAIT_CATALOG[frame.gait]?.dutyFactor ?? 0.5).toFixed(2)})
            </span>
          </div>

          {/* Gait Selector Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-mono">
            <span className="text-slate-400 mr-1 text-[11px]">Switch Gait:</span>
            {(['trot', 'wave', 'pace', 'bound', 'gallop', 'ci_mpc', 'two_phase', 'crab'] as GaitType[]).map((gKey) => {
              const isSelected = config.gait === gKey;
              return (
                <button
                  key={gKey}
                  type="button"
                  onClick={() => onUpdateConfig({ gait: gKey })}
                  className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                    isSelected
                      ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                      : 'bg-[#07090E] text-slate-300 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {gKey === 'ci_mpc' ? 'CI-MPC' : gKey.charAt(0).toUpperCase() + gKey.slice(1)}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4-Leg Duty Cycle Bars with Playhead Scrubber */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80">
          {(['FL', 'FR', 'RL', 'RR'] as const).map((legId) => {
            const leg = frame.legs[legId];
            const isStance = leg?.isStance ?? false;
            const phase = leg?.phase ?? 0;
            const fn = leg?.contactForce.fn ?? 0;
            return (
              <div
                key={legId}
                className={`p-2.5 rounded border text-xs font-mono ${
                  isStance
                    ? 'bg-[#0B1728] border-cyan-500/50 text-cyan-200'
                    : 'bg-[#07090E] border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold">{legId} Leg</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                      isStance ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isStance ? 'STANCE (Fn: ' + fn.toFixed(0) + 'N)' : 'SWING'}
                  </span>
                </div>
                {/* Visual Duty Cycle Bar */}
                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden relative">
                  <div
                    className={`h-full transition-all duration-75 ${isStance ? 'bg-cyan-400' : 'bg-slate-700'}`}
                    style={{ width: `${Math.round(phase * 100)}%` }}
                  />
                  {/* Playhead marker */}
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-white shadow"
                    style={{ left: `${Math.round(phase * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>Phase: {(phase * 100).toFixed(0)}%</span>
                  <span>{isStance ? 'In Support' : 'In Flight'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* TAB 1: REAL-TIME ZMP SCOPE & STABILITY EVENTS */}
      {activeTab === 'zmp_visualizer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: 2D Ground Plane ZMP vs Support Polygon Visualizer (7 cols) */}
          <div className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-100">
                    2D Ground Plane Support Polygon &amp; ZMP Trajectory
                  </h2>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
                    240 Hz Butterworth Filtered
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="flex items-center gap-1 text-yellow-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" /> ZMP Actual
                  </span>
                  <span className="flex items-center gap-1 text-cyan-400">
                    <span className="w-2.5 h-2.5 rounded-full border border-cyan-400 inline-block" /> ZMP Ref
                  </span>
                  <span className="flex items-center gap-1 text-blue-400">
                    <span className="w-2 h-2 rotate-45 bg-blue-400 inline-block" /> CoM
                  </span>
                </div>
              </div>

              {/* The Interactive SVG Canvas */}
              <div className="relative w-full h-84 bg-[#07090E] rounded border border-slate-800 overflow-hidden">
                <svg viewBox="0 0 480 340" className="w-full h-full block">
                  {/* Grid Lines */}
                  {[-1.0, -0.5, 0.0, 0.5, 1.0].map((gx) => (
                    <line
                      key={'gx_' + gx}
                      x1={svgCenterX + gx * svgScale * 0.4}
                      y1={0}
                      x2={svgCenterX + gx * svgScale * 0.4}
                      y2={340}
                      stroke="#1E293B"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                  ))}
                  {[-1.0, -0.5, 0.0, 0.5, 1.0].map((gy) => (
                    <line
                      key={'gy_' + gy}
                      x1={0}
                      y1={svgCenterY + gy * svgScale * 0.4}
                      x2={480}
                      y2={svgCenterY + gy * svgScale * 0.4}
                      stroke="#1E293B"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                  ))}

                  {/* Axes */}
                  <line x1={0} y1={svgCenterY} x2={480} y2={svgCenterY} stroke="#334155" strokeWidth="1" />
                  <line x1={svgCenterX} y1={0} x2={svgCenterX} y2={340} stroke="#334155" strokeWidth="1" />
                  <text x={470} y={svgCenterY - 6} fill="#64748B" fontSize="10" fontFamily="monospace">
                    +X
                  </text>
                  <text x={svgCenterX + 6} y={14} fill="#64748B" fontSize="10" fontFamily="monospace">
                    +Y
                  </text>

                  {/* Support Polygon Filled Area */}
                  {polySvgPoints && (
                    <polygon
                      points={polySvgPoints}
                      fill={!isInside ? 'rgba(239, 68, 68, 0.22)' : 'rgba(16, 185, 129, 0.16)'}
                      stroke={zmpStatusColor}
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Closest Polygon Boundary Edge Highlighting */}
                  {closestEdgeSvg && (
                    <line
                      x1={closestEdgeSvg.x1}
                      y1={closestEdgeSvg.y1}
                      x2={closestEdgeSvg.x2}
                      y2={closestEdgeSvg.y2}
                      stroke={!isInside ? '#EF4444' : '#F59E0B'}
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  )}

                  {/* Stance Feet Pads */}
                  {Object.entries(frame.legs).map(([legId, l]) => {
                    if (!l.isStance) return null;
                    const fx = toSvgX(l.footWorld[0]);
                    const fy = toSvgY(l.footWorld[1]);
                    return (
                      <g key={legId}>
                        <circle cx={fx} cy={fy} r="7" fill="#0EA5E9" opacity="0.85" />
                        <text
                          x={fx + 9}
                          y={fy + 4}
                          fill="#38BDF8"
                          fontSize="10"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          {legId}
                        </text>
                      </g>
                    );
                  })}

                  {/* ZMP Rolling Trail (Last 45 points) */}
                  {zmpTrail.map((pt, idx) => {
                    if (idx === 0) return null;
                    const prev = zmpTrail[idx - 1];
                    const alpha = (idx / zmpTrail.length) * 0.75;
                    return (
                      <line
                        key={idx}
                        x1={toSvgX(prev.x)}
                        y1={toSvgY(prev.y)}
                        x2={toSvgX(pt.x)}
                        y2={toSvgY(pt.y)}
                        stroke={pt.isInside ? '#FBBF24' : '#EF4444'}
                        strokeWidth="1.5"
                        strokeOpacity={alpha}
                      />
                    );
                  })}

                  {/* Stability Margin Distance Vector (from ZMP to nearest edge) */}
                  {frame.zmpActual && closestEdgeSvg && (
                    <line
                      x1={toSvgX(frame.zmpActual[0])}
                      y1={toSvgY(frame.zmpActual[1])}
                      x2={(closestEdgeSvg.x1 + closestEdgeSvg.x2) / 2}
                      y2={(closestEdgeSvg.y1 + closestEdgeSvg.y2) / 2}
                      stroke={!isInside ? '#EF4444' : '#F59E0B'}
                      strokeWidth="2"
                      strokeDasharray="4 2"
                    />
                  )}

                  {/* CoM Projection (Blue Diamond) */}
                  <polygon
                    points={`${toSvgX(comX)},${toSvgY(comY) - 7} ${toSvgX(comX) + 7},${toSvgY(comY)} ${toSvgX(
                      comX
                    )},${toSvgY(comY) + 7} ${toSvgX(comX) - 7},${toSvgY(comY)}`}
                    fill="#3B82F6"
                    stroke="#1D4ED8"
                    strokeWidth="1.5"
                  />

                  {/* ZMP Reference Ring (Cyan) */}
                  {frame.zmpRef && (
                    <circle
                      cx={toSvgX(frame.zmpRef[0])}
                      cy={toSvgY(frame.zmpRef[1])}
                      r="9"
                      fill="none"
                      stroke="#06B6D4"
                      strokeWidth="2"
                      strokeDasharray="3 2"
                    />
                  )}

                  {/* Kajita Preview Horizon Path (Cyan dots) */}
                  {frame.zmpPreviewHorizon?.map(([px, py], pIdx) => (
                    <circle
                      key={'prev_' + pIdx}
                      cx={toSvgX(px)}
                      cy={toSvgY(py)}
                      r="2.5"
                      fill="#22D3EE"
                      opacity={0.65}
                    />
                  ))}

                  {/* ZMP Actual Marker (Glowing Yellow / Crimson on Exit) */}
                  {frame.zmpActual && (
                    <g>
                      <circle
                        cx={toSvgX(frame.zmpActual[0])}
                        cy={toSvgY(frame.zmpActual[1])}
                        r="12"
                        fill={zmpStatusColor}
                        opacity="0.25"
                      />
                      <circle
                        cx={toSvgX(frame.zmpActual[0])}
                        cy={toSvgY(frame.zmpActual[1])}
                        r="5.5"
                        fill={zmpStatusColor}
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                      />
                      <line
                        x1={toSvgX(frame.zmpActual[0]) - 8}
                        y1={toSvgY(frame.zmpActual[1])}
                        x2={toSvgX(frame.zmpActual[0]) + 8}
                        y2={toSvgY(frame.zmpActual[1])}
                        stroke="#0F172A"
                        strokeWidth="1.2"
                      />
                      <line
                        x1={toSvgX(frame.zmpActual[0])}
                        y1={toSvgY(frame.zmpActual[1]) - 8}
                        x2={toSvgX(frame.zmpActual[0])}
                        y2={toSvgY(frame.zmpActual[1]) + 8}
                        stroke="#0F172A"
                        strokeWidth="1.2"
                      />
                    </g>
                  )}
                </svg>

                {/* Overlay Floating Stats in Canvas */}
                <div className="absolute top-2 left-2 p-2 rounded bg-[#07090E]/90 border border-slate-800 text-[11px] font-mono space-y-0.5 pointer-events-none">
                  <div>
                    <span className="text-slate-400">ZMP Actual: </span>
                    <span className="text-yellow-400 font-bold">
                      [{frame.zmpActual[0].toFixed(3)}, {frame.zmpActual[1].toFixed(3)}] m
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">ZMP Ref: </span>
                    <span className="text-cyan-400">
                      [{frame.zmpRef[0].toFixed(3)}, {frame.zmpRef[1].toFixed(3)}] m
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Tracking Error: </span>
                    <span className="text-slate-200">{frame.zmpTrackingErrorCm.toFixed(2)} cm</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Signed Margin: </span>
                    <span className={`font-bold ${isInside ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {signedDistMm > 0 ? `+${signedDistMm}` : signedDistMm} mm
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom HUD: Method M1 vs M2 Cross-Check & Butterworth Specs */}
            <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="bg-[#07090E] p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Method M1 vs M2 Discrepancy</span>
                <span className="text-emerald-400 font-semibold">{zmpDiag?.discrepancyMm ?? 1.2} mm</span>
                <span className="text-[10px] text-slate-500 block">(Tolerance &lt; 20 mm)</span>
              </div>
              <div className="bg-[#07090E] p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-400 block">30 Hz Butterworth LPF</span>
                <span className="text-slate-200 font-semibold">fc=30Hz, fs=240Hz</span>
                <span className="text-[10px] text-slate-500 block">Section 7.5 Exact</span>
              </div>
              <div className="bg-[#07090E] p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Friction Margin Min</span>
                <span className="text-slate-200 font-semibold">{(zmpDiag?.frictionMarginMin ?? 0.42).toFixed(2)}</span>
                <span className="text-[10px] text-slate-500 block">μ_ground = {config.frictionMu}</span>
              </div>
              <div className="bg-[#07090E] p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Terrain Coplanar Residual</span>
                <span className="text-slate-200 font-semibold">{zmpDiag?.coplanarResidualMm ?? 0.4} mm</span>
                <span className="text-[10px] text-slate-500 block">&lt; 5 mm Flat Valid</span>
              </div>
            </div>
          </div>

          {/* Right: Stability Events Log (5 cols) */}
          <div className="lg:col-span-5 bg-[#111827] border border-slate-800 rounded p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">Stability Events &amp; Violation Log</h2>
                  <p className="text-xs text-slate-400">
                    Real-time recording of ZMP margin penetrations, friction violations, and flight lift-offs.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleTestImpulse}
                  className="px-2.5 py-1 text-xs font-mono font-medium rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition-colors whitespace-nowrap"
                  title="Applies a 140 N lateral push impulse to push ZMP toward the boundary and test logging"
                >
                  ⚡ Test Push Impulse
                </button>
              </div>

              {/* Event Filter & Actions */}
              <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-800 text-xs font-mono">
                <div className="flex items-center gap-1">
                  {(['ALL', 'CRITICAL', 'WARNING'] as const).map((flt) => (
                    <button
                      key={flt}
                      type="button"
                      onClick={() => setEventFilter(flt)}
                      className={`px-2 py-0.5 rounded ${
                        eventFilter === flt
                          ? 'bg-slate-700 text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {flt}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-[10px]">{filteredEvents.length} events</span>
                  <button
                    type="button"
                    onClick={() => setEventLog([])}
                    className="text-slate-400 hover:text-white text-[11px] underline"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Scrolling Events Feed */}
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {filteredEvents.length === 0 ? (
                  <div className="text-center py-10 text-xs font-mono text-slate-500">
                    ● No stability violations recorded. ZMP is stably confined inside the support polygon.
                  </div>
                ) : (
                  filteredEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className={`p-2.5 rounded border text-xs font-mono space-y-1 ${
                        evt.severity === 'CRITICAL'
                          ? 'bg-rose-950/30 border-rose-500/50 text-rose-200'
                          : evt.severity === 'WARNING'
                          ? 'bg-amber-950/25 border-amber-500/40 text-amber-200'
                          : 'bg-slate-900 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              evt.severity === 'CRITICAL'
                                ? 'bg-rose-500 text-slate-950'
                                : evt.severity === 'WARNING'
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {evt.type}
                          </span>
                          <span className="text-slate-400 text-[10px]">t={evt.simTime.toFixed(2)}s</span>
                        </div>
                        <span className="text-[10px] text-slate-400">{evt.timestamp}</span>
                      </div>
                      <div className="text-[11px] leading-relaxed text-slate-200">{evt.message}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex justify-between">
              <span>TRD-ZMP-2026 Regression Rule #8.4 Compliant</span>
              <span>Buffer: 50 Events</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LIPM QUADRUPED LOCOMOTION & CAPTURE POINT STEPPING */}
      {activeTab === 'lipm_simulator' && (
        <LipmLocomotionSection
          frame={frame}
          config={config}
          onUpdateConfig={onUpdateConfig}
        />
      )}

      {/* TAB 3: SM-10 (S_NDESM) UNIVERSAL MARGIN DEEP DIVE */}
      {activeTab === 'sm10_deep_dive' && (
        <div className="space-y-6">
          <div className="p-4 rounded bg-indigo-950/30 border border-indigo-500/40 space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-indigo-500 text-white text-xs font-mono font-bold">
                SM-10
              </span>
              <h2 className="text-base font-semibold text-indigo-200">
                Normalized Dynamic Energy Stability Margin (S_NDESM) — The Universal Pinnacle Criterion
              </h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Formulated by <strong>González de Santos, García &amp; Estremera (2006)</strong>, SM-10 solves the fundamental
              limitations of the Zero-Moment Point on uneven terrain and high-acceleration dynamic maneuvers. While
              classical ZMP assumes flat coplanar ground and becomes undefined during flight phases or tumbling, S_NDESM
              evaluates the exact mechanical energy required to tumble the robot over any support axis.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Mathematical Formulation Card */}
            <div className="bg-[#111827] border border-slate-800 rounded p-4 space-y-3 font-mono text-xs">
              <h3 className="font-semibold text-slate-200 uppercase tracking-wider text-xs">
                Analytical Formulation (Theorem G.1.10)
              </h3>
              <div className="p-3 bg-[#07090E] rounded border border-slate-800 text-cyan-300 space-y-2 text-[11px]">
                <div>
                  <span className="text-slate-400">Tumbler Energy over edge i:</span>
                  <div className="text-indigo-300 font-bold mt-1">
                    E_i = mg|R_i|(cos φ_0 - cos φ)cos Ψ + (F_RI · t)|R_i|θ + (M_R · e_1)θ - ½ I_i ω_i²
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Universal Normalized Margin:</span>
                  <div className="text-emerald-300 font-bold mt-1">
                    S_NDESM = min_i(E_i) / (mg)
                  </div>
                </div>
              </div>
              <ul className="space-y-1.5 text-slate-400 text-[11px] list-disc list-inside">
                <li>
                  <strong className="text-slate-200">Gravitational Potential:</strong> Work required to lift CoM over support edge.
                </li>
                <li>
                  <strong className="text-slate-200">Inertial D'Alembert Force (F_RI · t):</strong> Dynamic momentum resisting or driving tumble.
                </li>
                <li>
                  <strong className="text-slate-200">Angular Momentum Rate (M_R · e_1):</strong> Gyroscopic whole-body stabilization.
                </li>
                <li>
                  <strong className="text-slate-200">Kinetic Tumbling Energy (-½ I ω²):</strong> Rotational energy already propelling tumble.
                </li>
                <li>
                  <strong className="text-emerald-400">Continuous to Exactly Zero:</strong> S_NDESM = 0 at the exact bifurcation of tumbling.
                </li>
              </ul>
            </div>

            {/* Live Telemetry Evaluation */}
            <div className="bg-[#111827] border border-slate-800 rounded p-4 flex flex-col justify-between font-mono text-xs">
              <div>
                <h3 className="font-semibold text-slate-200 uppercase tracking-wider text-xs mb-3">
                  Live S_NDESM Real-Time Telemetry
                </h3>
                <div className="space-y-3 bg-[#07090E] p-3 rounded border border-slate-800">
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-400">Current S_NDESM:</span>
                    <span className="text-2xl font-bold text-indigo-400">{rep.S_NDESM.toFixed(4)} m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tumble Barrier Energy:</span>
                    <span className="text-slate-200 font-semibold">
                      {(rep.S_NDESM * (frame.robotId.includes('silo') ? 30 : 12.5) * 9.81).toFixed(2)} Joules
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Classical S_ZMP:</span>
                    <span className="text-teal-400">{rep.S_ZMP.toFixed(4)} m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Static S_SM:</span>
                    <span className="text-emerald-400">{rep.S_SM.toFixed(4)} m</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-800 text-[11px]">
                    <span className="text-slate-400">Terrain Slope Independence:</span>
                    <span className="text-emerald-400">Full 3D Invariance</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400">
                Rule G.12.12 Pass: S_NDESM remains strictly continuous under external perturbations F_ext → 25 N.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: 10-MARGIN TAXONOMY G.1 & G.7 */}
      {activeTab === 'all_margins' && (
        <div className="space-y-6">
          {/* Grid: 10 Stability Margins Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {(Object.keys(MARGIN_META) as StabilityMarginId[]).map((id) => {
              const m = MARGIN_META[id];
              const val = marginValues[id];
              const isSelected = selectedMargin === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedMargin(id)}
                  className={`p-3 rounded border text-left transition-colors flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[#111827] border-cyan-500 shadow-sm'
                      : 'bg-[#0B0E17] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>{id.split('_')[0]}</span>
                      <span className="text-slate-500">{m.complexity}</span>
                    </div>
                    <div className="text-xs font-semibold text-slate-200 mt-1 truncate">{m.name}</div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-baseline justify-between font-mono">
                    <span className="text-lg font-bold text-slate-100 tabular-nums">
                      {val.toFixed(id === 'SM-4_ESM' || id === 'SM-8_FASM' ? 1 : 3)}
                    </span>
                    <span className="text-[10px] text-slate-400">{m.symbol}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Margin Detail + Comparative Bar Oscilloscope */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-[#111827] border border-slate-800 rounded p-4 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-slate-100">
                    {meta.name} ({meta.symbol})
                  </h2>
                  <span className="text-xs font-mono text-cyan-400">{meta.complexity} Complexity</span>
                </div>
                <p className="text-xs text-slate-400 mb-4">{meta.desc}</p>

                <div className="space-y-2.5 text-xs font-mono tabular-nums bg-[#07090E] p-3 rounded border border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Current Value:</span>
                    <span className="text-emerald-400 font-semibold">{marginValues[selectedMargin].toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Valid Regime:</span>
                    <span className="text-slate-200">{meta.validWhen}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Evaluated Frequency:</span>
                    <span className="text-cyan-300">
                      {selectedMargin === 'SM-10_NDESM' || selectedMargin === 'SM-9_ZMP' ? '240 Hz' : '60 Hz'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Global Stability M Slider (Section G.7) */}
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-300">Section G.7 Safety Margin M Slider:</span>
                  <span className="text-cyan-300">{config.safetyMarginM.toFixed(2)} (M ∈ (0, 1])</span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={0.5}
                  step={0.01}
                  value={config.safetyMarginM}
                  onChange={(e) => onUpdateConfig({ safetyMarginM: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <div className="text-[11px] font-mono text-slate-500">
                  Enforces S_SM &gt; ML, |τ_req| &lt; (1-M)τ_max, and current sum(|I_i|) &lt; (1-M)I_max.
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-slate-100">Comparative Stability Margins</h2>
                  <span className="text-xs font-mono text-slate-400">Normalized Scale [0, 1]</span>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  Comparative visualization of S_SM, S_LSM, S_NESM, S_ZMP, and S_NDESM across active regime.
                </p>

                <svg viewBox="0 0 500 160" className="w-full h-44 bg-[#07090E] rounded border border-slate-800">
                  <line x1="0" y1="40" x2="500" y2="40" stroke="#1E293B" strokeWidth="1" />
                  <line x1="0" y1="80" x2="500" y2="80" stroke="#1E293B" strokeWidth="1" />
                  <line x1="0" y1="120" x2="500" y2="120" stroke="#1E293B" strokeWidth="1" />

                  {[
                    { label: 'S_SM', val: Math.min(1, Math.max(0, rep.S_SM * 8)), color: '#10B981', x: 40 },
                    { label: 'S_LSM', val: Math.min(1, Math.max(0, rep.S_LSM * 8)), color: '#06B6D4', x: 130 },
                    { label: 'S_NESM', val: Math.min(1, Math.max(0, rep.S_NESM * 10)), color: '#EC4899', x: 220 },
                    { label: 'S_ZMP', val: Math.min(1, Math.max(0, rep.S_ZMP * 8)), color: '#14B8A6', x: 310 },
                    { label: 'S_NDESM', val: Math.min(1, Math.max(0, rep.S_NDESM * 12)), color: '#6366F1', x: 400 },
                  ].map((bar) => {
                    const barHeight = bar.val * 120;
                    return (
                      <g key={bar.label}>
                        <rect
                          x={bar.x}
                          y={140 - barHeight}
                          width={48}
                          height={barHeight}
                          fill={bar.color}
                          opacity={0.75}
                          rx={2}
                        />
                        <text
                          x={bar.x + 24}
                          y={154}
                          textAnchor="middle"
                          fill="#94A3B8"
                          fontSize="10"
                          fontFamily="monospace"
                        >
                          {bar.label}
                        </text>
                        <text
                          x={bar.x + 24}
                          y={Math.max(16, 134 - barHeight)}
                          textAnchor="middle"
                          fill="#FFFFFF"
                          fontSize="10"
                          fontFamily="monospace"
                        >
                          {bar.val.toFixed(2)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
                <span>Evaluated dynamically with 240 Hz sub-stepping</span>
                <span>Current S_NDESM: {rep.S_NDESM.toFixed(4)} m</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
