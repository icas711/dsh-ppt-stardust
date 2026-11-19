// Reproducible capability probe for the installed Office SDK, not a product API.
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { unzipSync } from 'fflate'
import * as lib from '@office-kit/pptx'
import { createFixtureConverter } from './golden-pptx-runtime.mjs'
import { capacityFixture } from '../test/fixtures/pptx/generate.mjs'

export const probeVariants = ['column', 'bar', 'line', 'pie', 'doughnut', 'area', 'stacked-column', 'percent-stacked-bar']
const labels = { font: 'Liberation Sans', sizePt: 10, color: '#202020' }
export function probeChartSpec(variant) {
  const kind = variant === 'stacked-column' ? 'column' : variant === 'percent-stacked-bar' ? 'bar' : variant
  const circular = ['pie', 'doughnut'].includes(kind)
  return { kind, categories: ['Category A', 'Category B'],
    series: [{ name: 'Actual', values: [12, 8], color: '#CF1F2F', ...(circular ? { pointColors: ['#CF1F2F', '#2864B4'] } : {}) },
      ...(!circular ? [{ name: 'Plan', values: [10, 6], color: '#2864B4' }] : [])],
    title: variant, titleStyle: labels, chartAreaFill: '#FFFFFF', plotAreaFill: '#FFFFFF',
    legend: { position: 'b', textStyle: labels },
    dataLabels: { showValue: !circular, showCategory: false, showSeriesName: false, showPercent: circular, numberFormat: circular ? '0.0%' : '0.0', textStyle: labels },
    ...(circular ? { firstSliceAngleDeg: 30, ...(kind === 'doughnut' ? { holeSizePct: 65 } : {}) }
      : { valueAxis: { min: 0, max: 24, majorUnit: 6, numberFormat: '0.0' }, categoryAxisLabelStyle: labels, valueAxisLabelStyle: labels }),
    ...(variant === 'stacked-column' ? { grouping: 'stacked' } : variant === 'percent-stacked-bar' ? { grouping: 'percentStacked', valueAxis: { min: 0, max: 1, majorUnit: 0.25, numberFormat: '0%' } } : {}) }
}
function workbooks(bytes) {
  return Object.entries(unzipSync(bytes)).filter(([name]) => name.endsWith('.xlsx')).map(([name, data]) => {
    const parts = unzipSync(data)
    const worksheet = Buffer.from(parts['xl/worksheets/sheet1.xml']).toString('utf8')
    return { name, cells: Object.fromEntries([...worksheet.matchAll(/<c\b[^>]*\br="([^"]+)"[^>]*>([\s\S]*?)<\/c>/g)].map(m => [m[1], m[2].match(/<v>(.*?)<\/v>/)?.[1] ?? ''])) }
  })
}
export async function probeCharts() {
  // Controlled master avoids unused SDK template fonts obscuring chart checks.
  const presentation = await lib.loadPresentation(capacityFixture())
  lib.clearSlideShapes(lib.getSlides(presentation)[0])
  lib.setSlideSize(presentation, { width: 9906000, height: 6858000 })
  lib.setPresentationFonts(presentation, Object.fromEntries(['majorLatin', 'majorEastAsian', 'majorComplexScript', 'minorLatin', 'minorEastAsian', 'minorComplexScript'].map(key => [key, labels.font])))
  for (let i = 0; i < probeVariants.length; i++) {
    if (i > 0 && i % 4 === 0) lib.addBlankSlide(presentation)
    const slide = lib.getSlides(presentation).at(-1)
    lib.addSlideChart(slide, { name: probeVariants[i], x: 400000 + i % 2 * 4700000, y: 300000 + Math.floor(i % 4 / 2) * 3200000, w: 4400000, h: 2900000, spec: probeChartSpec(probeVariants[i]) })
  }
  const initial = Buffer.from(await lib.savePresentation(presentation))
  const reloaded = await lib.loadPresentation(initial)
  const charts = lib.getSlides(reloaded).flatMap(slide => lib.getSlideCharts(slide))
  assert.equal(charts.length, probeVariants.length)
  const books = workbooks(initial)
  assert.equal(books.length, charts.length, 'Each native chart needs an embedded workbook for Edit Data')
  for (const [index, chart] of charts.entries()) {
    const original = probeChartSpec(probeVariants[index])
    assert.equal(chart.spec.kind, original.kind)
    assert.deepEqual(chart.spec.categories, original.categories)
    assert.deepEqual(chart.spec.series.map(s => s.values), original.series.map(s => s.values))
    assert.equal(chart.spec.legend.position, 'b')
    assert.equal(chart.spec.dataLabels.numberFormat, original.dataLabels.numberFormat)
    assert.equal(chart.spec.titleStyle.font, labels.font)
    assert.equal(chart.spec.series[0].color, '#CF1F2F')
    assert.equal(chart.spec.chartAreaFill, '#FFFFFF')
    if (original.valueAxis) { assert.equal(chart.spec.valueAxis.max, original.valueAxis.max); assert.equal(chart.spec.valueAxis.numberFormat, original.valueAxis.numberFormat) }
    if (original.holeSizePct) assert.equal(chart.spec.holeSizePct, 65)
    if (original.grouping) assert.equal(chart.spec.grouping, original.grouping)
  }
  assert.equal(books[0].cells.B2, '12'); assert.equal(books[0].cells.B3, '8')
  const originalBounds = lib.getShapeBounds(charts[0].shape)
  const spec = probeChartSpec('column')
  spec.series[0].values = [18, 4]
  lib.setChartSpec(charts[0], spec)
  const updated = Buffer.from(await lib.savePresentation(reloaded))
  const final = await lib.loadPresentation(updated)
  const first = lib.getSlideCharts(lib.getSlides(final)[0])[0]
  assert.deepEqual(first.spec.series[0].values, [18, 4])
  assert.deepEqual(lib.getShapeBounds(first.shape), originalBounds)
  const updatedBooks = workbooks(updated)
  assert.equal(updatedBooks[0].cells.B2, '18'); assert.equal(updatedBooks[0].cells.B3, '4')
  const report = { sdk: lib.VERSION, chartCount: charts.length, slideCount: lib.getSlides(final).length,
    variants: probeVariants, embeddedWorkbooks: books.length, dataUpdate: { before: [12, 8], after: first.spec.series[0].values, workbookAfter: [updatedBooks[0].cells.B2, updatedBooks[0].cells.B3] },
    verified: ['kind', 'categories', 'series values', 'series colors', 'title font', 'legend', 'data labels', 'axis scale/format', 'doughnut hole', 'stacking', 'geometry on update', 'XLSX values on update'],
    decision: 'Use the SDK native chart API and setChartSpec; no custom chart OOXML writer is needed for these variants.' }
  return { initial, updated, report }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const out = resolve(process.argv.slice(2).find(arg => !arg.startsWith('--')) ?? '.test-output/chart-capabilities')
  mkdirSync(out, { recursive: true })
  const result = await probeCharts()
  for (const key of ['initial', 'updated']) writeFileSync(join(out, `${key}.pptx`), result[key])
  if (process.argv.includes('--render')) {
    const { converter } = await createFixtureConverter()
    try {
      const renders = []
      for (const key of ['initial', 'updated']) {
        const render = await converter.renderImages({ inputPath: join(out, `${key}.pptx`), outputDir: join(out, `${key}-render-${Date.now()}`), dpi: 96 })
        assert.equal(render.pageCount, 2); assert.deepEqual(render.missingFonts, [])
        renders.push({ ...render, hashes: render.images.map(image => createHash('sha256').update(readFileSync(image.path)).digest('hex')) })
      }
      assert.notEqual(renders[0].hashes[0], renders[1].hashes[0], 'Data change must change chart pixels')
      assert.equal(renders[0].hashes[1], renders[1].hashes[1], 'Updating first chart must preserve the other slide')
      result.report.render = { backend: converter.backend, dataChangeVisible: true, otherSlideUnchanged: true }
      writeFileSync(join(out, 'renders.json'), JSON.stringify(renders, null, 2) + '\n')
    } finally { await converter.dispose() }
  }
  writeFileSync(join(out, 'report.json'), JSON.stringify(result.report, null, 2) + '\n')
  console.log(JSON.stringify(result.report, null, 2))
}
