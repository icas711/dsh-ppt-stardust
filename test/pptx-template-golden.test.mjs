// Opt-in real application regression. Supply a local source presentation:
// DSH_PPT_GOLDEN_SOURCE=<example.pptx> node --test test/pptx-template-golden.test.mjs
// Requires Windows PowerPoint and Python with Pillow/numpy/scikit-image.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import * as lib from '@office-kit/pptx'
import { templateFromPptx, templateCreateOptions, buildTemplateBundle, readTemplateZip } from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import { buildDeckAsync } from '../skills/dsh-ppt/scripts/deck-advanced.mjs'

const source = process.env.DSH_PPT_GOLDEN_SOURCE
test('native PowerPoint golden: template round trip with original content', { skip: !source || process.platform !== 'win32', timeout: 300000 }, async () => {
  const out = resolve(process.env.DSH_PPT_GOLDEN_OUT ?? '.test-output/golden-template-final')
  mkdirSync(out, { recursive: true })
  const original = readFileSync(source)
  writeFileSync(join(out, 'source.pptx'), original)
  const imported = await templateFromPptx(original, { templateId: 'golden-example', name: 'Golden example', lang: 'ru' })
  writeFileSync(join(out, 'import-report.json'), JSON.stringify(imported.report, null, 2))
  const zip = buildTemplateBundle(imported.manifest, imported.assets)
  writeFileSync(join(out, 'template.zip'), zip)
  const template = readTemplateZip(zip)
  const { create } = templateCreateOptions(template.manifest, template.assets, { title: 'Golden', lang: 'ru' })
  const pres = await lib.loadPresentation(original), sourceSlides = lib.getSlides(pres)
  assert.ok(sourceSlides.length > 0, 'The fixture must contain slides')
  assert.equal(create.slides.length, sourceSlides.length, 'Every source slide must produce an output slide')
  const slides = []
  for (const [index, slide] of sourceSlides.entries()) {
    const layout = template.manifest.style.layouts.find(l => l.id === template.manifest.outline[index].layoutId)
    const regions = [], body = [], unmapped = [], inventory = {}, matched = new Map()
    delete create.slides[index].bullets
    delete create.slides[index].subtitle
    // Walk nested groups in slide coordinates, as the importer does. Never copy
    // original OOXML or rasterize content into a background to improve the score.
    const project = (b, t) => !b || !t ? b : ({ x: t.x + Number(b.x) * t.sx, y: t.y + Number(b.y) * t.sy, w: Number(b.w) * t.sx, h: Number(b.h) * t.sy })
    const visited = new Set()
    const walk = function* (shapes, transform) {
      for (const shape of shapes) {
        const id = lib.getShapeId(shape)
        if (visited.has(id)) continue // The library also exposes flat copies of group descendants.
        visited.add(id)
        if (lib.getShapeKind(shape) === 'group') {
          inventory.group = (inventory.group ?? 0) + 1
          const t = lib.getGroupTransform(shape)
          const sx = Number(t.outer.w) / (Number(t.inner.w) || 1), sy = Number(t.outer.h) / (Number(t.inner.h) || 1)
          const offset = project({ x: Number(t.outer.x) - Number(t.inner.x) * sx, y: Number(t.outer.y) - Number(t.inner.y) * sy, w: 0, h: 0 }, transform)
          yield* walk(lib.getGroupChildren(shape), { x: Number(offset.x), y: Number(offset.y), sx: sx * (transform?.sx ?? 1), sy: sy * (transform?.sy ?? 1) })
        } else yield { shape, bounds: project(lib.getShapeBoundsResolved(pres, shape), transform) }
      }
    }
    for (const { shape, bounds } of walk(lib.getSlideShapes(slide))) {
      if (['sldNum', 'dt', 'ftr', 'hdr'].includes(lib.getShapePlaceholderType(shape))) continue
      const kind = lib.isTableShape(shape) ? 'table' : lib.isChartShape(shape) ? 'chart' : /<p:oleObj\b/.test(lib.getShapeXmlString(shape)) ? 'ole' : lib.getShapeKind(shape)
      inventory[kind] = (inventory[kind] ?? 0) + 1
      const value = lib.getShapeText(shape).trim()
      if (!bounds) { unmapped.push({ kind, name: lib.getShapeName(shape), reason: 'Missing bounds' }); continue }
      const size = lib.getSlideSize(pres)
      const x = Number(bounds.x) / Number(size.width) * 100, y = Number(bounds.y) / Number(size.height) * 100
      const w = Number(bounds.w) / Number(size.width) * 100, h = Number(bounds.h) / Number(size.height) * 100
      const zone = layout.textZones.find(z => Math.abs(z.x - Math.max(0, x)) < 0.01 && Math.abs(z.y - Math.max(0, y)) < 0.01 && Math.abs(z.w - (Math.min(100, x + w) - Math.max(0, x))) < 0.01 && Math.abs(z.h - (Math.min(100, y + h) - Math.max(0, y))) < 0.01 && (value ? z.kind !== 'image' : z.kind === 'image'))
      if (value || ['table', 'chart', 'picture', 'ole'].includes(kind)) regions.push({ kind: value ? 'text' : kind, name: lib.getShapeName(shape), mapped: Boolean(zone), x, y, w, h })
      if (!value) {
        if (kind === 'picture' && zone && zone === layout.textZones.find(z => z.kind === 'image') && !create.slides[index].image) {
          const bytes = lib.getShapeImageBytes(shape)
          if (bytes) {
            const mime = bytes[0] === 0x89 ? 'image/png' : bytes[0] === 0xff ? 'image/jpeg' : null
            if (mime) {
              create.slides[index].layout = 'image-right'
              create.slides[index].image = { src: `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`, fit: 'contain', alt: lib.getShapeName(shape) }
              continue
            }
          }
        }
        if (['table', 'chart', 'ole', 'graphicFrame'].includes(kind) || kind === 'picture' && zone) unmapped.push({ kind, name: lib.getShapeName(shape), reason: kind === 'picture' ? 'Only the first raster image slot can be filled by the slide model' : 'No imported content slot for this object type' })
        continue
      }
      if (!zone || matched.has(zone)) { unmapped.push({ kind: 'text', name: lib.getShapeName(shape), reason: 'No unique imported slot', text: value }); continue }
      matched.set(zone, value)
    }
    let titleFilled = false
    for (const zone of layout.textZones) {
      const value = matched.get(zone) ?? ''
      if (zone.kind === 'title') {
        if (!titleFilled) { create.slides[index].title = value; titleFilled = true }
        else if (value) unmapped.push({ kind: 'text', reason: 'Slide model supports one title', text: value })
      } else if (zone.kind === 'body') body.push(value)
    }
    if (create.slides[index].layout === 'cover' && body.length === 1) create.slides[index].subtitle = body[0]
    else if (body.length) create.slides[index].bullets = body
    slides.push({ regions, inventory, unmapped, textSlots: matched.size })
  }
  const built = await buildDeckAsync({ ...create, lang: 'ru', outputDir: join(out, 'project') })
  copyFileSync(built.pptxPath, join(out, 'actual.pptx'))
  const digest = bytes => createHash('sha256').update(bytes).digest('hex')
  writeFileSync(join(out, 'inputs.json'), JSON.stringify({ slides, files: {
    source: { path: resolve(source), sha256: digest(original) },
    template: { path: join(out, 'template.zip'), sha256: digest(zip) },
    actual: { path: join(out, 'actual.pptx'), sha256: digest(readFileSync(join(out, 'actual.pptx'))) },
  } }, null, 2))
  // Isolate native renderers: PowerPoint caches font substitutions per process,
  // which otherwise makes a missing-font result depend on document open order.
  for (const key of ['source', 'actual']) for (let attempt = 0; ; attempt++) {
    try {
      execFileSync('pwsh.exe', ['-NoProfile', '-File', fileURLToPath(new URL('../scripts/golden-pptx-render.ps1', import.meta.url)), '-SourcePath', join(out, 'source.pptx'), '-ActualPath', join(out, 'actual.pptx'), '-OutputDirectory', out, '-Only', key], { timeout: 60000, stdio: 'pipe' })
      break
    } catch (error) {
      // Office can briefly reject COM while finishing a previous render/quit.
      // Retry only that transient transport error, never a golden mismatch.
      if (attempt >= 2 || !/RPC_E_CALL_REJECTED|0x80010001/.test(String(error.stderr))) throw error
      await new Promise(resolve => setTimeout(resolve, 300))
    }
  }
  const native = ['source', 'actual'].flatMap(key => JSON.parse(readFileSync(join(out, `${key}-properties.json`), 'utf8').replace(/^\uFEFF/, '')))
  writeFileSync(join(out, 'native-properties.json'), JSON.stringify(native, null, 2))
  const nativeDifferences = [], consumed = new Set()
  const textKey = text => text.replace(/\r\n?|\v/g, '\n').trim()
  for (const expected of native.filter(p => p.deck === 'source' && !p.excludedField)) {
    const actual = native.find(p => p.deck === 'actual' && !consumed.has(p) && p.slide === expected.slide && textKey(p.text) === textKey(expected.text))
    if (!actual) { nativeDifferences.push({ slide: expected.slide, name: expected.name, reason: 'Original text missing or changed', text: expected.text }); continue }
    consumed.add(actual)
    for (const key of ['sizePt', 'bold', 'colorRgb', 'alignment', 'marginLeftPt', 'marginTopPt']) if (Math.abs(actual[key] - expected[key]) >= 0.0001) nativeDifferences.push({ slide: expected.slide, name: expected.name, property: key, expected: expected[key], actual: actual[key] })
  }
  writeFileSync(join(out, 'native-differences.json'), JSON.stringify(nativeDifferences, null, 2))
  const report = JSON.parse(execFileSync(process.env.DSH_PPT_GOLDEN_PYTHON ?? 'python', [fileURLToPath(new URL('../scripts/golden-pptx-metrics.py', import.meta.url)), out], { timeout: 120000, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }))
  assert.ok(report.passed && nativeDifferences.length === 0, `Golden mismatch: see ${join(out, 'report.md')}`)
})
