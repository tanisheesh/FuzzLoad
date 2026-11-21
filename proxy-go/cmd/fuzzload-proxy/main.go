package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/tanisheesh/FuzzLoad/proxy-go/pkg/fuzzload"
)

type fileConfig struct {
	Policy    string                  `json:"policy"`
	Upstreams []fuzzload.UpstreamSpec `json:"upstreams"`
}

func loadUpstreams(configPath, upstreamsFlag, weightsFlag string) ([]fuzzload.UpstreamSpec, string, error) {
	if configPath != "" {
		raw, err := os.ReadFile(configPath)
		if err != nil {
			return nil, "", fmt.Errorf("read config %s: %w", configPath, err)
		}
		var cfg fileConfig
		if err := json.Unmarshal(raw, &cfg); err != nil {
			return nil, "", fmt.Errorf("parse config %s: %w", configPath, err)
		}
		if len(cfg.Upstreams) == 0 {
			return nil, "", fmt.Errorf("config %s contains no upstreams", configPath)
		}
		return cfg.Upstreams, cfg.Policy, nil
	}

	if strings.TrimSpace(upstreamsFlag) == "" {
		return fuzzload.DefaultClusterSpecs(), "", nil
	}

	rawURLs := strings.Split(upstreamsFlag, ",")
	var parsedWeights []float64
	if strings.TrimSpace(weightsFlag) != "" {
		for _, part := range strings.Split(weightsFlag, ",") {
			if w, err := strconv.ParseFloat(strings.TrimSpace(part), 64); err == nil && w >= 0 {
				parsedWeights = append(parsedWeights, w)
			}
		}
	}

	specs := make([]fuzzload.UpstreamSpec, 0, len(rawURLs))
	for i, raw := range rawURLs {
		u := strings.TrimSpace(raw)
		if u == "" {
			continue
		}
		w := 1.0 / float64(len(rawURLs))
		if i < len(parsedWeights) {
			w = parsedWeights[i]
		}
		specs = append(specs, fuzzload.UpstreamSpec{
			ID:            fmt.Sprintf("node-%d", i+1),
			Name:          fmt.Sprintf("Upstream-%d (%s)", i+1, u),
			URL:           u,
			CapacityCores: 2.0,
			MemoryGB:      8.0,
			StaticWeight:  2,
			InitialWeight: w,
		})
	}
	if len(specs) == 0 {
		return fuzzload.DefaultClusterSpecs(), "", nil
	}
	return specs, "", nil
}

// startBackgroundLoadGen optionally generates real HTTP requests through the local Go proxy
// so live socket telemetry flows continuously into the Python ANFIS + GP control plane.
func startBackgroundLoadGen(ctx context.Context, proxyURL string, rpsTarget *atomic.Int64) {
	client := &http.Client{
		Timeout: 2 * time.Second,
		Transport: &http.Transport{
			MaxIdleConns:        128,
			MaxIdleConnsPerHost: 128,
		},
	}

	go func() {
		ticker := time.NewTicker(50 * time.Millisecond) // 20 batches/sec
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				rps := rpsTarget.Load()
				if rps <= 0 {
					continue
				}
				batch := int(rps / 20)
				if batch < 1 {
					batch = 1
				}
				if batch > 40 {
					batch = 40
				}
				for i := 0; i < batch; i++ {
					go func() {
						req, err := http.NewRequestWithContext(ctx, http.MethodGet, proxyURL+"/work", nil)
						if err != nil {
							return
						}
						resp, err := client.Do(req)
						if err != nil {
							return
						}
						_, _ = io.Copy(io.Discard, resp.Body)
						_ = resp.Body.Close()
					}()
				}
			}
		}
	}()
}

func main() {
	defaultPort := os.Getenv("GO_PROXY_PORT")
	if defaultPort == "" {
		defaultPort = "8080"
	}

	portFlag := flag.String("port", defaultPort, "Port for the FuzzLoad Go reverse proxy")
	upstreamsFlag := flag.String("upstreams", os.Getenv("UPSTREAMS"), "Comma-separated upstream URLs")
	weightsFlag := flag.String("weights", "", "Comma-separated initial routing weights matching --upstreams")
	policyFlag := flag.String("policy", os.Getenv("POLICY"), "Initial routing policy (fuzzload|anfis_only|weighted_round_robin|least_connections|round_robin)")
	configFlag := flag.String("config", "", "Path to fuzzload.config.json")
	spawnWorkers := flag.Bool("spawn-workers", true, "Spawn built-in heterogeneous Go worker nodes when using default cluster")
	standaloneAuto := flag.Bool("standalone-auto", false, "Run pure-Go Neuro-Fuzzy + GP auto-adaptation loop inside Go (no Python control plane needed)")
	loadgenRPS := flag.Int64("loadgen-rps", 0, "Optional internal HTTP load generator RPS against the proxy (0 disables)")
	flag.Parse()

	specs, filePolicy, err := loadUpstreams(*configFlag, *upstreamsFlag, *weightsFlag)
	if err != nil {
		log.Fatalf("failed to load upstreams: %v", err)
	}

	algo := *policyFlag
	if algo == "" {
		algo = filePolicy
	}
	if algo == "" {
		algo = fuzzload.AlgoFuzzLoad
	}

	proxy, err := fuzzload.NewProxy(fuzzload.Config{
		Algorithm: algo,
		Upstreams: specs,
		Health:    fuzzload.DefaultHealthConfig(),
	})
	if err != nil {
		log.Fatalf("failed to initialize FuzzLoad proxy: %v", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	useDefaultWorkers := *spawnWorkers && strings.TrimSpace(*upstreamsFlag) == "" && *configFlag == ""
	if useDefaultWorkers {
		for _, node := range proxy.Nodes() {
			go fuzzload.StartSimulatedWorker(ctx, node)
		}
		// Give workers a brief moment to bind before starting active health probes.
		time.Sleep(100 * time.Millisecond)
	}

	proxy.StartHealthProber(ctx)
	if *standaloneAuto {
		proxy.StartAutoControlLoop(ctx, fuzzload.DefaultAdaptiveConfig())
	}

	var rpsAtomic atomic.Int64
	rpsAtomic.Store(*loadgenRPS)
	if *loadgenRPS > 0 {
		startBackgroundLoadGen(ctx, fmt.Sprintf("http://127.0.0.1:%s", *portFlag), &rpsAtomic)
	} else {
		// Always start dormant loadgen goroutine so POST /api/loadgen can enable it at runtime.
		startBackgroundLoadGen(ctx, fmt.Sprintf("http://127.0.0.1:%s", *portFlag), &rpsAtomic)
	}

	baseHandler := proxy.ControlMux()
	rootHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/loadgen" {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Content-Type", "application/json")
			if r.Method == http.MethodGet {
				_ = json.NewEncoder(w).Encode(map[string]any{"rps": rpsAtomic.Load()})
				return
			}
			if r.Method == http.MethodPost {
				var body struct {
					RPS int64 `json:"rps"`
				}
				if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
					http.Error(w, err.Error(), http.StatusBadRequest)
					return
				}
				if body.RPS < 0 {
					body.RPS = 0
				}
				if body.RPS > 1500 {
					body.RPS = 1500
				}
				rpsAtomic.Store(body.RPS)
				_ = json.NewEncoder(w).Encode(map[string]any{"status": "updated", "rps": body.RPS})
				return
			}
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		baseHandler.ServeHTTP(w, r)
	})

	srv := &http.Server{
		Addr:              ":" + *portFlag,
		Handler:           rootHandler,
		ReadHeaderTimeout: 5 * time.Second,
	}

	shutdownDone := make(chan struct{})
	go func() {
		defer close(shutdownDone)
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		if err := srv.Shutdown(shutdownCtx); err != nil {
			log.Printf("[FuzzLoad Go Data Plane] graceful shutdown error: %v", err)
		}
	}()

	log.Printf("[FuzzLoad Go Data Plane] Reverse Proxy listening on :%s (policy=%s, upstreams=%d, workers=%v)",
		*portFlag, proxy.Algorithm(), len(proxy.Nodes()), useDefaultWorkers)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("proxy server failed: %v", err)
	}
	<-shutdownDone
}
