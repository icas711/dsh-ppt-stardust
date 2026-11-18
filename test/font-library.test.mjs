import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runInNewContext } from 'node:vm'
import { unzipSync } from 'fflate'
import { PptTemplateStore } from '../lib/templates.js'
import { PptWorkbench } from '../lib/workbench.js'
import * as templates from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import * as advanced from '../skills/dsh-ppt/scripts/deck-advanced.mjs'

const heading = readFileSync(new URL('./fixtures/fonts/DSH-Test-Heading.ttf', import.meta.url))
const body = readFileSync(new URL('./fixtures/fonts/DSH-Test-Body.ttf', import.meta.url))
const uri = bytes => 'data:font/ttf;base64,' + bytes.toString('base64')
const alice = { login: 'alice', local: false, admin: false }
const bob = { login: 'bob', local: false, admin: false }
const admin = { login: 'admin', local: false, admin: true }
const draft = id => ({ schemaVersion: 1, id, name: id, author: 'alice', style: { theme: 'data', textStyles: { title: { fontFamily: 'DSH Test Heading' } } }, outline: [{ layout: 'cover', title: '{{deck.title}}' }] })
async function withStore(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-font-library-'))
  const createStore = () => new PptTemplateStore({ root: join(dir, 'templates'), templatesModuleLoader: async () => templates })
  const store = createStore(), wb = new PptWorkbench({ catalogPath: join(dir, 'catalog.jsonl') })
  wb.attachTemplateStore(store)
  try { await fn({ dir, store, wb, createStore }) } finally { rmSync(dir, { recursive: true, force: true }) }
}
const upload = (wb, bytes = heading, identity = alice, variant = 'regular') => wb.action({ operation: 'template-font-upload', family: 'DSH Test Heading', variant, data: uri(bytes) }, undefined, identity)

test('uploads update only owner private and authored public templates, survive restart, and preserve old presentations', () => withStore(async ({ dir, store, wb, createStore }) => {
  const own = await store.save({ manifest: draft('own-template'), identity: alice })
  await store.save({ manifest: draft('own-public'), scope: 'public', identity: admin })
  const otherPublic = await store.save({ manifest: { ...draft('other-public'), author: 'bob' }, scope: 'public', identity: admin })
  const otherPrivate = await store.save({ manifest: draft('other-private'), identity: bob })
  const first = await upload(wb)
  assert.deepEqual(first.updated.map(item => item.key).sort(), ['public:own-public', 'user:own-template'])
  assert.equal((await store.get(own.key, alice)).manifest.revision, 2)
  assert.equal((await store.get(otherPublic.key, alice)).manifest.revision, 1)
  assert.equal((await store.get(otherPrivate.key, bob)).manifest.revision, 1)
  const options = await store.createOptions(own.key, alice, { title: 'Before replacement' })
  const deck = await advanced.buildDeckAsync({ ...options.create, outputDir: join(dir, 'old-deck') })
  const before = readFileSync(deck.pptxPath)
  const replacement = await upload(wb, body)
  assert.notEqual(first.font.file, replacement.font.file)
  for (const key of ['user:own-template', 'public:own-public']) {
    const record = await store.get(key, alice)
    assert.equal(record.manifest.revision, 3)
    assert.equal(record.manifest.style.fonts.length, 1)
    assert.deepEqual(record.assets[record.manifest.style.fonts[0].file].bytes, body)
    assert.equal(record.assets[first.font.file], undefined, 'old template asset is removed')
  }
  assert.deepEqual(readFileSync(deck.pptxPath), before)
  assert.equal(createStore().fontLibrary.list(alice)[0].file, replacement.font.file)
  assert.deepEqual(store.fontLibrary.list(bob), [])
}))

test('editor automatically fills missing faces, preview embeds bytes, save and PPTX export retain four variants', () => withStore(async ({ dir, store, wb }) => {
  for (const variant of ['regular', 'bold', 'italic', 'boldItalic']) await upload(wb, heading, alice, variant)
  const saved = await store.save({ manifest: draft('missing-fonts'), identity: alice })
  const opened = await wb.action({ operation: 'template-get', templateId: saved.key }, undefined, alice)
  assert.equal(opened.template.libraryFontsAdded, 4)
  assert.equal(opened.template.style.fonts.length, 4)
  assert.equal(Object.keys(opened.template.libraryUploads).length, 1, 'same font bytes are deduplicated')
  const input = { operation: 'template-preview', manifest: opened.template, baseKey: saved.key, uploads: opened.template.libraryUploads }
  const preview = await wb.action(input, undefined, alice)
  assert.equal((preview.html.match(/@font-face\{/g) ?? []).length, 4)
  await wb.action({ ...input, operation: 'template-save', expectedRevision: 1 }, undefined, alice)
  const again = await wb.action({ operation: 'template-get', templateId: saved.key }, undefined, alice)
  assert.equal(again.template.libraryFontsAdded, 0)
  const options = await store.createOptions(saved.key, alice, { title: 'Four faces' })
  const result = await advanced.buildDeckAsync({ ...options.create, outputDir: join(dir, 'export') })
  const parts = unzipSync(readFileSync(result.pptxPath))
  const presentation = Buffer.from(parts['ppt/presentation.xml']).toString('utf8')
  for (const variant of ['regular', 'bold', 'italic', 'boldItalic']) assert.match(presentation, new RegExp('<p:' + variant + ' r:id='))
  const bobCopy = await store.save({ manifest: draft('bob-missing'), identity: bob })
  assert.equal((await wb.action({ operation: 'template-get', templateId: bobCopy.key }, undefined, bob)).template.libraryFontsAdded, 0)
}))

test('PPTX import uses personal library and preserves existing embedded font files', () => withStore(async ({ dir, store, wb }) => {
  await upload(wb)
  const deck = await advanced.buildDeckAsync({ ...templates.templateCreateOptions(draft('source-deck'), {}, { title: 'Source' }).create, outputDir: join(dir, 'source') })
  const request = new Request('http://localhost/api/dsh-ppt/template-upload?templateId=from-pptx&name=Imported', { method: 'POST', headers: { 'x-dsh-ppt-action': '1' }, body: readFileSync(deck.pptxPath) })
  const response = await wb.fetchTemplateUpload(request, alice)
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.ok(result.report.fonts.library > 0)
  const imported = await store.get(result.key, alice)
  assert.deepEqual(imported.assets[imported.manifest.style.fonts[0].file].bytes, heading)
  const embedded = draft('has-embedded')
  embedded.style.fonts = [{ family: 'DSH Test Heading', variant: 'regular', file: 'original.ttf' }]
  const bound = await store.withLibraryFonts(embedded, templates.normalizeTemplateAssets({ 'original.ttf': body }), alice)
  assert.equal(bound.added, 0)
  assert.equal(bound.manifest.style.fonts[0].file, 'original.ttf')
}))

test('admin alone lists all owners and deletes library entries without changing saved templates', () => withStore(async ({ store, wb }) => {
  const first = await upload(wb)
  await upload(wb, body, bob)
  const saved = await store.saveDraft({ manifest: draft('keeps-font'), identity: alice })
  for (const identity of [alice, bob, { local: true, admin: false }]) {
    await assert.rejects(() => wb.action({ operation: 'template-font-list' }, undefined, identity), /администратор/)
    await assert.rejects(() => wb.action({ operation: 'template-font-delete', owner: 'alice', fontId: first.font.id }, undefined, identity), /администратор/)
  }
  const all = await wb.action({ operation: 'template-font-list' }, undefined, admin)
  assert.deepEqual(all.fonts.map(font => font.owner), ['alice', 'bob'])
  assert.ok(all.fonts.every(font => !('data' in font)))
  await wb.action({ operation: 'template-font-delete', owner: 'alice', fontId: first.font.id }, undefined, admin)
  assert.deepEqual(store.fontLibrary.list(alice), [])
  const after = await store.get(saved.key, alice)
  assert.equal(after.manifest.revision, saved.manifest.revision)
  assert.deepEqual(after.assets[first.font.file].bytes, heading)
  assert.equal(store.fontLibrary.list(bob).length, 1)
}))

test('invalid font input, paths, sizes and variants cannot change library or templates', () => withStore(async ({ dir, store, wb }) => {
  const saved = await store.save({ manifest: draft('untouched'), identity: alice })
  const secret = join(dir, 'secret.ttf'); writeFileSync(secret, heading)
  for (const patch of [
    { data: secret }, { data: uri(Buffer.from('invalid font')) },
    { data: uri(Buffer.alloc(12 * 1024 * 1024 + 1)) },
    { family: '../escape' }, { variant: 'unknown' },
    { data: 'data:font/otf;base64,' + heading.toString('base64') },
  ]) await assert.rejects(() => wb.action({ operation: 'template-font-upload', family: 'DSH Test Heading', variant: 'regular', data: uri(heading), ...patch }, undefined, alice))
  await assert.rejects(() => upload(wb, heading, { admin: true, local: true }), /вошедшим/)
  assert.deepEqual(store.fontLibrary.list(alice), [])
  assert.equal(existsSync(join(store.root, 'font-library')), false)
  assert.equal((await store.get(saved.key, alice)).manifest.revision, 1)
  await assert.rejects(() => wb.action({ operation: 'template-font-delete', owner: 'alice', fontId: '../escape' }, undefined, admin), /Недопустимый/)
}))

test('font replacement preflights aggregate template limits before changing any file', () => withStore(async ({ store, wb }) => {
  const old = await upload(wb)
  const padded = Buffer.concat([heading, Buffer.alloc(11 * 1024 * 1024)])
  const manifest = draft('near-limit')
  manifest.style.fonts = ['a', 'b', 'c'].map(name => ({ family: name, file: name + '.ttf' }))
  // Three separate 10 MiB assets fit; a fourth 11 MiB file would exceed the template budget.
  const ten = Buffer.concat([heading, Buffer.alloc(10 * 1024 * 1024 - heading.length)])
  await store.save({ manifest, assets: { 'a.ttf': ten, 'b.ttf': ten, 'c.ttf': ten }, identity: alice })
  await assert.rejects(() => upload(wb, padded), /32 MiB/)
  assert.equal(store.fontLibrary.list(alice)[0].file, old.font.file)
  assert.equal((await store.get('user:near-limit', alice)).manifest.revision, 1)
}))

test('font UI lists families from imported roles and layouts, exposes four accessible uploads, and replaces a face', () => {
  const context = { languageOf: () => 'ru', h: (type, props, ...children) => ({ type, props, children }) }
  runInNewContext(readFileSync(new URL('../templates/panels/template-editor.js', import.meta.url), 'utf8') + '\nthis.api = { tplDraftFrom, tplBuild, TplFontUploads, tplAttachFont };', context)
  const input = draft('ui-fonts'); input.style.layouts = [{ id: 'layout-font', layoutType: 'cover', images: [], textStyles: { subtitle: { fontFamily: 'DSH Test Body' } } }]
  const form = context.api.tplDraftFrom(input), calls = []
  const tree = context.api.TplFontUploads({ draft: form, disabled: false, onPick: (...args) => calls.push(args) })
  const inputs = []
  const visit = node => { if (Array.isArray(node)) return node.forEach(visit); if (!node || typeof node !== 'object') return; if (node.type === 'input') inputs.push(node); visit(node.children) }
  visit(tree)
  assert.equal(inputs.length, 8)
  const pick = inputs.find(node => node.props['aria-label'] === 'DSH Test Body — Полужирный курсив')
  const file = { name: 'body.ttf' }, target = { files: [file], value: 'body.ttf' }
  pick.props.onChange({ target })
  assert.deepEqual(calls[0], [file, 'DSH Test Body', 'boldItalic'])
  assert.equal(target.value, '')
  const face = { family: 'DSH Test Body', variant: 'boldItalic', file: 'new.ttf' }
  const updated = context.api.tplAttachFont(context.api.tplAttachFont(form, { ...face, file: 'old.ttf' }), face)
  assert.equal(updated.fonts.length, 1)
  assert.equal(context.api.tplBuild(updated, input).style.fonts[0].file, 'new.ttf')
})

test('simultaneous uploads retain all faces, and a 12 MiB TTF is accepted over the HTTP JSON carrier', () => withStore(async ({ store, wb }) => {
  await Promise.all(['regular', 'bold', 'italic', 'boldItalic'].map(variant => upload(wb, heading, alice, variant)))
  assert.equal(store.fontLibrary.list(alice).length, 4)
  const bytes = Buffer.concat([heading, Buffer.alloc(12 * 1024 * 1024 - heading.length)])
  const response = await wb.fetch(new Request('http://localhost/api/dsh-ppt/workbench', {
    method: 'POST', headers: { 'x-dsh-ppt-action': '1', 'content-type': 'application/json' },
    body: JSON.stringify({ operation: 'template-font-upload', family: 'DSH Test Heading', variant: 'regular', data: uri(bytes) }),
  }), alice)
  assert.equal(response.status, 200)
  assert.equal((await response.json()).font.size, bytes.length)
  assert.equal(store.fontLibrary.list(alice).length, 4)
}))
