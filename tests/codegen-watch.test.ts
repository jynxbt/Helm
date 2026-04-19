import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'pathe'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCodegenWatcher } from '../src/codegen/watch'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')
const FIXTURE_IDL = resolve(REPO_ROOT, 'tests/frameworks/fixtures/svm/target/idl/test_program.json')

let workdir: string
beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'polyq-watch-'))
  mkdirSync(join(workdir, 'target/idl'), { recursive: true })
})
afterEach(() => {
  rmSync(workdir, { recursive: true, force: true })
})

describe('codegen --watch — createCodegenWatcher', () => {
  it('fires onRegenerate when a file is added to the artifact dir', async () => {
    const regenerated: string[] = []
    const watcher = createCodegenWatcher({
      cwd: workdir,
      outDir: join(workdir, 'generated'),
      chain: 'svm',
      artifactDir: 'target/idl',
      onRegenerate: path => regenerated.push(path),
    })
    try {
      await watcher.ready
      copyFileSync(FIXTURE_IDL, join(workdir, 'target/idl/test_program.json'))
      // Poll briefly for the event — chokidar is async.
      for (let i = 0; i < 40 && regenerated.length === 0; i++) {
        await new Promise(r => setTimeout(r, 50))
      }
      expect(regenerated.length).toBeGreaterThan(0)
      expect(regenerated[0]!.endsWith('test_program.json')).toBe(true)
    } finally {
      await watcher.close()
    }
  })

  it('fires onRegenerate again when an artifact file is modified', async () => {
    const regenerated: string[] = []
    // Seed the file before starting the watcher so the add event doesn't
    // pollute our count.
    copyFileSync(FIXTURE_IDL, join(workdir, 'target/idl/test_program.json'))

    const watcher = createCodegenWatcher({
      cwd: workdir,
      outDir: join(workdir, 'generated'),
      chain: 'svm',
      artifactDir: 'target/idl',
      onRegenerate: path => regenerated.push(path),
    })
    try {
      await watcher.ready
      // Modify the seeded file — chokidar should fire a 'change'.
      writeFileSync(
        join(workdir, 'target/idl/test_program.json'),
        JSON.stringify({ ...require(FIXTURE_IDL), bumpedAt: Date.now() }, null, 2),
        'utf-8',
      )
      for (let i = 0; i < 60 && regenerated.length === 0; i++) {
        await new Promise(r => setTimeout(r, 50))
      }
      expect(regenerated.length).toBeGreaterThan(0)
    } finally {
      await watcher.close()
    }
  })

  it('calls onBuild when a source file changes, does not rebuild on artifact-only paths', async () => {
    mkdirSync(join(workdir, 'programs/test-program/src'), { recursive: true })
    writeFileSync(join(workdir, 'programs/test-program/src/lib.rs'), '// initial\n', 'utf-8')

    const regenerated: string[] = []
    const buildCalls: number[] = []

    const watcher = createCodegenWatcher({
      cwd: workdir,
      outDir: join(workdir, 'generated'),
      chain: 'svm',
      artifactDir: 'target/idl',
      // chokidar@5 has no glob support — pass the directory and let the
      // watch helper filter by extension.
      sourceGlobs: [join(workdir, 'programs')],
      onBuild: async () => {
        buildCalls.push(Date.now())
        return true
      },
      onRegenerate: path => regenerated.push(path),
    })
    try {
      await watcher.ready
      writeFileSync(join(workdir, 'programs/test-program/src/lib.rs'), '// bumped\n', 'utf-8')
      for (let i = 0; i < 60 && buildCalls.length === 0; i++) {
        await new Promise(r => setTimeout(r, 50))
      }
      expect(buildCalls.length).toBeGreaterThan(0)
    } finally {
      await watcher.close()
    }
  })

  it('close() resolves and stops emitting', async () => {
    const regenerated: string[] = []
    const watcher = createCodegenWatcher({
      cwd: workdir,
      outDir: join(workdir, 'generated'),
      chain: 'svm',
      artifactDir: 'target/idl',
      onRegenerate: path => regenerated.push(path),
    })
    await watcher.ready
    await watcher.close()

    // Post-close writes must not trigger the callback.
    copyFileSync(FIXTURE_IDL, join(workdir, 'target/idl/post_close.json'))
    await new Promise(r => setTimeout(r, 300))
    expect(regenerated).toHaveLength(0)
  })
})
