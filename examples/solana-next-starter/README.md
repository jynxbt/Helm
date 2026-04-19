# solana-next-starter

A minimal Anchor program + Next.js 15 frontend wired up with Polyq.

Shows the three pieces Polyq glues together:

1. **Polyfills** — `withPolyq()` in `next.config.ts` configures Buffer/global/Node stubs for Turbopack + webpack.
2. **Codegen** — `polyq codegen` generates a typed TypeScript client from `target/idl/counter.json`.
3. **Workspace** — `polyq dev` runs `solana-test-validator → anchor build → anchor deploy → your init script → next dev` as a single command.

## Layout

```
solana-next-starter/
├── Anchor.toml                     # Solana workspace config
├── programs/counter/               # Tiny Anchor program (one instruction)
│   ├── Cargo.toml
│   └── src/lib.rs
├── app/                            # Next.js 15 App Router
│   ├── layout.tsx
│   └── page.tsx                    # Uses generated/counter client
├── generated/                      # Populated by `polyq codegen` (gitignored)
├── next.config.ts                  # withPolyq()
├── polyq.config.ts                 # Orchestrator config
├── package.json
└── tsconfig.json
```

## Running it

```bash
# 1. Install
bun install

# 2. Build the program + generate the client (first time only)
anchor build
bunx polyq codegen

# 3. Start the full dev loop
bunx polyq dev
```

`polyq dev` brings up the Solana test validator, deploys the counter program, and then boots `next dev` on http://localhost:3000. Stop it with Ctrl+C; `polyq stop` kills anything still running.

## What to copy into your own project

- `next.config.ts` — the only change your existing Next.js config needs is wrapping in `withPolyq()`.
- `polyq.config.ts` — drop in with your own `programs` + `workspace.devServer.command`.
- `.gitignore` entries: `generated/`, `target/`, `test-ledger/`, `.anchor/`.

### Before copying — fix the polyq dependency

This example uses `"polyq": "file:../.."` so `bun install` works against the in-repo source. When you copy the example **out** of the polyq monorepo, replace that line in `package.json` with a real semver range:

```diff
  "dependencies": {
-   "polyq": "file:../..",
+   "polyq": "^0.4.0",
    ...
  }
```

See [polyq docs](https://polyq.jxbt.xyz) for the full reference.

## Known gaps — you have to fill these in

This example is a wiring demo, not a drop-in product. Before shipping anything derived from it:

- **Program ID.** `Anchor.toml` and `programs/counter/src/lib.rs` both use `Fg6PaFp...`, Anchor's well-known placeholder. Run `anchor keys sync` once locally — it writes a real keypair to `target/deploy/counter-keypair.json` and patches both files. Commit the new ID, never the keypair.
- **Wallet.** The provider defaults to `~/.config/solana/id.json`. Create it with `solana-keygen new -o ~/.config/solana/id.json` if you don't already have one. Fund it on localnet automatically via `solana airdrop 100` once the validator is up.
- **`Cargo.lock`.** Not committed here because it's generated on first build. Run `anchor build` once and commit the `Cargo.lock` it produces.
- **`anchor.workspace.ts`.** The stub in the repo is empty. The Anchor TypeScript SDK populates this once your program is built and deployed; you can leave it empty for the `polyq dev` flow.
- **Your own init script.** `polyq.config.ts` doesn't wire `workspace.init` yet. Add one when you need PDA setup or airdrops beyond the validator genesis.
- **Database + Docker services.** Omitted here for brevity. Add `workspace.docker` and `workspace.database` to `polyq.config.ts` when your app needs them.

## Verification status

This example's TypeScript and polyq wiring are exercised by the framework test suite in the upstream repo. The `anchor build` + `polyq dev` end-to-end path has not been validated on every environment — if you hit a snag, please [open an issue](https://github.com/jynxbt/PolyQ/issues) with the failing step.
