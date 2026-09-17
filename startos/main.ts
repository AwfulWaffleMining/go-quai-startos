import { bootstrapMarker, bootstrapStatus } from './file-models/bootstrap'
import { storeJson } from './file-models/store.json'
import { i18n } from './i18n'
import { sdk } from './sdk'
import {
  healthPort,
  kawpowPort,
  mountpoint,
  p2pPort,
  scryptPort,
  shaPort,
  stratumApiPort,
  zoneRpcPort,
} from './utils'

// Shape of go-quai's --rpc.health response (node/health.go).
type NodeHealth = {
  healthy: boolean
  localBlockNum?: number
  referenceBlockNum?: number
  blocksBehind?: number
  stratumHealthy?: boolean
  error?: string
}

export const main = sdk.setupMain(async ({ effects }) => {
  console.info(i18n('Starting Quai Network node'))

  // .const() makes the daemon restart whenever the user saves new settings.
  const store = await storeJson.read().const(effects)
  const poolTag = store?.poolTag ?? ''
  const varDiff = store?.varDiff ?? true
  const logLevel = store?.logLevel ?? 'warn'
  const syncMethod = store?.syncMethod ?? 'unset'
  const bootstrapRequestId = store?.bootstrapRequestId ?? ''

  const sub = await sdk.SubContainer.of(
    effects,
    { imageId: 'go-quai' },
    sdk.Mounts.of().mountVolume({
      volumeId: 'main',
      subpath: null,
      mountpoint,
      readonly: false,
    }),
    'go-quai',
  )

  // Snapshot restore runs in its own subcontainer before the node (bootstrap.sh).
  const bootstrapSub = await sdk.SubContainer.of(
    effects,
    { imageId: 'go-quai' },
    sdk.Mounts.of().mountVolume({
      volumeId: 'main',
      subpath: null,
      mountpoint,
      readonly: false,
    }),
    'bootstrap',
  )

  const args = [
    `--global.data-dir=${mountpoint}/go-quai`,
    `--global.config-dir=${mountpoint}/config`,
    `--global.log-level=${logLevel}`,
    '--global.log-size=100',

    // Mainnet (Colosseum). Orchard testnet needs a build from go-quai's
    // `orchard` branch, so it is intentionally not offered here.
    '--node.environment=colosseum',
    '--node.slices=[0 0]',
    `--node.port=${p2pPort}`,

    // Zone RPC stays on localhost unless the user shares it with dependent packages.
    `--rpc.http-addr=${store?.shareRpc ? '0.0.0.0' : '127.0.0.1'}`,
    '--rpc.health=true',
    `--rpc.health-port=${healthPort}`,

    // Stratum. Payout address, lock period and share difficulty come from each
    // miner's username/password, not from node-level coinbase flags.
    '--node.stratum-enabled=true',
    `--node.stratum-sha-addr=0.0.0.0:${shaPort}`,
    `--node.stratum-scrypt-addr=0.0.0.0:${scryptPort}`,
    `--node.stratum-kawpow-addr=0.0.0.0:${kawpowPort}`,
    `--node.stratum-api-addr=0.0.0.0:${stratumApiPort}`,
    `--node.stratum-vardiff=${varDiff}`,
    '--node.stratum-name=startos',
  ]
  if (poolTag) args.push(`--node.stratum-pool-tag=${poolTag}`)

  // Shared between the two health checks below: stratum reports "wait" until
  // the node is synced, because hashing against an unsynced node is wasted.
  let synced = false

  const readNodeHealth = async (): Promise<NodeHealth | null> => {
    try {
      const res = await sub.exec(
        ['curl', '-s', '--max-time', '15', `http://127.0.0.1:${healthPort}/`],
        {},
        20_000,
      )
      const out = String(res.stdout ?? '')
      if (res.exitCode !== 0 || !out) return null
      return JSON.parse(out) as NodeHealth
    } catch {
      return null
    }
  }

  return sdk.Daemons.of(effects)
    .addOneshot('bootstrap', {
      subcontainer: bootstrapSub,
      exec: {
        command: ['/usr/local/bin/bootstrap.sh'],
        env: {
          BOOTSTRAP_REQUEST_ID: bootstrapRequestId,
          BOOTSTRAP_URL: store?.snapshotUrl ?? '',
          BOOTSTRAP_SHA256: store?.snapshotSha256 ?? '',
        },
      },
      requires: [],
    })
    .addHealthCheck('restore', {
      ready: {
        display: i18n('Snapshot Restore'),
        fn: async () => {
          if (!bootstrapRequestId) {
            return {
              result: 'disabled' as const,
              message:
                syncMethod === 'genesis'
                  ? i18n('Not used: this node syncs from genesis')
                  : i18n('No snapshot restore requested'),
            }
          }
          const marker = await bootstrapMarker
            .read()
            .once()
            .catch(() => null)
          if (marker?.trim() === bootstrapRequestId) {
            return {
              result: 'success' as const,
              message: i18n('Snapshot restored'),
            }
          }
          const status = await bootstrapStatus
            .read()
            .once()
            .catch(() => null)
          if (!status || status.requestId !== bootstrapRequestId) {
            return {
              result: 'starting' as const,
              message: i18n('Preparing snapshot restore'),
            }
          }
          // bootstrap.sh writes its progress messages in English.
          if (status.phase === 'error') {
            return { result: 'failure' as const, message: status.message }
          }
          return { result: 'loading' as const, message: status.message }
        },
      },
      requires: [],
    })
    .addDaemon('go-quai', {
      subcontainer: sub,
      exec: {
        command: ['/usr/local/bin/docker_entrypoint.sh', ...args],
        cwd: '/opt/go-quai',
        // Give the chain database time to flush on stop.
        sigtermTimeout: 120_000,
      },
      ready: {
        display: i18n('Node'),
        gracePeriod: 60_000,
        fn: () =>
          sdk.healthCheck.checkPortListening(effects, zoneRpcPort, {
            successMessage: i18n('The Quai node is running'),
            errorMessage: i18n('The Quai node is starting'),
          }),
      },
      // Never start go-quai on top of a half-restored database.
      requires: ['bootstrap'],
    })
    .addHealthCheck('sync', {
      ready: {
        display: i18n('Chain Sync'),
        // Each probe asks Quai's public RPC for the chain tip, so poll gently.
        trigger: sdk.trigger.statusTrigger(60_000, {
          starting: 15_000,
          failure: 15_000,
        }),
        fn: async () => {
          const h = await readNodeHealth()

          if (!h || h.localBlockNum === undefined) {
            synced = false
            return {
              result: 'starting' as const,
              message: i18n('Waiting for the node to report its block height'),
            }
          }

          if (h.healthy) {
            synced = true
            return {
              result: 'success' as const,
              message: i18n('Synced at block ${height}', {
                height: h.localBlockNum,
              }),
            }
          }

          synced = false
          if (!h.referenceBlockNum) {
            return {
              result: 'loading' as const,
              message: i18n(
                'At block ${height}; could not reach the reference node to compare',
                { height: h.localBlockNum },
              ),
            }
          }
          return {
            result: 'loading' as const,
            message: i18n('Syncing: block ${height} of ${tip}', {
              height: h.localBlockNum,
              tip: h.referenceBlockNum,
            }),
          }
        },
      },
      requires: ['go-quai'],
    })
    .addHealthCheck('stratum', {
      ready: {
        display: i18n('Stratum'),
        fn: async () => {
          for (const port of [shaPort, scryptPort, kawpowPort]) {
            const res = await sdk.healthCheck.checkPortListening(effects, port, {
              successMessage: '',
              errorMessage: '',
            })
            if (res.result !== 'success') {
              return {
                result: 'starting' as const,
                message: i18n('Stratum port ${port} is not listening yet', {
                  port,
                }),
              }
            }
          }
          if (!synced) {
            return {
              result: 'loading' as const,
              message: i18n(
                'Listening, but do not point miners here until Chain Sync is green',
              ),
            }
          }
          return {
            result: 'success' as const,
            message: i18n(
              'Ready: SHA-256 on 3333, Scrypt on 3334, KawPoW on 3335',
            ),
          }
        },
      },
      requires: ['go-quai'],
    })
})
