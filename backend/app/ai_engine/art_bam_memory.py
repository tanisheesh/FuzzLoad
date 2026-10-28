"""Adaptive Resonance Theory (ART1 / ART2) & Exponential Bidirectional Associative Memory (BAM).

Provides unsupervised traffic regime clustering and fast associative routing weight recall:
1. ART1: Binary fault-signature pattern clustering using intersection operators and vigilance test.
2. ART2: Continuous telemetry vector clustering with attentional/orienting subsystems and Delta Rule updates.
3. Exponential BAM (Autocorrelator & Heterocorrelator): Associates traffic/fault regimes (X) with
   pre-converged routing weight priors (Y) using Wang et al. multiple-training encoding weight factors
   and exponential similarity kernels.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Sequence


def _l2_norm(vec: Sequence[float]) -> float:
    return math.sqrt(sum(v * v for v in vec)) + 1e-9


def _normalize(vec: Sequence[float]) -> list[float]:
    n = _l2_norm(vec)
    return [float(v) / n for v in vec]


@dataclass
class ResonanceCategory:
    category_id: int
    label: str
    prototype: list[float]
    hits: int = 1


class AdaptiveResonanceART1:
    """ART1 binary clustering for 4-bit server fault signatures [CPU_HI, MEM_HI, IO_LAG, ERR_HI]."""

    def __init__(self, num_features: int = 4, vigilance: float = 0.70) -> None:
        self.num_features = num_features
        self.vigilance = vigilance
        self.prototypes: list[tuple[str, list[int]]] = [
            ("NOMINAL_BINARY_STATE", [0, 0, 0, 0]),
            ("COMPUTE_PRESSURE_SIGNATURE", [1, 0, 0, 0]),
            ("IO_STALL_SIGNATURE", [0, 0, 1, 0]),
            ("COMPOUND_DEGRADATION_SIGNATURE", [1, 1, 1, 1]),
        ]

    def classify_binary_signature(self, binary_input: Sequence[int]) -> dict[str, Any]:
        inp = [1 if int(b) > 0 else 0 for b in binary_input[: self.num_features]]
        inp_sum = sum(inp)
        if inp_sum == 0:
            return {
                "signature": "".join(str(b) for b in inp),
                "matched_category": "NOMINAL_BINARY_STATE",
                "match_ratio": 1.0,
                "vigilance": self.vigilance,
                "resonated": True,
            }

        best_label = "UNCLASSIFIED_FAULT"
        best_ratio = 0.0
        for label, proto in self.prototypes:
            # Logical AND intersection (bitwise conjunction)
            intersection = [a & b for a, b in zip(inp, proto)]
            match_ratio = sum(intersection) / float(inp_sum)
            if match_ratio >= self.vigilance and match_ratio >= best_ratio:
                best_ratio = match_ratio
                best_label = label

        resonated = best_ratio >= self.vigilance
        if not resonated and len(self.prototypes) < 12:
            new_label = f"LEARNED_FAULT_SIG_{len(self.prototypes) + 1}"
            self.prototypes.append((new_label, list(inp)))
            best_label = new_label
            best_ratio = 1.0
            resonated = True

        return {
            "signature": "".join(str(b) for b in inp),
            "matched_category": best_label,
            "match_ratio": round(best_ratio, 4),
            "vigilance": self.vigilance,
            "resonated": resonated,
        }


class AdaptiveResonanceART2:
    """ART2 continuous pattern clustering with Delta Rule prototype adaptation."""

    def __init__(self, vigilance: float = 0.86, learning_rate: float = 0.18) -> None:
        self.vigilance = vigilance
        self.learning_rate = learning_rate
        self.categories: list[ResonanceCategory] = [
            ResonanceCategory(1, "REGIME_01 // BALANCED_STEADY", _normalize([0.28, 0.30, 0.18, 0.22])),
            ResonanceCategory(2, "REGIME_02 // COMPUTE_SATURATION", _normalize([0.82, 0.55, 0.58, 0.60])),
            ResonanceCategory(3, "REGIME_03 // IO_LATENCY_STALL", _normalize([0.32, 0.45, 0.88, 0.52])),
            ResonanceCategory(4, "REGIME_04 // FLASH_CROWD_SURGE", _normalize([0.75, 0.72, 0.76, 0.90])),
        ]
        self.last_match: dict[str, Any] = {}

    def classify_and_learn(self, feature_vec: Sequence[float]) -> dict[str, Any]:
        """Run ART2 attentional matching, orienting vigilance check, and Delta Rule prototype update."""
        norm_in = _normalize(feature_vec[:4])

        best_cat: ResonanceCategory | None = None
        best_sim = -1.0

        for cat in self.categories:
            # Cosine similarity in F1/F2 attentional subsystem
            sim = sum(x * w for x, w in zip(norm_in, cat.prototype))
            if sim > best_sim:
                best_sim = sim
                best_cat = cat

        # Orienting subsystem vigilance test
        if best_cat is not None and best_sim >= self.vigilance:
            # Delta Rule prototype update: w_new = w_old + eta * (x - w_old)
            updated = [
                w + self.learning_rate * (x - w)
                for x, w in zip(norm_in, best_cat.prototype)
            ]
            best_cat.prototype = _normalize(updated)
            best_cat.hits += 1
            resonated = True
            active_cat = best_cat
        else:
            # Allocate new resonance category if vigilance threshold is not met
            new_id = len(self.categories) + 1
            active_cat = ResonanceCategory(
                new_id,
                f"REGIME_0{new_id} // ADAPTIVE_CLUSTER",
                list(norm_in),
                hits=1,
            )
            if len(self.categories) < 8:
                self.categories.append(active_cat)
            best_sim = 1.0
            resonated = False

        self.last_match = {
            "category_id": active_cat.category_id,
            "regime_label": active_cat.label,
            "similarity": round(float(best_sim), 4),
            "vigilance": self.vigilance,
            "resonated": resonated,
            "total_categories": len(self.categories),
            "hits": active_cat.hits,
        }
        return self.last_match


class ExponentialBAMAssociativeMemory:
    """Exponential Bidirectional Associative Memory (Heterocorrelator + Autocorrelator).

    Uses Wang et al. multiple-training encoding weight factors to associate
    4D cluster stress patterns X with 4D optimal server routing weight priors Y.
    """

    def __init__(self, gamma: float = 2.4, base_b: float = math.e) -> None:
        self.gamma = gamma
        self.base_b = base_b
        # Stored real-coded pattern pairs (X_k: stress vector, Y_k: routing weight prior, alpha_k: multiplicity)
        self.memory_pairs: list[tuple[list[float], list[float], float]] = [
            # Balanced cluster -> capacity-proportional prior
            ([0.25, 0.30, 0.20, 0.18], [0.44, 0.23, 0.24, 0.09], 1.2),
            # Node-2 degraded -> drain Node-2, boost Node-1 & Node-3
            ([0.30, 0.85, 0.28, 0.35], [0.52, 0.06, 0.34, 0.08], 1.5),
            # Node-1 degraded -> shift traffic to Node-2 & Node-3
            ([0.88, 0.32, 0.30, 0.35], [0.10, 0.41, 0.40, 0.09], 1.4),
            # High load across small nodes -> concentrate on 4c Node-1
            ([0.42, 0.72, 0.68, 0.85], [0.56, 0.19, 0.20, 0.05], 1.3),
        ]
        # Autocorrelator correlation matrix M = sum(alpha_k * x_k * x_k^T)
        self.autocorrelator_matrix: list[list[float]] = self._build_autocorrelator()

    def _build_autocorrelator(self) -> list[list[float]]:
        mat = [[0.0 for _ in range(4)] for _ in range(4)]
        for x_pat, _, multiplicity in self.memory_pairs:
            for i in range(4):
                for j in range(4):
                    mat[i][j] += multiplicity * x_pat[i] * x_pat[j]
        return mat

    def encode_pattern_pair(
        self, x_pattern: Sequence[float], y_weights: Sequence[float], multiplicity: float = 1.25
    ) -> None:
        """Store or reinforce a real-coded pattern pair using Wang et al. multiple-training encoding."""
        x_clean = [round(float(v), 4) for v in x_pattern[:4]]
        y_clean = [round(float(v), 4) for v in y_weights[:4]]
        self.memory_pairs.append((x_clean, y_clean, float(multiplicity)))
        if len(self.memory_pairs) > 16:
            self.memory_pairs = self.memory_pairs[-16:]
        self.autocorrelator_matrix = self._build_autocorrelator()

    def forward_heterocorrelator_recall(self, x_query: Sequence[float]) -> tuple[list[float], float]:
        """Recall routing weight prior Y from input stress vector X via Exponential BAM kernel."""
        q = [float(v) for v in x_query[:4]]
        recalled = [0.0, 0.0, 0.0, 0.0]
        total_activation = 0.0
        best_resonance = 0.0

        for x_pat, y_pat, multiplicity in self.memory_pairs:
            dist_sq = sum((a - b) ** 2 for a, b in zip(q, x_pat))
            # Exponential BAM activation: alpha_k * b^(-gamma * ||x - x_k||^2)
            weight = multiplicity * (self.base_b ** (-self.gamma * dist_sq))
            best_resonance = max(best_resonance, weight / max(multiplicity, 1.0))
            total_activation += weight
            for j in range(4):
                recalled[j] += weight * y_pat[j]

        if total_activation <= 1e-9:
            return [0.25, 0.25, 0.25, 0.25], 0.0

        norm_y = [max(0.01, v / total_activation) for v in recalled]
        s = sum(norm_y)
        return [round(v / s, 4) for v in norm_y], round(float(best_resonance), 4)

    def backward_pass_recall(self, y_query: Sequence[float]) -> list[float]:
        """Bidirectional backward pass: recall stress prototype X given routing weight vector Y."""
        yq = [float(v) for v in y_query[:4]]
        recalled_x = [0.0, 0.0, 0.0, 0.0]
        total_w = 0.0
        for x_pat, y_pat, multiplicity in self.memory_pairs:
            dist_sq = sum((a - b) ** 2 for a, b in zip(yq, y_pat))
            w = multiplicity * (self.base_b ** (-self.gamma * dist_sq))
            total_w += w
            for i in range(4):
                recalled_x[i] += w * x_pat[i]
        if total_w <= 1e-9:
            return [0.25, 0.25, 0.25, 0.25]
        return [round(v / total_w, 4) for v in recalled_x]
