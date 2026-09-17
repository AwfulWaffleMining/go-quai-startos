import { VersionInfo } from '@start9labs/start-sdk'

export const v_0_56_0_3 = VersionInfo.of({
  version: '0.56.0:3',
  releaseNotes: {
    en_US:
      'Fixes snapshot downloads restarting from zero. When a download was interrupted, curl\'s built-in retry rewound the file to where that attempt began, which for a fresh download is the beginning. Each retry now resumes from the bytes already on disk. A stalled connection is also detected after 2 minutes instead of waiting about 10 for the network to time out, and a snapshot URL that returns an HTTP error such as 404 now fails right away with the code shown. The Sync Method action now confirms what happens next after you submit it. A restore in progress resumes after updating.',
  },
  migrations: {},
})
