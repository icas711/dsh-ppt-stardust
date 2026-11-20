import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {spawnSync} from 'node:child_process'
import {compactCases,compactTemplates} from '../scripts/generation-compact-cases.mjs'
import {prepareCompactEvaluation,loadCompactKit,loadCompactTask,jsonFile,sha,safeFile} from '../scripts/generation-compact-kit.mjs'
import {advanceCompactEvaluation,processCompactRecording,recordCompactResponse} from '../scripts/generation-compact-session.mjs'
import {evaluateCompactKit,compactRunMetrics} from '../scripts/generation-compact-evaluation.mjs'
import {reviewCompactSpec,checkCompactScene,compactVisibleText} from '../scripts/generation-compact-review.mjs'
import {composeGenerationSpec} from '../skills/dsh-ppt/scripts/deck-generation-compose.mjs'

let root,kitDir,kit
test.before(async()=>{root=mkdtempSync(join(tmpdir(),'compact-evaluation-'));kitDir=join(root,'kit');await prepareCompactEvaluation(kitDir);kit=loadCompactKit(kitDir)})
test.after(()=>rmSync(root,{recursive:true,force:true}))
const specification=c=>({version:1,title:c.title,lang:'ru',mode:'demo',slides:[{id:'slide-1',purpose:'content',title:c.title,visual:structuredClone(c.rubric.visual)}]})
const response=(value,stage='spec',kind='initial')=>({text:typeof value==='string'?value:JSON.stringify(value),stage,kind,model:'glm-5.3-flash'})
const runDirectory=id=>join(kitDir,'runs',id)
const recording=(id,rows)=>writeFileSync(join(runDirectory(id),'responses.json'),JSON.stringify({version:1,responses:rows},null,2)+'\n')
const task=id=>loadCompactTask(kit,id)
const scene=c=>({version:1,title:c.title,lang:'ru',mode:'demo',slides:[{id:'slide-1',purpose:'content',layout:'scene',label:c.title,notes:'sourceRefs: material',elements:[{id:'body',type:'text',role:'content',frame:{x:500000,y:1500000,w:7500000,h:3000000},textStyle:{fontFamily:'Arial',size:20},paragraphs:[{runs:[{text:c.rubric.requiredTexts.join('\n')+'\nСинтетические данные'}]}]}]}]})

test('kit covers independent eight types, stress cases, four templates and balanced schedules',()=>{
  assert.equal(kit.manifest.tasks.length,48);assert.equal(kit.schedule.length,444)
  assert.deepEqual(new Set(compactCases().slice(0,8).map(c=>c.rubric.visual.type)),new Set(['process','cards','chart','timeline','comparison','big_number','table','image']))
  assert.equal(kit.manifest.privateMaterial,'not-supplied')
  for(const phase of ['pilot','confirmation']){
    const runs=kit.schedule.filter(r=>r.phase===phase)
    assert.equal(runs.filter(r=>r.mode==='A').length,runs.length/3)
    for(let i=0;i<runs.length;i+=3)assert.deepEqual(new Set(runs.slice(i,i+3).map(r=>r.mode)),new Set(['A','B','C']))
  }
  for(const t of compactTemplates()){
    const loaded=task('cards--'+t.key)
    assert.deepEqual(loaded.template.manifest.style.pageSize,t.manifest.style.pageSize)
  }
  for(const c of kit.manifest.tasks){
    const publicRequest=readFileSync(safeFile(kitDir,c.requestPath),'utf8')
    assert.ok(!/rubric|referencePlan|referenceSpec/.test(publicRequest))
    for(const mode of ['A','B','C']){
      const prompt=readFileSync(join(kitDir,'tasks',c.id,mode+'.md'),'utf8')
      assert.ok(prompt.includes('ask_user_question'));assert.ok(!/"rubric"|"referencePlan"|"referenceSpec"/.test(prompt))
    }
  }
})

test('all controlled semantic references compose across four sizes/styles with visible facts',()=>{
  for(const c of compactCases())for(const t of compactTemplates()){
    const loaded=task(c.id+'--'+t.key),input=specification(c)
    assert.deepEqual(reviewCompactSpec(input,loaded.task,loaded.rubric),[],c.id)
    const composed=composeGenerationSpec(input,{template:loaded.template,context:loaded.task.context,assets:loaded.task.assets,allowMoreSlides:loaded.task.brief.allowMoreSlides,maxSlides:120})
    const text=compactVisibleText(composed.create.slides).replace(/\s+/g,' ')
    for(const fact of loaded.rubric.requiredTexts)assert.ok(text.includes(fact.replace(/\s+/g,' ')),c.id+'/'+t.key+': '+fact)
    assert.ok(composed.create.slides.every(s=>compactVisibleText([s]).includes('синтетические')))
    if(c.id==='overload')assert.ok(composed.create.slides.length>1)
  }
})

test('source evaluator rejects changed associations, order, nulls, missing details and synthetic mode',()=>{
  for(const [id,mutate]of [
    ['process',s=>s.slides[0].visual.items.reverse()],
    ['timeline',s=>s.slides[0].visual.items[1].date='2026-02-10'],
    ['chart',s=>s.slides[0].visual.series[0].values.reverse()],
    ['comparison',s=>s.slides[0].visual.items[1].values[0]='Готов'],
    ['incomplete',s=>s.slides[0].visual.items[1].values[0]='0'],
    ['long-ru',s=>s.slides[0].visual.items[0].detail='Сокращено'],
    ['table',s=>s.slides[0].visual.rows[0][1]='В работе'],
    ['image',s=>s.slides[0].visual.alt='Другое'],
    ['big_number',s=>s.slides[0].visual.items[0].unit='%'],
    ['cards',s=>s.mode='factual']
  ]){
    const c=compactCases().find(c=>c.id===id),loaded=task(id+'--light'),input=specification(c);mutate(input)
    assert.ok(reviewCompactSpec(input,loaded.task,loaded.rubric).length,id)
  }
  const c=compactCases()[2],loaded=task('chart--light'),input=specification(c);input.slides[0].title='Рост 999'
  assert.ok(reviewCompactSpec(input,loaded.task,loaded.rubric).some(d=>d.code==='unexpected-number'))
})

test('cards preserve the relationship visibly; source excerpts do not require deleting facts',()=>{
  const c=compactCases().find(c=>c.id==='cards'),loaded=task('cards--light'),input=specification(c)
  const source=c.context.sources[0].text
  assert.ok(c.brief.requiredFacts.includes('Это не этапы и не рейтинг.'))
  assert.deepEqual(reviewCompactSpec(input,loaded.task,loaded.rubric),[])
  // Both repaired pilot responses omitted the caption, even when notes kept it.
  delete input.slides[0].visual.caption
  input.slides[0].notes=source
  assert.ok(reviewCompactSpec(input,loaded.task,loaded.rubric).some(d=>d.code==='missing-fact'&&d.message.includes('Это не этапы и не рейтинг.')))
  // Keeping the exact source in a visible detail is also valid.
  input.slides[0].visual.items[0].detail=source
  assert.deepEqual(reviewCompactSpec(input,loaded.task,loaded.rubric),[])
  input.slides[0].visual.caption=source
  input.slides[0].visual.caption+=' Постоянная доступность гарантирована.'
  assert.ok(reviewCompactSpec(input,loaded.task,loaded.rubric).some(d=>d.code==='source-semantics'))
  input.slides[0].visual.caption=source
  input.slides[0].visual.items[0].detail='Надёжность гарантирована на 100%'
  assert.ok(reviewCompactSpec(input,loaded.task,loaded.rubric).some(d=>d.code==='source-semantics'))
  // A must preserve the same facts, rather than passing on the three labels alone.
  const free=scene(c)
  // Source sentences may be separated by the cards themselves, as in pilot A.
  free.slides[0].elements[0].paragraphs[0].runs[0].text='Три равноправных принципа: Прозрачность, Надёжность, Доступность.\nПрозрачность\nНадёжность\nДоступность\nЭто не этапы и не рейтинг.\nСинтетические данные'
  assert.deepEqual(checkCompactScene(free,loaded.task,loaded.template,loaded.rubric).diagnostics,[])
  free.slides[0].elements[0].paragraphs[0].runs[0].text='Прозрачность Надёжность Доступность\nСинтетические данные'
  assert.ok(checkCompactScene(free,loaded.task,loaded.template,loaded.rubric).diagnostics.some(d=>d.code==='missing-fact'))
})

test('chart false defaults match omission without accepting unsupported order or whole claims',()=>{
  const c=compactCases().find(c=>c.id==='chart'),loaded=task('chart--dark')
  for(const flags of [{ordered:false},{whole:false},{ordered:false,whole:false}]){
    const input=specification(c);Object.assign(input.slides[0].visual,flags)
    const before=structuredClone(input)
    assert.deepEqual(reviewCompactSpec(input,loaded.task,loaded.rubric),[])
    assert.deepEqual(input,before)
  }
  for(const flags of [{ordered:true},{whole:true}]){
    const input=specification(c);Object.assign(input.slides[0].visual,flags)
    assert.ok(reviewCompactSpec(input,loaded.task,loaded.rubric).some(d=>d.code==='source-semantics'))
  }
  const input=specification(c);input.slides[0].visual.series[0].values.reverse()
  Object.assign(input.slides[0].visual,{ordered:false,whole:false})
  assert.ok(reviewCompactSpec(input,loaded.task,loaded.rubric).some(d=>d.code==='source-semantics'))
  const explicit=structuredClone(loaded.rubric);Object.assign(explicit.visual,{ordered:false,whole:false})
  assert.deepEqual(reviewCompactSpec(specification(c),loaded.task,explicit),[])
})

test('preservation instructions stay in the brief and cannot appear in visible A/B content',()=>{
  for(const id of ['long-ru','overload']){
    const c=compactCases().find(c=>c.id===id),loaded=task(id+'--decor'),requirement=c.rubric.forbiddenTexts[0]
    assert.ok(loaded.task.brief.goal.includes(requirement))
    assert.ok(!c.context.sources[0].text.includes(requirement))
    const free=scene(c)
    free.slides[0].elements[0].paragraphs[0].runs[0].text+='\n'+requirement
    assert.ok(checkCompactScene(free,loaded.task,loaded.template,loaded.rubric).diagnostics.some(d=>d.code==='instruction-as-content'))
    if(id==='long-ru'){
      const input=specification(c);input.slides[0].visual.caption=requirement
      assert.ok(reviewCompactSpec(input,loaded.task,loaded.rubric).some(d=>d.code==='instruction-as-content'))
    }
  }
})

test('C rejects an impossible long-text scenario before spec and repairs it within the shared budget',async()=>{
  const c=compactCases().find(c=>c.id==='long-ru'),loaded=task('long-ru--decor')
  const bad={version:1,slides:['cover','approval','check','delivery'].map((id,i)=>({id,purpose:i?'content':'cover',title:id,sourceRefs:['material']}))}
  const first=await processCompactRecording({mode:'C',...loaded,recording:{version:1,responses:[]}})
  assert.equal(first.pending.planningConstraints.maxPlannedSlides,1)
  const rejected=await processCompactRecording({mode:'C',...loaded,recording:{version:1,responses:[response(bad,'scenario')]}})
  assert.equal(rejected.pending.stage,'scenario');assert.equal(rejected.pending.kind,'repair')
  assert.ok(rejected.pending.diagnostics.some(d=>d.code==='scenario-feasibility'))
  assert.equal(rejected.pending.slideIds,undefined)
  const input=specification(c),fixed={version:1,slides:input.slides.map(({id,purpose,title})=>({id,purpose,title,sourceRefs:['material']}))}
  const result=await processCompactRecording({mode:'C',...loaded,recording:{version:1,responses:[response(bad,'scenario'),response(fixed,'scenario','repair'),response(input)]}})
  assert.equal(result.status,'composed');assert.equal(result.corrections,1);assert.equal(result.calls,3)
  assert.ok(result.compositionReport.slideCount>=1)
  assert.deepEqual(result.final,input)
  const valid=await processCompactRecording({mode:'C',...loaded,recording:{version:1,responses:[response(fixed,'scenario'),response(input)]}})
  assert.equal(valid.status,'composed');assert.equal(valid.corrections,0)
})

test('C repairs a register outline before spec, then paginates every row exactly once',async()=>{
  const c=compactCases().find(c=>c.id==='overload'),loaded=task('overload--portrait')
  const bad={version:1,slides:['cover','registry-part1','registry-part2'].map((id,i)=>({id,purpose:i?'content':'cover',title:'Полный реестр',sourceRefs:['material']}))}
  const first=await processCompactRecording({mode:'C',...loaded,recording:{version:1,responses:[]}})
  assert.deepEqual(first.pending.planningConstraints,{visualType:'table',maxPlannedSlides:1,purpose:'content',enginePagination:true})
  const rejected=await processCompactRecording({mode:'C',...loaded,recording:{version:1,responses:[response(bad,'scenario')]}})
  assert.equal(rejected.pending.stage,'scenario');assert.equal(rejected.pending.kind,'repair')
  assert.ok(rejected.pending.diagnostics.some(d=>d.code==='scenario-feasibility'))
  assert.equal(rejected.pending.slideIds,undefined)
  const input=specification(c),fixed={version:1,slides:[{id:'slide-1',purpose:'content',title:c.title,sourceRefs:['material']}]}
  let exported
  const result=await processCompactRecording({mode:'C',...loaded,recording:{version:1,responses:[response(bad,'scenario'),response(fixed,'scenario','repair'),response(input)]},exportDeck:async create=>{exported=create;return {ok:true}}})
  assert.equal(result.status,'exported');assert.equal(result.corrections,1);assert.equal(result.calls,3)
  assert.ok(exported.slides.length>1)
  const rows=[]
  for(const slide of exported.slides){
    const table=slide.elements.find(e=>e.type==='table').table
    const cellText=(row,col)=>table.cells.find(c=>c.row===row&&c.col===col).paragraphs.flatMap(p=>p.runs.map(r=>r.text??'')).join('')
    assert.deepEqual([cellText(0,0),cellText(0,1)],c.rubric.visual.headers)
    for(let row=1;row<table.rows.length;row++)rows.push([cellText(row,0),cellText(row,1)])
  }
  assert.deepEqual(rows,c.rubric.visual.rows)
  const duplicate=structuredClone(input);duplicate.slides.push({...structuredClone(input.slides[0]),id:'duplicate'})
  assert.ok(reviewCompactSpec(duplicate,loaded.task,loaded.rubric).some(d=>d.code==='source-semantics'))
  const valid=await processCompactRecording({mode:'C',...loaded,recording:{version:1,responses:[response(fixed,'scenario'),response(input)]}})
  assert.equal(valid.status,'composed');assert.equal(valid.corrections,0)
})

test('manual C emits scenario/spec and exact repair prompts with a shared budget, preserving evidence',async()=>{
  const id='pilot-1-chart--dark-C',c=compactCases().find(c=>c.id==='chart')
  const first=await advanceCompactEvaluation(kitDir,id)
  assert.equal(first.status,'waiting-for-response');assert.equal(first.calls,0)
  assert.equal(jsonFile(join(first.directory,'next-request.json')).stage,'scenario')
  recording(id,[response('invalid','scenario')])
  const second=await advanceCompactEvaluation(kitDir,id)
  assert.equal(second.corrections,1);assert.equal(jsonFile(join(second.directory,'next-request.json')).kind,'repair')
  const scenario={version:1,slides:[{id:'slide-1',purpose:'content',title:c.title,sourceRefs:['material']}]}
  const rows=[response('invalid','scenario'),response(scenario,'scenario','repair')]
  recording(id,rows)
  const third=await advanceCompactEvaluation(kitDir,id)
  assert.equal(jsonFile(join(third.directory,'next-request.json')).stage,'spec')
  const wrong=specification(c);wrong.slides[0].visual.series[0].values.reverse()
  rows.push(response(wrong));recording(id,rows)
  const fourth=await advanceCompactEvaluation(kitDir,id),request=jsonFile(join(fourth.directory,'next-request.json'))
  assert.equal(fourth.corrections,2);assert.deepEqual(request.slideIds,['slide-1'])
  assert.equal(request.current.slides.length,1);assert.ok(request.diagnostics.some(d=>d.code==='source-semantics'))
  rows.push(response({slides:specification(c).slides},'spec','repair'));recording(id,rows)
  const last=await advanceCompactEvaluation(kitDir,id)
  assert.equal(last.status,'exported');assert.equal(last.calls,4);assert.equal(last.corrections,2)
  assert.ok(existsSync(join(first.directory,'responses.json')))
  const result=jsonFile(join(last.directory,'result.json'))
  assert.ok(result.artifactIndex.some(a=>a.kind==='pptx'));assert.equal(result.acceptance,'not-verified')
  await assert.rejects(advanceCompactEvaluation(kitDir,id),/terminal/)
})

test('prior raw answers cannot be edited or deleted during a manual run',async()=>{
  const id='pilot-1-overload--portrait-B'
  recording(id,[response('bad')]);await advanceCompactEvaluation(kitDir,id)
  recording(id,[response('changed')]);await assert.rejects(advanceCompactEvaluation(kitDir,id),/Earlier responses changed/)
  recording(id,[response('bad')])
  const attempt=join(runDirectory(id),'attempts','0001','journal.jsonl')
  writeFileSync(attempt,'lost journal')
  await assert.rejects(advanceCompactEvaluation(kitDir,id),/Saved journal/)
})

test('record command preserves raw response bytes and selects the correct next stage',async()=>{
  const id='pilot-1-long-ru--decor-C',file=join(root,'raw-scenario.txt'),raw='  {"version":1,"slides":[{"id":"slide-1","purpose":"content","title":"Материал","sourceRefs":["material"]}]}\n'
  writeFileSync(file,raw)
  const added=await recordCompactResponse(kitDir,id,file)
  assert.equal(added.stage,'scenario');assert.equal(added.kind,'initial')
  assert.equal(jsonFile(join(runDirectory(id),'responses.json')).responses[0].text,raw)
  const next=await advanceCompactEvaluation(kitDir,id)
  assert.equal(jsonFile(join(next.directory,'next-request.json')).stage,'spec')
})

test('preparation is reproducible and does not overwrite a previous kit',async()=>{
  const receipt=await prepareCompactEvaluation(join(root,'same-kit'))
  assert.equal(receipt.suiteId,kit.manifest.suiteId)
  await assert.rejects(prepareCompactEvaluation(join(root,'same-kit')),/must not be overwritten/)
})

test('a failure before the first answer remains an attempted failed run',async()=>{
  const id='confirmation-1-process--light-A',dir=runDirectory(id),run=jsonFile(join(dir,'run.json'))
  run.status='provider-error';run.timing.generationStartedAt='2026-11-20T11:00:00Z';run.limitations=['Synthetic provider failure before first response']
  writeFileSync(join(dir,'run.json'),JSON.stringify(run))
  const report=await evaluateCompactKit(kitDir),failed=report.results.find(r=>r.runId===id)
  assert.equal(failed.attempted,true);assert.equal(failed.status,'provider-error');assert.equal(failed.metrics.firstResponseMs,null)
})

test('A evaluates native free scenes and table/chart associations rather than old deckPlan',async()=>{
  const c=compactCases().find(c=>c.id==='cards'),loaded=task('cards--light'),input=scene(c)
  assert.deepEqual(checkCompactScene(input,loaded.task,loaded.template,loaded.rubric).diagnostics,[])
  assert.ok(checkCompactScene({deckPlan:[]},loaded.task,loaded.template,loaded.rubric).diagnostics.length)
  const id='pilot-1-cards--light-A';recording(id,[response(input,'scene')])
  const r=await advanceCompactEvaluation(kitDir,id);assert.equal(r.status,'exported');assert.equal(r.calls,1)
  const chartCase=compactCases().find(c=>c.id==='chart'),chartLoaded=task('chart--light'),wrong=scene(chartCase)
  wrong.slides[0].elements.push({id:'chart',type:'chart',frame:{x:500000,y:2000000,w:6000000,h:3000000},chart:{kind:'column',categories:['Север','Юг'],series:[{name:'Заявки',values:[9,17]}],title:'заявки',dataLabels:{showValue:true},legend:{position:'b'}}})
  assert.ok(checkCompactScene(wrong,chartLoaded.task,chartLoaded.template,chartLoaded.rubric).diagnostics.some(d=>d.code==='source-chart'))
  const two=scene(c);two.slides[0].elements[0].paragraphs[0].runs[0].text=c.rubric.requiredTexts.join('\n')
  two.slides.push({...structuredClone(two.slides[0]),id:'slide-2',notes:'sourceRefs: unrelated',elements:[{...structuredClone(two.slides[0].elements[0]),paragraphs:[{runs:[{text:'Синтетические данные'}]}]}]})
  const multiTask={...loaded.task,brief:{...loaded.task.brief,slideCount:2},context:{sources:[...loaded.task.context.sources,{id:'unrelated',text:'Unrelated fragment',synthetic:true}]}}
  const pending=await processCompactRecording({mode:'A',task:multiTask,template:loaded.template,rubric:loaded.rubric,recording:{version:1,responses:[response(two,'scene')]}})
  assert.deepEqual(pending.pending.slideIds,['slide-1']);assert.deepEqual(pending.pending.sources.map(s=>s.id),['material']);assert.equal(pending.pending.brief,undefined)
})

test('manual B repairs are finite and incomplete runs remain in evaluation',async()=>{
  const loaded=task('cards--light'),r=await processCompactRecording({mode:'B',...loaded,recording:{version:1,responses:[response('bad'),response('bad','spec','repair'),response('bad','spec','repair')]}})
  assert.equal(r.status,'budget-exhausted');assert.equal(r.calls,3)
  const report=await evaluateCompactKit(kitDir)
  assert.equal(report.planned,444);assert.equal(report.winner,null)
  assert.ok(report.results.some(r=>r.status==='not-run'))
  assert.ok(report.results.some(r=>r.status==='waiting-for-response'))
  assert.ok(report.results.filter(r=>r.technicalPassed).every(r=>!r.accepted))
})

test('human acceptance requires artifact-bound review, render evidence and live timing; replay time is excluded',async()=>{
  const id='pilot-1-cards--light-B',c=compactCases().find(c=>c.id==='cards'),dir=runDirectory(id)
  const row=response(specification(c));row.usageOrigin='provider';row.usage={inputTokens:100,outputTokens:50,cost:{amount:0.01,currency:'USD'}}
  recording(id,[row]);const advanced=await advanceCompactEvaluation(kitDir,id)
  const run=jsonFile(join(dir,'run.json'))
  run.versions.dsh='synthetic-test';run.versions.provider='synthetic-test';run.versions.installedPlugin=run.versions.plugin
  run.cache={condition:'cold',scope:'synthetic-test-only'}
  run.timing={...run.timing,generationStartedAt:'2026-11-20T10:00:00Z',firstResponseAt:'2026-11-20T10:00:02Z',finishedAt:'2026-11-20T10:00:03Z',acceptedAt:'2026-11-20T10:00:05Z'}
  writeFileSync(join(dir,'run.json'),JSON.stringify(run))
  // Mechanical evidence validation fixture; this is not a real visual review.
  const png=Buffer.from(compactCases().find(c=>c.id==='image').assets['sample-image'].data.split(',')[1],'base64')
  writeFileSync(join(dir,'test-render.png'),png)
  const review={version:1,reviewer:'Synthetic test reviewer',reviewedAt:'2026-11-20T10:00:04Z',artifactSetSha256:advanced.artifactSetSha256,renderEvidence:[{path:'test-render.png',sha256:sha(png)}],checks:{facts:true,filesOpen:true,noCriticalOverlap:true,readable:true,templateStyle:true,editable:true}}
  writeFileSync(join(dir,'human-review.json'),JSON.stringify(review))
  const report=await evaluateCompactKit(kitDir),result=report.results.find(r=>r.runId===id)
  assert.equal(result.accepted,true,JSON.stringify(result.issues));assert.equal(result.metrics.timeToAcceptedMs,5000)
  assert.equal(result.metrics.firstResponseMs,2000);assert.equal(result.metrics.inputTokens,100)
  assert.equal(result.successFirstAttempt,true)
  review.artifactSetSha256='stale';writeFileSync(join(dir,'human-review.json'),JSON.stringify(review))
  assert.equal((await evaluateCompactKit(kitDir)).results.find(r=>r.runId===id).accepted,false)
  review.artifactSetSha256=advanced.artifactSetSha256;writeFileSync(join(dir,'human-review.json'),JSON.stringify(review))
  const saved=jsonFile(join(advanced.directory,'result.json')),artifact=saved.artifactIndex.find(a=>a.kind==='pptx')
  writeFileSync(safeFile(dir,artifact.path),Buffer.from('corrupted'))
  const corrupt=(await evaluateCompactKit(kitDir)).results.find(r=>r.runId===id)
  assert.equal(corrupt.accepted,false);assert.equal(corrupt.status,'invalid-evidence')
})

test('missing provider usage and unknown live times stay null; no inferred billing',()=>{
  const run={timing:{generationStartedAt:'2026-11-20T10:00:00Z',firstResponseAt:'2026-11-20T10:00:02Z'}}
  const rows=[{text:'x'.repeat(10000),usage:{inputTokens:90,outputTokens:80}},{usageOrigin:'provider',usage:{inputTokens:10,outputTokens:5,cost:{amount:0.1,currency:'USD'}}}]
  const metrics=compactRunMetrics(run,rows,false)
  assert.equal(metrics.inputTokens,null);assert.equal(metrics.cost,null);assert.equal(metrics.costCallsCovered,1)
  assert.equal(metrics.totalUntilFinishedMs,null);assert.equal(metrics.timeToAcceptedMs,null)
})

test('private material is opt-in local data; immutable inputs and safe paths cannot be bypassed',async()=>{
  const privateInput={id:'private-test',title:'Local only',instruction:'Explain local data',dataMode:'factual',brief:{version:1,goal:'Explain',audience:'Team',lang:'ru',allowMoreSlides:true,slideCount:1,attachments:[{id:'local-document',role:'content'}],requiredFacts:['PRIVATE SENTINEL']},context:{sources:[{id:'private-source',text:'PRIVATE SENTINEL'}]},requiredTexts:['PRIVATE SENTINEL']}
  const file=join(root,'private.json');writeFileSync(file,JSON.stringify(privateInput))
  const out=join(root,'private-kit'),receipt=await prepareCompactEvaluation(out,{privateCasePath:file})
  assert.equal(receipt.cases,13);assert.equal(receipt.privateMaterial,'included-locally')
  const custom=loadCompactKit(out);assert.equal(custom.manifest.tasks.filter(t=>t.private).length,4)
  assert.ok(!readFileSync(join(kitDir,'review','rubrics.json'),'utf8').includes('PRIVATE SENTINEL'))
  await assert.rejects(prepareCompactEvaluation(out),/must not be overwritten/)
  const material=custom.manifest.tasks[0].requestPath;writeFileSync(safeFile(out,material),'{}')
  assert.throws(()=>loadCompactKit(out),/Kit input changed/)
  for(const p of ['../escape','/escape','C:/escape','..\\escape'])assert.throws(()=>safeFile(root,p))
})

test('CLI reviews the compact path, retains all not-run rows and refuses report overwrite',()=>{
  const out=join(root,'cli-report')
  const child=spawnSync(process.execPath,['scripts/generation-evaluation.mjs','review-compact',kitDir,out],{encoding:'utf8'})
  assert.equal(child.status,1);const report=jsonFile(join(out,'report.json'))
  assert.equal(report.planned,444);assert.equal(report.winner,null)
  const again=spawnSync(process.execPath,['scripts/generation-evaluation.mjs','review-compact',kitDir,out],{encoding:'utf8'})
  assert.equal(again.status,1);assert.match(again.stderr,/must not be overwritten/)
})
