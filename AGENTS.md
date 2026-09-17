# AGENTS.md

This is a StartOS service-package repository. It builds a `.s9pk` for StartOS using `@start9labs/start-sdk`. The packaging guide is at <https://docs.start9.com/packaging>.

Keep `README.md` (technical reference) and `instructions.md` (end-user docs) in sync with your changes. Bugs and feature requests go in GitHub issues, not in TODO files.

## This repo

- **Verify go-quai behaviour against the pinned tag's source, not docs.qu.ai.** The docs and the code disagreed on stratum port defaults in v0.56.0. `README.md` lists the known differences.
- **Pass every stratum address explicitly** in `startos/main.ts`. Never rely on upstream defaults for ports.
- **Do not add node-level coinbase configuration** unless upstream stops taking the payout address from the stratum username.
- **Keep the chain database and `bootstrap/` out of backups.**
- **Never set `--node.db-engine=pebble`.** Snapshots (Quai's official one included) are LevelDB, and go-quai refuses to start when the flag doesn't match an existing database.
- **Test `bootstrap.sh` under BusyBox `sh`** (the image's shell) against a range-capable HTTP server, covering at least resume, checksum mismatch and a corrupt archive. Keep it ShellCheck-clean.
