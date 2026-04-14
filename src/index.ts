// Polyq — DX toolkit for Solana and EVM
// Polyfills, schema sync, codegen, and workspace orchestration

export { definePolyqConfig } from './config/types'
export type {
  PolyqConfig,
  ProgramConfig,
  SchemaSyncConfig,
  IdlSyncConfig,
  CodegenConfig,
  PolyfillConfig,
  WorkspaceConfig,
  ChainFamily,
  ProgramType,
} from './config/types'

// Chain detection
export { detectChain, getChainProvider, findProjectRoot } from './chains'
export type { ChainProvider, ChainDetectionResult } from './chains/types'

// Core (shared detection)
export { detectSolanaPackages, detectChainPackages, resolvePolyfillNeeds, SOLANA_PACKAGES, OPTIMIZE_DEPS } from './core/detect'

// Vite plugin (React, Svelte, SvelteKit, Remix, Nuxt, etc.)
export { polyqVite } from './adapters/vite/index'
export { polyqPolyfills } from './adapters/vite/polyfills'
export { polyqIdlSync } from './adapters/vite/idl-sync'

// Webpack plugin (Next.js, CRA, etc.)
export { polyqWebpack } from './adapters/webpack/polyfills'

// Codegen
export { generateFromSchema, generateFromIdl } from './codegen/generate'

// Config
export { loadConfig } from './config/loader'

// Workspace
export { buildStages, runStages, stopStages, checkStages } from './workspace/orchestrator'
