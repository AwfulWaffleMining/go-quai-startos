export const DEFAULT_LANG = 'en_US'

const dict = {
  // main.ts
  'Starting Quai Network node': 0,
  Node: 1,
  'The Quai node is running': 2,
  'The Quai node is starting': 3,
  'Chain Sync': 4,
  'Waiting for the node to report its block height': 5,
  'Synced at block ${height}': 6,
  'At block ${height}; could not reach the reference node to compare': 7,
  'Syncing: block ${height} of ${tip}': 8,
  Stratum: 9,
  'Stratum port ${port} is not listening yet': 10,
  'Listening, but do not point miners here until Chain Sync is green': 11,
  'Ready: SHA-256 on 3333, Scrypt on 3334, KawPoW on 3335': 12,

  // interfaces.ts
  'Stratum: SHA-256': 13,
  'Point SHA-256 ASICs here': 14,
  'Stratum: Scrypt': 15,
  'Point Scrypt ASICs here': 16,
  'Stratum: KawPoW': 17,
  'Point KawPoW GPU miners here': 18,
  'Mining Stats API': 19,
  'JSON stats for connected workers, hashrate, shares and blocks found': 20,
  Peer: 21,
  'Accepts inbound connections from other Quai nodes': 22,

  // actions/config.ts
  'Pool Tag': 23,
  'Optional tag written into the coinbase of blocks you find. Visible on-chain.': 24,
  'Variable Difficulty': 25,
  'Automatically tune each worker to about one share every 30 seconds. Miners can still force a value with d=<difficulty> in the password field.': 26,
  'Log Level': 27,
  'At info, go-quai logs every block while syncing, which runs to gigabytes. Keep warn unless you are troubleshooting; info also logs each miner connecting to stratum.': 28,
  'Stratum Settings': 29,
  'Pool tag, variable difficulty and log level': 30,
  'Saving restarts the node if it is running.': 31,

  // actions/syncMethod.ts
  'Sync Method': 32,
  'How this node gets the Quai chain. A snapshot gets you mining in about a day but means trusting the snapshot. Syncing from genesis verifies everything yourself but takes weeks.': 33,
  'Restore from snapshot': 34,
  'Snapshot URL': 35,
  "A .tar.zst archive of go-quai chain data. Defaults to Quai's official mainnet snapshot.": 36,
  'SHA256 (optional)': 37,
  "If the snapshot's publisher lists a SHA256, paste it here and the download is verified before use. Quai does not currently publish one for its official snapshot.": 38,
  '64 hexadecimal characters': 39,
  'Sync from genesis': 40,
  'Restore chain data from a snapshot, or sync from genesis': 41,
  'Restoring a snapshot downloads the whole archive (hundreds of GB) on the next start and then replaces any chain data this node already has.': 42,

  // init/syncTask.ts
  'Choose how this node gets the Quai chain: restore a snapshot (about a day) or sync from genesis (weeks)': 43,

  // main.ts (snapshot restore)
  'Snapshot Restore': 44,
  'Not used: this node syncs from genesis': 45,
  'No snapshot restore requested': 46,
  'Snapshot restored': 47,
  'Preparing snapshot restore': 48,
} as const

/**
 * Plumbing. DO NOT EDIT.
 */
export type I18nKey = keyof typeof dict
export type LangDict = Record<(typeof dict)[I18nKey], string>
export default dict
