import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import vm from 'node:vm'
import {workingReportFixture} from './fixtures/working-report.mjs'
import {normalizeSceneTemplate,remapSceneLayout} from '../skills/dsh-ppt/scripts/deck-template-scene.mjs'
import {templateCreateOptions,buildTemplateBundle,readTemplateZip} from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import {buildDeckAsync,readDeckProject,editDeck,undoDeck,checkDeck} from '../skills/dsh-ppt/scripts/deck-advanced.mjs'
import {restoreSemanticRepresentation} from '../skills/dsh-ppt/scripts/deck-diagrams.mjs'
import {PptTemplateStore} from '../lib/templates.js'
import {PptWorkbench} from '../lib/workbench.js'
const text=e=>e.paragraphs?.flatMap(p=>p.runs.map(r=>r.text??'')).join('\n')??''

test('working template keeps separate headings, explicit KPI hierarchy and shared comparison criteria',()=>{
 const {template,plan}=workingReportFixture(),normalized=normalizeSceneTemplate(template)
 const roundtrip=readTemplateZip(buildTemplateBundle(normalized,{})).manifest
 const {create,generationReport}=templateCreateOptions(roundtrip,{}, {title:'Пилот',deckPlan:plan})
 assert.equal(generationReport.valid,true);assert.equal(generationReport.diagnostics.length,0)
 for(const [i,slide]of create.slides.entries()){
  assert.equal(text(slide.elements.find(e=>e.slotId==='heading')),plan[i].values.heading)
  assert.equal(text(slide.elements.find(e=>e.slotId==='source')),plan[i].values.source)
  assert.deepEqual(slide.elements.find(e=>e.id==='brand-rule'),normalized.style.layouts[i%3].elements[0])
  const region=normalized.style.layouts[i%3].elements.find(e=>e.id==='body').frame
  for(const e of slide.elements.filter(e=>slide.semanticSource.elementIds.includes(e.id))){assert.ok(e.frame.x>=region.x);assert.ok(e.frame.y>=region.y);assert.ok(e.frame.x+e.frame.w<=region.x+region.w+1);assert.ok(e.frame.y+e.frame.h<=region.y+region.h+1)}
 }
 const kpi=create.slides[0],value=kpi.elements.find(e=>text(e)==='99 %'),label=kpi.elements.find(e=>text(e)==='Доступность')
 assert.equal(value.textStyle.size,44);assert.equal(value.textStyle.bold,true);assert.equal(label.textStyle.size,20)
 const comparison=create.slides[1]
 assert.equal(comparison.elements.filter(e=>text(e)==='Контроль данных').length,1)
 assert.equal(comparison.elements.find(e=>text(e)==='Локальный').textStyle.size,24)
 assert.ok(comparison.elements.some(e=>text(e)==='Неизвестно'))
 const list=restoreSemanticRepresentation(kpi,'list'),visual=restoreSemanticRepresentation(list,'visual')
 assert.equal(list.elements.find(e=>e.id==='heading').textStyle.size,32)
 assert.equal(visual.elements.find(e=>text(e)==='99 %').textStyle.size,44)
 assert.deepEqual(visual.semanticSource.region,kpi.semanticSource.region)
 const moved=remapSceneLayout(kpi,normalized.style.layouts[0],normalized.style.layouts[1],{pageSize:normalized.style.pageSize,textStyles:normalized.style.textStyles,accent:'#164B60',background:'#FFFFFF'})
 assert.equal(moved.diagnostics.length,0);assert.equal(moved.slide.semanticSource.diagram.items[0].value,99)
 assert.equal(text(moved.slide.elements.find(e=>e.slotId==='heading')),plan[0].values.heading)
 assert.equal(moved.slide.semanticSource.region.x,4100000)
 const incompatible=structuredClone(normalized.style.layouts[1]);incompatible.slots=incompatible.slots.filter(s=>s.id!=='body')
 const preserved=remapSceneLayout(kpi,normalized.style.layouts[0],incompatible)
 assert.ok(preserved.diagnostics.some(d=>d.code==='unmapped-content-preserved'));assert.ok(preserved.slide.elements.some(e=>text(e)==='99 %'))
})

test('working template edits through panel save/preview, ZIP and project undo without losing headings or data',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'working-report-'));t.after(()=>rmSync(directory,{recursive:true,force:true}))
 const {template,plan}=workingReportFixture(),store=new PptTemplateStore({root:join(directory,'templates'),templatesModuleLoader:()=>import('../skills/dsh-ppt/scripts/deck-templates.mjs')})
 const wb=new PptWorkbench({catalogPath:join(directory,'catalog.jsonl')});wb.attachTemplateStore(store)
 const identity={login:'alice',admin:false,local:false}
 const saved=await wb.action({operation:'template-save',manifest:template,scope:'user'},undefined,identity)
 const draft=structuredClone(saved.template);draft.style.textStyles.title.size=48
 const edited=await wb.action({operation:'template-save',manifest:draft,scope:'user',baseKey:saved.key,expectedRevision:saved.template.revision},undefined,identity)
 const preview=await wb.action({operation:'template-preview',manifest:edited.template,baseKey:edited.key,lang:'ru'},undefined,identity)
 assert.ok(preview.html.includes('Заголовок'))
 const {create}=await store.createOptions(edited.key,identity,{title:'Пилот',deckPlan:plan})
 const built=await buildDeckAsync({...create,outputDir:directory,lang:'ru'})
 assert.equal(checkDeck({deckPath:built.jsonPath}).errorCount,0)
 let project=readDeckProject({deckPath:built.jsonPath}).manifest
 assert.equal(project.slides[0].elements.find(e=>text(e)==='99 %').textStyle.size,48)
 await editDeck({deckPath:built.jsonPath,edits:[{slide:plan[0].id,patch:{restoreRepresentation:'list'}}]})
 await undoDeck({deckPath:built.jsonPath})
 project=readDeckProject({deckPath:built.jsonPath}).manifest
 assert.equal(text(project.slides[0].elements.find(e=>e.id==='heading')),plan[0].values.heading)
 assert.equal(project.slides[0].elements.find(e=>text(e)==='99 %').textStyle.size,48)
 await editDeck({deckPath:built.jsonPath,style:project.style,layoutMap:{[plan[0].id]:'side-heading'}})
 const reflow=readDeckProject({deckPath:built.jsonPath}).manifest.slides[0]
 assert.equal(reflow.semanticSource.diagram.items[0].value,99);assert.equal(reflow.semanticSource.region.x,4100000)
})

test('typography editor changes a role and roundtrips through the shared template contract',()=>{
 const {template}=workingReportFixture(),draft={textStyles:template.style.textStyles};let changed
 const h=(type,props,...children)=>({type,props:props??{},children:children.flat(Infinity)})
 const context=vm.createContext({h,languageOf:()=> 'ru',tplClone:structuredClone,W:{Button:'button'},TplColorField:'color'})
 vm.runInContext(readFileSync('templates/panels/template-editor.js','utf8'),context)
 context.input={draft,disabled:false,set:patch=>changed=patch}
 const tree=vm.runInContext('TplSemanticTypography(input)',context),nodes=[]
 const walk=n=>{if(n&&typeof n==='object'){nodes.push(n);n.children?.forEach(walk)}};walk(tree)
 const size=nodes.find(n=>n.type==='input'&&n.props.type==='number'&&n.props.value===44)
 assert.ok(size);size.props.onChange({target:{value:'48'}})
 assert.equal(normalizeSceneTemplate({...template,style:{...template.style,...changed}}).style.textStyles.title.size,48)
 assert.throws(()=>normalizeSceneTemplate({...template,style:{...template.style,textStyles:{title:{size:0}}}}),/Font size/)
})
