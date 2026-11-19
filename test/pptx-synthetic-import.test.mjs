import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { unzipSync } from 'fflate'
import * as lib from '@office-kit/pptx'
import { fixtures, page } from './fixtures/pptx/generate.mjs'
import { templateFromPptx, buildTemplateBundle, readTemplateZip } from '../skills/dsh-ppt/scripts/deck-templates.mjs'

const expected = JSON.parse(readFileSync(new URL('./fixtures/pptx/expectations.json', import.meta.url)))
const cases = fixtures()
const xml = (files, name) => Buffer.from(files[name]).toString('utf8')

test('synthetic fixture generator is independent of the plugin and deterministic', () => {
  const generator = readFileSync(new URL('./fixtures/pptx/generate.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(generator, /import .*deck-|import .*@office-kit/)
  for (const [index, fixture] of fixtures().entries()) assert.deepEqual(fixture.bytes, cases[index].bytes)
  assert.deepEqual(cases.map(f => f.id).sort(), Object.keys(expected).sort())
})

test('synthetic package hashes are reproducible across time zones', () => {
  const code = `import {fixtures} from ${JSON.stringify(new URL('./fixtures/pptx/generate.mjs', import.meta.url).href)};import {createHash} from 'node:crypto';console.log(fixtures().map(f=>createHash('sha256').update(f.bytes).digest('hex')).join(','))`
  const hashes = ['UTC', 'Pacific/Honolulu', 'Europe/Moscow'].map(TZ => execFileSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', env: { ...process.env, TZ } }))
  assert.equal(hashes[0], hashes[1]); assert.equal(hashes[0], hashes[2])
})

for (const fixture of cases) test(`synthetic import: ${fixture.id}`, async () => {
  const files = unzipSync(fixture.bytes), source = xml(files, 'ppt/slides/slide1.xml'), e = expected[fixture.id]
  assert.equal((source.match(/<p:sp>[\s\S]*?<\/p:sp>/g) ?? []).filter(shape => shape.includes('<p:txBody>')).length, e.sourceTextShapes, 'Source fixture must contain the intended number of text shapes')
  const theme = xml(files, 'ppt/theme/theme1.xml')
  for (const [list, item] of [['fillStyleLst', 'solidFill'], ['lnStyleLst', 'ln'], ['effectStyleLst', 'effectStyle'], ['bgFillStyleLst', 'solidFill']]) {
    const content = theme.match(new RegExp(`<a:${list}>([\\s\\S]*?)</a:${list}>`))?.[1] ?? ''
    assert.equal((content.match(new RegExp(`<a:${item}(?:\\s|>)`, 'g')) ?? []).length, 3, 'Theme style lists need three entries for PowerPoint compatibility')
  }
  const pres = await lib.loadPresentation(fixture.bytes)
  assert.equal(lib.getSlides(pres).length, 1)
  assert.equal(Number(lib.getSlideSize(pres).width), page.width)
  assert.equal(Number(lib.getSlideSize(pres).height), page.height)
  const imported = await templateFromPptx(fixture.bytes, { templateId: fixture.id, name: fixture.id, lang: 'en' })
  const bundle = readTemplateZip(buildTemplateBundle(imported.manifest, imported.assets))
  const layout = bundle.manifest.style.layouts[0]
  assert.deepEqual(bundle.manifest.style.pageSize, page)
  assert.equal(imported.report.slide.adapted, false)
  assert.equal(layout.textZones.length, e.zones, 'A change to known coverage requires an explicit expectation update')
  assert.equal(layout.images.length, e.images)
  assert.deepEqual(imported.report.skippedObjects.map(o => o.kind).sort(), [...e.losses].sort())
  for (const loss of imported.report.skippedObjects) {
    assert.deepEqual(loss.slides, [1]); assert.ok(loss.reason.length > 10)
  }
  if (fixture.id === 'dense') {
    assert.match(imported.report.skippedObjects[0].reason, /6/)
    assert.ok(!JSON.stringify(bundle.manifest).includes('Independent block'), 'Source content must remain refillable, not static artwork')
  }
  if (fixture.id === 'groups') {
    assert.equal((source.match(/<p:grpSp>/g) ?? []).length, 2)
    const bodies = layout.textZones.filter(z => z.kind === 'body')
    for (const [index, bounds] of e.bodyBoundsEMU.entries()) for (const [j, key] of ['x', 'y', 'w', 'h'].entries()) {
      const dimension = j % 2 === 0 ? page.width : page.height
      assert.ok(Math.abs(bodies[index][key] / 100 * dimension - bounds[j]) <= dimension * 0.0000051, `${index}.${key}: composed group transform must be retained once`)
    }
  }
  if (fixture.id === 'typography') {
    assert.match(source, /<a:br\/>/); assert.equal((source.match(/<a:p>/g) ?? []).length, 2)
    assert.match(source, /i="1"/)
    assert.equal(layout.textZones[0].textStyle.bold, true)
    assert.equal(layout.textZones[0].textStyle.color, '#CF1F2F')
    assert.equal(layout.textZones[0].textStyle.size, 18)
  }
  if (fixture.id === 'artwork') assert.equal((source.match(/<p:pic>/g) ?? []).length, 13)
  if (fixture.id === 'layers') {
    assert.ok(source.indexOf('val="CF1F2F"') < source.indexOf('val="2864B4"'), 'Blue plate is in front of the red plate in the independent source')
    assert.deepEqual(layout.images.map(image => image.z), [0, 1])
    assert.ok(layout.images[0].x < layout.images[1].x)
  }
  if (fixture.id === 'objects') {
    const shapes = lib.getSlideShapes(lib.getSlides(pres)[0])
    assert.equal(shapes.filter(lib.isTableShape).length, 1, 'Fixture must contain a recognized native table')
    assert.equal(shapes.filter(lib.isChartShape).length, 1, 'Fixture must contain a recognized native chart')
    assert.match(xml(files, 'ppt/charts/chart1.xml'), /<c:v>12<\/c:v>/)
    assert.match(source, /gridSpan="2"/); assert.match(source, /rowSpan="2"/)
    assert.match(source, /<p:oleObj\b/)
    assert.equal(xml(files, 'ppt/embeddings/inert.bin'), 'SYNTHETIC-OLE-DO-NOT-COPY')
    const zipped = unzipSync(buildTemplateBundle(imported.manifest, imported.assets))
    assert.ok(!Object.keys(zipped).some(name => /embeddings|\.bin$/i.test(name)))
    assert.ok(!Object.values(zipped).some(bytes => Buffer.from(bytes).includes('SYNTHETIC-OLE-DO-NOT-COPY')))
  }
})
