import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { unzipSync, zipSync, strToU8 } from 'fflate'
import * as core from '../skills/dsh-ppt/scripts/deck-core.mjs'
import * as templates from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import * as advanced from '../skills/dsh-ppt/scripts/deck-advanced.mjs'
import { solidPng } from '../skills/dsh-ppt/scripts/deck-pptx-layouts.mjs'
import { zoneContents } from '../skills/dsh-ppt/scripts/deck-zones.mjs'
import { runInNewContext } from 'node:vm'

const text = (files, name) => Buffer.from(files[name]).toString('utf8')
const theme = core.resolveTheme('data'), lang = core.resolveLanguage('ru')
const size = { width: 9906000, height: 6858000 }
function box(id, name, x, y, w, h, value, preset = 'rect') {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="${preset}"><a:avLst/></a:prstGeom>${value ? '<a:noFill/>' : '<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>'}</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="1800"/><a:t>${value}</a:t></a:r></a:p></p:txBody></p:sp>`
}
async function sourceDeck() {
  const files = unzipSync(core.buildPptx({ title: 'Источник', slides: Array.from({ length: 4 }, () => ({ layout: 'bullets', title: 'Источник' })) }, theme, lang))
  files['ppt/presentation.xml'] = strToU8(text(files, 'ppt/presentation.xml').replace(/<p:sldSz[^>]*\/>/, `<p:sldSz cx="${size.width}" cy="${size.height}" type="A4"/>`))
  for (let i = 1; i <= 4; i++) {
    const part = `ppt/slides/slide${i}.xml`
    const title = box(2, 'Title', 700000, 900000, 8500000, 600000, `Секретный заголовок ${i}`)
    const body = box(3, 'Body', 700000, 2000000, i === 4 ? 3500000 : 8500000, 3500000, `Секретный текст ${i}`)
    const second = i === 4 ? box(4, 'Body column 2', 5200000, 2000000, 3500000, 3500000, 'Вторая колонка') : ''
    files[part] = strToU8(text(files, part).replace(/(<p:grpSpPr>[\s\S]*?<\/p:grpSpPr>)[\s\S]*?<\/p:spTree>/, `$1${title}${body}${second}</p:spTree>`))
  }
  // A shared unsupported object should be reported once with all affected slides.
  files['ppt/slideMasters/slideMaster1.xml'] = strToU8(text(files, 'ppt/slideMasters/slideMaster1.xml').replace('</p:spTree>', box(500, 'Oval decor', 0, 0, 100000, 100000, '', 'ellipse') + '</p:spTree>'))
  // An unused internal layout must never become a template variant.
  files['ppt/slideLayouts/slideLayout2.xml'] = strToU8(text(files, 'ppt/slideLayouts/slideLayout1.xml').replace(/name="[^"]*"/, 'name="Unused layout"'))
  files['ppt/slideLayouts/_rels/slideLayout2.xml.rels'] = files['ppt/slideLayouts/_rels/slideLayout1.xml.rels']
  files['ppt/slideMasters/slideMaster1.xml'] = strToU8(text(files, 'ppt/slideMasters/slideMaster1.xml').replace('</p:sldLayoutIdLst>', '<p:sldLayoutId id="2147483650" r:id="rId999"/></p:sldLayoutIdLst>'))
  const relPart = 'ppt/slideMasters/_rels/slideMaster1.xml.rels'
  files[relPart] = strToU8(text(files, relPart).replace('</Relationships>', '<Relationship Id="rId999" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout2.xml"/></Relationships>'))
  const lib = await import('@office-kit/pptx')
  const p = await lib.loadPresentation(zipSync(files))
  for (const slide of lib.getSlides(p)) lib.addSlideImage(slide, solidPng('#0000FF'), { x: 500000, y: 100000, w: 1200000, h: 500000, name: 'Logo' })
  lib.addSlideImage(lib.getSlides(p)[3], solidPng('#FF0000'), { x: 6000000, y: 5500000, w: 3000000, h: 1000000, name: 'Project photo' })
  return Buffer.from(await lib.savePresentation(p))
}

test('import uses slides, groups common artwork, retains column variants, replaces content and explains shared losses', async () => {
  const result = await templates.templateFromPptx(await sourceDeck(), { templateId: 'slide-test', name: 'Из слайдов', lang: 'ru' })
  const m = result.manifest
  assert.deepEqual(m.style.pageSize, size)
  assert.equal(result.report.slide.adapted, false)
  assert.equal(result.report.layouts, 1)
  assert.equal(m.style.layouts.length, 3) // cover, single column, two columns + photo
  assert.equal(m.outline[1].layoutId, m.outline[2].layoutId)
  assert.notEqual(m.outline[2].layoutId, m.outline[3].layoutId)
  assert.equal(new Set(m.style.layouts.map(l => l.familyId)).size, 1)
  assert.ok(!JSON.stringify(m).includes('Секретный'))
  assert.ok(!JSON.stringify(m).includes('Unused layout'))
  const two = m.style.layouts.find(l => l.id === m.outline[3].layoutId)
  assert.equal(two.textZones.filter(z => z.kind === 'body').length, 2)
  assert.equal(two.textZones.filter(z => z.kind === 'image').length, 1)
  assert.ok(two.images.every(i => i.role === 'logo'))
  const loss = result.report.skippedObjects.find(o => o.name === 'Oval decor')
  assert.deepEqual(loss.slides, [1, 2, 3, 4])
  assert.match(loss.source, /slideMasters/)
  assert.ok(loss.reason.length > 10)
  assert.equal(result.report.skippedObjects.filter(o => o.name === 'Oval decor').length, 1)
  const bodySlots = zoneContents({ title: 'Новый', bullets: ['А', 'Б', 'В', 'Г'] }, two).filter(s => s.role === 'body')
  assert.deepEqual(bodySlots.map(s => s.lines), [['А', 'Б'], ['В', 'Г']])
})

test('original size and slot geometry survive ZIP, editor, preview, project, export and extraction', async () => {
  const imported = await templates.templateFromPptx(await sourceDeck(), { templateId: 'page-test', name: 'Формат', lang: 'ru' })
  const bundle = templates.readTemplateZip(templates.buildTemplateBundle(imported.manifest, imported.assets))
  const editorSource = readFileSync(new URL('../templates/panels/template-editor.js', import.meta.url), 'utf8')
  const form = runInNewContext(editorSource + '\nJSON.stringify(tplBuild(tplDraftFrom(input), input))', { input: bundle.manifest, languageOf: () => 'ru' })
  const edited = templates.validateTemplateManifest(JSON.parse(form), { templateAssets: bundle.assets })
  assert.deepEqual(edited.style.pageSize, bundle.manifest.style.pageSize)
  assert.deepEqual(edited.style.layouts, bundle.manifest.style.layouts)
  const create = templates.templateCreateOptions(edited, bundle.assets, { title: 'Новый', lang: 'ru' }).create
  const html = advanced.previewDeckHtml(create).html
  assert.match(html, /aspect-ratio:9906000\/6858000/)
  assert.match(html, /@page\{size:275\.1666666666667mm 190\.5mm/)
  assert.match(html, /left:7\.066%;top:13\.123%/)
  const dir = mkdtempSync(join(tmpdir(), 'dsh-page-'))
  try {
    const built = await advanced.buildDeckAsync({ ...create, outputDir: dir })
    const files = unzipSync(readFileSync(built.pptxPath))
    assert.match(text(files, 'ppt/presentation.xml'), /<p:sldSz cx="9906000" cy="6858000"/)
    const xml = text(files, 'ppt/slides/slide4.xml')
    assert.equal((xml.match(/name="Body"/g) ?? []).length, 2)
    const bodyPositions = [...xml.matchAll(/name="Body"[\s\S]*?<a:off x="(\d+)" y="(\d+)"/g)].map(m => Number(m[1]))
    assert.ok(bodyPositions[0] < 710000 && bodyPositions[1] > 5100000)
    const deck = JSON.parse(readFileSync(built.jsonPath, 'utf8'))
    const extracted = templates.templateFromDeckManifest(deck, { templateId: 'round-trip', name: 'Обратно' })
    assert.deepEqual(extracted.manifest.style.pageSize, size)
    assert.equal(extracted.manifest.style.layouts[2].familyId, edited.style.layouts[2].familyId)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('portrait and arbitrary physical page sizes stay exact, invalid dimensions fail', () => {
  for (const pageSize of [{ width: 7560000, height: 10692000 }, { width: 14400000, height: 7200000 }]) {
    const m = { title: 'Формат', style: { pageSize }, slides: [{ layout: 'cover', title: 'Тест' }] }
    const files = unzipSync(core.buildPptx(m, theme, lang))
    assert.match(text(files, 'ppt/presentation.xml'), new RegExp(`cx="${pageSize.width}" cy="${pageSize.height}"`))
  }
  for (const pageSize of [{ width: 0, height: 10 }, { width: NaN, height: 10 }, { width: '100', height: 100 }]) {
    assert.throws(() => advanced.previewDeckHtml({ title: 'X', style: { pageSize }, slides: [{ layout: 'cover', title: 'X' }] }), /pageSize/)
  }
})

test('empty imported content slots contain a paragraph required by PowerPoint', () => {
  const layout = { id: 'empty-slot', familyId: 'family-1', layoutType: 'content', images: [], textZones: [
    { kind: 'title', x: 5, y: 5, w: 90, h: 10 }, { kind: 'body', x: 5, y: 20, w: 90, h: 70 },
  ] }
  const files = unzipSync(core.buildPptx({ title: 'Test', style: { layouts: [layout] }, slides: [{ layout: 'bullets', title: 'Test', designLayout: layout.id }] }, theme, lang))
  const xml = text(files, 'ppt/slides/slide1.xml')
  for (const body of xml.matchAll(/<p:txBody>([\s\S]*?)<\/p:txBody>/g)) assert.match(body[1], /<a:p[\s/>]/)
})
