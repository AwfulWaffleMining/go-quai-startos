<p align="center">
  <img src="icon.svg" alt="Quai Network Logo" width="21%" />
</p>

# Quai Network on StartOS

> Everything not listed in this document should behave the same as upstream
> go-quai. If a feature, setting, or behavior is not mentioned here, the
> upstream documentation is accurate and fully applicable — see the
> Documentation section of `instructions.md` for links.

A Quai Network full node with its built-in stratum server, so you can solo mine
Quai against your own node instead of a pool. Upstream:
<https://github.com/dominant-strategies/go-quai>

The node runs mainnet (Colosseum) on the Prime chain, one region and the
Cyprus-1 zone (`--node.slices=[0 0]`), and accepts miners on three algorithms.
Rewards go entirely to the address a miner authorizes with; the package takes no
fee and holds no keys.

---

## Table of Contents

- [Image and Container Runtime](#image-and-container-runtime)
- [Volume and Data Layout](#volume-and-data-layout)
- [File Models](#file-models)
- [Dependencies](#dependencies)
- [Network Access and Interfaces](#network-access-and-interfaces)
- [Installation and First-Run Flow](#installation-and-first-run-flow)
- [Actions](#actions)
- [Tasks](#tasks)
- [Health Checks](#health-checks)
- [Backups and Restore](#backups-and-restore)
- [Limitations and Differences](#limitations-and-differences)
- [Quick Reference for AI Consumers](#quick-reference-for-ai-consumers)

---

## Image and Container Runtime

The image is built from source by this repository's `Dockerfile`, and two
subcontainers run from it.

| What          | Detail                                                           |
| ------------- | ---------------------------------------------------------------- |
| Image source  | Custom Dockerfile: go-quai compiled from the pinned upstream tag |
| Architectures | x86_64                                                           |
| Entrypoint    | `docker_entrypoint.sh` (node), `bootstrap.sh` (snapshot restore) |

| Subcontainer | Runs                                                                                |
| ------------ | ----------------------------------------------------------------------------------- |
| `bootstrap`  | `bootstrap.sh`, a oneshot on every start that performs a pending snapshot restore   |
| `go-quai`    | The node, its stratum servers and stats API, started once `bootstrap` exits cleanly |

go-quai exits non-zero after a graceful `SIGTERM`. The entrypoint waits for the
node to finish shutting down and then exits 0, so an ordinary stop is not
logged as a failure. The node gets two minutes to flush its database on stop.

go-quai reads `VERSION` and `params/*.json` from its working directory, so the
node runs in `/opt/go-quai`; its `nodelogs/` directory there is a symlink onto
the volume.

## Volume and Data Layout

One volume, `main`, mounted at `/data` in both subcontainers.

| Path                    | Contents                                                              |
| ----------------------- | --------------------------------------------------------------------- |
| `store.json`            | Package settings and the sync-method state                            |
| `config/`               | `--global.config-dir`; empty, since every setting is passed as a flag |
| `go-quai/`              | `--global.data-dir`: Prime, region and zone chain databases (LevelDB) |
| `go-quai/.bootstrap-id` | Id of the snapshot restore that produced the current chain data       |
| `nodelogs/`             | go-quai's per-component log files, including `stratum.log`            |
| `bootstrap/`            | Snapshot download workspace and `status.json` progress file           |

## File Models

The package owns `store.json` and reads one file `bootstrap.sh` writes. go-quai
itself has no configuration file: every setting is a command-line flag built in
`startos/main.ts` on each start.

| File                    | Format | Written by                                                                         | Hand edits                                    |
| ----------------------- | ------ | ---------------------------------------------------------------------------------- | --------------------------------------------- |
| `store.json`            | JSON   | Seeded with defaults at install; rewritten by the Settings and Sync Method actions | Survive until an action rewrites the same key |
| `bootstrap/status.json` | JSON   | `bootstrap.sh` during a restore                                                    | Pointless; rewritten every few seconds        |

`store.json` keys:

| Key                             | Default                 | Effect                                                                          |
| ------------------------------- | ----------------------- | ------------------------------------------------------------------------------- |
| `varDiff`                       | `true`                  | `--node.stratum-vardiff`                                                        |
| `logLevel`                      | `warn`                  | `--global.log-level`                                                            |
| `shareRpc`                      | `false`                 | Binds the RPC to `0.0.0.0` and exports the Zone RPC interface                   |
| `syncMethod`                    | `unset`                 | `unset`, `snapshot` or `genesis`; `unset` raises the Sync Method task           |
| `snapshotUrl`, `snapshotSha256` | official snapshot, none | Source and optional checksum for a restore                                      |
| `bootstrapRequestId`            | empty                   | Non-empty and different from `go-quai/.bootstrap-id` means a restore is pending |

Every change to `store.json` restarts the node.

## Dependencies

None. The Quai Mining Dashboard package depends on this one, not the reverse:
it reads the Mining Stats API, and the Zone RPC when sharing is on.

## Network Access and Interfaces

Stratum and P2P ask StartOS for the same external port as the internal one.
That is a preference, not a guarantee: if another package already holds the
port, StartOS assigns a different one, and the interface address and the Stratum
health check show the port actually in use.

| Interface id     | Type | Port | Protocol      | Purpose                                                                                                 |
| ---------------- | ---- | ---- | ------------- | ------------------------------------------------------------------------------------------------------- |
| `stratum-sha256` | api  | 3301 | stratum+tcp   | SHA-256 ASICs                                                                                           |
| `stratum-scrypt` | api  | 3302 | stratum+tcp   | Scrypt ASICs                                                                                            |
| `stratum-kawpow` | api  | 3303 | stratum+tcp   | KawPoW GPUs                                                                                             |
| `stratum-api`    | api  | 3306 | HTTP/JSON     | Stratum stats: `/api/pool/stats`, `/api/pool/workers`, `/api/pool/blocks`, `/api/miner/<address>/stats` |
| `rpc`            | api  | 9200 | HTTP JSON-RPC | Cyprus-1 zone RPC; exists only while RPC sharing is on, and then accepts any `Host` header              |
| `p2p`            | p2p  | 4002 | TCP           | Inbound Quai peers; outbound peering works without it                                                   |

The stratum ports, the stats API and the RPC have no authentication.

Internal only: go-quai's `--rpc.health` endpoint on 8081, which the Chain Sync
check reads, and the Prime and region RPC ports.

## Installation and First-Run Flow

A fresh install cannot start until the user picks a sync method, because the
choice decides whether the package downloads a snapshot of hundreds of GB.

1. Install seeds `store.json` with `syncMethod: unset`, which raises the
   critical Sync Method task.
2. Choosing **snapshot** stores the URL, an optional SHA256, and a fresh
   `bootstrapRequestId`. On the next start `bootstrap.sh` checks free space
   (remaining download plus 1.5× the archive for the unpacked chain), downloads
   with resume, verifies the checksum if one was given, extracts into
   `go-quai.partial/`, checks that it holds `prime/go-quai` and
   `zone-0-0/go-quai`, and only then replaces `go-quai/` and writes the marker.
   The node starts after that.
3. Choosing **genesis** clears `bootstrapRequestId`; the node starts at once and
   syncs from block zero, which takes weeks.

A failed restore that retrying cannot fix — checksum mismatch, a corrupt archive
or the wrong layout, too little space, an HTTP 4xx, or ten attempts without
progress — deletes what it must, records the failure, and waits five minutes
before exiting so StartOS's retry does not hammer the snapshot server. A
permanent failure is not retried again until the Sync Method action is re-run.
Existing chain data is never touched by a failed restore.

## Actions

Two actions, both user-facing.

**Settings** — change variable difficulty, RPC sharing, or the log level. Writes
`store.json` and restarts the node, which resumes where it left off. Safe to
repeat. Raise the log level to `info` only while troubleshooting: go-quai logs
several lines per block while syncing.

**Sync Method** — the target of the Sync Method task, and how to re-restore a
snapshot later (for example after a corrupt database or a long outage). Only
runs while the service is stopped. Choosing a snapshot again schedules a new
restore on the next start that replaces the existing chain once it has
extracted cleanly; choosing genesis over an existing chain keeps that chain and
carries on syncing it. Returns a message saying what happens on start.

## Tasks

One task, raised by the package itself.

| Task        | Severity | Raised when                                                        | Cleared by                     |
| ----------- | -------- | ------------------------------------------------------------------ | ------------------------------ |
| Sync Method | critical | `syncMethod` is `unset`: after install, and after a backup restore | Running the Sync Method action |

While it is raised the service cannot start and no other control is shown.

The Quai Mining Dashboard package may also raise an **important** task on this
package's Settings action, pre-filled to switch RPC sharing on. It appears on
this service's page when the user tells the dashboard to show confirmed rewards;
saving the form clears it.

## Health Checks

Four checks. Snapshot Restore runs before the node; the other three need it.

| Check id  | Display          | Probes                                                                        |
| --------- | ---------------- | ----------------------------------------------------------------------------- |
| `restore` | Snapshot Restore | `bootstrap/status.json` and the marker; `disabled` when no restore is pending |
| `go-quai` | Node             | The zone RPC port is listening; 60-second grace period                        |
| `sync`    | Chain Sync       | go-quai's health endpoint, polled every 60 s once green                       |
| `stratum` | Stratum          | All three stratum ports listening, and Chain Sync last reported healthy       |

- **Snapshot Restore failing** carries `bootstrap.sh`'s own message (English
  only): not enough space, an HTTP error, a checksum mismatch, a corrupt archive.
  Space and HTTP errors retry on their own; the rest need the Sync Method action.
- **Chain Sync loading** is normal for hours after a restore and weeks from
  genesis. It compares the local height with Quai's public RPC and goes green
  within five blocks of it; "could not reach the reference node" means that
  public RPC was unreachable, not that the node is broken.
- **Stratum loading** means listening but not synced. Miners pointed at an
  unsynced node waste their work (`no pending header`).

## Backups and Restore

The volume is backed up with `ofVolumes`, excluding `go-quai/`, `nodelogs/` and
`bootstrap/`. The chain is hundreds of GB and can be rebuilt; the rest is
disposable.

A restored instance has settings but no chain. Restore resets `syncMethod` to
`unset`, so the Sync Method task is raised again and the user chooses between a
snapshot and genesis, exactly as on a fresh install.

## Limitations and Differences

1. **Cyprus-1 only.** Other zones and the Orchard testnet are not offered;
   payout addresses must be internal to Cyprus-1.
2. **SHA-256 and Scrypt mint workshares, not blocks.** Quai accepts only KawPoW
   proofs for blocks; SHA-256 and Scrypt work is paid as workshares included in
   a block. This is upstream behavior.
3. **KawPoW is untested with real hardware** in this package.
4. **No pool tag.** `--node.stratum-pool-tag` is never set.
5. **x86_64 only.**
6. **Snapshot restore needs roughly 2.5× the archive size free at its peak** —
   the archive and the unpacked chain coexist until extraction finishes.
7. **go-quai's global log file is capped at 500 MB × 3 regardless of
   `--global.log-size`**, which only bounds the zone and stratum logs.
8. **The Chain Sync check depends on Quai's public RPC** for the reference
   height.

---

## Quick Reference for AI Consumers

```yaml
package_id: go-quai
image: go-quai (built from Dockerfile)
architectures: [x86_64]
subcontainers: [bootstrap, go-quai]
volumes:
  main: /data
file_models:
  - store.json
  - bootstrap/status.json
startos_managed_env_vars:
  - BOOTSTRAP_REQUEST_ID
  - BOOTSTRAP_URL
  - BOOTSTRAP_SHA256
dependencies: none
interfaces:
  stratum-sha256: { type: api, port: 3301 }
  stratum-scrypt: { type: api, port: 3302 }
  stratum-kawpow: { type: api, port: 3303 }
  stratum-api: { type: api, port: 3306 }
  rpc: { type: api, port: 9200 }
  p2p: { type: p2p, port: 4002 }
actions:
  - config
  - sync-method
tasks:
  - { action: sync-method, severity: critical }
health_checks:
  - restore
  - go-quai
  - sync
  - stratum
```
