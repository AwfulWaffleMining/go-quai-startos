<p align="center">
  <img src="icon.svg" alt="Quai Network Logo" width="21%" />
</p>

# Quai Network on StartOS

> **Upstream docs:** <https://docs.qu.ai/>
>
> Everything not listed in this document should behave the same as upstream
> go-quai. If a feature, setting, or behavior is not mentioned here, the
> upstream documentation is accurate and fully applicable.

A Quai Network full node with its built-in stratum server, so you can solo mine
Quai against your own node instead of a pool. Upstream:
<https://github.com/dominant-strategies/go-quai>

The node runs the Prime chain, one region and the Cyprus-1 zone, and accepts
miners on three algorithms. Rewards go entirely to the address a miner logs in
with; the package takes no fee and never holds keys.

---

## Table of Contents

- [Image and Container Runtime](#image-and-container-runtime)
- [Volume and Data Layout](#volume-and-data-layout)
- [Installation and First-Run Flow](#installation-and-first-run-flow)
- [Configuration Management](#configuration-management)
- [Network Access and Interfaces](#network-access-and-interfaces)
- [Actions](#actions)
- [Backups and Restore](#backups-and-restore)
- [Health Checks](#health-checks)
- [Dependencies](#dependencies)
- [Limitations and Differences](#limitations-and-differences)
- [What Is Unchanged from Upstream](#what-is-unchanged-from-upstream)
- [Contributing](#contributing)
- [Quick Reference for AI Consumers](#quick-reference-for-ai-consumers)

---

## Image and Container Runtime

| What | Detail |
| --- | --- |
| Image source | Custom Dockerfile, builds go-quai from the upstream source |
| Architectures | x86_64 |
| Entrypoint | Custom wrapper, `docker_entrypoint.sh` |

The wrapper passes the node's flags and handles shutdown: go-quai exits non-zero
after a graceful `SIGTERM`, which the wrapper reports as a normal stop so an
ordinary stop is not logged as a failure.

## Volume and Data Layout

One volume, `main`, mounted at `/data`.

| Path | Contents | In backups |
| --- | --- | --- |
| `go-quai/` | Chain databases for Prime, the region and the zone | no |
| `config/` | Node configuration written by the package | yes |
| `nodelogs/` | go-quai's own log files, rotated by the node | no |
| `bootstrap/` | Snapshot download workspace and its status file | no |
| `store.json` | Package settings: pool tag, difficulty mode, log level, RPC sharing, sync method | yes |

## Installation and First-Run Flow

On install the package raises a critical task asking how to sync the chain,
because the choice cannot be made for you:

- **Snapshot** downloads Quai's published chain snapshot and unpacks it. This is
  the usual choice. It needs a large, resumable download and roughly one and a
  half times the archive size in free space while it unpacks.
- **Genesis** syncs from block zero. Correct but slow, on the order of weeks on
  modest hardware.

A oneshot runs before the node starts and performs the restore: it resumes a
partial download across restarts, verifies an optional checksum, and swaps the
unpacked chain into place only after a clean extraction, so an interrupted
restore never destroys an existing chain. The node starts once that finishes.
Restoring a package backup asks the question again, since the chain itself is
not backed up.

## Configuration Management

| StartOS-managed | Upstream-managed |
| --- | --- |
| Stratum ports, data directory, log level, RPC bind address, coinbase warnings | Everything else in go-quai's own flags and config |

Miners set their own payout address, share difficulty and reward lock period in
the stratum username and password, so the node takes no coinbase configuration.

## Network Access and Interfaces

| Interface | Port | Protocol | Purpose |
| --- | --- | --- | --- |
| Stratum: SHA-256 | 3301 | stratum+tcp | SHA-256 ASICs |
| Stratum: Scrypt | 3302 | stratum+tcp | Scrypt ASICs |
| Stratum: KawPoW | 3303 | stratum+tcp | GPUs |
| Mining Stats API | 3306 | HTTP/JSON | Pool statistics, CORS enabled |
| Zone RPC | 9200 | HTTP/JSON-RPC | Exported only when RPC sharing is switched on |
| P2P | 4002 | TCP | Inbound peers, optional |

> [!IMPORTANT]
> These are preferred ports. StartOS assigns the external port, and if another
> package already holds one, yours will differ. The Interfaces tab and the
> Stratum health check both show the ports actually in use. Point miners at
> those, not at the numbers above.

Stratum has no authentication, so leave those ports on the local network unless
you understand the consequences.

## Actions

**Settings** — visible, available in any status.

| Input | Effect |
| --- | --- |
| Variable Difficulty | Whether the stratum server adjusts each miner's share difficulty automatically |
| Share node RPC with other packages | Binds the zone RPC for other packages on this server and exports it as an interface. Off by default: go-quai's RPC has no authentication |
| Log Level | Node verbosity. The default keeps StartOS logs readable; raising it is noisy |

Saving restarts the node, which resumes where it left off.

**Sync Method** — visible, available in any status. Chooses snapshot or genesis,
and can be re-run to start a fresh snapshot restore. Raised as a critical task on
install and after restoring a backup.

## Backups and Restore

Included: `store.json` and `config/`, so your settings survive.

Excluded: the chain databases, node logs and the snapshot workspace. A chain
database is hundreds of gigabytes and can be rebuilt from the network or from a
snapshot, so backing it up would be expensive and pointless.

On restore the package asks for a sync method again and rebuilds the chain.

## Health Checks

| Check | Meaning |
| --- | --- |
| Node | The node process is running |
| Snapshot Restore | Progress of the snapshot download and extraction, or disabled when syncing from genesis |
| Chain Sync | Current block against the network tip, green when synced |
| Stratum | Listening, naming the assigned ports. Reports "wait" until the chain is synced, because hashing against an unsynced node is wasted work |

## Dependencies

None.

The companion [Quai Mining Dashboard](https://github.com/AwfulWaffleMining/quai-dashboard-startos)
package depends on this one and reads its stats API. Its reward figures use the
zone RPC when sharing is enabled.

## Limitations and Differences

1. **SHA-256 and Scrypt mint workshares, not blocks.** Quai's consensus accepts
   only KawPoW proofs for blocks; SHA-256 and Scrypt work is accepted as
   workshares, which are included in a block and paid a share of its reward
   pool. This is upstream behavior, not a packaging limitation.
2. **KawPoW is untested in this package.** The port is bound and the code path
   is shared with the other two, but no GPU has been run against it.
3. **Snapshot restore needs a lot of disk.** The published snapshot unpacks to
   several hundred gigabytes, and the restore holds the archive and the unpacked
   chain at once.
4. **x86_64 only.** The node is heavy enough that low-power ARM boards are not a
   realistic target.
5. **The zone RPC is unauthenticated**, which is why sharing it is off by
   default.
6. **Stratum has no authentication**, so anyone who can reach the port can mine
   to their own address through your node.

## What Is Unchanged from Upstream

- Consensus, syncing, peering and chain validation
- The stratum server's protocol, variable difficulty and share handling
- Reward calculation, lock periods and coinbase handling
- The JSON-RPC API and the node's own health endpoint
- The stats API's shape and semantics

## Contributing

See [AGENTS.md](AGENTS.md) for the conventions this package follows, and
[docs/internals.md](docs/internals.md) for how the pieces fit together.

---

## Quick Reference for AI Consumers

```yaml
package_id: go-quai
architectures: [x86_64]
volumes:
  main: /data
ports:
  stratum-sha256: 3301
  stratum-scrypt: 3302
  stratum-kawpow: 3303
  stratum-api: 3306
  rpc: 9200
  p2p: 4002
dependencies: none
startos_managed_env_vars: []
actions:
  - config
  - sync-method
health_checks:
  - go-quai
  - restore
  - sync
  - stratum
backup_excludes:
  - go-quai/
  - nodelogs/
  - bootstrap/
```
