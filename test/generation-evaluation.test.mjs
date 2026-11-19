import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'
import {generationEvaluationCases} from './fixtures/generation-evaluation.mjs'
import {evaluationRequests,evaluateGenerationResponses,prepareGenerationEvaluation} from '../scripts/generation-evaluation.mjs'
import {readTemplateBundle} from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import {buildPptTools} from '../lib/tools.js'
import {resolvePptConfig} from '../lib/config.js'
import {generationPlanningInstructions} from '../skills/dsh-ppt/scripts/deck-generation.mjs'
const answers=()=>({version:1,responses:generationEvaluationCases().map(c=>({caseId:c.id,deckPlan:structuredClone(c.referencePlan)}))})

test('evaluation references pass actual template fill and preserve the public sources',()=>{
 const result=evaluateGenerationResponses(answers())
 assert.equal(result.results.length,10);assert.equal(result.passed,true,JSON.stringify(result,null,2))
})
test('source rubric rejects plausible but invented semantics, numbers and chart associations',()=>{
 const input=answers(),rows=id=>input.responses.find(r=>r.caseId===id).deckPlan
 rows('unordered')[0].structure='process';rows('unordered')[0].visual={slotId:'body',diagram:{version:2,kind:'process',ordered:true,items:[{label:'Прозрачность'},{label:'Надёжность'},{label:'Доступность'}]}}
 rows('process')[0].visual.diagram.items.reverse()
 rows('kpi')[0].visual.diagram.items[0].delta=3;rows('kpi')[0].visual.diagram.items[0].deltaUnit='%'
 rows('categories')[0].visual.diagram.chart.series[0].values.reverse()
 rows('identifiers')[0].values.body+='\nВыручка 999'
 const report=evaluateGenerationResponses(input)
 assert.equal(report.passed,false)
 for(const id of ['unordered','process','kpi','categories','identifiers'])assert.equal(report.results.find(r=>r.caseId===id).passed,false,id)
 assert.ok(report.results.find(r=>r.caseId==='kpi').issues.some(i=>i.code==='unexpected-number'))
 assert.ok(report.results.find(r=>r.caseId==='categories').issues.some(i=>i.code==='changed-chart-data'))
})
test('missing source, dropped visible facts and incomplete/duplicate runs cannot become a pass',()=>{
 const input=answers();input.responses[0].deckPlan[0].values.body='Прозрачность';input.responses[0].deckPlan[0].sources=['invented:source']
 input.responses.pop();input.responses.push(structuredClone(input.responses[0]));input.responses.push({caseId:'unregistered',deckPlan:[]})
 const r=evaluateGenerationResponses(input);assert.equal(r.passed,false);assert.ok(r.global.some(d=>d.code==='duplicate-case'));assert.ok(r.global.some(d=>d.code==='unknown-case'))
 assert.ok(r.results[0].issues.some(d=>d.code==='missing-fact'));assert.ok(r.results[0].issues.some(d=>d.code==='source-reference'))
 assert.ok(r.results.some(c=>c.issues.some(d=>d.code==='missing-response')))
})
test('mixed deck checks section order and actual variety rather than accepting copied variants',()=>{
 const input=answers(),plan=input.responses.find(r=>r.caseId==='mixed-deck').deckPlan
 plan.forEach(row=>row.variantId='variant-0')
 const report=evaluateGenerationResponses(input),mixed=report.results.find(r=>r.caseId==='mixed-deck')
 assert.equal(mixed.passed,false);assert.ok(mixed.issues.some(i=>i.code==='deck-rhythm'))
 plan[0]=structuredClone(plan[1]);plan[0].id='replaced-first-slide'
 const reordered=evaluateGenerationResponses(input).results.find(r=>r.caseId==='mixed-deck')
 assert.ok(reordered.issues.some(i=>i.code==='source-reference'));assert.ok(reordered.issues.some(i=>i.code==='missing-fact'))
})
test('kit roundtrips a real ZIP and keeps rubrics/reference answers out of model requests',t=>{
 const dir=mkdtempSync(join(tmpdir(),'generation-evaluation-'));t.after(()=>rmSync(dir,{force:true,recursive:true}))
 const receipt=prepareGenerationEvaluation(dir),requests=evaluationRequests();assert.equal(receipt.status,'prepared-not-run')
 assert.throws(()=>prepareGenerationEvaluation(dir),/existing evaluation responses/)
 assert.equal(readTemplateBundle(join(dir,'generation-evaluation.zip')).manifest.style.layouts.length,3)
 assert.equal(readdirSync(dir).filter(f=>f.endsWith('.md')).length,11)
 for(const c of requests.cases){assert.equal(c.referencePlan,undefined);assert.equal(c.rubric,undefined);assert.equal(c.material.data?.kind,undefined)}
 assert.ok(!readFileSync(join(dir,'requests.json'),'utf8').includes('referencePlan'))
 const empty=JSON.parse(readFileSync(join(dir,'responses.json'),'utf8'));assert.ok(empty.responses.every(r=>r.deckPlan===null))
 const run=spawnSync(process.execPath,['scripts/generation-evaluation.mjs','review',join(dir,'responses.json'),join(dir,'review')],{encoding:'utf8'})
 assert.equal(run.status,1);assert.equal(JSON.parse(readFileSync(join(dir,'review/report.json'),'utf8')).passed,false)
})
test('production create tool exposes the same planning instructions as the evaluation kit',()=>{
 const create=buildPptTools(resolvePptConfig()).find(t=>t.name==='ppt_create')
 assert.ok(create.description.includes(generationPlanningInstructions()))
 assert.equal(evaluationRequests().instructions,generationPlanningInstructions())
})
