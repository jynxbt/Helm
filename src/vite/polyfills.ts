import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'pathe'
import type { Plugin } from 'vite'
import type { PolyfillConfig } from '../config/types'

/** Known Solana ecosystem packages that require polyfills */
const SOLANA_PACKAGES = [
  '@solana/web3.js',
  '@coral-xyz/anchor',
  '@coral-xyz/borsh',
  '@solana/spl-token',
  '@solana/kit',
  '@metaplex-foundation/umi',
  'tweetnacl',
  'bs58',
]

/** Packages that should be pre-bundled to avoid ESM/CJS issues */
const OPTIMIZE_DEPS = [
  'buffer',
  '@coral-xyz/anchor',
  'bn.js',
  '@solana/web3.js',
  'bs58',
]

/**
 * Detect which Solana packages are installed by reading package.json deps.
 */
function detectSolanaPackages(root: string): string[] {
  const pkgPath = resolve(root, 'package.json')
  if (!existsSync(pkgPath)) return []

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    }
    return SOLANA_PACKAGES.filter(p => p in allDeps)
  } catch {
    return []
  }
}

/**
 * Vite plugin that auto-configures polyfills required for Solana libraries.
 *
 * Detects Solana packages in your dependencies and sets up:
 * - `global` → `globalThis` (Node global in browser)
 * - `buffer` alias → npm `buffer` package
 * - `optimizeDeps` for pre-bundling Solana deps
 *
 * Respects SSR context — polyfills only apply to client builds.
 */
export function helmPolyfills(options?: PolyfillConfig): Plugin {
  let detectedPackages: string[] = []

  return {
    name: 'helm:polyfills',
    enforce: 'pre',

    config(userConfig, env) {
      const root = userConfig.root ?? process.cwd()
      const mode = options?.mode ?? 'auto'

      if (mode === 'auto') {
        detectedPackages = detectSolanaPackages(root)
        if (detectedPackages.length === 0) return
      }

      // Only apply polyfills for client-side builds
      // Node.js already has Buffer, global, crypto natively
      const isSSR = env.isSsrBuild ?? false
      if (isSSR) return

      const needsBuffer = mode === 'manual' ? (options?.buffer ?? true) : true
      const needsGlobal = mode === 'manual' ? (options?.global ?? true) : true

      const define: Record<string, string> = {}
      const alias: Record<string, string> = {}
      const include: string[] = []

      if (needsGlobal) {
        define['global'] = 'globalThis'
      }

      if (needsBuffer) {
        alias['buffer'] = 'buffer/'
        include.push('buffer')
      }

      // Add detected Solana packages to optimizeDeps
      for (const pkg of OPTIMIZE_DEPS) {
        if (!include.includes(pkg)) {
          include.push(pkg)
        }
      }

      return {
        define,
        resolve: {
          alias,
        },
        optimizeDeps: {
          include,
        },
      }
    },
  }
}
