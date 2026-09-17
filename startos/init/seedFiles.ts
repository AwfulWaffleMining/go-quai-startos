import { storeJson } from '../file-models/store.json'
import { sdk } from '../sdk'

// Write defaults on install/update/restore so main.ts always reads a full store.
export const seedFiles = sdk.setupOnInit(async (effects, kind) => {
  if (!kind) return
  await storeJson.merge(effects, {})
})
