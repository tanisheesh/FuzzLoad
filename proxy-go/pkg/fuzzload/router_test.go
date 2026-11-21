package fuzzload

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

func newTestProxy(t *testing.T, algo string) (*Proxy, []*httptest.Server) {
	t.Helper()
	servers := make([]*httptest.Server, 4)
	specs := make([]UpstreamSpec, 4)
	weights := []float64{0.50, 0.25, 0.15, 0.10}
	cores := []float64{4.0, 2.0, 2.0, 1.0}

	for i := 0; i < 4; i++ {
		idx := i
		servers[i] = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/healthz" {
				w.WriteHeader(http.StatusOK)
				return
			}
			w.WriteHeader(http.StatusOK)
			_, _ = fmt.Fprintf(w, "ok-node-%d", idx+1)
		}))
		specs[i] = UpstreamSpec{
			ID:            fmt.Sprintf("node-%d", i+1),
			Name:          fmt.Sprintf("Node-%d", i+1),
			URL:           servers[i].URL,
			CapacityCores: cores[i],
			StaticWeight:  int(cores[i]),
			InitialWeight: weights[i],
		}
	}

	p, err := NewProxy(Config{
		Algorithm: algo,
		Upstreams: specs,
		Health: HealthConfig{
			Enabled:          false,
			FailureThreshold: 2,
			Cooldown:         50 * time.Millisecond,
		},
	})
	if err != nil {
		t.Fatalf("NewProxy failed: %v", err)
	}
	return p, servers
}

func TestSelectUpstreamWeightedDistribution(t *testing.T) {
	p, servers := newTestProxy(t, AlgoFuzzLoad)
	defer func() {
		for _, s := range servers {
			s.Close()
		}
	}()

	counts := map[string]int{}
	const total = 20000
	for i := 0; i < total; i++ {
		n := p.SelectUpstream()
		counts[n.ID]++
	}

	if counts["node-1"] <= counts["node-2"] || counts["node-2"] <= counts["node-4"] {
		t.Fatalf("expected node-1 > node-2 > node-4 distribution, got %v", counts)
	}
}

func TestAlgorithmsAndDynamicAtomicUpdate(t *testing.T) {
	p, servers := newTestProxy(t, AlgoRoundRobin)
	defer func() {
		for _, s := range servers {
			s.Close()
		}
	}()

	seen := map[string]int{}
	for i := 0; i < 8; i++ {
		seen[p.SelectUpstream().ID]++
	}
	for _, id := range []string{"node-1", "node-2", "node-3", "node-4"} {
		if seen[id] != 2 {
			t.Fatalf("round robin expected 2 hits for %s, got %d", id, seen[id])
		}
	}

	// Mark node-1 offline and hot-swap weights atomically
	p.SetNodeChaos("node-1", ChaosState{Offline: true})
	p.UpdateWeights(AlgoFuzzLoad, map[string]float64{
		"node-1": 0.0,
		"node-2": 0.80,
		"node-3": 0.15,
		"node-4": 0.05,
	})
	for i := 0; i < 1000; i++ {
		if got := p.SelectUpstream().ID; got == "node-1" {
			t.Fatalf("offline node-1 should never be selected")
		}
	}
}

func TestReverseProxyForwardingAndCircuitBreaker(t *testing.T) {
	failServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "boom", http.StatusInternalServerError)
	}))
	defer failServer.Close()

	okServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("healthy"))
	}))
	defer okServer.Close()

	p, err := NewProxy(Config{
		Algorithm: AlgoFuzzLoad,
		Upstreams: []UpstreamSpec{
			{ID: "bad", URL: failServer.URL, InitialWeight: 0.99},
			{ID: "good", URL: okServer.URL, InitialWeight: 0.01},
		},
		Health: HealthConfig{
			Enabled:          false,
			FailureThreshold: 2,
			Cooldown:         5 * time.Second,
		},
	})
	if err != nil {
		t.Fatalf("NewProxy failed: %v", err)
	}

	// Drive requests until circuit breaker trips on "bad"
	for i := 0; i < 10; i++ {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/work", nil)
		p.ServeHTTP(rec, req)
	}

	// Once tripped, all subsequent requests must route to "good"
	for i := 0; i < 10; i++ {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/work", nil)
		p.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK || rec.Header().Get("X-FuzzLoad-Node") != "good" {
			t.Fatalf("expected routed to good with 200 after circuit trip, got code=%d node=%s", rec.Code, rec.Header().Get("X-FuzzLoad-Node"))
		}
	}

	// Verify Prometheus metrics output
	rec := httptest.NewRecorder()
	p.HandlePrometheusMetrics(rec, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	if !strings.Contains(rec.Body.String(), "fuzzload_node_circuit_open{node=\"bad\"} 1") {
		t.Fatalf("expected circuit open metric for bad node, got:\n%s", rec.Body.String())
	}
}

func TestConcurrentReadsAndWeightSwapsRaceFree(t *testing.T) {
	p, servers := newTestProxy(t, AlgoFuzzLoad)
	defer func() {
		for _, s := range servers {
			s.Close()
		}
	}()

	var wg sync.WaitGroup
	// 8 concurrent readers calling SelectUpstream + Latency.Record
	for g := 0; g < 8; g++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < 2000; i++ {
				n := p.SelectUpstream()
				n.Latency.Record(12.5 + float64(i%20))
			}
		}()
	}

	// Concurrent writer swapping atomic weights & algorithms
	wg.Add(1)
	go func() {
		defer wg.Done()
		algos := []string{AlgoFuzzLoad, AlgoRoundRobin, AlgoWeightedRoundRobin, AlgoLeastConnections}
		for i := 0; i < 200; i++ {
			p.UpdateWeights(algos[i%len(algos)], map[string]float64{
				"node-1": 0.45,
				"node-2": 0.25,
				"node-3": 0.20,
				"node-4": 0.10,
			})
			_ = p.TelemetrySnapshots()
		}
	}()

	wg.Wait()
}

func TestAllNodesOfflineReturns503AndAdminAuth(t *testing.T) {
	p, servers := newTestProxy(t, AlgoFuzzLoad)
	defer func() {
		for _, s := range servers {
			s.Close()
		}
	}()

	for _, n := range p.Nodes() {
		p.SetNodeChaos(n.ID, ChaosState{Offline: true})
	}
	if got := p.SelectUpstream(); got != nil {
		t.Fatalf("expected nil upstream when all nodes are offline, got %v", got.ID)
	}

	rec := httptest.NewRecorder()
	p.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/work", nil))
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 when all nodes offline, got %d", rec.Code)
	}

	// Verify AdminToken authorization guard on POST /api/weights
	pAuth, err := NewProxy(Config{
		Algorithm:  AlgoFuzzLoad,
		Upstreams:  []UpstreamSpec{{ID: "n1", URL: servers[0].URL}},
		AdminToken: "secret-admin-key",
	})
	if err != nil {
		t.Fatal(err)
	}
	mux := pAuth.ControlMux()

	unauthRec := httptest.NewRecorder()
	unauthReq := httptest.NewRequest(http.MethodPost, "/api/weights", strings.NewReader(`{"algorithm":"round_robin"}`))
	mux.ServeHTTP(unauthRec, unauthReq)
	if unauthRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unauthorized /api/weights, got %d", unauthRec.Code)
	}

	authRec := httptest.NewRecorder()
	authReq := httptest.NewRequest(http.MethodPost, "/api/weights", strings.NewReader(`{"algorithm":"round_robin"}`))
	authReq.Header.Set("Authorization", "Bearer secret-admin-key")
	mux.ServeHTTP(authRec, authReq)
	if authRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for authorized /api/weights, got %d", authRec.Code)
	}
}

func TestPassiveCircuitBreakerCooldownRecoveryAndHalfOpenFailure(t *testing.T) {
	failMode := true
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		if failMode {
			http.Error(w, "fail", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	p, err := NewProxy(Config{
		Algorithm: AlgoFuzzLoad,
		Upstreams: []UpstreamSpec{{ID: "only", URL: srv.URL, InitialWeight: 1.0}},
		Health: HealthConfig{
			Enabled:          false,
			FailureThreshold: 2,
			Cooldown:         60 * time.Millisecond,
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	// Two 500s must trip the circuit (and record exactly 2 errors, not 4).
	for i := 0; i < 2; i++ {
		rec := httptest.NewRecorder()
		p.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/work", nil))
	}
	if errs := p.Nodes()[0].ErrorsCount.Load(); errs != 2 {
		t.Fatalf("expected exactly 2 recorded errors, got %d", errs)
	}
	if p.SelectUpstream() != nil {
		t.Fatalf("expected circuit tripped during cooldown")
	}

	// Wait for passive recovery refresh after cooldown
	time.Sleep(110 * time.Millisecond)
	if p.SelectUpstream() == nil {
		t.Fatalf("expected node eligible for half-open recovery after cooldown")
	}

	// Failed half-open attempt must immediately reopen circuit with fresh cooldown
	rec := httptest.NewRecorder()
	p.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/work", nil))
	if p.SelectUpstream() != nil {
		t.Fatalf("expected failed half-open attempt to re-open circuit immediately")
	}

	// Wait again, switch server to healthy, confirm full recovery
	failMode = false
	time.Sleep(110 * time.Millisecond)
	okRec := httptest.NewRecorder()
	p.ServeHTTP(okRec, httptest.NewRequest(http.MethodGet, "/work", nil))
	if okRec.Code != http.StatusOK || p.Nodes()[0].circuitOpen.Load() {
		t.Fatalf("expected 200 and closed circuit after successful half-open recovery")
	}
}

func TestStandalonePureGoAdaptiveControlLoop(t *testing.T) {
	p, servers := newTestProxy(t, AlgoFuzzLoad)
	defer func() {
		for _, s := range servers {
			s.Close()
		}
	}()

	// Simulate severe degradation on node-2 (high latency + high CPU) while node-1 stays fast
	nodes := p.Nodes()
	for i := 0; i < 64; i++ {
		nodes[0].Latency.Record(16.0)
		nodes[1].Latency.Record(215.0)
		nodes[2].Latency.Record(28.0)
		nodes[3].Latency.Record(42.0)
	}
	nodes[0].SetCPU(0.18)
	nodes[1].SetCPU(0.94)
	nodes[2].SetCPU(0.32)
	nodes[3].SetCPU(0.45)

	cfg := DefaultAdaptiveConfig()
	var weights map[string]float64
	for step := 0; step < 5; step++ {
		weights = p.RecomputeAdaptiveWeights(cfg)
	}

	if weights["node-1"] <= weights["node-2"]*3.0 {
		t.Fatalf("expected standalone pure-Go Neuro-Fuzzy+GP loop to drain degraded node-2 heavily; got %v", weights)
	}
	sum := 0.0
	for _, w := range weights {
		sum += w
	}
	if sum < 0.99 || sum > 1.01 {
		t.Fatalf("expected normalized weights summing to ~1.0, got %.4f (%v)", sum, weights)
	}
}

func BenchmarkSelectUpstreamFuzzLoad(b *testing.B) {
	p, err := NewProxy(Config{
		Algorithm: AlgoFuzzLoad,
		Upstreams: DefaultClusterSpecs(),
	})
	if err != nil {
		b.Fatal(err)
	}
	b.ReportAllocs()
	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			_ = p.SelectUpstream()
		}
	})
}

func BenchmarkLatencyRingRecord(b *testing.B) {
	var ring LatencyRing
	b.ReportAllocs()
	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			ring.Record(21.45)
		}
	})
}
