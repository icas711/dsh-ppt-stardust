import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync,writeFileSync,existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {generationFixture} from './fixtures/generation.mjs'
import {mixedGenerationFixture} from './fixtures/generation.mjs'
import {createPptExecutors} from '../lib/execution.js'
import {PptTemplateStore} from '../lib/templates.js'
import {templateCreateOptions,buildTemplateBundle,readTemplateBundle} from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import {buildDeckAsync,editDeck,undoDeck,readDeckProject} from '../skills/dsh-ppt/scripts/deck-advanced.mjs'

test('validated deck plan survives ZIP, creates real editable scenes and reports stale state after edits',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'generation-plan-'));t.after(()=>rmSync(dir,{recursive:true,force:true}))
 const {plan,...fixture}=generationFixture(3,6),path=join(dir,'template.zip');writeFileSync(path,buildTemplateBundle(fixture,{}))
 const bundle=readTemplateBundle(path),applied=templateCreateOptions(bundle.manifest,bundle.assets,{title:'Planned deck',deckPlan:plan})
 assert.equal(applied.generationReport.valid,true);assert.equal(applied.create.slides[0].id,plan[0].id)
 assert.ok(applied.create.slides[0].elements[0].paragraphs[0].runs[0].text.includes('Public fact 0'))
 const built=await buildDeckAsync({...applied.create,outputDir:dir,fileName:'planned',lang:'en'})
 assert.ok(existsSync(built.pptxPath));assert.equal(built.generationReport.stale,false)
 const project=readDeckProject({deckPath:built.jsonPath}).manifest;assert.deepEqual(project.generation.plan,plan);assert.deepEqual(project.style.pageSize,fixture.style.pageSize)
 const elements=structuredClone(project.slides[0].elements);elements[0].paragraphs[0].runs[0].text='Explicit changed content'
 const edited=await editDeck({deckPath:built.jsonPath,edits:[{slide:plan[0].id,patch:{elements}}]})
 assert.equal(edited.generationReport.stale,true)
 const restored=await undoDeck({deckPath:built.jsonPath});assert.equal(restored.generationReport.stale,false)
 assert.ok(readFileSync(built.pptxPath).length>1000)
})
test('invalid plans stop before artifact creation; legacy templates reject plan instead of ignoring it',()=>{
 const {plan,...fixture}=generationFixture(1,1);plan[0].values.body=42
 assert.throws(()=>templateCreateOptions(fixture,{}, {title:'Invalid',deckPlan:plan}),error=>error.code==='generation-plan-invalid'&&error.diagnostics.some(d=>d.code==='slot-type'))
 assert.throws(()=>templateCreateOptions(fixture,{}, {title:'Mixed',deckPlan:plan,selections:[]}),/mutually exclusive/)
 assert.throws(()=>templateCreateOptions({schemaVersion:1,id:'legacy',name:'Legacy',outline:[{layout:'cover',title:'Test'}]}, {},{title:'Ignored?',deckPlan:plan}),/schema 3/)
})
test('real tools validate a mixed plan without writes and then generate twelve editable slides',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'generation-tools-'));t.after(()=>rmSync(dir,{recursive:true,force:true}))
 const engine=await import('../skills/dsh-ppt/scripts/deck-advanced.mjs'),mod=await import('../skills/dsh-ppt/scripts/deck-templates.mjs')
 const store=new PptTemplateStore({root:join(dir,'library'),templatesModuleLoader:async()=>mod,admins:[]}),identity={login:'generation-user',admin:false,local:false},exec={agent:{session:{header:{owner:'generation-user'}}}}
 const {plan,...manifest}=mixedGenerationFixture(8);await store.save({manifest,assets:{},identity})
 const tools=createPptExecutors({outputDir:dir,maxSlides:60,defaultTheme:'data',defaultLang:'en',admins:[]},async()=>engine,{templateStore:store})
 const report=await tools.template({operation:'validate-plan',templateId:'user:'+manifest.id,deckPlan:plan},exec)
 assert.equal(report.generationReport.valid,true);assert.equal(report.generationReport.diagnostics.length,0)
 const made=await tools.create({title:'Mixed public deck',templateId:'user:'+manifest.id,deckPlan:plan,outputDir:dir,lang:'en'},exec)
 assert.equal(made.slideCount,12);assert.equal(made.generationReport.valid,true);assert.equal(made.generationReport.stale,false)
 const project=readDeckProject({deckPath:made.jsonPath}).manifest;assert.equal(project.slides.filter(s=>s.semanticSource).length,10)
 const zip=await import('fflate'),parts=zip.unzipSync(readFileSync(made.pptxPath));assert.ok(Object.keys(parts).some(k=>/^ppt\/charts\/chart\d+\.xml$/.test(k)))
 await assert.rejects(tools.create({title:'Mixed inputs',templateId:'user:'+manifest.id,deckPlan:plan,content:'Do not ignore this'},exec),/cannot be combined/)
})
