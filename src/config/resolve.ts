import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'pathe'
import type { HelmConfig, ProgramConfig, ResolvedHelmConfig } from './types'

/**
 * Resolve a HelmConfig by auto-detecting values from the project.
 * Reads Anchor.toml for program definitions and package.json for dependencies.
 */
export function resolveConfig(
  config: HelmConfig,
  cwd: string,
): ResolvedHelmConfig {
  const root = config.root ? resolve(cwd, config.root) : findProjectRoot(cwd)

  const programs = config.programs ?? detectProgramsFromAnchor(root)

  return {
    ...config,
    root,
    programs,
    idlSync: {
      watchDir: resolve(root, 'target/idl'),
      ...config.idlSync,
    },
  }
}

/**
 * Walk up from cwd looking for Anchor.toml to determine project root.
 */
function findProjectRoot(cwd: string): string {
  let dir = cwd
  while (dir !== dirname(dir)) {
    if (existsSync(resolve(dir, 'Anchor.toml'))) return dir
    dir = dirname(dir)
  }
  return cwd
}

/**
 * Parse Anchor.toml to extract program definitions.
 * Handles the TOML format: [programs.localnet] / [programs.devnet] sections.
 */
export function detectProgramsFromAnchor(
  root: string,
): Record<string, ProgramConfig> | undefined {
  const anchorPath = resolve(root, 'Anchor.toml')
  if (!existsSync(anchorPath)) return undefined

  const content = readFileSync(anchorPath, 'utf-8')
  const programs: Record<string, ProgramConfig> = {}

  // Parse [programs.*] sections for program IDs
  const programIdsByNetwork: Record<string, Record<string, string>> = {}
  const programSectionRe = /\[programs\.(\w+)\]\s*\n([\s\S]*?)(?=\n\[|\n*$)/g
  let match

  while ((match = programSectionRe.exec(content)) !== null) {
    const network = match[1]
    const body = match[2]
    const kvRe = /^(\w+)\s*=\s*"([^"]+)"/gm
    let kv
    while ((kv = kvRe.exec(body)) !== null) {
      const name = kv[1]
      const id = kv[2]
      if (!programIdsByNetwork[name]) programIdsByNetwork[name] = {}
      programIdsByNetwork[name][network] = id
    }
  }

  // Parse workspace members to find program paths
  const workspaceRe = /\[workspace\]\s*\n[\s\S]*?members\s*=\s*\[([\s\S]*?)\]/
  const workspaceMatch = workspaceRe.exec(content)
  const memberPaths: string[] = []
  if (workspaceMatch) {
    const membersStr = workspaceMatch[1]
    const memberRe = /"([^"]+)"/g
    let m
    while ((m = memberRe.exec(membersStr)) !== null) {
      memberPaths.push(m[1])
    }
  }

  // Build program configs
  for (const [name, ids] of Object.entries(programIdsByNetwork)) {
    const camelName = snakeToCamel(name)
    const programPath = memberPaths.find(p => p.includes(name.replace(/_/g, '-')))

    programs[camelName] = {
      type: 'anchor',
      path: programPath ?? `programs/${name.replace(/_/g, '-')}`,
      idl: `target/idl/${name}.json`,
      programId: ids,
    }
  }

  return Object.keys(programs).length > 0 ? programs : undefined
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}
