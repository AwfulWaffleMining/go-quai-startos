# Quai Network

This service runs a full go-quai node with its built-in stratum server. You solo mine by pointing your own hardware at your StartOS server. Every block you find pays the full reward to the address your miner logs in with.

## 1. Let the node sync first

Start the service and watch the **Chain Sync** health check. It shows your block height against the network tip. Syncing from genesis takes a while, so leave the service running.

The **Stratum** health check stays yellow until Chain Sync is green. Mining against an unsynced node produces invalid blocks and wastes your hashrate, so wait for both checks to be green.

## 2. Get a Cyprus-1 address

Use [Pelagus Wallet](https://chromewebstore.google.com/detail/pelagus/nhccebmfjcbhghphpclcfdkkekheegop) to create an address in the **Cyprus-1** zone. You can mine to either ledger:

- **Quai address** (starts with `0x00`): rewards paid in Quai.
- **Qi mining address** (starts with `0x0080`, found in Pelagus settings): rewards paid in Qi. This is not the same as your Qi payment address.

Addresses from other zones are rejected with `address is not internal to this zone`.

## 3. Point your miners

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

## Storage and backups

The chain database lives on this service's volume and needs a fast SSD with at least 1 TB free. Backups include your settings but **not** the chain database, which would take hundreds of GB. After a restore, the node syncs the chain again.

## Troubleshooting

- **`no pending header`**: the node is not synced yet. Wait for Chain Sync.
- **`address is not internal to this zone` or `authorization failed`**: the username is not a valid Cyprus-1 address.
- **High reject rate**: check the miner is on the right port for its algorithm.
- **Logs**: the service's Logs page shows node output. Detailed per-component logs, including `stratum.log`, are written to `nodelogs/` on the service volume.
