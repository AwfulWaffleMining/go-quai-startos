import { VersionGraph } from '@start9labs/start-sdk'
import { current } from './current'
import { v_0_56_0_0 } from './v0.56.0_0'
import { v_0_56_0_1 } from './v0.56.0_1'
import { v_0_56_0_2 } from './v0.56.0_2'

export const versionGraph = VersionGraph.of({
  current,
  other: [v_0_56_0_2, v_0_56_0_1, v_0_56_0_0],
})
