// Deterministic policy calibration on public fixed plans; no model calls.
import assert from 'node:assert/strict'
import {writeFileSync} from 'node:fs'
import {generationFixture,mixedGenerationFixture} from '../test/fixtures/generation.mjs'
import {normalizeSceneTemplate,validateSceneTemplatePlan} from '../skills/dsh-ppt/scripts/deck-template-scene.mjs'
import {GENERATION_POLICY} from '../skills/dsh-ppt/scripts/deck-generation.mjs'
const results=[]
for(const count of [1,3,8])for(const content of ['uniform','mixed']){
 const {plan,...input}=content==='mixed'?mixedGenerationFixture(count):generationFixture(count)
 const template=normalizeSceneTemplate(input),before=JSON.stringify(plan),report=validateSceneTemplatePlan(plan,template.style.layouts,{pageSize:template.style.pageSize})
 assert.equal(report.valid,true);assert.equal(JSON.stringify(plan),before)
 if(content==='mixed'&&count>1)assert.equal(report.diagnostics.length,0)
 if(count===1)assert.ok(report.diagnostics.some(d=>d.code==='rhythm-limited-variants'))
 if(content==='uniform')assert.ok(report.diagnostics.some(d=>d.code==='rhythm-uniform-content'))
 const {compatibleVariants,...summary}=report
 results.push({templateVariants:count,content,...summary})
}
const report={date:'2026-11-19',scope:'Public fixed plans; does not establish LLM selection quality or arbitrary PPTX fidelity',policy:GENERATION_POLICY,results}
const output=process.argv[2]
if(output)writeFileSync(output,JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({policy:GENERATION_POLICY,cases:results.map(r=>({variants:r.templateVariants,content:r.content,valid:r.valid,structures:r.metrics.structures,warnings:r.diagnostics.map(d=>d.code)})),output},null,2))
