// Макеты шаблона: валидация, SVG-санитайзер, рендер в HTML и PPTX, импорт из PPTX, миграция v1.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { unzipSync } from 'fflate'

const layouts = await import('../skills/dsh-ppt/scripts/deck-layouts.mjs')
const pptxLayouts = await import('../skills/dsh-ppt/scripts/deck-pptx-layouts.mjs')
const templates = await import('../skills/dsh-ppt/scripts/deck-templates.mjs')
const advanced = await import('../skills/dsh-ppt/scripts/deck-advanced.mjs')

const PNG = pptxLayouts.solidPng('#CF1F2F')
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#c00"/></svg>')
const withTmp = async fn => { const dir = mkdtempSync(join(tmpdir(), 'dsh-ppt-layouts-')); try { return await fn(dir) } finally { rmSync(dir, { recursive: true, force: true }) } }

const layoutTemplate = () => ({
  schemaVersion: 2, id: 'lay-tpl', name: 'С макетами',
  style: {
    theme: 'data',
    layouts: [
      { id: 'cover-a', name: 'Титул', layoutType: 'cover', background: { image: 'bg.png', fit: 'cover' },
        images: [{ image: 'logo.png', svg: 'logo.svg', x: 4, y: 6, w: 18, h: 9, z: 0, fit: 'contain', role: 'logo' }] },
      { id: 'body-a', name: 'Контент', layoutType: 'content', backgroundColor: '#FFFFFF',
        images: [{ image: 'logo.png', x: 80, y: 3.5, w: 15, h: 8, z: 0, fit: 'contain', role: 'logo' }] },
    ],
  },
  outline: [
    { layout: 'cover', layoutId: 'cover-a', title: '{{deck.title}}' },
    { layout: 'bullets', layoutId: 'body-a', title: 'Раздел', bullets: ['Заполнить: факты'] },
    { layout: 'bullets', title: 'Без макета', bullets: ['Заполнить: факты'] },
  ],
})
const layoutAssets = () => templates.normalizeTemplateAssets({ 'bg.png': PNG, 'logo.png': PNG, 'logo.svg': SVG })

test('sanitizeSvg: безопасный SVG проходит, скрипты и внешние ссылки отклоняются', () => {
  assert.match(layouts.sanitizeSvg(SVG), /^data:image\/svg\+xml;base64,/)
  for (const bad of [
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" onload="x()"></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="http://evil/x.png"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" style="fill:url(http://evil/x)"/>',
    '<!DOCTYPE svg [<!ENTITY a "b">]><svg xmlns="http://www.w3.org/2000/svg"/>',
    'not svg',
  ]) assert.equal(layouts.sanitizeSvg(bad), null, bad)
})

test('solidPng: корректный PNG, читается валидатором ассетов', () => {
  const assets = templates.normalizeTemplateAssets({ 'fill.png': pptxLayouts.solidPng('#112233', 0.5) })
  assert.equal(assets['fill.png'].mime, 'image/png')
})

test('manifest v2: макеты валидны, версия вычисляется, ссылки на файлы проверяются', () => {
  const manifest = templates.validateTemplateManifest(layoutTemplate(), { templateAssets: layoutAssets() })
  assert.equal(manifest.schemaVersion, 2)
  assert.equal(manifest.style.layouts.length, 2)
  assert.equal(manifest.outline[0].layoutId, 'cover-a')
  assert.throws(() => templates.validateTemplateManifest(layoutTemplate(), { templateAssets: templates.normalizeTemplateAssets({ 'bg.png': PNG, 'logo.png': PNG }) }), /logo\.svg/)
  const missing = layoutTemplate(); missing.outline[0].layoutId = 'nope'
  assert.throws(() => templates.validateTemplateManifest(missing, { templateAssets: layoutAssets() }), /版式|nope/)
  const outOfRange = layoutTemplate(); outOfRange.style.layouts[0].images[0].w = 0
  assert.throws(() => templates.validateTemplateManifest(outOfRange, { templateAssets: layoutAssets() }), /w/)
  const dup = layoutTemplate(); dup.style.layouts[1].id = 'cover-a'
  assert.throws(() => templates.validateTemplateManifest(dup, { templateAssets: layoutAssets() }), /重复|cover-a/)
})

test('manifest v1 без макетов остаётся v1', () => {
  const manifest = templates.validateTemplateManifest({ schemaVersion: 1, id: 'plain', name: 'Plain', outline: [{ layout: 'cover', title: 'T' }] })
  assert.equal(manifest.schemaVersion, 1)
})

test('HTML: макет кладёт фон и картинки в процентах, SVG предпочтительнее PNG, слайд без макета берёт макет по типу', async () => {
  const manifest = templates.validateTemplateManifest(layoutTemplate(), { templateAssets: layoutAssets() })
  const { create } = templates.templateCreateOptions(manifest, layoutAssets(), { title: 'Дек' })
  const html = advanced.previewDeckHtml(create).html
  assert.equal((html.match(/class="tpl-layer"/g) ?? []).length, 3)
  assert.match(html, /left:4%;top:6%;width:18%;height:9%;object-fit:contain/)
  assert.match(html, /src="data:image\/svg\+xml;base64,/)
  assert.match(html, /left:80%;top:3\.5%;width:15%;height:8%/)
})

test('PPTX: картинки макета экспортируются под текстом в нужных позициях', async () => {
  const manifest = templates.validateTemplateManifest(layoutTemplate(), { templateAssets: layoutAssets() })
  const { create } = templates.templateCreateOptions(manifest, layoutAssets(), { title: 'Дек' })
  await withTmp(async dir => {
    const result = await advanced.buildDeckAsync({ ...create, outputDir: dir })
    const pptxPath = result.pptxPath
    assert.ok(pptxPath && existsSync(pptxPath), 'PPTX создан')
    const slide1 = Buffer.from(unzipSync(new Uint8Array(readFileSync(pptxPath)))['ppt/slides/slide1.xml']).toString('utf8')
    assert.match(slide1, /Template background/)
    assert.match(slide1, /Template logo/)
    // Фон и логотип стоят раньше текстовых плейсхолдеров (ниже по z-порядку)
    assert.ok(slide1.indexOf('Template background') < slide1.indexOf('<p:txBody>'))
    // Рамка 18%×9% слайда (2194560×617220 EMU) от x=4% (487680), y=6% (411480); квадратный PNG вписан по центру рамки (contain)
    assert.match(slide1, /<a:off x="1276\d{3}" y="411480"\/><a:ext cx="617220" cy="617220"\/>/)
  })
})

test('миграция: проект с макетами → шаблон → проект сохраняет макеты и их файлы', async () => {
  const manifest = templates.validateTemplateManifest(layoutTemplate(), { templateAssets: layoutAssets() })
  const { create } = templates.templateCreateOptions(manifest, layoutAssets(), { title: 'Дек' })
  await withTmp(async dir => {
    const built = await advanced.buildDeckAsync({ ...create, outputDir: dir })
    const deck = JSON.parse(readFileSync(built.jsonPath, 'utf8'))
    assert.equal(deck.style.layouts.length, 2)
    const extracted = templates.templateFromDeckManifest(deck, { templateId: 'from-deck', name: 'Из проекта' })
    assert.equal(extracted.manifest.style.layouts.length, 2)
    assert.equal(extracted.manifest.schemaVersion, 2)
    assert.ok(Object.keys(extracted.assets).some(name => name.endsWith('.svg')))
    assert.equal(extracted.manifest.outline[0].layoutId, 'cover-a')
  })
})

test('layoutTypeByName распознаёт русские и английские названия', () => {
  assert.equal(pptxLayouts.layoutTypeByName('1_Титульный слайд'), 'cover')
  assert.equal(pptxLayouts.layoutTypeByName('Финальный слайд'), 'closing')
  assert.equal(pptxLayouts.layoutTypeByName('Заголовок раздела'), 'section')
  assert.equal(pptxLayouts.layoutTypeByName('Инфографика 1'), 'content')
})

// Интеграционный прогон на реальном файле: задайте DSH_PPT_EXAMPLE=/путь/example.pptx
const example = process.env.DSH_PPT_EXAMPLE
test('импорт PPTX: макеты, картинки, SVG и положение', { skip: !example || !existsSync(example) }, async () => {
  const result = await templates.templateFromPptx(example, { templateId: 'example', name: 'Пример', lang: 'ru' })
  assert.ok(result.manifest.style.layouts.length >= 2)
  assert.ok(result.report.layoutStats.images > 0)
  for (const layout of result.manifest.style.layouts) for (const image of layout.images) {
    assert.ok(image.w > 0 && image.h > 0)
    assert.ok(result.assets[image.image])
  }
  assert.equal(result.manifest.schemaVersion, 2)
})
