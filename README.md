# Helm

Vite for Solana. IDL sync, polyfills, codegen, and workspace orchestration.

## Install

```bash
npm install solana-helm
```

## Vite Plugin

```ts
// vite.config.ts
import { helmVite } from 'solana-helm/vite'

export default defineConfig({
  plugins: [helmVite()]
})
```

Zero-config. Detects Solana dependencies and auto-configures:
- `global` → `globalThis`
- `buffer` alias → npm `buffer` package
- `optimizeDeps` for pre-bundling Anchor, web3.js, bn.js

### With IDL Sync

```ts
plugins: [
  helmVite({
    idlSync: {
      watchDir: 'target/idl',
      mapping: {
        my_program: ['packages/sdk/src/idl.json'],
      },
    },
  })
]
```

Run `anchor build` and your frontend picks up the new IDL via HMR. No manual copying, no page refresh.

## Nuxt Module

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['solana-helm/nuxt'],
  helm: {
    idlSync: {
      mapping: {
        my_program: ['packages/sdk/src/idl.json'],
      },
    },
  },
})
```

## CLI

```bash
# Generate TypeScript client from Anchor IDLs
helm codegen
helm codegen --idl target/idl/my_program.json --out generated/
helm codegen --watch

# Initialize config
helm init

# Smart workspace (coming soon)
helm dev
helm stop
```

## Codegen

Generates from Anchor IDLs:
- **Types** — TypeScript interfaces from IDL type definitions
- **PDAs** — `deriveFoo()` functions from IDL seed definitions
- **Instructions** — `createFooInstruction()` builders with typed accounts and args
- **Accounts** — Discriminator constants and fetch stubs
- **Errors** — Error enum and lookup function

```ts
import { generateFromIdl } from 'solana-helm/codegen'

generateFromIdl('target/idl/my_program.json', 'generated/')
```

## Config

```ts
// helm.config.ts
import { defineHelmConfig } from 'solana-helm'

export default defineHelmConfig({
  programs: {
    // Auto-detected from Anchor.toml
    myNativeProgram: {
      type: 'native',
      path: 'programs/my-native-program',
      idl: 'programs/my-native-program/idl.json',
    },
  },
  idlSync: {
    mapping: {
      my_program: ['packages/sdk/src/idl.json'],
    },
  },
  codegen: {
    outDir: 'generated',
    programs: ['myProgram'],
  },
})
```

## License

MIT
