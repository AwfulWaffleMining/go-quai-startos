import { syncMethod } from '../actions/syncMethod'
import { storeJson } from '../file-models/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

// Until a sync method is chosen, raise a critical task: StartOS will not start
// the service while it is outstanding. Running the action resolves it.
export const syncTask = sdk.setupOnInit(async (effects) => {
  const method = await storeJson.read((s) => s.syncMethod).const(effects)
  if (method === 'unset') {
    await sdk.action.createOwnTask(effects, syncMethod, 'critical', {
      reason: i18n(
        'Choose how this node gets the Quai chain: restore a snapshot (about a day) or sync from genesis (weeks)',
      ),
    })
  }
})
