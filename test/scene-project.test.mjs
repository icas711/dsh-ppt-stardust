import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {buildDeckAsync,editDeck,readDeckProject,undoDeck,previewDeckHtml} from '../skills/dsh-ppt/scripts/deck-advanced.mjs'
const scene={id:'source-id',layout:'scene',label:'Report',elements:Array.from({length:13},(_,i)=>({id:'text-'+i,type:'text',frame:{x:100000,y:100000+i*220000,w:3000000,h:200000},textStyle:{size:12,color:'#CC0000',bold:true},paragraphs:[{runs:[{text:'Block '+i}]}]}))}
test('scene projects create, read, edit, duplicate, save a copy and undo without dropping any objects',async t=>{
 const root=mkdtempSync(join(tmpdir(),'ppt-scene-project-'));t.after(()=>rmSync(root,{recursive:true,force:true}))
 const created=await buildDeckAsync({title:'Scene',theme:'swiss',lang:'ru',slides:[scene],outputDir:root})
 const path=created.jsonPath,original=readFileSync(path)
 let project=readDeckProject({deckPath:path}).manifest
 assert.equal(project.schemaVersion,2);assert.equal(project.slides[0].elements.length,13)
 assert.deepEqual(readFileSync(path),original)
 const id=project.slides[0].id
 const elements=structuredClone(project.slides[0].elements);elements[12].paragraphs[0].runs[0].text='Changed'
 await editDeck({deckPath:path,expectedRevision:0,edits:[{slide:id,patch:{elements}}]})
 project=readDeckProject({deckPath:path}).manifest
 assert.equal(project.revision,1);assert.equal(project.history[0].slides[0].elements.length,13)
 assert.equal(project.slides[0].id,id)
 await assert.rejects(editDeck({deckPath:path,expectedRevision:0,edits:[{slide:id,patch:{label:'stale'}}]}))
 await undoDeck({deckPath:path,expectedRevision:1})
 project=readDeckProject({deckPath:path}).manifest
 assert.equal(project.slides[0].elements[12].paragraphs[0].runs[0].text,'Block 12')
 const copy=await editDeck({deckPath:path,expectedRevision:2,saveAs:true,duplicate:[id]})
 project=readDeckProject({deckPath:copy.jsonPath}).manifest
 assert.equal(project.slides.length,2);assert.equal(project.schemaVersion,2);assert.equal(project.slides[1].elements.length,13)
 assert.ok(previewDeckHtml({title:'Preview',slides:[scene]}).html.includes('Block 12'))
})
