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

// RecordSuccess resets consecutive failures and closes any open or half-open circuit breaker.
// Returns true if the circuit transitioned from open/half-open to closed.
func (n *UpstreamNode) RecordSuccess() bool {
	wasOpen := n.circuitOpen.Swap(false)
	n.consecutiveFailures.Store(0)
	n.circuitOpenUntilUnixNano.Store(0)
	return wasOpen
}

// RecordFailure increments consecutive failures and opens (or re-opens after a failed
// half-open attempt) the circuit breaker with a fresh cooldown deadline.
// Returns true if the routing table must be rebuilt.
func (n *UpstreamNode) RecordFailure(threshold int32, cooldown time.Duration) bool {
	if threshold <= 0 {
		threshold = 3
	}
	if cooldown <= 0 {
		cooldown = 5 * time.Second
	}
	now := time.Now()
	// If the circuit was already open and cooldown had elapsed (half-open recovery attempt),
	// a failure immediately restarts the cooldown and excludes the node again.
	if n.circuitOpen.Load() {
		until := n.circuitOpenUntilUnixNano.Load()
		if until > 0 && now.UnixNano() >= until {
			n.circuitOpenUntilUnixNano.Store(now.Add(cooldown).UnixNano())
			return true
		}
		return false
	}

	fails := n.consecutiveFailures.Add(1)
	if fails >= threshold {
		n.circuitOpen.Store(true)
		n.circuitOpenUntilUnixNano.Store(now.Add(cooldown).UnixNano())
		return true
	}
	return false
}

// IsAvailable reports whether the node can currently accept traffic (not offline and circuit closed or half-open).
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

// scheduleRecoveryRefresh refreshes the atomic routing table once a tripped node's
// cooldown expires, ensuring passive circuit breaking recovers even when active probing
// and the adaptive control loop are disabled.
func (p *Proxy) scheduleRecoveryRefresh(cooldown time.Duration) {
	if cooldown <= 0 {
		cooldown = 5 * time.Second
	}
	time.AfterFunc(cooldown+10*time.Millisecond, func() {
		p.rebuildRoutingTable()
	})
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
							p.scheduleRecoveryRefresh(cfg.Cooldown)
						}
						continue
					}
					_ = resp.Body.Close()
					if resp.StatusCode >= 500 {
						if node.RecordFailure(cfg.FailureThreshold, cfg.Cooldown) {
							changed = true
							p.scheduleRecoveryRefresh(cfg.Cooldown)
						}
					} else {
						if node.RecordSuccess() {
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
