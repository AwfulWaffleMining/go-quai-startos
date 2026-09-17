import { sdk } from './sdk'

// The chain database resyncs from peers, and logs are disposable, so neither is
// worth hundreds of GB in a backup. Settings (store.json, config/) are kept.
export const { createBackup, restoreInit } = sdk.setupBackups(async () =>
  sdk.Backups.ofVolumes('main').setOptions({
    exclude: ['go-quai/', 'nodelogs/'],
  }),
)
