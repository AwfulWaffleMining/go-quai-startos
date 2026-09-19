// Constants shared across the package.

export const goQuaiVersion = 'v0.56.0'

// go-quai v0.56.0's built-in stratum defaults are KawPoW 3333 / Scrypt 3334 /
// SHA-256 3335, which is the reverse of what docs.qu.ai documents. Every
// address is passed explicitly in main.ts so the docs' mapping is what runs.
// Preferred external ports. 3333-3336 are the docs' defaults but collide with
// Public Pool, so StartOS silently reassigns ours to a random high port. These
// are unlikely to be taken on a Start9 box; the real ports are always shown in
// Interfaces and by the Stratum health check.
export const shaPort = 3301
export const scryptPort = 3302
export const kawpowPort = 3303
export const stratumApiPort = 3306

export const p2pPort = 4002
// Cyprus-1 zone HTTP RPC: rpc.http-port 9001 + zone offset 199 + 20*region + zone.
export const zoneRpcPort = 9200
// go-quai's own health endpoint: compares local height to a reference RPC.
export const healthPort = 8081

export const mountpoint = '/data'

// Host and interface ids other packages resolve with sdk.host.getBridgeAddress.
// The Quai Mining Dashboard package depends on these: treat them as an API.
export const mainHostId = 'main'
export const rpcHostId = 'rpc'

// Interface ids, exported so dependent packages import them rather than keeping
// their own copies: a rename then breaks their build instead of their runtime.
export const stratumInterfaceIds = {
  sha256: 'stratum-sha256',
  scrypt: 'stratum-scrypt',
  kawpow: 'stratum-kawpow',
} as const

export const stratumApiInterfaceId = 'stratum-api'
export const rpcInterfaceId = 'rpc'

// Quai's official mainnet snapshot (LevelDB, one top-level folder). The Sync
// Method action lets users point at another source, such as a community mirror.
export const defaultSnapshotUrl =
  'https://snapshot.qu.ai/mainnet-snapshot.tar.zst'
