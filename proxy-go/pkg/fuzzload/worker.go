package fuzzload

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand/v2"
	"net/http"
	"time"
)

// DefaultClusterSpecs returns the standard 4-node heterogeneous local cluster specification.
func DefaultClusterSpecs() []UpstreamSpec {
	return []UpstreamSpec{
		{ID: "node-1", Name: "Node-1 (4c Compute)", URL: "http://127.0.0.1:9001", CapacityCores: 4.0, MemoryGB: 16.0, StaticWeight: 4, InitialWeight: 0.38},
		{ID: "node-2", Name: "Node-2 (2c General)", URL: "http://127.0.0.1:9002", CapacityCores: 2.0, MemoryGB: 8.0, StaticWeight: 2, InitialWeight: 0.24},
		{ID: "node-3", Name: "Node-3 (2c Memory)", URL: "http://127.0.0.1:9003", CapacityCores: 2.0, MemoryGB: 16.0, StaticWeight: 2, InitialWeight: 0.24},
		{ID: "node-4", Name: "Node-4 (1c Edge)", URL: "http://127.0.0.1:9004", CapacityCores: 1.0, MemoryGB: 4.0, StaticWeight: 1, InitialWeight: 0.14},
	}
}

// StartSimulatedWorker runs an HTTP backend worker server that models heterogeneous
// queueing latency and responds to synthetic ChaosState injections.
func StartSimulatedWorker(ctx context.Context, n *UpstreamNode) {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		if n.Chaos().Offline {
			http.Error(w, "node offline", http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	mux.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) {
		chaos := n.Chaos()
		if chaos.Offline {
			http.Error(w, "node offline", http.StatusServiceUnavailable)
			return
		}

		cores := n.CapacityCores
		conns := float64(n.ActiveConnections.Load())
		baseDelayMs := 14.0 / math.Sqrt(cores)
		queueDelayMs := (conns * conns) / (cores * 1.8)
		if chaos.CPUSpike {
			queueDelayMs += 90.0
		}
		if chaos.IOLag {
			queueDelayMs += 125.0
		}
		if chaos.MemLeak {
			queueDelayMs += 45.0
		}
		totalMs := baseDelayMs + queueDelayMs + rand.Float64()*6.0
		time.Sleep(time.Duration(totalMs) * time.Millisecond)

		cpuBase := math.Min(0.98, 0.12+(conns/(cores*14.0)))
		if chaos.CPUSpike {
			cpuBase = math.Min(0.99, cpuBase+0.55)
		}
		memBase := math.Min(0.97, 0.22+(conns*0.015))
		if chaos.MemLeak {
			memBase = math.Min(0.98, memBase+0.50)
		}
		n.SetCPU(cpuBase)
		n.SetMem(memBase)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"node_id":    n.ID,
			"latency_ms": math.Round(totalMs*100.0) / 100.0,
			"cpu_usage":  math.Round(cpuBase*1000.0) / 1000.0,
			"mem_usage":  math.Round(memBase*1000.0) / 1000.0,
			"status":     "ok",
		})
	})

	addr := fmt.Sprintf(":%d", n.Port)
	srv := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
	}()

	log.Printf("[Worker %s] listening on %s (%.1f vCPU / %.0f GB RAM)", n.ID, addr, n.CapacityCores, n.MemoryGB)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Printf("[Worker %s] stopped: %v", n.ID, err)
	}
}
