import { sdk } from '../sdk'
import { config } from './config'
import { syncMethod } from './syncMethod'

export const actions = sdk.Actions.of().addAction(syncMethod).addAction(config)
