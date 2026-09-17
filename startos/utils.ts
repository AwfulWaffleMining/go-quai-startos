// Constants shared across the package.

export const goQuaiVersion = 'v0.56.0'

// go-quai v0.56.0's built-in stratum defaults are KawPoW 3333 / Scrypt 3334 /
// SHA-256 3335, which is the reverse of what docs.qu.ai documents. Every
// address is passed explicitly in main.ts so the docs' mapping is what runs.
export const shaPort = 3333
export const scryptPort = 3334
export const kawpowPort = 3335
export const stratumApiPort = 3336

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

// Quai's official mainnet snapshot (LevelDB, one top-level folder). The Sync
// Method action lets users point at another source, such as a community mirror.
export const defaultSnapshotUrl =
  'https://snapshot.qu.ai/mainnet-snapshot.tar.zst'
