import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, statSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { normalizeLegacyProjectEnvelope, nextProjectRevision } from '../skills/dsh-ppt/scripts/deck-migrations.mjs'
import { buildDeck } from '../skills/dsh-ppt/scripts/deck-core.mjs'
import { readDeckProject, editDeck, undoDeck } from '../skills/dsh-ppt/scripts/deck-advanced.mjs'

const fingerprint = 'a'.repeat(64)
const slide = id => ({layout:'bullets',title:'Title',bullets:['Body'],notes:'Keep\nnotes', ...(id !== undefined ? {id} : {})})
const project = () => ({title:'Legacy',theme:'data',language:'en',slides:[slide()]})

test('project envelope preparation preserves known identity, provenance, assets and every history snapshot', () => {
  const source = {...project(),schemaVersion:1,deckId:'known-deck',revision:7,slides:[slide('known-slide')],
    dataModel:{fingerprint:'keep-data-fingerprint',sources:[{id:'source',content:'Keep evidence'}],metrics:[{id:'m',kind:'source',source:{sourceId:'source',line:1}}]},
    template:{id:'user:test',revision:4},assets:{image:{mime:'image/png',data:'keep bytes'}},artifacts:{html:'keep-hash',pptx:'keep-hash'},
    delivery:{base:'C:/output/deck'},history:[{title:'Prior',theme:'data',language:'en',slides:[slide('known-slide')],dataModel:{fingerprint:'prior-fingerprint'}}]}
  const before = structuredClone(source)
  const normalized = normalizeLegacyProjectEnvelope(source, {fingerprint})
  assert.deepEqual(source,before)
  assert.deepEqual(normalized,source)
  assert.notEqual(normalized.slides,source.slides)
  assert.notEqual(normalized.history,source.history)
  assert.deepEqual(normalizeLegacyProjectEnvelope(normalized, {fingerprint}),normalized)
})

test('missing legacy IDs are deterministic and collision-free in current and historical states', () => {
  const source = {...project(),slides:[slide(),slide('legacy-slide-1'),slide()],history:[{...project(),slides:[slide(),slide()]}]}
  const normalized = normalizeLegacyProjectEnvelope(source, {fingerprint})
  assert.equal(normalized.deckId,'legacy-'+fingerprint.slice(0,32))
  assert.deepEqual(normalized.slides.map(s=>s.id),['legacy-slide-1-1','legacy-slide-1','legacy-slide-3'])
  assert.deepEqual(normalized.history[0].slides.map(s=>s.id),['legacy-slide-1','legacy-slide-2'])
  assert.equal(normalized.revision,0)
  assert.equal(normalized.schemaVersion,undefined,'Reading must not silently change a schema version')
  assert.deepEqual(normalizeLegacyProjectEnvelope(source,{fingerprint}),normalized)
  assert.throws(()=>normalizeLegacyProjectEnvelope(source),{code:'missing-source-fingerprint'})
  for (const changes of [{schemaVersion:2},{schemaVersion:99},{revision:-1},{revision:1.5},{revision:Number.MAX_SAFE_INTEGER+1},{deckId:1}]) assert.throws(()=>normalizeLegacyProjectEnvelope({...source,...changes},{fingerprint}))
  assert.throws(()=>normalizeLegacyProjectEnvelope({...source,slides:[slide('same'),slide('same')]},{fingerprint}),{code:'duplicate-slide-id',path:'slides[1].id'})
  assert.throws(()=>normalizeLegacyProjectEnvelope({...source,history:[{...project(),slides:[slide('same'),slide('same')]}]},{fingerprint}),{code:'duplicate-slide-id',path:'history[0].slides[1].id'})
  assert.throws(()=>normalizeLegacyProjectEnvelope({...source,history:[{...project(),schemaVersion:2}]},{fingerprint}),{code:'unsupported-project-schema'})
  assert.throws(()=>normalizeLegacyProjectEnvelope({...source,history:Array(21).fill(project())},{fingerprint}),{code:'invalid-project-history'})
  assert.equal(nextProjectRevision(7),8)
  assert.throws(()=>nextProjectRevision(Number.MAX_SAFE_INTEGER),{code:'invalid-revision'})
})

test('reading an anonymous legacy project is stable and read-only; a safe copy and undo retain its IDs', async t => {
  const root = mkdtempSync(join(tmpdir(),'ppt-legacy-migration-'))
  t.after(()=>rmSync(root,{recursive:true,force:true}))
  const output = buildDeck({title:'Legacy',outputDir:root,slides:[{layout:'bullets',title:'Before',bullets:['Original'],notes:'Notes'}]})
  const before = readFileSync(output.jsonPath), modified = statSync(output.jsonPath,{bigint:true}).mtimeNs
  const first = readDeckProject({deckPath:output.jsonPath}).manifest
  const second = readDeckProject({deckPath:output.jsonPath}).manifest
  assert.deepEqual(first,second)
  assert.deepEqual(readFileSync(output.jsonPath),before)
  assert.equal(statSync(output.jsonPath,{bigint:true}).mtimeNs,modified)
  const id = first.slides[0].id
  const copy = await editDeck({deckPath:output.jsonPath,expectedRevision:0,saveAs:true,preserveUndo:true,edits:[{slide:id,patch:{title:'After'}}]})
  const saved = readDeckProject({deckPath:copy.jsonPath}).manifest
  assert.notEqual(saved.deckId,first.deckId)
  assert.equal(saved.schemaVersion,1); assert.equal(saved.revision,0)
  assert.equal(saved.slides[0].id,id); assert.equal(saved.slides[0].title,'After')
  assert.equal(saved.history[0].slides[0].id,id); assert.equal(saved.history[0].slides[0].title,'Before')
  await assert.rejects(editDeck({deckPath:copy.jsonPath,expectedRevision:99,edits:[{slide:id,patch:{title:'Stale'}}]}),/revision=0/)
  await undoDeck({deckPath:copy.jsonPath,expectedRevision:0})
  const undone = readDeckProject({deckPath:copy.jsonPath}).manifest
  assert.equal(undone.revision,1); assert.equal(undone.slides[0].id,id)
  assert.equal(undone.slides[0].title,'Before'); assert.equal(undone.slides[0].notes,'Notes')
  assert.deepEqual(readFileSync(output.jsonPath),before)
})

test('unsupported project versions and invalid historical identities fail without modifying the source', t => {
  const root = mkdtempSync(join(tmpdir(),'ppt-legacy-invalid-'))
  t.after(()=>rmSync(root,{recursive:true,force:true}))
  const file = join(root,'project.json')
  for (const input of [{...project(),schemaVersion:2}, {...project(),history:[{...project(),slides:[slide('dup'),slide('dup')]}]}]) {
    const bytes = JSON.stringify(input)
    writeFileSync(file,bytes)
    assert.throws(()=>readDeckProject({deckPath:file}))
    assert.equal(readFileSync(file,'utf8'),bytes)
  }
})
