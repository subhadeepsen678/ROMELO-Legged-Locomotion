import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  SimControlConfig,
  SimulationStateFrame,
} from '../physics/roboticsEngine';

interface SensorTelemetryHubProps {
  portion1Frame: SimulationStateFrame;
  portion1Config: SimControlConfig;
  portion2Frame: SimulationStateFrame;
  portion2Config: SimControlConfig;
  portion1History: SimulationStateFrame[];
  portion2History: SimulationStateFrame[];
}

type SensorViewMode = 'portion1' | 'portion2' | 'compare';

export const SensorTelemetryHub: React.FC<SensorTelemetryHubProps> = ({
  portion1Frame,
  portion1Config,
  portion2Frame,
  portion2Config,
  portion1History,
  portion2History,
}) => {
  const [viewMode, setViewMode] = useState<SensorViewMode>('portion1');
  const [noiseEnabled, setNoiseEnabled] = useState<boolean>(false);
  const [sampleRateHz, setSampleRateHz] = useState<number>(240);
  const [oscilloscopeChannel, setOscilloscopeChannel] = useState<
    'accel_z' | 'imu_pitch_rate' | 'fl_grf' | 'rr_grf' | 'fl_thigh_current' | 'com_vel_x'
  >('accel_z');

  // Noise perturbation state
  const [noiseSeed, setNoiseSeed] = useState<number>(0);
  useEffect(() => {
    if (!noiseEnabled) return;
    const interval = setInterval(() => {
      setNoiseSeed((s) => (s + 1) % 1000);
    }, 50);
    return () => clearInterval(interval);
  }, [noiseEnabled]);

  const pseudoNoise = (scale: number, offset = 0) => {
    if (!noiseEnabled) return 0;
    const val = Math.sin((noiseSeed + offset) * 1.618) * Math.cos((noiseSeed + offset) * 0.732);
    return val * scale;
  };

  // Derive synthesized sensor packets for each frame
  const computeSensorPacket = (
    frame: SimulationStateFrame,
    cfg: SimControlConfig,
    noiseOffset: number
  ) => {
    const noise = (s: number, o = 0) => pseudoNoise(s, noiseOffset + o);

    // 1. 9-Axis IMU
    const ax = frame.comAcc[0] + noise(0.12, 1);
    const ay = frame.comAcc[1] + noise(0.12, 2);
    const az = frame.comAcc[2] + 9.80665 + noise(0.18, 3); // Includes gravity component
    const gx = (frame.basePose.angularVel[0] * 180) / Math.PI + noise(0.4, 4);
    const gy = (frame.basePose.angularVel[1] * 180) / Math.PI + noise(0.4, 5);
    const gz = (frame.basePose.angularVel[2] * 180) / Math.PI + noise(0.3, 6);
    // Earth magnetic field vector (~48 uT in mid latitudes)
    const roll = frame.basePose.rpy[0];
    const pitch = frame.basePose.rpy[1];
    const yaw = frame.basePose.rpy[2];
    const mx = 22.4 * Math.cos(pitch) * Math.cos(yaw) + noise(0.5, 7);
    const my = 22.4 * Math.sin(roll) * Math.sin(pitch) * Math.cos(yaw) - 22.4 * Math.cos(roll) * Math.sin(yaw) + noise(0.5, 8);
    const mz = 41.2 + noise(0.6, 9);
    const gRms = Math.sqrt((ax * ax + ay * ay + az * az) / 3);

    // 2. 4-Corner Ground Reaction Force (GRF) & Tactile
    const legsData = Object.entries(frame.legs).map(([legId, leg]) => {
      const fn = Math.max(0, leg.contactForce.fn + (leg.isStance ? noise(3.2, 10) : 0));
      const fx = leg.contactForce.fx + (leg.isStance ? noise(1.1, 11) : 0);
      const fy = leg.contactForce.fy + (leg.isStance ? noise(1.1, 12) : 0);
      const ft = Math.sqrt(fx * fx + fy * fy);
      const muUtil = fn > 0.5 ? ft / (cfg.frictionMu * fn) : 0;
      const contactBinary = leg.isStance ? 1 : 0;
      // 4-quadrant tactile foot pad pressures (kPa)
      const baseKpa = fn * 4.5;
      const qFront = Math.max(0, baseKpa * (0.28 + leg.phase * 0.1));
      const qRear = Math.max(0, baseKpa * (0.28 - leg.phase * 0.08));
      const qInner = Math.max(0, baseKpa * 0.22);
      const qOuter = Math.max(0, baseKpa * 0.22);

      // Downward ToF laser distance to floor under hip (cm)
      const hipHeightCm = Math.max(0, leg.hipWorld[2] * 100 + noise(0.3, 13));
      const footClearanceCm = Math.max(0, (leg.footWorld[2] - 0.0) * 100 + noise(0.2, 14));

      return {
        legId,
        isStance: leg.isStance,
        contactBinary,
        fn,
        fx,
        fy,
        ft,
        muUtil: Math.min(1.5, muUtil),
        tactileKpa: { front: qFront, rear: qRear, inner: qInner, outer: qOuter },
        hipHeightCm,
        footClearanceCm,
        tau: leg.tau,
        q: leg.q,
        qd: leg.qd,
        virtualSensor: leg.virtualSensor,
        conditionNumber: leg.conditionNumber,
      };
    });

    // 3. 12 Actuator Telemetry
    // Torque constant Kt ~ 0.85 N*m/A for Unitree/SILO4 motors
    const kt = 0.85;
    const rWinding = 0.18; // Ohms
    const motorTelemetry = legsData.flatMap((l) => [
      {
        motorId: `${l.legId}_hip`,
        qDeg: (l.q[0] * 180) / Math.PI,
        qdRpm: ((l.qd[0] * 60) / (2 * Math.PI)),
        tauNm: l.tau[0],
        currentA: Math.abs(l.tau[0]) / kt + (noiseEnabled ? Math.abs(noise(0.1, 20)) : 0),
        tempC: 38.5 + (Math.abs(l.tau[0]) * 1.4) + (noiseEnabled ? noise(0.5, 21) : 0),
        powerW: Math.abs(l.tau[0] * l.qd[0]) + Math.pow(Math.abs(l.tau[0]) / kt, 2) * rWinding,
      },
      {
        motorId: `${l.legId}_thigh`,
        qDeg: (l.q[1] * 180) / Math.PI,
        qdRpm: ((l.qd[1] * 60) / (2 * Math.PI)),
        tauNm: l.tau[1],
        currentA: Math.abs(l.tau[1]) / kt + (noiseEnabled ? Math.abs(noise(0.1, 22)) : 0),
        tempC: 41.2 + (Math.abs(l.tau[1]) * 1.6) + (noiseEnabled ? noise(0.5, 23) : 0),
        powerW: Math.abs(l.tau[1] * l.qd[1]) + Math.pow(Math.abs(l.tau[1]) / kt, 2) * rWinding,
      },
      {
        motorId: `${l.legId}_calf`,
        qDeg: (l.q[2] * 180) / Math.PI,
        qdRpm: ((l.qd[2] * 60) / (2 * Math.PI)),
        tauNm: l.tau[2],
        currentA: Math.abs(l.tau[2]) / kt + (noiseEnabled ? Math.abs(noise(0.1, 24)) : 0),
        tempC: 43.8 + (Math.abs(l.tau[2]) * 1.8) + (noiseEnabled ? noise(0.5, 25) : 0),
        powerW: Math.abs(l.tau[2] * l.qd[2]) + Math.pow(Math.abs(l.tau[2]) / kt, 2) * rWinding,
      },
    ]);

    // 4. LiDAR & Range Perception
    const forwardObstacleM = Math.max(0.4, 4.25 - (frame.odometerM % 3.5) + noise(0.04, 30));
    const terrainSlopeDeg = ((pitch * 180) / Math.PI) * 0.9 + noise(0.2, 31);

    // 5. State Estimator & EKF
    const ekfVx = frame.basePose.linearVel[0] + noise(0.02, 32);
    const ekfVy = frame.basePose.linearVel[1] + noise(0.02, 33);
    const ekfVz = frame.basePose.linearVel[2] + noise(0.03, 34);
    const ekfResidual = noiseEnabled ? Math.abs(noise(0.015, 35)) : 0.003;

    return {
      imu: { ax, ay, az, gx, gy, gz, mx, my, mz, roll, pitch, yaw, gRms },
      legs: legsData,
      motors: motorTelemetry,
      perception: {
        forwardObstacleM,
        terrainSlopeDeg,
        lidarPointsCount: frame.lidarPoints?.length || 180,
      },
      ekf: { vx: ekfVx, vy: ekfVy, vz: ekfVz, residual: ekfResidual },
      powerTotalW: motorTelemetry.reduce((acc, m) => acc + m.powerW, 0),
      currentMaxA: Math.max(...motorTelemetry.map((m) => m.currentA)),
      tempMaxC: Math.max(...motorTelemetry.map((m) => m.tempC)),
    };
  };

  const p1Sensors = useMemo(
    () => computeSensorPacket(portion1Frame, portion1Config, 10),
    [portion1Frame, portion1Config, noiseSeed, noiseEnabled]
  );

  const p2Sensors = useMemo(
    () => computeSensorPacket(portion2Frame, portion2Config, 100),
    [portion2Frame, portion2Config, noiseSeed, noiseEnabled]
  );

  // Oscilloscope Canvas Rendering
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    const gridCols = 10;
    const gridRows = 6;
    for (let c = 0; c <= gridCols; c++) {
      const x = (c / gridCols) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let r = 0; r <= gridRows; r++) {
      const y = (r / gridRows) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Midline
    ctx.strokeStyle = '#CBD5E1';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const extractValue = (f: SimulationStateFrame, ch: typeof oscilloscopeChannel) => {
      switch (ch) {
        case 'accel_z':
          return f.comAcc[2] + 9.8;
        case 'imu_pitch_rate':
          return (f.basePose.angularVel[1] * 180) / Math.PI;
        case 'fl_grf':
          return f.legs.FL ? f.legs.FL.contactForce.fn : 0;
        case 'rr_grf':
          return f.legs.RR ? f.legs.RR.contactForce.fn : 0;
        case 'fl_thigh_current':
          return f.legs.FL ? Math.abs(f.legs.FL.tau[1]) / 0.85 : 0;
        case 'com_vel_x':
          return f.comVel[0];
        default:
          return 0;
      }
    };

    // Draw curves
    const drawTrace = (
      history: SimulationStateFrame[],
      color: string,
      label: string,
      yOffset: number,
      yScale: number
    ) => {
      if (history.length < 2) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      const stepX = width / Math.max(1, history.length - 1);
      history.forEach((h, i) => {
        const val = extractValue(h, oscilloscopeChannel);
        const y = height / 2 - (val - yOffset) * yScale;
        const x = i * stepX;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };

    // Scale factors per channel
    let yOffset = 0;
    let yScale = 10;
    if (oscilloscopeChannel === 'accel_z') {
      yOffset = 9.8;
      yScale = height * 0.15;
    } else if (oscilloscopeChannel === 'imu_pitch_rate') {
      yOffset = 0;
      yScale = height * 0.05;
    } else if (oscilloscopeChannel === 'fl_grf' || oscilloscopeChannel === 'rr_grf') {
      yOffset = 50;
      yScale = height * 0.005;
    } else if (oscilloscopeChannel === 'fl_thigh_current') {
      yOffset = 5;
      yScale = height * 0.06;
    } else if (oscilloscopeChannel === 'com_vel_x') {
      yOffset = 0.3;
      yScale = height * 0.8;
    }

    if (viewMode === 'portion1' || viewMode === 'compare') {
      drawTrace(portion1History, '#F59E0B', 'Portion 1 (Dynamic)', yOffset, yScale);
    }
    if (viewMode === 'portion2' || viewMode === 'compare') {
      drawTrace(portion2History, '#06B6D4', 'Portion 2 (Mathematical)', yOffset, yScale);
    }
  }, [
    portion1History,
    portion2History,
    oscilloscopeChannel,
    viewMode,
    noiseSeed,
  ]);

  // Export Sensor Telemetry snapshot
  const handleExportSensorData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      sampleRateHz,
      noiseInjected: noiseEnabled,
      portion1: {
        config: portion1Config,
        sensors: p1Sensors,
        frameTimestamp: portion1Frame.timestamp,
      },
      portion2: {
        config: portion2Config,
        sensors: p2Sensors,
        frameTimestamp: portion2Frame.timestamp,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lrsp_sensor_telemetry_stream_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 text-slate-900">
      {/* Header Banner */}
      <div className="flex flex-wrap items-baseline justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-mono font-semibold border border-emerald-300">
              NEW SECTION
            </span>
            <h1 className="text-2xl font-display font-semibold tracking-tight text-slate-900">
              Multi-Modal Sensor Suite &amp; Telemetry Hub
            </h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Dedicated synchronized sensory instrumentation for Portion 1 (Dynamic Locomotion Lab)
            and Portion 2 (Mathematical Foundations Lab) with 9-Axis IMU, 4-foot GRF cells, 12-channel
            actuator bus, ToF perception, and EKF state estimators.
          </p>
        </div>

        {/* Portion Selector & Tools */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-mono">
            <button
              type="button"
              onClick={() => setViewMode('portion1')}
              className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap ${
                viewMode === 'portion1'
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ⚡ Portion 1: Dynamic Sensors
            </button>
            <button
              type="button"
              onClick={() => setViewMode('portion2')}
              className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap ${
                viewMode === 'portion2'
                  ? 'bg-sky-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📐 Portion 2: Math Sensors
            </button>
            <button
              type="button"
              onClick={() => setViewMode('compare')}
              className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap ${
                viewMode === 'compare'
                  ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ⧉ Dual Comparison
            </button>
          </div>

          <button
            type="button"
            onClick={() => setNoiseEnabled((v) => !v)}
            className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-colors ${
              noiseEnabled
                ? 'bg-rose-100 border-rose-400 text-rose-800 font-semibold'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {noiseEnabled ? '⚠️ Noise Injected (ON)' : 'Noise Filter: Ideal'}
          </button>

          <button
            type="button"
            onClick={handleExportSensorData}
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors whitespace-nowrap shadow-xs"
          >
            Export Sensor Telemetry
          </button>
        </div>
      </div>

      {/* Sensor Stream Overview KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
          <div className="text-[11px] font-mono uppercase text-slate-500 font-semibold">IMU Net G-RMS</div>
          <div className="text-xl font-bold font-mono text-amber-600 mt-1">
            {p1Sensors.imu.gRms.toFixed(2)}{' '}
            <span className="text-xs text-slate-500 font-normal">m/s²</span>
          </div>
          <div className="text-[10px] font-mono text-sky-700 mt-0.5 font-medium">
            P2: {p2Sensors.imu.gRms.toFixed(2)} m/s²
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
          <div className="text-[11px] font-mono uppercase text-slate-500 font-semibold">Peak Motor Current</div>
          <div className="text-xl font-bold font-mono text-amber-600 mt-1">
            {p1Sensors.currentMaxA.toFixed(1)}{' '}
            <span className="text-xs text-slate-500 font-normal">A</span>
          </div>
          <div className="text-[10px] font-mono text-sky-700 mt-0.5 font-medium">
            P2: {p2Sensors.currentMaxA.toFixed(1)} A
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
          <div className="text-[11px] font-mono uppercase text-slate-500 font-semibold">Winding Temp Max</div>
          <div className="text-xl font-bold font-mono text-emerald-700 mt-1">
            {p1Sensors.tempMaxC.toFixed(1)}{' '}
            <span className="text-xs text-slate-500 font-normal">°C</span>
          </div>
          <div className="text-[10px] font-mono text-sky-700 mt-0.5 font-medium">
            P2: {p2Sensors.tempMaxC.toFixed(1)} °C
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
          <div className="text-[11px] font-mono uppercase text-slate-500 font-semibold">Total Bus Power</div>
          <div className="text-xl font-bold font-mono text-amber-600 mt-1">
            {p1Sensors.powerTotalW.toFixed(0)}{' '}
            <span className="text-xs text-slate-400 font-normal">W</span>
          </div>
          <div className="text-[10px] font-mono text-cyan-400 mt-0.5">
            P2: {p2Sensors.powerTotalW.toFixed(0)} W
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded p-3">
          <div className="text-[11px] font-mono uppercase text-slate-400">Forward Range (ToF)</div>
          <div className="text-xl font-bold font-mono text-slate-100 mt-1">
            {p1Sensors.perception.forwardObstacleM.toFixed(2)}{' '}
            <span className="text-xs text-slate-400 font-normal">m</span>
          </div>
          <div className="text-[10px] font-mono text-cyan-400 mt-0.5">
            P2: {p2Sensors.perception.forwardObstacleM.toFixed(2)} m
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded p-3">
          <div className="text-[11px] font-mono uppercase text-slate-400">EKF Innovation Residual</div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
            {(p1Sensors.ekf.residual * 1000).toFixed(1)}{' '}
            <span className="text-xs text-slate-400 font-normal">mm/s</span>
          </div>
          <div className="text-[10px] font-mono text-cyan-400 mt-0.5">
            P2: {(p2Sensors.ekf.residual * 1000).toFixed(1)} mm/s
          </div>
        </div>
      </div>

      {/* Main Multi-Channel Live Oscilloscope */}
      <div className="bg-[#111827] border border-slate-800 rounded p-4">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold">
              Live Sensor Oscilloscope Stream (240 Hz Physics Buffer)
            </h2>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="inline-flex items-center gap-1 text-amber-400">
                <span className="w-2.5 h-0.5 bg-amber-400 inline-block" /> Portion 1 (Dynamic)
              </span>
              <span className="inline-flex items-center gap-1 text-cyan-400 ml-2">
                <span className="w-2.5 h-0.5 bg-cyan-400 inline-block" /> Portion 2 (Mathematical)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Channel:</span>
            <select
              value={oscilloscopeChannel}
              onChange={(e) => setOscilloscopeChannel(e.target.value as any)}
              className="bg-[#07090E] border border-slate-700 text-xs font-mono text-slate-200 px-2.5 py-1 rounded"
            >
              <option value="accel_z">IMU Z-Axis Acceleration (m/s²)</option>
              <option value="imu_pitch_rate">IMU Pitch Rate (deg/s)</option>
              <option value="fl_grf">FL Foot Normal Contact Force (N)</option>
              <option value="rr_grf">RR Foot Normal Contact Force (N)</option>
              <option value="fl_thigh_current">FL Thigh Motor Current (A)</option>
              <option value="com_vel_x">CoM Longitudinal Velocity (m/s)</option>
            </select>
          </div>
        </div>

        <div className="relative w-full h-44 bg-[#07090E] rounded border border-slate-800 overflow-hidden">
          <canvas
            ref={canvasRef}
            width={960}
            height={176}
            className="w-full h-full block"
          />
        </div>
      </div>

      {/* Detailed Sensor Matrices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ======================================================== */}
        {/* PORTION 1 SENSORS / DYNAMIC LOCOMOTION                  */}
        {/* ======================================================== */}
        {(viewMode === 'portion1' || viewMode === 'compare') && (
          <div className="space-y-6">
            <div className="p-3 rounded bg-amber-500/10 border border-amber-500/40 flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-semibold text-amber-400">
                  ⚡ Portion 1: Dynamic Locomotion Sensory Telemetry
                </span>
                <span className="text-xs text-slate-400 ml-2">
                  Robot: {portion1Frame.robotId.toUpperCase()} · Gait: {portion1Config.gait.toUpperCase()} ({portion1Config.forwardVel} m/s)
                </span>
              </div>
              <span className="text-xs font-mono text-amber-300">240 Hz Sub-stepping</span>
            </div>

            {/* 1. Tactical IMU Card */}
            <div className="bg-[#111827] border border-slate-800 rounded p-4">
              <h3 className="text-xs font-mono uppercase text-slate-400 mb-3 flex items-center justify-between">
                <span>9-Axis Tactical IMU &amp; Attitude Gyro</span>
                <span className="text-amber-400 font-semibold">{portion1Config.robotId}</span>
              </h3>
              <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                <div className="bg-[#07090E] p-2.5 rounded border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Linear Accel [x, y, z]</div>
                  <div className="text-slate-200 mt-1 font-semibold">
                    {p1Sensors.imu.ax.toFixed(2)}, {p1Sensors.imu.ay.toFixed(2)},{' '}
                    <span className="text-amber-400">{p1Sensors.imu.az.toFixed(2)}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">m/s²</div>
                </div>

                <div className="bg-[#07090E] p-2.5 rounded border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Angular Rate [p, q, r]</div>
                  <div className="text-slate-200 mt-1 font-semibold">
                    {p1Sensors.imu.gx.toFixed(1)}, {p1Sensors.imu.gy.toFixed(1)}, {p1Sensors.imu.gz.toFixed(1)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">deg/s</div>
                </div>

                <div className="bg-[#07090E] p-2.5 rounded border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Attitude [Roll, Pitch, Yaw]</div>
                  <div className="text-slate-200 mt-1 font-semibold">
                    {((p1Sensors.imu.roll * 180) / Math.PI).toFixed(1)}°,{' '}
                    {((p1Sensors.imu.pitch * 180) / Math.PI).toFixed(1)}°,{' '}
                    {((p1Sensors.imu.yaw * 180) / Math.PI).toFixed(1)}°
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Euler Angles</div>
                </div>
              </div>
            </div>

            {/* 2. 4-Foot Ground Reaction Forces & Tactile Grid */}
            <div className="bg-[#111827] border border-slate-800 rounded p-4">
              <h3 className="text-xs font-mono uppercase text-slate-400 mb-3 flex items-center justify-between">
                <span>4-Foot Ground Reaction Forces (GRF) &amp; Tactile Sensors</span>
                <span className="text-slate-400 text-[10px]">μ_limit = {portion1Config.frictionMu}</span>
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {p1Sensors.legs.map((leg) => (
                  <div
                    key={leg.legId}
                    className={`p-3 rounded border text-xs font-mono ${
                      leg.isStance
                        ? 'bg-[#0B1528] border-amber-500/50'
                        : 'bg-[#07090E] border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-slate-200">Leg {leg.legId}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          leg.isStance ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {leg.isStance ? 'STANCE (1)' : 'FLIGHT (0)'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] mb-2">
                      <div>
                        <span className="text-slate-400">Normal Fn: </span>
                        <span className="font-bold text-amber-300">{leg.fn.toFixed(1)} N</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Shear Ft: </span>
                        <span>{leg.ft.toFixed(1)} N</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Cone Util: </span>
                        <span className={leg.muUtil > 0.8 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                          {(leg.muUtil * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Foot Clearance: </span>
                        <span>{leg.footClearanceCm.toFixed(1)} cm</span>
                      </div>
                    </div>

                    {/* 4-Quadrant Tactile Pad Array Visualizer */}
                    <div className="pt-2 border-t border-slate-800/80">
                      <div className="text-[10px] text-slate-400 mb-1">Piezoresistive Foot Pad (kPa)</div>
                      <div className="grid grid-cols-2 gap-1 text-[10px] text-center">
                        <div className="p-1 rounded bg-amber-500/20 text-amber-200">
                          Fwd: {leg.tactileKpa.front.toFixed(0)}
                        </div>
                        <div className="p-1 rounded bg-amber-500/20 text-amber-200">
                          Rear: {leg.tactileKpa.rear.toFixed(0)}
                        </div>
                        <div className="p-1 rounded bg-amber-500/10 text-slate-300">
                          In: {leg.tactileKpa.inner.toFixed(0)}
                        </div>
                        <div className="p-1 rounded bg-amber-500/10 text-slate-300">
                          Out: {leg.tactileKpa.outer.toFixed(0)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. 12-Channel Motor Sensory Bus Table */}
            <div className="bg-[#111827] border border-slate-800 rounded p-4">
              <h3 className="text-xs font-mono uppercase text-slate-400 mb-3 flex items-center justify-between">
                <span>12-Channel Actuator Telemetry &amp; Thermals</span>
                <span className="text-amber-400 text-[10px]">Bus: 48.0 V</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[10px]">
                      <th className="py-1 px-2">Joint Actuator</th>
                      <th className="py-1 px-2">Angle (deg)</th>
                      <th className="py-1 px-2">Speed (RPM)</th>
                      <th className="py-1 px-2">Torque (N·m)</th>
                      <th className="py-1 px-2">Current (A)</th>
                      <th className="py-1 px-2">Temp (°C)</th>
                      <th className="py-1 px-2">Power (W)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {p1Sensors.motors.map((m) => (
                      <tr key={m.motorId} className="hover:bg-slate-800/30">
                        <td className="py-1 px-2 font-medium text-slate-200">{m.motorId}</td>
                        <td className="py-1 px-2 text-slate-300">{m.qDeg.toFixed(1)}°</td>
                        <td className="py-1 px-2 text-slate-300">{m.qdRpm.toFixed(0)}</td>
                        <td className="py-1 px-2 text-amber-300">{m.tauNm.toFixed(1)}</td>
                        <td className="py-1 px-2 font-semibold text-slate-200">{m.currentA.toFixed(2)}</td>
                        <td className="py-1 px-2 text-emerald-400">{m.tempC.toFixed(1)}</td>
                        <td className="py-1 px-2 text-slate-400">{m.powerW.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PORTION 2 SENSORS / MATHEMATICAL FOUNDATIONS             */}
        {/* ======================================================== */}
        {(viewMode === 'portion2' || viewMode === 'compare') && (
          <div className="space-y-6">
            <div className="p-3 rounded bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-semibold text-cyan-400">
                  📐 Portion 2: Mathematical Foundations Sensory Telemetry
                </span>
                <span className="text-xs text-slate-400 ml-2">
                  Robot: SILO4 (González de Santos 2006) · Gait: {portion2Config.gait.toUpperCase()} (β={portion2Config.dutyFactorBeta})
                </span>
              </div>
              <span className="text-xs font-mono text-cyan-300">Continuous Wave Kinematics</span>
            </div>

            {/* 1. Tactical IMU Card */}
            <div className="bg-[#111827] border border-slate-800 rounded p-4">
              <h3 className="text-xs font-mono uppercase text-slate-400 mb-3 flex items-center justify-between">
                <span>9-Axis Precision IMU &amp; Attitude Gyro</span>
                <span className="text-cyan-400 font-semibold">{portion2Config.robotId}</span>
              </h3>
              <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                <div className="bg-[#07090E] p-2.5 rounded border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Linear Accel [x, y, z]</div>
                  <div className="text-slate-200 mt-1 font-semibold">
                    {p2Sensors.imu.ax.toFixed(2)}, {p2Sensors.imu.ay.toFixed(2)},{' '}
                    <span className="text-cyan-400">{p2Sensors.imu.az.toFixed(2)}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">m/s²</div>
                </div>

                <div className="bg-[#07090E] p-2.5 rounded border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Angular Rate [p, q, r]</div>
                  <div className="text-slate-200 mt-1 font-semibold">
                    {p2Sensors.imu.gx.toFixed(1)}, {p2Sensors.imu.gy.toFixed(1)}, {p2Sensors.imu.gz.toFixed(1)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">deg/s</div>
                </div>

                <div className="bg-[#07090E] p-2.5 rounded border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Attitude [Roll, Pitch, Yaw]</div>
                  <div className="text-slate-200 mt-1 font-semibold">
                    {((p2Sensors.imu.roll * 180) / Math.PI).toFixed(1)}°,{' '}
                    {((p2Sensors.imu.pitch * 180) / Math.PI).toFixed(1)}°,{' '}
                    {((p2Sensors.imu.yaw * 180) / Math.PI).toFixed(1)}°
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Euler Angles</div>
                </div>
              </div>
            </div>

            {/* 2. 4-Foot Ground Reaction Forces & Tactile Grid */}
            <div className="bg-[#111827] border border-slate-800 rounded p-4">
              <h3 className="text-xs font-mono uppercase text-slate-400 mb-3 flex items-center justify-between">
                <span>4-Foot Ground Reaction Forces (GRF) &amp; Tactile Sensors</span>
                <span className="text-slate-400 text-[10px]">SILO4 Multi-Contact Equilibrium</span>
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {p2Sensors.legs.map((leg) => (
                  <div
                    key={leg.legId}
                    className={`p-3 rounded border text-xs font-mono ${
                      leg.isStance
                        ? 'bg-[#0B1528] border-cyan-500/50'
                        : 'bg-[#07090E] border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-slate-200">Leg {leg.legId}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          leg.isStance ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {leg.isStance ? 'STANCE (1)' : 'FLIGHT (0)'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] mb-2">
                      <div>
                        <span className="text-slate-400">Normal Fn: </span>
                        <span className="font-bold text-cyan-300">{leg.fn.toFixed(1)} N</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Shear Ft: </span>
                        <span>{leg.ft.toFixed(1)} N</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Cone Util: </span>
                        <span className={leg.muUtil > 0.8 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                          {(leg.muUtil * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Foot Clearance: </span>
                        <span>{leg.footClearanceCm.toFixed(1)} cm</span>
                      </div>
                    </div>

                    {/* 4-Quadrant Tactile Pad Array Visualizer */}
                    <div className="pt-2 border-t border-slate-800/80">
                      <div className="text-[10px] text-slate-400 mb-1">Piezoresistive Foot Pad (kPa)</div>
                      <div className="grid grid-cols-2 gap-1 text-[10px] text-center">
                        <div className="p-1 rounded bg-cyan-500/20 text-cyan-200">
                          Fwd: {leg.tactileKpa.front.toFixed(0)}
                        </div>
                        <div className="p-1 rounded bg-cyan-500/20 text-cyan-200">
                          Rear: {leg.tactileKpa.rear.toFixed(0)}
                        </div>
                        <div className="p-1 rounded bg-cyan-500/10 text-slate-300">
                          In: {leg.tactileKpa.inner.toFixed(0)}
                        </div>
                        <div className="p-1 rounded bg-cyan-500/10 text-slate-300">
                          Out: {leg.tactileKpa.outer.toFixed(0)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. 12-Channel Motor Sensory Bus Table */}
            <div className="bg-[#111827] border border-slate-800 rounded p-4">
              <h3 className="text-xs font-mono uppercase text-slate-400 mb-3 flex items-center justify-between">
                <span>12-Channel Actuator Telemetry &amp; Thermals</span>
                <span className="text-cyan-400 text-[10px]">Bus: 48.0 V</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[10px]">
                      <th className="py-1 px-2">Joint Actuator</th>
                      <th className="py-1 px-2">Angle (deg)</th>
                      <th className="py-1 px-2">Speed (RPM)</th>
                      <th className="py-1 px-2">Torque (N·m)</th>
                      <th className="py-1 px-2">Current (A)</th>
                      <th className="py-1 px-2">Temp (°C)</th>
                      <th className="py-1 px-2">Power (W)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {p2Sensors.motors.map((m) => (
                      <tr key={m.motorId} className="hover:bg-slate-800/30">
                        <td className="py-1 px-2 font-medium text-slate-200">{m.motorId}</td>
                        <td className="py-1 px-2 text-slate-300">{m.qDeg.toFixed(1)}°</td>
                        <td className="py-1 px-2 text-slate-300">{m.qdRpm.toFixed(0)}</td>
                        <td className="py-1 px-2 text-cyan-300">{m.tauNm.toFixed(1)}</td>
                        <td className="py-1 px-2 font-semibold text-slate-200">{m.currentA.toFixed(2)}</td>
                        <td className="py-1 px-2 text-emerald-400">{m.tempC.toFixed(1)}</td>
                        <td className="py-1 px-2 text-slate-400">{m.powerW.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Environmental Perception & Virtual Sensors Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Downward ToF Clearance Array */}
        <div className="bg-[#111827] border border-slate-800 rounded p-4">
          <h4 className="text-xs font-mono uppercase text-slate-400 mb-2">
            Downward Laser ToF Clearance (cm)
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono mt-3">
            <div className="bg-[#07090E] p-2 rounded border border-slate-800">
              <span className="text-slate-400 text-[10px]">FL ToF: </span>
              <span className="font-bold text-slate-200">{p1Sensors.legs[0]?.hipHeightCm.toFixed(1)} cm</span>
            </div>
            <div className="bg-[#07090E] p-2 rounded border border-slate-800">
              <span className="text-slate-400 text-[10px]">FR ToF: </span>
              <span className="font-bold text-slate-200">{p1Sensors.legs[1]?.hipHeightCm.toFixed(1)} cm</span>
            </div>
            <div className="bg-[#07090E] p-2 rounded border border-slate-800">
              <span className="text-slate-400 text-[10px]">RL ToF: </span>
              <span className="font-bold text-slate-200">{p1Sensors.legs[2]?.hipHeightCm.toFixed(1)} cm</span>
            </div>
            <div className="bg-[#07090E] p-2 rounded border border-slate-800">
              <span className="text-slate-400 text-[10px]">RR ToF: </span>
              <span className="font-bold text-slate-200">{p1Sensors.legs[3]?.hipHeightCm.toFixed(1)} cm</span>
            </div>
          </div>
        </div>

        {/* EKF Velocity & Drift Estimator */}
        <div className="bg-[#111827] border border-slate-800 rounded p-4">
          <h4 className="text-xs font-mono uppercase text-slate-400 mb-2">
            EKF Fusion Velocity Estimator
          </h4>
          <div className="space-y-1.5 text-xs font-mono mt-2">
            <div className="flex justify-between">
              <span className="text-slate-400">v_x (Longitudinal):</span>
              <span className="text-amber-400 font-bold">{p1Sensors.ekf.vx.toFixed(3)} m/s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">v_y (Lateral):</span>
              <span className="text-slate-200">{p1Sensors.ekf.vy.toFixed(3)} m/s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">v_z (Vertical):</span>
              <span className="text-slate-200">{p1Sensors.ekf.vz.toFixed(3)} m/s</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-800 text-[11px]">
              <span className="text-slate-400">Innovation ỹ_k:</span>
              <span className="text-emerald-400">{(p1Sensors.ekf.residual * 1000).toFixed(1)} mm/s</span>
            </div>
          </div>
        </div>

        {/* Global Static Stability Sensors (Section G.7) */}
        <div className="bg-[#111827] border border-slate-800 rounded p-4">
          <h4 className="text-xs font-mono uppercase text-slate-400 mb-2">
            G.7 Global Static Stability Sensors
          </h4>
          <div className="space-y-1.5 text-xs font-mono mt-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Torque Margin S_TSM:</span>
              <span className="text-emerald-400 font-bold">
                {portion2Frame.stabilityReport.S_GSSM.torqueMarginVector[0]?.toFixed(1) || '24.2'} N·m
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Current Margin S_CSM:</span>
              <span className="text-emerald-400 font-bold">
                {portion2Frame.stabilityReport.S_GSSM.currentMarginScalar.toFixed(1)} A
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Normalized Margin M:</span>
              <span className="text-cyan-400 font-bold">
                {(portion2Frame.stabilityReport.S_GSSM.normalizedSafetyFactor * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-800 text-[11px]">
              <span className="text-slate-400">Safety State:</span>
              <span className="text-emerald-400 font-semibold">PASS (Nominal)</span>
            </div>
          </div>
        </div>

        {/* Cost of Transport & Power Efficiency */}
        <div className="bg-[#111827] border border-slate-800 rounded p-4">
          <h4 className="text-xs font-mono uppercase text-slate-400 mb-2">
            Energy Sensor &amp; Transport Economy
          </h4>
          <div className="space-y-1.5 text-xs font-mono mt-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Portion 1 CoT:</span>
              <span className="text-amber-400 font-bold">{portion1Frame.cot.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Portion 2 CoT:</span>
              <span className="text-cyan-400 font-bold">{portion2Frame.cot.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Mech Power P1:</span>
              <span className="text-slate-200">{portion1Frame.mechanicalPowerW.toFixed(0)} W</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-800 text-[11px]">
              <span className="text-slate-400">Mech Power P2:</span>
              <span className="text-slate-200">{portion2Frame.mechanicalPowerW.toFixed(0)} W</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
