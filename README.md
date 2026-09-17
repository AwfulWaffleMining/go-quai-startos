# go-quai for StartOS

Technical reference for the `go-quai` StartOS package. End-user documentation is in [instructions.md](instructions.md).

## What it runs

One daemon: [go-quai](https://github.com/dominant-strategies/go-quai), pinned to the tag in `startos/utils.ts` (`goQuaiVersion`), built from source by the `Dockerfile`. The binary provides the full node, a Stratum v1 server per algorithm, a JSON stats API, and a health endpoint. The package has no StartOS dependencies.

Mainnet (Colosseum), slice `[0 0]` (Cyprus-1) only. Orchard testnet is not offered because it needs a build from go-quai's `orchard` branch.

## Ports

| Port | Purpose | Exposed as |
| --- | --- | --- |
| 3333 | Stratum, SHA-256 | `stratum-sha256` interface, TCP |
| 3334 | Stratum, Scrypt | `stratum-scrypt` interface, TCP |
| 3335 | Stratum, KawPoW | `stratum-kawpow` interface, TCP |
| 3336 | Stratum stats API (HTTP/JSON, CORS enabled) | `stratum-api` interface |
| 4002 | P2P | `p2p` interface |
| 9200 | Cyprus-1 zone HTTP RPC | internal, bound to 127.0.0.1 |
| 8081 | go-quai `--rpc.health` endpoint | internal |

## Payouts

Node-level coinbase flags are left at their defaults on purpose. In v0.56.0 the stratum server sets the block's primary coinbase from each miner's `mining.authorize` username (`stratum/server.go`, `SetPrimaryCoinbase(address)`) and reads the lock byte from the password (`lock=`). The username must be an address internal to Cyprus-1.

## Volume layout (`main`, mounted at `/data`)

| Path | Contents | Backed up |
| --- | --- | --- |
| `store.json` | Package settings (pool tag, vardiff, log level) | yes |
| `config/` | `--global.config-dir` | yes |
| `go-quai/` | `--global.data-dir`, chain database | no |
| `nodelogs/` | go-quai log files (symlinked from `/opt/go-quai/nodelogs`) | no |

## Health checks

- **Node**: zone RPC port 9200 is listening.
- **Chain Sync**: `curl`s go-quai's health endpoint, which compares local height to `https://rpc.quai.network/cyprus1` and reports healthy within 5 blocks. Polls every 60 s once running, because each probe hits Quai's public RPC.
- **Stratum**: all three stratum ports listening, and reports `loading` until Chain Sync last reported healthy.

## Upstream quirks this package works around

- **Stratum port defaults differ from the docs.** In v0.56.0 `cmd/utils/flags.go` defaults are KawPoW 3333, Scrypt 3334, SHA-256 3335. docs.qu.ai documents SHA-256 3333 and KawPoW 3335. `main.ts` passes every address explicitly so the docs' mapping is what runs.
- **Go version.** Upstream's Dockerfile uses `golang:1.23`, but `go.mod` declares `go 1.24`. This package builds with `golang:1.24-alpine`.
- **Relative paths.** go-quai reads `VERSION` and `params/*.json` from its working directory and writes `./nodelogs`. The image keeps these in `/opt/go-quai`, and the daemon runs with that `cwd`.

## Building

Requires Docker with buildx, Node.js 22+, make and `start-cli`.

```sh
npm ci
make            # produces go-quai_x86_64.s9pk
make install    # sideloads to the server set as `host:` in ~/.startos/config.yaml
```
