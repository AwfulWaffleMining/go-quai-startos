import { sdk } from './sdk'

// go-quai is the node, the stratum server and the stats API in one binary.
export const setDependencies = sdk.setupDependencies(async ({ effects }) => ({}))
