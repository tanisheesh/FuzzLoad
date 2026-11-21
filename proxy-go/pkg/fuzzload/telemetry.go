package fuzzload

import (
	"fmt"
	"math"
	"net/http"
	"sort"
	"sync/atomic"
)

const latencyRingSize = 128

// LatencyRing is a lock-free fixed-size ring buffer storing latency samples in microseconds.
// Writes require zero heap allocations and zero mutex locks on the HTTP hot path.
// Percentiles (P50/P95/P99) are computed only on telemetry scrape.
type LatencyRing struct {
	samples [latencyRingSize]atomic.Uint64
	cursor  atomic.Uint64
}

// Record stores a latency observation in milliseconds (converted to microseconds) in O(1) time.
func (r *LatencyRing) Record(ms float64) {
	if ms < 0 || math.IsNaN(ms) || math.IsInf(ms, 0) {
		ms = 0
	}
	us := uint64(ms * 1000.0)
	idx := r.cursor.Add(1) - 1
	r.samples[idx%latencyRingSize].Store(us)
}

// Seed populates initial baseline samples so telemetry reports realistic startup values.
func (r *LatencyRing) Seed(valuesMs ...float64) {
	for _, v := range valuesMs {
		r.Record(v)
	}
}

// Percentiles computes P50, P95, and P99 latencies in milliseconds from the rolling window.
func (r *LatencyRing) Percentiles() (p50, p95, p99 float64) {
	count := r.cursor.Load()
	if count == 0 {
		return 0, 0, 0
	}
	n := int(count)
	if n > latencyRingSize {
		n = latencyRingSize
	}

	buf := make([]uint64, n)
	for i := 0; i < n; i++ {
		buf[i] = r.samples[i].Load()
	}
	sort.Slice(buf, func(i, j int) bool { return buf[i] < buf[j] })

	pct := func(q float64) float64 {
		if n == 1 {
			return float64(buf[0]) / 1000.0
		}
		pos := q * float64(n-1)
		lo := int(math.Floor(pos))
		hi := int(math.Ceil(pos))
		if lo == hi {
			return float64(buf[lo]) / 1000.0
		}
		frac := pos - float64(lo)
		val := float64(buf[lo])*(1.0-frac) + float64(buf[hi])*frac
		return math.Round((val/1000.0)*100.0) / 100.0
	}

	return pct(0.50), pct(0.95), pct(0.99)
}

// NodeTelemetrySnapshot is a JSON-serializable telemetry view of a single upstream node.
type NodeTelemetrySnapshot struct {
	ID                  string     `json:"node_id"`
	Name                string     `json:"name"`
	URL                 string     `json:"url"`
	Port                int        `json:"port"`
	CapacityCores       float64    `json:"capacity_cores"`
	MemoryGB            float64    `json:"memory_gb"`
	StaticWeight        int        `json:"static_weight"`
	ActiveConnections   int64      `json:"active_connections"`
	RequestsServed      uint64     `json:"requests_served"`
	ErrorsCount         uint64     `json:"errors_count"`
	CPUUsage            float64    `json:"cpu_usage"`
	MemUsage            float64    `json:"mem_usage"`
	P50LatencyMs        float64    `json:"p50_latency_ms"`
	P95LatencyMs        float64    `json:"p95_latency_ms"`
	P99LatencyMs        float64    `json:"p99_latency_ms"`
	ErrorRate           float64    `json:"error_rate"`
	RoutingWeight       float64    `json:"routing_weight"`
	Healthy             bool       `json:"healthy"`
	CircuitBreakerOpen  bool       `json:"circuit_breaker_open"`
	ConsecutiveFailures int32      `json:"consecutive_failures"`
	Chaos               ChaosState `json:"chaos"`
}

// HandlePrometheusMetrics writes Prometheus-compatible text exposition metrics for all nodes.
func (p *Proxy) HandlePrometheusMetrics(w http.ResponseWriter, _ *http.Request) {
	snaps := p.TelemetrySnapshots()
	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")

	fmt.Fprintln(w, "# HELP fuzzload_node_routing_weight Current AI-assigned routing weight per upstream node.")
	fmt.Fprintln(w, "# TYPE fuzzload_node_routing_weight gauge")
	for _, s := range snaps {
		fmt.Fprintf(w, "fuzzload_node_routing_weight{node=%q,algorithm=%q} %.4f\n", s.ID, p.Algorithm(), s.RoutingWeight)
	}

	fmt.Fprintln(w, "# HELP fuzzload_node_p95_latency_ms Rolling P95 response latency in milliseconds.")
	fmt.Fprintln(w, "# TYPE fuzzload_node_p95_latency_ms gauge")
	for _, s := range snaps {
		fmt.Fprintf(w, "fuzzload_node_p95_latency_ms{node=%q} %.2f\n", s.ID, s.P95LatencyMs)
	}

	fmt.Fprintln(w, "# HELP fuzzload_node_active_connections Current in-flight HTTP connections.")
	fmt.Fprintln(w, "# TYPE fuzzload_node_active_connections gauge")
	for _, s := range snaps {
		fmt.Fprintf(w, "fuzzload_node_active_connections{node=%q} %d\n", s.ID, s.ActiveConnections)
	}

	fmt.Fprintln(w, "# HELP fuzzload_node_requests_total Total requests routed to upstream node.")
	fmt.Fprintln(w, "# TYPE fuzzload_node_requests_total counter")
	for _, s := range snaps {
		fmt.Fprintf(w, "fuzzload_node_requests_total{node=%q} %d\n", s.ID, s.RequestsServed)
	}

	fmt.Fprintln(w, "# HELP fuzzload_node_errors_total Total upstream errors observed on node.")
	fmt.Fprintln(w, "# TYPE fuzzload_node_errors_total counter")
	for _, s := range snaps {
		fmt.Fprintf(w, "fuzzload_node_errors_total{node=%q} %d\n", s.ID, s.ErrorsCount)
	}

	fmt.Fprintln(w, "# HELP fuzzload_node_circuit_open 1 if circuit breaker is open, 0 otherwise.")
	fmt.Fprintln(w, "# TYPE fuzzload_node_circuit_open gauge")
	for _, s := range snaps {
		val := 0
		if s.CircuitBreakerOpen {
			val = 1
		}
		fmt.Fprintf(w, "fuzzload_node_circuit_open{node=%q} %d\n", s.ID, val)
	}
}
