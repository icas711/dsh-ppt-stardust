import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import * as model from '../skills/dsh-ppt/scripts/deck-model.mjs'
import * as fonts from '../skills/dsh-ppt/scripts/deck-fonts.mjs'
import { normalizeTextZones } from '../skills/dsh-ppt/scripts/deck-model.mjs'
import { validateTemplateManifest } from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import { normalizeDesignLayouts } from '../skills/dsh-ppt/scripts/deck-layouts.mjs'

const built = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
const fragment = built.match(/\/\/ BEGIN DSH_DECK_MODEL\n([\s\S]*?)\/\/ END DSH_DECK_MODEL/)?.[1]
assert.ok(fragment, 'Build must embed the actual shared model source')
const browser = runInNewContext(fragment + '\nDshDeckModel')
const result = (fn, value) => {
  try { return { value: JSON.stringify(fn(value)) } } catch (error) { return { error: error.message, name: error.name } }
}
const zone = () => ({ kind: 'body', x: 5.123456, y: 20, w: 80, h: 60,
  textStyle: { fontFamily: 'Liberation Sans', size: 18, bold: true, italic: false, color: '#cf1f2f' }, sourceTypeface: 'Liberation Sans ',
  scriptFonts: { eastAsian: '', complexScript: 'Liberation Sans' }, fontHints: { panose: '020B0604020202020204', charset: 204, pitchFamily: 34 },
  colorSpec: { base: '#cf1f2f', transforms: [{ name: 'lumMod', value: 99000 }] },
  textFrame: { align: 'right', anchor: 'top', autoFit: 'none', wrap: 'square', margins: { left: 0, right: 12700, top: 0, bottom: 0 }, lineSpacing: { kind: 'pct', value: 1.2 }, spaceAfter: 6 } })

test('font compatibility exports are bindings to the same pure model functions', () => {
  assert.equal(fonts.normalizeTextStyles, model.normalizeTextStyles)
  assert.equal(fonts.normalizeThemeFonts, model.normalizeThemeFonts)
  assert.equal(fonts.fontFamily, model.fontFamily)
  const source = readFileSync(new URL('../skills/dsh-ppt/scripts/deck-model.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /^\s*import\b/m)
  assert.doesNotMatch(source, /\b(?:Buffer|document|window|process)\./)
})

test('server and built browser model agree on valid zones, rounding and raw typeface aliases', () => {
  for (const input of [[], [zone()], [zone(), { kind: 'image', x: 0, y: 0, w: 100, h: 100 }]]) {
    assert.deepEqual(result(browser.normalizeTextZones, input), result(model.normalizeTextZones, input))
  }
  const input = zone(), normalized = normalizeTextZones([input])[0]
  assert.equal(input.x, 5.123456, 'Normalization must not mutate input')
  assert.equal(normalized.x, 5.123)
  assert.equal(normalized.sourceTypeface, 'Liberation Sans ')
  assert.equal(normalized.textStyle.color, '#CF1F2F')
})

test('server and built browser reject the same invalid geometry, styles and limits', () => {
  const cases = [null, {}, Array(7).fill(zone()), [{ ...zone(), x: -1 }], [{ ...zone(), x: NaN }], [{ ...zone(), w: '80' }], [{ ...zone(), h: '' }], [{ ...zone(), kind: 'unknown' }],
    [{ ...zone(), textStyle: { bold: 'true' } }], [{ ...zone(), textFrame: { align: 'elsewhere' } }], [{ ...zone(), colorSpec: { base: '#CF1F2F', transforms: [{ name: 'script', value: 1 }] } }]]
  for (const input of cases) {
    const expected = result(model.normalizeTextZones, input)
    assert.ok(expected.error)
    assert.deepEqual(result(browser.normalizeTextZones, input), expected)
  }
})

test('template validator, engine and editor use the same zone normalization and reject rather than clamp', () => {
  const raw = { id: 'layout', layoutType: 'content', images: [], textZones: [zone()] }
  const input = { schemaVersion: 2, id: 'shared-model', name: 'Shared model', style: { layouts: [raw] }, outline: [{ layout: 'bullets', title: 'Test', layoutId: 'layout' }] }
  const template = validateTemplateManifest(input).style.layouts[0].textZones
  const engine = normalizeDesignLayouts([raw], {}, () => { throw new Error('No assets expected') }, message => { throw new Error(message) })[0].textZones
  const editor = readFileSync(new URL('../templates/panels/template-editor.js', import.meta.url), 'utf8')
  const context = { DshDeckModel: browser, raw }
  const edited = JSON.parse(runInNewContext(editor + '\nJSON.stringify(tplCleanLayout(raw).textZones)', context))
  assert.deepEqual(template, engine); assert.deepEqual(edited, template)
  context.raw = { ...raw, textZones: [{ ...zone(), x: -1 }] }
  assert.throws(() => runInNewContext(editor + '\ntplCleanLayout(raw)', { DshDeckModel: browser, raw: context.raw }), /textZones.*x/)
  const invalid = { ...input, style: { layouts: [context.raw] } }
  const problem = runInNewContext(fragment + '\n' + editor + '\ntplStyleProblem(tplDraftFrom(input))', { input: invalid, languageOf: () => 'ru' })
  assert.match(problem, /style\.layouts\[0\]\.textZones\[0\]\.x/)
})
