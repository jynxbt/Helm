export interface HelmConfig {
  /** Project root directory (auto-detected from Anchor.toml) */
  root?: string

  /** Program definitions */
  programs?: Record<string, ProgramConfig>

  /** IDL sync configuration */
  idlSync?: IdlSyncConfig

  /** Codegen configuration */
  codegen?: CodegenConfig

  /** Polyfill configuration */
  polyfills?: PolyfillConfig

  /** Workspace orchestration (for `helm dev`) */
  workspace?: WorkspaceConfig
}

export interface ProgramConfig {
  /** Program type */
  type: 'anchor' | 'native'

  /** Path to the program directory (relative to root) */
  path: string

  /** Path to the IDL JSON file */
  idl?: string

  /** Program IDs per network */
  programId?: Record<string, string>

  /** Deployment config for native programs */
  deploy?: {
    keypair?: string
    binary?: string
  }
}

export interface IdlSyncConfig {
  /** Directory to watch for IDL changes (default: target/idl/) */
  watchDir?: string

  /** Map IDL name → destination paths */
  mapping?: Record<string, string[]>
}

export interface CodegenConfig {
  /** Output directory for generated TypeScript */
  outDir: string

  /** Which programs to generate clients for */
  programs?: string[]

  /** What to generate */
  features?: {
    types?: boolean
    instructions?: boolean
    accounts?: boolean
    pda?: boolean
    errors?: boolean
    events?: boolean
  }
}

export interface PolyfillConfig {
  /** Detection mode: 'auto' scans package.json, 'manual' uses explicit flags */
  mode?: 'auto' | 'manual'

  /** Explicit polyfill toggles (used when mode is 'manual') */
  buffer?: boolean
  global?: boolean
  process?: boolean
  crypto?: boolean
}

export interface WorkspaceConfig {
  /** Anchor build features */
  buildFeatures?: string[]

  /** Docker compose configuration */
  docker?: {
    enabled?: boolean
    compose?: string
    services?: string[]
  }

  /** Solana validator settings */
  validator?: {
    rpcUrl?: string
    flags?: string[]
    logFile?: string
  }

  /** Post-deploy initialization script */
  init?: {
    script: string
    runner?: string
  }

  /** Database configuration */
  database?: {
    url?: string
    migrationsDir?: string
    seed?: {
      script: string
      runner?: string
    }
  }

  /** Dev server to start after orchestration */
  devServer?: {
    command: string
    cwd?: string
  }

  /** Health check tuning */
  healthChecks?: {
    pollInterval?: number
    maxWait?: number
  }
}

export type ResolvedHelmConfig = Required<
  Pick<HelmConfig, 'root'>
> & HelmConfig

export function defineHelmConfig(config: HelmConfig): HelmConfig {
  return config
}
