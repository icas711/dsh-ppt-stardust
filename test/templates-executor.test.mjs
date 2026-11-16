// ppt_template executor + ppt_create.templateId + панельные операции шаблонов.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const engine = await import('../skills/dsh-ppt/scripts/deck-advanced.mjs')
const templatesModule = await import('../skills/dsh-ppt/scripts/deck-templates.mjs')
const { createPptExecutors, loadTemplatesModule } = await import('../lib/execution.js')
const { PptTemplateStore } = await import('../lib/templates.js')

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
const withTmp = (fn) => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-ppt-exec-'))
  try { return fn(dir) } finally { rmSync(dir, { recursive: true, force: true }) }
}
const ALICE = { login: 'alice', admin: false, local: false }
const ADMIN = { login: 'admin-bob', admin: true, local: false }
const aliceExec = { agent: { session: { header: { owner: 'alice' } } } }
const adminExec = { agent: { session: { header: { owner: 'admin-bob' } } } }

const setup = async (dir, { admins = [] } = {}) => {
  const store = new PptTemplateStore({
    root: join(dir, 'templates'),
    templatesModuleLoader: () => Promise.resolve(templatesModule),
    admins,
  })
  const executors = createPptExecutors(
    { outputDir: '', maxSlides: 60, defaultTheme: '', defaultLang: 'ru', admins },
    () => Promise.resolve(engine),
    { templateStore: store },
  )
  return { store, executors }
}
const saveTemplate = (store, identity, id, overrides = {}) => store.save({
  manifest: {
    schemaVersion: 1, id, name: 'Шаблон ' + id, revision: 1,
    style: { theme: 'velvet', brand: { primaryColor: '#101828', footer: 'Футер ' + id } },
    outline: [
      { layout: 'cover', title: '{{deck.title}}', subtitle: 'Заполнить: докладчик' },
      { layout: 'bullets', title: 'Раздел 1', bullets: ['Заполнить: факты'] },
    ],
    samples: [{ layout: 'bullets', title: 'Образец', bullets: ['Пример готовой страницы'] }],
    ...overrides,
  },
  assets: {}, identity,
})

test('ppt_create with templateId: outline+samples draft in template style', () => withTmp(async dir => {
  const { store, executors } = await setup(dir)
  await saveTemplate(store, ALICE, 'velvet-corp')
  const created = await executors.create({
    title: 'Квартальный отчёт', templateId: 'user:velvet-corp', lang: 'ru', outputDir: dir,
  }, aliceExec)
  assert.equal(created.theme, 'velvet')
  assert.equal(created.deliveryStatus, 'draft')
  const manifest = JSON.parse(readFileSync(created.jsonPath, 'utf8'))
  assert.deepEqual(manifest.template, { id: 'velvet-corp', revision: 1 })
  assert.equal(manifest.slides.length, 3) // 2 outline + 1 sample
  assert.equal(manifest.slides[0].title, 'Квартальный отчёт')
  assert.equal(manifest.brand.footer, 'Футер velvet-corp')
  assert.ok(manifest.slides.some(s => /Заполнить:/.test(s.title ?? '') || (s.bullets ?? []).some(b => /Заполнить:/.test(b))))
  // templateSamples=false убирает образцы
  const noSamples = await executors.create({ title: 'Без образцов', templateId: 'user:velvet-corp', templateSamples: false, lang: 'ru', outputDir: dir }, aliceExec)
  const noSamplesManifest = JSON.parse(readFileSync(noSamples.jsonPath, 'utf8'))
  assert.equal(noSamplesManifest.slides.length, 2)
}))

test('ppt_create templateId: unknown template and no-store degradation', () => withTmp(async dir => {
  const { executors } = await setup(dir)
  await assert.rejects(() => executors.create({ title: 'X', templateId: 'user:missing', lang: 'ru', outputDir: dir }, aliceExec), /не найден/)
  const bare = createPptExecutors({ outputDir: '', maxSlides: 60, defaultTheme: '', defaultLang: '', admins: [] }, () => Promise.resolve(engine))
  await assert.rejects(() => bare.create({ title: 'X', templateId: 'user:any', outputDir: dir }, aliceExec), /библиотека шаблонов недоступна/)
}))

test('ppt_template operations: list/get/save/delete/export/import/publish permissions', () => withTmp(async dir => {
  const { store, executors } = await setup(dir, { admins: ['admin-bob'] })
  await saveTemplate(store, ALICE, 'mine-only')
  // list видит только свои + builtin
  const listed = await executors.template({ operation: 'list', lang: 'ru' }, aliceExec)
  assert.equal(listed.ok, true)
  assert.ok(listed.templates.some(t => t.id === 'mine-only' && t.scope === 'user'))
  assert.ok(listed.scenarios.length >= 4)
  // carol не видит чужой личный
  const carolExec = { agent: { session: { header: { owner: 'carol' } } } }
  const carolList = await executors.template({ operation: 'list' }, carolExec)
  assert.ok(!carolList.templates.some(t => t.id === 'mine-only'))
  // get
  const got = await executors.template({ operation: 'get', templateId: 'user:mine-only' }, aliceExec)
  assert.equal(got.template.id, 'mine-only')
  // save с scope public у не-админа — отказ
  await assert.rejects(() => executors.template({ operation: 'save', manifest: { schemaVersion: 1, id: 'pub-attempt', name: 'X' }, scope: 'public' }, aliceExec), /администратор/)
  // импорт bundle: не-админ → user, админ с scope public → public
  const zip = templatesModule.buildTemplateBundle({
    schemaVersion: 1, id: 'bundled', name: 'Bundled',
    outline: [{ layout: 'cover', title: '{{deck.title}}' }],
  }, {})
  const imported = await executors.template({ operation: 'import', data: zip.toString('base64') }, aliceExec)
  assert.equal(imported.key, 'user:bundled')
  const importedPublic = await executors.template({ operation: 'import', data: zip.toString('base64'), scope: 'public' }, adminExec)
  assert.equal(importedPublic.key, 'public:bundled')
  // publish чужого: только админ с owner
  await assert.rejects(() => executors.template({ operation: 'publish', templateId: 'user:bundled' }, aliceExec), /администратор/)
  const published = await executors.template({ operation: 'publish', templateId: 'user:bundled', owner: 'alice' }, adminExec)
  assert.equal(published.key, 'public:bundled')
  // export в файл
  const exported = await executors.template({ operation: 'export', templateId: 'user:mine-only', outputDir: dir }, aliceExec)
  assert.ok(existsSync(exported.path))
  // delete
  await executors.template({ operation: 'delete', templateId: 'user:mine-only' }, aliceExec)
  const after = await executors.template({ operation: 'list' }, aliceExec)
  assert.ok(!after.templates.some(t => t.id === 'mine-only'))
}))

test('ppt_template create-from-project and create-from-pptx', () => withTmp(async dir => {
  const { store, executors } = await setup(dir)
  const deck = await executors.create({
    title: 'Исходный проект', lang: 'ru', outputDir: dir,
    brand: { primaryColor: '#234567', footer: 'ACME' },
    slides: [
      { layout: 'cover', title: 'Исходный проект' },
      { layout: 'bullets', title: 'Итоги', bullets: ['Пункт один'] },
      { layout: 'closing', title: 'Спасибо' },
    ],
  }, aliceExec)
  const fromProject = await executors.template({
    operation: 'create-from-project', deckPath: deck.jsonPath, newTemplateId: 'from-proj', name: 'Из проекта',
  }, aliceExec)
  assert.equal(fromProject.key, 'user:from-proj')
  assert.equal(fromProject.template.theme, deck.theme)
  // pptx: берём PPTX того же проекта как пример
  const fromPptx = await executors.template({
    operation: 'create-from-pptx', pptxPath: deck.pptxPath, newTemplateId: 'from-pptx', name: 'Из PPTX',
  }, aliceExec)
  assert.equal(fromPptx.key, 'user:from-pptx')
  assert.equal(fromPptx.template.brand.primaryColor, '#234567')
  assert.ok(fromPptx.template.outlineCount >= 3)
  // Создание из нового шаблона работает
  const recreated = await executors.create({ title: 'Воссозданная', templateId: 'user:from-proj', templateSamples: false, lang: 'ru', outputDir: dir }, aliceExec)
  const manifest = JSON.parse(readFileSync(recreated.jsonPath, 'utf8'))
  assert.equal(manifest.slides[0].title, 'Воссозданная')
}))

test('ppt_template apply-to-project: restyles in place and via saveAs', () => withTmp(async dir => {
  const { store, executors } = await setup(dir)
  await saveTemplate(store, ALICE, 'restyle-src')
  const deck = await executors.create({
    title: 'Редизайн цели', lang: 'ru', outputDir: dir,
    slides: [{ layout: 'cover', title: 'Редизайн цели' }, { layout: 'bullets', title: 'Часть', bullets: ['П'] }],
  }, aliceExec)
  const before = JSON.parse(readFileSync(deck.jsonPath, 'utf8'))
  const restyled = await executors.template({
    operation: 'apply-to-project', deckPath: deck.jsonPath, templateId: 'user:restyle-src',
  }, aliceExec)
  assert.equal(restyled.template.id, 'restyle-src')
  assert.equal(restyled.changed, true)
  const after = JSON.parse(readFileSync(deck.jsonPath, 'utf8'))
  assert.equal(after.theme, 'velvet')
  assert.equal(after.brand.footer, 'Футер restyle-src')
  assert.deepEqual(after.template, { id: 'restyle-src', revision: 1 })
  assert.deepEqual(after.slides.map(s => s.id), before.slides.map(s => s.id))
  // saveAs: отдельная копия
  const copy = await executors.template({
    operation: 'apply-to-project', deckPath: deck.jsonPath, templateId: 'user:restyle-src', saveAs: true,
  }, aliceExec)
  assert.ok(copy.files.json !== deck.jsonPath)
  // bundlePath без библиотеки
  const zipPath = templatesModule.writeTemplateBundle(dir, {
    schemaVersion: 1, id: 'bundle-src', name: 'Bundle',
    style: { theme: 'bold', brand: { primaryColor: '#334455' } },
    outline: [{ layout: 'cover', title: '{{deck.title}}' }],
  }, {})
  const viaBundle = await executors.template({
    operation: 'apply-to-project', deckPath: deck.jsonPath, bundlePath: zipPath.path, expectedRevision: restyled.revision,
  }, aliceExec)
  assert.equal(viaBundle.template.id, 'bundle-src')
  const bundleStyled = JSON.parse(readFileSync(deck.jsonPath, 'utf8'))
  assert.equal(bundleStyled.theme, 'bold')
}))

test('workbench template operations honor the cookie identity', () => withTmp(async dir => {
  const { store } = await setup(dir)
  const { PptWorkbench } = await import('../lib/workbench.js')
  const wb = new PptWorkbench({ catalogPath: join(dir, 'projects.jsonl') })
  wb.attachTemplateStore(store)
  const alice = { login: 'alice', admin: false, local: false }
  const admin = { login: 'root', admin: true, local: false }
  await saveTemplate(store, alice, 'wb-tpl')
  // list: свои видны, админ виден флаг
  const listed = await wb.action({ operation: 'template-list' }, undefined, alice)
  assert.equal(listed.ok, true)
  assert.equal(listed.admin, false)
  assert.ok(listed.templates.some(t => t.id === 'wb-tpl'))
  // import пользователем в user; в public — отказ
  const zip = templatesModule.buildTemplateBundle({
    schemaVersion: 1, id: 'wb-imp', name: 'WB', outline: [{ layout: 'cover', title: 'T' }],
  }, {})
  const imported = await wb.action({ operation: 'template-import', data: Buffer.from(zip).toString('base64') }, undefined, alice)
  assert.equal(imported.key, 'user:wb-imp')
  await assert.rejects(() => wb.action({ operation: 'template-import', data: Buffer.from(zip).toString('base64'), scope: 'public' }, undefined, alice), /администратор/)
  await wb.action({ operation: 'template-import', data: Buffer.from(zip).toString('base64'), scope: 'public' }, undefined, admin)
  // publish не-админом — отказ
  await assert.rejects(() => wb.action({ operation: 'template-publish', templateId: 'user:wb-tpl' }, undefined, alice), /администратор/)
  // delete общий не-админом — отказ
  await assert.rejects(() => wb.action({ operation: 'template-delete', templateId: 'public:wb-imp' }, undefined, alice), /администратор/)
  // Без store — внятная ошибка
  const wb2 = new PptWorkbench({ catalogPath: join(dir, 'projects.jsonl') })
  await assert.rejects(() => wb2.action({ operation: 'template-list' }, undefined, alice), /недоступна/)
}))

test('workbench template-apply creates a draft deck in the data dir and registers it', () => withTmp(async dir => {
  const { store } = await setup(dir)
  const { PptWorkbench } = await import('../lib/workbench.js')
  const wb = new PptWorkbench({ catalogPath: join(dir, 'projects.jsonl') })
  wb.attachTemplateStore(store)
  const alice = { login: 'alice', admin: false, local: false }
  await saveTemplate(store, alice, 'apply-tpl')
  const result = await wb.action({ operation: 'template-apply', templateId: 'user:apply-tpl', title: 'Новая из панели', lang: 'ru' }, undefined, alice)
  assert.equal(result.ok, true)
  assert.deepEqual(result.createdFrom, { id: 'apply-tpl', revision: 1 })
  assert.ok(existsSync(result.project.path))
  // Зарегистрирован в каталоге проектов
  const catalog = await wb.action({ operation: 'list' })
  assert.ok(catalog.projects.some(p => p.path === result.project.path))
  // Черновик: в качествеquality есть template-unfilled
  assert.ok(result.project.quality.issues.some(issue => issue.code === 'template-unfilled'))
}))

test('workbench download kind=template returns a zip of the template', () => withTmp(async dir => {
  const { store } = await setup(dir)
  const { PptWorkbench } = await import('../lib/workbench.js')
  const wb = new PptWorkbench({ catalogPath: join(dir, 'projects.jsonl') })
  wb.attachTemplateStore(store)
  const alice = { login: 'alice', admin: false, local: false }
  await saveTemplate(store, alice, 'dl-tpl')
  const request = new Request(`http://localhost/api/dsh-ppt/download?kind=template&id=${encodeURIComponent('user:dl-tpl')}`, { headers: { 'sec-fetch-site': 'same-origin' } })
  const response = await wb.fetchDownload(request, alice)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'application/zip')
  const bytes = Buffer.from(await response.arrayBuffer())
  const read = templatesModule.readTemplateZip(bytes)
  assert.equal(read.manifest.id, 'dl-tpl')
  // Чужой личный не отдаётся
  const carol = { login: 'carol', admin: false, local: false }
  const denied = new Request(`http://localhost/api/dsh-ppt/download?kind=template&id=${encodeURIComponent('user:dl-tpl')}`, { headers: { 'sec-fetch-site': 'same-origin' } })
  const deniedResponse = await wb.fetchDownload(denied, carol)
  assert.equal(deniedResponse.status, 400)
}))
