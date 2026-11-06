import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Sliders } from 'lucide-react';
import {
  GAIT_CATALOG,
  GaitType,
  LightingPreset,
  PhysicsBackend,
  REFERENCE_ROBOTS,
  RobotModelSpec,
  SimControlConfig,
  TerrainType,
} from '../physics/roboticsEngine';

interface ControlSidebarProps {
  config: SimControlConfig;
  customRobots: Record<string, RobotModelSpec>;
  onUpdateConfig: (partial: Partial<SimControlConfig>) => void;
  onStepOnce: () => void;
  onResetSim: () => void;
  onResetPosition: () => void;
  viewportMode: 'dual' | 'preview_a' | 'preview_b';
  onSetViewportMode: (mode: 'dual' | 'preview_a' | 'preview_b') => void;
  simPortion?: 'dynamic' | 'mathematical';
  onSwitchPortion?: (portion: 'dynamic' | 'mathematical') => void;
}

export const ControlSidebar: React.FC<ControlSidebarProps> = ({
  config,
  customRobots,
  onUpdateConfig,
  onStepOnce,
  onResetSim,
  onResetPosition,
  viewportMode,
  onSetViewportMode,
  simPortion = 'mathematical',
  onSwitchPortion,
}) => {
  const allRobots = { ...REFERENCE_ROBOTS, ...customRobots };
  const activeRobot = allRobots[config.robotId] || REFERENCE_ROBOTS.unitree_a1;
  const activeGaitSpec = GAIT_CATALOG[config.gait];

  const gaitKeys = Object.keys(GAIT_CATALOG) as GaitType[];
  const sortedGaitKeys = simPortion === 'dynamic'
    ? [...gaitKeys.filter((k) => GAIT_CATALOG[k].regime === 'dynamic'), ...gaitKeys.filter((k) => GAIT_CATALOG[k].regime === 'static')]
    : [...gaitKeys.filter((k) => GAIT_CATALOG[k].regime === 'static'), ...gaitKeys.filter((k) => GAIT_CATALOG[k].regime === 'dynamic')];

  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  if (isMinimized) {
    return (
      <div className="w-11 h-full bg-white border-r border-slate-200 flex flex-col items-center py-3 shrink-0 text-slate-800 justify-between z-20 select-none shadow-2xs">
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-sky-700 transition-colors cursor-pointer"
            title="Expand Robot Controls Sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <Sliders className="w-4 h-4 text-sky-600 mt-2" />
          <div
            className="text-[11px] font-mono font-semibold text-slate-600 tracking-wider uppercase cursor-pointer hover:text-slate-900 transition-colors whitespace-nowrap"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            onClick={() => setIsMinimized(false)}
          >
            Controls · {config.gait.toUpperCase()}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Expand Controls"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <aside className="w-80 sm:w-84 h-full bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-hidden text-slate-800 z-20 select-none shadow-xs">
      {/* Docked Panel Header */}
      <div className="px-3.5 py-2.5 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-sky-600" />
          <span className="text-xs font-mono font-semibold text-slate-900">Robot Controls</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-300 text-sky-700 font-mono font-semibold">
            {config.gait.toUpperCase()}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsMinimized(true)}
          className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors flex items-center gap-1 text-xs font-mono cursor-pointer"
          title="Collapse sidebar to maximize 3D scene"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="text-[11px] hidden sm:inline">Hide</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* Active Portion Banner (Strict Separation Constraint) */}
        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono">
          <div className="flex items-center justify-between">
            <span className={`font-semibold flex items-center gap-1.5 ${
              simPortion === 'dynamic' ? 'text-amber-800' : 'text-sky-800'
            }`}>
              <span>{simPortion === 'dynamic' ? '⚡' : '📐'}</span>
              <span>{simPortion === 'dynamic' ? 'Portion 1: Dynamic Lab' : 'Portion 2: Math Lab'}</span>
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
              {simPortion === 'dynamic' ? 'RK4 / TGS ODE' : 'Wave LIPM'}
            </span>
          </div>
        </div>

        {/* Viewport Display Layout */}
        <div className="space-y-1.5 pb-3 border-b border-slate-200">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold block">
            Viewport Display Layout
          </span>
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg">
            <button
              type="button"
              onClick={() => onSetViewportMode('dual')}
              className={`py-1.5 px-1.5 text-xs font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                viewportMode === 'dual'
                  ? 'bg-sky-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              Dual A + B
            </button>
            <button
              type="button"
              onClick={() => onSetViewportMode('preview_a')}
              className={`py-1.5 px-1.5 text-xs font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                viewportMode === 'preview_a'
                  ? 'bg-sky-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              Preview A
            </button>
            <button
              type="button"
              onClick={() => onSetViewportMode('preview_b')}
              className={`py-1.5 px-1.5 text-xs font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                viewportMode === 'preview_b'
                  ? 'bg-sky-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              Preview B
            </button>
          </div>
        </div>

        {/* Section 1: Robot & Physics Kernel */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-500 font-semibold">
              01. Robot &amp; Physics Kernel
            </span>
            <span className="text-[11px] font-mono text-sky-700 font-medium">
              {activeRobot.dof} DoF · {activeRobot.totalMass} kg
            </span>
          </div>

          <select
            aria-label="Select Robot Model"
            value={config.robotId}
            onChange={(e) => onUpdateConfig({ robotId: e.target.value })}
            className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-sky-600 shadow-xs"
          >
            {Object.values(allRobots).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.morphology} · {r.dof} DoF)
              </option>
            ))}
          </select>

          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg">
            {(
              [
                { id: 'mujoco_wasm', label: 'MuJoCo WASM' },
                { id: 'nexus_webgpu', label: 'Nexus GPU' },
                { id: 'pybullet_cloud', label: 'PyBullet RPC' },
              ] as { id: PhysicsBackend; label: string }[]
            ).map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => onUpdateConfig({ backend: b.id })}
                className={`py-1.5 px-1.5 text-[11px] font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                  config.backend === b.id
                    ? 'bg-sky-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Gait Catalog & Transition FSM */}
        <div className="space-y-2.5 pt-3 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-500 font-semibold">
              02. Gait Catalog &amp; FSM
            </span>
            <span className="text-[11px] font-mono text-slate-500 font-medium">
              DF {activeGaitSpec.dutyFactor.toFixed(2)} · {activeGaitSpec.stabilityType}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {sortedGaitKeys.map((gKey) => {
              const g = GAIT_CATALOG[gKey];
              const isSelected = config.gait === gKey;
              return (
                <button
                  key={gKey}
                  type="button"
                  onClick={() => onUpdateConfig({ gait: gKey })}
                  className={`py-1.5 px-2 text-xs font-mono rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                    isSelected
                      ? simPortion === 'dynamic'
                        ? 'bg-amber-100 text-amber-900 border-amber-400 font-semibold shadow-xs'
                        : 'bg-sky-100 text-sky-900 border-sky-400 font-semibold shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {g.name}
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-600 leading-relaxed font-sans">
            {activeGaitSpec.supportPattern} · Range {activeGaitSpec.velocityRange[0]}–
            {activeGaitSpec.velocityRange[1]} m/s
          </p>
        </div>

        {/* Section 3: Velocity & Real Trajectory Progression */}
        <div className="space-y-3 pt-3 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-500 font-semibold">
              03. Velocity &amp; Trajectory Drive
            </span>
            <button
              type="button"
              onClick={onResetPosition}
              className="text-[11px] font-mono text-sky-700 hover:text-sky-900 font-semibold hover:underline"
            >
              Reset Track Position
            </button>
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono tabular-nums mb-1">
              <span className="text-slate-700 font-medium">Forward Velocity v_x</span>
              <span className={simPortion === 'dynamic' ? 'text-amber-700 font-bold' : 'text-sky-700 font-bold'}>
                {config.forwardVel.toFixed(2)} m/s
              </span>
            </div>
            <input
              type="range"
              min={-0.4}
              max={1.8}
              step={0.05}
              value={config.forwardVel}
              onChange={(e) => onUpdateConfig({ forwardVel: parseFloat(e.target.value) })}
              className="w-full accent-sky-600"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono tabular-nums mb-1">
              <span className="text-slate-700 font-medium">Lateral Velocity v_y</span>
              <span className={simPortion === 'dynamic' ? 'text-amber-700 font-bold' : 'text-sky-700 font-bold'}>
                {config.lateralVel.toFixed(2)} m/s
              </span>
            </div>
            <input
              type="range"
              min={-0.4}
              max={0.4}
              step={0.05}
              value={config.lateralVel}
              onChange={(e) => onUpdateConfig({ lateralVel: parseFloat(e.target.value) })}
              className="w-full accent-sky-600"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono tabular-nums mb-1">
              <span className="text-slate-700 font-medium">Yaw Turn Rate ω_z</span>
              <span className={simPortion === 'dynamic' ? 'text-amber-700 font-bold' : 'text-sky-700 font-bold'}>
                {config.turnRate.toFixed(2)} rad/s
              </span>
            </div>
            <input
              type="range"
              min={-1.0}
              max={1.0}
              step={0.05}
              value={config.turnRate}
              onChange={(e) => onUpdateConfig({ turnRate: parseFloat(e.target.value) })}
              className="w-full accent-sky-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between text-[11px] font-mono tabular-nums mb-1">
                <span className="text-slate-600 font-medium">Step Clearance</span>
                <span className="text-slate-800 font-bold">{(config.stepHeight * 100).toFixed(0)} cm</span>
              </div>
              <input
                type="range"
                min={0.03}
                max={0.16}
                step={0.01}
                value={config.stepHeight}
                onChange={(e) => onUpdateConfig({ stepHeight: parseFloat(e.target.value) })}
                className="w-full accent-sky-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-mono tabular-nums mb-1">
                <span className="text-slate-600 font-medium">Cadence</span>
                <span className="text-slate-800 font-bold">{config.gaitFrequencyHz.toFixed(1)} Hz</span>
              </div>
              <input
                type="range"
                min={1.2}
                max={3.6}
                step={0.1}
                value={config.gaitFrequencyHz}
                onChange={(e) =>
                  onUpdateConfig({ gaitFrequencyHz: parseFloat(e.target.value) })
                }
                className="w-full accent-sky-600"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Tailored by Portion (Dynamic vs Mathematical) */}
        {simPortion === 'dynamic' ? (
          <div className="space-y-3 pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-500 font-semibold">
                04. Dynamic Physics &amp; Contact
              </span>
              <span className="text-[11px] font-mono text-amber-700 font-bold">
                μ={config.frictionMu.toFixed(2)} · λ={config.dampingLambda.toFixed(3)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-[11px] font-mono tabular-nums mb-1">
                  <span className="text-slate-600 font-medium">Friction Coeff μ</span>
                  <span className="text-amber-700 font-bold">{config.frictionMu.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1.5}
                  step={0.05}
                  value={config.frictionMu}
                  onChange={(e) =>
                    onUpdateConfig({ frictionMu: parseFloat(e.target.value) })
                  }
                  className="w-full accent-amber-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-mono tabular-nums mb-1">
                  <span className="text-slate-600 font-medium">Damping λ (DLS)</span>
                  <span className="text-amber-700 font-bold">{config.dampingLambda.toFixed(3)}</span>
                </div>
                <input
                  type="range"
                  min={0.001}
                  max={0.05}
                  step={0.002}
                  value={config.dampingLambda}
                  onChange={(e) =>
                    onUpdateConfig({ dampingLambda: parseFloat(e.target.value) })
                  }
                  className="w-full accent-amber-600"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-mono tabular-nums mb-1">
                <span className="text-slate-600 font-medium">TGS Solver Iterations</span>
                <span className="text-slate-800 font-bold">{config.solverIterations} iters</span>
              </div>
              <input
                type="range"
                min={20}
                max={100}
                step={5}
                value={config.solverIterations}
                onChange={(e) =>
                  onUpdateConfig({ solverIterations: parseInt(e.target.value, 10) })
                }
                className="w-full accent-slate-700"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono pt-1">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={config.domainRandomization.enabled}
                  onChange={(e) =>
                    onUpdateConfig({
                      domainRandomization: {
                        ...config.domainRandomization,
                        enabled: e.target.checked,
                      },
                    })
                  }
                  className="rounded accent-amber-600"
                />
                Domain Randomization
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={config.symmetryEnabled.morphological}
                  onChange={(e) =>
                    onUpdateConfig({
                      symmetryEnabled: {
                        ...config.symmetryEnabled,
                        morphological: e.target.checked,
                      },
                    })
                  }
                  className="rounded accent-amber-600"
                />
                Symmetry Guidance
              </label>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-500 font-semibold">
                04. Mathematical Controls (G)
              </span>
              <span className="text-[11px] font-mono text-sky-700 font-bold">
                β={config.dutyFactorBeta.toFixed(2)} · M={(config.safetyMarginM * 100).toFixed(0)}%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-[11px] font-mono tabular-nums mb-1">
                  <span className="text-slate-600 font-medium">Duty Factor β</span>
                  <span className="text-sky-700 font-bold">{config.dutyFactorBeta.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.75}
                  max={0.96}
                  step={0.01}
                  value={config.dutyFactorBeta}
                  onChange={(e) =>
                    onUpdateConfig({ dutyFactorBeta: parseFloat(e.target.value) })
                  }
                  className="w-full accent-sky-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-mono tabular-nums mb-1">
                  <span className="text-slate-600 font-medium">Stroke R_x</span>
                  <span className="text-sky-700 font-bold">{(config.strokeRx * 100).toFixed(0)} cm</span>
                </div>
                <input
                  type="range"
                  min={0.15}
                  max={0.4}
                  step={0.01}
                  value={config.strokeRx}
                  onChange={(e) =>
                    onUpdateConfig({ strokeRx: parseFloat(e.target.value) })
                  }
                  className="w-full accent-sky-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-[11px] font-mono tabular-nums mb-1">
                  <span className="text-slate-600 font-medium">Crab Angle α</span>
                  <span className="text-sky-700 font-bold">{((config.crabAngleRad * 180) / Math.PI).toFixed(0)}°</span>
                </div>
                <input
                  type="range"
                  min={-45}
                  max={45}
                  step={1}
                  value={Math.round((config.crabAngleRad * 180) / Math.PI)}
                  onChange={(e) =>
                    onUpdateConfig({ crabAngleRad: (parseFloat(e.target.value) * Math.PI) / 180 })
                  }
                  className="w-full accent-sky-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-mono tabular-nums mb-1">
                  <span className="text-slate-600 font-medium">Safety Margin M</span>
                  <span className="text-sky-700 font-bold">{config.safetyMarginM.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={0.35}
                  step={0.01}
                  value={config.safetyMarginM}
                  onChange={(e) =>
                    onUpdateConfig({ safetyMarginM: parseFloat(e.target.value) })
                  }
                  className="w-full accent-sky-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono pt-1">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={config.enableFuzzyAcceleration}
                  onChange={(e) =>
                    onUpdateConfig({ enableFuzzyAcceleration: e.target.checked })
                  }
                  className="rounded accent-sky-600"
                />
                Fuzzy Mamdani FIS Accel
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={config.useSimplifiedDynamics}
                  onChange={(e) =>
                    onUpdateConfig({ useSimplifiedDynamics: e.target.checked })
                  }
                  className="rounded accent-sky-600"
                />
                R_h Fast Dynamics
              </label>
            </div>
          </div>
        )}

        {/* Section 5: Terrain & Lighting Presets */}
        <div className="space-y-2.5 pt-3 border-t border-slate-200">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-500 font-semibold block">
            05. Terrain &amp; Lighting
          </span>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-mono text-slate-600 font-medium block mb-1">
                Terrain Profile
              </label>
              <select
                value={config.terrain}
                onChange={(e) =>
                  onUpdateConfig({ terrain: e.target.value as TerrainType })
                }
                className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-sky-600 shadow-xs"
              >
                <option value="flat_plane">Light Flat Track</option>
                <option value="stepped_obstacles">Stepped Platforms</option>
                <option value="inclined_ramp">15° Inclined Ramp</option>
                <option value="uneven_dem">DEM Heightfield</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-600 font-medium block mb-1">
                Lighting Preset
              </label>
              <select
                value={config.lighting}
                onChange={(e) =>
                  onUpdateConfig({ lighting: e.target.value as LightingPreset })
                }
                className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-sky-600 shadow-xs"
              >
                <option value="indoor_lab">Indoor Lab (Light)</option>
                <option value="outdoor_sunny">Outdoor Sunny</option>
                <option value="night">Night Sensor Mode</option>
                <option value="warehouse">Logistics Warehouse</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="p-2.5 bg-slate-100/90 border-t border-slate-200 flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onUpdateConfig({ running: !config.running })}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 shadow-xs ${
            config.running
              ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold'
              : 'bg-sky-600 text-white hover:bg-sky-500 font-semibold'
          }`}
        >
          {config.running ? 'Pause Simulation' : 'Start Simulation'}
        </button>
        <button
          type="button"
          onClick={onStepOnce}
          disabled={config.running}
          className="py-2 px-2.5 rounded-lg text-xs font-mono bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap shrink-0 shadow-xs"
          title="Advance single 240 Hz step"
        >
          Step +1
        </button>
        <button
          type="button"
          onClick={onResetSim}
          className="py-2 px-2.5 rounded-lg text-xs font-mono bg-slate-200 text-slate-700 border border-slate-300 hover:bg-slate-300 whitespace-nowrap shrink-0 shadow-xs"
        >
          Reset All
        </button>
      </div>
    </aside>
  );
};
