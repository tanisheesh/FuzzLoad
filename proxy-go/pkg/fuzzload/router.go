package fuzzload

import (
	"encoding/json"
	"fmt"
	"math"
	"math/rand/v2"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"sync"
	"sync/atomic"
	"time"
)

// Supported routing algorithms.
const (
	AlgoFuzzLoad           = "fuzzload"
	AlgoANFISOnly          = "anfis_only"
	AlgoWeightedRoundRobin = "weighted_round_robin"
	AlgoLeastConnections   = "least_connections"
	AlgoRoundRobin         = "round_robin"
)

// ChaosState represents active synthetic faults on a backend worker node.
type ChaosState struct {
	CPUSpike bool `json:"cpu_spike"`
	MemLeak  bool `json:"mem_leak"`
	IOLag    bool `json:"io_lag"`
	Offline  bool `json:"offline"`
}

// UpstreamSpec configures an upstream server target for the FuzzLoad Proxy SDK.
type UpstreamSpec struct {
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	URL           string  `json:"url"`
	CapacityCores float64 `json:"cores"`
	MemoryGB      float64 `json:"memory_gb"`
	StaticWeight  int     `json:"static_weight"`
	InitialWeight float64 `json:"weight"`
}

// Config configures a FuzzLoad reverse proxy / load-balancing router instance.
type Config struct {
	Algorithm string
	Upstreams []UpstreamSpec
	Health    HealthConfig
}

// UpstreamNode represents a live upstream server with lock-free hot-path counters.
type UpstreamNode struct {
	ID            string
	Name          string
	Port          int
	URL           *url.URL
	Proxy         *httputil.ReverseProxy
	CapacityCores float64
	MemoryGB      float64
	StaticWeight  int

	ActiveConnections atomic.Int64
	RequestsServed    atomic.Uint64
	ErrorsCount       atomic.Uint64
	Latency           LatencyRing

	// Atomic bit-encoded float64 fields for lock-free reads.
	cpuBits    atomic.Uint64
	memBits    atomic.Uint64
	weightBits atomic.Uint64

	// Circuit breaker and chaos flags.
	chaosOffline             atomic.Bool
	circuitOpen              atomic.Bool
	consecutiveFailures      atomic.Int32
	circuitOpenUntilUnixNano atomic.Int64

	chaosMu sync.RWMutex
	chaos   ChaosState
}

func (n *UpstreamNode) SetCPU(v float64)           { n.cpuBits.Store(math.Float64bits(v)) }
func (n *UpstreamNode) CPU() float64               { return math.Float64frombits(n.cpuBits.Load()) }
func (n *UpstreamNode) SetMem(v float64)           { n.memBits.Store(math.Float64bits(v)) }
func (n *UpstreamNode) Mem() float64               { return math.Float64frombits(n.memBits.Load()) }
func (n *UpstreamNode) SetRoutingWeight(v float64) { n.weightBits.Store(math.Float64bits(v)) }
func (n *UpstreamNode) RoutingWeight() float64     { return math.Float64frombits(n.weightBits.Load()) }

// Chaos returns the node's current synthetic chaos configuration.
func (n *UpstreamNode) Chaos() ChaosState {
	n.chaosMu.RLock()
	defer n.chaosMu.RUnlock()
	return n.chaos
}

// SetChaos updates the node's chaos configuration atomically.
func (n *UpstreamNode) SetChaos(c ChaosState) {
	n.chaosMu.Lock()
	n.chaos = c
	n.chaosMu.Unlock()
	n.chaosOffline.Store(c.Offline)
}

// routingTable is an immutable Copy-on-Write snapshot swapped via atomic.Pointer.
// SelectUpstream reads this snapshot with zero mutex locks and zero heap allocations.
type routingTable struct {
	algorithm string
	healthy   []*UpstreamNode
	// Prefix-sum CDF weights for O(N) zero-allocation stochastic weighted selection.
	cdf      []float64
	totalCDF float64
	// Precomputed weighted-round-robin expanded schedule for O(1) lookup.
	wrrSlots []*UpstreamNode
}

// Proxy is a lock-free L7 HTTP reverse proxy and embeddable Go SDK router.
// It implements http.Handler directly for drop-in use with net/http, Gin, or Chi.
type Proxy struct {
	nodes     []*UpstreamNode
	healthCfg HealthConfig
	table     atomic.Pointer[routingTable]
	rrCounter atomic.Uint64
	updateMu  sync.Mutex
}

// NewProxy constructs a new lock-free FuzzLoad Proxy from the provided Config.
func NewProxy(cfg Config) (*Proxy, error) {
	if len(cfg.Upstreams) == 0 {
		return nil, fmt.Errorf("fuzzload: at least one upstream must be configured")
	}

	algo := cfg.Algorithm
	if algo == "" {
		algo = AlgoFuzzLoad
	}
	healthCfg := cfg.Health
	if healthCfg.FailureThreshold == 0 && healthCfg.Interval == 0 && !healthCfg.Enabled {
		healthCfg = DefaultHealthConfig()
	}

	p := &Proxy{
		nodes:     make([]*UpstreamNode, 0, len(cfg.Upstreams)),
		healthCfg: healthCfg,
	}

	defaultWeight := 1.0 / float64(len(cfg.Upstreams))
	for i, spec := range cfg.Upstreams {
		parsed, err := url.Parse(spec.URL)
		if err != nil || parsed.Host == "" {
			return nil, fmt.Errorf("fuzzload: invalid upstream URL %q", spec.URL)
		}

		id := spec.ID
		if id == "" {
			id = fmt.Sprintf("node-%d", i+1)
		}
		name := spec.Name
		if name == "" {
			name = id
		}
		cores := spec.CapacityCores
		if cores <= 0 {
			cores = 2.0
		}
		memGB := spec.MemoryGB
		if memGB <= 0 {
			memGB = cores * 4.0
		}
		staticW := spec.StaticWeight
		if staticW <= 0 {
			staticW = max(1, int(math.Round(cores)))
		}
		initW := spec.InitialWeight
		if initW <= 0 {
			initW = defaultWeight
		}
		port := 80
		if ps := parsed.Port(); ps != "" {
			if pv, err := strconv.Atoi(ps); err == nil {
				port = pv
			}
		} else if parsed.Scheme == "https" {
			port = 443
		}

		rp := httputil.NewSingleHostReverseProxy(parsed)
		rp.Transport = &http.Transport{
			MaxIdleConns:        256,
			MaxIdleConnsPerHost: 64,
			IdleConnTimeout:     60 * time.Second,
		}

		node := &UpstreamNode{
			ID:            id,
			Name:          name,
			Port:          port,
			URL:           parsed,
			Proxy:         rp,
			CapacityCores: cores,
			MemoryGB:      memGB,
			StaticWeight:  staticW,
		}
		node.SetCPU(0.18)
		node.SetMem(0.24)
		node.SetRoutingWeight(initW)
		node.Latency.Seed(18.0, 20.0, 22.0)

		captured := node
		rp.ErrorHandler = func(w http.ResponseWriter, _ *http.Request, err error) {
			captured.ErrorsCount.Add(1)
			captured.Latency.Record(250.0)
			if captured.RecordFailure(p.healthCfg.FailureThreshold, p.healthCfg.Cooldown) {
				p.rebuildRoutingTable()
			}
			http.Error(w, fmt.Sprintf("fuzzload upstream error on %s: %v", captured.ID, err), http.StatusBadGateway)
		}

		p.nodes = append(p.nodes, node)
	}

	p.table.Store(p.buildTable(algo))
	return p, nil
}

// Nodes returns the slice of configured upstream nodes.
func (p *Proxy) Nodes() []*UpstreamNode {
	return p.nodes
}

// Algorithm returns the active routing policy name.
func (p *Proxy) Algorithm() string {
	return p.table.Load().algorithm
}

func (p *Proxy) buildTable(algo string) *routingTable {
	healthy := make([]*UpstreamNode, 0, len(p.nodes))
	for _, n := range p.nodes {
		if n.IsAvailable() {
			healthy = append(healthy, n)
		}
	}
	if len(healthy) == 0 {
		healthy = append(healthy, p.nodes[0])
	}

	cdf := make([]float64, len(healthy))
	totalCDF := 0.0
	wrrSlots := make([]*UpstreamNode, 0, len(healthy)*4)

	for i, n := range healthy {
		w := math.Max(0.005, n.RoutingWeight())
		totalCDF += w
		cdf[i] = totalCDF

		slots := n.StaticWeight
		if slots < 1 {
			slots = 1
		}
		for s := 0; s < slots; s++ {
			wrrSlots = append(wrrSlots, n)
		}
	}

	return &routingTable{
		algorithm: algo,
		healthy:   healthy,
		cdf:       cdf,
		totalCDF:  totalCDF,
		wrrSlots:  wrrSlots,
	}
}

func (p *Proxy) rebuildRoutingTable() {
	p.updateMu.Lock()
	defer p.updateMu.Unlock()
	cur := p.table.Load()
	algo := AlgoFuzzLoad
	if cur != nil {
		algo = cur.algorithm
	}
	p.table.Store(p.buildTable(algo))
}

// UpdateWeights atomically swaps the routing algorithm and node weights with zero hot-path blocking.
func (p *Proxy) UpdateWeights(algorithm string, weights map[string]float64) {
	p.updateMu.Lock()
	defer p.updateMu.Unlock()

	cur := p.table.Load()
	nextAlgo := cur.algorithm
	if algorithm != "" {
		nextAlgo = algorithm
	}
	for _, n := range p.nodes {
		if wVal, ok := weights[n.ID]; ok {
			if wVal < 0 {
				wVal = 0
			}
			n.SetRoutingWeight(wVal)
		}
	}
	p.table.Store(p.buildTable(nextAlgo))
}

// SetNodeChaos applies synthetic chaos faults to a node and refreshes the routing table.
func (p *Proxy) SetNodeChaos(nodeID string, state ChaosState) bool {
	found := false
	for _, n := range p.nodes {
		if n.ID == nodeID {
			n.SetChaos(state)
			if !state.Offline {
				n.RecordSuccess()
			}
			found = true
			break
		}
	}
	if found {
		p.rebuildRoutingTable()
	}
	return found
}

// SelectUpstream picks the next target upstream node using the lock-free atomic snapshot.
// Hot-path execution requires 0 locks and 0 heap allocations.
func (p *Proxy) SelectUpstream() *UpstreamNode {
	tbl := p.table.Load()
	healthy := tbl.healthy
	nLen := len(healthy)
	if nLen == 1 {
		return healthy[0]
	}

	switch tbl.algorithm {
	case AlgoRoundRobin:
		idx := (p.rrCounter.Add(1) - 1) % uint64(nLen)
		return healthy[idx]

	case AlgoWeightedRoundRobin:
		slots := tbl.wrrSlots
		idx := (p.rrCounter.Add(1) - 1) % uint64(len(slots))
		return slots[idx]

	case AlgoLeastConnections:
		best := healthy[0]
		minConn := best.ActiveConnections.Load()
		for i := 1; i < nLen; i++ {
			c := healthy[i].ActiveConnections.Load()
			if c < minConn {
				minConn = c
				best = healthy[i]
			}
		}
		return best

	default: // AlgoFuzzLoad or AlgoANFISOnly -> zero-alloc CDF weighted selection
		r := rand.Float64() * tbl.totalCDF
		for i := 0; i < nLen; i++ {
			if r <= tbl.cdf[i] {
				return healthy[i]
			}
		}
		return healthy[nLen-1]
	}
}

// statusCaptureWriter intercepts upstream HTTP status codes for passive circuit breaking.
type statusCaptureWriter struct {
	http.ResponseWriter
	statusCode int
}

func (sw *statusCaptureWriter) WriteHeader(code int) {
	sw.statusCode = code
	sw.ResponseWriter.WriteHeader(code)
}

// ServeHTTP forwards incoming HTTP requests to the selected upstream node while recording lock-free telemetry.
func (p *Proxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	target := p.SelectUpstream()
	target.ActiveConnections.Add(1)
	target.RequestsServed.Add(1)
	start := time.Now()

	sw := &statusCaptureWriter{ResponseWriter: w, statusCode: http.StatusOK}
	w.Header().Set("X-FuzzLoad-Node", target.ID)
	w.Header().Set("X-FuzzLoad-Algorithm", p.Algorithm())

	defer func() {
		target.ActiveConnections.Add(-1)
		elapsedMs := float64(time.Since(start).Microseconds()) / 1000.0
		target.Latency.Record(elapsedMs)
		if sw.statusCode >= http.StatusInternalServerError {
			target.ErrorsCount.Add(1)
			if target.RecordFailure(p.healthCfg.FailureThreshold, p.healthCfg.Cooldown) {
				p.rebuildRoutingTable()
			}
		} else {
			target.RecordSuccess()
		}
	}()

	target.Proxy.ServeHTTP(sw, r)
}

// TelemetrySnapshots returns a point-in-time snapshot of every node's live telemetry.
func (p *Proxy) TelemetrySnapshots() []NodeTelemetrySnapshot {
	out := make([]NodeTelemetrySnapshot, len(p.nodes))
	for i, n := range p.nodes {
		p50, p95, p99 := n.Latency.Percentiles()
		reqs := n.RequestsServed.Load()
		errs := n.ErrorsCount.Load()
		errRate := 0.0
		if reqs > 0 {
			errRate = math.Round((float64(errs)/float64(reqs))*10000.0) / 10000.0
		}
		chaos := n.Chaos()
		out[i] = NodeTelemetrySnapshot{
			ID:                  n.ID,
			Name:                n.Name,
			URL:                 n.URL.String(),
			Port:                n.Port,
			CapacityCores:       n.CapacityCores,
			MemoryGB:            n.MemoryGB,
			StaticWeight:        n.StaticWeight,
			ActiveConnections:   n.ActiveConnections.Load(),
			RequestsServed:      reqs,
			ErrorsCount:         errs,
			CPUUsage:            math.Round(n.CPU()*10000.0) / 10000.0,
			MemUsage:            math.Round(n.Mem()*10000.0) / 10000.0,
			P50LatencyMs:        p50,
			P95LatencyMs:        p95,
			P99LatencyMs:        p99,
			ErrorRate:           errRate,
			RoutingWeight:       math.Round(n.RoutingWeight()*10000.0) / 10000.0,
			Healthy:             n.IsAvailable(),
			CircuitBreakerOpen:  n.circuitOpen.Load(),
			ConsecutiveFailures: n.consecutiveFailures.Load(),
			Chaos:               chaos,
		}
	}
	return out
}

// ControlMux returns an HTTP handler exposing both data-plane proxying and control-plane endpoints:
//   - GET  /healthz
//   - GET  /metrics
//   - GET  /api/telemetry
//   - POST /api/weights
//   - POST /api/chaos
//   - /*   -> reverse proxy via SelectUpstream()
func (p *Proxy) ControlMux() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		switch r.URL.Path {
		case "/healthz":
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"status":    "ok",
				"algorithm": p.Algorithm(),
				"nodes":     len(p.nodes),
			})
			return
		case "/metrics":
			p.HandlePrometheusMetrics(w, r)
			return
		case "/api/telemetry":
			p.handleTelemetry(w, r)
			return
		case "/api/weights":
			p.handleUpdateWeights(w, r)
			return
		case "/api/chaos":
			p.handleChaos(w, r)
			return
		default:
			p.ServeHTTP(w, r)
		}
	})
}

func (p *Proxy) handleTelemetry(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"algorithm": p.Algorithm(),
		"nodes":     p.TelemetrySnapshots(),
		"timestamp": time.Now().UnixMilli(),
	})
}

func (p *Proxy) handleUpdateWeights(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var payload struct {
		Algorithm string             `json:"algorithm"`
		Weights   map[string]float64 `json:"weights"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	p.UpdateWeights(payload.Algorithm, payload.Weights)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"status":    "updated",
		"algorithm": p.Algorithm(),
	})
}

func (p *Proxy) handleChaos(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var payload struct {
		NodeID string     `json:"node_id"`
		Chaos  ChaosState `json:"chaos"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if !p.SetNodeChaos(payload.NodeID, payload.Chaos) {
		http.Error(w, "unknown node_id", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "chaos_updated"})
}
