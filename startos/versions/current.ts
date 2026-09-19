import { VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '0.56.0:8',
  releaseNotes: {
    en_US:
      'Shows the stratum ports as plain numbers in the Stratum health check. They were being formatted with thousands separators, so port 3301 read as "3,301".',
  },
  migrations: {},
})
