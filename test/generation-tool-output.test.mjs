import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {buildPptTools} from '../lib/tools.js'
import {resolvePptConfig} from '../lib/config.js'
import {generationEvaluationCases} from './fixtures/generation-evaluation.mjs'
import {templateCreateOptions} from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import {buildDeckAsync,checkDeck,editDeck} from '../skills/dsh-ppt/scripts/deck-advanced.mjs'
const tools=buildPptTools(resolvePptConfig())
test('schema 3 get exposes slot contracts and descriptions without original sample elements',()=>{
 const template=generationEvaluationCases()[0].template;template.style.layouts[0].description.slots[0].capacity={characters:1500}
 const text=tools.find(t=>t.name==='ppt_template').output.render({}, {template:{key:'user:test',revision:1,name:'Test'},manifest:template})[0].text
 for(const value of ['variant-0','variant-1','variant-2','body','required','capacity','estimate','structures','9906000'])assert.ok(text.includes(value),value)
 assert.ok(!text.includes('Sample content'));assert.ok(!text.includes('Каркас:'))
 const legacy=tools.find(t=>t.name==='ppt_template').output.render({}, {template:{key:'user:old',revision:1,name:'Old',outlineTitles:['Legacy cover']},manifest:{schemaVersion:1}})[0].text
 assert.ok(legacy.includes('Legacy cover'))
})
test('create and check show plan warnings separately from clean layout quality, including stale state',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'generation-output-'));t.after(()=>rmSync(dir,{recursive:true,force:true}))
 const fixture=generationEvaluationCases().find(c=>c.id==='mixed-deck');fixture.referencePlan.forEach(p=>p.variantId='variant-0')
 const {create}=templateCreateOptions(fixture.template,{}, {title:'Warnings remain visible',deckPlan:fixture.referencePlan})
 const built=await buildDeckAsync({...create,outputDir:dir,lang:'en'})
 assert.equal(built.quality.warningCount,0)
 for(const internalProject of [true,false]){
  const text=tools.find(t=>t.name==='ppt_create').output.render({}, {...built,internalProject})[0].text
  assert.ok(text.includes('Проверка плана:'));assert.ok(text.includes('rhythm-variant-run'));assert.ok(text.includes('slide-timeline'));assert.ok(text.includes('variant-1'))
 }
 let checked=checkDeck({deckPath:built.jsonPath})
 assert.equal(checked.generationReport.stale,false)
 await editDeck({deckPath:built.jsonPath,edits:[{slide:fixture.referencePlan[0].id,patch:{label:'Explicit new label'}}]})
 checked=checkDeck({deckPath:built.jsonPath});assert.equal(checked.generationReport.stale,true)
 const text=tools.find(t=>t.name==='ppt_check').output.render({},checked)[0].text
 assert.ok(text.includes('отчёт устарел'));assert.ok(text.includes('rhythm-variant-run'))
})
