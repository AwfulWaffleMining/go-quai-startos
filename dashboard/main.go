// Command quai-dashboard serves the solo mining dashboard for the StartOS
// go-quai package and keeps the history the node itself does not store.
//
// go-quai holds its stratum stats in memory only: workers disappear on restart,
// hashrate is a 10-minute window, and the share history is capped at 500. This
// collector polls the node and persists what a miner wants to keep — hashrate
// history, per-worker averages, shares and found blocks — on the service volume.
package main

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

var algos = []string{"sha256", "scrypt", "kawpow"}

// poll and sample intervals (overridable for tests)
var (
	sampleInterval = time.Minute
	pollInterval   = 15 * time.Second
)

const (
	saveEvery     = 5 * time.Minute
	historyKeep   = 7 * 24 * 60      // 7 days of per-minute samples
	sharesKeep    = 6000             // per algorithm
	workerExpiry  = 24 * time.Hour   // offline workers drop off after this
	activeWithin  = 10 * time.Minute // a share this recent counts as active
	httpTimeout   = 8 * time.Second
	fileMode      = 0o644
	dirMode       = 0o755
	csvMaxRecords = 20000
)

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// ── persisted state ───────────────────────────────────────────────────────────

type Sample struct {
	T int64   `json:"t"` // unix ms
	H float64 `json:"h"` // hashrate
	R float64 `json:"r"` // reject percent
}

type Worker struct {
	Address       string    `json:"address"`
	WorkerName    string    `json:"workerName"`
	Algorithm     string    `json:"algorithm"`
	Hashrate      float64   `json:"hashrate"`
	Avg24h        float64   `json:"avg24h"`
	Difficulty    float64   `json:"difficulty"`
	SharesValid   uint64    `json:"sharesValid"`
	SharesStale   uint64    `json:"sharesStale"`
	SharesInvalid uint64    `json:"sharesInvalid"`
	LastShareAt   time.Time `json:"lastShareAt"`
	Status        string    `json:"status"` // active | offline
	Samples       []Sample  `json:"samples,omitempty"`
}

type Block struct {
	Height    uint64    `json:"height"`
	Hash      string    `json:"hash"`
	Worker    string    `json:"worker"`
	Algorithm string    `json:"algorithm"`
	FoundAt   time.Time `json:"foundAt"`
	EstReward float64   `json:"estReward"`
}

type Share struct {
	T         int64   `json:"t"`
	Diff      float64 `json:"diff"`
	Threshold float64 `json:"threshold"`
	IsBlock   bool    `json:"isBlock"`
}

type AlgoSummary struct {
	Hashrate      float64 `json:"hashrate"`
	WorkshareDiff float64 `json:"workshareDiff"`
	SharesValid   uint64  `json:"sharesValid"`
	SharesStale   uint64  `json:"sharesStale"`
	SharesInvalid uint64  `json:"sharesInvalid"`
	BestLuck      float64 `json:"bestLuck"`
	AvgLuck       float64 `json:"avgLuck"`
}

type NodeSummary struct {
	Synced bool   `json:"synced"`
	Height uint64 `json:"height"`
	Tip    uint64 `json:"tip"`
	Behind int64  `json:"behind"`
}

type MiningSummary struct {
	EstimatedBlockReward float64 `json:"estimatedBlockReward"`
	WorkshareReward      float64 `json:"workshareReward"`
	AvgBlockTime         float64 `json:"avgBlockTime"`
}

type Summary struct {
	Node   NodeSummary            `json:"node"`
	Mining MiningSummary          `json:"mining"`
	Algos  map[string]AlgoSummary `json:"algos"`
}

// store is everything kept on disk.
type store struct {
	History map[string][]Sample `json:"history"`
	Workers map[string]*Worker  `json:"workers"`
	Blocks  []Block             `json:"blocks"`
	Shares  map[string][]Share  `json:"shares"`
	Best    map[string]float64  `json:"bestLuck"`
	LuckSum map[string]float64  `json:"luckSum"`
	LuckN   map[string]float64  `json:"luckN"`
}

type collector struct {
	mu       sync.RWMutex
	st       store
	summary  Summary
	dataDir  string
	stratum  string
	health   string
	rpc      string
	client   *http.Client
	lastSeen map[string]time.Time // share counters for reject-rate deltas
	lastCnt  map[string][3]uint64
	dirty    bool
}

func newCollector(dataDir, stratum, health, rpc string) *collector {
	c := &collector{
		dataDir: dataDir, stratum: stratum, health: health, rpc: rpc,
		client:   &http.Client{Timeout: httpTimeout},
		lastSeen: map[string]time.Time{},
		lastCnt:  map[string][3]uint64{},
	}
	c.st = store{
		History: map[string][]Sample{}, Workers: map[string]*Worker{}, Shares: map[string][]Share{},
		Best: map[string]float64{}, LuckSum: map[string]float64{}, LuckN: map[string]float64{},
	}
	c.summary.Algos = map[string]AlgoSummary{}
	c.load()
	return c
}

func (c *collector) path() string { return filepath.Join(c.dataDir, "stats.json") }

func (c *collector) load() {
	b, err := os.ReadFile(c.path())
	if err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			log.Printf("dashboard: could not read stored stats: %v", err)
		}
		return
	}
	var s store
	if err := json.Unmarshal(b, &s); err != nil {
		log.Printf("dashboard: stored stats are unreadable, starting fresh: %v", err)
		return
	}
	if s.History == nil {
		s.History = map[string][]Sample{}
	}
	if s.Workers == nil {
		s.Workers = map[string]*Worker{}
	}
	if s.Shares == nil {
		s.Shares = map[string][]Share{}
	}
	if s.Best == nil {
		s.Best = map[string]float64{}
	}
	if s.LuckSum == nil {
		s.LuckSum = map[string]float64{}
	}
	if s.LuckN == nil {
		s.LuckN = map[string]float64{}
	}
	c.st = s
	log.Printf("dashboard: loaded %d blocks, %d workers from %s", len(s.Blocks), len(s.Workers), c.path())
}

// save writes atomically: a half-written stats file would lose the block history.
func (c *collector) save() {
	c.mu.RLock()
	b, err := json.Marshal(c.st)
	c.mu.RUnlock()
	if err != nil {
		log.Printf("dashboard: could not encode stats: %v", err)
		return
	}
	if err := os.MkdirAll(c.dataDir, dirMode); err != nil {
		log.Printf("dashboard: could not create %s: %v", c.dataDir, err)
		return
	}
	tmp := c.path() + ".tmp"
	if err := os.WriteFile(tmp, b, fileMode); err != nil {
		log.Printf("dashboard: could not write stats: %v", err)
		return
	}
	if err := os.Rename(tmp, c.path()); err != nil {
		log.Printf("dashboard: could not replace stats: %v", err)
	}
}

// ── node polling ──────────────────────────────────────────────────────────────

func (c *collector) getJSON(url string, out interface{}) error {
	resp, err := c.client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 && resp.StatusCode != http.StatusServiceUnavailable {
		return fmt.Errorf("%s: %s", url, resp.Status)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

type poolOverview struct {
	Hashrate    float64 `json:"hashrate"`
	BlockHeight uint64  `json:"blockHeight"`
	SHA256      algoRaw `json:"sha256"`
	Scrypt      algoRaw `json:"scrypt"`
	KawPoW      algoRaw `json:"kawpow"`
}

type algoRaw struct {
	Hashrate    float64 `json:"hashrate"`
	Workers     int     `json:"workers"`
	SharesValid uint64  `json:"sharesValid"`
}

type rawWorker struct {
	Address       string    `json:"address"`
	WorkerName    string    `json:"workerName"`
	Algorithm     string    `json:"algorithm"`
	Hashrate      float64   `json:"hashrate"`
	Difficulty    float64   `json:"difficulty"`
	SharesValid   uint64    `json:"sharesValid"`
	SharesStale   uint64    `json:"sharesStale"`
	SharesInvalid uint64    `json:"sharesInvalid"`
	LastShareAt   time.Time `json:"lastShareAt"`
	IsConnected   bool      `json:"isConnected"`
}

type rawShare struct {
	Timestamp          time.Time `json:"timestamp"`
	Algorithm          string    `json:"algorithm"`
	AchievedDifficulty float64   `json:"achievedDifficulty"`
	WorkshareDiff      float64   `json:"workshareDiff"`
	LuckPercent        float64   `json:"luckPercent"`
	IsBlock            bool      `json:"isBlock"`
}

type shareHistory struct {
	Shares        []rawShare `json:"shares"`
	WorkshareDiff float64    `json:"workshareDiff"`
	BestShareLuck float64    `json:"bestShareLuck"`
	AverageLuck   float64    `json:"averageLuck"`
}

type rawBlock struct {
	Height    uint64    `json:"height"`
	Hash      string    `json:"hash"`
	Worker    string    `json:"worker"`
	Algorithm string    `json:"algorithm"`
	FoundAt   time.Time `json:"foundAt"`
}

type nodeHealth struct {
	Healthy           bool   `json:"healthy"`
	LocalBlockNum     uint64 `json:"localBlockNum"`
	ReferenceBlockNum uint64 `json:"referenceBlockNum"`
	BlocksBehind      int64  `json:"blocksBehind"`
}

func workerKey(w rawWorker) string {
	return w.Address + "|" + w.WorkerName + "|" + w.Algorithm
}

func (c *collector) poll() {
	var ov poolOverview
	if err := c.getJSON(c.stratum+"/api/pool/stats", &ov); err != nil {
		log.Printf("dashboard: stratum stats unavailable: %v", err)
		return
	}
	var raws []rawWorker
	if err := c.getJSON(c.stratum+"/api/pool/workers", &raws); err != nil {
		log.Printf("dashboard: stratum workers unavailable: %v", err)
	}
	var hp nodeHealth
	nodeOK := c.getJSON(c.health+"/", &hp) == nil
	mining := c.miningInfo()

	var blocks []rawBlock
	if err := c.getJSON(c.stratum+"/api/pool/blocks", &blocks); err != nil {
		log.Printf("dashboard: stratum blocks unavailable: %v", err)
	}

	perAlgo := map[string]algoRaw{"sha256": ov.SHA256, "scrypt": ov.Scrypt, "kawpow": ov.KawPoW}
	now := time.Now()

	c.mu.Lock()
	defer c.mu.Unlock()

	// workers: everything reported is connected; anything previously seen and now
	// missing is offline until it ages out.
	seen := map[string]bool{}
	for _, r := range raws {
		k := workerKey(r)
		seen[k] = true
		w := c.st.Workers[k]
		if w == nil {
			w = &Worker{Address: r.Address, WorkerName: r.WorkerName, Algorithm: r.Algorithm}
			c.st.Workers[k] = w
		}
		w.Hashrate, w.Difficulty = r.Hashrate, r.Difficulty
		w.SharesValid, w.SharesStale, w.SharesInvalid = r.SharesValid, r.SharesStale, r.SharesInvalid
		w.LastShareAt = r.LastShareAt
		if !r.LastShareAt.IsZero() && now.Sub(r.LastShareAt) > activeWithin {
			w.Status = "offline"
		} else {
			w.Status = "active"
		}
		c.lastSeen[k] = now
	}
	for k, w := range c.st.Workers {
		if !seen[k] {
			w.Status = "offline"
			w.Hashrate = 0
			last := w.LastShareAt
			if last.IsZero() {
				last = c.lastSeen[k]
			}
			if !last.IsZero() && now.Sub(last) > workerExpiry {
				delete(c.st.Workers, k)
				delete(c.lastSeen, k)
			}
		}
	}

	// shares and luck
	algoSummary := map[string]AlgoSummary{}
	for _, a := range algos {
		var sh shareHistory
		if err := c.getJSON(c.stratum+"/api/pool/shares?algorithm="+a, &sh); err != nil {
			log.Printf("dashboard: stratum shares (%s) unavailable: %v", a, err)
		}
		newest := int64(0)
		for _, s := range c.st.Shares[a] {
			if s.T > newest {
				newest = s.T
			}
		}
		for _, s := range sh.Shares {
			ms := s.Timestamp.UnixMilli()
			if ms <= newest {
				continue
			}
			c.st.Shares[a] = append(c.st.Shares[a], Share{T: ms, Diff: s.AchievedDifficulty, Threshold: s.WorkshareDiff, IsBlock: s.IsBlock})
			if s.LuckPercent > c.st.Best[a] {
				c.st.Best[a] = s.LuckPercent
			}
			c.st.LuckSum[a] += s.LuckPercent
			c.st.LuckN[a]++
		}
		if n := len(c.st.Shares[a]); n > sharesKeep {
			c.st.Shares[a] = append([]Share(nil), c.st.Shares[a][n-sharesKeep:]...)
		}
		var valid, stale, invalid uint64
		for _, w := range c.st.Workers {
			if w.Algorithm == a {
				valid += w.SharesValid
				stale += w.SharesStale
				invalid += w.SharesInvalid
			}
		}
		if valid == 0 {
			valid = perAlgo[a].SharesValid
		}
		avg := 0.0
		if c.st.LuckN[a] > 0 {
			avg = c.st.LuckSum[a] / c.st.LuckN[a]
		}
		diff := sh.WorkshareDiff
		if diff == 0 {
			// fall back to the threshold carried on the most recent share
			if n := len(c.st.Shares[a]); n > 0 {
				diff = c.st.Shares[a][n-1].Threshold
			}
		}
		algoSummary[a] = AlgoSummary{
			Hashrate: perAlgo[a].Hashrate, WorkshareDiff: diff,
			SharesValid: valid, SharesStale: stale, SharesInvalid: invalid,
			BestLuck: c.st.Best[a], AvgLuck: avg,
		}
	}

	// blocks: keep every one ever seen, with the reward estimated when found
	known := map[string]bool{}
	for _, b := range c.st.Blocks {
		known[b.Hash] = true
	}
	for _, b := range blocks {
		if b.Hash == "" || known[b.Hash] {
			continue
		}
		c.st.Blocks = append([]Block{{
			Height: b.Height, Hash: b.Hash, Worker: b.Worker, Algorithm: b.Algorithm,
			FoundAt: b.FoundAt, EstReward: mining.EstimatedBlockReward,
		}}, c.st.Blocks...)
		known[b.Hash] = true
		log.Printf("dashboard: recorded block %d (%s) found by %s", b.Height, b.Algorithm, b.Worker)
	}
	sort.SliceStable(c.st.Blocks, func(i, j int) bool { return c.st.Blocks[i].FoundAt.After(c.st.Blocks[j].FoundAt) })

	node := NodeSummary{Synced: nodeOK && hp.Healthy, Height: hp.LocalBlockNum, Tip: hp.ReferenceBlockNum, Behind: hp.BlocksBehind}
	if node.Height == 0 {
		node.Height = ov.BlockHeight
	}
	if node.Tip < node.Height {
		node.Tip = node.Height
	}
	c.summary = Summary{Node: node, Mining: mining, Algos: algoSummary}
	c.dirty = true
}

// miningInfo asks the node's zone RPC for reward and difficulty figures.
func (c *collector) miningInfo() MiningSummary {
	body := strings.NewReader(`{"jsonrpc":"2.0","id":1,"method":"quai_getMiningInfo","params":[true]}`)
	req, err := http.NewRequest(http.MethodPost, c.rpc, body)
	if err != nil {
		return MiningSummary{}
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return MiningSummary{}
	}
	defer resp.Body.Close()
	var out struct {
		Result map[string]interface{} `json:"result"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return MiningSummary{}
	}
	num := func(k string) float64 {
		switch v := out.Result[k].(type) {
		case float64:
			return v
		case string:
			f, err := strconv.ParseFloat(strings.TrimPrefix(v, "0x"), 64)
			if err == nil {
				return f
			}
		}
		return 0
	}
	return MiningSummary{
		EstimatedBlockReward: num("estimatedBlockReward"),
		WorkshareReward:      num("workshareReward"),
		AvgBlockTime:         num("avgBlockTime"),
	}
}

// sample appends one hashrate point per algorithm, with the reject rate over
// the interval rather than since the node started.
func (c *collector) sample() {
	c.mu.Lock()
	defer c.mu.Unlock()
	now := time.Now().UnixMilli()
	for _, a := range algos {
		s := c.summary.Algos[a]
		prev := c.lastCnt[a]
		cur := [3]uint64{s.SharesValid, s.SharesStale, s.SharesInvalid}
		rej := 0.0
		if d := float64((cur[0] - prev[0]) + (cur[1] - prev[1]) + (cur[2] - prev[2])); d > 0 && cur[0] >= prev[0] {
			rej = 100 * float64((cur[1]-prev[1])+(cur[2]-prev[2])) / d
		}
		c.lastCnt[a] = cur
		c.st.History[a] = append(c.st.History[a], Sample{T: now, H: s.Hashrate, R: rej})
		if n := len(c.st.History[a]); n > historyKeep {
			c.st.History[a] = append([]Sample(nil), c.st.History[a][n-historyKeep:]...)
		}
	}
	// per-worker 24h averages, from the worker's own samples
	for _, w := range c.st.Workers {
		w.Samples = append(w.Samples, Sample{T: now, H: w.Hashrate})
		cut := time.Now().Add(-24 * time.Hour).UnixMilli()
		kept := w.Samples[:0]
		var sum float64
		for _, s := range w.Samples {
			if s.T >= cut {
				kept = append(kept, s)
				sum += s.H
			}
		}
		w.Samples = kept
		if len(kept) > 0 {
			w.Avg24h = sum / float64(len(kept))
		}
	}
	c.dirty = true
}

func (c *collector) run(ctx context.Context) {
	c.poll()
	pollT, sampleT, saveT := time.NewTicker(pollInterval), time.NewTicker(sampleInterval), time.NewTicker(saveEvery)
	defer pollT.Stop()
	defer sampleT.Stop()
	defer saveT.Stop()
	for {
		select {
		case <-ctx.Done():
			c.save()
			return
		case <-pollT.C:
			c.poll()
		case <-sampleT.C:
			c.sample()
		case <-saveT.C:
			c.mu.RLock()
			d := c.dirty
			c.mu.RUnlock()
			if d {
				c.save()
				c.mu.Lock()
				c.dirty = false
				c.mu.Unlock()
			}
		}
	}
}

// ── HTTP ──────────────────────────────────────────────────────────────────────

func rangeMillis(r string) int64 {
	switch r {
	case "1h":
		return 3600 * 1000
	case "7d":
		return 7 * 24 * 3600 * 1000
	default:
		return 24 * 3600 * 1000
	}
}

func writeJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("dashboard: response failed: %v", err)
	}
}

func (c *collector) handleSummary(w http.ResponseWriter, r *http.Request) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	writeJSON(w, c.summary)
}

func (c *collector) handleWorkers(w http.ResponseWriter, r *http.Request) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	out := make([]Worker, 0, len(c.st.Workers))
	for _, x := range c.st.Workers {
		cp := *x
		cp.Samples = nil
		out = append(out, cp)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Hashrate > out[j].Hashrate })
	writeJSON(w, out)
}

func (c *collector) handleBlocks(w http.ResponseWriter, r *http.Request) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	writeJSON(w, c.st.Blocks)
}

func (c *collector) handleHistory(w http.ResponseWriter, r *http.Request) {
	cut := time.Now().UnixMilli() - rangeMillis(r.URL.Query().Get("range"))
	c.mu.RLock()
	defer c.mu.RUnlock()
	out := map[string][][3]float64{}
	for _, a := range algos {
		pts := make([][3]float64, 0, 64)
		for _, s := range c.st.History[a] {
			if s.T >= cut {
				pts = append(pts, [3]float64{float64(s.T), s.H, s.R})
			}
		}
		out[a] = pts
	}
	writeJSON(w, out)
}

func (c *collector) handleShares(w http.ResponseWriter, r *http.Request) {
	cut := time.Now().UnixMilli() - rangeMillis(r.URL.Query().Get("range"))
	c.mu.RLock()
	defer c.mu.RUnlock()
	out := map[string][]Share{}
	for _, a := range algos {
		list := make([]Share, 0, 64)
		for _, s := range c.st.Shares[a] {
			if s.T >= cut {
				list = append(list, s)
			}
		}
		out[a] = list
	}
	writeJSON(w, out)
}

func (c *collector) handleCSV(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	rng := q.Get("range")
	algo := q.Get("algo")
	if algo == "" {
		algo = "sha256"
	}
	cut := time.Now().UnixMilli() - rangeMillis(rng)
	c.mu.RLock()
	rows := make([][]string, 0, 64)
	for _, s := range c.st.History[algo] {
		if s.T < cut {
			continue
		}
		rows = append(rows, []string{
			time.UnixMilli(s.T).UTC().Format(time.RFC3339),
			strconv.FormatFloat(s.H, 'f', 2, 64),
			strconv.FormatFloat(s.R, 'f', 3, 64),
		})
		if len(rows) >= csvMaxRecords {
			break
		}
	}
	c.mu.RUnlock()
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=quai-%s-%s.csv", algo, rng))
	cw := csv.NewWriter(w)
	_ = cw.Write([]string{"timestamp_utc", "hashrate_hs", "reject_percent"})
	_ = cw.WriteAll(rows)
	cw.Flush()
}

func main() {
	log.SetFlags(0)
	var (
		addr    = env("DASH_ADDR", ":8080")
		assets  = env("DASH_ASSETS", "/opt/dashboard")
		dataDir = env("DASH_DATA", "/data/dashboard")
		stratum = env("DASH_STRATUM", "http://127.0.0.1:3336")
		health  = env("DASH_HEALTH", "http://127.0.0.1:8081")
		rpc     = env("DASH_RPC", "http://127.0.0.1:9200")
	)
	c := newCollector(dataDir, stratum, health, rpc)
	for _, o := range []struct {
		env string
		dst *time.Duration
	}{{"DASH_SAMPLE_SECONDS", &sampleInterval}, {"DASH_POLL_SECONDS", &pollInterval}} { // tests only
		if n, err := strconv.Atoi(os.Getenv(o.env)); err == nil && n > 0 {
			*o.dst = time.Duration(n) * time.Second
		}
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()
	go c.run(ctx)

	mux := http.NewServeMux()
	mux.HandleFunc("/dash/summary", c.handleSummary)
	mux.HandleFunc("/dash/workers", c.handleWorkers)
	mux.HandleFunc("/dash/blocks", c.handleBlocks)
	mux.HandleFunc("/dash/history", c.handleHistory)
	mux.HandleFunc("/dash/shares", c.handleShares)
	mux.HandleFunc("/dash/export.csv", c.handleCSV)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
	mux.Handle("/", http.FileServer(http.Dir(assets)))

	srv := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
		WriteTimeout:      30 * time.Second,
	}
	go func() {
		<-ctx.Done()
		shutCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutCtx)
	}()
	log.Printf("dashboard: serving %s on %s (stratum %s)", assets, addr, stratum)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("dashboard: %v", err)
	}
	c.save()
	log.Printf("dashboard: stopped")
}
