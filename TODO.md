# TODO — go-quai-startos

Worked top to bottom. Each item states what is unknown or wrong, why it matters, and what
would prove it done.

Changes ship as a pull request into `Start9-Community/go-quai-startos`. Always
`git fetch s9 && git merge --ff-only s9/main` before branching — a PR cut from an unsynced
copy reverts the community review.

---

## 1. KawPoW has never been exercised

Port 3303, `--node.stratum-kawpow-addr`, interface id `stratum-kawpow`. The wiring is
symmetric with SHA-256 and Scrypt, both of which are proven on chain. No KawPoW miner has
ever connected, so nothing below is known — only assumed by symmetry.

**The health check does not help here.** It asserts only that the port is listening:

```ts
for (const port of [shaPort, scryptPort, kawpowPort]) { ... }
→ 'Ready: SHA-256 on ${sha}, Scrypt on ${scrypt}, KawPoW on ${kawpow}'
```

KawPoW reports green whether or not the protocol behind that socket works. Green means a
socket is bound, nothing more.

Unknowns, in the order they would bite:

- **Which stratum dialect.** KawPoW is ethash-lineage, not stratum-v1 with a different hash:
  `mining.notify` carries headerhash / seedhash / target rather than merkle branches, and
  `mining.submit` carries a nonce plus a mixhash. At least two incompatible variants exist in
  the wild — the `EthereumStratum/1.0.0` subscribe handshake, and the plainer mode most
  Ravencoin pools serve. T-Rex, Gminer, lolMiner and SRBMiner each pick a mode by their own
  heuristics, some needing an explicit protocol flag. Verify against the pinned tag's
  `stratum/` source, not docs.qu.ai — they disagree (see AGENTS.md). **A dialect mismatch
  presents as silence, not as an error.**
- **Whether `<address>_lock=N` survives a GPU miner's username handling.** go-quai takes the
  payout address from the stratum username and the lock tier rides in it. GPU miner software
  is rougher with usernames than ASIC firmware — some split on `.`, some on `_`, some take
  `-u` and `-w` separately and reassemble. The likeliest silent failure is shares that land
  and pay at no lock instead of `lock=3`, forfeiting the first-year bonus with no error
  anywhere in the stack.
- **Vardiff at MH/s scale.** The proven algos run at tens of TH/s; a GPU is tens of MH/s —
  six orders of magnitude apart. Expect either no submissions at all or a flood.

**Done when:** one workshare appears on `explorer.qu.ai` attributable to a KawPoW worker
name, at the intended lock tier.

How to test without owning a GPU:

- Rent an hour of KawPoW from NiceHash pointed at port 3303. Real miner software, real
  dialect, real username handling, a few dollars. The only way to learn which variant
  go-quai speaks short of reading its source.
- Run the prober from item 2 for the handshake half.

## 2. Add a KawPoW handshake prober

A small script that connects to 3303, subscribes, authorizes with a real
`<address>_lock=3` username, and asserts a job comes back carrying a headerhash, a seedhash
and a target. It never finds a share — it proves the dialect and that the username survives
the round trip.

This is the test that was missing when a Canaan Avalon Mini 3 refused to speak to an AWM
stratum proxy: hours of tcpdump established only that no packet arrived, which a ten-second
handshake probe would have said immediately.

**Done when:** the script is in the repo, passes against 3303 for all three algos, and is
named in `UPDATING.md` as a required step after every `goQuaiVersion` bump — a dialect can
change quietly across upstream versions.

## 3. Make the stratum health check prove more than liveness

Today the check is a port-open probe, so it cannot distinguish "working" from "listening and
speaking the wrong protocol". The node already exposes a stats API on 3306
(`/api/pool/stats`, `/api/pool/workers`). Consider asserting against it — connected worker
count, or last-share age — so the health badge reflects mining rather than binding.

Until then, `instructions.md` should say plainly that a green stratum badge does not mean
shares are landing, and point users at the explorer as the real check. That wording is the
cheap half and can ship on its own.

**Done when:** either the check consults the stats API, or the docs stop implying green means
working.

## 4. Watch upstream for Equihash

Reported in Quai Discord as possibly landing on the node side. On the next version bump,
diff for a fourth `--node.stratum-*-addr` flag:

```sh
git diff <old-tag> <new-tag> -- cmd/utils/flags.go stratum/
```

If it appears, mirror the existing pattern in `utils.ts` (port + interface id), `main.ts`
(flag + health check loop), `interfaces.ts` (bound port + description), and tell
`quai-dashboard-startos` — its algo attribution needs the new bucket, and `utils.ts` ids are
an API that package imports.

---

## Not TODO — the verified baseline

Recorded so it is not re-litigated:

- **SHA-256 and Scrypt both mint workshares on chain**, confirmed on `explorer.qu.ai`, at
  ~51 TH/s and ~2.4 GH/s respectively.
- **Backup and restore verified** by uninstall then restore-from-backup: block history
  preserved, only live hashrate dipped to zero and recovered.
- **Upgrade-in-place preserves data.** Same dip-and-recover on current hashrate, nothing lost.
- **`--node.stratum-pool-tag` destroys rewards** — share counters stay healthy while nothing
  lands on chain. Six hours at 51 TH/s produced zero workshares. Never set it (AGENTS.md).
- **Orphaned workshares are usually a miner misconfiguration**, most often a worker name that
  is a stratum URL rather than an address. Not a package bug.
