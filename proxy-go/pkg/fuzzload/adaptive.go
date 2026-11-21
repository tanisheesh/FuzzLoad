package fuzzload

import (
	"context"
	"math"
	"time"
)

// AdaptiveConfig tunes the standalone pure-Go Neuro-Fuzzy + GP auto-adaptation loop.
type AdaptiveConfig struct {
	Interval       time.Duration
	SLATargetMs    float64
	BlendingLambda float64 // Weight on Neuro-Fuzzy score vs symbolic GP score [0..1]
	EMAAlpha       float64 // Exponential moving average smoothing factor (0..1]
}

// DefaultAdaptiveConfig returns balanced defaults for standalone pure-Go load balancing.
func DefaultAdaptiveConfig() AdaptiveConfig {
	return AdaptiveConfig{
		Interval:       500 * time.Millisecond,
		SLATargetMs:    85.0,
		BlendingLambda: 0.58,
		EMAAlpha:       0.45,
	}
}

func gaussianMF(x, center, sigma float64) float64 {
	if sigma < 1e-4 {
		sigma = 1e-4
	}
	d := (x - center) / sigma
	return math.Exp(-0.5 * d * d)
}

// evaluatePureGoNeuroFuzzy computes a 9-rule Gaussian Takagi-Sugeno capacity score in [1, 100]
// from normalized latency, connection pressure, CPU usage, and error rate.
func evaluatePureGoNeuroFuzzy(latNorm, connNorm, cpuNorm, errRate float64) float64 {
	// Gaussian membership degrees (Low, Medium, High) over Latency & Effective Load
	load := math.Min(1.0, 0.55*cpuNorm+0.45*connNorm)

	lLow := gaussianMF(latNorm, 0.12, 0.22)
	lMed := gaussianMF(latNorm, 0.48, 0.22)
	lHigh := gaussianMF(latNorm, 0.88, 0.22)

	uLow := gaussianMF(load, 0.15, 0.22)
	uMed := gaussianMF(load, 0.50, 0.22)
	uHigh := gaussianMF(load, 0.88, 0.22)

	// 9 Takagi-Sugeno rules: (firing_strength, constant consequent score)
	rules := [9][2]float64{
		{lLow * uLow, 96.0},
		{lLow * uMed, 82.0},
		{lLow * uHigh, 54.0},
		{lMed * uLow, 76.0},
		{lMed * uMed, 58.0},
		{lMed * uHigh, 32.0},
		{lHigh * uLow, 40.0},
		{lHigh * uMed, 24.0},
		{lHigh * uHigh, 8.0},
	}

	wSum := 0.0
	num := 0.0
	for _, r := range rules {
		wSum += r[0]
		num += r[0] * r[1]
	}
	score := 50.0
	if wSum > 1e-9 {
		score = num / wSum
	}
	// Penalize upstream HTTP 5xx error rates sharply.
	score *= math.Max(0.05, 1.0-errRate*1.8)
	return math.Max(1.0, math.Min(100.0, score))
}

// evaluatePureGoGP evaluates the evolved symbolic Genetic Programming heuristic:
//
//	Phi(x) = max(0.05, 1 - CPU^2) / (0.25 + LAT * (1 + CONN))
func evaluatePureGoGP(latNorm, connNorm, cpuNorm, errRate float64) float64 {
	num := math.Max(0.05, 1.0-(cpuNorm*cpuNorm))
	den := 0.25 + latNorm*(1.0+connNorm) + errRate*2.5
	raw := num / math.Max(0.05, den)
	// Map raw ratio into [1, 100] via smooth sigmoid normalization.
	sig := 1.0 / (1.0 + math.Exp(-1.2*(raw-1.4)))
	return math.Max(1.0, math.Min(100.0, sig*100.0))
}

// RecomputeAdaptiveWeights runs a single pure-Go Neuro-Fuzzy + GP adaptation pass
// over current live node telemetry and atomically updates the routing table.
// Returns the newly computed normalized weight map keyed by node ID.
func (p *Proxy) RecomputeAdaptiveWeights(cfg AdaptiveConfig) map[string]float64 {
	if cfg.SLATargetMs <= 0 {
		cfg.SLATargetMs = 85.0
	}
	if cfg.BlendingLambda <= 0 || cfg.BlendingLambda > 1 {
		cfg.BlendingLambda = 0.58
	}
	if cfg.EMAAlpha <= 0 || cfg.EMAAlpha > 1 {
		cfg.EMAAlpha = 0.45
	}

	snaps := p.TelemetrySnapshots()
	rawWeights := make([]float64, len(snaps))
	totalRaw := 0.0

	for i, s := range snaps {
		if !s.Healthy {
			rawWeights[i] = 0.0
			continue
		}
		latNorm := math.Min(1.0, s.P95LatencyMs/(cfg.SLATargetMs*2.8))
		connNorm := math.Min(1.0, float64(s.ActiveConnections)/120.0)
		cpuNorm := math.Max(0.0, math.Min(1.0, s.CPUUsage))

		nfScore := evaluatePureGoNeuroFuzzy(latNorm, connNorm, cpuNorm, s.ErrorRate)
		gpScore := evaluatePureGoGP(latNorm, connNorm, cpuNorm, s.ErrorRate)

		combined := cfg.BlendingLambda*nfScore + (1.0-cfg.BlendingLambda)*gpScore
		capFactor := math.Sqrt(math.Max(0.5, s.CapacityCores) / 2.0)
		w := math.Pow(combined, 1.85) * capFactor
		rawWeights[i] = w
		totalRaw += w
	}

	out := make(map[string]float64, len(snaps))
	if totalRaw <= 1e-9 {
		uniform := 1.0 / float64(max(1, len(snaps)))
		for _, s := range snaps {
			out[s.ID] = math.Round(uniform*10000.0) / 10000.0
		}
		p.UpdateWeights("", out)
		return out
	}

	// Smooth weights via EMA to prevent herd oscillation, then re-normalize.
	smoothed := make([]float64, len(snaps))
	smoothSum := 0.0
	for i, s := range snaps {
		if !s.Healthy {
			smoothed[i] = 0.0
			continue
		}
		targetW := rawWeights[i] / totalRaw
		sw := cfg.EMAAlpha*targetW + (1.0-cfg.EMAAlpha)*s.RoutingWeight
		smoothed[i] = sw
		smoothSum += sw
	}

	for i, s := range snaps {
		if smoothSum > 1e-9 {
			out[s.ID] = math.Round((smoothed[i]/smoothSum)*10000.0) / 10000.0
		} else {
			out[s.ID] = 0.0
		}
	}

	p.UpdateWeights("", out)
	return out
}

// StartAutoControlLoop starts a standalone background goroutine that continuously
// adapts routing weights in pure Go without requiring the Python control plane.
func (p *Proxy) StartAutoControlLoop(ctx context.Context, cfg AdaptiveConfig) {
	if cfg.Interval <= 0 {
		cfg.Interval = 500 * time.Millisecond
	}
	go func() {
		ticker := time.NewTicker(cfg.Interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				p.RecomputeAdaptiveWeights(cfg)
			}
		}
	}()
}
