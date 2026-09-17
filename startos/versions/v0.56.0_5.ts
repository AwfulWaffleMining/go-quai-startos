import { VersionInfo } from '@start9labs/start-sdk'

export const v_0_56_0_5 = VersionInfo.of({
  version: '0.56.0:5',
  releaseNotes: {
    en_US:
      'The mining dashboard moves into its own package, Quai Mining Dashboard, which installs alongside this one and waits for this node to finish syncing. Install it from the registry to get the dashboard back; your node keeps running either way. This package now only runs the node and its stratum server. The Settings action gains a switch to share the node\'s RPC with packages on this server, which the dashboard uses for reward estimates and network difficulty. It is off by default, because go-quai\'s RPC has no password.',
  },
  migrations: {},
})
