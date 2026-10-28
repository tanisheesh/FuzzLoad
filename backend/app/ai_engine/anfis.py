"""5-Layer Differentiable Takagi-Sugeno Adaptive Neuro-Fuzzy Inference System (ANFIS).

Integrates:
- McCulloch-Pitts (M-P) Binary Threshold Gating Neuron & 2-Layer BPN XOR Contention Detector
- Layer 1 (Fuzzification): Trainable Gaussian & Asymmetric LR-Type Fuzzy Numbers (Low, Medium, High)
- Fuzzy Relation Matrix (Max-Min Composition) across Load & Latency sets
- Layer 2 (Rule Firing): Product T-Norm firing strength modulated by FLC-GA 12-bit structural rule mask
- Layer 3 (Normalization): Normalized rule firing weights
- Layer 4 (Takagi-Sugeno Consequents): First-order linear consequent neurons
- Layer 5 (Dual Defuzzification): Takagi-Sugeno Weighted Sum + Mamdani Centroid (Center of Gravity)
- Online Backpropagation with Momentum & Widrow-Hoff Delta Rule parameter adaptation
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Sequence


def _clip(val: float, low: float, high: float) -> float:
    return max(low, min(high, val))


@dataclass
class FuzzyRuleSpec:
    rule_id: int
    description: str
    cpu_term: int      # 0=Low, 1=Medium, 2=High
    mem_term: int      # 0=Low, 1=Medium, 2=High
    lat_term: int      # 0=Low, 1=Medium, 2=High
    conn_term: int     # 0=Low, 1=Medium, 2=High


class McCullochPittsGateAndXORNetwork:
    """McCulloch-Pitts binary threshold safety neuron + BPN XOR non-linear contention detector."""

    def __init__(self, threshold: float = 1.0) -> None:
        self.threshold = threshold
        # Pre-trained 2-2-1 Backpropagation Network solving the non-linear XOR contention problem:
        # Fires high when (CPU_HIGH XOR LAT_HIGH) == 1 (hidden I/O stall or CPU spin anomaly)
        self.w_hidden = [[6.2, 6.2], [-5.8, -5.8]]
        self.b_hidden = [-2.8, 8.6]
        self.w_out = [6.5, 6.5]
        self.b_out = -9.4

    @staticmethod
    def _sigmoid(z: float) -> float:
        return 1.0 / (1.0 + math.exp(-_clip(z, -15.0, 15.0)))

    def evaluate_mp_neuron(self, excitatory: Sequence[int], inhibitory: int = 0) -> int:
        """McCulloch-Pitts neuron: fires 1 iff no inhibitory input is active and sum >= threshold."""
        if inhibitory > 0:
            return 0
        net = sum(1.0 for e in excitatory if e > 0)
        return 1 if net >= self.threshold else 0

    def detect_xor_anomaly(self, cpu_high: float, lat_high: float) -> float:
        """Evaluate 2-layer BPN XOR network on (cpu_high, lat_high) in [0, 1]^2."""
        h1 = self._sigmoid(self.w_hidden[0][0] * cpu_high + self.w_hidden[0][1] * lat_high + self.b_hidden[0])
        h2 = self._sigmoid(self.w_hidden[1][0] * cpu_high + self.w_hidden[1][1] * lat_high + self.b_hidden[1])
        out = self._sigmoid(self.w_out[0] * h1 + self.w_out[1] * h2 + self.b_out)
        return round(float(out), 4)


class TakagiSugenoANFIS:
    """5-Layer Differentiable Neuro-Fuzzy Controller with Momentum BPN & LR-Type Fuzzy Sets."""

    TERM_NAMES = ("Low", "Medium", "High")
    FEATURE_NAMES = ("cpu", "memory", "latency", "connections")

    def __init__(
        self,
        learning_rate: float = 0.015,
        momentum: float = 0.35,
        sla_target_ms: float = 85.0,
    ) -> None:
        self.learning_rate = learning_rate
        self.momentum = momentum
        self.sla_target_ms = sla_target_ms
        self.epoch = 0
        self.loss_history: list[dict[str, float | int]] = []
        self.mp_xor_gate = McCullochPittsGateAndXORNetwork(threshold=1.0)

        # Layer 1 Premise Parameters: shape (4 features, 3 linguistic terms: Low, Med, High)
        self._base_centers: list[list[float]] = [
            [0.18, 0.50, 0.84],  # CPU
            [0.20, 0.52, 0.85],  # Memory
            [0.15, 0.45, 0.80],  # Normalized Latency
            [0.18, 0.48, 0.82],  # Normalized Active Connections
        ]
        self.centers: list[list[float]] = [list(row) for row in self._base_centers]
        self.sigmas: list[list[float]] = [[0.24, 0.24, 0.24] for _ in range(4)]
        self._term_bounds: tuple[tuple[float, float], ...] = (
            (0.05, 0.34),  # Low center bounds
            (0.36, 0.65),  # Medium center bounds
            (0.67, 0.95),  # High center bounds
        )

        # Asymmetric LR-Type Fuzzy Number spreads (alpha_left, beta_right) per term
        self.lr_spreads: list[tuple[float, float]] = [
            (0.18, 0.32),  # Low: sharp left, wider right
            (0.24, 0.26),  # Medium: quasi-symmetric
            (0.32, 0.18),  # High: wider left ramp, steep right bound
        ]

        # 12-Rule Takagi-Sugeno Fuzzy Rule Base
        self.rules: list[FuzzyRuleSpec] = [
            FuzzyRuleSpec(1, "IF CPU is Low AND Latency is Low THEN Capacity is Very High", 0, 0, 0, 0),
            FuzzyRuleSpec(2, "IF CPU is Low AND Latency is Medium THEN Capacity is High", 0, 1, 1, 0),
            FuzzyRuleSpec(3, "IF CPU is Medium AND Latency is Low THEN Capacity is High", 1, 1, 0, 1),
            FuzzyRuleSpec(4, "IF CPU is Medium AND Latency is Medium THEN Capacity is Moderate", 1, 1, 1, 1),
            FuzzyRuleSpec(5, "IF CPU is High AND Latency is Low THEN Capacity is Reduced", 2, 1, 0, 1),
            FuzzyRuleSpec(6, "IF CPU is Low AND Latency is High (I/O Bottleneck) THEN Capacity is Low", 0, 1, 2, 1),
            FuzzyRuleSpec(7, "IF CPU is Medium AND Connections are High THEN Capacity is Low", 1, 1, 1, 2),
            FuzzyRuleSpec(8, "IF Memory is High AND Latency is Medium THEN Capacity is Reduced", 1, 2, 1, 1),
            FuzzyRuleSpec(9, "IF CPU is High AND Latency is Medium THEN Capacity is Very Low", 2, 1, 1, 2),
            FuzzyRuleSpec(10, "IF CPU is Medium AND Latency is High THEN Capacity is Very Low", 1, 1, 2, 2),
            FuzzyRuleSpec(11, "IF Memory is High AND Latency is High THEN Capacity is Critical", 1, 2, 2, 2),
            FuzzyRuleSpec(12, "IF CPU is High AND Latency is High THEN Capacity is Critical Zero", 2, 2, 2, 2),
        ]

        # Active 12-bit structural rule mask (optimized by FLC-GA structural optimizer)
        self.active_rule_mask: list[int] = [1] * len(self.rules)

        # Layer 4 Consequent Parameters: 12 rules x 5 coeffs [p_cpu, q_mem, r_lat, s_conn, bias]
        self.consequents: list[list[float]] = [
            [-0.65, -0.35, -0.80, -0.45, 2.40],
            [-0.70, -0.35, -0.85, -0.50, 1.85],
            [-0.75, -0.40, -0.80, -0.50, 1.75],
            [-0.85, -0.45, -0.95, -0.60, 1.15],
            [-1.10, -0.50, -0.90, -0.65, 0.55],
            [-0.90, -0.50, -1.65, -0.85, 0.15],
            [-1.00, -0.55, -1.20, -1.30, 0.25],
            [-0.95, -1.25, -1.10, -0.70, 0.30],
            [-1.45, -0.65, -1.40, -1.10, -0.55],
            [-1.25, -0.65, -1.75, -1.15, -0.65],
            [-1.35, -1.45, -1.85, -1.25, -1.10],
            [-1.80, -1.50, -2.10, -1.50, -1.65],
        ]
        # Momentum velocity buffers for BPN consequent & premise updates
        self._vel_consequents: list[list[float]] = [[0.0] * 5 for _ in range(len(self.rules))]
        self._vel_centers: list[list[float]] = [[0.0] * 3 for _ in range(4)]

        self._last_rule_activations: list[float] = [1.0 / len(self.rules)] * len(self.rules)
        self._last_centroid_score: float = 75.0
        self._last_fuzzy_relation: list[list[float]] = [[0.0] * 3 for _ in range(3)]

    def evaluate_lr_fuzzy_number(self, x: float, center: float, alpha_l: float, beta_r: float) -> float:
        """LR-Type Fuzzy Number membership evaluation with distinct left (L) and right (R) reference functions."""
        if x <= center:
            u = (center - x) / max(alpha_l, 0.05)
            return max(0.0, 1.0 - u * u)
        u = (x - center) / max(beta_r, 0.05)
        return math.exp(-(u * u))

    def _fuzzify(self, x: list[float]) -> list[list[float]]:
        """Layer 1: Compute hybrid Gaussian + LR-Type Fuzzy Number membership degrees of shape (4, 3)."""
        mu: list[list[float]] = []
        for m in range(4):
            row: list[float] = []
            for t in range(3):
                c = self.centers[m][t]
                sigma = max(self.sigmas[m][t], 0.06)
                gauss = math.exp(-((x[m] - c) ** 2) / (2.0 * sigma * sigma))
                alpha_l, beta_r = self.lr_spreads[t]
                lr_val = self.evaluate_lr_fuzzy_number(x[m], c, alpha_l, beta_r)
                # Blend Gaussian & LR-Type membership (80% Gaussian + 20% LR asymmetric tail)
                row.append(0.80 * gauss + 0.20 * lr_val)
            mu.append(row)
        return mu

    @staticmethod
    def compute_fuzzy_relation_max_min(mu_cpu: Sequence[float], mu_lat: Sequence[float]) -> list[list[float]]:
        """Cartesian Fuzzy Relation R(CPU, LAT) = min(mu_CPU(i), mu_LAT(j)) across (Low, Med, High)."""
        return [
            [round(min(float(a), float(b)), 4) for b in mu_lat[:3]]
            for a in mu_cpu[:3]
        ]

    @staticmethod
    def mamdani_centroid_defuzzify(w_norm: Sequence[float], rule_consequents: Sequence[float]) -> float:
        """Centroid (Center of Gravity) defuzzification over discretized output universe [1, 100]."""
        num = 0.0
        den = 1e-9
        for wk, fk in zip(w_norm, rule_consequents):
            rule_center = 1.0 + 99.0 / (1.0 + math.exp(-_clip(fk, -10.0, 10.0)))
            num += wk * rule_center
            den += wk
        return float(_clip(num / den, 1.0, 100.0))

    def apply_ga_structural_tuning(
        self, rule_mask: Sequence[int], center_shift: float = 0.0
    ) -> None:
        """Apply FLC-GA structural rule mask and bounded GA-based BPN premise weight shift."""
        if len(rule_mask) == len(self.rules) and sum(rule_mask) >= 4:
            self.active_rule_mask = [1 if int(b) > 0 else 0 for b in rule_mask]
        if abs(center_shift) > 1e-5:
            for m in range(4):
                for t in range(3):
                    low_b, high_b = self._term_bounds[t]
                    target_c = 0.7 * self.centers[m][t] + 0.3 * (self._base_centers[m][t] + center_shift * 0.12)
                    self.centers[m][t] = _clip(target_c, low_b, high_b)

    def forward_single(self, x: Sequence[float]) -> tuple[float, dict[str, Any]]:
        """Run 5-layer forward inference for a single server telemetry vector x = [cpu, mem, lat, conn]."""
        x_clipped = [_clip(float(v), 0.0, 1.0) for v in x[:4]]

        # McCulloch-Pitts Safety Gate & BPN XOR Contention Detector
        inhibitory = 1 if (x_clipped[0] > 0.97 and x_clipped[2] > 0.95) else 0
        mp_gate_open = self.mp_xor_gate.evaluate_mp_neuron([1, 1], inhibitory=inhibitory)
        xor_contention = self.mp_xor_gate.detect_xor_anomaly(x_clipped[0], x_clipped[2])

        # Layer 1: Fuzzification (4 features x 3 terms)
        mu = self._fuzzify(x_clipped)
        self._last_fuzzy_relation = self.compute_fuzzy_relation_max_min(mu[0], mu[2])

        # Layer 2: Rule Firing Strengths via Product T-Norm gated by FLC-GA structural rule mask
        w: list[float] = []
        for idx, r in enumerate(self.rules):
            mask_bit = float(self.active_rule_mask[idx])
            firing = (
                mask_bit
                * mu[0][r.cpu_term]
                * mu[1][r.mem_term]
                * mu[2][r.lat_term]
                * mu[3][r.conn_term]
            )
            w.append(firing)

        # Layer 3: Normalization
        w_sum = sum(w) + 1e-9
        w_norm = [val / w_sum for val in w]

        # Layer 4: Takagi-Sugeno First-Order Linear Consequent
        x_aug = [*x_clipped, 1.0]
        f_k: list[float] = [
            sum(c_val * x_val for c_val, x_val in zip(rule_coeffs, x_aug))
            for rule_coeffs in self.consequents
        ]

        # Layer 5: Dual Defuzzification (Takagi-Sugeno + Mamdani Centroid)
        raw_out = sum(wn * fk for wn, fk in zip(w_norm, f_k))
        sig = 1.0 / (1.0 + math.exp(-_clip(raw_out, -12.0, 12.0)))
        ts_score = float(1.0 + 99.0 * sig)
        centroid_score = self.mamdani_centroid_defuzzify(w_norm, f_k)
        self._last_centroid_score = round(centroid_score, 2)

        final_score = ts_score * (0.15 if mp_gate_open == 0 else 1.0)

        cache = {
            "x": x_clipped,
            "x_aug": x_aug,
            "mu": mu,
            "w": w,
            "w_sum": w_sum,
            "w_norm": w_norm,
            "f_k": f_k,
            "sig": sig,
            "score": final_score,
            "centroid_score": centroid_score,
            "mp_gate": mp_gate_open,
            "xor_contention": xor_contention,
        }
        return final_score, cache

    def step_online_learning(
        self, node_vectors: Sequence[Sequence[float]], observed_latencies_ms: Sequence[float]
    ) -> list[float]:
        """Run forward pass for all nodes and perform Momentum BPN + Delta Rule step."""
        scores: list[float] = []
        caches: list[dict[str, Any]] = []

        for vec in node_vectors:
            sc, cache = self.forward_single(vec)
            scores.append(sc)
            caches.append(cache)

        if not caches:
            return []

        num_rules = len(self.rules)
        n_caches = len(caches)
        self._last_rule_activations = [
            round(sum(c["w_norm"][k] for c in caches) / n_caches, 4)
            for k in range(num_rules)
        ]

        total_loss = 0.0
        for cache, lat_ms in zip(caches, observed_latencies_ms):
            x = cache["x"]
            lat_ratio = lat_ms / max(self.sla_target_ms, 10.0)
            target_sig = _clip(
                math.exp(-0.55 * (lat_ratio ** 1.4))
                * (1.0 - 0.55 * (x[0] ** 2) - 0.25 * (x[1] ** 2)),
                0.02,
                0.98,
            )
            pred_sig = cache["sig"]
            err = pred_sig - target_sig
            total_loss += 0.5 * (err * err)

            # Backpropagation error delta
            d_raw = err * pred_sig * (1.0 - pred_sig)

            # Layer 4 Momentum Backpropagation + Widrow-Hoff Delta Rule
            w_norm = cache["w_norm"]
            x_aug = cache["x_aug"]
            for k in range(num_rules):
                for j in range(5):
                    grad = _clip(w_norm[k] * d_raw * x_aug[j], -0.5, 0.5)
                    vel = self.momentum * self._vel_consequents[k][j] - self.learning_rate * grad
                    self._vel_consequents[k][j] = vel
                    self.consequents[k][j] += vel

            # Layer 1 Premise Gradients with Momentum
            f_k = cache["f_k"]
            weighted_f = sum(wn * fk for wn, fk in zip(w_norm, f_k))
            w_sum = cache["w_sum"]

            for k, r in enumerate(self.rules):
                d_wk = d_raw * (f_k[k] - weighted_f) / w_sum
                terms = (r.cpu_term, r.mem_term, r.lat_term, r.conn_term)
                for m, t_idx in enumerate(terms):
                    c_val = self.centers[m][t_idx]
                    s_val = max(self.sigmas[m][t_idx], 0.08)
                    diff = x[m] - c_val
                    d_log_mu_dc = diff / (s_val * s_val)
                    d_log_mu_ds = (diff * diff) / (s_val * s_val * s_val)

                    grad_c = _clip(d_wk * cache["w"][k] * d_log_mu_dc, -0.2, 0.2)
                    grad_s = _clip(d_wk * cache["w"][k] * d_log_mu_ds, -0.2, 0.2)
                    vel_c = (
                        self.momentum * self._vel_centers[m][t_idx]
                        - (self.learning_rate * 0.25) * grad_c
                    )
                    self._vel_centers[m][t_idx] = vel_c
                    low_b, high_b = self._term_bounds[t_idx]
                    self.centers[m][t_idx] = _clip(self.centers[m][t_idx] + vel_c, low_b, high_b)
                    self.sigmas[m][t_idx] = _clip(
                        self.sigmas[m][t_idx] - (self.learning_rate * 0.15) * grad_s,
                        0.10,
                        0.42,
                    )

        self._last_centroid_score = round(
            sum(float(c["centroid_score"]) for c in caches) / max(n_caches, 1), 2
        )
        self.epoch += 1
        mean_loss = float(total_loss / max(n_caches, 1))
        self.loss_history.append({"epoch": self.epoch, "loss": round(mean_loss, 6)})
        if len(self.loss_history) > 60:
            self.loss_history = self.loss_history[-60:]

        return scores

    def get_membership_curves(self, num_points: int = 25) -> dict[str, Any]:
        """Generate sampled Gaussian + LR-Fuzzy membership curves and hybrid state for UI."""
        xs = [i / max(1, num_points - 1) for i in range(num_points)]
        curves: dict[str, list[dict[str, float]]] = {}

        for m, feat_name in enumerate(self.FEATURE_NAMES):
            points: list[dict[str, float]] = []
            for x_val in xs:
                row: dict[str, float] = {"x": round(float(x_val), 3)}
                for t_idx, term_name in enumerate(self.TERM_NAMES):
                    c = float(self.centers[m][t_idx])
                    s = float(max(self.sigmas[m][t_idx], 0.08))
                    gauss = math.exp(-((x_val - c) ** 2) / (2.0 * s * s))
                    alpha_l, beta_r = self.lr_spreads[t_idx]
                    lr_val = self.evaluate_lr_fuzzy_number(x_val, c, alpha_l, beta_r)
                    row[term_name.lower()] = round(0.80 * gauss + 0.20 * lr_val, 4)
                points.append(row)
            curves[feat_name] = points

        return {
            "epoch": self.epoch,
            "learning_rate": self.learning_rate,
            "momentum": self.momentum,
            "current_loss": self.loss_history[-1]["loss"] if self.loss_history else 0.0,
            "centroid_defuzz_score": self._last_centroid_score,
            "active_rule_mask": "".join(str(b) for b in self.active_rule_mask),
            "active_rules_count": sum(self.active_rule_mask),
            "fuzzy_relation_matrix": self._last_fuzzy_relation,
            "loss_history": self.loss_history[-30:],
            "centers": {
                feat: {
                    self.TERM_NAMES[t].lower(): round(float(self.centers[m][t]), 4)
                    for t in range(3)
                }
                for m, feat in enumerate(self.FEATURE_NAMES)
            },
            "sigmas": {
                feat: {
                    self.TERM_NAMES[t].lower(): round(float(self.sigmas[m][t]), 4)
                    for t in range(3)
                }
                for m, feat in enumerate(self.FEATURE_NAMES)
            },
            "curves": curves,
            "rules": [
                {
                    "rule_id": r.rule_id,
                    "description": r.description,
                    "firing_strength": self._last_rule_activations[idx],
                    "enabled": bool(self.active_rule_mask[idx]),
                }
                for idx, r in enumerate(self.rules)
            ],
        }
