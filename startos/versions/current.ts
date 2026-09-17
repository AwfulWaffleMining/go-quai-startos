import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '0.56.0:0',
  releaseNotes: {
    en_US:
      'Initial release. go-quai v0.56.0 with the built-in stratum server on 3333 (SHA-256), 3334 (Scrypt) and 3335 (KawPoW).',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
