import { utils } from '@start9labs/start-sdk'
import { storeJson } from '../file-models/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

const { InputSpec, Value } = sdk

export const inputSpec = InputSpec.of({
  poolTag: Value.text({
    name: i18n('Pool Tag'),
    description: i18n(
      'Optional tag written into the coinbase of blocks you find. Visible on-chain.',
    ),
    required: false,
    default: null,
    placeholder: '/AwfulWaffle/',
    maxLength: 32,
    patterns: [utils.Patterns.ascii],
  }),
  varDiff: Value.toggle({
    name: i18n('Variable Difficulty'),
    description: i18n(
      'Automatically tune each worker to about one share every 30 seconds. Miners can still force a value with d=<difficulty> in the password field.',
    ),
    default: true,
  }),
  logLevel: Value.select({
    name: i18n('Log Level'),
    description: i18n(
      'At info, go-quai logs every block while syncing, which runs to gigabytes. Keep warn unless you are troubleshooting; info also logs each miner connecting to stratum.',
    ),
    default: 'warn',
    values: {
      error: 'error',
      warn: 'warn',
      info: 'info',
      debug: 'debug',
    },
  }),
})

export const config = sdk.Action.withInput(
  'config',

  async ({ effects }) => ({
    name: i18n('Stratum Settings'),
    description: i18n('Pool tag, variable difficulty and log level'),
    warning: i18n('Saving restarts the node if it is running.'),
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  inputSpec,

  async ({ effects }) => {
    const s = await storeJson.read().once()
    return {
      poolTag: s?.poolTag || null,
      varDiff: s?.varDiff ?? true,
      logLevel: s?.logLevel ?? 'warn',
    }
  },

  async ({ effects, input }) => {
    await storeJson.merge(effects, {
      poolTag: input.poolTag ?? '',
      varDiff: input.varDiff,
      logLevel: input.logLevel,
    })
  },
)
