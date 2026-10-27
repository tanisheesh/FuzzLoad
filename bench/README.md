# FuzzLoad — Benchmark Methodology & Results

Reproducible benchmark comparing **FuzzLoad (Genetic Programming + 5-Layer ANFIS)** against 4 classical and single-loop baselines on an identical heterogeneous 4-node cluster (`4c`, `2c`, `2c`, `1c`) at `480 RPS` with synthetic CPU and I/O contention injected on `Node-2`.

## Run the Benchmark

```bash
python bench/run_benchmark.py
```

## Results

| Algorithm | P50 (ms) | P95 Tail (ms) | P99 (ms) | Throughput (RPS) | Error Rate (%) | Jain's Fairness |
|---|---:|---:|---:|---:|---:|---:|
| **Round Robin (Static)** | 48.6 | 112.4 | 156.8 | 438.2 | 4.15% | 0.7120 |
| **Least Connections** | 36.2 | 78.5 | 109.4 | 461.0 | 1.85% | 0.8340 |
| **Weighted Round Robin** | 33.8 | 71.2 | 98.7 | 466.5 | 1.42% | 0.8610 |
| **ANFIS Neuro-Fuzzy Only** | 23.4 | 42.6 | 61.2 | 477.8 | 0.24% | 0.9460 |
| **FuzzLoad (GP + ANFIS)** | **19.8** | **34.2** | **49.5** | **479.6** | **0.04%** | **0.9740** |

---

<div align="center">

<h3>Tanish Poddar &amp; Krish</h3>

<p>
  <strong>Tanish Poddar</strong> ·
  <a href="https://tanisheesh.in"><img src="https://img.shields.io/badge/Website-tanisheesh.in-111111?style=flat-square&logo=googlechrome&logoColor=white" alt="Website"></a>
  <a href="https://linkedin.com/in/tanisheesh"><img src="https://img.shields.io/badge/LinkedIn-tanisheesh-0A66C2?style=flat-square" alt="LinkedIn"></a>
  <a href="https://github.com/tanisheesh"><img src="https://img.shields.io/badge/GitHub-tanisheesh-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub"></a>
  <a href="mailto:hi@tanisheesh.in"><img src="https://img.shields.io/badge/Email-hey%40tanisheesh.in-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Email"></a>
</p>

<p>
  <strong>Krish</strong> ·
  <a href="https://github.com/krish-codess"><img src="https://img.shields.io/badge/GitHub-krish--codess-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub"></a>
  <a href="mailto:krishnakulgohel544@gmail.com"><img src="https://img.shields.io/badge/Email-krishnakulgohel544%40gmail.com-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Email"></a>
</p>

</div>
