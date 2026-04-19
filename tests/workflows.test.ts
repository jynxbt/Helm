import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'pathe'
import { describe, expect, it } from 'vitest'

/**
 * Regression guard for the release workflow's provenance wiring.
 *
 * OIDC trusted publishing requires `permissions.id-token: write` at the
 * job level, plus `NPM_CONFIG_PROVENANCE: 'true'` in the publish step's
 * env. Any of these being accidentally deleted (merge conflict, editor
 * autoformat, a reviewer's drive-by cleanup) silently breaks attestation
 * without failing the publish itself — nobody notices until someone
 * runs `npm view polyq --json | jq .dist.attestations` and sees null.
 *
 * Grep-level checks beat "we'll remember" every time.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')
const RELEASE_YML = resolve(REPO_ROOT, '.github/workflows/release.yml')

describe('release.yml provenance wiring', () => {
  const yaml = readFileSync(RELEASE_YML, 'utf-8')

  it('declares id-token: write at job scope', () => {
    // The job-level `permissions:` block must include `id-token: write`
    // for GitHub's OIDC handshake with npm to succeed.
    expect(yaml).toMatch(/id-token:\s*write/)
  })

  it('declares contents: write + pull-requests: write for the changesets action', () => {
    expect(yaml).toMatch(/contents:\s*write/)
    expect(yaml).toMatch(/pull-requests:\s*write/)
  })

  it('sets NPM_CONFIG_PROVENANCE on the changesets step env', () => {
    expect(yaml).toMatch(/NPM_CONFIG_PROVENANCE:\s*['"]?true['"]?/)
  })

  it('keeps top-level permissions least-privilege', () => {
    // Workflow-level `permissions:` should default to `contents: read`.
    // Job-level grants are additive and explicit.
    expect(yaml).toMatch(/^permissions:\s*\n\s+contents:\s*read/m)
  })
})
