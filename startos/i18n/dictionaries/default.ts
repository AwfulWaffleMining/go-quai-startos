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
  'Ready: SHA-256 on ${sha}, Scrypt on ${scrypt}, KawPoW on ${kawpow}': 12,

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
  'Variable Difficulty': 23,
  'Automatically tune each worker to about one share every 30 seconds. Miners can still force a value with d=<difficulty> in the password field.': 24,
  'Log Level': 25,
  'At info, go-quai logs every block while syncing, which runs to gigabytes. Keep warn unless you are troubleshooting; info also logs each miner connecting to stratum.': 26,
  'Saving restarts the node if it is running.': 27,

  // actions/syncMethod.ts
  'Sync Method': 28,
  'How this node gets the Quai chain. A snapshot gets you mining in about a day but means trusting the snapshot. Syncing from genesis verifies everything yourself but takes weeks.': 29,
  'Restore from snapshot': 30,
  'Snapshot URL': 31,
  "A .tar.zst archive of go-quai chain data. Defaults to Quai's official mainnet snapshot.": 32,
  'SHA256 (optional)': 33,
  "If the snapshot's publisher lists a SHA256, paste it here and the download is verified before use. Quai does not currently publish one for its official snapshot.": 34,
  '64 hexadecimal characters': 35,
  'Sync from genesis': 36,
  'Restore chain data from a snapshot, or sync from genesis': 37,
  'Restoring a snapshot downloads the whole archive (hundreds of GB) on the next start and then replaces any chain data this node already has.': 38,

  // init/syncTask.ts
  'Choose how this node gets the Quai chain: restore a snapshot (about a day) or sync from genesis (weeks)': 39,

  // main.ts (snapshot restore)
  'Snapshot Restore': 40,
  'Not used: this node syncs from genesis': 41,
  'No snapshot restore requested': 42,
  'Snapshot restored': 43,
  'Preparing snapshot restore': 44,
  // interfaces.ts (shared RPC)
  'Zone RPC': 49,
  'Cyprus-1 JSON-RPC, used by the Quai Mining Dashboard package for reward and difficulty figures. Unauthenticated: anyone who can reach it can query this node.': 50,

  // actions/config.ts (RPC sharing)
  'Share node RPC with other packages': 51,
  'Needed by the Quai Mining Dashboard package to show reward estimates and network difficulty. go-quai has no RPC authentication, so leave this off unless a package on this server needs it.': 52,
  Settings: 53,
  'Variable difficulty, RPC sharing, and log level': 54,

  // actions/syncMethod.ts (result)
  'Snapshot restore scheduled': 45,
  'Start the service to begin. The snapshot downloads first, then extracts; progress shows in the Snapshot Restore health check, and the node starts on its own when the restore finishes. If the download is interrupted it resumes where it left off.': 46,
  'Syncing from genesis': 47,
  'Start the service. The node downloads and verifies every block itself, which takes weeks on typical hardware. Chain Sync shows progress.': 48,
} as const

/**
 * Plumbing. DO NOT EDIT.
 */
export type I18nKey = keyof typeof dict
export type LangDict = Record<(typeof dict)[I18nKey], string>
export default dict
