// Shared test runtime: explicit fonts and one portable engine on every host.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const fixtureRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../test/fixtures/pptx')
export async function createFixtureConverter() {
  const runtime = resolve(process.env.DSH_PPT_RENDER_RUNTIME ?? join(fixtureRoot, 'render-runtime'))
  const requireRuntime = createRequire(join(runtime, 'package.json'))
  const kit = await import(pathToFileURL(requireRuntime.resolve('@deepseek-ai/libreoffice-kit')).href)
  assert.equal(kit.ENGINE_VERSION, '0.2.3', 'Renderer version is pinned')
  const converter = await kit.createConverter({ timeoutMs: 120000, fontMetadataCacheDirectory: false,
    fontDirectories: [join(fixtureRoot, 'fonts')], resolveEnginePackage: name => {
      if (name !== '@deepseek-ai/libreoffice-kit-wasm') throw Object.assign(new Error('Synthetic acceptance uses WASM'), { code: 'MODULE_NOT_FOUND' })
      return requireRuntime.resolve(`${name}/package.json`)
    } })
  if (converter.backend !== 'wasm') { await converter.dispose(); throw new Error('Portable acceptance requires WASM') }
  return { converter, version: kit.ENGINE_VERSION }
}
