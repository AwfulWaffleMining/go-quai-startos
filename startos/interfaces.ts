import { i18n } from './i18n'
import { sdk } from './sdk'
import {
  dashboardPort,
  kawpowPort,
  p2pPort,
  scryptPort,
  shaPort,
  stratumApiPort,
} from './utils'

export const setInterfaces = sdk.setupInterfaces(async ({ effects }) => {
  // One host for all stratum ports + the stats API, so miners use one hostname.
  const mainHost = sdk.MultiHost.of(effects, 'main')

  const stratumPorts = [
    {
      id: 'stratum-sha256',
      port: shaPort,
      name: i18n('Stratum: SHA-256'),
      description: i18n('Point SHA-256 ASICs here'),
    },
    {
      id: 'stratum-scrypt',
      port: scryptPort,
      name: i18n('Stratum: Scrypt'),
      description: i18n('Point Scrypt ASICs here'),
    },
    {
      id: 'stratum-kawpow',
      port: kawpowPort,
      name: i18n('Stratum: KawPoW'),
      description: i18n('Point KawPoW GPU miners here'),
    },
  ]

  const receipts = []

  for (const s of stratumPorts) {
    // Plain TCP, same external port as internal so miner configs match docs.
    const origin = await mainHost.bindPort(s.port, {
      protocol: null,
      addSsl: null,
      preferredExternalPort: s.port,
      secure: { ssl: false },
    })
    const iface = sdk.createInterface(effects, {
      name: s.name,
      id: s.id,
      description: s.description,
      type: 'api',
      masked: false,
      schemeOverride: { ssl: null, noSsl: 'stratum+tcp' },
      username: null,
      path: '',
      query: {},
    })
    receipts.push(await origin.export([iface]))
  }

  // Stratum stats API (JSON): /api/pool/stats, /api/pool/workers, /api/pool/blocks
  const apiOrigin = await mainHost.bindPort(stratumApiPort, {
    protocol: 'http',
  })
  const api = sdk.createInterface(effects, {
    name: i18n('Mining Stats API'),
    id: 'stratum-api',
    description: i18n(
      'JSON stats for connected workers, hashrate, shares and blocks found',
    ),
    type: 'api',
    masked: false,
    schemeOverride: null,
    username: null,
    path: '/api/pool/stats',
    query: {},
  })
  receipts.push(await apiOrigin.export([api]))

  // Mining dashboard (served by quai-dashboard, which also stores the history)
  const dashOrigin = await mainHost.bindPort(dashboardPort, { protocol: 'http' })
  const dashboard = sdk.createInterface(effects, {
    name: i18n('Mining Dashboard'),
    id: 'dashboard',
    description: i18n(
      'Hashrate, workers, blocks found, share luck, and connection settings for your miners',
    ),
    type: 'ui',
    masked: false,
    schemeOverride: null,
    username: null,
    path: '',
    query: {},
  })
  receipts.push(await dashOrigin.export([dashboard]))

  // Inbound Quai peers (optional; outbound peering works without it).
  const p2pHost = sdk.MultiHost.of(effects, 'p2p')
  const p2pOrigin = await p2pHost.bindPort(p2pPort, {
    protocol: null,
    addSsl: null,
    preferredExternalPort: p2pPort,
    secure: { ssl: false },
  })
  const p2p = sdk.createInterface(effects, {
    name: i18n('Peer'),
    id: 'p2p',
    description: i18n('Accepts inbound connections from other Quai nodes'),
    type: 'p2p',
    masked: false,
    schemeOverride: { ssl: null, noSsl: null },
    username: null,
    path: '',
    query: {},
  })
  receipts.push(await p2pOrigin.export([p2p]))

  return receipts
})
