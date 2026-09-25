# AGENTS.md

This is a StartOS service-package repository — it builds a `.s9pk` for StartOS.

Develop it inside a StartOS packaging workspace created by `start-cli s9pk init-workspace`,
which provides the packaging guide and agent context one level up. If you're reading this in a
bare clone with no workspace, the full guide is at <https://docs.start9.com/packaging>.

**Start every task at the recipe index** — `../start-technologies/projects/start-sdk/docs/src/recipes.md`
(or <https://docs.start9.com/packaging/recipes.html>). It maps an intent ("prompt the user to create
admin credentials", "expose a web UI") to the constructs, the reference pages, and a named production
package to copy. Find the recipe before you read this package's neighbours: a package you reach by
grepping may be non-conformant, and the recipe outranks it.

Work this package's `TODO.md` from top to bottom. Keep `README.md` (technical reference for an AI support or administering agent) and `instructions.md` (end-user docs) in sync with your changes.

## This repo

- **Verify go-quai behaviour against the pinned tag's source, not docs.qu.ai.** They disagree (stratum port defaults, for one).
- **Pass every stratum address explicitly** in `startos/main.ts`. Never rely on upstream defaults for ports.
- **Never set `--node.stratum-pool-tag`.** With a tag set, the node's workshares stopped landing on chain while its share counters looked healthy.
- **Do not add node-level coinbase configuration** unless upstream stops taking the payout address from the stratum username.
- **Never set `--node.db-engine=pebble`.** Snapshots (Quai's official one included) are LevelDB, and go-quai refuses to start when the flag doesn't match an existing database.
- **The ids and ports exported from `startos/utils.ts`, and the health check ids, are an API** imported by `quai-dashboard-startos`. Renaming one breaks that package.
- **Never add curl `--retry` to the snapshot download.** It truncates the partial file on retry. Retry in the script with a fresh `curl -C -`.
- **Test `bootstrap.sh` under BusyBox `sh`** (the image's shell) against a range-capable HTTP server, covering at least resume, checksum mismatch and a corrupt archive. Keep it ShellCheck-clean.
