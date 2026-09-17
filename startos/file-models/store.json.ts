import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

export const logLevels = ['error', 'warn', 'info', 'debug'] as const

export const shape = z
  .object({
    poolTag: z.string().catch(''),
    varDiff: z.boolean().catch(true),
    logLevel: z.enum(logLevels).catch('info'),
  })
  .strip()

export const storeJson = FileHelper.json(
  {
    base: sdk.volumes.main,
    subpath: '/store.json',
  },
  shape,
)
