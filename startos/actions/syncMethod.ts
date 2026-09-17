import { utils } from '@start9labs/start-sdk'
import { storeJson } from '../file-models/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { defaultSnapshotUrl } from '../utils'

const { InputSpec, Value, Variants } = sdk

export const syncMethodSpec = InputSpec.of({
  method: Value.union({
    name: i18n('Sync Method'),
    description: i18n(
      'How this node gets the Quai chain. A snapshot gets you mining in about a day but means trusting the snapshot. Syncing from genesis verifies everything yourself but takes weeks.',
    ),
    default: 'snapshot',
    variants: Variants.of({
      snapshot: {
        name: i18n('Restore from snapshot'),
        spec: InputSpec.of({
          url: Value.text({
            name: i18n('Snapshot URL'),
            description: i18n(
              "A .tar.zst archive of go-quai chain data. Defaults to Quai's official mainnet snapshot.",
            ),
            required: true,
            default: defaultSnapshotUrl,
            placeholder: defaultSnapshotUrl,
            patterns: [utils.Patterns.url],
          }),
          sha256: Value.text({
            name: i18n('SHA256 (optional)'),
            description: i18n(
              "If the snapshot's publisher lists a SHA256, paste it here and the download is verified before use. Quai does not currently publish one for its official snapshot.",
            ),
            required: false,
            default: null,
            patterns: [
              {
                regex: '^[0-9a-fA-F]{64}$',
                description: i18n('64 hexadecimal characters'),
              },
            ],
          }),
        }),
      },
      genesis: {
        name: i18n('Sync from genesis'),
        spec: InputSpec.of({}),
      },
    }),
  }),
})

export const syncMethod = sdk.Action.withInput(
  'sync-method',

  async ({ effects }) => ({
    name: i18n('Sync Method'),
    description: i18n(
      'Restore chain data from a snapshot, or sync from genesis',
    ),
    warning: i18n(
      'Restoring a snapshot downloads the whole archive (hundreds of GB) on the next start and then replaces any chain data this node already has.',
    ),
    allowedStatuses: 'only-stopped',
    group: null,
    visibility: 'enabled',
  }),

  syncMethodSpec,

  async ({ effects }) => {
    const s = await storeJson.read().once()
    return {
      method:
        s?.syncMethod === 'genesis'
          ? { selection: 'genesis' as const, value: {} }
          : {
              selection: 'snapshot' as const,
              value: {
                url: s?.snapshotUrl || defaultSnapshotUrl,
                sha256: s?.snapshotSha256 || null,
              },
            },
    }
  },

  async ({ effects, input }) => {
    if (input.method.selection === 'snapshot') {
      await storeJson.merge(effects, {
        syncMethod: 'snapshot',
        snapshotUrl: input.method.value.url,
        snapshotSha256: input.method.value.sha256 ?? '',
        // A fresh id makes bootstrap.sh run on the next start, even for a URL
        // that was restored before.
        bootstrapRequestId: new Date().toISOString(),
      })
    } else {
      await storeJson.merge(effects, {
        syncMethod: 'genesis',
        bootstrapRequestId: '',
      })
    }
  },
)
