import { VersionGraph } from '@start9labs/start-sdk'
import { current } from './current'
import { v_0_56_0_0 } from './v0.56.0_0'
import { v_0_56_0_1 } from './v0.56.0_1'
import { v_0_56_0_2 } from './v0.56.0_2'
import { v_0_56_0_3 } from './v0.56.0_3'
import { v_0_56_0_4 } from './v0.56.0_4'
import { v_0_56_0_5 } from './v0.56.0_5'
import { v_0_56_0_6 } from './v0.56.0_6'

export const versionGraph = VersionGraph.of({
  current,
  other: [v_0_56_0_6, v_0_56_0_5, v_0_56_0_4, v_0_56_0_3, v_0_56_0_2, v_0_56_0_1, v_0_56_0_0],
})
