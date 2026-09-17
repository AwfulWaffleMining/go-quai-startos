# go-quai for StartOS

Technical reference for the `go-quai` StartOS package. End-user documentation is in [instructions.md](instructions.md).

## What it runs

One daemon: [go-quai](https://github.com/dominant-strategies/go-quai), pinned to the tag in `startos/utils.ts` (`goQuaiVersion`), built from source by the `Dockerfile`. The binary provides the full node, a Stratum v1 server per algorithm, a JSON stats API, and a health endpoint. The package has no StartOS dependencies.

Mainnet (Colosseum), slice `[0 0]` (Cyprus-1) only. Orchard testnet is not offered because it needs a build from go-quai's `orchard` branch.

## Sync method and snapshot restore

A fresh install stores `syncMethod: 'unset'` in `store.json`, and `init/syncTask.ts` raises a **critical** task for the Sync Method action, so StartOS won't start the service until it is chosen. Restoring a backup resets the choice (`init/seedFiles.ts`), because backups contain no chain data. Nodes updated from `0.56.0:1` or older are migrated to `genesis`, so they keep syncing without the task.

- **Snapshot:** the action stores `snapshotUrl`, an optional `snapshotSha256`, and a new `bootstrapRequestId` (a timestamp).
- **Genesis:** the action stores `bootstrapRequestId: ''`.

On every start, the `bootstrap` oneshot runs `bootstrap.sh` before the `go-quai` daemon, which declares `requires: ['bootstrap']`. The script:

1. **Skips** when the request id is empty (deleting any abandoned download workspace) or matches `go-quai/.bootstrap-id`.
2. **Checks free space** using the server's `Content-Length`: remaining download plus 2x the archive for the unpacked chain. The 2x ratio is an estimate; refine it after a real restore.
3. **Downloads** to `bootstrap/snapshot.tar.zst`, writing progress to `bootstrap/status.json`. Retries happen in the script: every attempt is a fresh `curl -C -`, which resumes from the file on disk.
   - **No curl `--retry`:** on retry, curl truncates the output file back to the offset that invocation started at. In `0.56.0:2` that threw away a 205 GB partial download on a real restore.
   - **Stalls:** `--speed-limit 102400 --speed-time 120` turns a silent stall into a failure after 2 minutes, instead of the ~10-minute OS TCP timeout.
   - **HTTP 4xx** (except 408 and 429) fails right away with the code shown.
   - **No progress:** after 10 consecutive attempts without progress, the script exits and leaves retrying to StartOS.
4. **Verifies** the SHA256 when one is set.
5. **Extracts** with `zstd -dc | tar --strip-components=1` into `go-quai.partial/`. Extraction progress comes from the decoder's file position in `/proc/<pid>/fdinfo`.
6. **Validates** that `prime/go-quai` and `zone-0-0/go-quai` exist, then removes top-level `0x*` folders (the snapshot creator's peer database).
7. **Swaps** in the new data: only now is the old `go-quai/` removed, `go-quai.partial/` moved into place, and the marker written.

Failures:

- **Retries:** within one run, the script retries an interrupted download every 15 s, resuming from disk. StartOS also retries a failed oneshot, with backoff capped at 30 s.
- **Permanent failures** (checksum mismatch, corrupt archive, wrong layout): the archive is deleted and `bootstrap/failed-id` is written, so retries exit immediately instead of downloading again. A new Sync Method request clears it.
- **Unfixable-by-retry failures** (permanent ones, not enough space, an HTTP 4xx, or 10 attempts without progress): the script waits 5 minutes before exiting, so it doesn't spam the log or the snapshot server. The wait is interruptible, so stopping the service is immediate.

The **Snapshot Restore** health check reads `status.json` and the marker. Its progress messages come from the shell script and are English-only.

Quai's official snapshot (`https://snapshot.qu.ai/mainnet-snapshot.tar.zst`) is LevelDB, with one top-level `mainnet-snapshot/` folder containing `prime/`, `region-0/` and `zone-0-0/`. go-quai detects the engine of an existing database, and its default is also LevelDB, so the snapshot opens directly.

The bootstrap script was tested under BusyBox `sh` against a range-capable HTTP server. The tests covered a full restore, an idempotent rerun, a resume after SIGTERM, a server dying and returning mid-download (the file never shrinks), a stall held open by the server, a server down for good, a 404, a checksum mismatch, a wrong layout, a corrupt archive, too little space, and genesis cleanup.

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
| `nodelogs/` | go-quai log files (symlinked from `/opt/go-quai/nodelogs`). See Logging. | no |
| `bootstrap/` | Snapshot download workspace and `status.json` | no |
| `go-quai/.bootstrap-id` | Request id of the snapshot restore that produced the chain data | no (inside `go-quai/`) |

## Logging

`--global.log-level` defaults to `warn` (set under Stratum Settings, stored in `store.json`). The same level drives go-quai's global logger and the stratum loggers (`stratum.log`, `stratum-kawpow.log`).

- **Why not `info`:** at `info` the global logger emits `PendingHeadersOrder`, `Node in the node set` and pending-header timing lines for every block. Measured on first start, that was about 1.3 MB of StartOS log output in the first 3 minutes of sync.
- **Global logger output:** it writes to stdout (captured by StartOS) and to `nodelogs/global.log`.
- **File sizes:** the global logger is created at process start with a hardcoded 500 MB file size and 3 uncompressed backups (`log/logger.go`), so `--global.log-size=100` does not cap it. It does apply to the zone and stratum log files.
- **Migration:** `0.56.0:1` changes installs still on the old default of `info` to `warn`.

## Health checks

- **Node**: zone RPC port 9200 is listening.
- **Chain Sync**: `curl`s go-quai's health endpoint, which compares local height to `https://rpc.quai.network/cyprus1` and reports healthy within 5 blocks. Polls every 60 s once running, because each probe hits Quai's public RPC.
- **Stratum**: all three stratum ports listening, and reports `loading` until Chain Sync last reported healthy.
- **Snapshot Restore**: progress of the `bootstrap` oneshot, `disabled` when syncing from genesis.

## Upstream quirks this package works around

- **Stratum port defaults differ from the docs.** In v0.56.0 `cmd/utils/flags.go` defaults are KawPoW 3333, Scrypt 3334, SHA-256 3335. docs.qu.ai documents SHA-256 3333 and KawPoW 3335. `main.ts` passes every address explicitly so the docs' mapping is what runs.
- **Go version.** Upstream's Dockerfile uses `golang:1.23`, but `go.mod` declares `go 1.24`. This package builds with `golang:1.24-alpine`.
- **Relative paths.** go-quai reads `VERSION` and `params/*.json` from its working directory and writes `./nodelogs`. The image keeps these in `/opt/go-quai`, and the daemon runs with that `cwd`.

## Building

CI builds on every push to `main` using Start9's shared workflow (`Start9Labs/start-technologies/.github/workflows/build.yml`). Download the `.s9pk` from the run's artifacts. Set a `DEV_KEY` secret to sign with your developer key.

Local builds require Docker with buildx, Node.js 22+, make, git, jq and `start-cli` 2.0+. `start-cli` 2.0 only packs inside a packaging workspace, so run `start-cli s9pk init-workspace` once in the directory that contains this repo.

```sh
npm ci
make            # produces go-quai_x86_64.s9pk
make install    # sideloads to the server set as `host:` in ~/.startos/config.yaml
```
