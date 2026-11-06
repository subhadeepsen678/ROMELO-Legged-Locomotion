import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Binary,
  CheckCircle2,
  ChevronDown,
  Compass,
  Cpu,
  Download,
  Layers,
  LayoutGrid,
  Search,
  ShieldCheck,
  Sigma,
  X,
  Zap,
} from 'lucide-react';
import { AlgorithmInspector } from './components/AlgorithmInspector';
import { ControlSidebar } from './components/ControlSidebar';
import { DatasetSimToReal } from './components/DatasetSimToReal';
import { FrontierModules } from './components/FrontierModules';
import { SensorTelemetryHub } from './components/SensorTelemetryHub';
import { StabilityDashboard } from './components/StabilityDashboard';
import { TelemetryTray } from './components/TelemetryTray';
import { UrdfWorldStudio } from './components/UrdfWorldStudio';
import { ValidationSuite } from './components/ValidationSuite';
import { OverlayVisibility, Viewport3D } from './components/Viewport3D';
import {
  DEFAULT_DYNAMIC_SIM_CONFIG,
  DEFAULT_MATH_SIM_CONFIG,
  LrspSimulationCore,
  RobotModelSpec,
  SimControlConfig,
  SimulationStateFrame,
} from './physics/roboticsEngine';

type WorkspaceSection =
  | 'sim_dynamic'
  | 'sim_math'
  | 'sim_dual_compare'
  | 'sensor_telemetry'
  | 'stability_dashboard'
  | 'validation_bench'
  | 'algorithm_inspector'
  | 'frontier_modules'
  | 'urdf_world'
  | 'dataset_export';

export function App() {
  // -------------------------------------------------------------
  // Independent Simulation Cores (Zero Overriding)
  // -------------------------------------------------------------
  const simCoreDynamicRef = useRef<LrspSimulationCore>(new LrspSimulationCore());
  const simCoreMathRef = useRef<LrspSimulationCore>(new LrspSimulationCore());

  const [activeSection, setActiveSection] = useState<WorkspaceSection>('sim_dynamic');
  const [inspectorSource, setInspectorSource] = useState<'dynamic' | 'mathematical'>('mathematical');
  const [urdfPortion, setUrdfPortion] = useState<'dynamic' | 'mathematical'>('dynamic');
  const [customRobots, setCustomRobots] = useState<Record<string, RobotModelSpec>>({});
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordedFrames, setRecordedFrames] = useState<SimulationStateFrame[]>([]);
  const [showModuleNavigator, setShowModuleNavigator] = useState<boolean>(false);
  const [moduleSearchQuery, setModuleSearchQuery] = useState<string>('');

  // Default Overlay Visibility Template
  const defaultOverlays: OverlayVisibility = {
    zmpMarker: true,
    supportPolygon: true,
    comTrail: true,
    worldTrajectory: true,
    contactForces: true,
    frictionCones: true,
    swingTrails: true,
    stanceDiscs: true,
    lidarCloud: false,
    imuTriad: true,
    sensorFrustum: false,
    collisionDebug: false,
    distanceMarkers: true,
  };

  // -------------------------------------------------------------
  // Portion 1: Dynamic Locomotion State (Original Simulation)
  // -------------------------------------------------------------
  const [dynamicConfig, setDynamicConfig] = useState<SimControlConfig>(DEFAULT_DYNAMIC_SIM_CONFIG);
  const [dynamicViewportMode, setDynamicViewportMode] = useState<'dual' | 'preview_a' | 'preview_b'>('dual');
  const [dynamicOverlays, setDynamicOverlays] = useState<OverlayVisibility>(defaultOverlays);
  const [dynamicFrame, setDynamicFrame] = useState<SimulationStateFrame>(() =>
    simCoreDynamicRef.current.step(0.016, DEFAULT_DYNAMIC_SIM_CONFIG)
  );
  const [dynamicTelemetryHistory, setDynamicTelemetryHistory] = useState<SimulationStateFrame[]>([
    dynamicFrame,
  ]);

  // -------------------------------------------------------------
  // Portion 2: Mathematical Foundations State (Fabricated Now)
  // -------------------------------------------------------------
  const [mathConfig, setMathConfig] = useState<SimControlConfig>(DEFAULT_MATH_SIM_CONFIG);
  const [mathViewportMode, setMathViewportMode] = useState<'dual' | 'preview_a' | 'preview_b'>('dual');
  const [mathOverlays, setMathOverlays] = useState<OverlayVisibility>(defaultOverlays);
  const [mathFrame, setMathFrame] = useState<SimulationStateFrame>(() =>
    simCoreMathRef.current.step(0.016, DEFAULT_MATH_SIM_CONFIG)
  );
  const [mathTelemetryHistory, setMathTelemetryHistory] = useState<SimulationStateFrame[]>([
    mathFrame,
  ]);

  // Sync refs for high-frequency physics tick
  const dynamicConfigRef = useRef(dynamicConfig);
  dynamicConfigRef.current = dynamicConfig;
  const mathConfigRef = useRef(mathConfig);
  mathConfigRef.current = mathConfig;
  const recordingRef = useRef(isRecording);
  recordingRef.current = isRecording;
  const activeSectionRef = useRef(activeSection);
  activeSectionRef.current = activeSection;

  // -------------------------------------------------------------
  // High-Frequency Real-Time Physics Loop (240 Hz Sub-stepping)
  // -------------------------------------------------------------
  useEffect(() => {
    const dtSubstep = 1 / 240;
    const interval = setInterval(() => {
      // 1. Step Portion 1 (Dynamic Simulation) independently
      const dCfg = dynamicConfigRef.current;
      if (dCfg.running) {
        let latestD: SimulationStateFrame | null = null;
        for (let s = 0; s < 4; s++) {
          latestD = simCoreDynamicRef.current.step(dtSubstep * dCfg.simSpeedMultiplier, dCfg);
        }

        if (dCfg.externalPush.decayRemaining > 0) {
          setDynamicConfig((prev) => ({
            ...prev,
            externalPush: {
              ...prev.externalPush,
              decayRemaining: Math.max(0, prev.externalPush.decayRemaining - 0.08),
            },
          }));
        }

        if (latestD) {
          setDynamicFrame(latestD);
          setDynamicTelemetryHistory((h) => [...h.slice(-95), latestD!]);
          if (recordingRef.current && activeSectionRef.current === 'sim_dynamic') {
            setRecordedFrames((rec) => [...rec.slice(-999), latestD!]);
          }
        }
      }

      // 2. Step Portion 2 (Mathematical Simulation) independently
      const mCfg = mathConfigRef.current;
      if (mCfg.running) {
        let latestM: SimulationStateFrame | null = null;
        for (let s = 0; s < 4; s++) {
          latestM = simCoreMathRef.current.step(dtSubstep * mCfg.simSpeedMultiplier, mCfg);
        }

        if (mCfg.externalPush.decayRemaining > 0) {
          setMathConfig((prev) => ({
            ...prev,
            externalPush: {
              ...prev.externalPush,
              decayRemaining: Math.max(0, prev.externalPush.decayRemaining - 0.08),
            },
          }));
        }

        if (latestM) {
          setMathFrame(latestM);
          setMathTelemetryHistory((h) => [...h.slice(-95), latestM!]);
          if (recordingRef.current && activeSectionRef.current === 'sim_math') {
            setRecordedFrames((rec) => [...rec.slice(-999), latestM!]);
          }
        }
      }
    }, 33);

    return () => clearInterval(interval);
  }, []);

  // Handlers for Portion 1 (Dynamic)
  const handleUpdateDynamicConfig = (partial: Partial<SimControlConfig>) => {
    setDynamicConfig((prev) => ({ ...prev, ...partial }));
  };

  const handleStepOnceDynamic = () => {
    const next = simCoreDynamicRef.current.step(1 / 240, dynamicConfig);
    setDynamicFrame(next);
    setDynamicTelemetryHistory((h) => [...h.slice(-95), next]);
  };

  const handleResetSimDynamic = () => {
    simCoreDynamicRef.current.reset(dynamicConfig.robotId);
    const next = simCoreDynamicRef.current.step(1 / 240, dynamicConfig);
    setDynamicFrame(next);
    setDynamicTelemetryHistory([next]);
  };

  const handleResetPositionDynamic = () => {
    simCoreDynamicRef.current.reset(dynamicConfig.robotId);
    const next = simCoreDynamicRef.current.step(1 / 240, dynamicConfig);
    setDynamicFrame(next);
  };

  const handleToggleOverlayDynamic = (key: keyof OverlayVisibility) => {
    setDynamicOverlays((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleApplyPushDynamic = (fx: number, fy: number) => {
    setDynamicConfig((prev) => ({
      ...prev,
      externalPush: { fx, fy, decayRemaining: 1.0 },
    }));
  };

  // Handlers for Portion 2 (Mathematical)
  const handleUpdateMathConfig = (partial: Partial<SimControlConfig>) => {
    setMathConfig((prev) => ({ ...prev, ...partial }));
  };

  const handleStepOnceMath = () => {
    const next = simCoreMathRef.current.step(1 / 240, mathConfig);
    setMathFrame(next);
    setMathTelemetryHistory((h) => [...h.slice(-95), next]);
  };

  const handleResetSimMath = () => {
    simCoreMathRef.current.reset(mathConfig.robotId);
    const next = simCoreMathRef.current.step(1 / 240, mathConfig);
    setMathFrame(next);
    setMathTelemetryHistory([next]);
  };

  const handleResetPositionMath = () => {
    simCoreMathRef.current.reset(mathConfig.robotId);
    const next = simCoreMathRef.current.step(1 / 240, mathConfig);
    setMathFrame(next);
  };

  const handleToggleOverlayMath = (key: keyof OverlayVisibility) => {
    setMathOverlays((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleApplyPushMath = (fx: number, fy: number) => {
    setMathConfig((prev) => ({
      ...prev,
      externalPush: { fx, fy, decayRemaining: 1.0 },
    }));
  };

  // Export Snapshot from currently viewed portion
  const handleExportSnapshot = () => {
    const isDynamic = activeSection === 'sim_dynamic';
    const cfg = isDynamic ? dynamicConfig : mathConfig;
    const frame = isDynamic ? dynamicFrame : mathFrame;
    const label = isDynamic ? 'portion1_dynamic' : 'portion2_mathematical';

    const snapshot = {
      platform: 'LRSP Locomotion Platform v1.2',
      portion: label,
      exportedAt: new Date().toISOString(),
      config: cfg,
      state: frame,
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lrsp_${label}_${frame.robotId}_${frame.gait}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Workspace Categories & Metadata (Zero hidden tabs, clear domain grouping)
  const workspaceCategories = [
    {
      id: 'simulations',
      name: 'Simulation Labs',
      items: [
        {
          id: 'sim_dynamic' as WorkspaceSection,
          label: 'Portion 1: Dynamic Locomotion Lab',
          shortLabel: 'Portion 1 (Dynamic)',
          badge: '240Hz Physics',
          description: 'Rigid-body dynamics with contact friction, restitution & terrain interaction.',
          icon: Zap,
          activeClass: 'bg-amber-500 text-slate-950 font-semibold shadow-2xs border-amber-600',
        },
        {
          id: 'sim_math' as WorkspaceSection,
          label: 'Portion 2: Mathematical Foundations',
          shortLabel: 'Portion 2 (Math)',
          badge: 'Analytical LIPM',
          description: 'Linear inverted pendulum model, closed-form ZMP inversion & fuzzy balance.',
          icon: Sigma,
          activeClass: 'bg-sky-600 text-white font-semibold shadow-2xs border-sky-700',
        },
        {
          id: 'sim_dual_compare' as WorkspaceSection,
          label: 'Side-by-Side Dual Simulation',
          shortLabel: 'Dual Compare',
          badge: 'Concurrent',
          description: 'Synchronous dual simulation comparing dynamic and mathematical models side-by-side.',
          icon: Layers,
          activeClass: 'bg-indigo-600 text-white font-semibold shadow-2xs border-indigo-700',
        },
      ],
    },
    {
      id: 'telemetry',
      name: 'Telemetry & Balance',
      items: [
        {
          id: 'sensor_telemetry' as WorkspaceSection,
          label: 'Sensor Suite & Diagnostics',
          shortLabel: 'Sensor Suite',
          badge: 'Hardware Stream',
          description: 'Inspect simulated LiDAR point cloud, 6-axis IMU, encoders, and thermal telemetry.',
          icon: Activity,
          activeClass: 'bg-emerald-600 text-white font-semibold shadow-2xs border-emerald-700',
        },
        {
          id: 'stability_dashboard' as WorkspaceSection,
          label: 'Stability & LIPM Dashboard',
          shortLabel: 'Stability & LIPM',
          badge: 'LIPM & ZMP',
          description: 'LIPM inverted pendulum simulation, Capture Point stepping, support polygon convex hull, and stability margins.',
          icon: ShieldCheck,
          activeClass: 'bg-teal-600 text-white font-semibold shadow-2xs border-teal-700',
        },
      ],
    },
    {
      id: 'analysis',
      name: 'Analysis & Testing',
      items: [
        {
          id: 'algorithm_inspector' as WorkspaceSection,
          label: 'Algorithm & Kinematics Inspector',
          shortLabel: 'Kinematics & FIS',
          badge: 'Math Inspector',
          description: 'Deconstruct forward/inverse kinematics equations, Mamdani FIS rules, and Bézier curves.',
          icon: Binary,
          activeClass: 'bg-violet-600 text-white font-semibold shadow-2xs border-violet-700',
        },
        {
          id: 'validation_bench' as WorkspaceSection,
          label: 'Physics Verification Suite',
          shortLabel: 'Verification Suite',
          badge: 'Gap Register',
          description: 'Automated test bench verifying simulation physics against the completeness register.',
          icon: CheckCircle2,
          activeClass: 'bg-rose-600 text-white font-semibold shadow-2xs border-rose-700',
        },
      ],
    },
    {
      id: 'robotics',
      name: 'Robotics & Data',
      items: [
        {
          id: 'urdf_world' as WorkspaceSection,
          label: 'URDF & World Studio',
          shortLabel: 'URDF Studio',
          badge: 'Kinematic Tree',
          description: 'Inspect link kinematic tree, mass distribution, inertia tensor, and world XML schemas.',
          icon: Cpu,
          activeClass: 'bg-blue-600 text-white font-semibold shadow-2xs border-blue-700',
        },
        {
          id: 'frontier_modules' as WorkspaceSection,
          label: 'Frontier Modules',
          shortLabel: 'Frontier Modules',
          badge: 'Perception & RL',
          description: 'Terrain elevation mapping, foot slip estimation, and reinforcement learning policies.',
          icon: Compass,
          activeClass: 'bg-cyan-600 text-white font-semibold shadow-2xs border-cyan-700',
        },
        {
          id: 'dataset_export' as WorkspaceSection,
          label: 'Sim-to-Real Dataset Export',
          shortLabel: 'Sim-to-Real',
          badge: 'HDF5 / CSV',
          description: 'High-frequency telemetry logging, frame recording, and training dataset generator.',
          icon: Download,
          activeClass: 'bg-slate-700 text-white font-semibold shadow-2xs border-slate-800',
        },
      ],
    },
  ];

  // Active frame for inspectors based on user toggle
  const currentInspectorFrame = inspectorSource === 'dynamic' ? dynamicFrame : mathFrame;
  const currentInspectorConfig = inspectorSource === 'dynamic' ? dynamicConfig : mathConfig;

  // Active workspace metadata lookup
  const currentWorkspace =
    workspaceCategories
      .flatMap((c) => c.items)
      .find((item) => item.id === activeSection) || workspaceCategories[0].items[0];

  // Listen for Escape key to dismiss navigator modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowModuleNavigator(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="h-full min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Primary Top Header */}
      <header className="flex items-center justify-between gap-4 px-5 py-2.5 bg-white border-b border-slate-200 shadow-2xs shrink-0">
        <div className="flex items-center gap-3">
          <a
            href="#sim_dynamic"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('sim_dynamic');
            }}
            className="flex items-center gap-2.5 group"
          >
            <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white shadow-2xs font-bold text-xs tracking-wider group-hover:bg-sky-500 transition-colors">
              LR
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-display font-bold tracking-tight text-slate-900 whitespace-nowrap">
                LRSP Locomotion Platform
              </span>
              <span className="text-[10px] text-slate-500 font-mono">v1.2 Research Station</span>
            </div>
          </a>

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          {/* All Modules Directory Launcher Button */}
          <button
            type="button"
            onClick={() => setShowModuleNavigator((prev) => !prev)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
              showModuleNavigator
                ? 'bg-sky-50 text-sky-900 border-sky-300 ring-2 ring-sky-200 font-semibold'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-950 font-medium'
            }`}
            title="Open Complete Module Navigator Directory"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-sky-600" />
            <span className="font-semibold text-slate-800">All Modules</span>
            <span className="text-slate-300 font-normal">|</span>
            <span className="text-sky-700 font-semibold hidden md:inline">{currentWorkspace.shortLabel}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showModuleNavigator ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Live Travel, Origin & Reset in Top Bar */}
          <div className="hidden lg:flex items-center gap-2.5 px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-mono">
            <span className="text-slate-500">Travel:</span>
            <span className="text-emerald-700 font-bold tabular-nums">
              {(activeSection === 'sim_dynamic' ? dynamicFrame : mathFrame).odometerM.toFixed(2)}m
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500">Origin Δ:</span>
            <span className="text-sky-700 font-bold tabular-nums">
              {(activeSection === 'sim_dynamic' ? dynamicFrame : mathFrame).displacementM.toFixed(2)}m
            </span>
            <span className="text-slate-300">·</span>
            <button
              type="button"
              onClick={activeSection === 'sim_dynamic' ? handleResetPositionDynamic : handleResetPositionMath}
              className="px-2 py-0.5 rounded bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-slate-300 transition-colors font-medium shadow-2xs cursor-pointer"
              title="Reset robot position to [0, 0]"
            >
              Reset (0,0)
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportSnapshot}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-500 transition-colors whitespace-nowrap shrink-0 shadow-xs cursor-pointer"
            title="Download JSON state frame of active simulation"
          >
            Export Snapshot
          </button>
        </div>
      </header>

      {/* Structured Categorized Workstation Navigation Bar (Clear Domain Clusters, No Hidden Sliders) */}
      <nav aria-label="Workstation Navigation" className="bg-white border-b border-slate-200 px-4 py-1.5 flex items-center justify-between gap-3 shrink-0 overflow-x-auto text-xs font-mono shadow-2xs">
        <div className="flex items-center gap-3 shrink-0">
          {workspaceCategories.map((cat, catIdx) => (
            <React.Fragment key={cat.id}>
              {catIdx > 0 && <div className="h-4 w-px bg-slate-200 hidden sm:block shrink-0" />}
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mr-1 hidden 2xl:inline shrink-0">
                  {cat.name}:
                </span>
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
                  {cat.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveSection(item.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors whitespace-nowrap cursor-pointer text-xs ${
                          isActive
                            ? item.activeClass
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                        }`}
                        title={`${item.label} — ${item.description}`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${isActive ? '' : 'text-slate-500'}`} />
                        <span>{item.shortLabel}</span>
                        {item.badge && (
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded font-mono hidden md:inline ${
                              isActive
                                ? 'bg-black/15 text-current font-bold'
                                : 'bg-slate-200/80 text-slate-600'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowModuleNavigator(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-slate-500 hover:text-sky-700 hover:bg-sky-50 transition-colors text-xs shrink-0 cursor-pointer border border-transparent hover:border-sky-200"
          title="Browse All Modules with detailed descriptions"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Module Guide</span>
        </button>
      </nav>

      {/* Workspace Directory Modal / Mega-Menu for Easy Navigation */}
      {showModuleNavigator && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-16 px-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModuleNavigator(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-5xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-600 text-white shadow-2xs">
                  <LayoutGrid className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Platform Workspace Navigator</h2>
                  <p className="text-xs text-slate-500">
                    Direct access to all 10 simulation labs, telemetry suites, and robotics modules
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* Search / Filter input */}
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={moduleSearchQuery}
                    onChange={(e) => setModuleSearchQuery(e.target.value)}
                    placeholder="Filter modules (e.g. URDF, ZMP, Sensor)..."
                    className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    autoFocus
                  />
                  {moduleSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setModuleSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowModuleNavigator(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  title="Close Navigator (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content: Categorized Grid */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
              {workspaceCategories.map((cat) => {
                const filteredItems = cat.items.filter(
                  (item) =>
                    item.label.toLowerCase().includes(moduleSearchQuery.toLowerCase()) ||
                    item.description.toLowerCase().includes(moduleSearchQuery.toLowerCase()) ||
                    item.shortLabel.toLowerCase().includes(moduleSearchQuery.toLowerCase()) ||
                    (item.badge && item.badge.toLowerCase().includes(moduleSearchQuery.toLowerCase()))
                );

                if (filteredItems.length === 0) return null;

                return (
                  <div key={cat.id} className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        {cat.name}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 border border-slate-200">
                        {filteredItems.length} {filteredItems.length === 1 ? 'module' : 'modules'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filteredItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeSection === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setActiveSection(item.id);
                              setShowModuleNavigator(false);
                            }}
                            className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2.5 cursor-pointer group ${
                              isActive
                                ? 'bg-sky-50/80 border-sky-300 ring-2 ring-sky-200 shadow-xs'
                                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 shadow-2xs hover:shadow-xs'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`p-2 rounded-lg ${
                                    isActive
                                      ? 'bg-sky-600 text-white'
                                      : 'bg-slate-100 text-slate-700 group-hover:bg-sky-100 group-hover:text-sky-800'
                                  } transition-colors`}
                                >
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                                    {item.label}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono">
                                    ID: {item.id}
                                  </div>
                                </div>
                              </div>

                              {item.badge && (
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded font-mono shrink-0 ${
                                    isActive
                                      ? 'bg-sky-200 text-sky-900 font-semibold'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {item.badge}
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-slate-600 leading-relaxed">
                              {item.description}
                            </p>

                            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                              <span className={isActive ? 'text-sky-700 font-semibold' : 'text-slate-400 group-hover:text-slate-600'}>
                                {isActive ? '● Currently Active' : 'Click to Open →'}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Empty state if search finds nothing */}
              {workspaceCategories.every(
                (cat) =>
                  cat.items.filter(
                    (item) =>
                      item.label.toLowerCase().includes(moduleSearchQuery.toLowerCase()) ||
                      item.description.toLowerCase().includes(moduleSearchQuery.toLowerCase()) ||
                      item.shortLabel.toLowerCase().includes(moduleSearchQuery.toLowerCase()) ||
                      (item.badge && item.badge.toLowerCase().includes(moduleSearchQuery.toLowerCase()))
                  ).length === 0
              ) && (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <p className="text-sm font-semibold text-slate-700">No workspace modules match "{moduleSearchQuery}"</p>
                  <p className="text-xs">Try searching for keywords like "URDF", "ZMP", "Sensor", "LIPM", or "Kinematics".</p>
                  <button
                    type="button"
                    onClick={() => setModuleSearchQuery('')}
                    className="mt-2 px-3 py-1 text-xs font-medium bg-sky-100 text-sky-800 rounded-lg hover:bg-sky-200 transition-colors cursor-pointer"
                  >
                    Clear Filter
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-mono">
              <span>Press <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 shadow-2xs text-[10px] text-slate-700">Esc</kbd> to dismiss</span>
              <span>10 Specialized Robotics Stations</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* ========================================================= */}
        {/* PORTION 1: DYNAMIC LOCOMOTION LAB (Original Simulation)   */}
        {/* ========================================================= */}
        {/* ========================================================= */}
        {/* PORTION 1: DYNAMIC LOCOMOTION LAB (Full-Screen 3D)        */}
        {/* ========================================================= */}
        {activeSection === 'sim_dynamic' && (
          <div className="flex-1 flex w-full h-full overflow-hidden bg-slate-100">
            {/* Docked Control Sidebar (Left) */}
            <ControlSidebar
              config={dynamicConfig}
              customRobots={customRobots}
              onUpdateConfig={(partial) => {
                if (partial.robotId && partial.robotId !== dynamicConfig.robotId) {
                  simCoreDynamicRef.current.reset(partial.robotId);
                }
                handleUpdateDynamicConfig(partial);
              }}
              onStepOnce={handleStepOnceDynamic}
              onResetSim={handleResetSimDynamic}
              onResetPosition={handleResetPositionDynamic}
              viewportMode={dynamicViewportMode}
              onSetViewportMode={setDynamicViewportMode}
              simPortion="dynamic"
              onSwitchPortion={(portion) => {
                if (portion === 'mathematical') setActiveSection('sim_math');
              }}
            />

            {/* Main Center Column: 3D Viewport + Docked Telemetry Tray */}
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
              <div className="flex-1 relative w-full h-full overflow-hidden">
                {dynamicViewportMode === 'dual' ? (
                  <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-300">
                    <div className="relative w-full h-full">
                      <Viewport3D
                        frame={dynamicFrame}
                        overlays={dynamicOverlays}
                        onToggleOverlay={handleToggleOverlayDynamic}
                        lighting={dynamicConfig.lighting}
                        terrain={dynamicConfig.terrain}
                        onApplyPush={handleApplyPushDynamic}
                        onResetPosition={handleResetPositionDynamic}
                        previewVariant="preview_a"
                        title="Arena Overview"
                        portionLabel="Portion 1: Dynamic"
                      />
                    </div>
                    <div className="relative w-full h-full">
                      <Viewport3D
                        frame={dynamicFrame}
                        overlays={dynamicOverlays}
                        onToggleOverlay={handleToggleOverlayDynamic}
                        lighting={dynamicConfig.lighting}
                        terrain={dynamicConfig.terrain}
                        onApplyPush={handleApplyPushDynamic}
                        onResetPosition={handleResetPositionDynamic}
                        previewVariant="preview_b"
                        title="Tactical Tracking"
                        portionLabel="Portion 1: Dynamic"
                      />
                    </div>
                  </div>
                ) : (
                  <Viewport3D
                    frame={dynamicFrame}
                    overlays={dynamicOverlays}
                    onToggleOverlay={handleToggleOverlayDynamic}
                    lighting={dynamicConfig.lighting}
                    terrain={dynamicConfig.terrain}
                    onApplyPush={handleApplyPushDynamic}
                    onResetPosition={handleResetPositionDynamic}
                    previewVariant={dynamicViewportMode}
                    portionLabel="Portion 1: Dynamic Locomotion"
                  />
                )}
              </div>

              {/* Docked Telemetry Tray at Bottom of Viewport */}
              <TelemetryTray
                history={dynamicTelemetryHistory}
                currentFrame={dynamicFrame}
                portionLabel="Portion 1: Dynamic Locomotion"
              />
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* PORTION 2: MATHEMATICAL FOUNDATIONS LAB                   */}
        {/* ========================================================= */}
        {activeSection === 'sim_math' && (
          <div className="flex-1 flex w-full h-full overflow-hidden bg-slate-100">
            {/* Docked Control Sidebar (Left) */}
            <ControlSidebar
              config={mathConfig}
              customRobots={customRobots}
              onUpdateConfig={(partial) => {
                if (partial.robotId && partial.robotId !== mathConfig.robotId) {
                  simCoreMathRef.current.reset(partial.robotId);
                }
                handleUpdateMathConfig(partial);
              }}
              onStepOnce={handleStepOnceMath}
              onResetSim={handleResetSimMath}
              onResetPosition={handleResetPositionMath}
              viewportMode={mathViewportMode}
              onSetViewportMode={setMathViewportMode}
              simPortion="mathematical"
              onSwitchPortion={(portion) => {
                if (portion === 'dynamic') setActiveSection('sim_dynamic');
              }}
            />

            {/* Main Center Column: 3D Viewport + Docked Telemetry Tray */}
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
              <div className="flex-1 relative w-full h-full overflow-hidden">
                {mathViewportMode === 'dual' ? (
                  <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-300">
                    <div className="relative w-full h-full">
                      <Viewport3D
                        frame={mathFrame}
                        overlays={mathOverlays}
                        onToggleOverlay={handleToggleOverlayMath}
                        lighting={mathConfig.lighting}
                        terrain={mathConfig.terrain}
                        onApplyPush={handleApplyPushMath}
                        onResetPosition={handleResetPositionMath}
                        previewVariant="preview_a"
                        title="Analytical Trajectory"
                        portionLabel="Portion 2: Math"
                      />
                    </div>
                    <div className="relative w-full h-full">
                      <Viewport3D
                        frame={mathFrame}
                        overlays={mathOverlays}
                        onToggleOverlay={handleToggleOverlayMath}
                        lighting={mathConfig.lighting}
                        terrain={mathConfig.terrain}
                        onApplyPush={handleApplyPushMath}
                        onResetPosition={handleResetPositionMath}
                        previewVariant="preview_b"
                        title="Precision ZMP"
                        portionLabel="Portion 2: Math"
                      />
                    </div>
                  </div>
                ) : (
                  <Viewport3D
                    frame={mathFrame}
                    overlays={mathOverlays}
                    onToggleOverlay={handleToggleOverlayMath}
                    lighting={mathConfig.lighting}
                    terrain={mathConfig.terrain}
                    onApplyPush={handleApplyPushMath}
                    onResetPosition={handleResetPositionMath}
                    previewVariant={mathViewportMode}
                    portionLabel="Portion 2: Mathematical Foundations"
                  />
                )}
              </div>

              {/* Docked Telemetry Tray at Bottom of Viewport */}
              <TelemetryTray
                history={mathTelemetryHistory}
                currentFrame={mathFrame}
                portionLabel="Portion 2: Mathematical Foundations"
              />
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SIDE-BY-SIDE DUAL PORTION COMPARISON                      */}
        {/* ========================================================= */}
        {activeSection === 'sim_dual_compare' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            <div className="px-6 py-2 bg-white border-b border-slate-200 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-3">
                <span className="text-indigo-700 font-bold uppercase tracking-wider">
                  Side-by-Side Dual Simulation Mode
                </span>
                <span className="text-slate-600">
                  Running both simulations concurrently with zero state overrides.
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    handleUpdateDynamicConfig({ running: !dynamicConfig.running });
                    handleUpdateMathConfig({ running: !mathConfig.running });
                  }}
                  className="px-3 py-1 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 shadow-xs"
                >
                  Toggle Both Run / Pause
                </button>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 overflow-hidden">
              {/* Left Column: Portion 1 Dynamic Simulation */}
              <div className="flex flex-col h-full overflow-hidden">
                <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-amber-800 font-semibold">Portion 1: Dynamic Locomotion</span>
                    <span className="text-slate-500">({dynamicConfig.gait})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateDynamicConfig({ running: !dynamicConfig.running })}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                        dynamicConfig.running ? 'bg-amber-500 text-slate-950 font-semibold shadow-xs' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {dynamicConfig.running ? 'Pause' : 'Start'}
                    </button>
                    <button
                      type="button"
                      onClick={handleStepOnceDynamic}
                      className="px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200"
                    >
                      Step +1
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSection('sim_dynamic')}
                      className="px-2 py-0.5 rounded text-[11px] text-amber-700 font-semibold hover:underline"
                    >
                      Full Lab ↗
                    </button>
                  </div>
                </div>

                <div className="flex-1 relative bg-[#E2E8F0] min-h-[300px]">
                  <Viewport3D
                    frame={dynamicFrame}
                    overlays={dynamicOverlays}
                    onToggleOverlay={handleToggleOverlayDynamic}
                    lighting={dynamicConfig.lighting}
                    terrain={dynamicConfig.terrain}
                    onApplyPush={handleApplyPushDynamic}
                    onResetPosition={handleResetPositionDynamic}
                    previewVariant="preview_a"
                    title="Portion 1: Dynamic Locomotion (Trot / 0.55 m/s)"
                  />
                </div>

                <div className="p-2.5 bg-white border-t border-slate-200 text-[11px] font-mono grid grid-cols-4 gap-2 text-slate-700 font-medium">
                  <div>Vel: {dynamicConfig.forwardVel.toFixed(2)} m/s</div>
                  <div>DoF: 12</div>
                  <div>Step: #{dynamicFrame.stepCount}</div>
                  <div>Margin: {(dynamicFrame.stabilityMarginM * 100).toFixed(1)} cm</div>
                </div>
              </div>

              {/* Right Column: Portion 2 Mathematical Simulation */}
              <div className="flex flex-col h-full overflow-hidden">
                <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-600" />
                    <span className="text-sky-800 font-semibold">Portion 2: Mathematical Foundations</span>
                    <span className="text-slate-500">({mathConfig.gait})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateMathConfig({ running: !mathConfig.running })}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                        mathConfig.running ? 'bg-sky-600 text-white font-semibold shadow-xs' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {mathConfig.running ? 'Pause' : 'Start'}
                    </button>
                    <button
                      type="button"
                      onClick={handleStepOnceMath}
                      className="px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200"
                    >
                      Step +1
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSection('sim_math')}
                      className="px-2 py-0.5 rounded text-[11px] text-sky-700 font-semibold hover:underline"
                    >
                      Full Lab ↗
                    </button>
                  </div>
                </div>

                <div className="flex-1 relative bg-[#E2E8F0] min-h-[300px]">
                  <Viewport3D
                    frame={mathFrame}
                    overlays={mathOverlays}
                    onToggleOverlay={handleToggleOverlayMath}
                    lighting={mathConfig.lighting}
                    terrain={mathConfig.terrain}
                    onApplyPush={handleApplyPushMath}
                    onResetPosition={handleResetPositionMath}
                    previewVariant="preview_a"
                    title="Portion 2: Mathematical Foundations (Wave / β=0.88)"
                  />
                </div>

                <div className="p-2.5 bg-white border-t border-slate-200 text-[11px] font-mono grid grid-cols-4 gap-2 text-slate-700 font-medium">
                  <div>Vel: {mathConfig.forwardVel.toFixed(2)} m/s</div>
                  <div>β: {mathConfig.dutyFactorBeta.toFixed(2)}</div>
                  <div>Step: #{mathFrame.stepCount}</div>
                  <div>Margin: {(mathFrame.stabilityMarginM * 100).toFixed(1)} cm</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* RESEARCH MODULES & INSPECTORS (WITH PORTION SELECTOR)     */}
        {/* ========================================================= */}
        {activeSection === 'stability_dashboard' && (
          <div className="flex-1 flex flex-col overflow-y-auto">
            {/* Source Portion Switcher */}
            <div className="px-6 py-2 bg-white border-b border-slate-200 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-3">
                <span className="text-slate-600 font-medium">Inspecting Data Source:</span>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setInspectorSource('mathematical')}
                    className={`px-2.5 py-0.5 rounded ${
                      inspectorSource === 'mathematical'
                        ? 'bg-sky-600 text-white font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Portion 2: Mathematical (Active)
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectorSource('dynamic')}
                    className={`px-2.5 py-0.5 rounded ${
                      inspectorSource === 'dynamic'
                        ? 'bg-amber-500 text-slate-950 font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Portion 1: Dynamic
                  </button>
                </div>
              </div>
              <span className="text-slate-500">
                10-Margin Multi-Oscilloscope (SM-1 .. SM-10)
              </span>
            </div>

            <StabilityDashboard
              frame={currentInspectorFrame}
              config={currentInspectorConfig}
              onUpdateConfig={(partial) => {
                if (inspectorSource === 'dynamic') handleUpdateDynamicConfig(partial);
                else handleUpdateMathConfig(partial);
              }}
            />
          </div>
        )}

        {activeSection === 'sensor_telemetry' && (
          <div className="flex-1 overflow-y-auto">
            <SensorTelemetryHub
              portion1Frame={dynamicFrame}
              portion1Config={dynamicConfig}
              portion2Frame={mathFrame}
              portion2Config={mathConfig}
              portion1History={dynamicTelemetryHistory}
              portion2History={mathTelemetryHistory}
            />
          </div>
        )}

        {activeSection === 'validation_bench' && (
          <div className="flex-1 flex flex-col overflow-y-auto">
            <div className="px-6 py-2 bg-white border-b border-slate-200 flex items-center justify-between text-xs font-mono">
              <span className="text-emerald-700 font-bold">
                Section G.12 Analytical Numerical Verification Suite
              </span>
              <span className="text-slate-500">
                13 Benchmark Test Cases vs Closed-Form Equations
              </span>
            </div>
            <ValidationSuite frame={mathFrame} />
          </div>
        )}

        {activeSection === 'algorithm_inspector' && (
          <div className="flex-1 flex flex-col overflow-y-auto">
            {/* Inspector Source Selector */}
            <div className="px-6 py-2 bg-white border-b border-slate-200 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-3">
                <span className="text-slate-600 font-medium">Inspect Matrix Kernel Source:</span>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setInspectorSource('mathematical')}
                    className={`px-2.5 py-0.5 rounded ${
                      inspectorSource === 'mathematical'
                        ? 'bg-sky-600 text-white font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Portion 2: Mathematical
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectorSource('dynamic')}
                    className={`px-2.5 py-0.5 rounded ${
                      inspectorSource === 'dynamic'
                        ? 'bg-amber-500 text-slate-950 font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Portion 1: Dynamic
                  </button>
                </div>
              </div>
              <span className="text-slate-500">
                CRBA Inertia M(q), Christoffel C(q,q̇), DLS IK, ZMP Plane
              </span>
            </div>

            <AlgorithmInspector
              frame={currentInspectorFrame}
              frictionMu={currentInspectorConfig.frictionMu}
              dampingLambda={currentInspectorConfig.dampingLambda}
            />
          </div>
        )}

        {activeSection === 'frontier_modules' && (
          <div className="flex-1 overflow-y-auto">
            <FrontierModules
              frame={currentInspectorFrame}
              config={currentInspectorConfig}
              onUpdateConfig={(partial) => {
                if (inspectorSource === 'dynamic') handleUpdateDynamicConfig(partial);
                else handleUpdateMathConfig(partial);
              }}
              onExportOnnx={() => setActiveSection('dataset_export')}
            />
          </div>
        )}

        {activeSection === 'urdf_world' && (
          <div className="flex-1 overflow-y-auto">
            <UrdfWorldStudio
              config={urdfPortion === 'dynamic' ? dynamicConfig : mathConfig}
              customRobots={customRobots}
              simPortion={urdfPortion}
              onSwitchPortion={setUrdfPortion}
              onSelectRobot={(robotId) => {
                if (urdfPortion === 'dynamic') {
                  simCoreDynamicRef.current.reset(robotId);
                  handleUpdateDynamicConfig({ robotId });
                } else {
                  simCoreMathRef.current.reset(robotId);
                  handleUpdateMathConfig({ robotId });
                }
              }}
              onRegisterCustomRobot={(robot) =>
                setCustomRobots((prev) => ({ ...prev, [robot.id]: robot }))
              }
              onUpdateConfig={(partial) => {
                if (urdfPortion === 'dynamic') {
                  handleUpdateDynamicConfig(partial);
                } else {
                  handleUpdateMathConfig(partial);
                }
              }}
            />
          </div>
        )}

        {activeSection === 'dataset_export' && (
          <div className="flex-1 overflow-y-auto">
            <DatasetSimToReal
              frame={currentInspectorFrame}
              recordedFrames={recordedFrames}
              isRecording={isRecording}
              onToggleRecording={() => setIsRecording((v) => !v)}
              onClearRecording={() => {
                setIsRecording(false);
                setRecordedFrames([]);
              }}
              config={currentInspectorConfig}
              onUpdateConfig={(partial) => {
                if (inspectorSource === 'dynamic') handleUpdateDynamicConfig(partial);
                else handleUpdateMathConfig(partial);
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
