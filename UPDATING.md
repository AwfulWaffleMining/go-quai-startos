# Updating the upstream version

## Find the latest release

```sh
gh release view -R dominant-strategies/go-quai --json tagName -q .tagName
```

## Apply the bump

1. Set `goQuaiVersion` in `startos/utils.ts` to the new tag (keep the leading `v`).
2. Update `version` in `startos/versions/current.ts` to `<tag without v>:0` and rewrite the release notes. If the old version needs a migration, copy `current.ts` to a versioned file first and add it to `other` in `startos/versions/index.ts`.
3. Diff the flags between the old and new tag and check nothing this package passes was renamed or removed:

   ```sh
   git diff <old-tag> <new-tag> -- cmd/utils/flags.go stratum/ node/health.go
   ```

   Pay attention to the stratum `*-addr` defaults, the `--rpc.health` response shape, and the Go version in `go.mod` (update the builder image in `Dockerfile` if it moves).
4. `npm run check && make`, sideload, and confirm all three health checks go green on a synced node.
