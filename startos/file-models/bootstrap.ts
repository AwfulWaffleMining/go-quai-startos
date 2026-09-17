import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

// Written by bootstrap.sh while a snapshot restore runs.
export const bootstrapStatus = FileHelper.json(
  { base: sdk.volumes.main, subpath: '/bootstrap/status.json' },
  z.object({
    requestId: z.string().catch(''),
    phase: z.string().catch(''),
    done: z.number().catch(0),
    total: z.number().catch(0),
    message: z.string().catch(''),
  }),
)

// Request id of the restore that produced the current chain data.
export const bootstrapMarker = FileHelper.string({
  base: sdk.volumes.main,
  subpath: '/go-quai/.bootstrap-id',
})
