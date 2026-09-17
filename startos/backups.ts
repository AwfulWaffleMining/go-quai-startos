import { sdk } from './sdk'

// The chain database resyncs (or restores from a snapshot), and logs and snapshot
// downloads are disposable, so none is worth hundreds of GB in a backup.
// Settings (store.json, config/) are kept. Restoring a backup asks for the sync
// method again (see init/seedFiles.ts).
export const { createBackup, restoreInit } = sdk.setupBackups(async () =>
  sdk.Backups.ofVolumes('main').setOptions({
    exclude: ['go-quai/', 'nodelogs/', 'bootstrap/'],
  }),
)
