import { storeJson } from '../file-models/store.json'
import { sdk } from '../sdk'

// Write defaults on install/update/restore so main.ts always reads a full store.
export const seedFiles = sdk.setupOnInit(async (effects, kind) => {
  if (!kind) return
  await storeJson.merge(effects, {})

  // Backups exclude chain data, so a restored node has none. Ask for the sync
  // method again instead of silently syncing from genesis.
  if (kind === 'restore') {
    await storeJson.merge(effects, {
      syncMethod: 'unset',
      bootstrapRequestId: '',
    })
  }
})
