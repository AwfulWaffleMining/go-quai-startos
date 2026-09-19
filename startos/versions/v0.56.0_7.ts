import { VersionInfo } from '@start9labs/start-sdk'

export const v_0_56_0_7 = VersionInfo.of({
  version: '0.56.0:7',
  releaseNotes: {
    en_US:
      "Stratum now asks for ports 3301-3303 (and 3306 for the stats API) instead of 3333-3335. The old defaults collide with Public Pool, and when they do StartOS quietly assigns a random high port, which is confusing when a miner won't connect. The Stratum health check now names the ports actually assigned, so the service page tells you where to point miners. The snapshot free-space check is also less strict: a real restore unpacked a 225 GB archive to 271 GB, so it now asks for 1.5x rather than 2x. Finally, a normal stop no longer logs \"exited with code 1\": go-quai returns non-zero after a graceful shutdown, and that is no longer reported as a failure.",
  },
  migrations: {},
})
