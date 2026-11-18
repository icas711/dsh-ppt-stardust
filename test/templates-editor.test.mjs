// Редактор шаблонов: HTML-превью без PPTX, перекрытие встроенных общей копией, слияние ассетов,
// права на правку, дублирование и операции панели (template-get/save/preview/duplicate/create-from-project).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, existsSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { PptTemplateStore } = await import('../lib/templates.js')
const { PptWorkbench } = await import('../lib/workbench.js')
const templates = await import('../skills/dsh-ppt/scripts/deck-templates.mjs')
const advanced = await import('../skills/dsh-ppt/scripts/deck-advanced.mjs')

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
const PNG_URI = 'data:image/png;base64,' + PNG.toString('base64')
const withTmp = fn => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-ppt-editor-'))
  const done = () => rmSync(dir, { recursive: true, force: true })
  try { const result = fn(dir); return result?.then ? result.finally(done) : (done(), result) } catch (error) { done(); throw error }
}
const alice = { login: 'alice', admin: false, local: false }
const admin = { login: 'admin-bob', admin: true, local: false }
const manifest = (id, overrides = {}) => ({
  schemaVersion: 1, id, name: 'Шаблон ' + id, revision: 1,
  style: { theme: 'data', brand: { primaryColor: '#102030', footer: 'ООО Ромашка' } },
  outline: [{ layout: 'cover', title: '{{deck.title}}' }],
  ...overrides,
})
function makeStore(dir, { builtin = [] } = {}) {
  const builtinDir = join(dir, 'builtin')
  for (const id of builtin) {
    mkdirSync(join(builtinDir, id), { recursive: true })
    writeFileSync(join(builtinDir, id, 'template.json'), JSON.stringify(manifest(id, { name: 'Встроенный ' + id })))
  }
  return new PptTemplateStore({ root: join(dir, 'templates'), builtinDir, templatesModuleLoader: () => Promise.resolve(templates) })
}

test('previewDeckHtml renders a template as HTML only: brand, footer, logo and backgrounds, no files', () => {
  const assets = templates.normalizeTemplateAssets({ 'logo.png': PNG, 'bg-cover.png': PNG })
  const draft = manifest('preview-me', {
    style: {
      theme: 'data', brand: { primaryColor: '#AA3355', footer: 'Мой футер', logo: 'logo.png' },
      backgrounds: [{ layoutType: 'cover', image: 'bg-cover.png', fit: 'cover' }],
    },
  })
  const options = templates.templatePreviewOptions(draft, assets, { lang: 'ru' })
  const result = advanced.previewDeckHtml(options)
  assert.equal(result.ok, true)
  assert.equal(result.slideCount, 5)
  assert.match(result.html, /Мой футер/)
  assert.match(result.html, /#AA3355/i)
  assert.ok(result.html.includes('data:image/png;base64,'), 'logo and background are embedded')
  assert.match(result.html, /Предпросмотр шаблона/)
})

test('previewDeckHtml rejects a broken colour instead of rendering it', () => {
  const draft = manifest('bad-colour', { style: { theme: 'data', brand: { primaryColor: 'red' } } })
  assert.throws(() => templates.templatePreviewOptions(draft, {}, { lang: 'ru' }))
})

test('an admin copy overrides the built-in template of the same id; deleting it restores the original', () => withTmp(async dir => {
  const store = makeStore(dir, { builtin: ['corp'] })
  const before = await store.list(alice)
  assert.deepEqual(before.map(t => [t.key, t.readonly]), [['builtin:corp', true]])

  // Обычный пользователь править встроенный не может, админ — может
  const builtin = await store.get('builtin:corp', admin)
  assert.deepEqual(store.access(builtin, alice), { canEdit: false, saveScope: 'public', overridesBuiltin: true })
  assert.deepEqual(store.access(builtin, admin), { canEdit: true, saveScope: 'public', overridesBuiltin: true })
  await assert.rejects(() => store.saveDraft({ manifest: manifest('corp', { name: 'Хак' }), baseKey: 'builtin:corp', scope: 'public', identity: alice }), /администратор/)

  const saved = await store.saveDraft({ manifest: manifest('corp', { name: 'Корпоративный v2' }), baseKey: 'builtin:corp', scope: 'public', identity: admin })
  assert.equal(saved.key, 'public:corp')
  assert.equal(saved.manifest.revision, 2, 'the override continues the built-in revision history')

  const after = await store.list(alice)
  assert.equal(after.length, 1, 'the built-in entry is hidden behind its override')
  assert.equal(after[0].key, 'public:corp')
  assert.equal(after[0].overridesBuiltin, true)
  assert.equal(after[0].name, 'Корпоративный v2')
  // Старый ключ builtin:corp везде ведёт на перекрытие (apply / restyle)
  assert.equal((await store.get('builtin:corp', alice)).manifest.name, 'Корпоративный v2')

  await store.delete('public:corp', admin)
  const restored = await store.list(alice)
  assert.deepEqual(restored.map(t => [t.key, t.name]), [['builtin:corp', 'Встроенный corp']])
  assert.equal((await store.get('builtin:corp', alice)).manifest.name, 'Встроенный corp')
}))

test('saveDraft keeps unchanged assets from the base, takes uploads, drops unreferenced images', () => withTmp(async dir => {
  const store = makeStore(dir)
  const withLogo = manifest('logo-tpl', { style: { theme: 'data', brand: { logo: 'logo.png' } } })
  const first = await store.saveDraft({ manifest: withLogo, uploads: { 'logo.png': PNG_URI }, scope: 'user', identity: alice })
  assert.deepEqual(Object.keys(first.assets), ['logo.png'])

  // Правка без новых файлов: логотип берётся из сохранённого шаблона
  const second = await store.saveDraft({ manifest: { ...withLogo, name: 'Новое имя' }, baseKey: 'user:logo-tpl', scope: 'user', expectedRevision: first.manifest.revision, identity: alice })
  assert.deepEqual(Object.keys(second.assets), ['logo.png'])
  assert.equal(second.manifest.name, 'Новое имя')
  assert.equal(second.manifest.revision, 2)

  // Логотип убран из манифеста — файл не остаётся на диске
  const third = await store.saveDraft({ manifest: manifest('logo-tpl'), baseKey: 'user:logo-tpl', scope: 'user', identity: alice })
  assert.deepEqual(Object.keys(third.assets), [])
  assert.equal(existsSync(join(dir, 'templates', 'users', 'alice', 'logo-tpl', 'assets', 'logo.png')), false)
}))

test('saveDraft refuses a stale revision and fills the author for personal templates', () => withTmp(async dir => {
  const store = makeStore(dir)
  const first = await store.saveDraft({ manifest: manifest('race'), scope: 'user', identity: alice })
  assert.equal(first.manifest.author, 'alice')
  await store.saveDraft({ manifest: manifest('race', { name: 'Первая правка' }), baseKey: 'user:race', scope: 'user', expectedRevision: 1, identity: alice })
  await assert.rejects(
    () => store.saveDraft({ manifest: manifest('race', { name: 'Устаревшая правка' }), baseKey: 'user:race', scope: 'user', expectedRevision: 1, identity: alice }),
    /уже изменён/)
}))

test('duplicate copies any visible template into the caller\'s library under a new id', () => withTmp(async dir => {
  const store = makeStore(dir, { builtin: ['corp'] })
  const copy = await store.duplicate({ key: 'builtin:corp', newId: 'my-corp', name: 'Моя копия', identity: alice })
  assert.equal(copy.key, 'user:my-corp')
  assert.equal(copy.manifest.author, 'alice')
  assert.equal(copy.manifest.revision, 1)
  assert.equal(copy.manifest.name, 'Моя копия')
  await assert.rejects(() => store.duplicate({ key: 'builtin:corp', newId: 'my-corp', name: 'Ещё', identity: alice }), /уже есть/)
  await assert.rejects(() => store.duplicate({ key: 'builtin:corp', newId: 'x-copy', name: 'Без входа', identity: { admin: false, local: true } }), /локальные сессии/)
  // Копия личная: другой пользователь её не видит
  assert.deepEqual((await store.list({ login: 'carol', admin: false, local: false })).map(t => t.key), ['builtin:corp'])
}))

test('workbench: template-get exposes access and image data; template-preview renders an unsaved draft', () => withTmp(async dir => {
  const store = makeStore(dir, { builtin: ['corp'] })
  const wb = new PptWorkbench({ catalogPath: join(dir, 'catalog.jsonl') })
  wb.attachTemplateStore(store)

  const listed = await wb.action({ operation: 'template-list', lang: 'ru' }, undefined, alice)
  assert.equal(listed.admin, false)
  assert.ok(listed.themes.length >= 5 && listed.themes.every(t => t.id && t.palette?.accent))

  const got = await wb.action({ operation: 'template-get', templateId: 'builtin:corp' }, undefined, alice)
  assert.equal(got.template.canEdit, false)
  assert.equal(got.template.key, 'builtin:corp')
  const asAdmin = await wb.action({ operation: 'template-get', templateId: 'builtin:corp' }, undefined, admin)
  assert.equal(asAdmin.template.canEdit, true)
  assert.equal(asAdmin.template.overridesBuiltin, true)

  // Превью несохранённого черновика: логотип приходит как upload, id и имя ещё пустые
  const draft = { schemaVersion: 1, id: '', name: '', style: { theme: 'data', brand: { footer: 'Футер превью', logo: 'logo.png' } } }
  const preview = await wb.action({ operation: 'template-preview', manifest: draft, uploads: { 'logo.png': PNG_URI }, lang: 'ru' }, undefined, alice)
  assert.equal(preview.ok, true)
  assert.match(preview.html, /Футер превью/)
  assert.equal(preview.slideCount, 5)
  // Превью ничего не сохраняет
  assert.deepEqual((await store.list(alice)).map(t => t.key), ['builtin:corp'])

  // Битый цвет — понятная ошибка, а не пустой экран
  await assert.rejects(() => wb.action({ operation: 'template-preview', manifest: { ...draft, style: { brand: { primaryColor: 'red' } } } }, undefined, alice))
}))

test('workbench: admin edits a built-in template through template-save and everyone sees the override', () => withTmp(async dir => {
  const store = makeStore(dir, { builtin: ['corp'] })
  const wb = new PptWorkbench({ catalogPath: join(dir, 'catalog.jsonl') })
  wb.attachTemplateStore(store)
  const edited = manifest('corp', { name: 'Исправленный корпоративный' })
  const saved = await wb.action({ operation: 'template-save', manifest: edited, baseKey: 'builtin:corp', scope: 'public' }, undefined, admin)
  assert.equal(saved.key, 'public:corp')
  const asAlice = await wb.action({ operation: 'template-list' }, undefined, alice)
  assert.deepEqual(asAlice.templates.map(t => [t.key, t.name, t.overridesBuiltin]), [['public:corp', 'Исправленный корпоративный', true]])
  // Обычный пользователь не сохраняет в общие, даже указав scope: public
  await assert.rejects(() => wb.action({ operation: 'template-save', manifest: edited, baseKey: 'public:corp', scope: 'public' }, undefined, alice), /администратор/)
  // Дублирование в личные доступно всем вошедшим
  const copy = await wb.action({ operation: 'template-duplicate', templateId: 'public:corp', newTemplateId: 'alice-corp', name: 'Корпоративный Алисы' }, undefined, alice)
  assert.equal(copy.key, 'user:alice-corp')
}))

test('workbench: template-create-from-project takes the project by catalog id, never by path', () => withTmp(async dir => {
  const slides = [{ layout: 'cover', title: 'Годовой отчёт', subtitle: 'Итоги' }, { layout: 'bullets', title: 'Выручка', bullets: ['Рост 12%'] }]
  const created = await advanced.buildDeckAsync({ title: 'Годовой отчёт', slides, outputDir: dir, lang: 'ru' })
  const wb = new PptWorkbench({ catalogPath: join(dir, 'catalog.jsonl') })
  wb.attachTemplateStore(makeStore(dir))
  await wb.remember(created, {}, undefined, alice)
  const id = (await wb.action({ operation: 'list' })).projects[0].id
  const saved = await wb.action({ operation: 'template-create-from-project', id, newTemplateId: 'from-report', name: 'Из отчёта' }, undefined, alice)
  assert.equal(saved.key, 'user:from-report')
  assert.equal(saved.template.author, 'alice')
  assert.equal(saved.template.outline[0].title, '{{deck.title}}')
  // Путь файла браузер подставить не может: неизвестный id отклоняется
  await assert.rejects(() => wb.action({ operation: 'template-create-from-project', id: '0'.repeat(64), newTemplateId: 'x-tpl', name: 'X' }, undefined, alice))
}))

test('panel sources: templates live inside Presentations, not as a separate sidebar item', () => {
  const client = readFileSync(new URL('../templates/client.js', import.meta.url), 'utf8')
  assert.ok(!client.includes("id:'dsh-ppt.templates'"), 'the standalone templates sidebar registration is gone')
  assert.match(client, /listTab==='templates'/)
  assert.match(client, /h\(TemplatesPanel,\{onCreated/)
  const built = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  assert.match(built, /function TemplateEditor\(/)
  assert.match(built, /template-preview/)
})
