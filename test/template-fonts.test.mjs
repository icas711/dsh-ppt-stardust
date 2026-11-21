import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { unzipSync, zipSync, strToU8 } from 'fflate'
import * as templates from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import * as advanced from '../skills/dsh-ppt/scripts/deck-advanced.mjs'
import * as fonts from '../skills/dsh-ppt/scripts/deck-fonts.mjs'
import { PptTemplateStore } from '../lib/templates.js'
import { runInNewContext } from 'node:vm'
import * as DshDeckModel from '../skills/dsh-ppt/scripts/deck-model.mjs'

const heading = readFileSync(new URL('./fixtures/fonts/DSH-Test-Heading.ttf', import.meta.url))
const body = readFileSync(new URL('./fixtures/fonts/DSH-Test-Body.ttf', import.meta.url))
const withTmp = async fn => { const dir = mkdtempSync(join(tmpdir(), 'dsh-fonts-')); try { return await fn(dir) } finally { rmSync(dir, { recursive: true, force: true }) } }
const text = (files, name) => Buffer.from(files[name]).toString('utf8')

// EOT v1 wrapper: retain fsType metadata and original bytes during the round trip.
function eot(sfnt, family, fsType = 0) {
  const strings = [family, 'Regular', 'Version 1.0', family].map(s => Buffer.from(s, 'utf16le'))
  const fixed = Buffer.alloc(82)
  fixed.writeUInt32LE(0x10000, 8); fixed[26] = 1; fixed.writeUInt32LE(400, 28)
  fixed.writeUInt16LE(fsType, 32); fixed.writeUInt16LE(0x504c, 34)
  const chunks = [fixed]
  strings.forEach((s, index) => { const len = Buffer.alloc(2); len.writeUInt16LE(s.length); chunks.push(len, s); if (index < 3) chunks.push(Buffer.alloc(2)) })
  chunks.push(sfnt)
  const result = Buffer.concat(chunks)
  result.writeUInt32LE(result.length, 0); result.writeUInt32LE(sfnt.length, 4)
  return result
}

function template() {
  return { schemaVersion: 2, id: 'font-test', name: 'Шрифты', style: {
    theme: 'data', fonts: [{ family: 'DSH Test Heading', file: 'heading.ttf' }, { family: 'DSH Test Body', file: 'body.fntdata' }],
    textStyles: { title: { fontFamily: 'DSH Test Heading' }, body: { fontFamily: 'DSH Test Body' } },
    layouts: [{ id: 'cover-font', layoutType: 'cover', images: [], textStyles: {
      title: { fontFamily: 'DSH Test Heading', size: 38, bold: true, italic: false, color: '#123456' },
      subtitle: { fontFamily: 'DSH Test Body', size: 17, bold: false, italic: true, color: '#654321' },
    } }, { id: 'body-font', layoutType: 'content', images: [], textStyles: {
      title: { fontFamily: 'DSH Test Heading', size: 28, color: '#112233' },
      body: { fontFamily: 'DSH Test Body', size: 19, bold: false, color: '#334455' },
    } }],
  }, outline: [{ layout: 'cover', layoutId: 'cover-font', title: '{{deck.title}}', subtitle: 'Описание' },
    { layout: 'bullets', layoutId: 'body-font', title: 'Факты', bullets: ['Первый факт'] }] }
}
const assets = () => templates.normalizeTemplateAssets({ 'heading.ttf': heading, 'body.fntdata': eot(body, 'DSH Test Body', 2) })

test('font bundle and directory round trip retain two families, role styles and exact original bytes', () => withTmp(async dir => {
  const original = assets(), m = template()
  const back = templates.readTemplateZip(templates.buildTemplateBundle(m, original))
  assert.deepEqual(back.assets['body.fntdata'].bytes, original['body.fntdata'].bytes)
  assert.deepEqual(back.manifest.style.textStyles, m.style.textStyles)
  assert.deepEqual(back.manifest.style.layouts[0].textStyles, m.style.layouts[0].textStyles)
  templates.writeTemplateDir(join(dir, m.id), back.manifest, back.assets)
  const disk = templates.readTemplateDir(join(dir, m.id))
  assert.deepEqual(disk.assets['heading.ttf'].bytes, heading)
  assert.equal(templates.countTemplateAssets(disk.manifest), 2)
}))

test('EOT browser conversion and font validation reject corrupt data and invalid references', () => {
  const data = eot(body, 'DSH Test Body', 2), info = fonts.fontInfo(data)
  assert.deepEqual(info.preview, body)
  assert.equal(info.fsType, 2)
  assert.throws(() => fonts.fontInfo(Buffer.from('not a font')), /font/i)
  assert.throws(() => fonts.fontInfo(heading.subarray(0, 40)), /font/i)
  assert.throws(() => templates.normalizeTemplateAssets({ 'bad.ttf': Buffer.alloc(fonts.MAX_FONT + 1) }), /12 MiB/)
  assert.throws(() => templates.validateTemplateManifest(template(), { templateAssets: {} }), /heading.ttf/)
  assert.throws(() => fonts.normalizeFontRefs([{ family: 'DSH Test Body', file: '../font.ttf' }]), /filename/)
  assert.throws(() => fonts.normalizeTextStyles({ body: { size: NaN } }), /size/)
  assert.throws(() => fonts.normalizeTextStyles({ body: { color: '#fff' } }), /color/)
  assert.throws(() => fonts.fontFamily('Arial;</style><script>bad()</script>'), /family/)
})

test('renderer extraction rejects missing/corrupt embedded faces instead of silently substituting', () => {
  const pack = (target, bytes) => Buffer.from(zipSync({
    'ppt/presentation.xml': strToU8('<p:presentation xmlns:p="p" xmlns:r="r"><p:embeddedFontLst><p:embeddedFont><p:font typeface="DSH Test Body"/><p:regular r:id="font"/></p:embeddedFont></p:embeddedFontLst></p:presentation>'),
    'ppt/_rels/presentation.xml.rels': strToU8(`<Relationships><Relationship Id="font" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="${target}"/></Relationships>`),
    ...(bytes ? { 'ppt/fonts/body.fntdata': bytes } : {}),
  }))
  assert.throws(() => fonts.extractRenderFonts(pack('fonts/missing.fntdata')), /Missing embedded font/)
  assert.throws(() => fonts.extractRenderFonts(pack('fonts/body.fntdata', Buffer.from('corrupt font'))), /font/i)
  const extracted = fonts.extractRenderFonts(pack('fonts/body.fntdata', eot(body, 'DSH Test Body')))
  assert.equal(extracted.length, 1)
  assert.deepEqual(extracted[0].bytes, body)
  assert.match(extracted[0].file, /^[a-f0-9]{64}\.ttf$/)
})

test('font sizes have their own budget; fonts larger than the image limit survive a bundle', () => {
  // Valid sfnt may contain trailing padding. This exercises the size policy without proprietary fonts.
  const big = Buffer.concat([heading, Buffer.alloc(6 * 1024 * 1024)])
  const normalized = templates.normalizeTemplateAssets({ 'big.ttf': big })
  const m = { ...template(), style: { fonts: [{ family: 'DSH Test Heading', file: 'big.ttf' }] }, outline: [] }
  assert.equal(templates.readTemplateZip(templates.buildTemplateBundle(m, normalized)).assets['big.ttf'].bytes.length, big.length)
  assert.throws(() => templates.normalizeTemplateAssets(Object.fromEntries([1, 2, 3, 4, 5, 6].map(i => [`font${i}.ttf`, big]))), /32 MiB/)
})

test('PPTX → template ZIP → preview → PPTX keeps typography and embedded fonts', () => withTmp(async dir => {
  const original = assets(), m = template()
  const create = templates.templateCreateOptions(m, original, { title: 'Тест шрифтов', lang: 'ru' }).create
  const initial = await advanced.buildDeckAsync({ ...create, outputDir: join(dir, 'initial') })
  const pptx = unzipSync(readFileSync(initial.pptxPath))
  assert.match(text(pptx, 'ppt/presentation.xml'), /embedTrueTypeFonts="1"/)
  assert.match(text(pptx, 'ppt/presentation.xml'), /<p:embeddedFontLst>/)
  const titleShape = text(pptx, 'ppt/slides/slide1.xml').match(/<p:sp>[^]*?name="Title"[^]*?<\/p:sp>/)[0]
  assert.match(titleShape, /sz="3800"/); assert.match(titleShape, /val="123456"/)
  assert.match(titleShape, /typeface="DSH Test Heading"/)
  assert.ok(Object.values(pptx).some(b => Buffer.from(b).equals(original['body.fntdata'].bytes)))
  const extracted = await templates.templateFromPptx(readFileSync(initial.pptxPath), { templateId: 'reimported-fonts', name: 'Шрифты', lang: 'ru' })
  assert.equal(extracted.manifest.style.fonts.length, 2)
  assert.equal(extracted.manifest.style.textStyles.title.fontFamily, 'DSH Test Heading')
  assert.equal(extracted.manifest.style.textStyles.body.fontFamily, 'DSH Test Body')
  assert.ok(extracted.report.warnings.some(s => s.includes('fsType=0x2')))
  const roles = extracted.manifest.style.layouts[0].textStyles
  assert.equal(roles.title.size, 38); assert.equal(roles.subtitle.size, 17)
  assert.equal(roles.title.fontFamily, 'DSH Test Heading'); assert.equal(roles.subtitle.fontFamily, 'DSH Test Body')
  assert.equal(roles.subtitle.italic, true); assert.equal(roles.subtitle.bold, false)
  const back = templates.readTemplateZip(templates.buildTemplateBundle(extracted.manifest, extracted.assets))
  const preview = advanced.previewDeckHtml(templates.templatePreviewOptions(back.manifest, back.assets))
  assert.match(preview.html, /@font-face\{font-family:"DSH Test Heading"/)
  assert.match(preview.html, /src:url\(data:font\/ttf;base64,/)
  assert.match(preview.html, /\.slide\[data-design="layout-1"\] h1/)
  assert.match(preview.html, /font-size:50\.666666666666664px!important/)
  const second = await advanced.buildDeckAsync({ ...templates.templateCreateOptions(back.manifest, back.assets, { title: 'Новый текст', lang: 'ru' }).create, outputDir: join(dir, 'second') })
  const final = unzipSync(readFileSync(second.pptxPath))
  assert.ok(Object.values(final).some(b => Buffer.from(b).equals(original['body.fntdata'].bytes)))
  const fromProject = templates.templateFromDeckManifest(JSON.parse(readFileSync(second.jsonPath, 'utf8')), { templateId: 'from-font-project', name: 'Из проекта' })
  assert.equal(fromProject.manifest.style.fonts.length, 2)
  assert.equal(fromProject.manifest.style.layouts[0].textStyles.subtitle.size, 17)
}))

test('editor draft and duplicate retain embedded font assets, previews use font-face', () => withTmp(async dir => {
  const store = new PptTemplateStore({ root: dir, templatesModuleLoader: () => Promise.resolve(templates) })
  const identity = { login: 'alice', admin: false }
  const record = await store.save({ manifest: template(), assets: assets(), identity })
  const saved = await store.saveDraft({ manifest: { ...record.manifest, name: 'Правка' }, baseKey: record.key, identity })
  assert.deepEqual(saved.assets['heading.ttf'].bytes, heading)
  const copy = await store.duplicate({ key: saved.key, newId: 'font-copy', name: 'Копия', identity })
  assert.equal(copy.manifest.style.fonts.length, 2)
  const options = await store.previewOptions({ manifest: copy.manifest, baseKey: copy.key, identity })
  assert.match(advanced.previewDeckHtml(options).html, /@font-face/)
}))

test('PPTX with absent embedded fonts preserves family names and warns', () => withTmp(async dir => {
  const m = template(); delete m.style.fonts
  const created = await advanced.buildDeckAsync({ ...templates.templateCreateOptions(m, {}, { title: 'Шрифты' }).create, outputDir: dir })
  const extracted = await templates.templateFromPptx(created.pptxPath, { templateId: 'missing-fonts', name: 'Без файлов', lang: 'ru' })
  assert.equal(extracted.manifest.style.textStyles.body.fontFamily, 'DSH Test Body')
  assert.equal(extracted.manifest.style.fonts.length, 0)
  assert.ok(extracted.report.warnings.some(s => s.includes('DSH Test Body') && s.includes('не встроен')))
}))

test('placeholder styles inherit from master then layout and resolve theme tokens', () => withTmp(async dir => {
  const m = template(); delete m.style.fonts
  const created = await advanced.buildDeckAsync({ ...templates.templateCreateOptions(m, {}, { title: 'Наследование' }).create, outputDir: dir })
  const files = unzipSync(readFileSync(created.pptxPath))
  // Remove explicit slide formatting so layout/master inheritance can be observed.
  files['ppt/slides/slide1.xml'] = strToU8(text(files, 'ppt/slides/slide1.xml').replace(/<a:rPr\b[^]*?<\/a:rPr>/g, '<a:rPr/>'))
  files['ppt/slideLayouts/slideLayout1.xml'] = strToU8(text(files, 'ppt/slideLayouts/slideLayout1.xml').replace('</p:spTree>', '<p:sp><p:nvSpPr><p:cNvPr id="20" name="Subtitle"/><p:nvPr><p:ph type="subTitle"/></p:nvPr></p:nvSpPr><p:txBody><a:lstStyle/><a:p><a:pPr><a:defRPr sz="2300" b="0" i="1"><a:latin typeface="+mn-lt"/><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:defRPr></a:pPr></a:p></p:txBody></p:sp></p:spTree>'))
  const extracted = await templates.templateFromPptx(Buffer.from(zipSync(files)), { templateId: 'inherited-fonts', name: 'Наследование' })
  const subtitle = extracted.manifest.style.layouts[0].textStyles.subtitle
  assert.equal(subtitle.fontFamily, 'DSH Test Body'); assert.equal(subtitle.size, 23)
  assert.equal(subtitle.italic, true); assert.equal(subtitle.bold, false)
  assert.match(subtitle.color, /^#[A-F0-9]{6}$/)
}))

test('editor form conversion preserves typography while editing other template fields', () => {
  const source = readFileSync(new URL('../templates/panels/template-editor.js', import.meta.url), 'utf8')
  const context = { input: template(), output: null, DshDeckModel }
  runInNewContext(source + '\nconst draft = tplDraftFrom(input); draft.name = "Новое имя"; output = tplBuild(draft, input);', context)
  const result = JSON.parse(JSON.stringify(context.output))
  assert.deepEqual(result.style.fonts, template().style.fonts)
  assert.deepEqual(result.style.layouts[0].textStyles, template().style.layouts[0].textStyles)
  assert.deepEqual(result.style.textStyles, template().style.textStyles)
  assert.equal(result.name, 'Новое имя')
})

test('restyle, subsequent edits and undo preserve font assets including historical fonts', () => withTmp(async dir => {
  const initial = await advanced.buildDeckAsync({ title: 'До оформления', lang: 'ru', slides: [{ layout: 'cover', title: 'Обложка' }], outputDir: dir })
  const { restyle } = templates.templateRestyleOptions(template(), assets())
  await advanced.editDeck({ deckPath: initial.jsonPath, ...restyle })
  const applied = JSON.parse(readFileSync(initial.jsonPath, 'utf8'))
  assert.equal(applied.style.fonts.length, 2)
  await advanced.editDeck({ deckPath: initial.jsonPath, style: null })
  const cleared = JSON.parse(readFileSync(initial.jsonPath, 'utf8'))
  assert.equal(cleared.style, undefined)
  assert.ok(Object.keys(cleared.assets).some(id => id.startsWith('font-')))
  await advanced.undoDeck({ deckPath: initial.jsonPath })
  const undone = JSON.parse(readFileSync(initial.jsonPath, 'utf8'))
  assert.equal(undone.style.fonts.length, 2)
  assert.match(readFileSync(initial.htmlPath, 'utf8'), /@font-face/)
}))

test('font faces retain all four variants and EOT subset metadata produces a warning', () => withTmp(async dir => {
  const m = template()
  m.style.fonts = ['regular', 'bold', 'italic', 'boldItalic'].map(variant => ({ family: 'DSH Test Heading', file: 'heading.ttf', variant }))
  const create = templates.templateCreateOptions(m, templates.normalizeTemplateAssets({ 'heading.ttf': heading }), { title: 'Начертания' }).create
  const created = await advanced.buildDeckAsync({ ...create, outputDir: dir })
  const files = unzipSync(readFileSync(created.pptxPath))
  for (const name of Object.keys(files).filter(p => p.endsWith('.fntdata'))) {
    const data = Buffer.from(files[name]); data.writeUInt32LE(data.readUInt32LE(12) | 1, 12); files[name] = data
  }
  const extracted = await templates.templateFromPptx(Buffer.from(zipSync(files)), { templateId: 'variants-font', name: 'Начертания' })
  assert.deepEqual(extracted.manifest.style.fonts.map(f => f.variant), ['regular', 'bold', 'italic', 'boldItalic'])
  assert.ok(extracted.report.warnings.some(s => s.includes('подмножество')))
}))
