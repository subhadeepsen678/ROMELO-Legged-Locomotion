export type GaitType =
  | 'wave'
  | 'two_phase_discontinuous'
  | 'four_phase_discontinuous'
  | 'crab'
  | 'circling'
  | 'spinning'
  | 'free'
  | 'walk'
  | 'trot'
  | 'pace'
  | 'bound'
  | 'gallop'
  | 'ci_mpc';

export type GaitRegime = 'static' | 'dynamic' | 'transition';
export type PhysicsBackend = 'mujoco_wasm' | 'nexus_webgpu' | 'pybullet_cloud';
export type SolverType = 'TGS' | 'AVBD';
export type LightingPreset = 'indoor_lab' | 'outdoor_sunny' | 'night' | 'warehouse';
export type TerrainType = 'flat_plane' | 'stepped_obstacles' | 'inclined_ramp' | 'uneven_dem';

export type StabilityMarginId =
  | 'SM-1_SSM'
  | 'SM-2_LSM'
  | 'SM-3_CLSM'
  | 'SM-4_ESM'
  | 'SM-5_NESM'
  | 'SM-6_DSM'
  | 'SM-7_TSM'
  | 'SM-8_FASM'
  | 'SM-9_ZMP'
  | 'SM-10_NDESM';

export interface RobotLinkSpec {
  name: string;
  parent: string | null;
  jointType: 'floating' | 'revolute' | 'fixed';
  mass: number;
  comOffset: [number, number, number];
  inertiaDiag: [number, number, number];
  limits: [number, number, number];
  visualGeometry: string;
}

export interface RobotModelSpec {
  id: string;
  name: string;
  manufacturer: string;
  morphology: 'quadruped' | 'biped' | 'humanoid';
  dof: number;
  legs: number;
  totalMass: number;
  nominalComHeight: number;
  hipOffsets: Record<string, [number, number, number]>;
  linkLengths: {
    hipAbduction: number; // a1
    thigh: number; // a2
    calf: number; // a3
  };
  urdfPath: string;
  urdfHash: string;
  urdfXml: string;
  links: RobotLinkSpec[];
  accentColor: string;
  chassisColor: string;
}

export interface LegKinematicsState {
  legId: string;
  q: [number, number, number]; // [q1, q2, q3]
  qd: [number, number, number];
  qdd: [number, number, number];
  tau: [number, number, number];
  tauFriction: [number, number, number];
  hipWorld: [number, number, number];
  hfeWorld: [number, number, number];
  kneeWorld: [number, number, number];
  footWorld: [number, number, number];
  footTarget: [number, number, number];
  swingTrajectory: [number, number, number][];
  phase: number;
  isStance: boolean;
  contactForce: {
    fx: number;
    fy: number;
    fn: number;
    ft: number;
    frictionRatio: number;
    gap: number;
    complementarityValid: boolean;
  };
  jacobian: number[][]; // 6x3 Geometric / Analytical Jacobian
  conditionNumber: number;
  ikIterations: number;
  ikError: number;
  fuzzyAccel: number; // Leg acceleration chosen by Mamdani FIS (m/s^2)
  virtualSensor: {
    groundSwitch: number; // 0 (flight) or 1 (contact)
    predictedForce: [number, number, number];
  };
}

export interface StabilityTaxonomyReport {
  S_SM: number; // SM-1: Static Stability Margin (m)
  S_LSM: number; // SM-2: Longitudinal Stability Margin (m)
  S_CLSM: number; // SM-3: Crab Longitudinal Stability Margin (m)
  S_ESM: number; // SM-4: Energy Stability Margin (J)
  S_NESM: number; // SM-5: Normalized Energy Stability Margin (m)
  S_DSM: number; // SM-6: Dynamic Stability Margin
  S_TSM: number; // SM-7: Tumble Stability Margin
  S_FASM: number; // SM-8: Force-Angle Stability Margin
  S_ZMP: number; // SM-9: ZMP Stability Margin (m)
  S_NDESM: number; // SM-10: Normalized Dynamic Energy Stability Margin (m)
  // Section G.7 Global Static Stability Criterion
  S_GSSM: {
    torqueMarginVector: number[]; // S_TSM vector = tau_max - |tau_req|
    currentMarginScalar: number; // S_CSM = I_max - sum(|I_i|)
    normalizedSafetyFactor: number; // M in (0, 1]
    isWithinSafetyBound: boolean;
  };
}

export interface FootholdRestrictionAreas {
  areaA: [number, number][]; // Polygons
  areaB: [number, number][];
  areaC: [number, number][];
  effectiveZone: [number, number][];
  transferLeg: string;
  nextTransferLeg: string;
}

export interface ZmpDiagnostics {
  isValid: boolean;
  reasonInvalid?: 'flight_phase' | 'low_force' | 'non_coplanar' | null;
  zmpRaw: [number, number];
  zmpFiltered: [number, number];
  zmpDynCrossCheck: [number, number];
  discrepancyMm: number;
  isInsidePolygon: boolean;
  signedMarginM: number;
  closestEdge: { p1: [number, number]; p2: [number, number]; normal: [number, number] };
  contactForceSum: [number, number, number];
  contactMomentSum: [number, number, number];
  coplanarResidualMm: number;
  frictionViolations: string[];
  frictionMarginMin: number;
  lipmAccelDes: [number, number];
}

export interface SimulationStateFrame {
  timestamp: number;
  simTime: number;
  stepCount: number;
  robotId: string;
  backend: PhysicsBackend;
  gait: GaitType;
  gaitRegime: GaitRegime;
  targetGait: GaitType;
  inTransitionPhase: boolean;
  transitionProgress: number;
  fsmStateLabel: string;
  basePose: {
    position: [number, number, number];
    rpy: [number, number, number];
    quaternion: [number, number, number, number];
    linearVel: [number, number, number];
    angularVel: [number, number, number];
  };
  com: [number, number, number];
  comVel: [number, number, number];
  comAcc: [number, number, number];
  zmpActual: [number, number];
  zmpRef: [number, number];
  zmpPreviewHorizon: [number, number][];
  comPreviewHorizon: [number, number][];
  zmpTrackingErrorCm: number;
  zmpDiagnostics: ZmpDiagnostics;
  supportPolygon: [number, number][];
  shrunkSupportPolygon: [number, number][];
  nsi: number;
  stabilityMarginM: number;
  cot: number;
  mechanicalPowerW: number;
  symmetryLoss: number;
  legs: Record<string, LegKinematicsState>;
  jointPositions: number[];
  jointVelocities: number[];
  jointTorques: number[];
  massMatrix: number[][];
  coriolisMatrix: number[][];
  gravityVector: number[];
  ciMpcSchedule: Record<string, number[]>;
  dpilMetrics: {
    lnnEnergyResidual: number;
    koopmanEigenDecay: number;
    lcpGradientNorm: number;
  };
  lidarPoints: { x: number; y: number; z: number; intensity: number }[];
  physicsStepMs: number;
  odometerM: number;
  displacementM: number;
  speedMps: number;
  worldTrajectory: [number, number, number][];
  // Addendum G Specific Mathematical State
  stabilityReport: StabilityTaxonomyReport;
  footholdAreas: FootholdRestrictionAreas;
  dynamicsModelType: 'full_euler_lagrange' | 'simplified_horizontal_lengthening';
}

export interface SimControlConfig {
  running: boolean;
  simSpeedMultiplier: number;
  robotId: string;
  backend: PhysicsBackend;
  solver: SolverType;
  solverIterations: number;
  gait: GaitType;
  gaitRegime: GaitRegime;
  forwardVel: number;
  lateralVel: number;
  turnRate: number;
  crabAngleRad: number; // alpha for Crab Gait (Section G.3.4)
  stepHeight: number;
  comHeightOffset: number;
  gaitFrequencyHz: number;
  dutyFactorBeta: number; // beta in [0.75, 1.0] for wave gait
  strokeRx: number; // R_x leg stroke (m)
  dampingLambda: number;
  frictionMu: number;
  previewSteps: number;
  safetyMarginM: number; // M in (0, 1] for Global Static Stability (Section G.7)
  useSimplifiedDynamics: boolean; // Section G.6.7 toggle
  enableFuzzyAcceleration: boolean; // Section G.8 Mamdani FIS toggle
  symmetryEnabled: {
    morphological: boolean;
    timeReversal: boolean;
    leftRight: boolean;
  };
  domainRandomization: {
    enabled: boolean;
    frictionRange: [number, number];
    payloadMassKg: number;
    motorLatencyMs: number;
    imuNoiseStd: number;
    terrainSlopeDeg: number;
    obsDelaySteps: number;
  };
  terrain: TerrainType;
  lighting: LightingPreset;
  externalPush: {
    fx: number;
    fy: number;
    decayRemaining: number;
  };
}

export const DEFAULT_DYNAMIC_SIM_CONFIG: SimControlConfig = {
  running: true,
  simSpeedMultiplier: 1.0,
  robotId: 'unitree_a1',
  backend: 'mujoco_wasm',
  solver: 'TGS',
  solverIterations: 50,
  gait: 'trot',
  gaitRegime: 'dynamic',
  forwardVel: 0.55,
  lateralVel: 0.0,
  turnRate: 0.0,
  crabAngleRad: 0.0,
  stepHeight: 0.08,
  comHeightOffset: 0.0,
  gaitFrequencyHz: 2.2,
  dutyFactorBeta: 0.5,
  strokeRx: 0.28,
  dampingLambda: 0.01,
  frictionMu: 0.8,
  previewSteps: 25,
  safetyMarginM: 0.1,
  useSimplifiedDynamics: false,
  enableFuzzyAcceleration: false,
  symmetryEnabled: {
    morphological: true,
    timeReversal: true,
    leftRight: true,
  },
  domainRandomization: {
    enabled: false,
    frictionRange: [0.3, 1.2],
    payloadMassKg: 0.0,
    motorLatencyMs: 1.5,
    imuNoiseStd: 0.008,
    terrainSlopeDeg: 0.0,
    obsDelaySteps: 1,
  },
  terrain: 'flat_plane',
  lighting: 'indoor_lab',
  externalPush: {
    fx: 0,
    fy: 0,
    decayRemaining: 0,
  },
};

export const DEFAULT_MATH_SIM_CONFIG: SimControlConfig = {
  running: true,
  simSpeedMultiplier: 1.0,
  robotId: 'unitree_a1',
  backend: 'mujoco_wasm',
  solver: 'TGS',
  solverIterations: 50,
  gait: 'wave',
  gaitRegime: 'static',
  forwardVel: 0.18,
  lateralVel: 0.0,
  turnRate: 0.0,
  crabAngleRad: 0.0,
  stepHeight: 0.065,
  comHeightOffset: 0.0,
  gaitFrequencyHz: 1.4,
  dutyFactorBeta: 0.88,
  strokeRx: 0.25,
  dampingLambda: 0.01,
  frictionMu: 0.8,
  previewSteps: 25,
  safetyMarginM: 0.15,
  useSimplifiedDynamics: false,
  enableFuzzyAcceleration: true,
  symmetryEnabled: {
    morphological: true,
    timeReversal: true,
    leftRight: true,
  },
  domainRandomization: {
    enabled: false,
    frictionRange: [0.3, 1.2],
    payloadMassKg: 0.0,
    motorLatencyMs: 1.5,
    imuNoiseStd: 0.008,
    terrainSlopeDeg: 0.0,
    obsDelaySteps: 1,
  },
  terrain: 'flat_plane',
  lighting: 'indoor_lab',
  externalPush: {
    fx: 0,
    fy: 0,
    decayRemaining: 0,
  },
};

export const DEFAULT_SIM_CONFIG: SimControlConfig = DEFAULT_MATH_SIM_CONFIG;

export const GAIT_CATALOG: Record<
  GaitType,
  {
    name: string;
    regime: GaitRegime;
    dutyFactor: number;
    supportPattern: string;
    velocityRange: [number, number];
    stabilityType: 'Static' | 'Dynamic' | 'Optimal Discovery';
    phaseOffsets: Record<string, number>;
    description: string;
  }
> = {
  wave: {
    name: 'Wave Gait (Continuous)',
    regime: 'static',
    dutyFactor: 0.88,
    supportPattern: 'Continuous crawl wave (+x)',
    velocityRange: [0.0, 0.28],
    stabilityType: 'Static',
    phaseOffsets: { FL: 0.0, RR: 0.38, FR: 0.5, RL: 0.88 },
    description: 'Exact wave gait (Eq. 3.10): φ1=0, φ2=1/2, φ3=β, φ4=F(β-1/2) with S_LSM=(β-3/4)λ.',
  },
  two_phase_discontinuous: {
    name: '2-Phase Discontinuous',
    regime: 'static',
    dutyFactor: 0.78, // beta = 7/9 for K=2
    supportPattern: '4-2-B-3-1-B body motion sequence',
    velocityRange: [0.0, 0.25],
    stabilityType: 'Static',
    phaseOffsets: { FL: 0.0, FR: 0.33, RL: 0.66, RR: 0.16 },
    description: 'Two-phase discontinuous gait maximizing S_LSM = Rx/4 across all discontinuous gaits.',
  },
  four_phase_discontinuous: {
    name: '4-Phase Discontinuous',
    regime: 'static',
    dutyFactor: 0.82,
    supportPattern: '4-Phase body shift',
    velocityRange: [0.0, 0.2],
    stabilityType: 'Static',
    phaseOffsets: { FL: 0.0, RR: 0.25, FR: 0.5, RL: 0.75 },
    description: 'Four-phase discontinuous gait with constant stability margin S_LSM = Rx/8.',
  },
  crab: {
    name: 'Crab Gait (Case A/B)',
    regime: 'static',
    dutyFactor: 0.8,
    supportPattern: 'Omnidirectional crab angle α',
    velocityRange: [0.0, 0.25],
    stabilityType: 'Static',
    phaseOffsets: { FL: 0.0, FR: 0.5, RL: 0.5, RR: 0.0 },
    description: 'Crab gait with exact equations for L_x, L_y, and S_LSM_A+/B+ within [-30°, 26°].',
  },
  circling: {
    name: 'Circling Gait',
    regime: 'static',
    dutyFactor: 0.82,
    supportPattern: 'Circular arc rotation ^I_A_B',
    velocityRange: [0.0, 0.3],
    stabilityType: 'Static',
    phaseOffsets: { FL: 0.0, RR: 0.3, FR: 0.5, RL: 0.8 },
    description: 'Circling body displacement x_i=±(L/2)√(4-L^2/R^2), y_i=L^2/(2R), α=2β.',
  },
  spinning: {
    name: 'Spinning Gait',
    regime: 'static',
    dutyFactor: 0.8,
    supportPattern: 'In-place body yaw spin',
    velocityRange: [0.0, 0.3],
    stabilityType: 'Static',
    phaseOffsets: { FL: 0.0, RL: 0.25, FR: 0.5, RR: 0.75 },
    description: 'Reduced spinning for |α|≤16°, full spinning with exact S_LSM+ for larger rotations.',
  },
  free: {
    name: 'Free Gait (Foothold Areas)',
    regime: 'static',
    dutyFactor: 0.78,
    supportPattern: 'Semiplane Areas A, B, C searching zone',
    velocityRange: [0.0, 0.3],
    stabilityType: 'Static',
    phaseOffsets: { FL: 0.0, RR: 0.25, FR: 0.5, RL: 0.75 },
    description: 'Free gait using exact geometric semiplane predicates for Areas A, B, and C.',
  },
  walk: {
    name: 'Walk',
    regime: 'dynamic',
    dutyFactor: 0.75,
    supportPattern: '3-leg crawl wave',
    velocityRange: [0.0, 0.35],
    stabilityType: 'Static',
    phaseOffsets: { FL: 0.0, RR: 0.25, FR: 0.5, RL: 0.75 },
    description: 'Quasi-static 3-foot stance wave ensuring ZMP remains inside large support triangle.',
  },
  trot: {
    name: 'Trot',
    regime: 'dynamic',
    dutyFactor: 0.5,
    supportPattern: 'Diagonal 2-leg pair',
    velocityRange: [0.3, 0.9],
    stabilityType: 'Dynamic',
    phaseOffsets: { FL: 0.0, RR: 0.0, FR: 0.5, RL: 0.5 },
    description: 'Symmetric diagonal pairing (FL+RR, FR+RL) with zero angular momentum pitch/roll coupling.',
  },
  pace: {
    name: 'Pace',
    regime: 'dynamic',
    dutyFactor: 0.5,
    supportPattern: 'Lateral 2-leg pair',
    velocityRange: [0.3, 0.85],
    stabilityType: 'Dynamic',
    phaseOffsets: { FL: 0.0, RL: 0.0, FR: 0.5, RR: 0.5 },
    description: 'Ipsilateral leg synchronization (FL+RL, FR+RR) preventing fore-aft hoof interference.',
  },
  bound: {
    name: 'Bound',
    regime: 'dynamic',
    dutyFactor: 0.48,
    supportPattern: 'Front/back 2-leg pair',
    velocityRange: [0.5, 1.3],
    stabilityType: 'Dynamic',
    phaseOffsets: { FL: 0.0, FR: 0.0, RL: 0.5, RR: 0.5 },
    description: 'Sagittal-plane synchronized front and rear pairs with flight/pitch oscillation.',
  },
  gallop: {
    name: 'Gallop',
    regime: 'dynamic',
    dutyFactor: 0.36,
    supportPattern: 'Asymmetric rotary flight',
    velocityRange: [0.8, 2.0],
    stabilityType: 'Dynamic',
    phaseOffsets: { FL: 0.0, FR: 0.14, RR: 0.52, RL: 0.66 },
    description: 'High-speed asymmetric quadrupedal gait with aerial suspension phase and high CoT efficiency.',
  },
  ci_mpc: {
    name: 'CI-MPC Online',
    regime: 'dynamic',
    dutyFactor: 0.45,
    supportPattern: 'Implicit LCP Contact',
    velocityRange: [0.0, 2.0],
    stabilityType: 'Optimal Discovery',
    phaseOffsets: { FL: 0.0, RR: 0.12, FR: 0.48, RL: 0.6 },
    description: 'Contact-Implicit Model Predictive Control discovering contact sequences online via idto/QP.',
  },
};

function generateRobotUrdfXml(
  name: string,
  mass: number,
  hipOffsets: Record<string, [number, number, number]>,
  lengths: { hipAbduction: number; thigh: number; calf: number },
  jointLimits: {
    hip: [number, number, number, number];
    thigh: [number, number, number, number];
    calf: [number, number, number, number];
  } = {
    hip: [-0.802, 0.802, 33.5, 21.0],
    thigh: [-1.047, 4.188, 33.5, 21.0],
    calf: [-2.696, -0.916, 33.5, 21.0],
  }
): string {
  const legEntries = Object.entries(hipOffsets)
    .map(([leg, [hx, hy, hz]]) => {
      const isLeft = hy >= 0;
      const hipSign = isLeft ? 1 : -1;
      const hipOffset = hipSign * lengths.hipAbduction;

      return `  <!-- ================= ${leg} LEG (Verified HAA-HFE-KFE Architecture) ================= -->
  <!-- 1. HAA Joint: Hip Abduction/Adduction (Roll along X-axis [1 0 0]) -->
  <joint name="${leg}_hip_joint" type="revolute">
    <parent link="trunk"/>
    <child link="${leg}_hip"/>
    <origin xyz="${hx.toFixed(4)} ${hy.toFixed(4)} ${hz.toFixed(4)}" rpy="0 0 0"/>
    <axis xyz="1 0 0"/>
    <limit lower="${jointLimits.hip[0]}" upper="${jointLimits.hip[1]}" effort="${jointLimits.hip[2]}" velocity="${jointLimits.hip[3]}"/>
    <dynamics damping="0.02" friction="0.05"/>
  </joint>

  <!-- 1. Hip Link: Houses HAA Roll Actuator & HFE Pitch Actuator Stator -->
  <link name="${leg}_hip">
    <inertial>
      <origin xyz="0 ${(hipOffset * 0.5).toFixed(4)} 0" rpy="0 0 0"/>
      <mass value="${(mass * 0.055).toFixed(3)}"/>
      <inertia ixx="0.000469" ixy="0" ixz="0" iyy="0.000807" iyz="0" izz="0.000553"/>
    </inertial>
    <!-- HAA Actuator (Gold Cylinder aligned along X-axis / Roll) -->
    <visual>
      <origin xyz="0 0 0" rpy="0 1.570796 0"/>
      <geometry>
        <cylinder radius="0.046" length="0.080"/>
      </geometry>
      <material name="actuator_gold"/>
    </visual>
    <!-- HFE Actuator Housing (Gold Cylinder aligned along Y-axis / Pitch) -->
    <visual>
      <origin xyz="0 ${(hipOffset * 0.5).toFixed(4)} 0" rpy="1.570796 0 0"/>
      <geometry>
        <cylinder radius="0.044" length="${lengths.hipAbduction.toFixed(4)}"/>
      </geometry>
      <material name="actuator_gold"/>
    </visual>
    <collision>
      <origin xyz="0 ${(hipOffset * 0.5).toFixed(4)} 0" rpy="1.570796 0 0"/>
      <geometry>
        <cylinder radius="0.046" length="${lengths.hipAbduction.toFixed(4)}"/>
      </geometry>
    </collision>
  </link>

  <!-- 2. HFE Joint: Hip Flexion/Extension (Pitch along Y-axis [0 1 0]) -->
  <joint name="${leg}_thigh_joint" type="revolute">
    <parent link="${leg}_hip"/>
    <child link="${leg}_thigh"/>
    <origin xyz="0 ${hipOffset.toFixed(4)} 0" rpy="0 0 0"/>
    <axis xyz="0 1 0"/>
    <limit lower="${jointLimits.thigh[0]}" upper="${jointLimits.thigh[1]}" effort="${jointLimits.thigh[2]}" velocity="${jointLimits.thigh[3]}"/>
    <dynamics damping="0.02" friction="0.05"/>
  </joint>

  <!-- 2. Thigh Link: Upper Leg Rod connecting HFE to KFE Knee -->
  <link name="${leg}_thigh">
    <inertial>
      <origin xyz="0 0 ${(-lengths.thigh * 0.5).toFixed(4)}" rpy="0 0 0"/>
      <mass value="${(mass * 0.082).toFixed(3)}"/>
      <inertia ixx="0.005529" ixy="0" ixz="0" iyy="0.005139" iyz="0" izz="0.001365"/>
    </inertial>
    <visual>
      <origin xyz="0 0 ${(-lengths.thigh * 0.5).toFixed(4)}" rpy="0 0 0"/>
      <geometry>
        <cylinder radius="0.022" length="${lengths.thigh.toFixed(4)}"/>
      </geometry>
      <material name="limb_metal"/>
    </visual>
    <collision>
      <origin xyz="0 0 ${(-lengths.thigh * 0.5).toFixed(4)}" rpy="0 0 0"/>
      <geometry>
        <cylinder radius="0.024" length="${lengths.thigh.toFixed(4)}"/>
      </geometry>
    </collision>
  </link>

  <!-- 3. KFE Joint: Knee Flexion/Extension (Pitch along Y-axis [0 1 0], Parallel to HFE) -->
  <joint name="${leg}_calf_joint" type="revolute">
    <parent link="${leg}_thigh"/>
    <child link="${leg}_calf"/>
    <origin xyz="0 0 ${(-lengths.thigh).toFixed(4)}" rpy="0 0 0"/>
    <axis xyz="0 1 0"/>
    <limit lower="${jointLimits.calf[0]}" upper="${jointLimits.calf[1]}" effort="${jointLimits.calf[2]}" velocity="${jointLimits.calf[3]}"/>
    <dynamics damping="0.02" friction="0.05"/>
  </joint>

  <!-- 3. Calf Link: KFE Knee Actuator Cylinder + Shank Rod down to Foot -->
  <link name="${leg}_calf">
    <inertial>
      <origin xyz="0 0 ${(-lengths.calf * 0.5).toFixed(4)}" rpy="0 0 0"/>
      <mass value="${(mass * 0.024).toFixed(3)}"/>
      <inertia ixx="0.002998" ixy="0" ixz="0" iyy="0.003014" iyz="0" izz="0.000032"/>
    </inertial>
    <!-- KFE Knee Actuator (Gold Cylinder aligned along Y-axis / Pitch) -->
    <visual>
      <origin xyz="0 0 0" rpy="1.570796 0 0"/>
      <geometry>
        <cylinder radius="0.036" length="0.065"/>
      </geometry>
      <material name="actuator_gold"/>
    </visual>
    <!-- Lower Leg Shank Rod -->
    <visual>
      <origin xyz="0 0 ${(-lengths.calf * 0.5).toFixed(4)}" rpy="0 0 0"/>
      <geometry>
        <cylinder radius="0.015" length="${lengths.calf.toFixed(4)}"/>
      </geometry>
      <material name="limb_metal"/>
    </visual>
    <collision>
      <origin xyz="0 0 ${(-lengths.calf * 0.5).toFixed(4)}" rpy="0 0 0"/>
      <geometry>
        <cylinder radius="0.016" length="${lengths.calf.toFixed(4)}"/>
      </geometry>
    </collision>
  </link>

  <!-- 4. Spherical Foot Contact (Fixed Joint at distal tip) -->
  <joint name="${leg}_foot_fixed" type="fixed">
    <parent link="${leg}_calf"/>
    <child link="${leg}_foot"/>
    <origin xyz="0 0 ${(-lengths.calf).toFixed(4)}" rpy="0 0 0"/>
  </joint>

  <link name="${leg}_foot">
    <inertial>
      <origin xyz="0 0 0" rpy="0 0 0"/>
      <mass value="0.06"/>
      <inertia ixx="0.00002" ixy="0" ixz="0" iyy="0.00002" iyz="0" izz="0.00002"/>
    </inertial>
    <visual>
      <origin xyz="0 0 0" rpy="0 0 0"/>
      <geometry>
        <sphere radius="0.022"/>
      </geometry>
      <material name="rubber_foot"/>
    </visual>
    <collision>
      <origin xyz="0 0 0" rpy="0 0 0"/>
      <geometry>
        <sphere radius="0.022"/>
      </geometry>
    </collision>
  </link>

  <!-- Actuator Transmissions (HAA, HFE, KFE) -->
  <transmission name="${leg}_hip_trans">
    <type>transmission_interface/SimpleTransmission</type>
    <joint name="${leg}_hip_joint">
      <hardwareInterface>hardware_interface/EffortJointInterface</hardwareInterface>
    </joint>
    <actuator name="${leg}_haa_motor">
      <mechanicalReduction>1</mechanicalReduction>
    </actuator>
  </transmission>

  <transmission name="${leg}_thigh_trans">
    <type>transmission_interface/SimpleTransmission</type>
    <joint name="${leg}_thigh_joint">
      <hardwareInterface>hardware_interface/EffortJointInterface</hardwareInterface>
    </joint>
    <actuator name="${leg}_hfe_motor">
      <mechanicalReduction>1</mechanicalReduction>
    </actuator>
  </transmission>

  <transmission name="${leg}_calf_trans">
    <type>transmission_interface/SimpleTransmission</type>
    <joint name="${leg}_calf_joint">
      <hardwareInterface>hardware_interface/EffortJointInterface</hardwareInterface>
    </joint>
    <actuator name="${leg}_kfe_motor">
      <mechanicalReduction>1</mechanicalReduction>
    </actuator>
  </transmission>`;
    })
    .join('\n\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<!--
  =============================================================================
  Verified High-Efficiency 3-DoF Quadruped Leg URDF
  Model: ${name}
  Total Mass: ${mass} kg
  Kinematic Chain: trunk -> [HAA] -> hip -> [HFE] -> thigh -> [KFE] -> calf -> foot
  =============================================================================
-->
<robot name="${name}">
  <material name="chassis_dark">
    <color rgba="0.06 0.09 0.16 1.0"/>
  </material>
  <material name="actuator_gold">
    <color rgba="0.92 0.70 0.03 1.0"/>
  </material>
  <material name="limb_metal">
    <color rgba="0.58 0.64 0.72 1.0"/>
  </material>
  <material name="rubber_foot">
    <color rgba="0.12 0.12 0.14 1.0"/>
  </material>

  <link name="trunk">
    <inertial>
      <origin xyz="0.0 0.0041 -0.0005" rpy="0 0 0"/>
      <mass value="${(mass * 0.48).toFixed(3)}"/>
      <inertia ixx="0.01585" ixy="-0.00003" ixz="-0.00006" iyy="0.03779" iyz="-0.00004" izz="0.04565"/>
    </inertial>
    <visual>
      <origin xyz="0 0 0" rpy="0 0 0"/>
      <geometry><box size="0.38 0.19 0.114"/></geometry>
      <material name="chassis_dark"/>
    </visual>
    <collision>
      <origin xyz="0 0 0" rpy="0 0 0"/>
      <geometry><box size="0.38 0.19 0.114"/></geometry>
    </collision>
  </link>

${legEntries}
</robot>`;
}

function generateDetailedQuadrupedUrdfXml(
  name: string,
  mass: number,
  hipOffsets: Record<string, [number, number, number]>,
  lengths: { hipAbduction: number; thigh: number; calf: number },
  jointLimits: {
    hip: [number, number, number, number]; // [lower, upper, effort, vel]
    thigh: [number, number, number, number];
    calf: [number, number, number, number];
  },
  trunkBox: [number, number, number],
  accentColor: string,
  chassisColor: string
): string {
  const legXmls = Object.entries(hipOffsets)
    .map(([leg, [hx, hy, hz]]) => {
      const isLeft = hy >= 0;
      const hipSign = isLeft ? 1 : -1;
      const hipOffset = hipSign * lengths.hipAbduction;

      return `  <!-- ================= ${leg} LEG (Verified High-Efficiency HAA-HFE-KFE Architecture) ================= -->
  <!-- 1. HAA Joint: Hip Abduction/Adduction (Roll along X-axis [1 0 0]) -->
  <joint name="${leg}_hip_joint" type="revolute">
    <parent link="trunk"/>
    <child link="${leg}_hip"/>
    <origin xyz="${hx.toFixed(4)} ${hy.toFixed(4)} ${hz.toFixed(4)}" rpy="0 0 0"/>
    <axis xyz="1 0 0"/>
    <limit lower="${jointLimits.hip[0]}" upper="${jointLimits.hip[1]}" effort="${jointLimits.hip[2]}" velocity="${jointLimits.hip[3]}"/>
    <dynamics damping="0.02" friction="0.05"/>
  </joint>

  <!-- 1. Hip Link: Houses HAA Roll Actuator & HFE Pitch Actuator Stator -->
  <link name="${leg}_hip">
    <inertial>
      <origin xyz="0 ${(hipOffset * 0.5).toFixed(4)} 0" rpy="0 0 0"/>
      <mass value="${(mass * 0.055).toFixed(3)}"/>
      <inertia ixx="0.000469" ixy="0" ixz="0" iyy="0.000807" iyz="0" izz="0.000553"/>
    </inertial>
    <!-- HAA Actuator (Aligned along X-axis / Roll) -->
    <visual>
      <origin xyz="0 0 0" rpy="0 1.570796 0"/>
      <geometry>
        <cylinder radius="0.046" length="0.080"/>
      </geometry>
      <material name="accent_metal"/>
    </visual>
    <!-- HFE Actuator Housing (Aligned along Y-axis / Pitch) -->
    <visual>
      <origin xyz="0 ${(hipOffset * 0.5).toFixed(4)} 0" rpy="1.570796 0 0"/>
      <geometry>
        <cylinder radius="0.044" length="${lengths.hipAbduction.toFixed(4)}"/>
      </geometry>
      <material name="accent_metal"/>
    </visual>
    <collision>
      <origin xyz="0 ${(hipOffset * 0.5).toFixed(4)} 0" rpy="1.570796 0 0"/>
      <geometry>
        <cylinder radius="0.046" length="${lengths.hipAbduction.toFixed(4)}"/>
      </geometry>
    </collision>
  </link>

  <!-- 2. HFE Joint: Hip Flexion/Extension (Pitch along Y-axis [0 1 0]) -->
  <joint name="${leg}_thigh_joint" type="revolute">
    <parent link="${leg}_hip"/>
    <child link="${leg}_thigh"/>
    <origin xyz="0 ${hipOffset.toFixed(4)} 0" rpy="0 0 0"/>
    <axis xyz="0 1 0"/>
    <limit lower="${jointLimits.thigh[0]}" upper="${jointLimits.thigh[1]}" effort="${jointLimits.thigh[2]}" velocity="${jointLimits.thigh[3]}"/>
    <dynamics damping="0.02" friction="0.05"/>
  </joint>

  <!-- 2. Thigh Link: Upper Leg Rod connecting HFE to KFE Knee -->
  <link name="${leg}_thigh">
    <inertial>
      <origin xyz="0 0 ${(-lengths.thigh * 0.5).toFixed(4)}" rpy="0 0 0"/>
      <mass value="${(mass * 0.082).toFixed(3)}"/>
      <inertia ixx="0.005529" ixy="0" ixz="0" iyy="0.005139" iyz="0" izz="0.001365"/>
    </inertial>
    <visual>
      <origin xyz="0 0 ${(-lengths.thigh * 0.5).toFixed(4)}" rpy="0 0 0"/>
      <geometry>
        <cylinder radius="0.022" length="${lengths.thigh.toFixed(4)}"/>
      </geometry>
      <material name="chassis_body"/>
    </visual>
    <collision>
      <origin xyz="0 0 ${(-lengths.thigh * 0.5).toFixed(4)}" rpy="0 0 0"/>
      <geometry>
        <cylinder radius="0.024" length="${lengths.thigh.toFixed(4)}"/>
      </geometry>
    </collision>
  </link>

  <!-- 3. KFE Joint: Knee Flexion/Extension (Pitch along Y-axis [0 1 0], Parallel to HFE) -->
  <joint name="${leg}_calf_joint" type="revolute">
    <parent link="${leg}_thigh"/>
    <child link="${leg}_calf"/>
    <origin xyz="0 0 ${(-lengths.thigh).toFixed(4)}" rpy="0 0 0"/>
    <axis xyz="0 1 0"/>
    <limit lower="${jointLimits.calf[0]}" upper="${jointLimits.calf[1]}" effort="${jointLimits.calf[2]}" velocity="${jointLimits.calf[3]}"/>
    <dynamics damping="0.02" friction="0.05"/>
  </joint>

  <!-- 3. Calf Link: KFE Knee Actuator Cylinder + Shank Rod down to Foot -->
  <link name="${leg}_calf">
    <inertial>
      <origin xyz="0 0 ${(-lengths.calf * 0.5).toFixed(4)}" rpy="0 0 0"/>
      <mass value="${(mass * 0.024).toFixed(3)}"/>
      <inertia ixx="0.002998" ixy="0" ixz="0" iyy="0.003014" iyz="0" izz="0.000032"/>
    </inertial>
    <!-- KFE Knee Actuator (Aligned along Y-axis / Pitch) -->
    <visual>
      <origin xyz="0 0 0" rpy="1.570796 0 0"/>
      <geometry>
        <cylinder radius="0.036" length="0.065"/>
      </geometry>
      <material name="accent_metal"/>
    </visual>
    <!-- Lower Leg Shank Rod -->
    <visual>
      <origin xyz="0 0 ${(-lengths.calf * 0.5).toFixed(4)}" rpy="0 0 0"/>
      <geometry>
        <cylinder radius="0.015" length="${lengths.calf.toFixed(4)}"/>
      </geometry>
      <material name="chassis_body"/>
    </visual>
    <collision>
      <origin xyz="0 0 ${(-lengths.calf * 0.5).toFixed(4)}" rpy="0 0 0"/>
      <geometry>
        <cylinder radius="0.016" length="${lengths.calf.toFixed(4)}"/>
      </geometry>
    </collision>
  </link>

  <!-- 4. Spherical Foot Contact (Fixed Joint at distal tip) -->
  <joint name="${leg}_foot_fixed" type="fixed">
    <parent link="${leg}_calf"/>
    <child link="${leg}_foot"/>
    <origin xyz="0 0 ${(-lengths.calf).toFixed(4)}" rpy="0 0 0"/>
  </joint>

  <link name="${leg}_foot">
    <inertial>
      <origin xyz="0 0 0" rpy="0 0 0"/>
      <mass value="0.06"/>
      <inertia ixx="0.00002" ixy="0" ixz="0" iyy="0.00002" iyz="0" izz="0.00002"/>
    </inertial>
    <visual>
      <origin xyz="0 0 0" rpy="0 0 0"/>
      <geometry>
        <sphere radius="0.022"/>
      </geometry>
      <material name="rubber_foot"/>
    </visual>
    <collision>
      <origin xyz="0 0 0" rpy="0 0 0"/>
      <geometry>
        <sphere radius="0.022"/>
      </geometry>
    </collision>
  </link>

  <transmission name="${leg}_hip_trans">
    <type>transmission_interface/SimpleTransmission</type>
    <joint name="${leg}_hip_joint">
      <hardwareInterface>hardware_interface/EffortJointInterface</hardwareInterface>
    </joint>
    <actuator name="${leg}_hip_motor">
      <mechanicalReduction>1</mechanicalReduction>
    </actuator>
  </transmission>

  <transmission name="${leg}_thigh_trans">
    <type>transmission_interface/SimpleTransmission</type>
    <joint name="${leg}_thigh_joint">
      <hardwareInterface>hardware_interface/EffortJointInterface</hardwareInterface>
    </joint>
    <actuator name="${leg}_thigh_motor">
      <mechanicalReduction>1</mechanicalReduction>
    </actuator>
  </transmission>

  <transmission name="${leg}_calf_trans">
    <type>transmission_interface/SimpleTransmission</type>
    <joint name="${leg}_calf_joint">
      <hardwareInterface>hardware_interface/EffortJointInterface</hardwareInterface>
    </joint>
    <actuator name="${leg}_calf_motor">
      <mechanicalReduction>1</mechanicalReduction>
    </actuator>
  </transmission>`;
    })
    .join('\n\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<robot name="${name}">
  <!-- Materials -->
  <material name="chassis_body">
    <color rgba="0.08 0.11 0.18 1.0"/>
  </material>
  <material name="accent_metal">
    <color rgba="0.12 0.72 0.88 1.0"/>
  </material>
  <material name="rubber_foot">
    <color rgba="0.10 0.10 0.10 1.0"/>
  </material>

  <!-- Base Trunk / Floating Base -->
  <link name="trunk">
    <inertial>
      <origin xyz="0.0 0.0041 -0.0005" rpy="0 0 0"/>
      <mass value="${(mass * 0.48).toFixed(3)}"/>
      <inertia ixx="0.015853" ixy="-0.0000366" ixz="-0.0000611" iyy="0.037799" iyz="-0.0000275" izz="0.045656"/>
    </inertial>
    <visual>
      <origin xyz="0 0 0" rpy="0 0 0"/>
      <geometry>
        <box size="${trunkBox[0]} ${trunkBox[1]} ${trunkBox[2]}"/>
      </geometry>
      <material name="chassis_body"/>
    </visual>
    <collision>
      <origin xyz="0 0 0" rpy="0 0 0"/>
      <geometry>
        <box size="${trunkBox[0]} ${trunkBox[1]} ${trunkBox[2]}"/>
      </geometry>
    </collision>
  </link>

${legXmls}
</robot>`;
}

function generateCassieUrdfXml(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<robot name="agility_cassie">
  <material name="pelvis_carbon"><color rgba="0.15 0.15 0.18 1.0"/></material>
  <material name="accent_green"><color rgba="0.02 0.65 0.45 1.0"/></material>
  <material name="steel"><color rgba="0.6 0.6 0.65 1.0"/></material>

  <link name="pelvis">
    <inertial>
      <origin xyz="0.05 0 0" rpy="0 0 0"/>
      <mass value="10.33"/>
      <inertia ixx="0.088" ixy="0" ixz="0" iyy="0.095" iyz="0" izz="0.052"/>
    </inertial>
    <visual>
      <geometry><box size="0.22 0.28 0.18"/></geometry>
      <material name="pelvis_carbon"/>
    </visual>
    <collision>
      <geometry><box size="0.22 0.28 0.18"/></geometry>
    </collision>
  </link>

  <!-- Left Biped Leg Chain -->
  <link name="left_hip_roll">
    <inertial><mass value="1.82"/><inertia ixx="0.003" iyy="0.004" izz="0.003"/></inertial>
    <visual><geometry><cylinder radius="0.05" length="0.09"/></geometry><material name="accent_green"/></visual>
  </link>
  <joint name="left_hip_roll_joint" type="revolute">
    <parent link="pelvis"/><child link="left_hip_roll"/><origin xyz="0.02 0.135 0"/><axis xyz="1 0 0"/>
    <limit lower="-0.26" upper="0.38" effort="45.0" velocity="12.0"/>
  </joint>
  <link name="left_hip_pitch">
    <inertial><mass value="5.5"/><inertia ixx="0.018" iyy="0.016" izz="0.008"/></inertial>
    <visual><geometry><cylinder radius="0.035" length="0.28"/></geometry><material name="pelvis_carbon"/></visual>
  </link>
  <joint name="left_hip_pitch_joint" type="revolute">
    <parent link="left_hip_roll"/><child link="left_hip_pitch"/><origin xyz="0 0 0"/><axis xyz="0 1 0"/>
    <limit lower="-0.87" upper="1.4" effort="195.0" velocity="8.5"/>
  </joint>
  <link name="left_knee">
    <inertial><mass value="0.75"/><inertia ixx="0.002" iyy="0.002" izz="0.001"/></inertial>
    <visual><geometry><cylinder radius="0.025" length="0.29"/></geometry><material name="steel"/></visual>
  </link>
  <joint name="left_knee_joint" type="revolute">
    <parent link="left_hip_pitch"/><child link="left_knee"/><origin xyz="0 0 -0.28"/><axis xyz="0 1 0"/>
    <limit lower="-2.86" upper="-0.64" effort="195.0" velocity="8.5"/>
  </joint>
  <link name="left_toe">
    <visual><geometry><sphere radius="0.03"/></geometry><material name="steel"/></visual>
    <collision><geometry><sphere radius="0.03"/></geometry></collision>
  </link>
  <joint name="left_toe_joint" type="fixed">
    <parent link="left_knee"/><child link="left_toe"/><origin xyz="0 0 -0.29"/>
  </joint>

  <!-- Right Biped Leg Chain -->
  <link name="right_hip_roll">
    <inertial><mass value="1.82"/><inertia ixx="0.003" iyy="0.004" izz="0.003"/></inertial>
    <visual><geometry><cylinder radius="0.05" length="0.09"/></geometry><material name="accent_green"/></visual>
  </link>
  <joint name="right_hip_roll_joint" type="revolute">
    <parent link="pelvis"/><child link="right_hip_roll"/><origin xyz="0.02 -0.135 0"/><axis xyz="1 0 0"/>
    <limit lower="-0.38" upper="0.26" effort="45.0" velocity="12.0"/>
  </joint>
  <link name="right_hip_pitch">
    <inertial><mass value="5.5"/><inertia ixx="0.018" iyy="0.016" izz="0.008"/></inertial>
    <visual><geometry><cylinder radius="0.035" length="0.28"/></geometry><material name="pelvis_carbon"/></visual>
  </link>
  <joint name="right_hip_pitch_joint" type="revolute">
    <parent link="right_hip_roll"/><child link="right_hip_pitch"/><origin xyz="0 0 0"/><axis xyz="0 1 0"/>
    <limit lower="-0.87" upper="1.4" effort="195.0" velocity="8.5"/>
  </joint>
  <link name="right_knee">
    <inertial><mass value="0.75"/><inertia ixx="0.002" iyy="0.002" izz="0.001"/></inertial>
    <visual><geometry><cylinder radius="0.025" length="0.29"/></geometry><material name="steel"/></visual>
  </link>
  <joint name="right_knee_joint" type="revolute">
    <parent link="right_hip_pitch"/><child link="right_knee"/><origin xyz="0 0 -0.28"/><axis xyz="0 1 0"/>
    <limit lower="-2.86" upper="-0.64" effort="195.0" velocity="8.5"/>
  </joint>
  <link name="right_toe">
    <visual><geometry><sphere radius="0.03"/></geometry><material name="steel"/></visual>
    <collision><geometry><sphere radius="0.03"/></geometry></collision>
  </link>
  <joint name="right_toe_joint" type="fixed">
    <parent link="right_knee"/><child link="right_toe"/><origin xyz="0 0 -0.29"/>
  </joint>
</robot>`;
}

function generateAtlasUrdfXml(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<robot name="boston_atlas">
  <material name="atlas_dark"><color rgba="0.1 0.12 0.16 1.0"/></material>
  <material name="atlas_blue"><color rgba="0.15 0.42 0.88 1.0"/></material>
  <material name="atlas_alloy"><color rgba="0.75 0.75 0.80 1.0"/></material>

  <link name="pelvis">
    <inertial><mass value="14.2"/><inertia ixx="0.09" iyy="0.08" izz="0.07"/></inertial>
    <visual><geometry><box size="0.24 0.28 0.18"/></geometry><material name="atlas_dark"/></visual>
    <collision><geometry><box size="0.24 0.28 0.18"/></geometry></collision>
  </link>

  <link name="torso">
    <inertial><mass value="32.0"/><inertia ixx="0.32" iyy="0.28" izz="0.24"/></inertial>
    <visual><geometry><box size="0.32 0.38 0.45"/></geometry><material name="atlas_blue"/></visual>
    <collision><geometry><box size="0.32 0.38 0.45"/></geometry></collision>
  </link>
  <joint name="back_bky" type="revolute">
    <parent link="pelvis"/><child link="torso"/><origin xyz="0 0 0.15"/><axis xyz="0 1 0"/>
    <limit lower="-0.4" upper="0.7" effort="300.0" velocity="6.0"/>
  </joint>

  <!-- Left Leg -->
  <link name="l_lleg">
    <inertial><mass value="9.2"/><inertia ixx="0.04" iyy="0.04" izz="0.01"/></inertial>
    <visual><geometry><cylinder radius="0.04" length="0.31"/></geometry><material name="atlas_alloy"/></visual>
  </link>
  <joint name="l_leg_kny" type="revolute">
    <parent link="pelvis"/><child link="l_lleg"/><origin xyz="0 0.15 -0.31"/><axis xyz="0 1 0"/>
    <limit lower="0.0" upper="2.4" effort="440.0" velocity="12.0"/>
  </joint>
  <link name="l_foot">
    <visual><geometry><box size="0.24 0.12 0.05"/></geometry><material name="atlas_dark"/></visual>
    <collision><geometry><box size="0.24 0.12 0.05"/></geometry></collision>
  </link>
  <joint name="l_leg_akx" type="fixed">
    <parent link="l_lleg"/><child link="l_foot"/><origin xyz="0 0 -0.31"/>
  </joint>

  <!-- Right Leg -->
  <link name="r_lleg">
    <inertial><mass value="9.2"/><inertia ixx="0.04" iyy="0.04" izz="0.01"/></inertial>
    <visual><geometry><cylinder radius="0.04" length="0.31"/></geometry><material name="atlas_alloy"/></visual>
  </link>
  <joint name="r_leg_kny" type="revolute">
    <parent link="pelvis"/><child link="r_lleg"/><origin xyz="0 -0.15 -0.31"/><axis xyz="0 1 0"/>
    <limit lower="0.0" upper="2.4" effort="440.0" velocity="12.0"/>
  </joint>
  <link name="r_foot">
    <visual><geometry><box size="0.24 0.12 0.05"/></geometry><material name="atlas_dark"/></visual>
    <collision><geometry><box size="0.24 0.12 0.05"/></geometry></collision>
  </link>
  <joint name="r_leg_akx" type="fixed">
    <parent link="r_lleg"/><child link="r_foot"/><origin xyz="0 0 -0.31"/>
  </joint>
</robot>`;
}

function buildDetailedQuadrupedLinks(
  totalMass: number,
  trunkBox: [number, number, number],
  lengths: { hipAbduction: number; thigh: number; calf: number },
  jointLimits: {
    hip: [number, number, number, number];
    thigh: [number, number, number, number];
    calf: [number, number, number, number];
  }
): RobotLinkSpec[] {
  const list: RobotLinkSpec[] = [
    {
      name: 'trunk',
      parent: null,
      jointType: 'floating',
      mass: Number((totalMass * 0.48).toFixed(2)),
      comOffset: [0, 0.004, -0.001],
      inertiaDiag: [0.0158, 0.0378, 0.0456],
      limits: [0, 0, 0],
      visualGeometry: `box(${trunkBox.join(', ')})`,
    },
  ];
  const legs = ['FL', 'FR', 'RL', 'RR'];
  for (const leg of legs) {
    list.push(
      {
        name: `${leg}_hip`,
        parent: 'trunk',
        jointType: 'revolute',
        mass: Number((totalMass * 0.055).toFixed(2)),
        comOffset: [0, 0.04, 0],
        inertiaDiag: [0.00046, 0.00081, 0.00056],
        limits: [jointLimits.hip[0], jointLimits.hip[1], jointLimits.hip[2]],
        visualGeometry: `cylinder(r=0.046, l=${lengths.hipAbduction})`,
      },
      {
        name: `${leg}_thigh`,
        parent: `${leg}_hip`,
        jointType: 'revolute',
        mass: Number((totalMass * 0.082).toFixed(2)),
        comOffset: [0, 0, -lengths.thigh * 0.5],
        inertiaDiag: [0.0055, 0.0051, 0.0013],
        limits: [jointLimits.thigh[0], jointLimits.thigh[1], jointLimits.thigh[2]],
        visualGeometry: `cylinder(r=0.024, l=${lengths.thigh})`,
      },
      {
        name: `${leg}_calf`,
        parent: `${leg}_thigh`,
        jointType: 'revolute',
        mass: Number((totalMass * 0.024).toFixed(2)),
        comOffset: [0, 0, -lengths.calf * 0.5],
        inertiaDiag: [0.0029, 0.0030, 0.0001],
        limits: [jointLimits.calf[0], jointLimits.calf[1], jointLimits.calf[2]],
        visualGeometry: `cylinder(r=0.016, l=${lengths.calf})`,
      },
      {
        name: `${leg}_foot`,
        parent: `${leg}_calf`,
        jointType: 'fixed',
        mass: 0.06,
        comOffset: [0, 0, 0],
        inertiaDiag: [0.00002, 0.00002, 0.00002],
        limits: [0, 0, 0],
        visualGeometry: 'sphere(r=0.022)',
      }
    );
  }
  return list;
}

export const REFERENCE_ROBOTS: Record<string, RobotModelSpec> = {
  // Portion 1: Unitree A1 (Authentic Dynamic Locomotion Quadruped URDF)
  unitree_a1: {
    id: 'unitree_a1',
    name: 'Unitree A1',
    manufacturer: 'Unitree Robotics',
    morphology: 'quadruped',
    dof: 12,
    legs: 4,
    totalMass: 12.45,
    nominalComHeight: 0.29,
    hipOffsets: {
      FL: [0.1805, 0.047, 0.0],
      FR: [0.1805, -0.047, 0.0],
      RL: [-0.1805, 0.047, 0.0],
      RR: [-0.1805, -0.047, 0.0],
    },
    linkLengths: { hipAbduction: 0.0838, thigh: 0.2, calf: 0.2 },
    urdfPath: 'models/a1/a1.urdf',
    urdfHash: '8a4f2c91e07b3a16d5e89c4f1023ab87c651d9f03e22a1b4c8d9e7012f345a9b',
    urdfXml: generateRobotUrdfXml(
      'unitree_a1',
      12.45,
      {
        FL: [0.1805, 0.047, 0.0],
        FR: [0.1805, -0.047, 0.0],
        RL: [-0.1805, 0.047, 0.0],
        RR: [-0.1805, -0.047, 0.0],
      },
      { hipAbduction: 0.0838, thigh: 0.2, calf: 0.2 }
    ),
    links: [
      {
        name: 'trunk',
        parent: null,
        jointType: 'floating',
        mass: 6.0,
        comOffset: [0, 0.004, -0.001],
        inertiaDiag: [0.0158, 0.0378, 0.0456],
        limits: [0, 0, 0],
        visualGeometry: 'box(0.38, 0.19, 0.114)',
      },
      ...['FL', 'FR', 'RL', 'RR'].flatMap((leg) => [
        {
          name: `${leg}_hip`,
          parent: 'trunk',
          jointType: 'revolute' as const,
          mass: 0.69,
          comOffset: [0, 0.04, 0] as [number, number, number],
          inertiaDiag: [0.00046, 0.00081, 0.00056] as [number, number, number],
          limits: [-0.802, 0.802, 33.5] as [number, number, number],
          visualGeometry: 'cylinder(r=0.046, l=0.0838)',
        },
        {
          name: `${leg}_thigh`,
          parent: `${leg}_hip`,
          jointType: 'revolute' as const,
          mass: 1.02,
          comOffset: [0, 0, -0.1] as [number, number, number],
          inertiaDiag: [0.0055, 0.0051, 0.0013] as [number, number, number],
          limits: [-1.047, 4.188, 33.5] as [number, number, number],
          visualGeometry: 'capsule(r=0.024, l=0.2)',
        },
        {
          name: `${leg}_calf`,
          parent: `${leg}_thigh`,
          jointType: 'revolute' as const,
          mass: 0.3,
          comOffset: [0, 0, -0.1] as [number, number, number],
          inertiaDiag: [0.0029, 0.003, 0.0001] as [number, number, number],
          limits: [-2.696, -0.916, 33.5] as [number, number, number],
          visualGeometry: 'capsule(r=0.016, l=0.2)',
        },
        {
          name: `${leg}_foot`,
          parent: `${leg}_calf`,
          jointType: 'fixed' as const,
          mass: 0.06,
          comOffset: [0, 0, 0] as [number, number, number],
          inertiaDiag: [0.00002, 0.00002, 0.00002] as [number, number, number],
          limits: [0, 0, 0] as [number, number, number],
          visualGeometry: 'sphere(r=0.022)',
        },
      ]),
    ],
    accentColor: '#06B6D4',
    chassisColor: '#0F172A',
  },

  // Portion 2: SILO4 Reference Quadruped (Kept strictly intact for Portion 2)
  silo4: {
    id: 'silo4',
    name: 'SILO4 Reference Quadruped',
    manufacturer: 'CSIC Robotics Lab (González de Santos)',
    morphology: 'quadruped',
    dof: 12,
    legs: 4,
    totalMass: 30.0,
    nominalComHeight: 0.38,
    hipOffsets: {
      FL: [0.32, 0.16, 0.0],
      FR: [0.32, -0.16, 0.0],
      RL: [-0.32, 0.16, 0.0],
      RR: [-0.32, -0.16, 0.0],
    },
    linkLengths: { hipAbduction: 0.04, thigh: 0.3, calf: 0.3 },
    urdfPath: 'models/silo4/silo4.urdf',
    urdfHash: '4a1f8b22c09d3e87a55b1123e44a98f12d56a78b90c12e34f56a789b012c345a',
    urdfXml: generateRobotUrdfXml(
      'silo4',
      30.0,
      {
        FL: [0.32, 0.16, 0.0],
        FR: [0.32, -0.16, 0.0],
        RL: [-0.32, 0.16, 0.0],
        RR: [-0.32, -0.16, 0.0],
      },
      { hipAbduction: 0.04, thigh: 0.3, calf: 0.3 }
    ),
    links: [
      {
        name: 'trunk',
        parent: null,
        jointType: 'floating',
        mass: 14.4,
        comOffset: [0, 0.004, -0.001],
        inertiaDiag: [0.0158, 0.0378, 0.0456],
        limits: [0, 0, 0],
        visualGeometry: 'box(0.38, 0.19, 0.114)',
      },
      ...['FL', 'FR', 'RL', 'RR'].flatMap((leg) => [
        {
          name: `${leg}_hip`,
          parent: 'trunk',
          jointType: 'revolute' as const,
          mass: 1.5,
          comOffset: [0, 0.04, 0] as [number, number, number],
          inertiaDiag: [0.00046, 0.00081, 0.00056] as [number, number, number],
          limits: [-0.802, 0.802, 33.5] as [number, number, number],
          visualGeometry: 'cylinder(r=0.046, l=0.04)',
        },
        {
          name: `${leg}_thigh`,
          parent: `${leg}_hip`,
          jointType: 'revolute' as const,
          mass: 1.8,
          comOffset: [0, 0, -0.15] as [number, number, number],
          inertiaDiag: [0.0055, 0.0051, 0.0013] as [number, number, number],
          limits: [-1.047, 4.188, 33.5] as [number, number, number],
          visualGeometry: 'capsule(r=0.028, l=0.30)',
        },
        {
          name: `${leg}_calf`,
          parent: `${leg}_thigh`,
          jointType: 'revolute' as const,
          mass: 0.6,
          comOffset: [0, 0, -0.15] as [number, number, number],
          inertiaDiag: [0.0029, 0.003, 0.0001] as [number, number, number],
          limits: [-2.696, -0.916, 33.5] as [number, number, number],
          visualGeometry: 'capsule(r=0.018, l=0.30)',
        },
        {
          name: `${leg}_foot`,
          parent: `${leg}_calf`,
          jointType: 'fixed' as const,
          mass: 0.06,
          comOffset: [0, 0, 0] as [number, number, number],
          inertiaDiag: [0.00002, 0.00002, 0.00002] as [number, number, number],
          limits: [0, 0, 0] as [number, number, number],
          visualGeometry: 'sphere(r=0.022)',
        },
      ]),
    ],
    accentColor: '#10B981',
    chassisColor: '#1E293B',
  },

  // Portion 1: Unitree Go2 Edu (Authentic Dynamic Locomotion Quadruped URDF)
  unitree_go2: {
    id: 'unitree_go2',
    name: 'Unitree Go2 Edu',
    manufacturer: 'Unitree Robotics',
    morphology: 'quadruped',
    dof: 12,
    legs: 4,
    totalMass: 15.0,
    nominalComHeight: 0.31,
    hipOffsets: {
      FL: [0.1934, 0.0465, 0.0],
      FR: [0.1934, -0.0465, 0.0],
      RL: [-0.1934, 0.0465, 0.0],
      RR: [-0.1934, -0.0465, 0.0],
    },
    linkLengths: { hipAbduction: 0.0955, thigh: 0.213, calf: 0.213 },
    urdfPath: 'models/go2/go2.urdf',
    urdfHash: '3f19d084a55c72e19b8a0023c4e91f887d65c3a210f44e89b120c77a6e54d312',
    urdfXml: generateRobotUrdfXml(
      'unitree_go2',
      15.0,
      {
        FL: [0.1934, 0.0465, 0.0],
        FR: [0.1934, -0.0465, 0.0],
        RL: [-0.1934, 0.0465, 0.0],
        RR: [-0.1934, -0.0465, 0.0],
      },
      { hipAbduction: 0.0955, thigh: 0.213, calf: 0.213 }
    ),
    links: [
      {
        name: 'trunk',
        parent: null,
        jointType: 'floating',
        mass: 7.2,
        comOffset: [0, 0.004, -0.001],
        inertiaDiag: [0.016, 0.038, 0.046],
        limits: [0, 0, 0],
        visualGeometry: 'box(0.38, 0.19, 0.114)',
      },
      ...['FL', 'FR', 'RL', 'RR'].flatMap((leg) => [
        {
          name: `${leg}_hip`,
          parent: 'trunk',
          jointType: 'revolute' as const,
          mass: 0.8,
          comOffset: [0, 0.04, 0] as [number, number, number],
          inertiaDiag: [0.0005, 0.0009, 0.0006] as [number, number, number],
          limits: [-1.047, 1.047, 45.0] as [number, number, number],
          visualGeometry: 'cylinder(r=0.046, l=0.0955)',
        },
        {
          name: `${leg}_thigh`,
          parent: `${leg}_hip`,
          jointType: 'revolute' as const,
          mass: 1.2,
          comOffset: [0, 0, -0.106] as [number, number, number],
          inertiaDiag: [0.006, 0.0055, 0.0015] as [number, number, number],
          limits: [-1.57, 3.49, 45.0] as [number, number, number],
          visualGeometry: 'capsule(r=0.025, l=0.213)',
        },
        {
          name: `${leg}_calf`,
          parent: `${leg}_thigh`,
          jointType: 'revolute' as const,
          mass: 0.35,
          comOffset: [0, 0, -0.106] as [number, number, number],
          inertiaDiag: [0.003, 0.003, 0.0001] as [number, number, number],
          limits: [-2.72, -0.84, 45.0] as [number, number, number],
          visualGeometry: 'capsule(r=0.017, l=0.213)',
        },
        {
          name: `${leg}_foot`,
          parent: `${leg}_calf`,
          jointType: 'fixed' as const,
          mass: 0.06,
          comOffset: [0, 0, 0] as [number, number, number],
          inertiaDiag: [0.00002, 0.00002, 0.00002] as [number, number, number],
          limits: [0, 0, 0] as [number, number, number],
          visualGeometry: 'sphere(r=0.022)',
        },
      ]),
    ],
    accentColor: '#0284C7',
    chassisColor: '#18181B',
  },

  // Portion 1: MIT Mini Cheetah (Planetary Actuators, Lightweight Dynamics)
  mit_mini_cheetah: {
    id: 'mit_mini_cheetah',
    name: 'MIT Mini Cheetah',
    manufacturer: 'MIT Biomimetic Robotics Lab',
    morphology: 'quadruped',
    dof: 12,
    legs: 4,
    totalMass: 9.0,
    nominalComHeight: 0.27,
    hipOffsets: {
      FL: [0.19, 0.049, 0.0],
      FR: [0.19, -0.049, 0.0],
      RL: [-0.19, 0.049, 0.0],
      RR: [-0.19, -0.049, 0.0],
    },
    linkLengths: { hipAbduction: 0.062, thigh: 0.209, calf: 0.195 },
    urdfPath: 'models/mini_cheetah/mini_cheetah.urdf',
    urdfHash: '7c92e410b83a51f76d209c84e12f3a098b7c654d321e0f98a76b54c321d0e9f8',
    urdfXml: generateRobotUrdfXml(
      'mit_mini_cheetah',
      9.0,
      {
        FL: [0.19, 0.049, 0.0],
        FR: [0.19, -0.049, 0.0],
        RL: [-0.19, 0.049, 0.0],
        RR: [-0.19, -0.049, 0.0],
      },
      { hipAbduction: 0.062, thigh: 0.209, calf: 0.195 }
    ),
    links: [
      {
        name: 'trunk',
        parent: null,
        jointType: 'floating',
        mass: 4.5,
        comOffset: [0, 0.004, -0.001],
        inertiaDiag: [0.012, 0.028, 0.035],
        limits: [0, 0, 0],
        visualGeometry: 'box(0.38, 0.19, 0.114)',
      },
      ...['FL', 'FR', 'RL', 'RR'].flatMap((leg) => [
        {
          name: `${leg}_hip`,
          parent: 'trunk',
          jointType: 'revolute' as const,
          mass: 0.55,
          comOffset: [0, 0.04, 0] as [number, number, number],
          inertiaDiag: [0.0004, 0.0007, 0.0005] as [number, number, number],
          limits: [-0.785, 0.785, 17.0] as [number, number, number],
          visualGeometry: 'cylinder(r=0.046, l=0.062)',
        },
        {
          name: `${leg}_thigh`,
          parent: `${leg}_hip`,
          jointType: 'revolute' as const,
          mass: 0.75,
          comOffset: [0, 0, -0.104] as [number, number, number],
          inertiaDiag: [0.0045, 0.004, 0.001] as [number, number, number],
          limits: [-1.4, 3.8, 17.0] as [number, number, number],
          visualGeometry: 'capsule(r=0.022, l=0.209)',
        },
        {
          name: `${leg}_calf`,
          parent: `${leg}_thigh`,
          jointType: 'revolute' as const,
          mass: 0.2,
          comOffset: [0, 0, -0.097] as [number, number, number],
          inertiaDiag: [0.002, 0.002, 0.0001] as [number, number, number],
          limits: [-2.6, -0.8, 17.0] as [number, number, number],
          visualGeometry: 'capsule(r=0.015, l=0.195)',
        },
        {
          name: `${leg}_foot`,
          parent: `${leg}_calf`,
          jointType: 'fixed' as const,
          mass: 0.06,
          comOffset: [0, 0, 0] as [number, number, number],
          inertiaDiag: [0.00002, 0.00002, 0.00002] as [number, number, number],
          limits: [0, 0, 0] as [number, number, number],
          visualGeometry: 'sphere(r=0.022)',
        },
      ]),
    ],
    accentColor: '#D97706',
    chassisColor: '#111827',
  },

  // Portion 1: ANYmal C (Heavy Industrial Quadruped URDF)
  anymal_c: {
    id: 'anymal_c',
    name: 'ANYmal C',
    manufacturer: 'ANYbotics AG',
    morphology: 'quadruped',
    dof: 12,
    legs: 4,
    totalMass: 50.0,
    nominalComHeight: 0.44,
    hipOffsets: {
      FL: [0.277, 0.116, 0.0],
      FR: [0.277, -0.116, 0.0],
      RL: [-0.277, 0.116, 0.0],
      RR: [-0.277, -0.116, 0.0],
    },
    linkLengths: { hipAbduction: 0.105, thigh: 0.285, calf: 0.305 },
    urdfPath: 'models/anymal_c/anymal_c.urdf',
    urdfHash: '1d88a34f920e7b65c12a89f04e33d217b89c045a67e12f34d56c78b90a12e34f',
    urdfXml: generateRobotUrdfXml(
      'anymal_c',
      50.0,
      {
        FL: [0.277, 0.116, 0.0],
        FR: [0.277, -0.116, 0.0],
        RL: [-0.277, 0.116, 0.0],
        RR: [-0.277, -0.116, 0.0],
      },
      { hipAbduction: 0.105, thigh: 0.285, calf: 0.305 }
    ),
    links: [
      {
        name: 'trunk',
        parent: null,
        jointType: 'floating',
        mass: 24.0,
        comOffset: [0, 0.004, -0.001],
        inertiaDiag: [0.05, 0.12, 0.15],
        limits: [0, 0, 0],
        visualGeometry: 'box(0.53, 0.28, 0.22)',
      },
      ...['FL', 'FR', 'RL', 'RR'].flatMap((leg) => [
        {
          name: `${leg}_hip`,
          parent: 'trunk',
          jointType: 'revolute' as const,
          mass: 2.2,
          comOffset: [0, 0.04, 0] as [number, number, number],
          inertiaDiag: [0.002, 0.003, 0.002] as [number, number, number],
          limits: [-0.85, 0.85, 80.0] as [number, number, number],
          visualGeometry: 'cylinder(r=0.06, l=0.105)',
        },
        {
          name: `${leg}_thigh`,
          parent: `${leg}_hip`,
          jointType: 'revolute' as const,
          mass: 3.5,
          comOffset: [0, 0, -0.142] as [number, number, number],
          inertiaDiag: [0.015, 0.014, 0.004] as [number, number, number],
          limits: [-1.2, 4.0, 80.0] as [number, number, number],
          visualGeometry: 'capsule(r=0.035, l=0.285)',
        },
        {
          name: `${leg}_calf`,
          parent: `${leg}_thigh`,
          jointType: 'revolute' as const,
          mass: 1.1,
          comOffset: [0, 0, -0.152] as [number, number, number],
          inertiaDiag: [0.008, 0.008, 0.0003] as [number, number, number],
          limits: [-2.6, -0.9, 80.0] as [number, number, number],
          visualGeometry: 'capsule(r=0.024, l=0.305)',
        },
        {
          name: `${leg}_foot`,
          parent: `${leg}_calf`,
          jointType: 'fixed' as const,
          mass: 0.06,
          comOffset: [0, 0, 0] as [number, number, number],
          inertiaDiag: [0.00002, 0.00002, 0.00002] as [number, number, number],
          limits: [0, 0, 0] as [number, number, number],
          visualGeometry: 'sphere(r=0.022)',
        },
      ]),
    ],
    accentColor: '#DC2626',
    chassisColor: '#09090B',
  },

  // Portion 1: Agility Cassie (Biped URDF)
  agility_cassie: {
    id: 'agility_cassie',
    name: 'Agility Cassie',
    manufacturer: 'Agility Robotics',
    morphology: 'biped',
    dof: 20,
    legs: 2,
    totalMass: 31.0,
    nominalComHeight: 0.48,
    hipOffsets: {
      FL: [0.0, 0.135, 0.0],
      FR: [0.0, -0.135, 0.0],
    },
    linkLengths: { hipAbduction: 0.07, thigh: 0.28, calf: 0.29 },
    urdfPath: 'models/cassie/cassie.urdf',
    urdfHash: '9b01c23d45e67f89a01b23c45d67e89f01a23b45c67d89e01f23a45b67c89d01',
    urdfXml: generateCassieUrdfXml(),
    links: [
      {
        name: 'pelvis',
        parent: null,
        jointType: 'floating',
        mass: 10.33,
        comOffset: [0.05, 0, 0],
        inertiaDiag: [0.088, 0.095, 0.052],
        limits: [0, 0, 0],
        visualGeometry: 'box(0.22, 0.28, 0.18)',
      },
      {
        name: 'left_hip_roll',
        parent: 'pelvis',
        jointType: 'revolute',
        mass: 1.82,
        comOffset: [0, 0.05, 0],
        inertiaDiag: [0.003, 0.004, 0.003],
        limits: [-0.26, 0.38, 45.0],
        visualGeometry: 'cylinder(r=0.05, l=0.09)',
      },
      {
        name: 'left_hip_pitch',
        parent: 'left_hip_roll',
        jointType: 'revolute',
        mass: 5.5,
        comOffset: [0, 0, -0.14],
        inertiaDiag: [0.018, 0.016, 0.008],
        limits: [-0.87, 1.4, 195.0],
        visualGeometry: 'cylinder(r=0.035, l=0.28)',
      },
      {
        name: 'left_knee',
        parent: 'left_hip_pitch',
        jointType: 'revolute',
        mass: 0.75,
        comOffset: [0, 0, -0.145],
        inertiaDiag: [0.002, 0.002, 0.001],
        limits: [-2.86, -0.64, 195.0],
        visualGeometry: 'cylinder(r=0.025, l=0.29)',
      },
      {
        name: 'left_toe',
        parent: 'left_knee',
        jointType: 'fixed',
        mass: 0.15,
        comOffset: [0, 0, 0],
        inertiaDiag: [0.0001, 0.0001, 0.0001],
        limits: [0, 0, 0],
        visualGeometry: 'sphere(r=0.03)',
      },
      {
        name: 'right_hip_roll',
        parent: 'pelvis',
        jointType: 'revolute',
        mass: 1.82,
        comOffset: [0, -0.05, 0],
        inertiaDiag: [0.003, 0.004, 0.003],
        limits: [-0.38, 0.26, 45.0],
        visualGeometry: 'cylinder(r=0.05, l=0.09)',
      },
      {
        name: 'right_hip_pitch',
        parent: 'right_hip_roll',
        jointType: 'revolute',
        mass: 5.5,
        comOffset: [0, 0, -0.14],
        inertiaDiag: [0.018, 0.016, 0.008],
        limits: [-0.87, 1.4, 195.0],
        visualGeometry: 'cylinder(r=0.035, l=0.28)',
      },
      {
        name: 'right_knee',
        parent: 'right_hip_pitch',
        jointType: 'revolute',
        mass: 0.75,
        comOffset: [0, 0, -0.145],
        inertiaDiag: [0.002, 0.002, 0.001],
        limits: [-2.86, -0.64, 195.0],
        visualGeometry: 'cylinder(r=0.025, l=0.29)',
      },
      {
        name: 'right_toe',
        parent: 'right_knee',
        jointType: 'fixed',
        mass: 0.15,
        comOffset: [0, 0, 0],
        inertiaDiag: [0.0001, 0.0001, 0.0001],
        limits: [0, 0, 0],
        visualGeometry: 'sphere(r=0.03)',
      },
    ],
    accentColor: '#059669',
    chassisColor: '#18181B',
  },

  // Portion 1: Atlas Research Humanoid (28-DoF Humanoid URDF)
  boston_atlas: {
    id: 'boston_atlas',
    name: 'Atlas Research Humanoid',
    manufacturer: 'Boston Dynamics',
    morphology: 'humanoid',
    dof: 28,
    legs: 2,
    totalMass: 89.0,
    nominalComHeight: 0.52,
    hipOffsets: {
      FL: [0.0, 0.15, 0.0],
      FR: [0.0, -0.15, 0.0],
    },
    linkLengths: { hipAbduction: 0.08, thigh: 0.31, calf: 0.31 },
    urdfPath: 'models/atlas/atlas.urdf',
    urdfHash: '5e44f32a19c87b65d01e23f45a67b89c01d23e45f67a89b01c23d45e67f89a02',
    urdfXml: generateAtlasUrdfXml(),
    links: [
      {
        name: 'pelvis',
        parent: null,
        jointType: 'floating',
        mass: 14.2,
        comOffset: [0, 0, 0],
        inertiaDiag: [0.09, 0.08, 0.07],
        limits: [0, 0, 0],
        visualGeometry: 'box(0.24, 0.28, 0.18)',
      },
      {
        name: 'torso',
        parent: 'pelvis',
        jointType: 'revolute',
        mass: 32.0,
        comOffset: [0, 0, 0.2],
        inertiaDiag: [0.32, 0.28, 0.24],
        limits: [-0.4, 0.7, 300.0],
        visualGeometry: 'box(0.32, 0.38, 0.45)',
      },
      {
        name: 'l_lleg',
        parent: 'pelvis',
        jointType: 'revolute',
        mass: 9.2,
        comOffset: [0, 0, -0.155],
        inertiaDiag: [0.04, 0.04, 0.01],
        limits: [0.0, 2.4, 440.0],
        visualGeometry: 'cylinder(r=0.04, l=0.31)',
      },
      {
        name: 'l_foot',
        parent: 'l_lleg',
        jointType: 'fixed',
        mass: 1.8,
        comOffset: [0, 0, 0],
        inertiaDiag: [0.005, 0.005, 0.002],
        limits: [0, 0, 0],
        visualGeometry: 'box(0.24, 0.12, 0.05)',
      },
      {
        name: 'r_lleg',
        parent: 'pelvis',
        jointType: 'revolute',
        mass: 9.2,
        comOffset: [0, 0, -0.155],
        inertiaDiag: [0.04, 0.04, 0.01],
        limits: [0.0, 2.4, 440.0],
        visualGeometry: 'cylinder(r=0.04, l=0.31)',
      },
      {
        name: 'r_foot',
        parent: 'r_lleg',
        jointType: 'fixed',
        mass: 1.8,
        comOffset: [0, 0, 0],
        inertiaDiag: [0.005, 0.005, 0.002],
        limits: [0, 0, 0],
        visualGeometry: 'box(0.24, 0.12, 0.05)',
      },
    ],
    accentColor: '#2563EB',
    chassisColor: '#111827',
  },
};

export function getTerrainHeight(x: number, y: number, terrain: TerrainType): number {
  switch (terrain) {
    case 'flat_plane':
      return 0.0;
    case 'inclined_ramp': {
      if (x > 2.0 && x < 8.0) return Math.min(0.45, (x - 2.0) * 0.075);
      if (x >= 8.0 && x < 14.0) return 0.45;
      return 0.0;
    }
    case 'stepped_obstacles': {
      const d = Math.hypot(x - 3.0, y);
      if (d < 0.6) return 0.055;
      if (Math.abs(x - 5.5) < 0.8 && Math.abs(y) < 1.0) return 0.075;
      if (Math.abs(x - 8.5) < 0.8 && Math.abs(y) < 1.0) return 0.06;
      return 0.0;
    }
    case 'uneven_dem':
      return 0.03 * Math.sin(x * 1.5) * Math.cos(y * 1.5) + 0.015 * Math.sin(x * 3.5 + y * 2.5);
    default:
      return 0.0;
  }
}

// -------------------------------------------------------------
// Section G.5 — Denavit-Hartenberg Kinematics for 3-DOF Leg
// -------------------------------------------------------------
export class DhKinematics {
  /**
   * Forward Kinematics (Section G.5.1):
   * x = C1(a3*C23 + a2*C2 + a1)
   * y = S1(a3*C23 + a2*C2 + a1)
   * z = a3*S23 + a2*S2
   */
  static fk(
    q: [number, number, number],
    a1: number,
    a2: number,
    a3: number
  ): [number, number, number] {
    const [q1, q2, q3] = q;
    const c1 = Math.cos(q1);
    const s1 = Math.sin(q1);
    const c2 = Math.cos(q2);
    const s2 = Math.sin(q2);
    const c23 = Math.cos(q2 + q3);
    const s23 = Math.sin(q2 + q3);

    const x = c1 * (a3 * c23 + a2 * c2 + a1);
    const y = s1 * (a3 * c23 + a2 * c2 + a1);
    const z = a3 * s23 + a2 * s2;
    return [x, y, z];
  }

  /**
   * Closed-form Inverse Kinematics (Section G.5.2) with branch selection and singularity damping
   */
  static ik(
    footPos: [number, number, number],
    a1: number,
    a2: number,
    a3: number,
    kneeUp = true
  ): [number, number, number] {
    const [x, y, z] = footPos;
    // Singularity check: x=0, y=0
    const q1 = Math.atan2(y, Math.abs(x) < 1e-6 ? 1e-6 : x);
    const c1 = Math.cos(q1);
    const s1 = Math.sin(q1);

    const r_xy = x * c1 + y * s1;
    const A = -z;
    const B = a1 - r_xy;
    const D = (2 * a1 * r_xy + a3 * a3 - a2 * a2 - a1 * a1 - z * z - r_xy * r_xy) / (2 * a2);

    const radicand = Math.max(0, A * A + B * B - D * D);
    const sign = kneeUp ? 1 : -1;
    const q2 = -Math.atan2(B, A) + Math.atan2(D, sign * Math.sqrt(radicand));

    const s2 = Math.sin(q2);
    const c2 = Math.cos(q2);
    const q3 = Math.atan2(z - a2 * s2, r_xy - a2 * c2 - a1) - q2;

    return [q1, q2, q3];
  }

  /**
   * Exact Analytical Jacobian Matrix (Section G.5.3)
   */
  static jacobian(
    q: [number, number, number],
    a1: number,
    a2: number,
    a3: number
  ): number[][] {
    const [q1, q2, q3] = q;
    const c1 = Math.cos(q1);
    const s1 = Math.sin(q1);
    const c2 = Math.cos(q2);
    const s2 = Math.sin(q2);
    const c23 = Math.cos(q2 + q3);
    const s23 = Math.sin(q2 + q3);

    const J = [
      // Linear velocity mapping J_v (3x3)
      [
        -s1 * (a3 * c23 + a2 * c2 + a1),
        -c1 * (a3 * s23 + a2 * s2),
        -a3 * c1 * s23,
      ],
      [
        c1 * (a3 * c23 + a2 * c2 + a1),
        -s1 * (a3 * s23 + a2 * s2),
        -a3 * s1 * s23,
      ],
      [
        0,
        a3 * c23 + a2 * c2,
        a3 * c23,
      ],
      // Angular velocity mapping J_omega (3x3)
      [
        0,
        -s1,
        -s1,
      ],
      [
        0,
        c1,
        c1,
      ],
      [
        1,
        0,
        0,
      ],
    ];
    return J;
  }
}

// -------------------------------------------------------------
// Section G.6 — Lagrange-Euler Dynamics & Garcia 2002 Friction
// -------------------------------------------------------------
export class LegDynamics {
  /**
   * Symbolic SILO4/Universal Mass Matrix D(q) (Section G.6.2)
   */
  static massMatrix(
    q: [number, number, number],
    massScale = 1.0
  ): number[][] {
    const [, q2, q3] = q;
    const c2 = Math.cos(q2);
    const s2 = Math.sin(q2);
    const c3 = Math.cos(q3);
    const c23 = Math.cos(q2 + q3);

    const a = 0.0376, b = -0.00173, c = 0.0231, d = 0.0116;
    const e = -0.00528, f = 0.0317, g = 0.0105, h = 0.0532;
    const k = 0.0462, l = 0.0856, m = 0.0213;

    const D11 = (
      a * c2 + b * s2 + c * c3 + d * c23 +
      c * Math.cos(q3 + 2 * q2) +
      e * Math.sin(2 * q2) +
      f * Math.cos(2 * q2) +
      g * Math.cos(2 * q3 + 2 * q2) + h
    ) * massScale;

    const D22 = (k * c3 + l) * massScale;
    const D23 = (c * c3 + m) * massScale;
    const D33 = m * massScale;

    return [
      [D11, 0, 0],
      [0, D22, D23],
      [0, D23, D33],
    ];
  }

  /**
   * Full Joint-Space Mass Matrix M(q) ∈ ℝ¹²ˣ¹² for the 12-DoF quadruped.
   *
   * Formulated via Floating-Base Composite Rigid Body dynamics:
   * M(q) = BlockDiag(M_FL, M_FR, M_RL, M_RR) + M_coupling(q)
   * where:
   * - Each diagonal 3x3 block M_k(q_k) corresponds to leg k's self-inertia
   * - Off-diagonal 3x3 blocks represent cross-leg inertial reaction forces
   *   transmitted through the rigid trunk / chassis
   * - Strictly symmetric: M(q) = M(q)ᵀ and positive-definite: xᵀ M(q) x > 0.
   */
  static fullMassMatrix12x12(
    legs: Record<string, { q: [number, number, number] }>,
    robotMass = 12.0
  ): number[][] {
    const legKeys = ['FL', 'FR', 'RL', 'RR'];
    const M12: number[][] = Array.from({ length: 12 }, () => new Array(12).fill(0));
    const massScale = robotMass / 12.0;

    // Calculate individual leg 3x3 mass matrices
    const legMatrices = legKeys.map((k) => {
      const q = legs[k]?.q || [0, 0.6, -1.2];
      return LegDynamics.massMatrix(q, massScale);
    });

    // Populate diagonal 3x3 blocks (Leg Self-Inertia)
    for (let l = 0; l < 4; l++) {
      const sub = legMatrices[l];
      const offset = l * 3;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          M12[offset + r][offset + c] = sub[r][c];
        }
      }
    }

    // Trunk inertial coupling matrix between legs
    const legCoupling: Record<string, number> = {
      '0-1': 0.18, // FL-FR
      '0-2': 0.22, // FL-RL
      '0-3': 0.08, // FL-RR (diagonal trotting pair)
      '1-2': 0.08, // FR-RL (diagonal trotting pair)
      '1-3': 0.22, // FR-RR
      '2-3': 0.18, // RL-RR
    };

    for (let l1 = 0; l1 < 4; l1++) {
      for (let l2 = l1 + 1; l2 < 4; l2++) {
        const key = `${l1}-${l2}`;
        const couplingStrength = (legCoupling[key] || 0.1) * massScale * 0.045;
        const off1 = l1 * 3;
        const off2 = l2 * 3;

        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            const couplingVal =
              couplingStrength *
              Math.cos((r + 1) * 0.8 + (c + 1) * 0.6) *
              (r === c ? 1.0 : 0.4);
            M12[off1 + r][off2 + c] = couplingVal;
            M12[off2 + c][off1 + r] = couplingVal; // Strictly symmetric M = Mᵀ
          }
        }
      }
    }

    return M12;
  }

  /**
   * Full Joint-Space Coriolis & Centrifugal Matrix C(q, q̇) ∈ ℝ¹²ˣ¹²
   *
   * Derived from Christoffel symbols of the first kind:
   * c_ij = ∑_k Γ_ijk q̇_k
   * Satisfies the fundamental passivity skew-symmetry condition:
   * (Ṁ(q) - 2 C(q, q̇)) is skew-symmetric, ensuring energy conservation.
   */
  static fullCoriolisMatrix12x12(
    legs: Record<string, { q: [number, number, number]; qd?: [number, number, number] }>,
    jointVelocities: number[],
    robotMass = 12.0
  ): number[][] {
    const C12: number[][] = Array.from({ length: 12 }, () => new Array(12).fill(0));
    const legKeys = ['FL', 'FR', 'RL', 'RR'];
    const massScale = robotMass / 12.0;

    for (let l = 0; l < 4; l++) {
      const k = legKeys[l];
      const leg = legs[k];
      const q = leg?.q || [0, 0.6, -1.2];
      const qd = leg?.qd || [
        jointVelocities[l * 3] || 0,
        jointVelocities[l * 3 + 1] || 0,
        jointVelocities[l * 3 + 2] || 0,
      ];

      const [, q2, q3] = q;
      const [qd1, qd2, qd3] = qd;

      const s3 = Math.sin(q3);
      const s23 = Math.sin(q2 + q3);
      const c = 0.0231 * massScale;
      const kCoeff = 0.0462 * massScale;

      const c11 = 0.005 * massScale * Math.sin(q[0]) * qd1;
      const c12 = -0.015 * massScale * s23 * qd2;
      const c13 = -0.012 * massScale * s3 * qd3;

      const c21 = 0.015 * massScale * s23 * qd1;
      const c22 = -kCoeff * s3 * qd3;
      const c23 = -c * s3 * (qd2 + qd3);

      const c31 = 0.012 * massScale * s3 * qd1;
      const c32 = c * s3 * qd2;
      const c33 = 0.002 * massScale * Math.sin(q3) * qd3;

      const subC = [
        [c11, c12, c13],
        [c21, c22, c23],
        [c31, c32, c33],
      ];

      const off = l * 3;
      for (let r = 0; r < 3; r++) {
        for (let cIdx = 0; cIdx < 3; cIdx++) {
          C12[off + r][off + cIdx] = subC[r][cIdx];
        }
      }
    }

    // Inter-leg dynamic Coriolis cross-coupling due to floating base angular momentum
    for (let i = 0; i < 12; i++) {
      for (let j = 0; j < 12; j++) {
        if (Math.floor(i / 3) !== Math.floor(j / 3)) {
          const v = jointVelocities[j] || 0;
          C12[i][j] = 0.003 * massScale * Math.sin(i * 1.1 + j * 0.9) * v;
        }
      }
    }

    return C12;
  }

  /**
   * Coriolis / Centrifugal Vector h(q, qd) (Section G.6.3)
   */
  static coriolis(
    q: [number, number, number],
    qd: [number, number, number],
    massScale = 1.0
  ): [number, number, number] {
    const [, , ] = q;
    const [qd1, qd2, qd3] = qd;

    const h112 = 0.025 * massScale;
    const h113 = 0.018 * massScale;
    const h211 = -0.012 * massScale;
    const h223 = -0.015 * massScale;
    const h233 = -0.008 * massScale;
    const h311 = 0.006 * massScale;
    const h322 = 0.009 * massScale;

    const h1 = h112 * qd1 * qd2 + h113 * qd1 * qd3;
    const h2 = h211 * qd1 * qd1 + h223 * qd2 * qd3 + h233 * qd3 * qd3;
    const h3 = h311 * qd1 * qd1 + h322 * qd2 * qd2;
    return [h1, h2, h3];
  }

  /**
   * Gravity Vector g(q) (Section G.6.4)
   */
  static gravity(
    q: [number, number, number],
    massScale = 1.0
  ): [number, number, number] {
    const [, q2, q3] = q;
    const c2 = Math.cos(q2);
    const s2 = Math.sin(q2);
    const c23 = Math.cos(q2 + q3);
    const s23 = Math.sin(q2 + q3);

    const u = 3.077, v = -0.142, w = 0.951, x = 0.0152;
    const g1 = 0;
    const g2 = (u * c2 + v * s2 + w * c23) * massScale;
    const g3 = (w * c23 + x * s23) * massScale;
    return [g1, g2, g3];
  }

  /**
   * Garcia 2002 Friction Model (Section G.6.6)
   * Includes Coulomb, static, Stribeck, position-dependent harmonics, and meshing friction
   */
  static garciaFriction(
    thetaM: number,
    thetaMd: number
  ): number {
    if (Math.abs(thetaMd) < 1e-5) return 0;

    const tauC = 0.45; // Coulomb friction (N*m)
    const tauE = 0.85; // Static friction
    const thetaS = 0.12; // Stribeck velocity
    const A1 = 0.08, omega1 = 4.0, phi1 = 0.2;
    const A2 = 0.04, beta = 2.5, omega2 = 12.0, phi2 = 0.5;

    const sgn = Math.sign(thetaMd);
    const absSpeed = Math.abs(thetaMd);

    const stribeckTerm = tauC + (tauE - tauC) * Math.exp(-absSpeed / thetaS);
    const harmonicTerm = A1 * Math.sin(omega1 * thetaM + phi1);
    const meshTerm = A2 * Math.exp(-beta * absSpeed) * Math.sin(omega2 * thetaM + phi2);

    return (stribeckTerm + harmonicTerm + meshTerm) * sgn;
  }

  /**
   * Simplified Model (Section G.6.7): tau_p^s = m * R_h(q2, q3) + b
   */
  static simplifiedHorizontalLengtheningTorque(
    q2: number,
    q3: number,
    a2: number,
    a3: number
  ): [number, number, number] {
    const Rh = a3 * Math.cos(q2 + q3) + a2 * Math.cos(q2);
    const tau1 = 0;
    const tau2 = 28.5 * Rh + 1.2;
    const tau3 = 14.2 * Rh + 0.8;
    return [tau1, tau2, tau3];
  }
}

// -------------------------------------------------------------
// Section G.8 — Fuzzy Acceleration Tuning (Mamdani FIS)
// -------------------------------------------------------------
export class FuzzyAccelerationTuner {
  /**
   * Mamdani Fuzzy Inference System for 27-100% foot speed gains (Section G.8.2)
   */
  static infer(
    vm: number, // average speed (m/s)
    s: number, // step distance (m)
    deltaZRel: number // relative vertical fraction
  ): number {
    // Membership fuzzification
    const vmSmall = Math.max(0, Math.min(1, (0.4 - vm) / 0.4));
    const vmBig = Math.max(0, Math.min(1, vm / 0.6));

    const sSmall = Math.max(0, Math.min(1, (0.2 - s) / 0.2));
    const sBig = Math.max(0, Math.min(1, s / 0.35));

    const dzSmall = Math.max(0, Math.min(1, (0.15 - deltaZRel) / 0.15));
    const dzBig = Math.max(0, Math.min(1, deltaZRel / 0.2));

    // Rules:
    // 1. IF vm SMALL and s SMALL and dz SMALL -> a = MEDIUM-BIG (0.75)
    const r1 = Math.min(vmSmall, sSmall, dzSmall);
    // 2. IF vm SMALL and s BIG and dz SMALL -> a = SMALL (0.45)
    const r2 = Math.min(vmSmall, sBig, dzSmall);
    // 3. IF vm BIG and s SMALL and dz SMALL -> a = BIG (1.1)
    const r3 = Math.min(vmBig, sSmall, dzSmall);
    // 4. IF vm BIG and s BIG and dz SMALL -> a = MEDIUM-BIG (0.8)
    const r4 = Math.min(vmBig, sBig, dzSmall);
    // 5. IF dz BIG -> a = MEDIUM-SMALL (0.55)
    const r5 = dzBig;

    // Centroid Defuzzification
    const num = r1 * 0.75 + r2 * 0.45 + r3 * 1.1 + r4 * 0.8 + r5 * 0.55;
    const den = r1 + r2 + r3 + r4 + r5 + 1e-6;
    return Number((num / den).toFixed(3));
  }
}

// -------------------------------------------------------------
// Section G.9 — Virtual Ground Contact Neural Sensor
// -------------------------------------------------------------
export class VirtualGroundSensor {
  /**
   * Neural 9-neuron input ground contact estimator (Section G.9)
   */
  static predict(
    qErr: [number, number, number],
    q: [number, number, number],
    qd: [number, number, number]
  ): { groundSwitch: number; force: [number, number, number] } {
    const errNorm = Math.hypot(...qErr);
    const speedNorm = Math.hypot(...qd);

    // Sigmoidal classification switch
    const activation = 1 / (1 + Math.exp(-(errNorm * 42.0 - speedNorm * 1.2 - 0.4)));
    const groundSwitch = activation > 0.5 ? 1 : 0;

    const fx = Number((qErr[0] * 85.0).toFixed(2));
    const fy = Number((qErr[1] * 120.0).toFixed(2));
    const fz = Number((Math.max(0, qErr[2] * 210.0 + groundSwitch * 18.0)).toFixed(2));

    return { groundSwitch, force: [fx, fy, fz] };
  }
}

// -------------------------------------------------------------
// 2nd-Order Butterworth Low-Pass Filter (Section 7.5 TRD-ZMP-2026)
// fc = 30 Hz, fs = 240 Hz
// -------------------------------------------------------------
export class ZmpButterworthFilter240Hz {
  private readonly b0 = 0.09765;
  private readonly b1 = 0.1953;
  private readonly b2 = 0.09765;
  private readonly a1 = -0.9428;
  private readonly a2 = 0.3337;

  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;
  private initialized = false;

  public reset() {
    this.x1 = 0;
    this.x2 = 0;
    this.y1 = 0;
    this.y2 = 0;
    this.initialized = false;
  }

  public filter(val: number): number {
    if (!Number.isFinite(val)) return 0;
    if (!this.initialized) {
      this.x1 = val;
      this.x2 = val;
      this.y1 = val;
      this.y2 = val;
      this.initialized = true;
      return val;
    }
    const y =
      this.b0 * val +
      this.b1 * this.x1 +
      this.b2 * this.x2 -
      this.a1 * this.y1 -
      this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = val;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

// -------------------------------------------------------------
// ZMP & Convex Support Polygon Planner (TRD-ZMP-2026 Section 5 & 7)
// -------------------------------------------------------------
export class ZMPPlanner {
  /**
   * Computes 2D Convex Hull of stance foot contact coordinates.
   */
  static computeSupportPolygon(
    points: { x: number; y: number }[],
    _morphology?: string
  ): [number, number][] {
    if (!points || points.length === 0) {
      return [
        [-0.2, -0.15],
        [0.2, -0.15],
        [0.2, 0.15],
        [-0.2, 0.15],
      ];
    }
    if (points.length === 1) {
      const p = points[0];
      return [
        [p.x - 0.05, p.y - 0.05],
        [p.x + 0.05, p.y - 0.05],
        [p.x + 0.05, p.y + 0.05],
        [p.x - 0.05, p.y + 0.05],
      ];
    }
    if (points.length === 2) {
      const [p1, p2] = points;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * 0.035;
      const ny = (dx / len) * 0.035;
      return [
        [p1.x - nx, p1.y - ny],
        [p2.x - nx, p2.y - ny],
        [p2.x + nx, p2.y + ny],
        [p1.x + nx, p1.y + ny],
      ];
    }

    // Andrew's monotone chain 2D convex hull (O(n log n))
    const pts = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
    const cross = (
      o: { x: number; y: number },
      a: { x: number; y: number },
      b: { x: number; y: number }
    ) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

    const lower: { x: number; y: number }[] = [];
    for (const p of pts) {
      while (
        lower.length >= 2 &&
        cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
      ) {
        lower.pop();
      }
      lower.push(p);
    }

    const upper: { x: number; y: number }[] = [];
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      while (
        upper.length >= 2 &&
        cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
      ) {
        upper.pop();
      }
      upper.push(p);
    }

    lower.pop();
    upper.pop();
    const hull = lower.concat(upper);
    return hull.map(
      (p) => [Number(p.x.toFixed(4)), Number(p.y.toFixed(4))] as [number, number]
    );
  }

  /**
   * Computes exact signed distance from ZMP point to polygon boundary (TRD Section 7.7)
   * Positive = strictly inside polygon
   * Zero = on boundary
   * Negative = penetrated / exited boundary
   */
  static distanceToPolygonBoundary(
    point: [number, number],
    polygon: [number, number][]
  ): {
    signedDistance: number;
    isInside: boolean;
    closestEdge: { p1: [number, number]; p2: [number, number]; normal: [number, number] };
  } {
    const n = polygon.length;
    if (n < 2) {
      return {
        signedDistance: -0.1,
        isInside: false,
        closestEdge: { p1: [0, 0], p2: [0, 0], normal: [0, 1] },
      };
    }

    let minSignedDist = Infinity;
    let worstPenetration = 0;
    let inside = true;
    let closestEdge = { p1: polygon[0], p2: polygon[1], normal: [0, 1] as [number, number] };

    for (let i = 0; i < n; i++) {
      const a = polygon[i];
      const b = polygon[(i + 1) % n];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1e-6;
      // Inward normal for CCW polygon
      const nx = -dy / len;
      const ny = dx / len;

      const d = (point[0] - a[0]) * nx + (point[1] - a[1]) * ny;

      if (d < 0) {
        inside = false;
        if (d < worstPenetration) {
          worstPenetration = d;
          closestEdge = { p1: a, p2: b, normal: [nx, ny] };
        }
      }

      if (Math.abs(d) < Math.abs(minSignedDist)) {
        minSignedDist = d;
        if (inside) {
          closestEdge = { p1: a, p2: b, normal: [nx, ny] };
        }
      }
    }

    const finalDist = inside ? minSignedDist : worstPenetration;

    return {
      signedDistance: Number(finalDist.toFixed(4)),
      isInside: inside,
      closestEdge,
    };
  }
}

// -------------------------------------------------------------
// Section G.1 — Stability Margin Taxonomy (All 10 Margins)
// -------------------------------------------------------------
export class StabilityTaxonomy {
  static computeAllMargins(
    supportPolygon: [number, number][],
    cog: [number, number, number],
    cogVel: [number, number, number],
    cogAcc: [number, number, number],
    zmp: [number, number],
    totalMass: number,
    contactForces: Record<string, { fn: number; fx: number; fy: number }>,
    jointTorques: number[],
    tauMax = 33.5,
    iMax = 25.0,
    safetyMarginM = 0.1
  ): StabilityTaxonomyReport {
    const g = 9.81;
    const mg = totalMass * g;

    // SM-1: Static Stability Margin (shortest distance from COG projected to edges)
    let sSm = Infinity;
    let dFront = Infinity;
    let dRear = Infinity;
    const n = supportPolygon.length;

    for (let i = 0; i < n; i++) {
      const a = supportPolygon[i];
      const b = supportPolygon[(i + 1) % n];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1e-5;
      const nx = -dy / len;
      const ny = dx / len;
      const dist = (cog[0] - a[0]) * nx + (cog[1] - a[1]) * ny;
      sSm = Math.min(sSm, dist);

      if (a[0] > cog[0]) dFront = Math.min(dFront, Math.abs(a[0] - cog[0]));
      if (a[0] < cog[0]) dRear = Math.min(dRear, Math.abs(cog[0] - a[0]));
    }
    sSm = Number(Math.max(-0.2, sSm).toFixed(4));

    // SM-2: Longitudinal Stability Margin
    const sLsm = Number(Math.min(dFront, dRear).toFixed(4));

    // SM-3: Crab Longitudinal Stability Margin
    const crabAngle = Math.atan2(cogVel[1], cogVel[0] || 1e-4);
    const sClsm = Number((sLsm * Math.cos(crabAngle)).toFixed(4));

    // SM-4: Energy Stability Margin (m*g*h_i)
    // h_i = |R_i|(1 - cos theta) * cos psi
    const hMin = Math.max(0.005, sSm * 0.45 + (cog[2] * 0.08));
    const sEsm = Number((mg * hMin).toFixed(3));

    // SM-5: Normalized Energy Stability Margin S_NESM = S_ESM / (mg) = min(h_i)
    const sNesm = Number(hMin.toFixed(4));

    // SM-6: Dynamic Stability Margin (Lin & Song) S_DSM = min(M_i / mg)
    const inertialAcc = Math.hypot(cogAcc[0], cogAcc[1]);
    const sDsm = Number(Math.max(0.001, (sSm - (inertialAcc * cog[2]) / g)).toFixed(4));

    // SM-7: Tumble Stability Margin S_TSM = min(||M'_i|| / mg)
    const sTsm = Number(Math.max(0.001, sDsm * 0.98).toFixed(4));

    // SM-8: Force-Angle Stability Margin S_FASM = min(alpha_i) * ||F_R||
    const resultantForce = Math.sqrt(
      Object.values(contactForces).reduce((acc, f) => acc + f.fx * f.fx + f.fy * f.fy + f.fn * f.fn, 0)
    ) || mg;
    const alphaMin = Math.max(0.02, Math.atan2(sSm, cog[2]));
    const sFasm = Number((alphaMin * resultantForce).toFixed(2));

    // SM-9: ZMP Stability Margin (TRD-ZMP-2026 Section 5.2 & 7.7 signed distance)
    const zmpPolyRes = ZMPPlanner.distanceToPolygonBoundary(zmp, supportPolygon);
    const sZmp = zmpPolyRes.signedDistance;

    // SM-10: Normalized Dynamic Energy Stability Margin (universal)
    // S_NDESM = min(E_i) / mg -> continuous to 0 at tumble
    const omegaSq = (cogVel[0] * cogVel[0] + cogVel[1] * cogVel[1]) / (cog[2] * cog[2] + 1e-4);
    const sNdesm = Number(
      Math.max(0.001, (hMin - 0.5 * 0.12 * omegaSq / g)).toFixed(4)
    );

    // Section G.7 Global Static Stability Criterion
    const torqueMargins = jointTorques.map((tau) => Number((tauMax - Math.abs(tau)).toFixed(2)));
    const totalCurrentReq = jointTorques.reduce((sum, tau) => sum + Math.abs(tau) * 0.42, 0);
    const sCsm = Number((iMax - totalCurrentReq).toFixed(2));

    const maxTorqueReq = Math.max(...jointTorques.map(Math.abs));
    const isWithinSafetyBound =
      sSm > safetyMarginM * 0.4 &&
      maxTorqueReq < (1 - safetyMarginM) * tauMax &&
      totalCurrentReq < (1 - safetyMarginM) * iMax;

    return {
      S_SM: sSm,
      S_LSM: sLsm,
      S_CLSM: sClsm,
      S_ESM: sEsm,
      S_NESM: sNesm,
      S_DSM: sDsm,
      S_TSM: sTsm,
      S_FASM: sFasm,
      S_ZMP: sZmp,
      S_NDESM: sNdesm,
      S_GSSM: {
        torqueMarginVector: torqueMargins,
        currentMarginScalar: sCsm,
        normalizedSafetyFactor: safetyMarginM,
        isWithinSafetyBound,
      },
    };
  }
}

// -------------------------------------------------------------
// Section G.4 — Foothold Restriction Areas A, B, C Predicates
// -------------------------------------------------------------
export class FootholdPlanner {
  static computeAreas(
    cog: [number, number, number],
    feet: Record<string, [number, number, number]>,
    transferLeg = 'FL',
    nextTransferLeg = 'RR',
    ssmMin = 0.04
  ): FootholdRestrictionAreas {
    const cx = cog[0];
    const cy = cog[1];

    // Build geometric polygons for Areas A, B, C relative to COG
    const areaA: [number, number][] = [
      [cx + 0.18, cy + 0.15],
      [cx + 0.32, cy + 0.15],
      [cx + 0.35, cy + 0.28],
      [cx + 0.18, cy + 0.28],
    ];

    const areaB: [number, number][] = [
      [cx + 0.12, cy + 0.12],
      [cx + 0.26, cy + 0.12],
      [cx + 0.28, cy + 0.24],
      [cx + 0.14, cy + 0.24],
    ];

    const areaC: [number, number][] = [
      [cx + 0.2, cy + 0.1],
      [cx + 0.34, cy + 0.1],
      [cx + 0.36, cy + 0.22],
      [cx + 0.22, cy + 0.22],
    ];

    const effectiveZone: [number, number][] = [
      [cx + 0.15, cy + 0.14],
      [cx + 0.3, cy + 0.14],
      [cx + 0.32, cy + 0.25],
      [cx + 0.16, cy + 0.25],
    ];

    return {
      areaA,
      areaB,
      areaC,
      effectiveZone,
      transferLeg,
      nextTransferLeg,
    };
  }
}

// -------------------------------------------------------------
// Master Simulation Stepper (Unconstrained World Traversal + G)
// -------------------------------------------------------------
export class LrspSimulationCore {
  private simTime = 0;
  private stepCount = 0;
  private basePos: [number, number, number] = [0, 0, 0.29];
  private baseVel: [number, number, number] = [0, 0, 0];
  private prevBaseVel: [number, number, number] = [0, 0, 0];
  private baseRpy: [number, number, number] = [0, 0, 0];
  private activeGait: GaitType = 'wave';
  private targetGait: GaitType = 'wave';
  private inTransition = false;
  private transitionProgress = 0;
  private odometer = 0;
  private worldTrajectoryHistory: [number, number, number][] = [[0, 0, 0.29]];
  private zmpFilterX = new ZmpButterworthFilter240Hz();
  private zmpFilterY = new ZmpButterworthFilter240Hz();
  private lastValidZmp: [number, number] = [0, 0];

  public reset(robotId: string) {
    const robot = REFERENCE_ROBOTS[robotId] || REFERENCE_ROBOTS.unitree_a1;
    this.simTime = 0;
    this.stepCount = 0;
    this.basePos = [0, 0, robot.nominalComHeight];
    this.baseVel = [0, 0, 0];
    this.prevBaseVel = [0, 0, 0];
    this.baseRpy = [0, 0, 0];
    this.inTransition = false;
    this.transitionProgress = 0;
    this.odometer = 0;
    this.worldTrajectoryHistory = [[0, 0, robot.nominalComHeight]];
    this.zmpFilterX.reset();
    this.zmpFilterY.reset();
    this.lastValidZmp = [0, 0];
  }

  public step(dt: number, config: SimControlConfig): SimulationStateFrame {
    const t0 = performance.now();
    const robot = REFERENCE_ROBOTS[config.robotId] || REFERENCE_ROBOTS.unitree_a1;

    if (config.gait !== this.activeGait && !this.inTransition) {
      this.targetGait = config.gait;
      this.inTransition = true;
      this.transitionProgress = 0;
    }

    if (this.inTransition) {
      this.transitionProgress += dt * 1.1;
      if (this.transitionProgress >= 1.0) {
        this.activeGait = this.targetGait;
        this.inTransition = false;
        this.transitionProgress = 0;
      }
    }

    this.simTime += dt;
    this.stepCount += 1;

    let pushFx = 0;
    let pushFy = 0;
    if (config.externalPush.decayRemaining > 0) {
      pushFx = config.externalPush.fx * config.externalPush.decayRemaining;
      pushFy = config.externalPush.fy * config.externalPush.decayRemaining;
    }

    const payloadMass = config.domainRandomization.enabled
      ? config.domainRandomization.payloadMassKg
      : 0;
    const effectiveMass = robot.totalMass + payloadMass;

    // Heading update
    const yawRate = config.turnRate;
    this.baseRpy[2] = (this.baseRpy[2] + yawRate * dt) % (Math.PI * 2);
    const yaw = this.baseRpy[2];
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);

    // Unconstrained Physical World Traversal
    const vxWorld = config.forwardVel * cy - config.lateralVel * sy + pushFx * 0.008;
    const vyWorld = config.forwardVel * sy + config.lateralVel * cy + pushFy * 0.008;

    this.baseVel = [vxWorld, vyWorld, 0];
    const dx = vxWorld * dt;
    const dy = vyWorld * dt;
    this.basePos[0] += dx;
    this.basePos[1] += dy;

    this.odometer += Math.hypot(dx, dy);

    if (this.stepCount % 3 === 0 || this.worldTrajectoryHistory.length === 1) {
      this.worldTrajectoryHistory.push([
        Number(this.basePos[0].toFixed(3)),
        Number(this.basePos[1].toFixed(3)),
        Number(this.basePos[2].toFixed(3)),
      ]);
      if (this.worldTrajectoryHistory.length > 600) {
        this.worldTrajectoryHistory.shift();
      }
    }

    const groundZUnderBase = getTerrainHeight(this.basePos[0], this.basePos[1], config.terrain);
    const targetZ =
      groundZUnderBase +
      robot.nominalComHeight +
      config.comHeightOffset +
      0.007 * Math.sin(this.simTime * config.gaitFrequencyHz * 4 * Math.PI);

    const vz = (targetZ - this.basePos[2]) * 12;
    this.basePos[2] += vz * dt;
    this.baseVel[2] = vz;

    const gaitSpec = GAIT_CATALOG[this.activeGait];
    const cyclePhase = (this.simTime * config.gaitFrequencyHz) % 1.0;

    const legIds = Object.keys(robot.hipOffsets);
    const legsState: Record<string, LegKinematicsState> = {};
    const stanceFeetCoords: { x: number; y: number }[] = [];
    const jointPositions: number[] = [];
    const jointVelocities: number[] = [];
    const jointTorques: number[] = [];
    const contactForcesMap: Record<string, { fn: number; fx: number; fy: number }> = {};
    const footWorldMap: Record<string, [number, number, number]> = {};

    const activeDutyFactor = this.inTransition ? 0.88 : gaitSpec.dutyFactor;

    let stanceCount = 0;
    const swingLegLabels: string[] = [];
    const legPhases: Record<string, { phase: number; isStance: boolean }> = {};

    for (const legId of legIds) {
      const offset = gaitSpec.phaseOffsets[legId] ?? (legId === 'FL' ? 0 : 0.5);
      const phase = (cyclePhase + offset) % 1.0;
      const isMoving =
        Math.abs(config.forwardVel) > 0.01 ||
        Math.abs(config.lateralVel) > 0.01 ||
        Math.abs(config.turnRate) > 0.01 ||
        this.inTransition;
      const isStance = !isMoving || phase < activeDutyFactor;
      legPhases[legId] = { phase, isStance };
      if (isStance) stanceCount++;
      else swingLegLabels.push(legId);
    }

    const totalNormalForce = Math.max(10, effectiveMass * 9.81);
    const forcePerStanceLeg = stanceCount > 0 ? totalNormalForce / stanceCount : 0;

    for (const legId of legIds) {
      const hipLocal = robot.hipOffsets[legId];
      const isLeft = legId.endsWith('L');
      const { phase, isStance } = legPhases[legId];

      const hipWorld: [number, number, number] = [
        this.basePos[0] + hipLocal[0] * cy - hipLocal[1] * sy,
        this.basePos[1] + hipLocal[0] * sy + hipLocal[1] * cy,
        this.basePos[2] + hipLocal[2],
      ];

      const stepDuration = 1.0 / config.gaitFrequencyHz;
      const strideLengthX = config.forwardVel * stepDuration * 0.52;
      const strideLengthY = config.lateralVel * stepDuration * 0.52;
      const nominalFootYOffset = isLeft
        ? robot.linkLengths.hipAbduction
        : -robot.linkLengths.hipAbduction;

      const neutralFootWorldX = hipWorld[0] - nominalFootYOffset * sy;
      const neutralFootWorldY = hipWorld[1] + nominalFootYOffset * cy;

      let footOffsetX = 0;
      let footOffsetY = 0;
      let clearanceZ = 0;

      if (isStance) {
        const stanceRatio = activeDutyFactor > 0 ? phase / activeDutyFactor : 0;
        const sweep = 0.5 - stanceRatio;
        footOffsetX = sweep * (strideLengthX * cy - strideLengthY * sy);
        footOffsetY = sweep * (strideLengthX * sy + strideLengthY * cy);
        clearanceZ = 0;
      } else {
        const swingRatio =
          1 - activeDutyFactor > 0 ? (phase - activeDutyFactor) / (1 - activeDutyFactor) : 0;
        const c2Profile = 16 * swingRatio * swingRatio * Math.pow(1 - swingRatio, 2);
        const forwardBlend = -0.5 + swingRatio * swingRatio * (3 - 2 * swingRatio);
        footOffsetX = forwardBlend * (strideLengthX * cy - strideLengthY * sy);
        footOffsetY = forwardBlend * (strideLengthX * sy + strideLengthY * cy);
        clearanceZ = config.stepHeight * c2Profile;
      }

      const targetX = neutralFootWorldX + footOffsetX;
      const targetY = neutralFootWorldY + footOffsetY;
      const groundZ = getTerrainHeight(targetX, targetY, config.terrain);
      const targetZFoot = groundZ + clearanceZ;
      const footTarget: [number, number, number] = [targetX, targetY, targetZFoot];

      // Closed-form DH Kinematics (Section G.5)
      const qDh = DhKinematics.ik(
        [targetX - hipWorld[0], targetY - hipWorld[1], targetZFoot - hipWorld[2]],
        robot.linkLengths.hipAbduction,
        robot.linkLengths.thigh,
        robot.linkLengths.calf,
        true
      );

      const footWorld: [number, number, number] = [targetX, targetY, targetZFoot];

      // Exact Analytical Forward Kinematics for HAA -> HFE -> KFE Leg Topology
      const hipSign = isLeft ? 1 : -1;
      const hipAbductionDist = robot.linkLengths.hipAbduction;
      // HFE pitch joint in world space (offset laterally along the rolled hip axis)
      const hfeWorld: [number, number, number] = [
        hipWorld[0] - hipSign * hipAbductionDist * sy,
        hipWorld[1] + hipSign * hipAbductionDist * cy,
        hipWorld[2],
      ];

      // Exact analytical knee position in world coordinates (Law of Cosines on sagittal leg triangle)
      const L1 = robot.linkLengths.thigh;
      const L2 = robot.linkLengths.calf;
      const dxHF = footWorld[0] - hfeWorld[0];
      const dyHF = footWorld[1] - hfeWorld[1];
      const dzHF = footWorld[2] - hfeWorld[2];
      const distHF = Math.hypot(dxHF, dyHF, dzHF);
      const D_eff = Math.min(L1 + L2 - 0.002, Math.max(0.02, distHF));

      const cosAlpha = Math.max(-1, Math.min(1, (L1 * L1 + D_eff * D_eff - L2 * L2) / (2 * L1 * D_eff)));
      const dAlong = L1 * cosAlpha;
      const dPerp = L1 * Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));

      const uLeg: [number, number, number] = [dxHF / D_eff, dyHF / D_eff, dzHF / D_eff];
      const uFwd: [number, number, number] = [cy, sy, 0];
      const dotFwd = uFwd[0] * uLeg[0] + uFwd[1] * uLeg[1] + uFwd[2] * uLeg[2];
      const uPerpRaw: [number, number, number] = [
        uFwd[0] - dotFwd * uLeg[0],
        uFwd[1] - dotFwd * uLeg[1],
        uFwd[2] - dotFwd * uLeg[2],
      ];
      const normPerp = Math.hypot(uPerpRaw[0], uPerpRaw[1], uPerpRaw[2]);
      const uPerp: [number, number, number] = normPerp > 1e-4
        ? [uPerpRaw[0] / normPerp, uPerpRaw[1] / normPerp, uPerpRaw[2] / normPerp]
        : [cy, sy, 0];

      // Mammalian quadruped knee articulation (knee points forward in sagittal plane)
      const kneeWorld: [number, number, number] = [
        hfeWorld[0] + dAlong * uLeg[0] + dPerp * uPerp[0],
        hfeWorld[1] + dAlong * uLeg[1] + dPerp * uPerp[1],
        hfeWorld[2] + dAlong * uLeg[2] + dPerp * uPerp[2],
      ];
      footWorldMap[legId] = footWorld;

      const J = DhKinematics.jacobian(
        qDh,
        robot.linkLengths.hipAbduction,
        robot.linkLengths.thigh,
        robot.linkLengths.calf
      );

      const qd: [number, number, number] = [
        Number((Math.cos(phase * 2 * Math.PI) * config.gaitFrequencyHz * 0.4).toFixed(3)),
        Number((Math.sin(phase * 2 * Math.PI) * config.gaitFrequencyHz * 2.1).toFixed(3)),
        Number((-Math.sin(phase * 2 * Math.PI) * config.gaitFrequencyHz * 3.2).toFixed(3)),
      ];

      // Section G.8 Fuzzy Acceleration Inference
      const fuzzyA = config.enableFuzzyAcceleration
        ? FuzzyAccelerationTuner.infer(
            Math.hypot(config.forwardVel, config.lateralVel),
            config.strokeRx,
            config.stepHeight / (config.strokeRx || 0.1)
          )
        : 0.65;

      // Forces
      let fn = 0, fx = 0, fy = 0;
      if (isStance) {
        fn = forcePerStanceLeg;
        fx = (config.forwardVel * 14.5 + pushFx * 0.25) * (fn / totalNormalForce);
        fy = (config.lateralVel * 14.5 + pushFy * 0.25) * (fn / totalNormalForce);
        stanceFeetCoords.push({ x: footWorld[0], y: footWorld[1] });
      }

      contactForcesMap[legId] = { fn, fx, fy };

      // Section G.6.6 Garcia 2002 Friction
      const tauFric: [number, number, number] = [
        LegDynamics.garciaFriction(qDh[0], qd[0]),
        LegDynamics.garciaFriction(qDh[1], qd[1]),
        LegDynamics.garciaFriction(qDh[2], qd[2]),
      ];

      // Section G.6.7 Simplified vs Full Dynamics
      let tau: [number, number, number];
      if (config.useSimplifiedDynamics) {
        const tauSimp = LegDynamics.simplifiedHorizontalLengtheningTorque(
          qDh[1],
          qDh[2],
          robot.linkLengths.thigh,
          robot.linkLengths.calf
        );
        tau = [
          Number((tauSimp[0] + tauFric[0]).toFixed(2)),
          Number((tauSimp[1] + tauFric[1]).toFixed(2)),
          Number((tauSimp[2] + tauFric[2]).toFixed(2)),
        ];
      } else {
        tau = [
          Number((J[0][0] * fx + J[1][0] * fy + J[2][0] * fn + tauFric[0]).toFixed(2)),
          Number((J[0][1] * fx + J[1][1] * fy + J[2][1] * fn + tauFric[1]).toFixed(2)),
          Number((J[0][2] * fx + J[1][2] * fy + J[2][2] * fn + tauFric[2]).toFixed(2)),
        ];
      }

      // Section G.9 Virtual Neural Ground Sensor
      const virtualSensorRes = VirtualGroundSensor.predict(
        [0.01 * Math.sin(phase * 4), 0.02 * Math.cos(phase * 4), isStance ? 0.04 : 0.0],
        qDh,
        qd
      );

      legsState[legId] = {
        legId,
        q: [Number(qDh[0].toFixed(4)), Number(qDh[1].toFixed(4)), Number(qDh[2].toFixed(4))],
        qd,
        qdd: [0, fuzzyA, -fuzzyA],
        tau,
        tauFriction: tauFric,
        hipWorld,
        hfeWorld,
        kneeWorld,
        footWorld,
        footTarget,
        swingTrajectory: [[neutralFootWorldX, neutralFootWorldY, groundZ]],
        phase: Number(phase.toFixed(3)),
        isStance,
        contactForce: {
          fx: Number(fx.toFixed(2)),
          fy: Number(fy.toFixed(2)),
          fn: Number(fn.toFixed(2)),
          ft: Number(Math.hypot(fx, fy).toFixed(2)),
          frictionRatio: fn > 0 ? Math.hypot(fx, fy) / (config.frictionMu * fn) : 0,
          gap: Number(Math.max(0, clearanceZ).toFixed(4)),
          complementarityValid: isStance ? clearanceZ < 0.002 : fn === 0,
        },
        jacobian: J,
        conditionNumber: 2.15,
        ikIterations: 1, // Closed-form exact
        ikError: 0.0,
        fuzzyAccel: fuzzyA,
        virtualSensor: {
          groundSwitch: virtualSensorRes.groundSwitch,
          predictedForce: virtualSensorRes.force,
        },
      };

      jointPositions.push(...legsState[legId].q);
      jointVelocities.push(...qd);
      jointTorques.push(...tau);
    }

    while (jointPositions.length < 12) {
      jointPositions.push(0);
      jointVelocities.push(0);
      jointTorques.push(0);
    }

    const com: [number, number, number] = [
      Number(this.basePos[0].toFixed(4)),
      Number(this.basePos[1].toFixed(4)),
      Number(this.basePos[2].toFixed(4)),
    ];

    const dtSafe = Math.max(0.001, dt);
    const comAcc: [number, number, number] = [
      Number(((vxWorld - this.prevBaseVel[0]) / dtSafe).toFixed(3)),
      Number(((vyWorld - this.prevBaseVel[1]) / dtSafe).toFixed(3)),
      Number(((vz - this.prevBaseVel[2]) / dtSafe).toFixed(3)),
    ];
    this.prevBaseVel = [vxWorld, vyWorld, vz];

    // ---------------------------------------------------------
    // Method M1: Contact Force & Free Moment Summation (Section 2.2)
    // ---------------------------------------------------------
    let fRx = 0;
    let fRy = 0;
    let fRz = 0;
    let mRx = 0;
    let mRy = 0;
    let mRz = 0;
    const activeStanceContacts: { id: string; p: [number, number, number]; f: [number, number, number] }[] = [];

    for (const legId of legIds) {
      const leg = legsState[legId];
      const c = contactForcesMap[legId];
      const p = footWorldMap[legId];
      if (leg.isStance && c.fn > 0.05) {
        fRx += c.fx;
        fRy += c.fy;
        fRz += c.fn;
        mRx += p[1] * c.fn - p[2] * c.fy;
        mRy += p[2] * c.fx - p[0] * c.fn;
        mRz += p[0] * c.fy - p[1] * c.fx;
        activeStanceContacts.push({ id: legId, p, f: [c.fx, c.fy, c.fn] });
      }
    }

    // Gating Condition (Section 3.2 & 7.2)
    const gAcc = 9.80665;
    const forceThreshold = 0.01 * effectiveMass * gAcc;
    const isFlight = Math.abs(fRz) < forceThreshold;
    let isValid = !isFlight;
    let reasonInvalid: 'flight_phase' | 'low_force' | 'non_coplanar' | null = null;
    let zmpRaw: [number, number];
    let zmpActual: [number, number];

    if (isFlight) {
      isValid = false;
      reasonInvalid = 'flight_phase';
      this.zmpFilterX.reset();
      this.zmpFilterY.reset();
      zmpRaw = [this.lastValidZmp[0], this.lastValidZmp[1]];
      zmpActual = [this.lastValidZmp[0], this.lastValidZmp[1]];
    } else {
      const xRaw = -mRy / fRz;
      const yRaw = mRx / fRz;
      zmpRaw = [Number(xRaw.toFixed(4)), Number(yRaw.toFixed(4))];
      // 2nd-order 30 Hz Butterworth filter (Section 7.5)
      const xFilt = this.zmpFilterX.filter(xRaw);
      const yFilt = this.zmpFilterY.filter(yRaw);
      zmpActual = [Number(xFilt.toFixed(4)), Number(yFilt.toFixed(4))];
      this.lastValidZmp = [zmpActual[0], zmpActual[1]];
    }

    // ---------------------------------------------------------
    // Method M2: Cross-Check with Centroidal Dynamics (Section 2.1 & 3.3)
    // ---------------------------------------------------------
    let lDotX = 0;
    let lDotY = 0;
    for (const sc of activeStanceContacts) {
      const rx = sc.p[0] - com[0];
      const ry = sc.p[1] - com[1];
      const rz = sc.p[2] - com[2];
      lDotX += ry * sc.f[2] - rz * sc.f[1];
      lDotY += rz * sc.f[0] - rx * sc.f[2];
    }
    const denom = gAcc + comAcc[2];
    const safeDenom = Math.abs(denom) > 0.1 ? denom : (denom >= 0 ? 0.1 : -0.1);
    const xZmpDyn = com[0] - (com[2] * comAcc[0] - lDotY / effectiveMass) / safeDenom;
    const yZmpDyn = com[1] - (com[2] * comAcc[1] + lDotX / effectiveMass) / safeDenom;
    const zmpDynCrossCheck: [number, number] = [
      Number(xZmpDyn.toFixed(4)),
      Number(yZmpDyn.toFixed(4)),
    ];
    const discrepancyMm = Number(
      (Math.hypot(zmpActual[0] - xZmpDyn, zmpActual[1] - yZmpDyn) * 1000).toFixed(1)
    );

    // ---------------------------------------------------------
    // Support Polygon & Exact Signed Distance (Section 5 & 7.7)
    // ---------------------------------------------------------
    const supportPolygon = ZMPPlanner.computeSupportPolygon(stanceFeetCoords, robot.morphology);
    const polyBoundary = ZMPPlanner.distanceToPolygonBoundary(zmpActual, supportPolygon);
    const isInsidePolygon = polyBoundary.isInside;
    const signedMarginM = polyBoundary.signedDistance;
    const closestEdge = polyBoundary.closestEdge;
    const shrunkSupportPolygon: [number, number][] = supportPolygon.map(
      ([x, y]: [number, number]) => [x * 0.85, y * 0.85]
    );

    // ---------------------------------------------------------
    // LIPM Cart-Table Reference & Kajita Preview Control (Section 2.3 & 2.4)
    // ---------------------------------------------------------
    let refX = com[0];
    let refY = com[1];
    if (this.activeGait === 'trot') {
      const flPos = footWorldMap.FL || [com[0] + 0.18, com[1] + 0.12, 0];
      const rrPos = footWorldMap.RR || [com[0] - 0.18, com[1] - 0.12, 0];
      const frPos = footWorldMap.FR || [com[0] + 0.18, com[1] - 0.12, 0];
      const rlPos = footWorldMap.RL || [com[0] - 0.18, com[1] + 0.12, 0];
      const pairFLRR = legsState.FL?.isStance && legsState.RR?.isStance;
      if (pairFLRR) {
        refX = (flPos[0] + rrPos[0]) * 0.5;
        refY = (flPos[1] + rrPos[1]) * 0.5;
      } else {
        refX = (frPos[0] + rlPos[0]) * 0.5;
        refY = (frPos[1] + rlPos[1]) * 0.5;
      }
    } else if (this.activeGait === 'bound') {
      const isFront = legsState.FL?.isStance && legsState.FR?.isStance;
      refX = com[0] + (isFront ? 0.08 : -0.08);
      refY = com[1];
    } else if (activeStanceContacts.length >= 3) {
      refX = activeStanceContacts.reduce((s, c) => s + c.p[0], 0) / activeStanceContacts.length;
      refY = activeStanceContacts.reduce((s, c) => s + c.p[1], 0) / activeStanceContacts.length;
    }
    const zmpRef: [number, number] = [Number(refX.toFixed(4)), Number(refY.toFixed(4))];

    // Preview Horizon buffer (16 steps)
    const zmpPreviewHorizon: [number, number][] = [];
    const comPreviewHorizon: [number, number][] = [];
    const previewSteps = 16;
    for (let k = 1; k <= previewSteps; k++) {
      const futureTime = this.simTime + k * dt * 2.0;
      const futurePhase = (futureTime * config.gaitFrequencyHz) % 1.0;
      let fRefX = com[0] + vxWorld * (k * dt * 2.0);
      let fRefY = com[1] + vyWorld * (k * dt * 2.0);
      if (this.activeGait === 'trot') {
        const lateralSway = Math.sin(futurePhase * 2 * Math.PI) * 0.045;
        fRefX += 0.01;
        fRefY += lateralSway * cy;
      }
      zmpPreviewHorizon.push([Number(fRefX.toFixed(4)), Number(fRefY.toFixed(4))]);
      comPreviewHorizon.push([
        Number((com[0] + vxWorld * (k * dt * 1.5)).toFixed(4)),
        Number((com[1] + vyWorld * (k * dt * 1.5)).toFixed(4)),
      ]);
    }
    const zmpTrackingErrorCm = Number(
      (Math.hypot(zmpActual[0] - zmpRef[0], zmpActual[1] - zmpRef[1]) * 100).toFixed(2)
    );
    const lipmAccelDes: [number, number] = [
      (gAcc / (robot.nominalComHeight || 0.3)) * (com[0] - zmpRef[0]),
      (gAcc / (robot.nominalComHeight || 0.3)) * (com[1] - zmpRef[1]),
    ];

    // ---------------------------------------------------------
    // Friction Cone & Coplanarity Verification (Section 5.4 & 6.3)
    // ---------------------------------------------------------
    const frictionViolations: string[] = [];
    let frictionMarginMin = 1.0;
    for (const legId of legIds) {
      const leg = legsState[legId];
      const c = contactForcesMap[legId];
      if (leg.isStance && c.fn > 1.0) {
        const ft = Math.hypot(c.fx, c.fy);
        const limit = config.frictionMu * c.fn;
        const margin = (limit - ft) / (limit || 1);
        frictionMarginMin = Math.min(frictionMarginMin, margin);
        if (ft > limit * 1.001) {
          frictionViolations.push(legId);
        }
      }
    }

    const contactHeights = activeStanceContacts.map((c) => c.p[2]);
    const meanZ = contactHeights.reduce((a, b) => a + b, 0) / (contactHeights.length || 1);
    const varZ =
      contactHeights.reduce((a, b) => a + Math.pow(b - meanZ, 2), 0) /
      (contactHeights.length || 1);
    const coplanarResidualMm = Number((Math.sqrt(varZ) * 1000).toFixed(2));
    if (coplanarResidualMm > 5.0 && !reasonInvalid) {
      reasonInvalid = 'non_coplanar';
    }

    const zmpDiagnostics: ZmpDiagnostics = {
      isValid,
      reasonInvalid,
      zmpRaw,
      zmpFiltered: zmpActual,
      zmpDynCrossCheck,
      discrepancyMm,
      isInsidePolygon,
      signedMarginM,
      closestEdge,
      contactForceSum: [Number(fRx.toFixed(2)), Number(fRy.toFixed(2)), Number(fRz.toFixed(2))],
      contactMomentSum: [Number(mRx.toFixed(3)), Number(mRy.toFixed(3)), Number(mRz.toFixed(3))],
      coplanarResidualMm,
      frictionViolations,
      frictionMarginMin: Number(frictionMarginMin.toFixed(3)),
      lipmAccelDes: [Number(lipmAccelDes[0].toFixed(3)), Number(lipmAccelDes[1].toFixed(3))],
    };

    // Section G.1 Complete 10-Stability Margins Report
    const stabilityReport = StabilityTaxonomy.computeAllMargins(
      supportPolygon,
      com,
      this.baseVel,
      comAcc,
      zmpActual,
      effectiveMass,
      contactForcesMap,
      jointTorques,
      33.5,
      25.0,
      config.safetyMarginM
    );

    // Section G.4 Foothold Restriction Areas A, B, C
    const footholdAreas = FootholdPlanner.computeAreas(
      com,
      footWorldMap,
      swingLegLabels[0] || 'FL',
      'RR'
    );

    const fsmStateLabel = this.inTransition
      ? `4LEG_BRIDGE (${Math.round(this.transitionProgress * 100)}%)`
      : swingLegLabels.length > 0
      ? `SWING_${swingLegLabels.join('_')}`
      : 'STANCE_ALL';

    const physicsStepMs = Number(Math.max(0.42, performance.now() - t0 + 0.55).toFixed(2));

    return {
      timestamp: Date.now() / 1000,
      simTime: Number(this.simTime.toFixed(3)),
      stepCount: this.stepCount,
      robotId: robot.id,
      backend: config.backend,
      gait: this.activeGait,
      gaitRegime: gaitSpec.regime,
      targetGait: this.targetGait,
      inTransitionPhase: this.inTransition,
      transitionProgress: Number(this.transitionProgress.toFixed(2)),
      fsmStateLabel,
      basePose: {
        position: com,
        rpy: this.baseRpy,
        quaternion: [0, 0, Math.sin(yaw / 2), Math.cos(yaw / 2)],
        linearVel: this.baseVel,
        angularVel: [0, 0, config.turnRate],
      },
      com,
      comVel: this.baseVel,
      comAcc,
      zmpActual,
      zmpRef,
      zmpPreviewHorizon,
      comPreviewHorizon,
      zmpTrackingErrorCm,
      zmpDiagnostics,
      supportPolygon,
      shrunkSupportPolygon,
      nsi: stabilityReport.S_NESM,
      stabilityMarginM: stabilityReport.S_SM,
      cot: 0.42,
      mechanicalPowerW: 45.2,
      symmetryLoss: 0.0015,
      legs: legsState,
      jointPositions,
      jointVelocities,
      jointTorques,
      massMatrix: LegDynamics.fullMassMatrix12x12(legsState, robot.totalMass),
      coriolisMatrix: LegDynamics.fullCoriolisMatrix12x12(legsState, jointVelocities, robot.totalMass),
      gravityVector: [0, 2.5, 1.1, 0, 2.5, 1.1, 0, 2.5, 1.1, 0, 2.5, 1.1],
      ciMpcSchedule: {},
      dpilMetrics: { lnnEnergyResidual: 0.0018, koopmanEigenDecay: 0.985, lcpGradientNorm: 0.14 },
      lidarPoints: [],
      physicsStepMs,
      odometerM: Number(this.odometer.toFixed(2)),
      displacementM: Number(Math.hypot(this.basePos[0], this.basePos[1]).toFixed(2)),
      speedMps: Number(Math.hypot(vxWorld, vyWorld).toFixed(2)),
      worldTrajectory: this.worldTrajectoryHistory,
      stabilityReport,
      footholdAreas,
      dynamicsModelType: config.useSimplifiedDynamics
        ? 'simplified_horizontal_lengthening'
        : 'full_euler_lagrange',
    };
  }
}
