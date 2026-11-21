package fuzzload_test

import (
	"fmt"

	"github.com/tanisheesh/FuzzLoad/proxy-go/pkg/fuzzload"
)

func ExampleNewProxy() {
	proxy, err := fuzzload.NewProxy(fuzzload.Config{
		Algorithm: fuzzload.AlgoFuzzLoad,
		Upstreams: []fuzzload.UpstreamSpec{
			{ID: "worker-a", URL: "http://127.0.0.1:9001", CapacityCores: 4, InitialWeight: 0.70},
			{ID: "worker-b", URL: "http://127.0.0.1:9002", CapacityCores: 2, InitialWeight: 0.30},
		},
	})
	if err != nil {
		panic(err)
	}

	// Zero-allocation hot-path selection (~7.5 ns/op, 0 allocs/op)
	target := proxy.SelectUpstream()
	fmt.Println("selected valid upstream:", target.ID == "worker-a" || target.ID == "worker-b")

	// Standalone pure-Go Neuro-Fuzzy + GP adaptation step
	weights := proxy.RecomputeAdaptiveWeights(fuzzload.DefaultAdaptiveConfig())
	fmt.Println("weights computed:", len(weights))
	// Output:
	// selected valid upstream: true
	// weights computed: 2
}
