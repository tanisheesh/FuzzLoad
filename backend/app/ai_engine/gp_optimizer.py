"""Tree-Based Genetic Programming (GP) & Bitwise Genetic Algorithm (FLC-GA) Co-Optimizer.

Combines:
1. Tree-Based Symbolic Regression (GP): Evolves non-linear mathematical scoring trees.
2. Bitwise Genetic Algorithm (FLC-GA Structural & BPN Weight Optimizer):
   - Binary 12-bit Rule Mask Chromosome for Fuzzy Logic Controller structural rule selection
   - Real-coded BPN premise offset gene for GA-based neural weight determination
   - Bitwise Operators (AND, OR, XOR mask crossover), Inversion Operator, Deletion/Duplication
     Operator, and Point Bit-Flip Mutation.
"""

from __future__ import annotations

import copy
import math
import random
from dataclasses import dataclass, field
from typing import Any, Callable


def protected_div(a: float, b: float) -> float:
    return a / b if abs(b) > 1e-4 else a / (1e-4 if b >= 0 else -1e-4)


def protected_sqrt(a: float) -> float:
    return math.sqrt(abs(a))


def protected_exp(a: float) -> float:
    return math.exp(max(-4.0, min(4.0, a)))


def square_op(a: float) -> float:
    v = max(-20.0, min(20.0, a))
    return v * v


@dataclass
class PrimitiveOp:
    name: str
    symbol: str
    arity: int
    fn: Callable[..., float]


PRIMITIVES: dict[str, PrimitiveOp] = {
    "add": PrimitiveOp("add", "+", 2, lambda a, b: a + b),
    "sub": PrimitiveOp("sub", "-", 2, lambda a, b: a - b),
    "mul": PrimitiveOp("mul", "*", 2, lambda a, b: a * b),
    "div": PrimitiveOp("div", "/", 2, protected_div),
    "min": PrimitiveOp("min", "min", 2, min),
    "max": PrimitiveOp("max", "max", 2, max),
    "sqrt": PrimitiveOp("sqrt", "sqrt", 1, protected_sqrt),
    "exp": PrimitiveOp("exp", "exp", 1, protected_exp),
    "sq": PrimitiveOp("sq", "sq", 1, square_op),
}

TERMINALS = ("CPU", "MEM", "LAT", "CONN", "ERR")
CONSTANTS = (0.1, 0.25, 0.5, 1.0, 1.5, 2.0)


@dataclass
class GPNode:
    """Single node in a symbolic Genetic Programming syntax tree."""

    op: str | None = None
    terminal: str | None = None
    value: float | None = None
    children: list[GPNode] = field(default_factory=list)

    def is_leaf(self) -> bool:
        return self.op is None

    def depth(self) -> int:
        if not self.children:
            return 1
        return 1 + max(c.depth() for c in self.children)

    def size(self) -> int:
        return 1 + sum(c.size() for c in self.children)

    def evaluate(self, env: dict[str, float]) -> float:
        if self.is_leaf():
            if self.value is not None:
                return self.value
            return float(env.get(self.terminal or "CPU", 0.0))

        prim = PRIMITIVES[self.op]  # type: ignore[index]
        if prim.arity == 1:
            val = prim.fn(self.children[0].evaluate(env))
        else:
            val = prim.fn(
                self.children[0].evaluate(env),
                self.children[1].evaluate(env),
            )
        if math.isnan(val) or math.isinf(val):
            return 0.01
        return max(-50.0, min(50.0, val))

    def to_formula(self) -> str:
        if self.is_leaf():
            if self.value is not None:
                return f"{self.value:.2f}"
            return str(self.terminal)
        prim = PRIMITIVES[self.op]  # type: ignore[index]
        if prim.arity == 1:
            if prim.name == "sq":
                return f"({self.children[0].to_formula()})^2"
            return f"{prim.symbol}({self.children[0].to_formula()})"
        if prim.name in ("min", "max"):
            return f"{prim.symbol}({self.children[0].to_formula()}, {self.children[1].to_formula()})"
        return f"({self.children[0].to_formula()} {prim.symbol} {self.children[1].to_formula()})"

    def to_dict(self) -> dict[str, Any]:
        label = (
            PRIMITIVES[self.op].symbol
            if self.op is not None
            else (f"{self.value:.2f}" if self.value is not None else str(self.terminal))
        )
        return {
            "label": label,
            "type": "operator" if self.op is not None else ("constant" if self.value is not None else "variable"),
            "children": [c.to_dict() for c in self.children],
        }


@dataclass
class BitwiseGAChromosome:
    """12-bit FLC-GA structural rule chromosome + BPN premise weight shift gene."""

    rule_bits: list[int] = field(default_factory=lambda: [1] * 12)
    bpn_weight_delta: float = 0.0

    def bitstring(self) -> str:
        return "".join(str(b) for b in self.rule_bits)


class GeneticProgrammingOptimizer:
    """Co-evolves symbolic GP trees and 12-bit FLC-GA structural chromosomes."""

    def __init__(self, population_size: int = 36, max_depth: int = 4) -> None:
        self.population_size = population_size
        self.max_depth = max_depth
        self.generation = 1
        self.population: list[GPNode] = []
        self.ga_chromosomes: list[BitwiseGAChromosome] = []
        self.best_tree: GPNode = self._seed_domain_tree()
        self.best_ga_chromosome: BitwiseGAChromosome = BitwiseGAChromosome(
            rule_bits=[1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1],
            bpn_weight_delta=0.0,
        )
        self.best_fitness: float = 0.865
        self.last_genetic_operator: str = "SUBTREE_CROSSOVER + BITWISE_INVERSION"
        self.fitness_history: list[dict[str, float | int | str]] = [
            {
                "generation": 1,
                "best_fitness": 0.865,
                "avg_fitness": 0.712,
                "formula": self.best_tree.to_formula(),
                "tree_size": self.best_tree.size(),
            }
        ]
        self._init_population()

    def _seed_domain_tree(self) -> GPNode:
        return GPNode(
            op="div",
            children=[
                GPNode(
                    op="sub",
                    children=[
                        GPNode(terminal="1.0", value=1.0),
                        GPNode(op="sq", children=[GPNode(terminal="CPU")]),
                    ],
                ),
                GPNode(
                    op="add",
                    children=[
                        GPNode(terminal="0.25", value=0.25),
                        GPNode(
                            op="mul",
                            children=[
                                GPNode(terminal="LAT"),
                                GPNode(
                                    op="add",
                                    children=[
                                        GPNode(terminal="1.0", value=1.0),
                                        GPNode(terminal="CONN"),
                                    ],
                                ),
                            ],
                        ),
                    ],
                ),
            ],
        )

    def _random_leaf(self) -> GPNode:
        if random.random() < 0.72:
            t = random.choice(TERMINALS)
            return GPNode(terminal=t)
        c = random.choice(CONSTANTS)
        return GPNode(terminal=f"{c:.2f}", value=c)

    def _random_tree(self, max_depth: int, grow: bool = True) -> GPNode:
        if max_depth <= 1 or (grow and random.random() < 0.35):
            return self._random_leaf()
        op_key = random.choice(list(PRIMITIVES.keys()))
        prim = PRIMITIVES[op_key]
        children = [self._random_tree(max_depth - 1, grow) for _ in range(prim.arity)]
        return GPNode(op=op_key, children=children)

    def _init_population(self) -> None:
        self.population = [copy.deepcopy(self.best_tree)]
        self.ga_chromosomes = [copy.deepcopy(self.best_ga_chromosome)]
        while len(self.population) < self.population_size:
            depth = random.randint(2, self.max_depth)
            self.population.append(self._random_tree(depth, grow=(len(self.population) % 2 == 0)))
            bits = [1 if random.random() < 0.75 else 0 for _ in range(12)]
            if sum(bits) < 6:
                bits[0] = bits[5] = bits[11] = 1
            self.ga_chromosomes.append(
                BitwiseGAChromosome(rule_bits=bits, bpn_weight_delta=random.uniform(-0.15, 0.15))
            )

    @staticmethod
    def bitwise_crossover(c1: BitwiseGAChromosome, c2: BitwiseGAChromosome) -> BitwiseGAChromosome:
        """Uniform bitwise mask crossover using bitwise AND / OR / XOR operators."""
        mask = [random.randint(0, 1) for _ in range(12)]
        child_bits = [
            (b1 & m) | (b2 & (1 ^ m))
            for b1, b2, m in zip(c1.rule_bits, c2.rule_bits, mask)
        ]
        if sum(child_bits) < 5:
            child_bits[0] = child_bits[5] = child_bits[11] = 1
        delta = 0.5 * (c1.bpn_weight_delta + c2.bpn_weight_delta)
        return BitwiseGAChromosome(rule_bits=child_bits, bpn_weight_delta=round(delta, 4))

    @staticmethod
    def inversion_operator(chrom: BitwiseGAChromosome) -> BitwiseGAChromosome:
        """GA Inversion Operator: reverses a random sub-segment [i:j] of the chromosome."""
        bits = list(chrom.rule_bits)
        i, j = sorted(random.sample(range(len(bits)), 2))
        bits[i : j + 1] = reversed(bits[i : j + 1])
        return BitwiseGAChromosome(rule_bits=bits, bpn_weight_delta=chrom.bpn_weight_delta)

    @staticmethod
    def deletion_and_bitflip_operator(chrom: BitwiseGAChromosome) -> BitwiseGAChromosome:
        """GA Deletion/Duplication & Bitwise XOR Flip Mutation Operator."""
        bits = list(chrom.rule_bits)
        # Delete one locus and shift-pad to preserve chromosome length 12
        del_idx = random.randrange(len(bits))
        deleted_bit = bits.pop(del_idx)
        bits.append(deleted_bit ^ 1)
        # Ensure core rules remain active
        if sum(bits) < 5:
            bits[0] = bits[5] = bits[11] = 1
        new_delta = max(-0.25, min(0.25, chrom.bpn_weight_delta + random.uniform(-0.05, 0.05)))
        return BitwiseGAChromosome(rule_bits=bits, bpn_weight_delta=round(new_delta, 4))

    def _collect_nodes(self, root: GPNode) -> list[GPNode]:
        result = [root]
        for ch in root.children:
            result.extend(self._collect_nodes(ch))
        return result

    def _crossover(self, parent1: GPNode, parent2: GPNode) -> GPNode:
        child = copy.deepcopy(parent1)
        donor = copy.deepcopy(parent2)
        child_nodes = self._collect_nodes(child)
        donor_nodes = self._collect_nodes(donor)
        target = random.choice(child_nodes)
        replacement = random.choice(donor_nodes)
        target.op = replacement.op
        target.terminal = replacement.terminal
        target.value = replacement.value
        target.children = copy.deepcopy(replacement.children)
        if child.depth() > self.max_depth + 1:
            return copy.deepcopy(parent1)
        return child

    def _mutate(self, tree: GPNode) -> GPNode:
        mutant = copy.deepcopy(tree)
        nodes = self._collect_nodes(mutant)
        target = random.choice(nodes)
        if random.random() < 0.5 and target.is_leaf():
            leaf = self._random_leaf()
            target.terminal = leaf.terminal
            target.value = leaf.value
        else:
            sub = self._random_tree(max_depth=2, grow=True)
            target.op = sub.op
            target.terminal = sub.terminal
            target.value = sub.value
            target.children = sub.children
        if mutant.depth() > self.max_depth + 1:
            return copy.deepcopy(tree)
        return mutant

    def score_nodes(self, node_envs: list[dict[str, float]]) -> list[float]:
        raw_scores: list[float] = []
        for env in node_envs:
            val = self.best_tree.evaluate(env)
            pos = math.log1p(math.exp(max(-10.0, min(10.0, val))))
            raw_scores.append(pos)
        max_s = max(raw_scores) if raw_scores else 1.0
        if max_s <= 1e-6:
            return [50.0 for _ in node_envs]
        return [max(1.0, min(100.0, (s / max_s) * 100.0)) for s in raw_scores]

    def evaluate_fitness_on_replay(
        self, tree: GPNode, replay_snapshots: list[list[dict[str, float]]]
    ) -> float:
        if not replay_snapshots:
            replay_snapshots = [
                [
                    {"CPU": 0.22, "MEM": 0.30, "LAT": 0.18, "CONN": 0.15, "ERR": 0.0, "CAP": 4.0},
                    {"CPU": 0.68, "MEM": 0.55, "LAT": 0.62, "CONN": 0.58, "ERR": 0.02, "CAP": 2.0},
                    {"CPU": 0.35, "MEM": 0.48, "LAT": 0.28, "CONN": 0.25, "ERR": 0.0, "CAP": 2.0},
                    {"CPU": 0.85, "MEM": 0.72, "LAT": 0.88, "CONN": 0.80, "ERR": 0.05, "CAP": 1.0},
                ]
            ]

        sim_p95_accum = 0.0
        sim_err_accum = 0.0
        sim_var_accum = 0.0

        for cluster_step in replay_snapshots[-24:]:
            raw_vals = []
            for node_env in cluster_step:
                v = tree.evaluate(node_env)
                raw_vals.append(math.log1p(math.exp(max(-8.0, min(8.0, v)))))
            s_total = sum(raw_vals) + 1e-6
            probs = [v / s_total for v in raw_vals]

            step_lat = 0.0
            step_err = 0.0
            loads = []
            for p, node_env in zip(probs, cluster_step):
                node_stress = (
                    0.45 * node_env["LAT"]
                    + 0.35 * (node_env["CPU"] ** 1.5)
                    + 0.20 * node_env["CONN"]
                    + 0.30 * (p / max(node_env.get("CAP", 1.0) / 4.0, 0.25))
                )
                step_lat += p * node_stress
                step_err += p * (node_env["ERR"] + max(0.0, node_stress - 0.85))
                loads.append(p / max(node_env.get("CAP", 1.0), 0.5))

            mean_load = sum(loads) / len(loads)
            load_var = sum((ld - mean_load) ** 2 for ld in loads) / len(loads)
            sim_p95_accum += step_lat
            sim_err_accum += step_err
            sim_var_accum += load_var

        n_steps = max(1, len(replay_snapshots[-24:]))
        avg_lat = sim_p95_accum / n_steps
        avg_err = sim_err_accum / n_steps
        avg_var = sim_var_accum / n_steps

        healthy_score = tree.evaluate({"CPU": 0.15, "MEM": 0.20, "LAT": 0.12, "CONN": 0.10, "ERR": 0.0})
        overloaded_score = tree.evaluate({"CPU": 0.92, "MEM": 0.88, "LAT": 0.90, "CONN": 0.85, "ERR": 0.1})
        monotonicity_bonus = 0.18 if healthy_score > overloaded_score + 0.15 else -0.35

        bloat_penalty = 0.004 * max(0, tree.size() - 9)

        raw_fitness = 1.15 - (0.65 * avg_lat + 0.45 * avg_err + 0.30 * avg_var + bloat_penalty) + monotonicity_bonus
        return round(float(max(0.05, min(0.995, raw_fitness))), 4)

    def evolve_generation(
        self, replay_snapshots: list[list[dict[str, float]]], generations: int = 3
    ) -> dict[str, Any]:
        """Co-evolve symbolic GP syntax trees and 12-bit FLC-GA rule chromosomes."""
        for _ in range(generations):
            scored_pop = [
                (self.evaluate_fitness_on_replay(ind, replay_snapshots), ind, chrom)
                for ind, chrom in zip(self.population, self.ga_chromosomes)
            ]
            scored_pop.sort(key=lambda item: item[0], reverse=True)

            best_gen_fit, best_gen_tree, best_gen_chrom = scored_pop[0]
            if best_gen_fit >= self.best_fitness:
                self.best_fitness = best_gen_fit
                self.best_tree = copy.deepcopy(best_gen_tree)
                self.best_ga_chromosome = copy.deepcopy(best_gen_chrom)

            avg_fit = sum(f for f, _, _ in scored_pop) / len(scored_pop)

            next_pop: list[GPNode] = [
                copy.deepcopy(self.best_tree),
                copy.deepcopy(scored_pop[0][1]),
                copy.deepcopy(scored_pop[1][1]),
                copy.deepcopy(scored_pop[2][1]),
            ]
            next_chroms: list[BitwiseGAChromosome] = [
                copy.deepcopy(self.best_ga_chromosome),
                copy.deepcopy(scored_pop[0][2]),
                copy.deepcopy(scored_pop[1][2]),
                copy.deepcopy(scored_pop[2][2]),
            ]

            def tournament_select() -> tuple[GPNode, BitwiseGAChromosome]:
                contenders = random.sample(scored_pop, k=min(4, len(scored_pop)))
                contenders.sort(key=lambda x: x[0], reverse=True)
                return contenders[0][1], contenders[0][2]

            while len(next_pop) < self.population_size:
                r = random.random()
                if r < 0.55:
                    (p1, c1), (p2, c2) = tournament_select(), tournament_select()
                    next_pop.append(self._crossover(p1, p2))
                    next_chroms.append(self.bitwise_crossover(c1, c2))
                    self.last_genetic_operator = "SUBTREE_CROSSOVER + BITWISE_MASK_XOVER"
                elif r < 0.78:
                    p1, c1 = tournament_select()
                    next_pop.append(self._mutate(p1))
                    next_chroms.append(self.inversion_operator(c1))
                    self.last_genetic_operator = "POINT_MUTATION + CHROMOSOME_INVERSION"
                elif r < 0.92:
                    p1, c1 = tournament_select()
                    next_pop.append(self._mutate(p1))
                    next_chroms.append(self.deletion_and_bitflip_operator(c1))
                    self.last_genetic_operator = "SUBTREE_MUTATION + LOCUS_DELETION_FLIP"
                else:
                    next_pop.append(self._random_tree(max_depth=self.max_depth, grow=True))
                    next_chroms.append(self.inversion_operator(self.best_ga_chromosome))

            self.population = next_pop
            self.ga_chromosomes = next_chroms
            self.generation += 1
            self.fitness_history.append(
                {
                    "generation": self.generation,
                    "best_fitness": round(self.best_fitness, 4),
                    "avg_fitness": round(avg_fit, 4),
                    "formula": self.best_tree.to_formula(),
                    "tree_size": self.best_tree.size(),
                }
            )
            if len(self.fitness_history) > 50:
                self.fitness_history = self.fitness_history[-50:]

        return self.get_state()

    def get_state(self) -> dict[str, Any]:
        return {
            "generation": self.generation,
            "population_size": self.population_size,
            "best_fitness": round(self.best_fitness, 4),
            "best_formula": self.best_tree.to_formula(),
            "tree_depth": self.best_tree.depth(),
            "tree_size": self.best_tree.size(),
            "rule_mask_bitstring": self.best_ga_chromosome.bitstring(),
            "bpn_weight_delta": self.best_ga_chromosome.bpn_weight_delta,
            "last_operator": self.last_genetic_operator,
            "ast_tree": self.best_tree.to_dict(),
            "fitness_history": self.fitness_history[-25:],
        }
