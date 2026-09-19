import { VersionGraph } from '@start9labs/start-sdk'
import { current } from './current'
import { v_0_56_0_1 } from './v0.56.0_1'
import { v_0_56_0_2 } from './v0.56.0_2'

// Only versions that introduced a migration are declared: 0.56.0:1 moved the
// default log level, 0.56.0:2 marked existing installs as synced from genesis.
// Everything else migrates in one hop via the range vertex below `current`.
export const versionGraph = VersionGraph.of({
  current,
  other: [v_0_56_0_2, v_0_56_0_1],
})
