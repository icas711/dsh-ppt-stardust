import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {runCompactGeneration,validateGenerationScenario} from '../skills/dsh-ppt/scripts/deck-generation-run.mjs'
import {recordedGenerationAdapter,runGenerationRunCli} from '../scripts/generation-run.mjs'
import {buildTemplateBundle} from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import {template,context,spec,visuals} from './fixtures/generation-components.mjs'

const recording=JSON.parse(readFileSync(new URL('./fixtures/generation-recordings.json',import.meta.url)))
const brief={version:1,goal:'Explain projects',audience:'Team',lang:'ru',templateId:'compose-test',allowMoreSlides:false,slideCount:1,attachments:[],requiredFacts:['30 videos']}
const options=()=>({mode:'B',brief:structuredClone(brief),context:structuredClone(context),template:template()})
const row=(value,stage='spec',kind='initial')=>({text:JSON.stringify(value),stage,kind})
const replay=(responses,extra={})=>runCompactGeneration({...options(),complete:recordedGenerationAdapter(structuredClone(responses)),...extra})

test('B replays a saved response, composes natively and journals exact usage without claiming acceptance',async()=>{
  const events=[],r=await replay([recording.spec],{onEvent:e=>events.push(e)})
  assert.equal(r.status,'composed');assert.equal(r.calls,1);assert.equal(r.corrections,0)
  assert.equal(r.acceptance,'not-verified');assert.equal(r.composition.create.slides.length,1)
  assert.deepEqual(events,r.journal)
  assert.deepEqual(events.find(e=>e.type==='response').response,recording.spec)
  assert.equal(events.at(-1).status,'composed')
  assert.ok(events.every((e,i)=>e.seq===i+1&&Number.isFinite(e.elapsedMs)))
})

test('C uses a validated scenario before its initial spec call',async()=>{
  const r=await replay([recording.scenario,recording.spec],{mode:'C'})
  assert.equal(r.status,'composed');assert.equal(r.calls,2);assert.equal(r.corrections,0)
  assert.deepEqual(r.journal.filter(e=>e.type==='request').map(e=>e.request.stage),['scenario','spec'])
  assert.deepEqual(r.journal.find(e=>e.type==='request'&&e.request.stage==='spec').request.scenario,r.scenario)
})

test('C shares two corrections across scenario and spec stages, with targeted slide repair',async()=>{
  const r=await replay([recording.invalidScenario,{...recording.scenario,kind:'repair'},recording.invalidSpec,recording.slideRepair],{mode:'C'})
  assert.equal(r.status,'composed');assert.equal(r.calls,4);assert.equal(r.corrections,2)
  const request=r.journal.filter(e=>e.type==='request').at(-1).request
  assert.deepEqual(request.slideIds,['slide-1']);assert.deepEqual(Object.keys(request.current),['slides'])
  assert.equal(request.brief,undefined);assert.ok(request.diagnostics.every(d=>d.slideId==='slide-1'))
})

test('C cannot reset correction budget when moving to the spec stage',async()=>{
  const r=await replay([recording.invalidScenario,{...recording.invalidScenario,kind:'repair'},{...recording.scenario,kind:'repair'},recording.invalidSpec],{mode:'C'})
  assert.equal(r.status,'budget-exhausted');assert.equal(r.calls,4);assert.equal(r.corrections,2)
  assert.equal(r.composition,null);assert.equal(r.journal.filter(e=>e.type==='response').length,4)
})

test('bad partial repair cannot change unaffected slides; unrelated sources are excluded',async()=>{
  const input=spec([visuals()[4],visuals()[6]])
  input.slides[0].visual.items[0].value='30'
  input.slides[1].visual.sourceRefs=['other']
  const fixed=structuredClone(input.slides[0]);fixed.visual.items[0].value=30
  const requests=[]
  const adapter=recordedGenerationAdapter([row(input),row({slides:[fixed,input.slides[1]]},'spec','repair'),row({slides:[fixed]},'spec','repair')])
  const r=await replay([],{brief:{...brief,slideCount:2},context:{sources:[...context.sources,{id:'other',text:'Unrelated material'}]},complete:req=>{requests.push(req);return adapter(req)}})
  assert.equal(r.status,'composed');assert.deepEqual(r.spec.slides[1],input.slides[1])
  for(const request of requests.slice(1)){
    assert.deepEqual(request.sources.map(s=>s.id),['source-1'])
    assert.deepEqual(request.current.slides.map(s=>s.id),['slide-1'])
  }
})

test('language, synthetic mode, slide count and scenario order cannot silently override brief',async()=>{
  for(const change of [s=>s.lang='en',s=>s.mode='demo',s=>s.slides.push({...s.slides[0],id:'extra'})]){
    const input=JSON.parse(recording.spec.text);change(input)
    const r=await replay([row(input),row(input,'spec','repair'),row(input,'spec','repair')])
    assert.equal(r.status,'budget-exhausted')
  }
  const input=JSON.parse(recording.spec.text);input.slides[0].id='reordered'
  const r=await replay([recording.scenario,row(input),row(input,'spec','repair'),row(input,'spec','repair')],{mode:'C'})
  assert.equal(r.diagnostics[0].code,'scenario-alignment')
})

test('factual review can request a slide repair but never implies acceptance',async()=>{
  let checks=0
  const r=await replay([recording.spec,recording.slideRepair],{reviewSpec:()=>++checks===1?[{severity:'error',code:'missing-fact',path:'spec.slides[0]',message:'Restore required fact'}]:[]})
  assert.equal(r.status,'composed');assert.equal(r.corrections,1);assert.equal(r.acceptance,'not-verified')
  const broken=await replay([recording.spec],{reviewSpec:()=>{throw new Error('Reviewer unavailable')}})
  assert.equal(broken.status,'review-error');assert.equal(broken.calls,1)
})

test('composition failure preserves facts and does not ask model to repair geometry',async()=>{
  const input=spec([{type:'cards',sourceRefs:['source-1'],items:[0,1].map(i=>({id:'i'+i,label:'Fact',detail:'Long fact '.repeat(700)}))}])
  const r=await replay([row(input)])
  assert.equal(r.status,'composition-error');assert.equal(r.calls,1);assert.equal(r.corrections,0)
  assert.equal(r.diagnostics[0].code,'component-capacity');assert.deepEqual(r.spec,input)
})

test('provider failures, cancellation and export failures keep an honest terminal journal',async()=>{
  const failed=await replay([{error:'Offline'}])
  assert.equal(failed.status,'provider-error');assert.equal(failed.calls,1)
  const controller=new AbortController();controller.abort()
  const cancelled=await replay([],{signal:controller.signal})
  assert.equal(cancelled.status,'cancelled');assert.equal(cancelled.calls,0)
  const exported=await replay([recording.spec],{exportDeck:async()=>({pptxPath:'local.pptx'})})
  assert.equal(exported.status,'exported');assert.deepEqual(exported.artifacts,{pptxPath:'local.pptx'})
  const broken=await replay([recording.spec],{exportDeck:()=>{throw new Error('Disk full')}})
  assert.equal(broken.status,'export-error');assert.equal(broken.journal.at(-1).status,'export-error')
})

test('preflight and journal persistence failures prevent further model calls',async()=>{
  let calls=0
  await assert.rejects(replay([],{brief:{...brief,templateId:'wrong'},complete:()=>calls++}),/templateId/)
  await assert.rejects(replay([],{onEvent:()=>{throw new Error('Journal unavailable')},complete:()=>calls++}),/Journal unavailable/)
  assert.equal(calls,0)
  assert.equal(validateGenerationScenario({version:1,slides:[{id:'s',purpose:'content',title:'Title',sourceRefs:['unknown']}]},context).valid,false)
  assert.equal(validateGenerationScenario({version:1,slides:[{id:'s',purpose:'content',title:'Title',sourceRefs:['source-1'],code:'bad'}]},context).valid,false)
})

test('offline CLI preserves inputs, JSONL and real export, rejects overwrite and reports unused recordings',async t=>{
  const root=mkdtempSync(join(tmpdir(),'generation-run-'));t.after(()=>rmSync(root,{recursive:true,force:true}))
  writeFileSync(join(root,'template.zip'),buildTemplateBundle(template().manifest,{}))
  writeFileSync(join(root,'request.json'),JSON.stringify({mode:'C',brief,context,template:{format:'zip',path:'template.zip'}}))
  writeFileSync(join(root,'responses.json'),JSON.stringify({version:1,responses:[recording.scenario,recording.spec,recording.spec]}))
  const args=[join(root,'request.json'),join(root,'responses.json'),join(root,'run')]
  const r=await runGenerationRunCli(args)
  assert.equal(r.status,'exported');assert.equal(r.unusedResponses,1)
  assert.ok(readFileSync(r.artifacts.pptxPath).length>1000)
  const events=readFileSync(r.journalPath,'utf8').trim().split('\n').map(JSON.parse)
  assert.equal(events.at(-1).status,'exported');assert.equal(events.filter(e=>e.type==='response').length,2)
  assert.equal(JSON.parse(readFileSync(join(root,'run','result.json'))).acceptance,'not-verified')
  await assert.rejects(runGenerationRunCli(args),/must not be overwritten/)
})
