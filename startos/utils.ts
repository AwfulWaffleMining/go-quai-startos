export const goQuaiVersion = 'v0.56.0'

// Preferred external ports; 3333-3336 would collide with Public Pool.
export const shaPort = 3301
export const scryptPort = 3302
export const kawpowPort = 3303
export const stratumApiPort = 3306

export const p2pPort = 4002
// Cyprus-1 zone HTTP RPC: rpc.http-port 9001 + zone offset 199 + 20*region + zone.
export const zoneRpcPort = 9200
export const healthPort = 8081

export const mountpoint = '/data'

// Imported by quai-dashboard-startos: renaming any id below breaks that package.
export const mainHostId = 'main'
export const rpcHostId = 'rpc'

export const stratumInterfaceIds = {
  sha256: 'stratum-sha256',
  scrypt: 'stratum-scrypt',
  kawpow: 'stratum-kawpow',
} as const

export const stratumApiInterfaceId = 'stratum-api'
export const rpcInterfaceId = 'rpc'

export const defaultSnapshotUrl =
  'https://snapshot.qu.ai/mainnet-snapshot.tar.zst'
