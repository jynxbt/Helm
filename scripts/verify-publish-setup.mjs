#!/usr/bin/env node
// Preflight check for `npm publish`. Verifies the static requirements for
// OIDC provenance attestation and the basics of the package manifest. Runs
// via `prepublishOnly` so any failure aborts before we hit the registry.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')

const pkg = JSON.parse(readFileSync(resolve(REPO, 'package.json'), 'utf-8'))

const failures = []
const warnings = []

function fail(msg) {
  failures.push(msg)
}
function warn(msg) {
  warnings.push(msg)
}

// --- OIDC provenance requirements -----------------------------------------
if (pkg.publishConfig?.provenance !== true) {
  fail('publishConfig.provenance must be `true` for OIDC attestation.')
}
if (!pkg.repository?.url) {
  fail('package.json.repository.url is required — OIDC uses it to build the claim.')
} else if (!/^https?:\/\/|^git\+/.test(pkg.repository.url)) {
  warn(`package.json.repository.url "${pkg.repository.url}" looks malformed.`)
}
if (!pkg.repository?.type) {
  warn('package.json.repository.type is missing (expected "git").')
}

// --- Basic manifest hygiene -----------------------------------------------
if (!Array.isArray(pkg.files) || pkg.files.length === 0) {
  fail('package.json.files is empty — `npm publish` would ship everything.')
}
if (!pkg.main && !pkg.exports) {
  fail('package.json needs either `main` or `exports` for consumers to import.')
}
if (!pkg.license) {
  fail('package.json.license is required.')
}
if (pkg.private === true) {
  fail('package.json.private is `true` — registry will refuse the publish.')
}

// --- Version sanity -------------------------------------------------------
const version = pkg.version
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/.test(version)) {
  fail(`package.json.version "${version}" is not valid semver.`)
}

// --- Report ---------------------------------------------------------------
for (const w of warnings) {
  process.stderr.write(`⚠ ${w}\n`)
}
if (failures.length > 0) {
  process.stderr.write(`\n✘ ${failures.length} publish-setup check(s) failed:\n`)
  for (const f of failures) process.stderr.write(`  - ${f}\n`)
  process.stderr.write(
    '\nFix the above before running `npm publish`.\n' +
      'After a successful publish, verify the OIDC attestation with:\n\n' +
      `  npm view ${pkg.name} --json | jq '.dist.attestations, .dist.integrity'\n\n` +
      '`.dist.attestations.url` should be a non-null npm registry URL.\n',
  )
  process.exit(1)
}

process.stdout.write(`✓ publish setup OK for ${pkg.name}@${pkg.version}\n`)
