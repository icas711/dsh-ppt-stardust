import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {PptCoaching} from '../lib/coaching.js'
import {applyVisualActions} from '../skills/dsh-ppt/scripts/deck-visual.mjs'
const elements=[{id:'heading',type:'text',role:'content',frame:{x:2000000,y:2000000,w:2000000,h:500000},paragraphs:[{runs:[{text:'Revenue 12',style:{bold:true,color:'#CC0000',size:18}}]}]},{id:'keep',type:'text',frame:{x:100000,y:100000,w:1000000,h:500000},paragraphs:[{runs:[{text:'Keep'}]}]}]
test('scene visual repairs address one object and preserve all content and neighbouring styles',()=>{
 const manifest={slides:[{id:'slide',layout:'scene',elements}]},before=structuredClone(manifest)
 const slides=applyVisualActions(manifest,[{slideId:'slide',elementId:'heading',type:'element-text-size',value:24}])
 assert.deepEqual(manifest,before);assert.deepEqual(slides[0].elements[1],elements[1]);assert.equal(slides[0].elements[0].paragraphs[0].runs[0].text,'Revenue 12');assert.equal(slides[0].elements[0].paragraphs[0].runs[0].style.color,'#CC0000');assert.equal(slides[0].elements[0].paragraphs[0].runs[0].style.size,24)
 assert.throws(()=>applyVisualActions(manifest,[{slideId:'slide',type:'body-size',value:20}]),/elementId/)
})
test('scene rehearsal retains object evidence over multiple rounds and never proposes incompatible legacy patches',async t=>{
 const root=mkdtempSync(join(tmpdir(),'scene-coaching-'));t.after(()=>rmSync(root,{recursive:true,force:true}))
 const seen=[],route={provider:'test',model:'test'}
 const service=new PptCoaching(root,{routes:async()=>[route],generate:async(_route,_policy,input)=>{const data=JSON.parse(input);seen.push(data);return JSON.stringify({findings:[{slideId:'slide',kind:'expression',issue:'Wording',suggestion:'Review wording',question:'What supports it?',answer:'Revenue 12',reference:'slide:slide',quote:'Revenue 12',patch:{title:'New title'}}]})}})
 t.after(()=>service.dispose())
 const context={id:'project',manifest:{deckId:'deck',revision:0,title:'Report',slides:[{id:'slide',layout:'scene',label:'Report',elements}]}}
 const run=await service.create(context,{confirmed:true,mode:'review',difficulty:'normal',limit:2,...route})
 await service.step(context,run.id,{confirmed:true});await service.step(context,run.id,{confirmed:true})
 assert.equal(seen.length,2)
 for(const input of seen){assert.equal(input.slides[0].elements[0].text,'Revenue 12');assert.ok(!JSON.stringify(input.slides).includes('2000000'))}
 const report=service.get(context,run.id);assert.ok(report.findings[0].grounded);assert.equal(report.findings[0].patch,undefined)
})
