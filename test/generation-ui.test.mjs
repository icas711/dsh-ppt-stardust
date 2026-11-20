import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {createHash} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {createPptExecutors,executionScope} from '../lib/execution.js'
import {resolvePptConfig} from '../lib/config.js'
import {buildPptTools} from '../lib/tools.js'
import {compactCases} from '../scripts/generation-compact-cases.mjs'

const config=resolvePptConfig({})
const start={operation:'start',experimental:true,mode:'B',caseId:'cards',templateKey:'light'}
const exec=(cwd,id='chat-1',owner='alice',model='glm-5.3-flash')=>({agent:{session:{header:{cwd,id,owner},requestContext:()=>({provider:'test-provider',model})}}})
const spec=(caseId='cards')=>{const c=compactCases().find(c=>c.id===caseId);return {version:1,title:c.title,lang:'ru',mode:'demo',slides:[{id:'s',purpose:'content',title:c.title,visual:c.rubric.visual}]}}
const scopeRoot=(root,e)=>join(root,'state',executionScope(e))
function fixture(t,loader){
  const root=mkdtempSync(join(tmpdir(),'generation-ui-'));t.after(()=>rmSync(root,{recursive:true,force:true}))
  let exports=0
  const engine=loader??(async()=>({buildDeckAsync:async options=>{exports++;return {ok:true,title:options.title,slideCount:options.slides.length,outputDir:options.outputDir,htmlPath:join(options.outputDir,'deck.html'),pptxPath:join(options.outputDir,'deck.pptx'),verification:{visual:'not-verified'}}}}))
  return {root,e:exec(root),tools:createPptExecutors(config,engine,{generationRoot:join(root,'state')}),get exports(){return exports}}
}
const submit=(r,value)=>({operation:'submit',runId:r.runId,expectedTurn:r.expectedTurn,responseText:typeof value==='string'?value:JSON.stringify(value)})
const lossless=value=>assert.deepEqual(JSON.parse(JSON.stringify(value)),value)
const assertOutput=(definition,args,value)=>{
  lossless(value)
  const blocks=definition.output.render(args,value)
  lossless(blocks)
  assert.ok(blocks.length>0)
  for(const block of blocks)assert.equal(typeof block.text,'string')
  return blocks.map(block=>block.text).join('\n')
}

test('every pilot mode/template has lossless first and repeated outputs, status and report',async t=>{
  const f=fixture(t),definition=buildPptTools(config).find(d=>d.name==='ppt_generation')
  assertOutput(definition,{},await f.tools.generation({operation:'list'},f.e))
  for(const mode of ['A','B','C'])for(const templateKey of ['light','dark','decor','portrait']){
    const e=exec(f.root,mode+'-'+templateKey),args={...start,mode,templateKey}
    const r=await f.tools.generation(args,e)
    assertOutput(definition,args,r)
    const repeated=await f.tools.generation(args,e)
    assertOutput(definition,args,repeated)
    assert.equal(repeated.runId,r.runId)
    const recovered=await f.tools.generation({operation:'status'},e)
    assertOutput(definition,{operation:'status'},recovered)
    assert.deepEqual(recovered,r)
    const report=await f.tools.generation({operation:'report'},e)
    assert.equal(report.runId,r.runId)
    assert.deepEqual(JSON.parse(assertOutput(definition,{operation:'report'},report)),report)
  }
})

test('status and report without runId only use the current trusted session',async t=>{
  const f=fixture(t),r=await f.tools.generation(start,f.e)
  for(const e of [exec(f.root,'chat-2'),exec(f.root,'chat-1','bob')])for(const operation of ['status','report']){
    await assert.rejects(f.tools.generation({operation},e),/No active experiment/)
    await assert.rejects(f.tools.generation({operation,runId:r.runId},e),/not found/)
  }
  for(const operation of ['status','report'])await assert.rejects(f.tools.generation({operation,runId:'../other'},f.e),/Invalid experiment runId/)
  await assert.rejects(f.tools.generation({operation:'submit',expectedTurn:1,responseText:'{}'},f.e),/Invalid experiment runId/)
  assert.equal((await f.tools.generation({operation:'status'},f.e)).runId,r.runId)
})

test('UI tool is registered with explicit opt-in, a public pilot list and no model SDK',async t=>{
  const f=fixture(t),definition=buildPptTools(config,{generationRoot:join(f.root,'state')}).find(d=>d.name==='ppt_generation')
  assert.ok(definition.description.includes('ONLY when the user explicitly requests'))
  const listed=await definition.execute({operation:'list'},f.e)
  assert.equal(listed.cases.length,12);assert.equal(listed.templates.length,4);assert.equal(listed.pilot.length,12)
  await assert.rejects(f.tools.generation({...start,experimental:false},f.e),/experimental:true/)
  await assert.rejects(f.tools.generation(start),/trusted DSH chat/)
  await assert.rejects(f.tools.generation(start,exec(f.root,'wrong','alice','other-model')),/Select glm/)
  const r=await f.tools.generation(start,f.e)
  assert.equal(r.nextRequest.stage,'spec');assert.equal(r.expectedTurn,1);assert.equal(r.acceptance,'not-verified')
  assert.equal(r.usage.inputTokens,null);assert.equal(r.routeVerification,'host-metadata')
  assert.equal(r.nextRequest.rubric,undefined)
})

test('UI B exports editable input via the existing engine; duplicate start/submit cannot reset or re-export',async t=>{
  const f=fixture(t),r=await f.tools.generation(start,f.e)
  const again=await f.tools.generation(start,f.e);assert.equal(again.runId,r.runId);assert.equal(again.alreadyStarted,true)
  const made=await f.tools.generation(submit(r,spec()),f.e)
  assert.equal(made.status,'exported');assert.equal(made.calls,1);assert.equal(f.exports,1)
  assert.ok(made.pptxPath.includes('experiment-'+r.runId))
  const duplicate=await f.tools.generation(submit(r,spec()),f.e)
  assert.equal(duplicate.duplicateSubmission,true);assert.equal(f.exports,1)
  await assert.rejects(f.tools.generation({...submit(r,spec()),responseText:'different'},f.e),/Conflicting/)
  await assert.rejects(f.tools.generation({...start,mode:'C'},f.e),/fresh DSH chat/)
  const report=await f.tools.generation({operation:'report',runId:r.runId},f.e),saved=JSON.parse(readFileSync(report.reportPath))
  const definition=buildPptTools(config).find(d=>d.name==='ppt_generation')
  for(const value of [r,again,made,duplicate,await f.tools.generation({operation:'status'},f.e)])assertOutput(definition,{},value)
  const reportText=assertOutput(definition,{operation:'report'},report)
  assert.deepEqual(JSON.parse(reportText),report)
  const implicit=await f.tools.generation({operation:'report'},f.e)
  assert.deepEqual(JSON.parse(assertOutput(definition,{operation:'report'},implicit)),implicit)
  assert.equal(implicit.runId,r.runId);assert.equal(implicit.status,'exported')
  assert.deepEqual(JSON.parse(readFileSync(implicit.reportPath)),saved)
  assert.equal(f.exports,1)
  assert.equal(saved.responses[0].text,JSON.stringify(spec()));assert.equal(saved.input.rubric,undefined)
  assert.equal(saved.acceptance,'not-verified');assert.equal(saved.capture.includes('tool argument'),true)
})

test('C carries its two-correction budget across scenario/spec and preserves bad responses',async t=>{
  const f=fixture(t);let r=await f.tools.generation({...start,mode:'C'},f.e)
  r=await f.tools.generation(submit(r,''),f.e)
  assert.equal(r.corrections,1);assert.equal(r.nextRequest.stage,'scenario')
  r=await f.tools.generation(submit(r,{version:1,slides:[{id:'s',purpose:'content',title:'Принципы сервиса',sourceRefs:['material']}]}),f.e)
  assert.equal(r.nextRequest.stage,'spec');assert.equal(r.calls,2)
  r=await f.tools.generation(submit(r,'bad JSON'),f.e)
  assert.equal(r.corrections,2)
  r=await f.tools.generation(submit(r,'still bad'),f.e)
  assert.equal(r.status,'budget-exhausted');assert.equal(r.calls,4);assert.equal(f.exports,0)
  const dir=join(scopeRoot(f.root,f.e),r.runId)
  assert.equal(readdirSync(join(dir,'responses')).length,4)
  const resumed=await f.tools.generation({...start,mode:'C'},f.e)
  assert.equal(resumed.status,'budget-exhausted');assert.equal(resumed.calls,4)
})

test('UI scopes experiment state by trusted user/session and rejects forged IDs and out-of-order turns',async t=>{
  const f=fixture(t),r=await f.tools.generation(start,f.e)
  for(const e of [exec(f.root,'chat-2'),exec(f.root,'chat-1','bob')])await assert.rejects(f.tools.generation({operation:'status',runId:r.runId},e),/not found/)
  await assert.rejects(f.tools.generation({operation:'status',runId:'../other'},f.e),/Invalid experiment runId/)
  await assert.rejects(f.tools.generation({...submit(r,'{}'),expectedTurn:2},f.e),/out-of-order/)
  assert.equal((await f.tools.generation({operation:'status',runId:r.runId},f.e)).calls,0)
})

test('pending jobs survive executor restart without restoring correction budget',async t=>{
  const f=fixture(t);let r=await f.tools.generation(start,f.e)
  r=await f.tools.generation(submit(r,'bad'),f.e)
  const restarted=createPptExecutors(config,async()=>({buildDeckAsync:async()=>({ok:true})}),{generationRoot:join(f.root,'state')})
  r=await restarted.generation({operation:'status',runId:r.runId},f.e)
  assert.equal(r.calls,1);assert.equal(r.corrections,1);assert.equal(r.expectedTurn,2)
  r=await restarted.generation(submit(r,spec()),f.e)
  assert.equal(r.status,'exported');assert.equal(r.calls,2);assert.equal(r.corrections,1)
})

test('unfinished processing and orphaned submissions become interrupted without silent replay',async t=>{
  for(const orphan of [false,true]){
    const f=fixture(t),r=await f.tools.generation(start,f.e),dir=join(scopeRoot(f.root,f.e),r.runId),file=join(dir,'state.json'),state=JSON.parse(readFileSync(file))
    if(orphan){const raw='bad';writeFileSync(join(dir,'responses','1.json'),JSON.stringify({text:raw,responseSha256:createHash('sha256').update(raw).digest('hex'),capturedAt:new Date().toISOString()}))}
    else{state.status='processing';writeFileSync(file,JSON.stringify(state))}
    const stopped=await f.tools.generation({operation:'status',runId:r.runId},f.e)
    assert.equal(stopped.status,'interrupted');assert.equal(stopped.calls,orphan?1:0);assert.equal(f.exports,0)
    assert.equal(stopped.nextRequest,undefined)
  }
})

test('concurrent tool calls cannot export twice; stale requests remain idempotent',async t=>{
  let unblock,entered
  const started=new Promise(resolve=>{entered=resolve}),blocked=new Promise(resolve=>{unblock=resolve})
  let exports=0
  const f=fixture(t,async()=>({buildDeckAsync:async()=>{exports++;entered();await blocked;return {ok:true}}})),r=await f.tools.generation(start,f.e)
  const first=f.tools.generation(submit(r,spec()),f.e);await started
  await assert.rejects(f.tools.generation(submit(r,spec()),f.e),/busy/)
  unblock();assert.equal((await first).status,'exported');assert.equal(exports,1)
})

test('route changes, corrupted source responses and pre-cancellation cannot silently produce a successful run',async t=>{
  const f=fixture(t),r=await f.tools.generation(start,f.e)
  const changed=await f.tools.generation(submit(r,spec()),exec(f.root,'chat-1','alice','different'))
  assert.equal(changed.status,'route-changed');assert.equal(changed.calls,1);assert.equal(f.exports,0)
  const path=join(scopeRoot(f.root,f.e),r.runId,'responses','1.json'),row=JSON.parse(readFileSync(path));row.text='modified';writeFileSync(path,JSON.stringify(row))
  await assert.rejects(f.tools.generation({operation:'status',runId:r.runId},f.e),/response changed/)
  const controller=new AbortController();controller.abort(new Error('cancelled before start'))
  await assert.rejects(f.tools.generation(start,{...exec(f.root,'cancelled'),signal:controller.signal}),/cancelled before start/)
})

test('real UI export returns files and permanent project paths usable by the ordinary workbench',async t=>{
  const f=fixture(t,undefined),savedHome=process.env.DSH_HOME
  process.env.DSH_HOME=join(f.root,'home');t.after(()=>{if(savedHome===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=savedHome})
  const tools=createPptExecutors(config,undefined,{generationRoot:join(f.root,'real-state')})
  const r=await tools.generation(start,f.e),made=await tools.generation(submit(r,spec()),f.e)
  assert.equal(made.status,'exported');assert.equal(made.ok,true)
  assert.ok(existsSync(made.htmlPath));assert.ok(existsSync(made.pptxPath));assert.ok(existsSync(made.jsonPath))
  assert.equal(made.verification.visual,'not-verified')
  const definition=buildPptTools(config).find(d=>d.name==='ppt_generation')
  assert.ok(definition.output.render({},made).some(c=>c.text.includes(made.pptxPath)))
})

test('UI A preserves manually composed native elements and C completes scenario then spec',async t=>{
  for(const mode of ['A','C']){
    let captured
    const f=fixture(t,async()=>({buildDeckAsync:async options=>{captured=options;return {ok:true}}}));let r=await f.tools.generation({...start,mode},f.e)
    if(mode==='A'){
      assert.equal(r.nextRequest.stage,'scene')
      const value={version:1,title:'Принципы сервиса',lang:'ru',mode:'demo',slides:[{id:'s',layout:'scene',purpose:'content',notes:'sourceRefs: material',elements:[{id:'manual-body',type:'text',frame:{x:500000,y:1500000,w:6500000,h:2000000},paragraphs:[{runs:[{text:compactCases().find(c=>c.id==='cards').context.sources[0].text+'\nСинтетические данные'}]}]}]}]}
      r=await f.tools.generation(submit(r,value),f.e)
      assert.ok(captured.slides[0].elements.some(e=>e.id==='manual-body'))
      assert.ok(captured.slides[0].elements.some(e=>e.id==='stripe'))
    }else{
      assert.equal(r.nextRequest.stage,'scenario')
      r=await f.tools.generation(submit(r,{version:1,slides:[{id:'s',purpose:'content',title:'Принципы сервиса',sourceRefs:['material']}]}),f.e)
      assert.equal(r.nextRequest.stage,'spec');assert.equal(r.expectedTurn,2)
      r=await f.tools.generation(submit(r,spec()),f.e)
    }
    assert.equal(r.status,'exported');assert.equal(r.corrections,0);assert.equal(r.calls,mode==='C'?2:1)
    assertOutput(buildPptTools(config).find(d=>d.name==='ppt_generation'),{},r)
  }
})

test('export failure stays terminal and cannot trigger a hidden repeated export',async t=>{
  let exports=0
  const f=fixture(t,async()=>({buildDeckAsync:async()=>{exports++;throw new Error('Synthetic disk failure')}})),r=await f.tools.generation(start,f.e)
  const failed=await f.tools.generation(submit(r,spec()),f.e)
  assert.equal(failed.status,'export-error');assert.equal(failed.corrections,0)
  const repeated=await f.tools.generation(start,f.e)
  assert.equal(repeated.status,'export-error');assert.equal(exports,1)
  assert.ok(existsSync(join(scopeRoot(f.root,f.e),r.runId,'export-started.json')))
})

test('a dead worker lease is recovered without letting two callers process concurrently',async t=>{
  const f=fixture(t),r=await f.tools.generation(start,f.e)
  const child=spawnSync(process.execPath,['-e','process.stdout.write(String(process.pid))'],{encoding:'utf8'})
  assert.equal(child.status,0)
  writeFileSync(join(scopeRoot(f.root,f.e),'.lock'),JSON.stringify({pid:Number(child.stdout),token:'dead-worker'}))
  const calls=await Promise.allSettled([f.tools.generation({operation:'status',runId:r.runId},f.e),f.tools.generation({operation:'status',runId:r.runId},f.e)])
  assert.equal(calls.filter(c=>c.status==='fulfilled').length,1)
  assert.equal(calls.find(c=>c.status==='fulfilled').value.status,'waiting-for-response')
  assert.equal(calls.filter(c=>c.status==='rejected').length,1)
  assert.equal(existsSync(join(scopeRoot(f.root,f.e),'.lock')),false)
})
