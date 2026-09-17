import { VersionInfo } from '@start9labs/start-sdk'
import { storeJson } from '../file-models/store.json'

export const current = VersionInfo.of({
  version: '0.56.0:1',
  releaseNotes: {
    en_US:
      'Quieter logs. The default log level is now warn instead of info. At info, go-quai writes several lines for every block while syncing, which adds up to gigabytes over a full sync. Installs still on the old default of info are switched to warn by this update; change it back under Stratum Settings if you want the detail. Also documents the coinbase-address warnings go-quai prints at startup, which are expected for stratum mining.',
  },
  migrations: {
    up: async ({ effects }) => {
      // 0.56.0:0 seeded logLevel 'info' as its default. Move installs still on
      // that value to the new default; any other choice is left alone.
      const logLevel = await storeJson.read((s) => s.logLevel).once()
      if (logLevel === 'info') {
        await storeJson.merge(effects, { logLevel: 'warn' })
      }
    },
    // warn is valid in 0.56.0:0 too, so downgrading needs no data change.
  },
})
