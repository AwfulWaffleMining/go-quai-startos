import { VersionInfo } from '@start9labs/start-sdk'

export const v_0_56_0_4 = VersionInfo.of({
  version: '0.56.0:4',
  releaseNotes: {
    en_US:
      'Adds a mining dashboard, served by the package as a new Mining Dashboard interface. It shows hashrate with history, your workers (including ones that have gone offline), blocks found, share luck against the block threshold, and a connection builder that fills in the stratum URL, username and password options for your hardware. go-quai keeps its stratum stats in memory only, so the package now collects and stores them: hashrate history for 7 days, per-worker 24-hour averages, share history beyond the 500 the node keeps, and every block found, which is kept permanently and included in backups. Hashrate history can be exported as CSV. The page is served entirely from the node, with its fonts bundled, so it makes no outside requests.',
  },
  migrations: {},
})
