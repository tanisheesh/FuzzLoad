package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

// ChaosState represents active synthetic faults on a backend worker node.
type ChaosState struct {
	CPUSpike bool `json:"cpu_spike"`
	MemLeak  bool `json:"mem_leak"`
	IOLag    bool `json:"io_lag"`
	Offline  bool `json:"offline"`
}

// WorkerNode represents a single heterogeneous backend server in the cluster.
type WorkerNode struct {
	ID                string     `json:"node_id"`
	Name              string     `json:"name"`
	Port              int        `json:"port"`
	URL               *url.URL   `json:"-"`
	Proxy             *httputil.ReverseProxy `json:"-"`
	CapacityCores     float64    `json:"capacity_cores"`
	StaticWeight      int        `json:"static_weight"`
	ActiveConnections int64      `json:"active_connections"`
	RequestsServed    uint64     `json:"requests_served"`
	ErrorsCount       uint64     `json:"errors_count"`
	CPUUsage          float64    `json:"cpu_usage"`
	MemUsage          float64    `json:"mem_usage"`
	P50LatencyMs      float64    `json:"p50_latency_ms"`
	P95LatencyMs      float64    `json:"p95_latency_ms"`
	P99LatencyMs      float64    `json:"p99_latency_ms"`
	ErrorRate         float64    `json:"error_rate"`
	RoutingWeight     float64    `json:"routing_weight"`
	Chaos             ChaosState `json:"chaos"`

	mu         sync.RWMutex
	latencies  []float64
}

func (n *WorkerNode) recordLatency(ms float64, isErr bool) {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.latencies = append(n.latencies, ms)
	if len(n.latencies) > 120 {
		n.latencies = n.latencies[len(n.latencies)-120:]
	}
	sorted := make([]float64, len(n.latencies))
	copy(sorted, n.latencies)
	sort.Float64s(sorted)
	l := len(sorted)
	if l > 0 {
		n.P50LatencyMs = sorted[int(float64(l-1)*0.50)]
		n.P95LatencyMs = sorted[int(float64(l-1)*0.95)]
		n.P99LatencyMs = sorted[int(float64(l-1)*0.99)]
	}
	if isErr {
		errs := atomic.AddUint64(&n.ErrorsCount, 1)
		reqs := atomic.LoadUint64(&n.RequestsServed)
		if reqs > 0 {
			n.ErrorRate = float64(errs) / float64(reqs)
		}
	} else {
		errs := atomic.LoadUint64(&n.ErrorsCount)
		reqs := atomic.LoadUint64(&n.RequestsServed)
		if reqs > 0 {
			n.ErrorRate = float64(errs) / float64(reqs)
		}
	}
}

// FuzzLoadProxy manages the lock-free routing table and algorithm selection.
type FuzzLoadProxy struct {
	nodes     []*WorkerNode
	algorithm string
	rrCounter uint64
	mu        sync.RWMutex
}

func NewFuzzLoadProxy() *FuzzLoadProxy {
	specs := []struct {
		id     string
		name   string
		port   int
		cores  float64
		weight int
	}{
		{"node-1", "Node-1 (4c Compute)", 9001, 4.0, 4},
		{"node-2", "Node-2 (2c General)", 9002, 2.0, 2},
		{"node-3", "Node-3 (2c Memory)", 9003, 2.0, 2},
		{"node-4", "Node-4 (1c Edge)", 9004, 1.0, 1},
	}

	nodes := make([]*WorkerNode, 0, len(specs))
	for _, s := range specs {
		u, _ := url.Parse(fmt.Sprintf("http://127.0.0.1:%d", s.port))
		proxy := httputil.NewSingleHostReverseProxy(u)
		node := &WorkerNode{
			ID:            s.id,
			Name:          s.name,
			Port:          s.port,
			URL:           u,
			Proxy:         proxy,
			CapacityCores: s.cores,
			StaticWeight:  s.weight,
			CPUUsage:      0.18,
			MemUsage:      0.24,
			P50LatencyMs:  18.0,
			P95LatencyMs:  28.0,
			P99LatencyMs:  35.0,
			RoutingWeight: 0.25,
			latencies:     []float64{18.0, 20.0, 22.0},
		}
		proxy.ErrorHandler = func(w http.ResponseWriter, _ *http.Request, err error) {
			node.recordLatency(250.0, true)
			http.Error(w, fmt.Sprintf("upstream error on %s: %v", node.ID, err), http.StatusBadGateway)
		}
		nodes = append(nodes, node)
	}

	return &FuzzLoadProxy{
		nodes:     nodes,
		algorithm: "fuzzload",
	}
}

func (p *FuzzLoadProxy) selectNode() *WorkerNode {
	p.mu.RLock()
	algo := p.algorithm
	nodes := p.nodes
	p.mu.RUnlock()

	healthy := make([]*WorkerNode, 0, len(nodes))
	for _, n := range nodes {
		n.mu.RLock()
		offline := n.Chaos.Offline
		n.mu.RUnlock()
		if !offline {
			healthy = append(healthy, n)
		}
	}
	if len(healthy) == 0 {
		return nodes[0]
	}

	switch algo {
	case "round_robin":
		idx := atomic.AddUint64(&p.rrCounter, 1) % uint64(len(healthy))
		return healthy[idx]

	case "least_connections":
		best := healthy[0]
		minConn := atomic.LoadInt64(&best.ActiveConnections)
		for _, n := range healthy[1:] {
			c := atomic.LoadInt64(&n.ActiveConnections)
			if c < minConn {
				minConn = c
				best = n
			}
		}
		return best

	case "weighted_round_robin":
		totalWeight := 0
		for _, n := range healthy {
			totalWeight += n.StaticWeight
		}
		pick := int(atomic.AddUint64(&p.rrCounter, 1)) % totalWeight
		acc := 0
		for _, n := range healthy {
			acc += n.StaticWeight
			if pick < acc {
				return n
			}
		}
		return healthy[0]

	default: // "fuzzload" or "anfis_only" -> stochastic proportional routing using AI weights
		total := 0.0
		weights := make([]float64, len(healthy))
		for i, n := range healthy {
			n.mu.RLock()
			w := math.Max(0.005, n.RoutingWeight)
			n.mu.RUnlock()
			weights[i] = w
			total += w
		}
		r := rand.Float64() * total
		acc := 0.0
		for i, n := range healthy {
			acc += weights[i]
			if r <= acc {
				return n
			}
		}
		return healthy[len(healthy)-1]
	}
}

func (p *FuzzLoadProxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	switch r.URL.Path {
	case "/api/telemetry":
		p.handleTelemetry(w, r)
		return
	case "/api/weights":
		p.handleUpdateWeights(w, r)
		return
	case "/api/chaos":
		p.handleChaos(w, r)
		return
	}

	target := p.selectNode()
	atomic.AddInt64(&target.ActiveConnections, 1)
	atomic.AddUint64(&target.RequestsServed, 1)
	start := time.Now()

	defer func() {
		atomic.AddInt64(&target.ActiveConnections, -1)
		elapsedMs := float64(time.Since(start).Microseconds()) / 1000.0
		target.recordLatency(elapsedMs, false)
	}()

	w.Header().Set("X-FuzzLoad-Node", target.ID)
	w.Header().Set("X-FuzzLoad-Algorithm", p.algorithm)
	target.Proxy.ServeHTTP(w, r)
}

func (p *FuzzLoadProxy) handleTelemetry(w http.ResponseWriter, _ *http.Request) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"algorithm": p.algorithm,
		"nodes":     p.nodes,
		"timestamp": time.Now().UnixMilli(),
	})
}

func (p *FuzzLoadProxy) handleUpdateWeights(w http.ResponseWriter, r *http.Request) {
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
	p.mu.Lock()
	if payload.Algorithm != "" {
		p.algorithm = payload.Algorithm
	}
	for _, n := range p.nodes {
		if wVal, ok := payload.Weights[n.ID]; ok {
			n.mu.Lock()
			n.RoutingWeight = wVal
			n.mu.Unlock()
		}
	}
	p.mu.Unlock()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
}

func (p *FuzzLoadProxy) handleChaos(w http.ResponseWriter, r *http.Request) {
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
	for _, n := range p.nodes {
		if n.ID == payload.NodeID {
			n.mu.Lock()
			n.Chaos = payload.Chaos
			n.mu.Unlock()
			break
		}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "chaos_updated"})
}

func startWorkerNode(n *WorkerNode) {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) {
		n.mu.RLock()
		chaos := n.Chaos
		cores := n.CapacityCores
		n.mu.RUnlock()

		conns := float64(atomic.LoadInt64(&n.ActiveConnections))
		baseDelayMs := 14.0 / math.Sqrt(cores)
		queueDelayMs := (conns * conns) / (cores * 1.8)
		if chaos.CPUSpike {
			queueDelayMs += 95.0
		}
		if chaos.IOLag {
			queueDelayMs += 130.0
		}
		totalMs := baseDelayMs + queueDelayMs + rand.Float64()*6.0
		time.Sleep(time.Duration(totalMs) * time.Millisecond)

		n.mu.Lock()
		cpuBase := math.Min(0.98, 0.12+(conns/(cores*14.0)))
		if chaos.CPUSpike {
			cpuBase = math.Min(0.99, cpuBase+0.55)
		}
		memBase := math.Min(0.97, 0.22+(conns*0.015))
		if chaos.MemLeak {
			memBase = math.Min(0.98, memBase+0.50)
		}
		n.CPUUsage = cpuBase
		n.MemUsage = memBase
		n.mu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"node_id":    n.ID,
			"latency_ms": totalMs,
			"status":     "ok",
		})
	})

	addr := fmt.Sprintf(":%d", n.Port)
	log.Printf("[Worker %s] listening on %s (%.1f cores)", n.ID, addr, n.CapacityCores)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Printf("[Worker %s] stopped: %v", n.ID, err)
	}
}

func main() {
	proxy := NewFuzzLoadProxy()
	for _, node := range proxy.nodes {
		go startWorkerNode(node)
	}

	port := os.Getenv("GO_PROXY_PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("[FuzzLoad Go Data Plane] Reverse Proxy listening on :%s", port)
	if err := http.ListenAndServe(":"+port, proxy); err != nil {
		log.Fatalf("proxy server failed: %v", err)
	}
}
