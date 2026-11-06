import React, { useEffect, useState } from 'react';
import {
  GaitType,
  PhysicsBackend,
  SimControlConfig,
  SimulationStateFrame,
} from '../physics/roboticsEngine';

interface FrontierModulesProps {
  frame: SimulationStateFrame;
  config: SimControlConfig;
  onUpdateConfig: (partial: Partial<SimControlConfig>) => void;
  onExportOnnx: () => void;
}

export const FrontierModules: React.FC<FrontierModulesProps> = ({
  frame,
  config,
  onUpdateConfig,
  onExportOnnx,
}) => {
  const [rlTraining, setRlTraining] = useState(false);
  const [rlEpoch, setRlEpoch] = useState(14);
  const [rlHistory, setRlHistory] = useState<
    { epoch: number; totalReward: number; velReward: number; cotPenalty: number; lnnLoss: number }[]
  >(() =>
    Array.from({ length: 14 }, (_, i) => {
      const ep = i + 1;
      const v = 0.45 + 0.48 * (1 - Math.exp(-ep / 5.5));
      const c = 0.25 * Math.exp(-ep / 8) + 0.08;
      return {
        epoch: ep,
        totalReward: Number((v + 0.85 - c).toFixed(3)),
        velReward: Number(v.toFixed(3)),
        cotPenalty: Number(c.toFixed(3)),
        lnnLoss: Number((0.045 * Math.exp(-ep / 4.2) + 0.0018).toFixed(4)),
      };
    })
  );
  const [ciMpcTier, setCiMpcTier] = useState<'cloud_idto' | 'webgpu_qp' | 'wasm_preview'>(
    'webgpu_qp'
  );
  const [deployedPolicyBanner, setDeployedPolicyBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!rlTraining) return;
    const timer = setInterval(() => {
      setRlEpoch((prev) => {
        const nextEp = prev + 1;
        const v = Math.min(0.98, 0.45 + 0.52 * (1 - Math.exp(-nextEp / 6.0)));
        const c = Math.max(0.06, 0.26 * Math.exp(-nextEp / 9.0) + 0.06);
        const stability = Math.min(0.95, 0.72 + 0.22 * (1 - Math.exp(-nextEp / 5.0)));
        const total = v + stability - c;
        const lnn = Math.max(0.0011, 0.045 * Math.exp(-nextEp / 4.5));
        setRlHistory((h) => [
          ...h.slice(-29),
          {
            epoch: nextEp,
            totalReward: Number(total.toFixed(3)),
            velReward: Number(v.toFixed(3)),
            cotPenalty: Number(c.toFixed(3)),
            lnnLoss: Number(lnn.toFixed(4)),
          },
        ]);
        return nextEp;
      });
    }, 450);
    return () => clearInterval(timer);
  }, [rlTraining]);

  const latestMetrics = rlHistory[rlHistory.length - 1] || {
    epoch: 1,
    totalReward: 1.42,
    velReward: 0.82,
    cotPenalty: 0.12,
    lnnLoss: 0.0024,
  };

  const toggleSymmetry = (key: keyof SimControlConfig['symmetryEnabled']) => {
    onUpdateConfig({
      symmetryEnabled: {
        ...config.symmetryEnabled,
        [key]: !config.symmetryEnabled[key],
      },
    });
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 text-slate-900">
      <div className="flex flex-wrap items-baseline justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-display font-semibold tracking-tight text-slate-900">
            02. Frontier Locomotion Research Modules
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            WebGPU 1024-environment parallel simulation, Differentiable Physics-Informed Learning (DPIL),
            Symmetry-Guided Gait Transitions, and Contact-Implicit MPC.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
          <span>Active Kernel: {config.backend.toUpperCase()}</span>
          <span aria-hidden="true">·</span>
          <span>CoT: {frame.cot.toFixed(3)}</span>
          <span aria-hidden="true">·</span>
          <span>Symmetry Loss: {frame.symmetryLoss.toFixed(4)}</span>
        </div>
      </div>

      {deployedPolicyBanner && (
        <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-between text-xs font-mono text-emerald-300">
          <span>● {deployedPolicyBanner}</span>
          <button
            type="button"
            onClick={() => setDeployedPolicyBanner(null)}
            className="text-slate-400 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div>
                <h2 className="text-base font-semibold text-slate-100">
                  Differentiable Physics-Informed Learning (DPIL) — In-Browser Gait RL
                </h2>
                <p className="text-xs text-slate-400">
                  Lagrangian Neural Network (<code className="text-cyan-300">lnn.forward(q,qd)→qdd</code>) +
                  Residual Koopman (<code className="text-cyan-300">rkm.kernel(obs)→z</code>) + Interior-Point LCP Gradients
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onUpdateConfig({ backend: 'nexus_webgpu' });
                    setRlTraining((v) => !v);
                  }}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    rlTraining
                      ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                      : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                  }`}
                >
                  {rlTraining ? 'Pause 1024-Env RL Training' : 'Start 1024-Env RL Training'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateConfig({
                      gait: 'ci_mpc',
                      forwardVel: 0.85,
                      symmetryEnabled: {
                        morphological: true,
                        timeReversal: true,
                        leftRight: true,
                      },
                    });
                    setDeployedPolicyBanner(
                      `DPIL Policy Epoch #${rlEpoch} (Return ${latestMetrics.totalReward.toFixed(
                        2
                      )}) deployed to ${frame.robotId} via ONNX Runtime Web.`
                    );
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
                >
                  Deploy Policy to Robot
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-3">
              <div className="bg-[#07090E] border border-slate-800 rounded p-2.5">
                <div className="text-[11px] font-mono text-slate-400">EPISODIC RETURN</div>
                <div className="text-xl font-mono font-bold text-emerald-400 tabular-nums mt-0.5">
                  +{latestMetrics.totalReward.toFixed(3)}
                </div>
                <div className="text-[10px] font-mono text-slate-500">
                  Epoch #{rlEpoch} · 1024 Envs
                </div>
              </div>
              <div className="bg-[#07090E] border border-slate-800 rounded p-2.5">
                <div className="text-[11px] font-mono text-slate-400">LNN ENERGY RESIDUAL</div>
                <div className="text-xl font-mono font-bold text-cyan-300 tabular-nums mt-0.5">
                  {latestMetrics.lnnLoss.toFixed(4)}
                  <span className="text-xs text-slate-500 ml-1">J</span>
                </div>
                <div className="text-[10px] font-mono text-slate-500">
                  L = T(q,q̇) − V(q)
                </div>
              </div>
              <div className="bg-[#07090E] border border-slate-800 rounded p-2.5">
                <div className="text-[11px] font-mono text-slate-400">KOOPMAN SPECTRAL ρ</div>
                <div className="text-xl font-mono font-bold text-slate-100 tabular-nums mt-0.5">
                  {frame.dpilMetrics.koopmanEigenDecay.toFixed(4)}
                </div>
                <div className="text-[10px] font-mono text-slate-500">
                  Lifted z ∈ ℝ³²
                </div>
              </div>
              <div className="bg-[#07090E] border border-slate-800 rounded p-2.5">
                <div className="text-[11px] font-mono text-slate-400">LCP GRADIENT ‖∇J‖</div>
                <div className="text-xl font-mono font-bold text-amber-300 tabular-nums mt-0.5">
                  {frame.dpilMetrics.lcpGradientNorm.toFixed(3)}
                </div>
                <div className="text-[10px] font-mono text-slate-500">
                  Interior-point κ=1e-3
                </div>
              </div>
            </div>

            <div className="bg-[#07090E] border border-slate-800 rounded p-3">
              <div className="flex justify-between text-xs font-mono text-slate-400 mb-1.5">
                <span>DPIL Policy Learning Curve (Total Return vs. Velocity Tracking)</span>
                <span className="text-cyan-400">
                  R = {latestMetrics.velReward.toFixed(2)} (vel) + 0.88 (NSI) −{' '}
                  {latestMetrics.cotPenalty.toFixed(2)} (energy)
                </span>
              </div>
              <svg viewBox="0 0 520 130" className="w-full h-32">
                <line x1="0" y1="25" x2="520" y2="25" stroke="#1E293B" strokeWidth="1" />
                <line x1="0" y1="65" x2="520" y2="65" stroke="#1E293B" strokeWidth="1" />
                <line x1="0" y1="105" x2="520" y2="105" stroke="#1E293B" strokeWidth="1" />

                {rlHistory.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="2"
                    points={rlHistory
                      .map((pt, i) => {
                        const x = (i / Math.max(1, rlHistory.length - 1)) * 500 + 10;
                        const y = 115 - (pt.totalReward / 2.0) * 95;
                        return `${x},${y}`;
                      })
                      .join(' ')}
                  />
                )}

                {rlHistory.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#06B6D4"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    points={rlHistory
                      .map((pt, i) => {
                        const x = (i / Math.max(1, rlHistory.length - 1)) * 500 + 10;
                        const y = 115 - (pt.velReward / 1.2) * 85;
                        return `${x},${y}`;
                      })
                      .join(' ')}
                  />
                )}
              </svg>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs font-mono text-slate-400">
            <span>Batch Throughput: 61,440 steps/s (1024 envs × 60 Hz)</span>
            <button
              type="button"
              onClick={onExportOnnx}
              className="text-cyan-400 hover:underline"
            >
              Export Trained Policy (.onnx) →
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#111827] border border-slate-800 rounded p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-semibold text-slate-100">
                Nexus WebGPU 1024-Env Parallel Kernel
              </h2>
              <span className="text-xs font-mono text-cyan-400">AVBD / TGS Compute</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Client execution hierarchy: Switch compute backend or inspect the 32×32
              GPU-parallel environment array.
            </p>

            <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#07090E] border border-slate-800 rounded mb-4">
              {(
                [
                  { id: 'nexus_webgpu', label: 'Nexus WebGPU (1024)' },
                  { id: 'mujoco_wasm', label: 'MuJoCo WASM (1 Env)' },
                  { id: 'pybullet_cloud', label: 'PyBullet Cloud' },
                ] as { id: PhysicsBackend; label: string }[]
              ).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onUpdateConfig({ backend: b.id })}
                  className={`px-2 py-1.5 text-xs font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                    config.backend === b.id
                      ? 'bg-cyan-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>

            <div className="bg-[#07090E] border border-slate-800 rounded p-2.5">
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1.5">
                <span>GPU Workgroup Shard [0..255 / 1024 Envs]</span>
                <span>Step Latency: 0.84 ms</span>
              </div>
              <div className="grid grid-cols-16 gap-[2px]">
                {Array.from({ length: 128 }, (_, idx) => {
                  const phaseVal = (Math.sin(frame.simTime * 3 + idx * 0.37) + 1) * 0.5;
                  const isResetting = idx % 29 === Math.floor(frame.simTime * 4) % 29;
                  return (
                    <div
                      key={idx}
                      className="h-2.5 rounded-[1px]"
                      style={{
                        backgroundColor: isResetting
                          ? '#F59E0B'
                          : `rgba(6, 182, 212, ${0.25 + phaseVal * 0.7})`,
                      }}
                      title={`Env #${idx * 8}: Reward ${(1.2 + phaseVal * 0.6).toFixed(2)}`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-2 border-t border-slate-800 grid grid-cols-3 gap-2 text-xs font-mono tabular-nums">
            <div>
              <span className="text-slate-400 block">VRAM Heap</span>
              <span className="text-slate-200 font-semibold">312 MB / 500 MB</span>
            </div>
            <div>
              <span className="text-slate-400 block">Solver Mode</span>
              <span className="text-cyan-300 font-semibold">{config.solver} (50 iter)</span>
            </div>
            <div>
              <span className="text-slate-400 block">Active Envs</span>
              <span className="text-emerald-400 font-semibold">
                {config.backend === 'nexus_webgpu' ? '1,024 Parallel' : '1 Deterministic'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#111827] border border-slate-800 rounded p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-semibold text-slate-100">
                Symmetry-Guided Gait Transition Engine (Section 5.4.3)
              </h2>
              <span className="text-xs font-mono text-emerald-400">
                CoT = {frame.cot.toFixed(3)}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Enforces Morphological (π_leg), Time-Reversal (𝒯), and Left-Right (π_LR) equivariance.
              Disabling symmetry increases Cost of Transport by 20–50%.
            </p>

            <div className="space-y-2.5 mb-4">
              {(
                [
                  {
                    key: 'morphological',
                    title: 'Morphological Symmetry π_leg(q, q̇)',
                    formula: 'Permutes homologous leg indices across diagonal/lateral pairs',
                    impact: '+28% CoT penalty if disabled',
                  },
                  {
                    key: 'timeReversal',
                    title: 'Time-Reversal Symmetry 𝒯(q, q̇) = (q, −q̇)',
                    formula: 'Loss: ‖f(s) − 𝒯⁻¹f(𝒯s)‖² = ' + frame.symmetryLoss.toFixed(4),
                    impact: '+14% CoT penalty if disabled',
                  },
                  {
                    key: 'leftRight',
                    title: 'Left-Right Bilateral Symmetry π_LR',
                    formula: 'Mirrors sagittal & coronal hip abduction/adduction phases',
                    impact: '+12% CoT penalty if disabled',
                  },
                ] as {
                  key: keyof SimControlConfig['symmetryEnabled'];
                  title: string;
                  formula: string;
                  impact: string;
                }[]
              ).map((sym) => {
                const active = config.symmetryEnabled[sym.key];
                return (
                  <div
                    key={sym.key}
                    className="flex items-center justify-between p-3 rounded bg-[#07090E] border border-slate-800"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-200">{sym.title}</div>
                      <div className="text-[11px] font-mono text-slate-400">{sym.formula}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSymmetry(sym.key)}
                      className={`px-3 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {active ? '● Enforced' : '○ Disabled (' + sym.impact + ')'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800">
            <div className="text-xs font-mono text-slate-400 mb-2">
              Trigger 4-Leg Support Spline Transition (NSI &gt; 0.30 Enforced):
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { label: 'Walk → Trot', gait: 'trot', vel: 0.55 },
                  { label: 'Trot → Bound', gait: 'bound', vel: 0.85 },
                  { label: 'Bound → Gallop', gait: 'gallop', vel: 1.25 },
                  { label: 'Gallop → Trot (Symmetry Bridge)', gait: 'trot', vel: 0.6 },
                ] as { label: string; gait: GaitType; vel: number }[]
              ).map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() =>
                    onUpdateConfig({ gait: btn.gait, forwardVel: btn.vel })
                  }
                  className="px-3 py-1.5 text-xs font-mono rounded bg-slate-900 text-cyan-300 border border-slate-700 hover:border-cyan-500/50 transition-colors whitespace-nowrap shrink-0"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-semibold text-slate-100">
                Contact-Implicit MPC (CI-MPC) — Online Contact Discovery
              </h2>
              <span className="text-xs font-mono text-cyan-400">
                cimpc.solve(state, H)→(τ, Fc)
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Discovers optimal foot contact sequences online over horizon H without a predefined
              gait clock via Inverse-Dynamics Trajectory Optimization (idto).
            </p>

            <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#07090E] border border-slate-800 rounded mb-4">
              {[
                { id: 'cloud_idto', label: 'Cloud idto+CasADi (H=50)' },
                { id: 'webgpu_qp', label: 'WebGPU WGSL QP (H=16)' },
                { id: 'wasm_preview', label: 'WASM Preview+IK' },
              ].map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setCiMpcTier(tier.id as typeof ciMpcTier)}
                  className={`px-2 py-1.5 text-xs font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                    ciMpcTier === tier.id
                      ? 'bg-cyan-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tier.label}
                </button>
              ))}
            </div>

            <div className="bg-[#07090E] border border-slate-800 rounded p-3 space-y-2.5">
              <div className="flex justify-between text-xs font-mono text-slate-400">
                <span>Discovered Contact Schedule (H = 16 steps · Δt = 25 ms)</span>
                <span>■ Stance (Fn &gt; 0) · □ Swing (gap &gt; 0)</span>
              </div>
              {Object.entries(frame.ciMpcSchedule || {}).map(([legId, seq]) => (
                <div key={legId} className="flex items-center gap-3">
                  <span className="w-8 text-xs font-mono font-semibold text-slate-200">
                    {legId}
                  </span>
                  <div className="flex-1 grid grid-cols-16 gap-1">
                    {(seq || []).map((contactFlag, hIdx) => (
                      <div
                        key={hIdx}
                        className={`h-5 rounded-[2px] border ${
                          contactFlag === 1
                            ? 'bg-emerald-500/80 border-emerald-400'
                            : 'bg-slate-900 border-slate-800'
                        }`}
                        title={`Step k+${hIdx}: ${
                          contactFlag === 1 ? 'Stance Contact' : 'Swing Flight'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs font-mono text-slate-400">
            <span>
              Solver Latency:{' '}
              {ciMpcTier === 'cloud_idto'
                ? '34.2 ms (H=50)'
                : ciMpcTier === 'webgpu_qp'
                ? '11.8 ms (H=16)'
                : '4.1 ms (Preview)'}
            </span>
            <button
              type="button"
              onClick={() => onUpdateConfig({ gait: 'ci_mpc' })}
              className="px-3 py-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 transition-colors"
            >
              Activate CI-MPC Controller
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
