import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const runner = fileURLToPath(new URL('../scripts/golden-pptx-synthetic.mjs', import.meta.url))
test('mandatory synthetic renderer fails and publishes a diagnostic when runtime is absent', t => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-synthetic-missing-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const output = join(dir, 'artifacts')
  const result = spawnSync(process.execPath, [runner], { env: { ...process.env, DSH_PPT_RENDER_RUNTIME: join(dir, 'missing-runtime'), DSH_PPT_SYNTHETIC_OUT: output }, encoding: 'utf8', timeout: 10000 })
  assert.equal(result.error, undefined)
  assert.notEqual(result.status, 0)
  const diagnostic = JSON.parse(readFileSync(join(output, 'failure.json'), 'utf8'))
  assert.match(diagnostic.message, /libreoffice-kit/)
  assert.equal(existsSync(join(output, 'metrics.json')), false)
})

test('CI cannot silently record replacement golden baselines', () => {
  const result = spawnSync(process.execPath, [runner, '--record'], { env: { ...process.env, CI: 'true' }, encoding: 'utf8', timeout: 10000 })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /CI cannot approve/)
})
