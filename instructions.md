# Quai Network

## Documentation

- [Quai Network Docs](https://docs.qu.ai) — running a node, solo mining, and the stratum options miners can set.

## Getting set up

### 1. Choose how to sync

StartOS shows a **Sync Method** task first. The service cannot start until you complete it.

- **Restore from snapshot (recommended):** downloads a copy of the chain and starts from there. With Quai's official snapshot (hundreds of GB) the node is usually synced within a day, depending on your connection. You trust the snapshot's contents rather than verifying the whole chain yourself.
- **Sync from genesis:** the node downloads and verifies every block itself. Nothing is trusted, but it takes weeks on typical hardware.

For a snapshot you can keep the default URL or use another source. If the publisher lists a SHA256, paste it in and the download is checked before use.

When you start the service, the **Snapshot Restore** health check shows progress: free-space check, download, checksum, extraction. The node starts by itself when the restore finishes. If the connection drops or you stop the service, the download resumes where it left off, and your existing chain data is only replaced once the new one has extracted cleanly.

### 2. Let the node sync

Watch the **Chain Sync** health check: it shows your block height against the network tip. Leave the service running.

The **Stratum** health check stays yellow until Chain Sync is green. Mining against an unsynced node wastes your hashrate, so wait for both.

### 3. Get a Cyprus-1 address

Use [Pelagus Wallet](https://pelaguswallet.io) to create an address in the **Cyprus-1** zone. You can mine to either ledger:

- **Quai address** (starts with `0x00`): rewards paid in Quai.
- **Qi mining address** (starts with `0x0080`, found in Pelagus settings): rewards paid in Qi. This is not the same as your Qi payment address.

Addresses from other zones are rejected with `address is not internal to this zone`.

### 4. Point your miners

Copy the address for your algorithm from this service's interfaces. **Use the port shown there**, not a port from Quai's documentation: if another service already holds the usual port, yours is different. The Stratum health check lists the ports in use too.

| Hardware                                       | Interface            |
| ---------------------------------------------- | -------------------- |
| SHA-256 ASIC (Bitaxe, Antminer S-series, etc.) | **Stratum: SHA-256** |
| Scrypt ASIC (Antminer L-series, etc.)          | **Stratum: Scrypt**  |
| GPU                                            | **Stratum: KawPoW**  |

- **Username:** your address, optionally with a worker name: `0xYourAddress.rig1`
- **Password:** `x`, or any of these options joined with commas:
  - `d=<difficulty>` sets a fixed share difficulty instead of variable difficulty
  - `lock=<0-3>` sets how long rewards are locked, for a reward boost
  - `frequency=<seconds>` sets how often you receive new jobs

Example password: `d=1000,lock=1`

| `lock=`       | Lockup    | Boost in year 1 |
| ------------- | --------- | --------------- |
| `0` (default) | 2 weeks   | none            |
| `1`           | 3 months  | 3.5%            |
| `2`           | 6 months  | 10%             |
| `3`           | 12 months | 25%             |

The boost shrinks each year; Quai's documentation has the full schedule.

## Using Quai Network

### Interfaces

- **Stratum: SHA-256 / Scrypt / KawPoW** — where your miners connect. These ports have no password, so anyone who can reach them can mine through your node to their own address.
- **Mining Stats API** — JSON statistics. Useful paths: `/api/pool/stats`, `/api/pool/workers` (every connected worker), `/api/pool/blocks`, `/api/miner/<address>/stats`.
- **Zone RPC** — appears only when RPC sharing is on (see Settings).
- **Peer** — lets other Quai nodes connect to yours. Optional; the node finds peers without it.

For charts, worker history and a record of what you earned, install the **Quai Mining Dashboard** service.

### Actions

- **Settings** — turn variable difficulty on or off, share the node's RPC with other services, and change the log level. Saving restarts the node, which picks up where it left off.
  - RPC sharing is off by default and only the Quai Mining Dashboard needs it. The RPC has no password, so anything that can reach it can query your node.
  - The log level defaults to `warn`. At `info` the node writes several lines per block while syncing, which adds up to gigabytes; use it only while troubleshooting.
- **Sync Method** — run it while the service is stopped to restore a fresh snapshot (which replaces your chain data on the next start) or to switch to syncing from genesis.

### Storage and backups

The chain needs a fast SSD with at least 1 TB free, plus room for the download during a snapshot restore.

Backups keep your settings but not the chain, which is hundreds of GB. After restoring a backup you are asked for the sync method again, as on a fresh install.

## Troubleshooting

- **Snapshot Restore says "Not enough free space"**: free up space on the server, then restart the service.
- **Snapshot Restore shows a SHA256 mismatch or an extraction failure**: the download was deleted. Check the URL and checksum, then run Sync Method again.
- **Snapshot Restore shows "returned HTTP 404"** (or another 4xx code): the snapshot URL is wrong or the file moved. Stop the service, fix the URL with Sync Method, and start again.
- **`no pending header`** on your miner: the node is not synced yet. Wait for Chain Sync.
- **`address is not internal to this zone` or `authorization failed`**: the username is not a valid Cyprus-1 address.
- **High reject rate**: check the miner is on the right port for its algorithm.
- **`Default Quai coinbase address is being used`** or **`Default Qi coinbase address is being used`** in the logs: expected. Each reward goes to the address your miner logs in with.
- **`Config file not found: /data/config/config.toml`** in the logs: expected.
- **Is my miner connecting?** Check `/api/pool/workers` on the Mining Stats API, or set the log level to `info` for a while to see connections in the logs.
