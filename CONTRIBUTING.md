# Contributing to polyq

## Local development

```bash
bun install
bun run lint         # tsc --noEmit on src/
bun run lint:tests   # tsc --noEmit on tests/ (stricter — catches test-file drift)
bun run lint:biome   # Biome lint + format check
bun run test         # vitest
bun run coverage     # vitest + v8 coverage report (optional, slower)
bun run build        # tsdown
```

Run at least `lint`, `lint:tests`, `lint:biome`, `test`, and `build` before pushing. `coverage` is for when you're adding new tests and want the report.

### Integration tests

`tests/integration/**` are gated on `POLYQ_INTEGRATION=1` and skip by default. They need a real Postgres (and, for the Docker suite, a running Docker daemon).

```bash
# One-liner for the Postgres suites — matches the CI service container.
docker run --rm -d --name polyq-pg \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=polyq_test -p 5432:5432 postgres:16

POLYQ_INTEGRATION=1 bun run test tests/integration
```

**`POLYQ_PG_URL`** overrides the default connection string (`postgresql://postgres:dev@127.0.0.1:5432/polyq_test`). Set it if your local Postgres listens on a different port, uses different credentials, or you're pointing at a Colima/OrbStack socket.

### Build tool note

The build uses `tsdown@0.21.9` (pinned exactly — pre-1.0, so minor bumps can be breaking). Review `tsdown` Dependabot PRs carefully: run `bun run build`, check `dist/` sizes, and inspect one of the generated `.d.mts` files by hand before merging.

### Codama pin note

The Codama devDeps — `codama`, `@codama/nodes-from-anchor`, `@codama/renderers-js` — are pinned at caret `^1.0.0` but our snapshot tests were written against `1.6.x` / `1.7.x` (see `bun.lock`). The `peerDependencies` range is `^1.0.0` to match.

If Codama ships `2.x` with renderer output changes, **don't widen to `^1.0.0 || ^2.0.0` until the snapshot suite is regenerated against 2.x** — consumers on 2.x will otherwise get output that doesn't match what the `docs/guides/codegen.md` sample tree advertises.

## Releasing

Releases are managed with [Changesets](https://github.com/changesets/changesets).

1. When you open a PR with user-facing changes, create a changeset:
   ```bash
   bun run changeset
   ```
   Pick patch/minor/major per [semver](https://semver.org). Write the summary as a user-facing changelog entry.
2. Commit `.changeset/*.md` with your code. The changeset travels with the PR.
3. When the PR merges to `main`, the release workflow opens a "Version Packages" PR that:
   - Bumps `package.json` versions based on accumulated changesets
   - Writes `CHANGELOG.md`
   - Deletes the consumed changesets
4. Merging the "Version Packages" PR publishes to npm (with OIDC provenance) and creates a GitHub release.

Do not push tags manually. Do not run `npm publish` manually — the release workflow owns every publish.

### First publish — verify provenance

`release.yml` invokes `changesets/action`, which in turn runs `npm publish` with `NPM_CONFIG_PROVENANCE=true` and an OIDC-minted attestation. On the very first `0.4.0` release, confirm the attestation landed by running:

```bash
npm view polyq --json | jq '.dist.attestations, .dist.integrity'
```

`.dist.attestations.url` should be a `https://registry.npmjs.org/-/npm/v1/attestations/...` URL. If it's null, the OIDC handshake failed silently — re-check the release workflow log for the publish step and confirm `permissions: id-token: write` is still set at the job level in `release.yml`.

## Reporting issues

Open an issue on [GitHub](https://github.com/jynxbt/PolyQ/issues).
