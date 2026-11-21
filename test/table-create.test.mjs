import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync,existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {unzipSync,strFromU8} from 'fflate'
import {composeTableCreate,tableCreateSchema,tableCreateContentHash} from '../skills/dsh-ppt/scripts/deck-table-create.mjs'
import {compactTemplates} from '../scripts/generation-compact-cases.mjs'
import {createPptExecutors} from '../lib/execution.js'
import {resolvePptConfig} from '../lib/config.js'
import {PptTemplateStore} from '../lib/templates.js'
import {buildPptTools} from '../lib/tools.js'
import * as templates from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import * as engine from '../skills/dsh-ppt/scripts/deck-advanced.mjs'

const template=()=>compactTemplates().find(t=>t.key==='portrait')
const input=()=>({version:1,mode:'factual',allowMoreSlides:true,sources:[{id:'register',text:'Исходный реестр владельца: названия и статусы проектов, неизвестное значение не оценивать.'}],tables:[{id:'register-full',title:'Реестр проектов',sourceRefs:['register'],headers:['Проект','Статус'],rows:Array.from({length:30},(_,i)=>['Проект '+String(i+1).padStart(2,'0'),i===9?null:i%2?'В работе':'Готов'])}]})
const compose=(value=input(),options={})=>composeTableCreate(value,{title:'Реестр проектов',lang:'ru',template:template(),...options})
function readRows(slides){
  const rows=[]
  for(const slide of slides){
    const table=slide.elements.find(e=>e.type==='table').table
    const cell=(row,col)=>table.cells.find(c=>c.row===row&&c.col===col).paragraphs.flatMap(p=>p.runs.map(r=>r.text??'')).join('')
    assert.deepEqual([cell(0,0),cell(0,1)],['Проект','Статус'])
    for(let r=1;r<table.rows.length;r++)rows.push([cell(r,0),cell(r,1)])
  }
  return rows
}

test('normal table composition preserves all rows, unknowns, template geometry and source notes without mutation',()=>{
  const value=input(),before=structuredClone(value),r=compose(value)
  assert.deepEqual(value,before);assert.ok(r.create.slides.length>1)
  assert.deepEqual(readRows(r.create.slides),value.tables[0].rows.map(row=>row.map(c=>c??'—')))
  assert.deepEqual(r.create.style.pageSize,template().manifest.style.pageSize)
  assert.ok(r.create.slides.every(s=>s.elements.some(e=>e.id==='stripe')&&s.notes.includes('register')))
  assert.equal(r.report.visualAcceptance,'not-verified')
  const formatted=input();formatted.tables[0].rows[0]=['001.20','12 345,67 ₽']
  assert.deepEqual(readRows(compose(formatted).create.slides)[0],formatted.tables[0].rows[0])
})

test('table creation selects a fitting content reference but honors an explicit layout',()=>{
  const t=template(),good=structuredClone(t.manifest.style.layouts.find(l=>l.purpose==='content'))
  good.id='table-reference'
  const sparse=structuredClone(good);sparse.id='sparse-reference'
  // A large fixed logo leaves no useful table area on this content reference.
  sparse.elements.push({id:'blocked-logo',role:'decor',type:'shape',preset:'ellipse',frame:{x:0,y:0,w:t.manifest.style.pageSize.width,h:t.manifest.style.pageSize.height},fill:{color:'#112233'}})
  t.manifest.style.layouts=[sparse,good]
  const value=input(),before=structuredClone({value,t}),r=compose(value,{template:t})
  assert.ok(r.create.slides.every(s=>s.designLayout===good.id))
  assert.deepEqual(readRows(r.create.slides),value.tables[0].rows.map(row=>row.map(c=>c??'—')))
  assert.deepEqual({value,t},before)
  value.tables[0].designLayout=sparse.id
  assert.throws(()=>compose(value,{template:t}),e=>e.code==='component-capacity')
})

test('table creation rejects malformed data, unknown fields and sources, synthetic factual mode and unapproved pagination',()=>{
  for(const mutate of [
    v=>v.tables[0].frame={x:0},v=>v.tables[0].rows[0].pop(),v=>v.tables[0].rows[0][1]=12,
    v=>v.tables[0].sourceRefs=['unknown'],v=>v.sources[0].synthetic=true,
    v=>v.tables.push(structuredClone(v.tables[0])),v=>v.mode='invented',v=>v.sources[0].id='bad id',v=>v.version=2
  ]){const v=input();mutate(v);assert.throws(()=>compose(v))}
  const v=input();delete v.allowMoreSlides
  assert.throws(()=>compose(v),e=>e.code==='component-capacity')
  assert.throws(()=>compose(input(),{maxSlides:1}),e=>e.code==='component-slide-limit')
  const demo=input();demo.mode='demo';demo.sources[0].synthetic=true
  assert.ok(compose(demo).create.slides.every(s=>s.elements.some(e=>e.id==='gen-disclosure')))
})

test('table creation identifies an omitted numeric version without changing the request or suggesting stringification',()=>{
  const value=input();delete value.version
  const before=structuredClone(value)
  assert.throws(()=>compose(value),e=>e.code==='table-spec'&&e.message.includes('Missing required field tableSpec.version')&&e.message.includes('"version":1')&&e.diagnostics[0].path==='tableSpec.version')
  assert.deepEqual(value,before)
  for(const version of ['1',null,2]) assert.throws(()=>compose({...value,version}),/version must be the number 1/)
  assert.throws(()=>compose(JSON.stringify({...value,version:1})),/JSON object, not a JSON string/)
})

test('automatic table reference selection avoids unnecessary row fragmentation',()=>{
  const t=template(),wide=structuredClone(t.manifest.style.layouts.find(l=>l.purpose==='content'))
  wide.id='wide-reference'
  const narrow=structuredClone(wide);narrow.id='narrow-reference'
  const page=t.manifest.style.pageSize
  narrow.elements.push({id:'side-artwork',role:'decor',type:'shape',preset:'ellipse',frame:{x:Math.round(page.width*.45),y:Math.round(page.height*.25),w:Math.round(page.width*.5),h:Math.round(page.height*.65)},fill:{color:'#112233'}})
  t.manifest.style.layouts=[narrow,wide]
  const value=input();value.tables[0].rows=[['Long source paragraph '.repeat(50),'Ready']]
  value.tables[0].designLayout=narrow.id
  const cramped=compose(value,{template:t})
  delete value.tables[0].designLayout
  const selected=compose(value,{template:t})
  assert.ok(selected.report.slideCount<cramped.report.slideCount)
  assert.ok(selected.create.slides.every(s=>s.designLayout===wide.id))
})

test('ppt_create tool publishes the full portable table contract',()=>{
  const definition=buildPptTools(resolvePptConfig({})).find(t=>t.name==='ppt_create')
  assert.deepEqual(definition.parameters.properties.tableSpec.required,tableCreateSchema().required)
  assert.deepEqual(definition.parameters.properties.tableSpec.properties.tables.items.required,['id','title','sourceRefs','headers','rows'])
  assert.equal(definition.parameters.properties.tableSpec.properties.tables.items.properties.rows.items.items.oneOf[1].type,'null')
  assert.equal(definition.parameters.properties.tableSpec.properties.contentHash.pattern,'^[a-f0-9]{64}$')
})

test('an optional verified content hash catches whitespace changes before composition',()=>{
  const value=input();value.tables[0].rows[0][0]='50\u00a0000';value.tables[0].notes='Source note  '
  value.contentHash=tableCreateContentHash(value)
  assert.ok(compose(value).create.slides.length>0)
  const changed=structuredClone(value);changed.tables[0].rows[0][0]='50 000'
  assert.throws(()=>compose(changed),/Content hash mismatch/)
  changed.tables[0].rows[0][0]='50\u00a0000';changed.tables[0].notes='Source note'
  assert.throws(()=>compose(changed),/Content hash mismatch/)
  const reordered={tables:value.tables,sources:value.sources,contentHash:value.contentHash,mode:value.mode,version:1,allowMoreSlides:true}
  assert.equal(tableCreateContentHash(reordered),value.contentHash)
  assert.ok(compose(reordered).create.slides.length>0)
  value.contentHash='invalid';assert.throws(()=>compose(value),/Content hash mismatch/)
  delete changed.contentHash;assert.ok(compose(changed).create.slides.length>0)
})

test('ppt_create tableSpec exports real native PPTX/HTML with session storage and authorized template access',async t=>{
  const root=mkdtempSync(join(tmpdir(),'table-create-'));t.after(()=>rmSync(root,{recursive:true,force:true}))
  const store=new PptTemplateStore({root:join(root,'templates'),templatesModuleLoader:async()=>templates})
  const identity={login:'alice',admin:false,local:false},record=template()
  await store.save({manifest:record.manifest,assets:record.assets,identity})
  const tools=createPptExecutors(resolvePptConfig({}),async()=>engine,{templateStore:store})
  const exec={agent:{session:{header:{cwd:root,id:'normal-register',owner:'alice'}}}}
  const args={title:'Реестр проектов',templateId:'user:'+record.manifest.id,lang:'ru',tableSpec:input()}
  const made=await tools.create(args,exec)
  assert.ok(made.ok&&made.slideCount>1);assert.equal(made.internalProject,true)
  assert.equal(made.verification.visual,'not-verified');assert.ok(made.outputDir.includes('session-'))
  assert.ok(existsSync(made.htmlPath)&&existsSync(made.pptxPath)&&existsSync(made.jsonPath))
  const project=JSON.parse(readFileSync(made.jsonPath,'utf8'))
  assert.deepEqual(readRows(project.slides),input().tables[0].rows.map(row=>row.map(c=>c??'—')))
  const parts=unzipSync(readFileSync(made.pptxPath))
  for(let i=1;i<=made.slideCount;i++)assert.match(strFromU8(parts[`ppt/slides/slide${i}.xml`]),/<a:tbl>/)
  assert.equal(made.tableComposition.slideCount,made.slideCount)
  await assert.rejects(tools.create(args,{agent:{session:{header:{cwd:root,id:'other',owner:'bob'}}}}))
})

test('tableSpec conflicts, template errors, limits and cancellation never fall back to draft pages or export',async()=>{
  let builds=0
  const record=template(),config=resolvePptConfig({maxSlides:3})
  const tools=createPptExecutors(config,async()=>({buildDeckAsync:async()=>{builds++;return {ok:true}}}),{templateStore:{get:async()=>record}})
  const args={title:'Реестр',templateId:'user:chosen',lang:'ru',tableSpec:input()}
  args.tableSpec.tables.push({...structuredClone(args.tableSpec.tables[0]),id:'second-register'})
  for(const key of ['content','slides','deckPlan','templateSelections','brand','style','assets','dataModel'])await assert.rejects(tools.create({...args,[key]:{}}),/cannot be combined/)
  await assert.rejects(tools.create({...args,templateId:''}),/requires/)
  await assert.rejects(tools.create(args),e=>e.code==='component-slide-limit')
  args.tableSpec.contentHash=tableCreateContentHash(args.tableSpec)
  args.tableSpec.tables[0].rows[0][0]+=' '
  await assert.rejects(tools.create(args),/Content hash mismatch/)
  const legacy=createPptExecutors(resolvePptConfig({}),async()=>({buildDeckAsync:async()=>{builds++}}),{templateStore:{get:async()=>({manifest:{schemaVersion:1},assets:{}})}})
  await assert.rejects(legacy.create(args))
  const controller=new AbortController();controller.abort(new Error('cancelled'))
  await assert.rejects(tools.create(args,{signal:controller.signal}),/cancelled/)
  assert.equal(builds,0)
})
