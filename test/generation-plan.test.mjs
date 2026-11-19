import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {generationFixture,mixedGenerationFixture} from './fixtures/generation.mjs'
import {normalizeSceneTemplate} from '../skills/dsh-ppt/scripts/deck-template-scene.mjs'
import {validateSceneTemplatePlan} from '../skills/dsh-ppt/scripts/deck-template-scene.mjs'
import {createSceneVariant} from '../skills/dsh-ppt/scripts/deck-variant-editor.mjs'
import {describeVariant,variantSignature,validateDeckPlan,chartApplicability} from '../skills/dsh-ppt/scripts/deck-generation.mjs'
import {bundleClientModel} from '../scripts/bundle-client-model.mjs'

const fixture=(count=8,n=12)=>{const {plan,...input}=generationFixture(count,n);return {template:normalizeSceneTemplate(input),plan}}
test('variant descriptions are generated without changing page size or objects; stale estimates retain user limits',()=>{
 const {template}=fixture(),l=template.style.layouts[0],before=structuredClone(l.elements)
 assert.equal(l.description.version,1);assert.deepEqual(l.description.slots[0].types,['text']);assert.ok(l.description.slots[0].estimate.characters>0)
 assert.deepEqual(l.elements,before);l.description.origin='user';l.description.intent='Keep the specific purpose';l.description.slots[0].capacity={characters:75};l.elements[0].frame.w/=2
 const updated=normalizeSceneTemplate(template).style.layouts[0]
 assert.equal(updated.description.intent,'Keep the specific purpose');assert.equal(updated.description.slots[0].capacity.characters,75)
 assert.ok(updated.description.slots[0].estimate.characters<l.description.slots[0].estimate.characters)
 assert.deepEqual(normalizeSceneTemplate(normalizeSceneTemplate(template)),normalizeSceneTemplate(template))
})
test('cosmetic duplicates and new IDs do not inflate structural variety',()=>{
 const {template}=fixture(),a=template.style.layouts[0],b=structuredClone(a);b.id='copy';b.elements[0].id='different';b.elements[0].paragraphs[0].runs[0].text='Another fact';b.elements[0].textStyle.color='#FF0000';b.elements[0].textStyle.size=28
 assert.equal(variantSignature(a,template.style.pageSize),variantSignature(b,template.style.pageSize))
 b.elements[0].frame.x+=1000000;assert.notEqual(variantSignature(a,template.style.pageSize),variantSignature(b,template.style.pageSize))
})
for(const count of [1,3,8])test('public '+count+' variant template has deterministic reachable variety',()=>{
 const {template,plan}=fixture(count),before=JSON.stringify(plan),report=validateDeckPlan(plan,template.style.layouts,{pageSize:template.style.pageSize})
 assert.equal(report.valid,true);assert.equal(report.metrics.reachableVariants,count);assert.equal(report.metrics.targetVariants,Math.min(count,4));assert.equal(report.metrics.variants,count)
 assert.equal(report.diagnostics.some(d=>d.code==='rhythm-limited-variants'),count===1);assert.deepEqual(validateDeckPlan(plan,template.style.layouts,{pageSize:template.style.pageSize}),report);assert.equal(JSON.stringify(plan),before)
})
test('rhythm only warns; short decks still enforce types, links and actual capacity',()=>{
 const {template,plan}=fixture(3);plan.forEach(p=>p.variantId=template.style.layouts[0].id)
 const r=validateDeckPlan(plan,template.style.layouts);assert.equal(r.valid,true);assert.ok(r.diagnostics.some(d=>d.code==='rhythm-variety'));assert.ok(r.diagnostics.some(d=>d.code==='rhythm-variant-run'&&d.alternatives.length===2))
 assert.equal(validateDeckPlan(plan.slice(0,5),template.style.layouts).diagnostics.length,0)
 template.style.layouts[0].description.slots[0].capacity={characters:3}
 assert.ok(validateDeckPlan(plan.slice(0,1),template.style.layouts).diagnostics.some(d=>d.code==='plan-capacity'&&d.severity==='error'))
 plan[0].variantId='missing';assert.equal(validateDeckPlan(plan.slice(0,1),template.style.layouts).valid,false)
})
test('type errors block; heuristic fit risk is only a warning and evidence is explicit',()=>{
 const {template,plan}=fixture(1,1),l=template.style.layouts[0];plan[0].values.body='Long '.repeat(150)
 assert.ok(validateDeckPlan(plan,[l]).diagnostics.some(d=>d.code==='plan-fit-risk'&&d.severity==='warning'))
 plan[0].values.body=123;assert.equal(validateDeckPlan(plan,[l]).valid,false)
 l.description.structures=['process'];l.description.origin='user';plan[0].structure='process';plan[0].values.body='First, then second'
 assert.ok(validateDeckPlan(plan,[l]).diagnostics.some(d=>d.code==='plan-order'))
 plan[0].evidence={ordered:true};assert.equal(validateDeckPlan(plan,[l]).valid,true)
})
test('description types cannot contradict actual slots or contain arbitrary fields',()=>{
 const {template}=fixture(1);template.style.layouts[0].description.slots[0].types=['image'];assert.throws(()=>normalizeSceneTemplate(template),{code:'slot-type'})
 template.style.layouts[0].description=describeVariant(template.style.layouts[0]);template.style.layouts[0].description.binary='no';assert.throws(()=>normalizeSceneTemplate(template),{code:'unknown-field'})
})
test('confirmed chart variants require meaningful order/whole/additivity and do not invent data',()=>{
 const chart={kind:'line',categories:['A','B'],series:[{name:'Facts',values:[2,5]}]},before=JSON.stringify(chart)
 assert.equal(chartApplicability(chart).some(d=>d.code==='chart-order'),true);assert.deepEqual(chartApplicability(chart,{ordered:true}),[])
 assert.equal(chartApplicability({...chart,kind:'doughnut'}).some(d=>d.code==='chart-whole'),true)
 assert.equal(chartApplicability({...chart,kind:'bar',grouping:'percentStacked'},{whole:true,additive:true}).length,0)
 assert.equal(chartApplicability({...chart,kind:'scatter'}).some(d=>d.code==='chart-unconfirmed'),true);assert.equal(JSON.stringify(chart),before)
})
test('server and bundled browser share identical plan descriptions and diagnostics',()=>{
 const context=vm.createContext({});vm.runInContext(bundleClientModel('skills/dsh-ppt/scripts','deck-client-model.mjs')+'\nglobalThis.api=DshDeckModel',context)
 const {template,plan}=fixture(3);plan[0].variantId='unknown';plan[1].values.body=42
 const actual=context.api.validateDeckPlan(plan,template.style.layouts)
 assert.deepEqual(JSON.parse(JSON.stringify(actual)),validateDeckPlan(plan,template.style.layouts))
})
for(const count of [1,3,8])test('mixed semantic plan uses compatible variety on '+count+' variants without fake choices',()=>{
 const {plan,...input}=mixedGenerationFixture(count),t=normalizeSceneTemplate(input),r=validateDeckPlan(plan,t.style.layouts,{pageSize:t.style.pageSize})
 assert.equal(r.valid,true,JSON.stringify(r.diagnostics));assert.equal(r.metrics.structures,11)
 assert.equal(r.diagnostics.length,count===1?2:0,JSON.stringify(r.diagnostics))
 if(count===1)assert.ok(r.diagnostics.every(d=>d.code==='rhythm-variant-run'||d.code==='rhythm-limited-variants'))
})
test('alternative variants propose explicit slot rebinding without changing selected values',()=>{
 const {template,plan}=fixture(1,6),first=template.style.layouts[0],second=createSceneVariant(first,{id:'mirror',mode:'mirror',pageSize:template.style.pageSize}),before=JSON.stringify(plan)
 const r=validateDeckPlan(plan,[first,second],{pageSize:template.style.pageSize})
 assert.equal(r.metrics.reachableVariants,2);const proposal=r.compatibleVariants[0].proposals.find(p=>p.variantId==='mirror')
 assert.equal(proposal.slots[second.slots[0].id],'body');assert.equal(JSON.stringify(plan),before)
})
test('full preflight uses actual rich-text normalization in both Node and browser',()=>{
 const {template,plan}=fixture(1,1);plan[0].values.body=[{runs:[{text:'Fact',style:{unknown:'reject'}}]}]
 const report=validateSceneTemplatePlan(plan,template.style.layouts);assert.equal(report.valid,false);assert.ok(report.diagnostics.some(d=>d.code==='unknown-field'))
 const context=vm.createContext({});vm.runInContext(bundleClientModel('skills/dsh-ppt/scripts','deck-client-model.mjs')+'\nglobalThis.api=DshDeckModel',context)
 assert.deepEqual(JSON.parse(JSON.stringify(context.api.validateSceneTemplatePlan(plan,template.style.layouts))),report)
 plan[0].values.body=[{runs:'invalid'}];assert.equal(validateSceneTemplatePlan(plan,template.style.layouts).valid,false)
})
test('rhythm boundaries and nearby accent semantics are checked without blocking valid content',()=>{
 const {template,plan}=fixture(1,6);assert.equal(validateDeckPlan(plan.slice(0,5),template.style.layouts).diagnostics.length,0);assert.ok(validateDeckPlan(plan,template.style.layouts).diagnostics.some(d=>d.code==='rhythm-variant-run'))
 const {plan:mixed,...input}=mixedGenerationFixture(8),t=normalizeSceneTemplate(input);[mixed[2],mixed[7]]=[mixed[7],mixed[2]]
 const r=validateDeckPlan(mixed,t.style.layouts);assert.equal(r.valid,true);assert.ok(r.diagnostics.some(d=>d.code==='rhythm-accent'))
})
