// Mandatory renderer command: missing runtime/fonts must fail, never skip.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync } from 'fflate'
import { fixtures, page } from '../test/fixtures/pptx/generate.mjs'
import { templateFromPptx, templateCreateOptions, buildTemplateBundle, readTemplateZip } from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import { buildDeckAsync } from '../skills/dsh-ppt/scripts/deck-advanced.mjs'
import { createFixtureConverter, fixtureRoot } from './golden-pptx-runtime.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(process.env.DSH_PPT_SYNTHETIC_OUT ?? join(root, '.test-output/pptx-synthetic-render'))
const record = process.argv.includes('--record')
if (process.argv.slice(2).some(arg => arg !== '--record')) throw new Error('Only --record is supported; output/runtime are configured with environment variables')
if (record && process.env.CI) throw new Error('CI cannot approve its own rendering baselines')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
mkdirSync(out, { recursive: true })
try {
  const { converter, version } = await createFixtureConverter()
  const expectations = JSON.parse(readFileSync(join(fixtureRoot, 'expectations.json')))
  const metadata = { renderer: { package: '@deepseek-ai/libreoffice-kit', version, backend: converter.backend, dpi: 96 },
    pageSize: page, fonts: {}, cases: [] }
  try {
    assert.equal(converter.backend, 'wasm')
    for (const name of ['Regular', 'Bold', 'Italic', 'BoldItalic']) metadata.fonts[`LiberationSans-${name}.ttf`] = hash(readFileSync(join(fixtureRoot, 'fonts', `LiberationSans-${name}.ttf`)))
    for (const fixture of fixtures()) {
      const dir = join(out, fixture.id)
      mkdirSync(dir, { recursive: true })
      const sourcePath = join(dir, 'source.pptx')
      writeFileSync(sourcePath, fixture.bytes)
      const imported = await templateFromPptx(fixture.bytes, { templateId: fixture.id, name: fixture.id, lang: 'en' })
      writeFileSync(join(dir, 'import-report.json'), JSON.stringify(imported.report, null, 2))
      const zip = buildTemplateBundle(imported.manifest, imported.assets)
      writeFileSync(join(dir, 'template.zip'), zip)
      const template = readTemplateZip(zip)
      const { create } = templateCreateOptions(template.manifest, template.assets, { title: 'Synthetic fixture', lang: 'en' })
      const slide = create.slides[0]
      delete slide.bullets; delete slide.subtitle
      slide.title = fixture.id === 'typography' ? 'Bold red\nSecond line\nNew paragraph' : 'Synthetic fixture'
      if (fixture.id === 'dense') slide.bullets = Array.from({ length: 5 }, (_, i) => `Independent block ${i + 1}`)
      if (fixture.id === 'groups') slide.bullets = ['Grouped', 'Nested', 'Same name, different ID']
      const built = await buildDeckAsync({ ...create, lang: 'en', outputDir: join(dir, 'project') })
      const actualPath = join(dir, 'actual.pptx')
      copyFileSync(built.pptxPath, actualPath)
      const actualParts = unzipSync(readFileSync(actualPath))
      assert.ok(!Object.keys(actualParts).some(name => /\.bin$/i.test(name)), 'OLE binaries must not reach the generated PPTX')
      assert.ok(!Object.values(actualParts).some(bytes => Buffer.from(bytes).includes('SYNTHETIC-OLE-DO-NOT-COPY')))
      for (const [name, inputPath] of [['source', sourcePath], ['actual', actualPath]]) {
        // Fresh destination per invocation, without deleting previous artifacts.
        const outputDir = join(dir, `${name}-render-${Date.now()}`)
        const result = await converter.renderImages({ inputPath, outputDir, dpi: 96, pages: 'all', maxPages: 1, maxDimension: 2048 })
        assert.equal(result.pageCount, 1)
        assert.equal(result.images.length, 1)
        assert.equal(result.missingFonts.length, 0, `${fixture.id}/${name}: fonts must be reproducible`)
        copyFileSync(result.images[0].path, join(dir, `${name}.png`))
        writeFileSync(join(dir, `${name}-render.json`), JSON.stringify(result, null, 2))
      }
      const layout = template.manifest.style.layouts[0]
      metadata.cases.push({ id: fixture.id, sourceSha256: hash(fixture.bytes), actualSha256: hash(readFileSync(actualPath)), regions: [...layout.textZones, ...layout.images].map(({ x, y, w, h }) => ({ x, y, w, h })), knownLimitations: expectations[fixture.id].knownLimitations })
      console.log(`Rendered ${fixture.id} through PPTX -> template ZIP -> PPTX`)
    }
  } finally { await converter.dispose() }
  writeFileSync(join(out, 'run.json'), JSON.stringify(metadata, null, 2))
  const args = [join(root, 'scripts/golden-pptx-synthetic-metrics.py'), out, join(fixtureRoot, 'render-baselines')]
  if (record) args.push('--record')
  execFileSync(process.env.DSH_PPT_GOLDEN_PYTHON ?? 'python', args, { stdio: 'inherit', timeout: 120000 })
  const { goldenScenes } = await import('./golden-pptx-scenes.mjs')
  await goldenScenes(join(out,'scenes'))
} catch (error) {
  writeFileSync(join(out, 'failure.json'), JSON.stringify({ message: error.message, stack: error.stack }, null, 2))
  throw error
}
