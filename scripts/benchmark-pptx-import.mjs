// Diagnostic benchmark. Timings are observations, never CI timing assertions.
import { performance } from 'node:perf_hooks'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import * as lib from '@office-kit/pptx'
import { capacityFixture } from '../test/fixtures/pptx/generate.mjs'
import { templateFromPptx } from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import { createFixtureConverter } from './golden-pptx-runtime.mjs'

const out = resolve(process.argv.slice(2).find(arg => !arg.startsWith('--')) ?? '.test-output/import-capacity')
mkdirSync(out, { recursive: true })
const cases = [{ blocks: 10 }, { blocks: 30 }, { blocks: 100 }, { blocks: 256 }, { images: 13 }, { images: 30 }, { images: 128 }, { blocks: 100, images: 30 }, { blocks: 10, depth: 16 }]
const results = []
const { converter } = process.argv.includes('--render') ? await createFixtureConverter() : { converter: null }
try {
for (const request of cases) {
  global.gc?.()
  const before = process.memoryUsage(), bytes = capacityFixture(request)
  const start = performance.now(), pres = await lib.loadPresentation(bytes), loaded = performance.now()
  // The reader exposes flat copies of descendants. IDs identify actual objects.
  const shapes = [...new Map(lib.getSlideShapes(lib.getSlides(pres)[0]).map(s => [lib.getShapeId(s), s])).values()]
  const projection = shapes.map(shape => ({ id: String(lib.getShapeId(shape)), type: lib.getShapeKind(shape), frame: lib.getShapeBoundsResolved(pres, shape), text: lib.getShapeText(shape) }))
  const imported = await templateFromPptx(bytes, { templateId: 'capacity-probe', name: 'Capacity probe', lang: 'en' })
  const end = performance.now(), memory = process.memoryUsage()
  const row = { request, inputBytes: bytes.length, sourceObjects: shapes.length, fullPlainProjectionBytes: Buffer.byteLength(JSON.stringify(projection)),
    currentTemplateJSONBytes: Buffer.byteLength(JSON.stringify(imported.manifest)), uniqueAssetCount: Object.keys(imported.assets).length,
    uniqueAssetBytes: Object.values(imported.assets).reduce((sum, data) => sum + data.bytes.length, 0),
    currentSlots: imported.manifest.style.layouts[0].textZones.length, currentImages: imported.manifest.style.layouts[0].images.length,
    knownLossKinds: imported.report.skippedObjects.map(o => o.kind), readMs: +(loaded - start).toFixed(2), importMs: +(end - loaded).toFixed(2),
    heapDeltaBytes: memory.heapUsed - before.heapUsed, rssAtEndBytes: memory.rss }
  const name = `blocks-${request.blocks ?? 0}-images-${request.images ?? 0}-depth-${request.depth ?? 0}`
  const inputPath = join(out, `${name}.pptx`)
  writeFileSync(inputPath, bytes)
  if (converter) {
    const renderStart = performance.now()
    const rendered = await converter.renderImages({ inputPath, outputDir: join(out, `${name}-render-${Date.now()}`), dpi: 96, maxPages: 1 })
    if (rendered.pageCount !== 1 || rendered.missingFonts.length) throw new Error('Capacity input failed portable rendering')
    row.renderMs = +(performance.now() - renderStart).toFixed(2)
  }
  results.push(row)
  console.log(JSON.stringify(row))
}
} finally { await converter?.dispose() }
writeFileSync(join(out, 'report.json'), JSON.stringify({ node: process.version, platform: process.platform, gcExposed: Boolean(global.gc),
  note: 'Current importer still truncates to 6 slots/12 images. Full plain projection is only a size estimate, not the future rich model or its peak memory. Timings include reader work and are not performance guarantees.', results }, null, 2) + '\n')
