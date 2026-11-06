import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  DEFAULT_DYNAMIC_SIM_CONFIG,
  DEFAULT_MATH_SIM_CONFIG,
  DEFAULT_SIM_CONFIG,
  LrspSimulationCore,
  REFERENCE_ROBOTS,
  RobotModelSpec,
  SimControlConfig,
} from './src/physics/roboticsEngine';

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  const robotRegistry: Record<string, RobotModelSpec> = { ...REFERENCE_ROBOTS };
  const simSessions: Record<
    string,
    {
      id: string;
      core: LrspSimulationCore;
      config: SimControlConfig;
      startedAt: string;
      status: 'running' | 'stopped';
    }
  > = {};

  // Liveness check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      platform: 'LRSP — Legged Robotics Simulation & Research Platform',
      version: '1.0.0',
      engines: ['mujoco_wasm', 'nexus_webgpu', 'pybullet_cloud'],
      robotsRegistered: Object.keys(robotRegistry).length,
      activeSimulations: Object.keys(simSessions).length,
    });
  });

  // Auth login
  app.post('/api/auth/login', (req, res) => {
    const email = req.body?.email || 'researcher@robotics.lab';
    const token = crypto.createHash('sha256').update(`${email}-${Date.now()}`).digest('hex');
    res.json({
      token,
      role: 'researcher',
      email,
      expiresIn: 3600,
    });
  });

  // Robot Model Ingestion & Content-Addressed SHA-256 Hashing (Section 5.1)
  app.post('/api/robot/upload', (req, res) => {
    const urdfXml: string = req.body?.urdfXml || '';
    if (!urdfXml.trim()) {
      res.status(400).json({ error: 'Missing urdfXml payload' });
      return;
    }

    const urdfHash = crypto.createHash('sha256').update(urdfXml).digest('hex');
    const nameMatch = urdfXml.match(/<robot\s+name="([^"]+)"/i);
    const rawName = nameMatch ? nameMatch[1] : `urdf_${urdfHash.slice(0, 6)}`;
    const id = rawName.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    const jointMatches = urdfXml.match(/<joint\s+[^>]*type="revolute"/gi);
    const dof = jointMatches ? jointMatches.length : 12;

    const baseTemplate = REFERENCE_ROBOTS.unitree_a1;
    const newRobot: RobotModelSpec = {
      ...baseTemplate,
      id,
      name: rawName,
      dof,
      urdfPath: `models/custom/${id}.urdf`,
      urdfHash,
      urdfXml,
    };

    robotRegistry[id] = newRobot;
    res.json({
      status: 'ingested',
      urdfHash,
      robot: newRobot,
    });
  });

  // Get Robot Metadata
  app.get('/api/robot/:id', (req, res) => {
    const robot = robotRegistry[req.params.id];
    if (!robot) {
      res.status(404).json({ error: 'Robot model not found' });
      return;
    }
    res.json(robot);
  });

  // Get Robot Joints
  app.get('/api/robot/:id/joints', (req, res) => {
    const robot = robotRegistry[req.params.id];
    if (!robot) {
      res.status(404).json({ error: 'Robot model not found' });
      return;
    }
    res.json({
      robotId: robot.id,
      dof: robot.dof,
      links: robot.links,
    });
  });

  // Start Simulation Session
  app.post('/api/sim/start', (req, res) => {
    const simId = `sim_${crypto.randomBytes(6).toString('hex')}`;
    const robotId = req.body?.robotId || 'unitree_a1';
    const core = new LrspSimulationCore();
    core.reset(robotId);

    const isDynamic = req.body?.portion === 'dynamic' || req.body?.gait === 'trot';
    const baseConfig = isDynamic ? DEFAULT_DYNAMIC_SIM_CONFIG : DEFAULT_MATH_SIM_CONFIG;

    const config: SimControlConfig = {
      ...baseConfig,
      robotId,
      backend: 'pybullet_cloud',
      gait: req.body?.gait || (isDynamic ? 'trot' : 'wave'),
      forwardVel: req.body?.forwardVel ?? (isDynamic ? 0.55 : 0.18),
    };

    simSessions[simId] = {
      id: simId,
      core,
      config,
      startedAt: new Date().toISOString(),
      status: 'running',
    };

    res.json({
      simulationId: simId,
      status: 'running',
      startedAt: simSessions[simId].startedAt,
      state: core.step(1 / 240, config),
    });
  });

  // Stop Simulation
  app.post('/api/sim/:id/stop', (req, res) => {
    const session = simSessions[req.params.id];
    if (!session) {
      res.status(404).json({ error: 'Simulation session not found' });
      return;
    }
    session.status = 'stopped';
    session.config.running = false;
    res.json({ simulationId: session.id, status: 'stopped' });
  });

  // Get Simulation State Snapshot
  // Get Simulation State Snapshot
  app.get('/api/sim/:id/state', (req, res) => {
    const session = simSessions[req.params.id];
    if (!session) {
      const fallbackCore = new LrspSimulationCore();
      const frame = fallbackCore.step(1 / 240, DEFAULT_SIM_CONFIG);
      res.json({ event: 'state', data: frame });
      return;
    }

    const frame = session.core.step(1 / 240, session.config);
    res.json({
      event: 'state',
      data: {
        timestamp: frame.timestamp,
        joint_positions: frame.jointPositions,
        joint_velocities: frame.jointVelocities,
        base_pose: {
          position: frame.basePose.position,
          orientation: frame.basePose.quaternion,
        },
        odometer: frame.odometerM,
        displacement: frame.displacementM,
        zmp: frame.zmpActual,
        com: frame.com,
        support_polygon: frame.supportPolygon,
        contact_forces: Object.fromEntries(
          Object.entries(frame.legs).map(([k, v]) => [k, v.contactForce.fn])
        ),
        stability_margin: frame.nsi,
        stability_report: frame.stabilityReport,
        gait_state: frame.gait,
        fsm_state: frame.fsmStateLabel,
      },
    });
  });

  // Export Trajectory Dataset
  app.get('/api/sim/:id/export', (req, res) => {
    const session = simSessions[req.params.id];
    const core = session ? session.core : new LrspSimulationCore();
    const cfg = session ? session.config : DEFAULT_SIM_CONFIG;
    const frames = [];
    for (let i = 0; i < 20; i++) {
      frames.push(core.step(1 / 240, cfg));
    }
    res.json({
      simulationId: req.params.id,
      format: req.query.format || 'jsonl',
      count: frames.length,
      frames,
    });
  });

  // Sim-to-Real ONNX Export
  app.post('/api/export/onnx', (req, res) => {
    const { robotId = 'unitree_a1', gait = 'trot', format = 'onnx', domainRandomization } = req.body || {};
    res.json({
      ir_version: 9,
      opset_import: [{ domain: 'ai.onnx', version: 18 }],
      producer_name: 'LRSP-DPIL-Compiler',
      producer_version: '2026.1.0',
      format: String(format).toUpperCase(),
      model_hash: crypto
        .createHash('sha256')
        .update(`${robotId}-${gait}-${Date.now()}`)
        .digest('hex'),
      robot_id: robotId,
      gait_mode: gait,
      graph: {
        name: `${robotId}_${gait}_locomotion_policy`,
        inputs: [
          { name: 'base_rpy_angvel', shape: [1, 6], dtype: 'FLOAT32' },
          { name: 'joint_pos_err', shape: [1, 12], dtype: 'FLOAT32' },
          { name: 'joint_vel', shape: [1, 12], dtype: 'FLOAT32' },
          { name: 'zmp_phase_clock', shape: [1, 6], dtype: 'FLOAT32' },
        ],
        outputs: [{ name: 'joint_torques_nm', shape: [1, 12], dtype: 'FLOAT32' }],
        nodes: [
          { op_type: 'Gemm', name: 'lnn_encoder_fc1', shape: [36, 256] },
          { op_type: 'Elu', name: 'lnn_act1' },
          { op_type: 'Gemm', name: 'koopman_residual_fc2', shape: [256, 128] },
          { op_type: 'Elu', name: 'lnn_act2' },
          { op_type: 'Gemm', name: 'torque_head', shape: [128, 12] },
        ],
      },
      domain_randomization: domainRandomization || {},
      edge_deployment_target: {
        runtime: 'ONNX Runtime Web / TensorRT Edge Core',
        control_loop_hz: 240,
        nsi_safety_fallback_threshold: 0.3,
      },
    });
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server started on port ${PORT}`);
    console.log(`  ➜  Local:   http://localhost:${PORT}/`);
    console.log(`  ➜  Network: http://0.0.0.0:${PORT}/`);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vitePromise = createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });

    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api')) {
        return next();
      }
      try {
        const vite = await vitePromise;
        const indexPath = path.resolve(process.cwd(), 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[LRSP] Port ${PORT} busy, retrying in 500ms...`);
      setTimeout(() => {
        try {
          server.close();
        } catch {
          // ignore
        }
        server.listen(PORT, '0.0.0.0');
      }, 500);
    } else {
      console.error('[LRSP] Server error:', err);
    }
  });

  const shutdown = () => {
    try {
      server.close(() => process.exit(0));
    } catch {
      process.exit(0);
    }
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();
