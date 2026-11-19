import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { buildDeckAsync, checkDeck, editDeck, undoDeck } from '../skills/dsh-ppt/scripts/deck-advanced.mjs'
import { renderDeck, readRenderReceipt } from '../skills/dsh-ppt/scripts/deck-render.mjs'
import { cleanupRenderCache, pluginStorageDir, renderCacheDir, reserveRenderCache, RENDER_RETENTION_MS, touchRenderCache } from '../skills/dsh-ppt/scripts/deck-storage.mjs'
import { PptWorkbench, PPT_DOWNLOAD_ROUTE } from '../lib/workbench.js'
import * as engine from '../skills/dsh-ppt/scripts/deck-advanced.mjs'
import { unzipSync } from 'fflate'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE1cAAAAASUVORK5CYII=', 'base64')
const fakeKit = async () => ({ ENGINE_VERSION: '0.2.3', createConverter: async () => ({ backend: 'native', dispose: async () => {},
  convert: async ({ outputPath }) => { writeFileSync(outputPath, '%PDF-1.7\nrendered fixture\n%%EOF'); return { missingFonts: [] } },
  renderImages: async ({ inputPath, outputDir }) => {
    mkdirSync(outputDir)
    const path = join(outputDir, 'page-0001.png'); writeFileSync(path, png)
    return { sourceSha256: hash(readFileSync(inputPath)), pageCount: 1, images: [{ path, page: 1, width: 1, height: 1 }], missingFonts: [] }
  },
}) })

function fixture(t) {
  const parent = resolve('.test-output'); mkdirSync(parent, { recursive: true })
  const root = mkdtempSync(join(parent, 'managed-')), previous = process.env.DSH_HOME
  process.env.DSH_HOME = join(root, 'profile')
  t.after(() => {
    if (previous === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = previous
    assert.equal(dirname(root), parent); rmSync(root, { recursive: true, force: true })
  })
  return { root, outputDir: join(root, 'delivery'), title: 'Отчёт', fileName: 'отчёт & данные', internalProject: true, lang: 'ru',
    slides: [{ layout: 'cover', title: 'План согласован' }] }
}

test('new delivery keeps only HTML/PDF/PPTX outside the plugin; editing, copies, undo and workbench still resolve permanent JSON', async t => {
  const f = fixture(t)
  const created = await buildDeckAsync({ ...f, renderPdf: options => renderDeck(options, fakeKit) })
  assert.equal(created.pdfWarning, undefined)
  assert.ok(created.jsonPath.startsWith(join(pluginStorageDir(), 'projects')))
  assert.deepEqual(readdirSync(f.outputDir).sort(), ['отчёт-&-данные.html', 'отчёт-&-данные.pdf', 'отчёт-&-данные.pptx'])
  assert.ok(!readFileSync(created.htmlPath, 'utf8').includes('id="download-project"'))
  assert.equal(checkDeck({ deckPath: created.jsonPath }).errorCount, 0)
  const cache = readdirSync(renderCacheDir())
  assert.equal(cache.length, 1)
  const receipt = join(renderCacheDir(), cache[0], 'render', 'artifacts', 'render-receipt.json')
  assert.equal(readRenderReceipt(created.pptxPath, receipt).ok, true)
  assert.deepEqual(readFileSync(created.pdfPath), readFileSync(join(dirname(receipt), 'document.pdf')))

  const wb = new PptWorkbench({ catalogPath: join(f.root, 'catalog.jsonl'), loadEngine: async () => engine })
  await wb.remember(created, {})
  const id = (await wb.action({ operation: 'list' })).projects[0].id
  const response = await wb.fetchDownload(new Request('http://local' + PPT_DOWNLOAD_ROUTE + '?id=' + id + '&kind=bundle&revision=0'))
  assert.equal(response.status, 200)
  const entries = Object.keys(unzipSync(new Uint8Array(await response.arrayBuffer())))
  assert.deepEqual(entries.sort(), readdirSync(f.outputDir).sort())
  const share = await wb.fetchDownload(new Request('http://local' + PPT_DOWNLOAD_ROUTE + '?id=' + id + '&kind=share&revision=0'))
  assert.deepEqual(Object.keys(unzipSync(new Uint8Array(await share.arrayBuffer()))).sort(), entries.sort())
  const pdfDownload = await wb.fetchDownload(new Request('http://local' + PPT_DOWNLOAD_ROUTE + '?id=' + id + '&kind=pdf&revision=0'))
  assert.equal(pdfDownload.headers.get('content-type'), 'application/pdf')

  const changed = await editDeck({ deckPath: created.jsonPath, expectedRevision: 0, edits: [{ slide: 1, patch: { title: 'План обновлён' } }] })
  assert.equal(changed.htmlPath, created.htmlPath)
  assert.equal(changed.revision, 1)
  assert.equal(checkDeck({ deckPath: changed.jsonPath }).errorCount, 0)
  // This host has no renderer installed: the old PDF must not survive a failed export.
  if (changed.pdfWarning) assert.equal(existsSync(created.pdfPath), false)
  const copy = await editDeck({ deckPath: changed.jsonPath, expectedRevision: 1, saveAs: true, edits: [{ slide: 1, patch: { title: 'Копия плана' } }] })
  assert.equal(dirname(copy.jsonPath), dirname(created.jsonPath))
  assert.notEqual(copy.pptxPath, created.pptxPath)
  assert.equal(dirname(copy.pptxPath), f.outputDir)
  const restored = await undoDeck({ deckPath: changed.jsonPath, expectedRevision: 1 })
  assert.match(readFileSync(restored.htmlPath, 'utf8'), /План согласован/)
  assert.equal(existsSync(created.jsonPath), true)
})

test('PDF failure returns usable HTML/PPTX with an explanation and leaves old projects unchanged', async t => {
  const f = fixture(t)
  const created = await buildDeckAsync({ ...f, renderPdf: async () => { throw new Error('export failed') } })
  assert.match(created.pdfWarning, /export failed/)
  assert.deepEqual(readdirSync(f.outputDir).sort(), ['отчёт-&-данные.html', 'отчёт-&-данные.pptx'])
  assert.match(JSON.parse(readFileSync(created.jsonPath)).delivery.pdfWarning, /export failed/)
  const legacy = await buildDeckAsync({ ...f, internalProject: false, fileName: 'legacy' })
  assert.equal(dirname(legacy.jsonPath), f.outputDir)
  assert.ok(readFileSync(legacy.htmlPath, 'utf8').includes('id="download-project"'))
})

test('90-day cleanup uses last use, protects permanent and foreign files, and does not follow junctions', async t => {
  const f = fixture(t), now = Date.now(), old = new Date(now - RENDER_RETENTION_MS - 1000)
  const expired = dirname(reserveRenderCache()), used = dirname(reserveRenderCache())
  for (const root of [expired, used]) utimesSync(join(root, '.last-used'), old, old)
  const permanent = join(pluginStorageDir(), 'projects', 'keep.json')
  mkdirSync(dirname(permanent), { recursive: true }); writeFileSync(permanent, '{}'); utimesSync(permanent, old, old)
  const foreign = join(renderCacheDir(), 'user-folder'); mkdirSync(foreign); writeFileSync(join(foreign, 'keep.txt'), 'keep')
  const target = join(f.root, 'outside'); mkdirSync(target); writeFileSync(join(target, 'keep.txt'), 'keep')
  const junction = join(renderCacheDir(), 'render-11111111-1111-1111-1111-111111111111')
  symlinkSync(target, junction, 'junction')
  touchRenderCache(join(used, 'render', 'artifacts', 'page.png'), new Date(now))
  cleanupRenderCache(now)
  assert.equal(existsSync(expired), false)
  for (const path of [used, permanent, foreign, junction, join(target, 'keep.txt')]) assert.equal(existsSync(path), true)
  assert.equal(lstatSync(junction).isSymbolicLink(), true)
  const usage = lstatSync(join(used, '.last-used')).mtimeMs
  assert.ok(Math.abs(usage - now) < 5)
  cleanupRenderCache(now + RENDER_RETENTION_MS + 1000)
  assert.equal(existsSync(used), false)
  assert.equal(existsSync(permanent), true)
  assert.equal(relative(f.root, permanent).startsWith('..'), false)
})

test('receipt validation and preview access refresh cache use, and starting a render sweeps expired cache only', async t => {
  const f = fixture(t)
  const created = await buildDeckAsync({ ...f, renderPdf: async () => ({ ok: false, message: 'no PDF engine' }) })
  const rendered = await renderDeck({ pptxPath: created.pptxPath, format: 'png' }, fakeKit)
  const cacheRoot = dirname(dirname(dirname(rendered.receiptPath)))
  const old = new Date(Date.now() - RENDER_RETENTION_MS - 1000)
  utimesSync(join(cacheRoot, '.last-used'), old, old)
  assert.equal(readRenderReceipt(created.pptxPath, rendered.receiptPath).ok, true)
  assert.ok(lstatSync(join(cacheRoot, '.last-used')).mtimeMs > old.getTime())
  const expired = dirname(reserveRenderCache()); utimesSync(join(expired, '.last-used'), old, old)
  const wb = new PptWorkbench({ catalogPath: join(f.root, 'catalog.jsonl'), loadEngine: async () => ({ ...engine, renderDeck: options => renderDeck(options, fakeKit) }) })
  await wb.remember(created, {})
  const id = (await wb.action({ operation: 'list' })).projects[0].id
  await wb.action({ operation: 'render', id, expectedRevision: 0 })
  assert.equal(existsSync(expired), false)
  // A preview request must keep the current render alive even without receipt revalidation.
  const roots = readdirSync(renderCacheDir()).map(name => join(renderCacheDir(), name)).filter(path => path !== cacheRoot)
  assert.equal(roots.length, 1)
  utimesSync(join(roots[0], '.last-used'), old, old)
  const page = await wb.action({ operation: 'page', id, page: 1, expectedRevision: 0 })
  assert.ok(page.data.startsWith('data:image/png;base64,'))
  assert.ok(lstatSync(join(roots[0], '.last-used')).mtimeMs > old.getTime())
  cleanupRenderCache()
  assert.equal(existsSync(created.jsonPath), true)
  assert.equal(existsSync(created.pptxPath), true)
})


test('two sessions in the same cwd keep final files, auto-PDF caches and ZIPs separate', async t => {
  const f=fixture(t)
  const {createPptExecutors,executionScope}=await import('../lib/execution.js')
  const {resolvePptConfig}=await import('../lib/config.js')
  const tools=createPptExecutors(resolvePptConfig({}),async()=>({...engine,
    buildDeckAsync: o=>buildDeckAsync({...o,renderPdf:r=>renderDeck(r,fakeKit)}),
    renderDeck:o=>renderDeck(o,fakeKit)}))
  const session=id=>({agent:{session:{header:{cwd:f.outputDir,id,owner:'alice'}}}})
  const sessions=[session('a'),session('b')]
  const results=await Promise.all(sessions.map(exec=>tools.create({title:'Same',content:'# Same',fileName:'same'},exec)))
  for(let i=0;i<results.length;i++) {
    const r=results[i],scope=executionScope(sessions[i])
    assert.equal(r.pdfWarning,undefined)
    assert.equal(r.outputDir,join(f.outputDir,'dsh-ppt','session-'+scope))
    assert.deepEqual(readdirSync(r.outputDir).sort(),['same.html','same.pdf','same.pptx'])
    const manifest=JSON.parse(readFileSync(r.jsonPath,'utf8'))
    assert.equal(manifest.delivery.cacheScope,scope)
    assert.equal(readdirSync(renderCacheDir(scope)).length,1)
    const rendered=await tools.render({pptxPath:r.pptxPath,format:'both'},sessions[i])
    assert.ok(rendered.receiptPath.startsWith(renderCacheDir(scope)))
    assert.equal(readRenderReceipt(r.pptxPath,rendered.receiptPath).ok,true)
    const wb=new PptWorkbench({catalogPath:join(f.root,'catalog-'+i+'.jsonl')})
    await wb.remember(r,{})
    const id=(await wb.action({operation:'list'})).projects[0].id
    const zip=await wb.fetchDownload(new Request('http://local'+PPT_DOWNLOAD_ROUTE+'?id='+id+'&kind=bundle&revision=0'))
    const entries=unzipSync(new Uint8Array(await zip.arrayBuffer()))
    assert.deepEqual(Object.keys(entries).sort(),['same.html','same.pdf','same.pptx'])
    assert.deepEqual(Buffer.from(entries['same.pptx']),readFileSync(r.pptxPath))
  }
  assert.notEqual(results[0].pptxPath,results[1].pptxPath)
  const a=dirname(reserveRenderCache(executionScope(sessions[0])))
  const b=dirname(reserveRenderCache(executionScope(sessions[1])))
  const old=new Date(Date.now()-RENDER_RETENTION_MS-1000)
  utimesSync(join(a,'.last-used'),old,old)
  cleanupRenderCache()
  assert.equal(existsSync(a),false)
  assert.equal(existsSync(b),true)
  assert.throws(()=>reserveRenderCache('../../escape'),/Invalid render cache scope/)
})
