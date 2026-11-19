// deck-templates.mjs —— 模板清单、bundle 读写、项目→模板、pptx→模板、应用参数。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zipSync, unzipSync, strToU8 } from 'fflate'

const here = dirname(fileURLToPath(import.meta.url))
const templates = await import('../skills/dsh-ppt/scripts/deck-templates.mjs')
const advanced = await import('../skills/dsh-ppt/scripts/deck-advanced.mjs')

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
const withTmp = (fn) => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-ppt-templates-'))
  try { return fn(dir) } finally { rmSync(dir, { recursive: true, force: true }) }
}
const baseTemplate = (overrides = {}) => ({
  schemaVersion: 1, id: 'test-tpl', name: 'Тестовый шаблон',
  style: { theme: 'data', brand: { primaryColor: '#1B4FD8', backgroundColor: '#F5F8FF', textColor: '#10224A', fontFamily: 'Arial', footer: '© ACME', logo: 'logo.png' } },
  outline: [
    { layout: 'cover', title: '{{deck.title}}', subtitle: 'Заполнить: докладчик и дата' },
    { layout: 'bullets', title: 'Раздел', bullets: ['Заполнить: факты'] },
    { layout: 'closing', title: 'Действия', subtitle: 'Заполнить: сроки' },
  ],
  samples: [{ layout: 'image-right', title: 'Образец', image: { src: 'sample-1.png', alt: 'пример' } }],
  ...overrides,
})
const baseAssets = () => templates.normalizeTemplateAssets({ 'logo.png': PNG, 'sample-1.png': PNG })

// ---------------------------------------------------------------------------
// валидация манифеста
// ---------------------------------------------------------------------------

test('template manifest: valid template passes and normalizes colors', () => {
  const manifest = templates.validateTemplateManifest(baseTemplate())
  assert.equal(manifest.schemaVersion, 1)
  assert.equal(manifest.style.brand.primaryColor, '#1B4FD8')
  assert.ok(manifest.revision >= 1)
})

test('template manifest: rejects bad id, theme, colors, asset refs', () => {
  assert.throws(() => templates.validateTemplateManifest(baseTemplate({ id: 'Bad_ID' })), /id/)
  assert.throws(() => templates.validateTemplateManifest(baseTemplate({ schemaVersion: 99 })), /schemaVersion/)
  assert.throws(() => templates.validateTemplateManifest(
    { ...baseTemplate(), style: { theme: 'nope' } }), /theme/)
  const bad = baseTemplate()
  bad.style.brand.primaryColor = 'blue'
  assert.throws(() => templates.validateTemplateManifest(bad), /#RRGGBB/)
  assert.throws(() => templates.validateTemplateManifest(baseTemplate(), { templateAssets: {} }), /assets/)
})

test('template manifest: backgrounds validated per layout type', () => {
  const ok = baseTemplate({ id: 'bg-tpl', samples: [] })
  ok.style.backgrounds = [{ layoutType: 'cover', image: 'bg.png', fit: 'cover' }, { layoutType: 'content', image: 'bg.png' }]
  const manifest = templates.validateTemplateManifest(ok, { templateAssets: { 'bg.png': PNG, 'logo.png': PNG } })
  assert.equal(manifest.style.backgrounds[1].fit, 'cover')
  const dup = baseTemplate({ id: 'bg-tpl', samples: [] })
  dup.style.backgrounds = [{ layoutType: 'cover', image: 'bg.png' }, { layoutType: 'cover', image: 'bg.png' }]
  assert.throws(() => templates.validateTemplateManifest(dup, { templateAssets: { 'bg.png': PNG, 'logo.png': PNG } }), /重复|layoutType/)
  const wrong = baseTemplate({ id: 'bg-tpl', samples: [] })
  wrong.style.backgrounds = [{ layoutType: 'chess', image: 'bg.png' }]
  assert.throws(() => templates.validateTemplateManifest(wrong), /layoutType/)
})

test('template manifest: outline slide fields are restricted', () => {
  const bad = baseTemplate({ id: 'field-tpl' })
  bad.outline[0].chart = { kind: 'pie' }
  assert.throws(() => templates.validateTemplateManifest(bad), /chart/)
  const long = baseTemplate({ id: 'long-tpl' })
  long.outline[0].title = 'x'.repeat(301)
  assert.throws(() => templates.validateTemplateManifest(long), /title/)
})

// ---------------------------------------------------------------------------
// bundle: zip roundtrip, traversal protection, size caps
// ---------------------------------------------------------------------------

test('template bundle: zip roundtrip keeps manifest and assets', () => withTmp(dir => {
  const assets = baseAssets()
  const zip = templates.buildTemplateBundle(baseTemplate(), assets)
  assert.ok(zip.length > 100)
  const path = join(dir, 'test-tpl.zip')
  writeFileSync(path, zip)
  const { manifest, assets: readAssets } = templates.readTemplateBundle(path)
  assert.equal(manifest.id, 'test-tpl')
  assert.deepEqual(Object.keys(readAssets).sort(), ['logo.png', 'sample-1.png'])
  assert.equal(readAssets['logo.png'].data.startsWith('data:image/png;base64,'), true)
}))

test('template bundle: bare template.json accepted without assets', () => withTmp(dir => {
  const path = join(dir, 'plain.json')
  writeFileSync(path, JSON.stringify({ schemaVersion: 1, id: 'plain-tpl', name: 'Plain', outline: [{ layout: 'cover', title: 'T' }] }))
  const { manifest, assets } = templates.readTemplateBundle(path)
  assert.equal(manifest.id, 'plain-tpl')
  assert.equal(Object.keys(assets).length, 0)
}))

test('template bundle: rejects zip without template.json', () => {
  const zip = Buffer.from(zipSync({ 'note.txt': strToU8('no manifest here') }))
  assert.throws(() => templates.readTemplateEntries(unzipSync(new Uint8Array(zip))), /template\.json/)
})

test('template bundle: rejects path traversal and non-image assets', () => {
  const zip = Buffer.from(zipSync({ 'template.json': strToU8(JSON.stringify({ schemaVersion: 1, id: 'tt', name: 'T' })), 'assets/../evil.png': new Uint8Array(PNG) }))
  const { assets } = templates.readTemplateEntries(unzipSync(new Uint8Array(zip)))
  assert.equal(Object.keys(assets).length, 0)
  const bad = Buffer.from(zipSync({ 'template.json': strToU8(JSON.stringify({ schemaVersion: 1, id: 'tt', name: 'T' })), 'assets/mal.exe': new Uint8Array(PNG) }))
  assert.equal(Object.keys(templates.readTemplateEntries(unzipSync(new Uint8Array(bad))).assets).length, 0)
})

test('template bundle: manifest referencing missing asset fails on read', () => {
  const manifest = { schemaVersion: 1, id: 'tt', name: 'T', style: { brand: { logo: 'logo.png' } } }
  const zip = Buffer.from(zipSync({ 'template.json': strToU8(JSON.stringify(manifest)) }))
  assert.throws(() => templates.readTemplateEntries(unzipSync(new Uint8Array(zip))), /assets/)
})

// ---------------------------------------------------------------------------
// каталог шаблона
// ---------------------------------------------------------------------------

test('template dir: write and read back', () => withTmp(dir => {
  const root = templates.writeTemplateDir(join(dir, 'test-tpl'), baseTemplate(), baseAssets())
  assert.ok(existsSync(join(root, 'template.json')))
  assert.ok(existsSync(join(root, 'assets', 'logo.png')))
  const { manifest, assets } = templates.readTemplateDir(root)
  assert.equal(manifest.id, 'test-tpl')
  assert.equal(assets['logo.png'].bytes.length, PNG.length)
}))

test('template dir: refuses mismatched dir name', () => withTmp(dir => {
  const bare = { schemaVersion: 1, id: 'test-tpl', name: 'Тестовый шаблон', outline: [{ layout: 'cover', title: 'T' }] }
  assert.throws(() => templates.writeTemplateDir(join(dir, 'other-name'), bare, {}), /id 一致|目录名/)
}))

// ---------------------------------------------------------------------------
// 应用参数
// ---------------------------------------------------------------------------

test('template create options: substitutes title, embeds logo data URIs', () => {
  const { create, lineage } = templates.templateCreateOptions(baseTemplate(), baseAssets(), { title: 'Мой отчёт' })
  assert.equal(create.slides[0].title, 'Мой отчёт')
  assert.equal(create.slides[0].subtitle, 'Заполнить: докладчик и дата')
  assert.equal(create.theme, 'data')
  assert.equal(create.brand.primaryColor, '#1B4FD8')
  assert.equal(create.brand.logo.startsWith('data:image/png;base64,'), true)
  assert.equal(create.slides.length, 4) // 3 outline + 1 sample
  assert.deepEqual(lineage.id, 'test-tpl')
})

test('template create options: includeSamples=false drops samples', () => {
  const { create } = templates.templateCreateOptions(baseTemplate(), baseAssets(), { title: 'X', includeSamples: false })
  assert.equal(create.slides.length, 3)
})

test('template create options: requires title, fails without outline and samples', () => {
  assert.throws(() => templates.templateCreateOptions(baseTemplate(), baseAssets(), {}), /标题/)
  const empty = { schemaVersion: 1, id: 'empty', name: 'E' }
  assert.throws(() => templates.templateCreateOptions(empty, {}, { title: 'X' }), /骨架/)
})

test('template restyle options: carries theme, brand and backgrounds', () => {
  const tpl = baseTemplate({ id: 'restyle-tpl' })
  tpl.style.backgrounds = [{ layoutType: 'cover', image: 'bg.png' }, { layoutType: 'content', image: 'bg.png' }]
  const assets = templates.normalizeTemplateAssets({ 'bg.png': PNG, 'logo.png': PNG, 'sample-1.png': PNG })
  const { restyle, lineage } = templates.templateRestyleOptions(tpl, assets)
  assert.equal(restyle.theme, 'data')
  assert.equal(restyle.brand.footer, '© ACME')
  assert.equal(restyle.style.backgrounds.length, 2)
  assert.equal(restyle.style.backgrounds[0].src.startsWith('data:image/png;base64,'), true)
  assert.equal(lineage.id, 'restyle-tpl')
})

test('template restyle options: fails when template has no style', () => {
  const bare = { schemaVersion: 1, id: 'bare', name: 'B', outline: [{ layout: 'cover', title: 'T' }] }
  assert.throws(() => templates.templateRestyleOptions(bare, {}), /样式/)
})

// ---------------------------------------------------------------------------
// 项目 → 模板
// ---------------------------------------------------------------------------

test('template from deck: extracts style, outline placeholders and sample', () => withTmp(async dir => {
  const out = join(dir, 'deck')
  const createResult = await advanced.buildDeckAsync({
    title: 'Проект для шаблона', lang: 'ru', outputDir: out,
    brand: { primaryColor: '#123456', footer: 'Footer' },
    slides: [
      { layout: 'cover', title: 'Проект для шаблона', subtitle: 'Подзаголовок' },
      { layout: 'bullets', title: 'Достижения', bullets: ['Сделали раз', 'Сделали два'] },
      { layout: 'bullets', title: 'Заполнить: планы', bullets: ['Заполнить: что-то'] },
      { layout: 'closing', title: 'Спасибо' },
    ],
  })
  const deckManifest = JSON.parse(readFileSync(createResult.jsonPath, 'utf8'))
  const { manifest, assets } = templates.templateFromDeckManifest(deckManifest, {
    templateId: 'from-deck', name: 'Из проекта', author: 'tester', lang: 'ru',
  })
  assert.equal(manifest.style.theme, deckManifest.theme)
  assert.equal(manifest.style.brand.primaryColor, '#123456')
  assert.equal(manifest.style.brand.footer, 'Footer')
  assert.equal(manifest.outline.length, 4)
  assert.equal(manifest.outline[1].title, 'Достижения')
  assert.ok(manifest.outline[1].bullets[0].startsWith('Заполнить: '))
  assert.equal(manifest.outline[2].title.startsWith('Заполнить: '), true)
  assert.ok(manifest.samples.length >= 1)
  // 应用回创建：占位符进入新 дек
  const { create } = templates.templateCreateOptions(manifest, assets, { title: 'Новая дека', lang: 'ru' })
  assert.equal(create.slides[0].title, 'Новая дека')
  assert.ok(create.slides[2].title.startsWith('Заполнить:'))
  // bundle 往返
  const zipPath = templates.writeTemplateBundle(dir, manifest, assets)
  assert.ok(existsSync(zipPath.path))
  const back = templates.readTemplateBundle(zipPath.path)
  assert.equal(back.manifest.id, 'from-deck')
}))

// ---------------------------------------------------------------------------
// pptx → 模板（用本插件生成的 PPTX 作为示例）
// ---------------------------------------------------------------------------

test('template from pptx: extracts colors, fonts and outline', async () => withTmp(async dir => {
  const out = join(dir, 'deck')
  const createResult = await advanced.buildDeckAsync({
    title: 'Пример фирмы', lang: 'ru', outputDir: out,
    brand: { primaryColor: '#2040A0', backgroundColor: '#F0F4FF', textColor: '#101830', footer: 'ACME 2026' },
    slides: [
      { layout: 'cover', title: 'Пример фирмы' },
      { layout: 'bullets', title: 'Раздел один', bullets: ['Пункт один', 'Пункт два'] },
      { layout: 'closing', title: 'Контакты' },
    ],
  })
  const { manifest, assets, report } = await templates.templateFromPptx(createResult.pptxPath, {
    templateId: 'from-pptx', name: 'Из PPTX', lang: 'ru',
  })
  assert.equal(manifest.id, 'from-pptx')
  assert.equal(manifest.style.brand.primaryColor, '#2040A0')
  assert.equal(manifest.style.brand.backgroundColor, '#F0F4FF')
  assert.equal(manifest.style.brand.textColor, '#101830')
  assert.equal(manifest.outline.length, 3)
  assert.equal(manifest.outline[0].layout, 'cover')
  assert.equal(manifest.outline[2].layout, 'closing')
  assert.ok(manifest.outline[1].bullets[0].startsWith('Заполнить:'))
  assert.ok(report.colors)
  // 资产合法性
  for (const asset of Object.values(assets)) assert.ok(asset.data.startsWith('data:image/'))
  // 应用到创建
  const { create } = templates.templateCreateOptions(manifest, assets, { title: 'Новая фирма', lang: 'ru' })
  assert.equal(create.slides[0].title, 'Новая фирма')
  assert.equal(create.brand.primaryColor, '#2040A0')
}))

test('template from pptx: missing file fails clearly', async () => {
  await assert.rejects(() => templates.templateFromPptx('/nonexistent/file.pptx', { templateId: 'xx', name: 'X' }), /不存在/)
})

// ---------------------------------------------------------------------------
// 汇总
// ---------------------------------------------------------------------------

test('summarize template: counts outline, samples, assets; hides logo bytes', () => {
  const summary = templates.summarizeTemplate(baseTemplate())
  assert.equal(summary.id, 'test-tpl')
  assert.equal(summary.outlineCount, 3)
  assert.equal(summary.sampleCount, 1)
  assert.equal(summary.hasLogo, true)
  assert.equal(summary.outlineTitles[0], '{{deck.title}}')
  assert.equal(summary.brand.primaryColor, '#1B4FD8')
  assert.ok(!('logo' in summary.brand))
})

test('background type of layout maps media and text layouts', () => {
  assert.equal(templates.backgroundTypeOfLayout('cover'), 'cover')
  assert.equal(templates.backgroundTypeOfLayout('closing'), 'closing')
  assert.equal(templates.backgroundTypeOfLayout('image-left'), 'content')
  assert.equal(templates.backgroundTypeOfLayout('chart'), 'content')
})
