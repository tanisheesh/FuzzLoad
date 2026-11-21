package fuzzload

import (
	"context"
	"net/http"
	"strings"
	"time"
)

// HealthConfig controls passive circuit breaking and active background recovery probes.
type HealthConfig struct {
	Enabled          bool
	ProbePath        string
	Interval         time.Duration
	Timeout          time.Duration
	FailureThreshold int32
	Cooldown         time.Duration
}

// DefaultHealthConfig returns production-safe circuit breaker defaults.
func DefaultHealthConfig() HealthConfig {
	return HealthConfig{
		Enabled:          true,
		ProbePath:        "/healthz",
		Interval:         3 * time.Second,
		Timeout:          800 * time.Millisecond,
		FailureThreshold: 3,
		Cooldown:         5 * time.Second,
	}
}

// RecordSuccess resets consecutive failures and closes any half-open circuit breaker.
func (n *UpstreamNode) RecordSuccess() {
	wasOpen := n.circuitOpen.Load()
	n.consecutiveFailures.Store(0)
	if wasOpen {
		n.circuitOpen.Store(false)
	}
}

// RecordFailure increments consecutive failures and trips the circuit breaker at threshold.
// Returns true if the circuit transitioned from closed to open.
func (n *UpstreamNode) RecordFailure(threshold int32, cooldown time.Duration) bool {
	if threshold <= 0 {
		threshold = 3
	}
	fails := n.consecutiveFailures.Add(1)
	if fails >= threshold && !n.circuitOpen.Load() {
		n.circuitOpen.Store(true)
		n.circuitOpenUntilUnixNano.Store(time.Now().Add(cooldown).UnixNano())
		return true
	}
	return false
}

// IsAvailable reports whether the node can currently accept traffic (not offline and circuit closed).
func (n *UpstreamNode) IsAvailable() bool {
	if n.chaosOffline.Load() {
		return false
	}
	if !n.circuitOpen.Load() {
		return true
	}
	// Allow half-open recovery probe once cooldown has elapsed.
	until := n.circuitOpenUntilUnixNano.Load()
	return until > 0 && time.Now().UnixNano() >= until
}

// StartHealthProber runs an active background probe loop that recovers tripped nodes
// and detects silently unreachable upstreams.
func (p *Proxy) StartHealthProber(ctx context.Context) {
	cfg := p.healthCfg
	if !cfg.Enabled || cfg.Interval <= 0 {
		return
	}
	client := &http.Client{Timeout: cfg.Timeout}
	probePath := cfg.ProbePath
	if probePath == "" {
		probePath = "/healthz"
	}
	if !strings.HasPrefix(probePath, "/") {
		probePath = "/" + probePath
	}

	go func() {
		ticker := time.NewTicker(cfg.Interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				changed := false
				for _, node := range p.nodes {
					if node.chaosOffline.Load() {
						continue
					}
					probeURL := strings.TrimRight(node.URL.String(), "/") + probePath
					req, err := http.NewRequestWithContext(ctx, http.MethodGet, probeURL, nil)
					if err != nil {
						continue
					}
					resp, err := client.Do(req)
					if err != nil {
						if node.RecordFailure(cfg.FailureThreshold, cfg.Cooldown) {
							changed = true
						}
						continue
					}
					_ = resp.Body.Close()
					if resp.StatusCode >= 500 {
						if node.RecordFailure(cfg.FailureThreshold, cfg.Cooldown) {
							changed = true
						}
					} else {
						wasOpen := node.circuitOpen.Load()
						node.RecordSuccess()
						if wasOpen {
							changed = true
						}
					}
				}
				if changed {
					p.rebuildRoutingTable()
				}
			}
		}
	}()
}
