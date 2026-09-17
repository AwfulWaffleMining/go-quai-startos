import { VersionInfo } from '@start9labs/start-sdk'
import { storeJson } from '../file-models/store.json'

export const v_0_56_0_2 = VersionInfo.of({
  version: '0.56.0:2',
  releaseNotes: {
    en_US:
      "Snapshot restore. On install you now choose how the node gets the Quai chain: restore a snapshot (Quai's official mainnet snapshot by default, about a day to fully synced) or sync from genesis (fully self-verified, weeks on typical hardware). The node does not start until you choose. A snapshot restore downloads before the node starts, resumes after interruptions, verifies a SHA256 when you provide one, and replaces chain data only after the archive extracts cleanly. Progress shows in a new Snapshot Restore health check. Change it any time with the Sync Method action. Existing installs keep syncing as before.",
  },
  migrations: {
    up: async ({ effects }) => {
      // Nodes installed before this version are already syncing from genesis;
      // record that so they are not blocked by the new critical Sync Method task.
      const s = await storeJson.read().once()
      if (s && s.syncMethod === 'unset') {
        await storeJson.merge(effects, {
          syncMethod: 'genesis',
          bootstrapRequestId: '',
        })
      }
    },
    // 0.56.0:1 ignores (and strips) the sync fields, so downgrading needs no change.
  },
})
