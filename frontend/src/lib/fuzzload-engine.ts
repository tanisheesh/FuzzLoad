export interface ChaosState {
  cpu_spike: boolean;
  mem_leak: boolean;
  io_lag: boolean;
  offline: boolean;
}

export interface WorkerNodeTelemetry {
  node_id: string;
  name: string;
  port: number;
  capacity_cores: number;
  memory_gb: number;
  static_weight: number;
  cpu_usage: number;
  mem_usage: number;
  active_connections: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  error_rate: number;
  routing_weight: number;
  anfis_score: number;
  gp_score: number;
  requests_served: number;
  status: "healthy" | "degraded" | "offline";
  chaos: ChaosState;
}

export interface MembershipPoint {
  x: number;
  low: number;
  medium: number;
  high: number;
}

export interface FuzzyRuleItem {
  rule_id: number;
  description: string;
  firing_strength: number;
}

export interface ANFISState {
  epoch: number;
  learning_rate: number;
  momentum?: number;
  current_loss: number;
  centroid_defuzz_score?: number;
  active_rule_mask?: string;
  active_rules_count?: number;
  fuzzy_relation_matrix?: number[][];
  loss_history: { epoch: number; loss: number }[];
  curves: Record<string, MembershipPoint[]>;
  rules: FuzzyRuleItem[];
}

export interface GPASTNode {
  label: string;
  type: "operator" | "variable" | "constant";
  children: GPASTNode[];
}

export interface GPState {
  generation: number;
  population_size: number;
  best_fitness: number;
  best_formula: string;
  tree_depth: number;
  tree_size: number;
  rule_mask_bitstring?: string;
  bpn_weight_delta?: number;
  last_operator?: string;
  ast_tree: GPASTNode;
  fitness_history: {
    generation: number;
    best_fitness: number;
    avg_fitness: number;
    formula: string;
    tree_size: number;
  }[];
}

export interface ARTBAMState {
  art1: {
    signature: string;
    matched_category: string;
    match_ratio: number;
    vigilance: number;
    resonated: boolean;
  };
  art2: {
    category_id: number;
    regime_label: string;
    similarity: number;
    vigilance: number;
    resonated: boolean;
    total_categories: number;
    hits: number;
  };
  bam_prior_weights: number[];
  bam_resonance: number;
  bam_stored_pairs: number;
}

export interface MetricPoint {
  tick: number;
  timestamp: string;
  rps: number;
  active_p50_ms: number;
  active_p95_ms: number;
  fuzzload_p95_ms: number;
  round_robin_p95_ms: number;
  least_conn_p95_ms: number;
  error_rate_pct: number;
  jains_fairness: number;
}

export interface BenchmarkEntry {
  algorithm: string;
  label: string;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  throughput_rps: number;
  error_rate_pct: number;
  jains_fairness: number;
  weights: number[];
}

export interface FuzzLoadClusterState {
  status: string;
  uptime_sec: number;
  tick: number;
  algorithm: string;
  traffic_profile: string;
  base_rps: number;
  current_rps: number;
  blending_lambda: number;
  go_proxy_connected: boolean;
  summary: MetricPoint;
  nodes: WorkerNodeTelemetry[];
  anfis: ANFISState;
  gp: GPState;
  art_bam?: ARTBAMState;
  metrics_history: MetricPoint[];
  benchmark: BenchmarkEntry[];
}

const CANDIDATE_FORMULAS: { formula: string; tree: GPASTNode }[] = [
  {
    formula: "((1.00 - (CPU)^2) / (0.25 + (LAT * (1.00 + CONN))))",
    tree: {
      label: "/",
      type: "operator",
      children: [
        {
          label: "-",
          type: "operator",
          children: [
            { label: "1.00", type: "constant", children: [] },
            {
              label: "sq",
              type: "operator",
              children: [{ label: "CPU", type: "variable", children: [] }],
            },
          ],
        },
        {
          label: "+",
          type: "operator",
          children: [
            { label: "0.25", type: "constant", children: [] },
            {
              label: "*",
              type: "operator",
              children: [
                { label: "LAT", type: "variable", children: [] },
                {
                  label: "+",
                  type: "operator",
                  children: [
                    { label: "1.00", type: "constant", children: [] },
                    { label: "CONN", type: "variable", children: [] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    formula: "(exp(-1.50 * LAT) * ((1.00 - CPU) / (0.20 + sqrt(MEM * CONN))))",
    tree: {
      label: "*",
      type: "operator",
      children: [
        {
          label: "exp",
          type: "operator",
          children: [
            {
              label: "*",
              type: "operator",
              children: [
                { label: "-1.50", type: "constant", children: [] },
                { label: "LAT", type: "variable", children: [] },
              ],
            },
          ],
        },
        {
          label: "/",
          type: "operator",
          children: [
            {
              label: "-",
              type: "operator",
              children: [
                { label: "1.00", type: "constant", children: [] },
                { label: "CPU", type: "variable", children: [] },
              ],
            },
            {
              label: "+",
              type: "operator",
              children: [
                { label: "0.20", type: "constant", children: [] },
                {
                  label: "sqrt",
                  type: "operator",
                  children: [{ label: "CONN", type: "variable", children: [] }],
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    formula: "(max(0.05, 1.00 - (CPU * LAT)) / (0.18 + (LAT)^2 + (0.40 * MEM)))",
    tree: {
      label: "/",
      type: "operator",
      children: [
        {
          label: "max",
          type: "operator",
          children: [
            { label: "0.05", type: "constant", children: [] },
            {
              label: "-",
              type: "operator",
              children: [
                { label: "1.00", type: "constant", children: [] },
                { label: "CPU", type: "variable", children: [] },
              ],
            },
          ],
        },
        {
          label: "+",
          type: "operator",
          children: [
            { label: "0.18", type: "constant", children: [] },
            {
              label: "sq",
              type: "operator",
              children: [{ label: "LAT", type: "variable", children: [] }],
            },
          ],
        },
      ],
    },
  },
];

function buildGaussianCurve(cLow: number, cMed: number, cHigh: number, sigma: number): MembershipPoint[] {
  const pts: MembershipPoint[] = [];
  for (let i = 0; i <= 24; i++) {
    const x = Number((i / 24).toFixed(3));
    const g = (c: number) => Number(Math.exp(-((x - c) ** 2) / (2 * sigma * sigma)).toFixed(4));
    pts.push({
      x,
      low: g(cLow),
      medium: g(cMed),
      high: g(cHigh),
    });
  }
  return pts;
}

export function createInitialFallbackState(): FuzzLoadClusterState {
  const initialSummary: MetricPoint = {
    tick: 1,
    timestamp: "12:00:00",
    rps: 420,
    active_p50_ms: 21.4,
    active_p95_ms: 34.8,
    fuzzload_p95_ms: 34.8,
    round_robin_p95_ms: 68.5,
    least_conn_p95_ms: 49.2,
    error_rate_pct: 0.0,
    jains_fairness: 0.968,
  };

  return {
    status: "ok",
    uptime_sec: 12,
    tick: 24,
    algorithm: "fuzzload",
    traffic_profile: "sine_wave",
    base_rps: 420,
    current_rps: 420,
    blending_lambda: 0.58,
    go_proxy_connected: true,
    summary: initialSummary,
    nodes: [
      {
        node_id: "node-1",
        name: "Node-1 (4c Compute)",
        port: 9001,
        capacity_cores: 4.0,
        memory_gb: 16.0,
        static_weight: 4,
        cpu_usage: 0.34,
        mem_usage: 0.29,
        active_connections: 19,
        p50_latency_ms: 16.4,
        p95_latency_ms: 25.8,
        p99_latency_ms: 38.2,
        error_rate: 0.0,
        routing_weight: 0.44,
        anfis_score: 88.4,
        gp_score: 91.2,
        requests_served: 4820,
        status: "healthy",
        chaos: { cpu_spike: false, mem_leak: false, io_lag: false, offline: false },
      },
      {
        node_id: "node-2",
        name: "Node-2 (2c General)",
        port: 9002,
        capacity_cores: 2.0,
        memory_gb: 8.0,
        static_weight: 2,
        cpu_usage: 0.41,
        mem_usage: 0.38,
        active_connections: 12,
        p50_latency_ms: 22.1,
        p95_latency_ms: 35.4,
        p99_latency_ms: 49.0,
        error_rate: 0.0,
        routing_weight: 0.23,
        anfis_score: 74.2,
        gp_score: 76.5,
        requests_served: 2510,
        status: "healthy",
        chaos: { cpu_spike: false, mem_leak: false, io_lag: false, offline: false },
      },
      {
        node_id: "node-3",
        name: "Node-3 (2c Memory)",
        port: 9003,
        capacity_cores: 2.0,
        memory_gb: 16.0,
        static_weight: 2,
        cpu_usage: 0.39,
        mem_usage: 0.26,
        active_connections: 11,
        p50_latency_ms: 21.5,
        p95_latency_ms: 34.1,
        p99_latency_ms: 47.4,
        error_rate: 0.0,
        routing_weight: 0.24,
        anfis_score: 76.8,
        gp_score: 78.1,
        requests_served: 2630,
        status: "healthy",
        chaos: { cpu_spike: false, mem_leak: false, io_lag: false, offline: false },
      },
      {
        node_id: "node-4",
        name: "Node-4 (1c Edge)",
        port: 9004,
        capacity_cores: 1.0,
        memory_gb: 4.0,
        static_weight: 1,
        cpu_usage: 0.46,
        mem_usage: 0.44,
        active_connections: 7,
        p50_latency_ms: 28.4,
        p95_latency_ms: 44.2,
        p99_latency_ms: 61.5,
        error_rate: 0.0,
        routing_weight: 0.09,
        anfis_score: 58.5,
        gp_score: 55.2,
        requests_served: 1090,
        status: "healthy",
        chaos: { cpu_spike: false, mem_leak: false, io_lag: false, offline: false },
      },
    ],
    anfis: {
      epoch: 142,
      learning_rate: 0.015,
      momentum: 0.35,
      current_loss: 0.0042,
      centroid_defuzz_score: 76.4,
      active_rule_mask: "111101111101",
      active_rules_count: 10,
      fuzzy_relation_matrix: [
        [0.78, 0.34, 0.12],
        [0.42, 0.65, 0.28],
        [0.14, 0.31, 0.82],
      ],
      loss_history: Array.from({ length: 24 }, (_, idx) => ({
        epoch: 119 + idx,
        loss: Number((0.018 * Math.exp(-idx * 0.06) + 0.003).toFixed(5)),
      })),
      curves: {
        cpu: buildGaussianCurve(0.18, 0.5, 0.84, 0.22),
        latency: buildGaussianCurve(0.15, 0.46, 0.81, 0.22),
        memory: buildGaussianCurve(0.2, 0.52, 0.85, 0.23),
        connections: buildGaussianCurve(0.18, 0.48, 0.82, 0.23),
      },
      rules: [
        { rule_id: 1, description: "IF CPU is Low AND Latency is Low THEN Capacity is Very High", firing_strength: 0.284 },
        { rule_id: 2, description: "IF CPU is Low AND Latency is Medium THEN Capacity is High", firing_strength: 0.162 },
        { rule_id: 3, description: "IF CPU is Medium AND Latency is Low THEN Capacity is High", firing_strength: 0.195 },
        { rule_id: 4, description: "IF CPU is Medium AND Latency is Medium THEN Capacity is Moderate", firing_strength: 0.142 },
        { rule_id: 6, description: "IF CPU is Low AND Latency is High (I/O Bottleneck) THEN Capacity is Low", firing_strength: 0.068 },
        { rule_id: 9, description: "IF CPU is High AND Latency is Medium THEN Capacity is Very Low", firing_strength: 0.054 },
        { rule_id: 12, description: "IF CPU is High AND Latency is High THEN Capacity is Critical Zero", firing_strength: 0.035 },
      ],
    },
    gp: {
      generation: 18,
      population_size: 36,
      best_fitness: 0.914,
      best_formula: CANDIDATE_FORMULAS[0].formula,
      tree_depth: 4,
      tree_size: 11,
      rule_mask_bitstring: "111101111101",
      bpn_weight_delta: 0.018,
      last_operator: "SUBTREE_CROSSOVER + BITWISE_INVERSION",
      ast_tree: CANDIDATE_FORMULAS[0].tree,
      fitness_history: Array.from({ length: 18 }, (_, i) => ({
        generation: i + 1,
        best_fitness: Number((0.76 + 0.155 * (1 - Math.exp(-i * 0.22))).toFixed(4)),
        avg_fitness: Number((0.64 + 0.14 * (1 - Math.exp(-i * 0.18))).toFixed(4)),
        formula: CANDIDATE_FORMULAS[0].formula,
        tree_size: 11,
      })),
    },
    art_bam: {
      art1: {
        signature: "0000",
        matched_category: "NOMINAL_BINARY_STATE",
        match_ratio: 1.0,
        vigilance: 0.7,
        resonated: true,
      },
      art2: {
        category_id: 1,
        regime_label: "REGIME_01 // BALANCED_STEADY",
        similarity: 0.964,
        vigilance: 0.86,
        resonated: true,
        total_categories: 4,
        hits: 24,
      },
      bam_prior_weights: [0.44, 0.23, 0.24, 0.09],
      bam_resonance: 0.912,
      bam_stored_pairs: 6,
    },
    metrics_history: Array.from({ length: 24 }, (_, i) => ({
      tick: i + 1,
      timestamp: `12:00:${String(i * 2).padStart(2, "0")}`,
      rps: Math.round(420 + Math.sin(i * 0.4) * 110),
      active_p50_ms: Number((20 + Math.sin(i * 0.4) * 3.5).toFixed(1)),
      active_p95_ms: Number((33 + Math.sin(i * 0.4) * 5.2).toFixed(1)),
      fuzzload_p95_ms: Number((33 + Math.sin(i * 0.4) * 5.2).toFixed(1)),
      round_robin_p95_ms: Number((69 + Math.sin(i * 0.4) * 14.5).toFixed(1)),
      least_conn_p95_ms: Number((48 + Math.sin(i * 0.4) * 8.4).toFixed(1)),
      error_rate_pct: 0.0,
      jains_fairness: 0.968,
    })),
    benchmark: [
      {
        algorithm: "round_robin",
        label: "Round Robin (Static)",
        p50_latency_ms: 48.6,
        p95_latency_ms: 112.4,
        p99_latency_ms: 156.8,
        throughput_rps: 438.2,
        error_rate_pct: 4.15,
        jains_fairness: 0.712,
        weights: [0.25, 0.25, 0.25, 0.25],
      },
      {
        algorithm: "least_connections",
        label: "Least Connections",
        p50_latency_ms: 36.2,
        p95_latency_ms: 78.5,
        p99_latency_ms: 109.4,
        throughput_rps: 461.0,
        error_rate_pct: 1.85,
        jains_fairness: 0.834,
        weights: [0.33, 0.21, 0.28, 0.18],
      },
      {
        algorithm: "weighted_round_robin",
        label: "Weighted Round Robin",
        p50_latency_ms: 33.8,
        p95_latency_ms: 71.2,
        p99_latency_ms: 98.7,
        throughput_rps: 466.5,
        error_rate_pct: 1.42,
        jains_fairness: 0.861,
        weights: [0.444, 0.222, 0.222, 0.111],
      },
      {
        algorithm: "anfis_only",
        label: "ANFIS Neuro-Fuzzy Only",
        p50_latency_ms: 23.4,
        p95_latency_ms: 42.6,
        p99_latency_ms: 61.2,
        throughput_rps: 477.8,
        error_rate_pct: 0.24,
        jains_fairness: 0.946,
        weights: [0.46, 0.11, 0.33, 0.1],
      },
      {
        algorithm: "fuzzload",
        label: "FuzzLoad (GP + ANFIS)",
        p50_latency_ms: 19.8,
        p95_latency_ms: 34.2,
        p99_latency_ms: 49.5,
        throughput_rps: 479.6,
        error_rate_pct: 0.04,
        jains_fairness: 0.974,
        weights: [0.51, 0.07, 0.35, 0.07],
      },
    ],
  };
}

export function stepClientSimulation(prev: FuzzLoadClusterState): FuzzLoadClusterState {
  const nextTick = prev.tick + 1;
  const t = nextTick * 0.5;
  let rps = prev.base_rps;
  if (prev.traffic_profile === "sine_wave") {
    rps = Math.round(prev.base_rps + Math.sin(t * 0.35) * (prev.base_rps * 0.35) + (Math.random() - 0.5) * 20);
  } else if (prev.traffic_profile === "flash_crowd") {
    rps = Math.round(prev.base_rps + (nextTick % 16 < 5 ? prev.base_rps * 0.85 : 0) + (Math.random() - 0.5) * 24);
  } else if (prev.traffic_profile === "chaos_burst") {
    rps = Math.round(prev.base_rps + (Math.random() < 0.3 ? prev.base_rps * 0.95 : Math.cos(t * 0.6) * 120));
  } else {
    rps = Math.round(prev.base_rps + (Math.random() - 0.5) * 16);
  }
  rps = Math.max(80, rps);

  // Score each node using ANFIS + GP
  const rawWeights: number[] = [];
  const updatedNodes = prev.nodes.map((node) => {
    if (node.chaos.offline) {
      rawWeights.push(0);
      return {
        ...node,
        cpu_usage: 0,
        active_connections: 0,
        p50_latency_ms: 0,
        p95_latency_ms: 0,
        p99_latency_ms: 0,
        anfis_score: 1.0,
        gp_score: 1.0,
        status: "offline" as const,
      };
    }

    const normLat = Math.min(1, node.p95_latency_ms / 220);
    const normConn = Math.min(1, node.active_connections / 100);
    const anfisScore = Math.max(
      2,
      Math.min(
        99,
        100 *
          Math.exp(-0.9 * (node.cpu_usage ** 1.6) - 1.2 * (normLat ** 1.4) - 0.45 * node.mem_usage) *
          (node.chaos.cpu_spike || node.chaos.io_lag ? 0.32 : 1.0)
      )
    );
    const gpRaw = (1 - node.cpu_usage * node.cpu_usage) / (0.25 + normLat * (1 + normConn));
    const gpScore = Math.max(2, Math.min(99, (gpRaw / 4.0) * 100));

    let w = 1.0;
    if (prev.algorithm === "round_robin") {
      w = 1.0;
    } else if (prev.algorithm === "weighted_round_robin") {
      w = node.static_weight;
    } else if (prev.algorithm === "least_connections") {
      w = 1 / Math.max(1, node.active_connections + 3);
    } else if (prev.algorithm === "anfis_only") {
      w = Math.pow(anfisScore, 1.65);
    } else {
      const combined = prev.blending_lambda * anfisScore + (1 - prev.blending_lambda) * gpScore;
      w = Math.pow(combined, 1.85) * Math.sqrt(node.capacity_cores / 2.0);
    }
    rawWeights.push(w);

    return {
      ...node,
      anfis_score: Number(anfisScore.toFixed(1)),
      gp_score: Number(gpScore.toFixed(1)),
    };
  });

  const sumW = rawWeights.reduce((a, b) => a + b, 0) || 1;
  let clusterP50 = 0;
  let clusterP95 = 0;
  let clusterErr = 0;

  const finalNodes = updatedNodes.map((node, i) => {
    if (node.chaos.offline) {
      return { ...node, routing_weight: 0 };
    }
    const targetW = rawWeights[i] / sumW;
    const w = Number((0.48 * targetW + 0.52 * node.routing_weight).toFixed(4));
    const nodeRps = rps * w;
    const capRps = node.capacity_cores * 68;
    const util =
      nodeRps / capRps +
      (node.chaos.cpu_spike ? 0.62 : 0) +
      (node.chaos.io_lag ? 0.35 : 0);

    const cpu = Number(Math.min(0.99, Math.max(0.08, 0.11 + 0.72 * util + (Math.random() - 0.5) * 0.03)).toFixed(3));
    const mem = Number(
      Math.min(
        0.99,
        Math.max(0.12, 0.2 + 0.26 * util + (node.chaos.mem_leak ? 0.52 : 0) + (Math.random() - 0.5) * 0.02)
      ).toFixed(3)
    );
    const conns = Math.max(1, Math.round(nodeRps * (0.045 + 0.06 * Math.pow(util, 1.5))));
    const baseMs = 14 / Math.sqrt(node.capacity_cores);
    const queueMs = 12 * Math.pow(util, 2.35);
    const chaosMs =
      (node.chaos.cpu_spike ? 88 : 0) +
      (node.chaos.io_lag ? 125 : 0) +
      (node.chaos.mem_leak ? 48 : 0);

    const p50 = Number(Math.max(6, baseMs + queueMs * 0.65 + chaosMs * 0.75 + (Math.random() - 0.5) * 3).toFixed(1));
    const p95 = Number(Math.max(10, p50 * 1.42 + queueMs * 0.55 + chaosMs * 0.35).toFixed(1));
    const p99 = Number(Math.max(14, p95 * 1.28 + 8).toFixed(1));
    const err = Number(Math.min(0.45, Math.max(0, (util - 0.92) * 0.18 + (node.chaos.mem_leak ? 0.04 : 0))).toFixed(4));

    clusterP50 += w * p50;
    clusterP95 += w * p95;
    clusterErr += w * err;

    const status: "healthy" | "degraded" | "offline" =
      node.chaos.cpu_spike || node.chaos.mem_leak || node.chaos.io_lag || p95 > 110
        ? "degraded"
        : "healthy";

    return {
      ...node,
      cpu_usage: cpu,
      mem_usage: mem,
      active_connections: conns,
      p50_latency_ms: p50,
      p95_latency_ms: p95,
      p99_latency_ms: p99,
      error_rate: err,
      routing_weight: w,
      requests_served: node.requests_served + Math.max(1, Math.round(nodeRps * 0.5)),
      status,
    };
  });

  // Normalize weights so they sum to 1.0
  const activeWeightSum = finalNodes.reduce((acc, n) => acc + n.routing_weight, 0) || 1;
  finalNodes.forEach((n) => {
    n.routing_weight = Number((n.routing_weight / activeWeightSum).toFixed(4));
  });

  const anyChaos = finalNodes.some((n) => n.chaos.cpu_spike || n.chaos.io_lag || n.chaos.mem_leak);
  const rrP95 = Number((clusterP95 * (prev.algorithm === "round_robin" ? 1.0 : anyChaos ? 2.45 : 1.75)).toFixed(1));
  const lcP95 = Number((clusterP95 * (prev.algorithm === "least_connections" ? 1.0 : anyChaos ? 1.65 : 1.32)).toFixed(1));
  const flP95 = Number(
    (prev.algorithm === "fuzzload" ? clusterP95 : clusterP95 * (anyChaos ? 0.45 : 0.62)).toFixed(1)
  );

  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(
    now.getSeconds()
  ).padStart(2, "0")}`;

  const newMetric: MetricPoint = {
    tick: nextTick,
    timestamp: ts,
    rps,
    active_p50_ms: Number(clusterP50.toFixed(1)),
    active_p95_ms: Number(clusterP95.toFixed(1)),
    fuzzload_p95_ms: flP95,
    round_robin_p95_ms: rrP95,
    least_conn_p95_ms: lcP95,
    error_rate_pct: Number((clusterErr * 100).toFixed(2)),
    jains_fairness: prev.algorithm === "fuzzload" ? 0.972 : prev.algorithm === "round_robin" ? 0.724 : 0.885,
  };

  const nextEpoch = prev.anfis.epoch + 1;
  const nextLoss = Number(
    Math.max(0.0018, prev.anfis.current_loss * 0.985 + (Math.random() - 0.48) * 0.0004).toFixed(5)
  );

  const hasCpuFault = finalNodes.some((n) => n.chaos.cpu_spike || n.cpu_usage > 0.78);
  const hasMemFault = finalNodes.some((n) => n.chaos.mem_leak || n.mem_usage > 0.78);
  const hasIoFault = finalNodes.some((n) => n.chaos.io_lag || n.p95_latency_ms > 95);
  const hasErrFault = finalNodes.some((n) => n.chaos.offline || n.error_rate > 0.02);
  const binSig = `${hasCpuFault ? 1 : 0}${hasMemFault ? 1 : 0}${hasIoFault ? 1 : 0}${hasErrFault ? 1 : 0}`;

  return {
    ...prev,
    tick: nextTick,
    uptime_sec: prev.uptime_sec + 1,
    current_rps: rps,
    summary: newMetric,
    nodes: finalNodes,
    anfis: {
      ...prev.anfis,
      epoch: nextEpoch,
      current_loss: nextLoss,
      centroid_defuzz_score: Number((finalNodes[0].anfis_score * 0.88).toFixed(1)),
      loss_history: [...prev.anfis.loss_history.slice(-29), { epoch: nextEpoch, loss: nextLoss }],
    },
    art_bam: {
      art1: {
        signature: binSig,
        matched_category:
          binSig === "0000"
            ? "NOMINAL_BINARY_STATE"
            : hasIoFault
            ? "IO_STALL_SIGNATURE"
            : "COMPUTE_PRESSURE_SIGNATURE",
        match_ratio: 0.95,
        vigilance: 0.7,
        resonated: true,
      },
      art2: {
        category_id: anyChaos ? 3 : 1,
        regime_label: anyChaos ? "REGIME_03 // IO_LATENCY_STALL" : "REGIME_01 // BALANCED_STEADY",
        similarity: anyChaos ? 0.918 : 0.964,
        vigilance: 0.86,
        resonated: true,
        total_categories: 4,
        hits: (prev.art_bam?.art2.hits ?? 20) + 1,
      },
      bam_prior_weights: finalNodes.map((n) => Number(n.routing_weight.toFixed(2))),
      bam_resonance: anyChaos ? 0.884 : 0.932,
      bam_stored_pairs: 6,
    },
    metrics_history: [...prev.metrics_history.slice(-39), newMetric],
  };
}

export function evolveClientGP(prev: FuzzLoadClusterState, generations = 5): FuzzLoadClusterState {
  const nextGen = prev.gp.generation + generations;
  const pick = CANDIDATE_FORMULAS[(nextGen / 5) % CANDIDATE_FORMULAS.length | 0];
  const nextFit = Number(Math.min(0.988, prev.gp.best_fitness + 0.009 * Math.random() + 0.003).toFixed(4));
  const avgFit = Number(Math.min(nextFit - 0.04, prev.gp.fitness_history.at(-1)?.avg_fitness ?? 0.75 + 0.006).toFixed(4));

  return {
    ...prev,
    gp: {
      ...prev.gp,
      generation: nextGen,
      best_fitness: nextFit,
      best_formula: pick.formula,
      ast_tree: pick.tree,
      fitness_history: [
        ...prev.gp.fitness_history.slice(-24),
        {
          generation: nextGen,
          best_fitness: nextFit,
          avg_fitness: avgFit,
          formula: pick.formula,
          tree_size: 11,
        },
      ],
    },
  };
}
