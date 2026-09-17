# Quai Network

This service runs a full go-quai node with its built-in stratum server. You solo mine by pointing your own hardware at your StartOS server. Every block you find pays the full reward to the address your miner logs in with.

## 1. Choose how to sync

After installing, StartOS shows a **Sync Method** task. The service cannot start until you complete it.

- **Restore from snapshot (recommended):** downloads a copy of the chain and starts from there. With Quai's official snapshot (about 225 GB as of September 2026) the node is usually fully synced within a day, depending on your connection. You are trusting the snapshot's contents rather than verifying the whole chain yourself.
- **Sync from genesis:** the node downloads and verifies every block itself. Nothing is trusted, but it takes weeks on typical hardware.

For a snapshot you can keep the default URL or use another source. If the publisher lists a SHA256, paste it in and the download is checked before use.

You can change this later with the **Sync Method** action while the service is stopped. Choosing a snapshot again downloads a fresh copy on the next start and replaces the existing chain data.

### What a snapshot restore does

When you start the service, the **Snapshot Restore** health check shows progress. The node itself doesn't start until the restore finishes.

1. It checks free space. It needs room for the download plus the unpacked chain, and refuses to start if the drive is too small.
2. It downloads the snapshot. If the connection drops or the service stops, the download resumes where it left off.
3. It verifies the SHA256, if you provided one.
4. It extracts the chain. Existing chain data is only replaced after the archive extracts cleanly.
5. It deletes the downloaded archive and starts the node.

If the checksum doesn't match or the archive is damaged, the download is deleted and the error shows in Snapshot Restore. Run the Sync Method action again to retry.

## 2. Let the node sync

Watch the **Chain Sync** health check. It shows your block height against the network tip. After a snapshot restore it only has to catch up from the snapshot's date. Leave the service running.

The **Stratum** health check stays yellow until Chain Sync is green. Mining against an unsynced node produces invalid blocks and wastes your hashrate, so wait for both checks to be green.

## 3. Get a Cyprus-1 address

Use [Pelagus Wallet](https://chromewebstore.google.com/detail/pelagus/nhccebmfjcbhghphpclcfdkkekheegop) to create an address in the **Cyprus-1** zone. You can mine to either ledger:

- **Quai address** (starts with `0x00`): rewards paid in Quai.
- **Qi mining address** (starts with `0x0080`, found in Pelagus settings): rewards paid in Qi. This is not the same as your Qi payment address.

Addresses from other zones are rejected with `address is not internal to this zone`.

## 4. Point your miners

Open this service's **Interfaces** tab to copy your server's address, then use the port for your hardware:

| Hardware | Algorithm | Pool URL |
| --- | --- | --- |
| SHA-256 ASIC (Bitaxe, Antminer S-series, etc.) | SHA-256 | `stratum+tcp://<server-address>:3333` |
| Scrypt ASIC (Antminer L-series, etc.) | Scrypt | `stratum+tcp://<server-address>:3334` |
| GPU | KawPoW | `stratum+tcp://<server-address>:3335` |

- **Username:** your address, optionally with a worker name: `0xYourAddress.rig1`
- **Password:** `x`, or any of these options joined with commas:
  - `d=<difficulty>` sets a fixed share difficulty instead of variable difficulty
  - `lock=<0-3>` sets how long block rewards are locked, for a reward boost
  - `frequency=<seconds>` sets how often you receive new jobs

Example password: `d=1000,lock=1`

### Lock periods

| `lock=` | Lockup | Boost in year 1 |
| --- | --- | --- |
| `0` (default) | 2 weeks | none |
| `1` | 3 months | 3.5% |
| `2` | 6 months | 10% |
| `3` | 12 months | 25% |

The boost shrinks each year. See the [Quai docs](https://docs.qu.ai/guides/client/node) for the full schedule.

## Checking your stats

The **Mining Stats API** interface returns JSON. Useful paths:

- `/api/pool/stats`: hashrate, workers, shares, blocks found
- `/api/pool/workers`: every connected worker
- `/api/pool/blocks`: blocks this node found
- `/api/miner/<address>/stats`: stats for one address

## Settings

The **Stratum Settings** action lets you set a pool tag for your blocks' coinbase, turn variable difficulty on or off, and change the log level. Saving restarts the node.

The log level defaults to `warn`. At `info`, go-quai writes several lines for every block while it syncs, which adds up to gigabytes. Switch to `info` only while troubleshooting, then switch back.

## Storage and backups

The chain database lives on this service's volume and needs a fast SSD with at least 1 TB free. A snapshot restore temporarily needs extra room for the download.

Backups include your settings but **not** the chain database or snapshot downloads, which would take hundreds of GB. After restoring a backup, StartOS asks for the sync method again, the same as a fresh install.

## Troubleshooting

- **Snapshot Restore shows "Not enough free space"**: free up space on the server, then restart the service. The check runs again.
- **Snapshot Restore shows a SHA256 mismatch or extraction failure**: the download was deleted. Check the URL and checksum, then run the Sync Method action again.
- **Snapshot download stopped**: it resumes automatically from where it left off, including after a stalled connection. Stopping and starting the service also resumes it.
- **Snapshot Restore shows "returned HTTP 404"** (or another 4xx code): the snapshot URL is wrong or the file was moved. Stop the service, fix the URL with the Sync Method action, and start again.
- **`no pending header`**: the node is not synced yet. Wait for Chain Sync.
- **`address is not internal to this zone` or `authorization failed`**: the username is not a valid Cyprus-1 address.
- **High reject rate**: check the miner is on the right port for its algorithm.
- **`Default Quai coinbase address is being used` / `Default Qi coinbase address is being used`** at startup: expected, and safe to ignore. Stratum pays each block to the address your miner logs in with, not to the node's coinbase setting.
- **`Config file not found: /data/config/config.toml`** at startup: expected. This package passes all settings as flags.
- **Is my miner connecting?** Check `/api/pool/workers` on the Mining Stats API. For connection details in the logs, set the log level to `info` under Stratum Settings, then set it back to `warn` when you're done.
- **Logs**: the service's Logs page shows node output. Detailed per-component logs, including `stratum.log`, are written to `nodelogs/` on the service volume.
