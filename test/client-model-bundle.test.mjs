import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { bundleClientModel } from '../scripts/bundle-client-model.mjs'

test('model bundler follows aliases, reexports and nested static ES modules', t => {
  const root = mkdtempSync(join(tmpdir(), 'ppt-model-bundle-'))
  t.after(() => rmSync(root, {recursive:true,force:true}))
  mkdirSync(join(root, 'nested'))
  writeFileSync(join(root, 'leaf.mjs'), 'export const offset = 4; export default value => value * 3')
  writeFileSync(join(root, 'nested/bridge.mjs'), "export { offset as adjustment } from './local.mjs'")
  writeFileSync(join(root, 'nested/local.mjs'), 'export const offset = 7')
  writeFileSync(join(root, 'deck-model.mjs'), "import multiply, { offset as n } from './leaf.mjs'; import { adjustment } from './nested/bridge.mjs'; export function calculate(value) { return multiply(value) + n + adjustment }; export const text = 'export keywords in strings are retained'")
  const bundled = bundleClientModel(root)
  const browser = runInNewContext(bundled + '\nDshDeckModel')
  assert.equal(browser.calculate(5), 26)
  assert.equal(browser.text, 'export keywords in strings are retained')
  assert.ok(Object.isFrozen(browser))
  assert.doesNotMatch(bundled, /\beval\(/)
})

test('model bundler rejects external/dynamic imports, directory escapes, cycles and invalid syntax', t => {
  const root = mkdtempSync(join(tmpdir(), 'ppt-model-bundle-invalid-'))
  t.after(() => rmSync(root, {recursive:true,force:true}))
  for (const [source, pattern] of [
    ["import x from 'node:fs'; export const a = x", /local/],
    ["export * from '../outside.mjs'", /local/],
    ["export * from './nested/../../outside.mjs'", /escapes/],
    ["export const a = () => import('./leaf.mjs')", /static/],
    ["export const a = require('./leaf.mjs')", /static/],
    ["export const = ;", /syntax/],
  ]) {
    writeFileSync(join(root, 'deck-model.mjs'), source)
    assert.throws(() => bundleClientModel(root), pattern)
  }
  writeFileSync(join(root, 'deck-model.mjs'), "export * from './leaf.mjs'")
  writeFileSync(join(root, 'leaf.mjs'), "export * from './deck-model.mjs'")
  assert.throws(() => bundleClientModel(root), /cycle/)
})
