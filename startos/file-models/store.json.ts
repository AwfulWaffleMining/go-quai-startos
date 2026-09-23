import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'
import { defaultSnapshotUrl } from '../utils'

export const logLevels = ['error', 'warn', 'info', 'debug'] as const

export const shape = z
  .object({
    // Retained so an existing store still parses; NEVER used. See main.ts.
    poolTag: z.string().catch(''),
    varDiff: z.boolean().catch(true),
    logLevel: z.enum(logLevels).catch('warn'),
    // 'unset' raises the critical Sync Method task; the node cannot start until chosen.
    syncMethod: z.enum(['unset', 'snapshot', 'genesis']).catch('unset'),
    snapshotUrl: z.string().catch(defaultSnapshotUrl),
    snapshotSha256: z.string().catch(''),
    // Non-empty = a restore is requested; bootstrap.sh compares it with the
    // marker it writes into go-quai/.bootstrap-id after a successful restore.
    bootstrapRequestId: z.string().catch(''),
    // Bind the zone RPC for dependent packages (Quai Mining Dashboard).
    shareRpc: z.boolean().catch(false),
  })
  .strip()

export const storeJson = FileHelper.json(
  {
    base: sdk.volumes.main,
    subpath: '/store.json',
  },
  shape,
)
