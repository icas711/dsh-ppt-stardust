import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync,readdirSync,existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {unzipSync,strFromU8} from 'fflate'
import {createPptExecutors} from '../lib/execution.js'
import {PptTemplateStore} from '../lib/templates.js'
import * as templates from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import * as engine from '../skills/dsh-ppt/scripts/deck-advanced.mjs'
import {composeSceneTemplateSlides,resolveSceneReference} from '../skills/dsh-ppt/scripts/deck-template-scene.mjs'
import {buildPptTools} from '../lib/tools.js'
import {resolvePptConfig} from '../lib/config.js'
import {renderScenePptx} from '../skills/dsh-ppt/scripts/deck-scene-pptx.mjs'

const frame={x:500000,y:500000,w:7500000,h:600000}
const text=(id,value,y=500000)=>({id,type:'text',frame:{...frame,y},paragraphs:[{runs:[{text:value}]}]})
function fixture(){
 const reference=purpose=>({id:purpose,purpose,name:purpose,elements:[
  {id:'art',type:'shape',role:'decor',preset:'rect',frame:{x:0,y:0,w:100000,h:6000000},fill:{color:purpose==='cover'?'#FF0000':'#0000FF'}},
  {...text('heading','Sample heading'),textStyle:{fontFamily:'Arial',size:32,color:'#123456'}},
  {...text('body','Sample body',1500000),frame:{...frame,y:1500000,h:3500000},textStyle:{fontFamily:'Arial',size:18,color:'#234567'}}
 ],slots:[{id:'title',elementId:'heading',type:'text',required:true},{id:'body',elementId:'body',type:'text',required:true,maxCharacters:2}]})
 const template={schemaVersion:3,id:'free-compose',name:'Two references',revision:1,style:{pageSize:{width:9906000,height:6858000},layouts:[reference('cover'),reference('content')]},assetMap:{}}
 const slides=Array.from({length:11},(_,i)=>({layout:'scene',id:'page-'+i,purpose:i?'content':'cover',elements:[text('heading','Conclusion '+i),
  {id:'art',type:'shape',preset:'roundRect',frame:{x:400000,y:1400000,w:8000000,h:4000000},fill:{color:'#EEEEEE'}},
  text('detail-a','Evidence and explanation '+i,1600000),text('detail-b','Additional substantive material '+i,3000000),
  ...(i===1?[{id:'data',type:'chart',frame:{x:1000000,y:3800000,w:6000000,h:1800000},chart:{kind:'column',categories:['A','B'],series:[{name:'Values',values:[12,8]}]}}]:[])
 ]}))
 return {template,slides}
}

test('two references allow eleven freely composed slides without slot limits or sample content',()=>{
 const {template,slides}=fixture(),before=structuredClone({template,slides})
 const {create}=templates.templateCreateOptions(template,{}, {title:'Composition',slides})
 assert.equal(create.slides.length,11);assert.equal(create.generation,undefined)
 create.slides.forEach((s,i)=>{
  assert.equal(s.designLayout,i?'content':'cover');assert.equal(s.elements.length,i===1?6:5)
  assert.equal(s.elements[0].fill.color,i?'#0000FF':'#FF0000')
  assert.equal(new Set(s.elements.map(e=>e.id)).size,s.elements.length)
  assert.equal(s.elements.find(e=>e.id==='heading').textStyle.size,32)
  assert.equal(s.elements.find(e=>e.id==='detail-a').textStyle.size,18)
  assert.ok(!JSON.stringify(s).includes('Sample'))
 })
 assert.deepEqual(create.style.pageSize,template.style.pageSize)
 assert.deepEqual({template,slides},before)
 assert.throws(()=>templates.templateCreateOptions(template,{}, {title:'Bad',slides,deckPlan:[]}),/mutually exclusive/)
 const closing=templates.templateCreateOptions(template,{}, {title:'End',slides:[{...slides[1],purpose:'closing'}]}).create.slides[0]
 assert.equal(closing.purpose,'closing');assert.equal(closing.designLayout,'content')
 assert.throws(()=>templates.templateCreateOptions(template,{}, {title:'Bad ref',slides:[{...slides[1],designLayout:'missing'}]}),/No reference/)
})

test('real tool exports all free content, fixed artwork and editable chart from a two-page template',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'free-composition-'));t.after(()=>rmSync(dir,{recursive:true,force:true}))
 const {template,slides}=fixture(),identity={login:'composition-user',admin:false,local:false}
 const store=new PptTemplateStore({root:join(dir,'library'),templatesModuleLoader:async()=>templates,admins:[]})
 await store.save({manifest:template,assets:{},identity})
 const tools=createPptExecutors({outputDir:dir,maxSlides:60,defaultTheme:'data',defaultLang:'en',admins:[]},async()=>engine,{templateStore:store})
 const made=await tools.create({title:'Free composition',templateId:'user:'+template.id,slides,lang:'en'}, {agent:{session:{header:{owner:identity.login}}}})
 assert.equal(made.slideCount,11)
 const saved=engine.readDeckProject({deckPath:made.jsonPath}).manifest
 assert.equal(saved.slides[10].elements[0].fill.color,'#0000FF')
 assert.equal(saved.slides[10].elements.find(e=>e.id==='detail-b').paragraphs[0].runs[0].text,'Additional substantive material 10')
 const parts=unzipSync(readFileSync(made.pptxPath)),xml=strFromU8(parts['ppt/slides/slide11.xml'])
 assert.ok(xml.includes('Evidence and explanation 10'));assert.ok(xml.includes('0000FF'));assert.ok(xml.includes('roundRect'))
 assert.ok(Object.keys(parts).some(k=>/^ppt\/charts\/chart\d+\.xml$/.test(k)))
 assert.deepEqual(saved.slides[1].elements.find(e=>e.id==='data').chart.series[0].values,[12,8])
})

test('content-only references require an explicit cover ID while preserving semantic purpose and original template',()=>{
 const {template,slides}=fixture()
 const [title,body]=template.style.layouts
 Object.assign(title,{id:'title-reference',name:'Title artwork',purpose:'content'})
 Object.assign(body,{id:'body-reference',name:'Body artwork',purpose:'content'})
 const before=structuredClone(template)
 assert.throws(()=>composeSceneTemplateSlides([slides[0]],template,{}),error=>{
  assert.equal(error.code,'composition-reference');assert.equal(error.slide,1);assert.equal(error.purpose,'cover')
  assert.deepEqual(error.availableLayouts,[{id:'title-reference',name:'Title artwork',purpose:'content'},{id:'body-reference',name:'Body artwork',purpose:'content'}])
  assert.match(error.message,/No reference for purpose "cover"/)
  assert.match(error.message,/"purpose":"cover","designLayout":"title-reference"/)
  assert.match(error.message,/not an automatic choice/);return true
 })
 const result=composeSceneTemplateSlides([{...slides[0],designLayout:'title-reference'},{...slides[1],designLayout:'body-reference'}, {...slides[2],purpose:'closing'}],template,{})
 assert.equal(result[0].purpose,'cover');assert.equal(result[0].designLayout,'title-reference')
 assert.equal(result[0].elements[0].fill.color,'#FF0000')
 assert.equal(result[1].elements[0].fill.color,'#0000FF')
 // The fallback is the FIRST content reference, not a visual guess about its name.
 assert.equal(result[2].purpose,'closing');assert.equal(result[2].designLayout,'title-reference')
 assert.equal(resolveSceneReference({purpose:'section'},template.style.layouts).id,'title-reference')
 assert.throws(()=>resolveSceneReference({purpose:'closing',designLayout:'unknown'},template.style.layouts,3),error=>{
  assert.equal(error.slide,4);assert.equal(error.designLayout,'unknown');assert.match(error.message,/Unknown explicit designLayout/);return true
 })
 assert.throws(()=>resolveSceneReference({purpose:'content'},[{...body,purpose:'section'}]),/Available layouts/)
 assert.throws(()=>resolveSceneReference({purpose:'cover'},[]),/no reference layouts/)
 assert.deepEqual(template,before)
})

test('template get text exposes default reference IDs and schema explains explicit cross-purpose selection',()=>{
 const {template}=fixture();template.style.layouts[0].purpose='content'
 const tools=buildPptTools(resolvePptConfig({}))
 const output=tools.find(t=>t.name==='ppt_template').output.render({}, {template:{key:'user:free-compose',name:'Two references',revision:1},manifest:template})[0].text
 const data=JSON.parse(output.slice(output.indexOf('{\n')))
 assert.deepEqual(data.defaultReferences,{cover:null,content:'cover',section:'cover',closing:'cover'})
 assert.match(output,/keep purpose:cover/)
 const scene=tools.find(t=>t.name==='ppt_create').parameters.properties.slides.items.properties
 assert.match(scene.designLayout.description,/explicit ID wins even across purposes/)
 assert.match(scene.designLayout.description,/Cover without a cover reference requires an explicit ID/)
})

test('template get exposes relative anchors; chosen widths preserve right edge in exported PPTX',async t=>{
 const {template:raw}=fixture(),template=templates.validateTemplateManifest(raw),header=template.style.layouts[1].elements.find(e=>e.id==='heading')
 header.frame={x:4451230,y:306559,w:5084321,h:357870}
 header.paragraphs[0].style={align:'right'}
 header.paragraphs[0].runs[0].style={size:18,bold:true}
 const before=structuredClone(template),tool=buildPptTools(resolvePptConfig({})).find(t=>t.name==='ppt_template')
 const value={template:{key:'user:headers',name:'Headers',revision:1},manifest:template}
 const summary=tool.output.render({},value)[0].text
 const data=JSON.parse(summary.slice(summary.indexOf('{\n'))),variant=data.variants[1]
 const region=variant.compositionGuides.text.find(r=>r.id==='heading')
 assert.equal(region.alignment,'right');assert.equal(region.typography.size,18)
 assert.equal(region.anchor.x,96.26);assert.equal(variant.compositionGuides.units,'percentOfPage')
 assert.deepEqual(variant.compositionGuides.decor.map(r=>r.id),['art'])
 assert.equal(variant.slots,undefined);assert.equal(variant.description,undefined)
 assert.equal(data.defaultReferences.cover,'cover');assert.equal(variant.purpose,'content')
 assert.doesNotMatch(summary,/Sample heading|"frame"|maxCharacters/)
 const fixed=tool.output.render({includeFixedSlots:true},value)[0].text
 const fixedData=JSON.parse(fixed.slice(fixed.indexOf('{\n')))
 assert.deepEqual(fixedData.variants[1].textRegions[0].frame,header.frame)
 assert.equal(fixedData.variants[1].slots[0].required,true)
 assert.equal(fixedData.variants[1].compositionGuides,undefined)
 assert.ok(summary.length<fixed.length)
 const right=header.frame.x+header.frame.w
 const sceneSlides=[]
 const outputs=[4000000,5500000].map((w,i)=>{
  const frame={x:right-w,y:306559,w,h:600000}
  const slides=composeSceneTemplateSlides([{layout:'scene',purpose:'content',elements:[{id:'new-header',type:'text',frame,paragraphs:[{style:{align:'right'},runs:[{text:i?'Long heading with supporting detail':'Short'}]}]}]}],template,{})
  assert.deepEqual(slides[0].elements.find(e=>e.id==='new-header').frame,frame)
  assert.ok(!slides[0].elements.some(e=>e.id==='heading'))
  sceneSlides.push({...slides[0],id:'header-'+i})
  const xml=renderScenePptx(slides[0]).xml
  assert.match(xml,/<a:pPr algn="r"/)
  assert.ok(xml.includes(`<a:off x="${right-w}" y="306559"`))
  assert.ok(xml.includes(`<a:ext cx="${w}" cy="600000"`))
  return xml
 })
 assert.notEqual(outputs[0],outputs[1]);assert.deepEqual(template,before)
 const dir=mkdtempSync(join(tmpdir(),'relative-headers-'));t.after(()=>rmSync(dir,{recursive:true,force:true}))
 const made=await engine.buildDeckAsync({title:'Relative headers',outputDir:dir,style:{pageSize:template.style.pageSize},slides:sceneSlides})
 const parts=unzipSync(readFileSync(made.pptxPath))
 for(const [i,w] of [4000000,5500000].entries()){
  const xml=strFromU8(parts[`ppt/slides/slide${i+1}.xml`])
  assert.match(xml,/<a:pPr algn="r"/)
  assert.ok(xml.includes(`<a:off x="${right-w}" y="306559"`))
  assert.ok(xml.includes(`<a:ext cx="${w}" cy="600000"`))
 }

})

test('reference failures through the creation executor never generate delivery files or modify the template',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'reference-preflight-'));t.after(()=>rmSync(dir,{recursive:true,force:true}))
 const {template,slides}=fixture(),identity={login:'reference-user',admin:false,local:false}
 template.style.layouts[0].purpose='content'
 const store=new PptTemplateStore({root:join(dir,'library'),templatesModuleLoader:async()=>templates,admins:[]})
 await store.save({manifest:template,assets:{},identity})
 const files=readdirSync(dir,{recursive:true}).sort(),saved=await store.get('user:'+template.id,identity)
 let generations=0
 const executors=createPptExecutors(resolvePptConfig({outputDir:join(dir,'delivery')}),async()=>({...engine,buildDeckAsync:args=>{generations++;return engine.buildDeckAsync(args)}}),{templateStore:store})
 const exec={agent:{session:{header:{owner:identity.login}}}}
 for(const bad of [[slides[0]],[{...slides[1],designLayout:'does-not-exist'}]]){
  await assert.rejects(executors.create({title:'Invalid reference',templateId:'user:'+template.id,slides:bad},exec),/composition-reference/)
  assert.equal(generations,0);assert.equal(existsSync(join(dir,'delivery')),false)
  assert.deepEqual(readdirSync(dir,{recursive:true}).sort(),files)
  assert.deepEqual(await store.get('user:'+template.id,identity),saved)
 }
})

test('scene template creation preserves declared roles; PPTX import defaults to content without guessing a cover',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'reference-import-'));t.after(()=>rmSync(dir,{recursive:true,force:true}))
 const {slides}=fixture(),source=await engine.buildDeckAsync({title:'Title artwork',outputDir:dir,slides:[slides[0]]})
 const manifest=engine.readDeckProject({deckPath:source.jsonPath}).manifest
 const fromProject=templates.templateFromSceneManifest(manifest,{templateId:'project-roles',name:'Declared roles'})
 assert.equal(fromProject.manifest.style.layouts[0].purpose,'cover')
 assert.ok(fromProject.manifest.style.layouts[0].slots.filter(s=>s.type==='text').every(s=>s.required===false))
 const original=readFileSync(source.pptxPath)
 const imported=await templates.templateFromPptxScene(source.pptxPath,{templateId:'imported-roles',name:'Imported title artwork'})
 assert.equal(imported.manifest.style.layouts[0].purpose,'content')
 assert.deepEqual(readFileSync(source.pptxPath),original)
 const store=new PptTemplateStore({root:join(dir,'library'),templatesModuleLoader:async()=>templates})
 const executors=createPptExecutors(resolvePptConfig({}),async()=>engine,{templateStore:store})
 const exec={agent:{session:{header:{owner:'import-guides-user'}}}}
 const originalProject=readFileSync(source.jsonPath)
 for(const args of [
  {operation:'create-from-project',deckPath:source.jsonPath,newTemplateId:'project-tool',name:'Project tool'},
  {operation:'create-from-pptx',pptxPath:source.pptxPath,newTemplateId:'pptx-tool',name:'PPTX tool'},
 ]){
  const made=await executors.template(args,exec)
  assert.match(made.report.textAreas,/optional fixed slots/)
  const got=await executors.template({operation:'get',templateId:made.key},exec)
  assert.ok(got.manifest.style.layouts.flatMap(l=>l.slots).filter(s=>s.type==='text').every(s=>s.required===false))
  const tool=buildPptTools(resolvePptConfig({})).find(t=>t.name==='ppt_template')
  const rendered=tool.output.render({},got)[0].text
  assert.match(rendered,/compositionGuides/);assert.doesNotMatch(rendered,/"textRegions"|"slots"/)
 }
 assert.deepEqual(readFileSync(source.jsonPath),originalProject)
 const reference=imported.manifest.style.layouts[0]
 const composed=composeSceneTemplateSlides([{layout:'scene',purpose:'cover',designLayout:reference.id,elements:[text('new-title','New title')]}],imported.manifest,{})
 assert.equal(composed[0].purpose,'cover');assert.equal(composed[0].designLayout,reference.id)
 assert.equal(imported.manifest.style.layouts[0].purpose,'content')
})
