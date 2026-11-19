import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {buildDeckAsync,editDeck,migrateDeckToScenes,readDeckProject,undoDeck} from '../skills/dsh-ppt/scripts/deck-advanced.mjs'
test('explicit migration converts current and historical states atomically and keeps identity and undo',async t=>{
 const root=mkdtempSync(join(tmpdir(),'ppt-migrate-all-'));t.after(()=>rmSync(root,{recursive:true,force:true}))
 const made=await buildDeckAsync({title:'Migration',lang:'en',theme:'swiss',outputDir:root,slides:[{title:'Before',layout:'bullets',bullets:['Keep']}]})
 await editDeck({deckPath:made.jsonPath,expectedRevision:0,edits:[{slide:1,patch:{title:'After'}}]})
 const before=readDeckProject({deckPath:made.jsonPath}).manifest
 await migrateDeckToScenes({deckPath:made.jsonPath,expectedRevision:1})
 let current=readDeckProject({deckPath:made.jsonPath}).manifest
 assert.equal(current.schemaVersion,2);assert.equal(current.deckId,before.deckId);assert.equal(current.slides[0].id,before.slides[0].id)
 assert.ok(current.history.every(h=>h.slides.every(s=>s.layout==='scene')))
 await undoDeck({deckPath:made.jsonPath,expectedRevision:2})
 current=readDeckProject({deckPath:made.jsonPath}).manifest;assert.equal(current.schemaVersion,2)
 assert.ok(JSON.stringify(current.slides).includes('After'))
})
