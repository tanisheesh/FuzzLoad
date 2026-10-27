"""5-Layer Differentiable Takagi-Sugeno Adaptive Neuro-Fuzzy Inference System (ANFIS).

Implements all 5 neural-fuzzy layers with online analytical backpropagation:
- Layer 1 (Fuzzification): Trainable Gaussian Membership Functions (Low, Medium, High)
- Layer 2 (Rule Firing): Product T-Norm firing strength across fuzzy rule base
- Layer 3 (Normalization): Normalized rule firing weights
- Layer 4 (Takagi-Sugeno Consequents): First-order linear consequent neurons
- Layer 5 (Defuzzification): Weighted sum mapped to server capacity score in (0, 100]
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


class TakagiSugenoANFIS:
    """5-Layer Differentiable Neuro-Fuzzy Controller for real-time server scoring."""

    TERM_NAMES = ("Low", "Medium", "High")
    FEATURE_NAMES = ("cpu", "memory", "latency", "connections")

    def __init__(self, learning_rate: float = 0.015, sla_target_ms: float = 85.0) -> None:
        self.learning_rate = learning_rate
        self.sla_target_ms = sla_target_ms
        self.epoch = 0
        self.loss_history: list[dict[str, float | int]] = []

        # Layer 1 Premise Parameters: shape (4 features, 3 linguistic terms: Low, Med, High)
        self.centers: list[list[float]] = [
            [0.18, 0.50, 0.84],  # CPU
            [0.20, 0.52, 0.85],  # Memory
            [0.15, 0.45, 0.80],  # Normalized Latency
            [0.18, 0.48, 0.82],  # Normalized Active Connections
        ]
        self.sigmas: list[list[float]] = [
            [0.24, 0.24, 0.24] for _ in range(4)
        ]

        # Curated 12-rule Takagi-Sugeno rule base covering key operational regimes
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

        # Layer 4 Consequent Parameters: 12 rules x 5 coeffs [p_cpu, q_mem, r_lat, s_conn, bias]
        self.consequents: list[list[float]] = [
            [-0.65, -0.35, -0.80, -0.45, 2.40],   # Rule 1: Very High capacity
            [-0.70, -0.35, -0.85, -0.50, 1.85],   # Rule 2: High capacity
            [-0.75, -0.40, -0.80, -0.50, 1.75],   # Rule 3: High capacity
            [-0.85, -0.45, -0.95, -0.60, 1.15],   # Rule 4: Moderate capacity
            [-1.10, -0.50, -0.90, -0.65, 0.55],   # Rule 5: Reduced capacity
            [-0.90, -0.50, -1.65, -0.85, 0.15],   # Rule 6: I/O bottleneck penalty
            [-1.00, -0.55, -1.20, -1.30, 0.25],   # Rule 7: Connection saturation
            [-0.95, -1.25, -1.10, -0.70, 0.30],   # Rule 8: Memory pressure
            [-1.45, -0.65, -1.40, -1.10, -0.55],  # Rule 9: Very Low
            [-1.25, -0.65, -1.75, -1.15, -0.65],  # Rule 10: Very Low
            [-1.35, -1.45, -1.85, -1.25, -1.10],  # Rule 11: Critical
            [-1.80, -1.50, -2.10, -1.50, -1.65],  # Rule 12: Critical Zero
        ]

        self._last_rule_activations: list[float] = [1.0 / len(self.rules)] * len(self.rules)

    def _fuzzify(self, x: list[float]) -> list[list[float]]:
        """Layer 1: Compute Gaussian membership degrees mu(x) of shape (4, 3)."""
        mu: list[list[float]] = []
        for m in range(4):
            row: list[float] = []
            for t in range(3):
                diff = x[m] - self.centers[m][t]
                sigma = max(self.sigmas[m][t], 0.06)
                row.append(math.exp(-(diff * diff) / (2.0 * sigma * sigma)))
            mu.append(row)
        return mu

    def forward_single(self, x: Sequence[float]) -> tuple[float, dict[str, Any]]:
        """Run 5-layer forward inference for a single server telemetry vector x = [cpu, mem, lat, conn]."""
        x_clipped = [_clip(float(v), 0.0, 1.0) for v in x[:4]]

        # Layer 1: Fuzzification (4 features x 3 terms)
        mu = self._fuzzify(x_clipped)

        # Layer 2: Rule Firing Strengths via Product T-Norm
        w: list[float] = []
        for r in self.rules:
            firing = (
                mu[0][r.cpu_term]
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

        # Layer 5: Defuzzified Output Score mapped via sigmoid into (1.0, 100.0)
        raw_out = sum(wn * fk for wn, fk in zip(w_norm, f_k))
        sig = 1.0 / (1.0 + math.exp(-_clip(raw_out, -12.0, 12.0)))
        score = float(1.0 + 99.0 * sig)

        cache = {
            "x": x_clipped,
            "x_aug": x_aug,
            "mu": mu,
            "w": w,
            "w_sum": w_sum,
            "w_norm": w_norm,
            "f_k": f_k,
            "sig": sig,
            "score": score,
        }
        return score, cache

    def step_online_learning(
        self, node_vectors: Sequence[Sequence[float]], observed_latencies_ms: Sequence[float]
    ) -> list[float]:
        """Run forward pass for all nodes and perform online gradient descent step."""
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

            # Backpropagation: dL/d(raw_out) = (pred_sig - target_sig) * pred_sig * (1 - pred_sig)
            d_raw = err * pred_sig * (1.0 - pred_sig)

            # Layer 4 Gradients: dL/d(consequents_k) = d_raw * w_norm_k * x_aug
            w_norm = cache["w_norm"]
            x_aug = cache["x_aug"]
            for k in range(num_rules):
                for j in range(5):
                    grad = _clip(w_norm[k] * d_raw * x_aug[j], -0.5, 0.5)
                    self.consequents[k][j] -= self.learning_rate * grad

            # Layer 1 Premise Gradients: dL/d(centers) and dL/d(sigmas)
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
                    self.centers[m][t_idx] = _clip(
                        self.centers[m][t_idx] - (self.learning_rate * 0.25) * grad_c,
                        0.05,
                        0.95,
                    )
                    self.sigmas[m][t_idx] = _clip(
                        self.sigmas[m][t_idx] - (self.learning_rate * 0.15) * grad_s,
                        0.10,
                        0.42,
                    )

        self.epoch += 1
        mean_loss = float(total_loss / max(n_caches, 1))
        self.loss_history.append({"epoch": self.epoch, "loss": round(mean_loss, 6)})
        if len(self.loss_history) > 60:
            self.loss_history = self.loss_history[-60:]

        return scores

    def get_membership_curves(self, num_points: int = 25) -> dict[str, Any]:
        """Generate sampled Gaussian membership curves (Low, Medium, High) for live UI visualization."""
        xs = [i / max(1, num_points - 1) for i in range(num_points)]
        curves: dict[str, list[dict[str, float]]] = {}

        for m, feat_name in enumerate(self.FEATURE_NAMES):
            points: list[dict[str, float]] = []
            for x_val in xs:
                row: dict[str, float] = {"x": round(float(x_val), 3)}
                for t_idx, term_name in enumerate(self.TERM_NAMES):
                    c = float(self.centers[m][t_idx])
                    s = float(max(self.sigmas[m][t_idx], 0.08))
                    mu_val = math.exp(-((x_val - c) ** 2) / (2.0 * s * s))
                    row[term_name.lower()] = round(mu_val, 4)
                points.append(row)
            curves[feat_name] = points

        return {
            "epoch": self.epoch,
            "learning_rate": self.learning_rate,
            "current_loss": self.loss_history[-1]["loss"] if self.loss_history else 0.0,
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
                }
                for idx, r in enumerate(self.rules)
            ],
        }
