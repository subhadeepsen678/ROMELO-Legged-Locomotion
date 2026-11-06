import React, { useState } from 'react';
import { Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { SimulationStateFrame } from '../physics/roboticsEngine';

interface TelemetryTrayProps {
  history: SimulationStateFrame[];
  currentFrame: SimulationStateFrame;
  portionLabel?: string;
}

export const TelemetryTray: React.FC<TelemetryTrayProps> = ({
  history,
  currentFrame,
  portionLabel,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const samples = history.slice(-70);
  const w = 320;
  const h = 76;

  const mapPoints = (
    extractor: (f: SimulationStateFrame) => number,
    minVal: number,
    maxVal: number
  ): string => {
    if (samples.length < 2) return '';
    return samples
      .map((s, idx) => {
        const x = (idx / (samples.length - 1)) * (w - 12) + 6;
        const val = extractor(s);
        const norm = Math.max(0, Math.min(1, (val - minVal) / (maxVal - minVal || 1)));
        const y = h - 6 - norm * (h - 14);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  // Minimized state: docked technical status bar at bottom of viewport
  if (!isExpanded) {
    return (
      <div className="w-full bg-white border-t border-slate-200 px-4 py-2 flex items-center justify-between text-xs font-mono shrink-0 shadow-xs z-10">
        <div className="flex items-center gap-3 overflow-x-auto min-w-0">
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-1.5 font-semibold text-sky-700 hover:text-sky-900 transition-colors whitespace-nowrap cursor-pointer shrink-0"
            title="Expand real-time telemetry waveforms"
          >
            <ChevronUp className="w-3.5 h-3.5 text-sky-600" />
            <Activity className="w-3.5 h-3.5 text-sky-600" />
            <span>Telemetry &amp; Waveforms</span>
          </button>
          {portionLabel && (
            <span className="text-slate-500 text-[11px] font-sans font-medium whitespace-nowrap shrink-0">
              ({portionLabel})
            </span>
          )}
          <span className="text-slate-300">·</span>
          <span className="text-slate-600 whitespace-nowrap">
            Travel: <strong className="text-emerald-700 font-bold tabular-nums">{currentFrame.odometerM.toFixed(2)}m</strong>
          </span>
          <span className="text-slate-300 hidden sm:inline">·</span>
          <span className="text-slate-600 whitespace-nowrap hidden sm:inline">
            Speed: <strong className="text-sky-700 font-bold tabular-nums">{currentFrame.speedMps.toFixed(2)}m/s</strong>
          </span>
          <span className="text-slate-300 hidden md:inline">·</span>
          <span className="text-slate-600 whitespace-nowrap hidden md:inline">
            ZMP Err: <strong className="text-amber-700 font-bold tabular-nums">{currentFrame.zmpTrackingErrorCm.toFixed(2)}cm</strong>
          </span>
          <span className="text-slate-300 hidden lg:inline">·</span>
          <span className="text-slate-600 whitespace-nowrap hidden lg:inline">
            NSI: <strong className={currentFrame.nsi >= 0.3 ? 'text-emerald-700 font-bold tabular-nums' : 'text-rose-700 font-bold tabular-nums'}>
              {currentFrame.nsi.toFixed(3)} ({currentFrame.nsi >= 0.3 ? 'Nominal' : 'Alert'})
            </strong>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-medium transition-colors shadow-2xs whitespace-nowrap shrink-0"
        >
          <span>Open Waveforms</span>
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Expanded state: docked drawer below 3D viewport
  return (
    <div className="w-full bg-white border-t border-slate-200 flex flex-col shrink-0 shadow-md text-slate-800 transition-all z-10 max-h-[36vh]">
      {/* Drawer Header & Minimize Button */}
      <div className="px-4 py-2 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between shrink-0 text-xs font-mono">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sky-700 font-semibold">
            <Activity className="w-4 h-4" />
            <span>Real-Time Telemetry &amp; Dynamics</span>
          </div>
          {portionLabel && (
            <span className="text-slate-500 text-[11px] font-sans font-medium">
              ({portionLabel})
            </span>
          )}
          <span className="text-slate-300 hidden sm:inline">|</span>
          <div className="hidden sm:flex items-center gap-3 text-slate-600 tabular-nums text-[11px]">
            <span>Speed: <strong className="text-sky-700">{currentFrame.speedMps.toFixed(2)} m/s</strong></span>
            <span>·</span>
            <span>Travel: <strong className="text-emerald-700">{currentFrame.odometerM.toFixed(2)} m</strong></span>
            <span>·</span>
            <span>ZMP Err: <strong className="text-amber-700">{currentFrame.zmpTrackingErrorCm.toFixed(2)} cm</strong></span>
            <span>·</span>
            <span>
              NSI:{' '}
              <strong className={currentFrame.nsi >= 0.3 ? 'text-emerald-700' : 'text-rose-700'}>
                {currentFrame.nsi.toFixed(3)}
              </strong>
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-slate-300 text-xs transition-colors shadow-2xs"
          title="Minimize telemetry drawer to clear 3D view"
        >
          <ChevronDown className="w-3.5 h-3.5" />
          <span>Minimize</span>
        </button>
      </div>

      {/* 4 Metric Clean Cards */}
      <div className="flex-1 p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 overflow-y-auto">
        {/* Metric 1: World Displacement & Odometer */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-mono mb-1">
            <span className="text-slate-800 font-semibold">Real World Displacement</span>
            <span className="text-sky-700 font-bold tabular-nums">
              {currentFrame.speedMps.toFixed(2)} m/s
            </span>
          </div>
          <div className="space-y-1 my-1 text-xs font-mono tabular-nums">
            <div className="flex justify-between">
              <span className="text-slate-500">Total Traveled:</span>
              <span className="text-emerald-700 font-bold">{currentFrame.odometerM.toFixed(2)} m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Displacement Origin:</span>
              <span className="text-sky-700 font-bold">{currentFrame.displacementM.toFixed(2)} m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">World Pos [X, Y]:</span>
              <span className="text-slate-800 font-medium">
                [{currentFrame.basePose.position[0].toFixed(2)}, {currentFrame.basePose.position[1].toFixed(2)}] m
              </span>
            </div>
          </div>
          <div className="text-[10px] font-mono text-slate-500">
            Physical progression across arena
          </div>
        </div>

        {/* Metric 2: ZMP Trajectory Tracking */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-mono mb-1">
            <span className="text-slate-800 font-semibold">ZMP Tracking (Ref vs. Meas)</span>
            <span className="text-sky-700 font-bold tabular-nums">
              Err: {currentFrame.zmpTrackingErrorCm.toFixed(2)} cm
            </span>
          </div>
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-14 bg-white rounded border border-slate-200 shadow-2xs">
            <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="#E2E8F0" strokeWidth="1" />
            <polyline
              fill="none"
              stroke="#0284C7"
              strokeWidth="1.8"
              points={mapPoints((f) => f.zmpRef[1] - f.basePose.position[1], -0.06, 0.06)}
            />
            <polyline
              fill="none"
              stroke="#DC2626"
              strokeWidth="1.8"
              strokeDasharray="3 2"
              points={mapPoints((f) => f.zmpActual[1] - f.basePose.position[1], -0.06, 0.06)}
            />
          </svg>
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-600 mt-1 tabular-nums">
            <span className="text-sky-700 font-medium">— Blue: Kajita Ref</span>
            <span className="text-red-600 font-medium">-- Red: ZMP_y</span>
          </div>
        </div>

        {/* Metric 3: Normalized Stability Index (NSI) */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-mono mb-1">
            <span className="text-slate-800 font-semibold">Stability Index (NSI)</span>
            <span
              className={`tabular-nums font-bold ${
                currentFrame.nsi >= 0.3 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {currentFrame.nsi >= 0.3 ? '● Nominal' : '▲ Alert'} {currentFrame.nsi.toFixed(3)}
            </span>
          </div>
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-14 bg-white rounded border border-slate-200 shadow-2xs">
            <line
              x1="0"
              y1={h - 6 - 0.3 * (h - 14)}
              x2={w}
              y2={h - 6 - 0.3 * (h - 14)}
              stroke="#F59E0B"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
            <polyline
              fill="none"
              stroke="#059669"
              strokeWidth="1.8"
              points={mapPoints((f) => f.nsi, 0, 1.0)}
            />
          </svg>
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-600 mt-1 tabular-nums">
            <span className="text-emerald-700 font-medium">— Green: Active NSI</span>
            <span className="text-amber-700 font-medium">-- Safety &gt; 0.30</span>
          </div>
        </div>

        {/* Metric 4: 4-Channel Ground Reaction Normal Forces Fn */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-mono mb-1">
            <span className="text-slate-800 font-semibold">Forces Fn (FL,FR,RL,RR)</span>
            <span className="text-slate-600 tabular-nums font-medium">
              CoT: {currentFrame.cot.toFixed(2)}
            </span>
          </div>
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-14 bg-white rounded border border-slate-200 shadow-2xs">
            <polyline
              fill="none"
              stroke="#0284C7"
              strokeWidth="1.6"
              points={mapPoints((f) => f.legs.FL?.contactForce.fn ?? 0, 0, 140)}
            />
            <polyline
              fill="none"
              stroke="#D97706"
              strokeWidth="1.6"
              points={mapPoints((f) => f.legs.FR?.contactForce.fn ?? 0, 0, 140)}
            />
            <polyline
              fill="none"
              stroke="#059669"
              strokeWidth="1.6"
              points={mapPoints((f) => f.legs.RL?.contactForce.fn ?? 0, 0, 140)}
            />
            <polyline
              fill="none"
              stroke="#7C3AED"
              strokeWidth="1.6"
              points={mapPoints((f) => f.legs.RR?.contactForce.fn ?? 0, 0, 140)}
            />
          </svg>
          <div className="flex items-center justify-between text-[10px] font-mono mt-1 tabular-nums font-medium">
            <span className="text-sky-700">FL:{(currentFrame.legs.FL?.contactForce.fn ?? 0).toFixed(0)}N</span>
            <span className="text-amber-700">FR:{(currentFrame.legs.FR?.contactForce.fn ?? 0).toFixed(0)}N</span>
            <span className="text-emerald-700">RL:{(currentFrame.legs.RL?.contactForce.fn ?? 0).toFixed(0)}N</span>
            <span className="text-purple-700">RR:{(currentFrame.legs.RR?.contactForce.fn ?? 0).toFixed(0)}N</span>
          </div>
        </div>
      </div>
    </div>
  );
};
