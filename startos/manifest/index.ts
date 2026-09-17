import { setupManifest } from '@start9labs/start-sdk'
import { goQuaiVersion } from '../utils'
import { long, short } from './i18n'

export const manifest = setupManifest({
  id: 'go-quai',
  title: 'Quai Network',
  license: 'GPL-3.0',
  packageRepo: 'https://github.com/AwfulWaffleMining/go-quai-startos',
  upstreamRepo: 'https://github.com/dominant-strategies/go-quai',
  marketingUrl: 'https://qu.ai',
  donationUrl: null,
  description: { short, long },
  volumes: ['main'],
  images: {
    'go-quai': {
      source: {
        dockerBuild: {
          buildArgs: { GO_QUAI_VERSION: goQuaiVersion },
        },
      },
      arch: ['x86_64'],
    },
  },
  hardwareRequirements: {
    ram: 16384,
  },
  dependencies: {},
})
