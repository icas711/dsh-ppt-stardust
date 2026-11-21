import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync,existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {unzipSync,strFromU8} from 'fflate'
import {composeVisualCreate,visualCreateSchema,visualCreateContentHash} from '../skills/dsh-ppt/scripts/deck-visual-create.mjs'
import {template} from './fixtures/generation-components.mjs'
import {ordinaryVisualSlides} from './fixtures/ordinary-visuals.mjs'
import {createPptExecutors} from '../lib/execution.js'
import {resolvePptConfig} from '../lib/config.js'
import {PptTemplateStore} from '../lib/templates.js'
import {buildPptTools} from '../lib/tools.js'
import * as templates from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import * as engine from '../skills/dsh-ppt/scripts/deck-advanced.mjs'

const input=()=>({version:1,mode:'factual',allowMoreSlides:true,sources:[{id:'material',text:'Public test data: Alpha, Beta, Gamma. North 17, South 9, East 5 requests.'}],slides:[
  {id:'projects',title:'Направления работы',notes:'Prepared source descriptions.',visual:{type:'cards',sourceRefs:['material'],caption:'Три направления',items:[
    {id:'alpha',label:'Альфа',detail:'Первое полное предложение. Второе предложение с важной оговоркой.',iconId:'check'},
    {id:'beta',label:'Бета',detail:'Все исходные условия сохраняются без сокращения.',iconId:'clock'},
    {id:'gamma',label:'Гамма',detail:'Итог зависит от подтверждения исходных данных.',iconId:'target'}]}},
  {id:'requests',title:'Количество заявок',visual:{type:'chart',sourceRefs:['material'],kind:'column',unit:'заявок',categories:['Север','Юг','Восток'],series:[{name:'Заявки',values:[17,9,5]}]}}
]})
const compose=(value=input(),options={})=>composeVisualCreate(value,{title:'Проверка направлений',lang:'ru',template:template(),...options})
const strings=slides=>slides.flatMap(s=>s.elements.filter(e=>e.type==='text').flatMap(e=>e.paragraphs.flatMap(p=>p.runs.map(r=>r.text??'')))).join('\n')
const mixedInput=()=>{
  const value=input()
  value.slides.splice(1,0,{id:'register',title:'Реестр',notes:'Полный реестр между карточками и диаграммой.',visual:{type:'table',sourceRefs:['material'],headers:['Проект','Значение'],rows:Array.from({length:30},(_,i)=>['Проект '+(i+1),i===0?'50\u00a0000 ₽':i===1?null:i===2?'001.20':String(i)])}})
  return value
}
const tableText=(table,row,col)=>table.cells.find(c=>c.row===row&&c.col===col).paragraphs.map(p=>p.runs.map(r=>r.text??'').join('')).join('\n')

test('ordinary process timeline comparison and numbers retain source order and full values',()=>{
  const value=input();value.slides=ordinaryVisualSlides()
  const before=structuredClone(value),made=compose(value)
  assert.deepEqual(value,before)
  assert.deepEqual(made.create.slides.map(s=>s.id),value.slides.map(s=>s.id))
  const text=strings(made.create.slides)
  for(const slide of value.slides)for(const item of slide.visual.items){
    if(slide.visual.type!=='comparison')assert.ok(text.includes(item.label))
    if(slide.visual.type!=='comparison')assert.ok(text.includes(item.detail))
    if(item.date)assert.ok(text.includes(item.date))
    if(item.value!==undefined){assert.ok(text.split('\n').includes(String(item.value)));assert.ok(text.includes(item.unit))}
  }
  const table=made.create.slides[2].elements.find(e=>e.type==='table').table
  assert.deepEqual([tableText(table,0,1),tableText(table,0,2)],['Вариант А','Вариант Б'])
  assert.equal(tableText(table,1,1),'50\u00a0000 ₽');assert.equal(tableText(table,1,2),'—')
  assert.equal(tableText(table,3,1),value.slides[2].visual.items[0].detail)
  assert.equal(tableText(table,3,2),value.slides[2].visual.items[1].detail)
  assert.ok(made.create.slides[0].elements.some(e=>e.type==='line'))
  assert.ok(made.create.slides[1].elements.some(e=>e.type==='line'))
})

test('new ordinary visual semantics fail before export rather than invent order dates or numbers',async()=>{
  let exports=0
  const tools=createPptExecutors(resolvePptConfig({}),async()=>({buildDeckAsync:async()=>{exports++;return {ok:true}}}),{templateStore:{get:async()=>template()}})
  for(const mutate of [
    v=>delete v.slides[0].visual.ordered,
    v=>v.slides[0].visual.ordered=false,
    v=>v.slides[1].visual.items[0].date='2026-02-30',
    v=>v.slides[1].visual.items.reverse(),
    v=>delete v.slides[1].visual.items[1].date,
    v=>v.slides[2].visual.items[0].values.pop(),
    v=>v.slides[2].visual.criteria[1]='Стоимость',
    v=>v.slides[2].visual.items[0].values[0]=50000,
    v=>v.slides[3].visual.items[0].value=null,
    v=>v.slides[3].visual.items[0].value='30',
    v=>v.slides[3].visual.items[0].value=Infinity,
    v=>v.slides[3].visual.items[0].sourceRefs=['missing']
  ]){
    const value=input();value.slides=ordinaryVisualSlides();mutate(value)
    await assert.rejects(tools.create({title:'Проверка',lang:'ru',templateId:'public:test',visualSpec:value}))
  }
  assert.equal(exports,0)
})

test('ordered visuals paginate only with permission and preserve complete steps and dates',()=>{
  for(const original of ordinaryVisualSlides().slice(0,2)){
    const value=input();value.slides=[original];value.mode='demo';value.sources[0].synthetic=true
    for(const item of original.visual.items)item.detail=(item.id+': Full source description with caveat. ').repeat(14)
    value.allowMoreSlides=false
    assert.throws(()=>compose(value),{code:'component-capacity'})
    value.allowMoreSlides=true;value.contentHash=visualCreateContentHash(value)
    const made=compose(value)
    assert.ok(made.report.slideCount>1)
    assert.ok(made.create.slides.every(s=>s.elements.some(e=>e.id==='gen-disclosure')))
    for(const item of original.visual.items)assert.ok(strings(made.create.slides).includes(item.detail))
    const markers=made.create.slides.flatMap(s=>s.elements.filter(e=>/^gen-item-\d+-0$/.test(e.id)).map(e=>e.paragraphs.flatMap(p=>p.runs.map(r=>r.text)).join('')))
    assert.deepEqual(markers,original.visual.type==='process'?['1','2','3']:original.visual.items.map(i=>i.date))
    assert.throws(()=>compose(value,{maxSlides:1}),{code:'component-slide-limit'})
    const changed=structuredClone(value);changed.slides[0].visual.items[0].detail+=' '
    assert.throws(()=>compose(changed),/Content hash mismatch/)
  }
})

test('mixed visuals retain logical order, paginated table cells, source notes and demo disclosures',()=>{
  const value=mixedInput();value.mode='demo';value.sources[0].synthetic=true
  value.contentHash=visualCreateContentHash(value)
  const before=structuredClone(value),made=compose(value)
  assert.deepEqual(value,before)
  assert.equal(made.report.sourceSlides,3)
  const slides=made.create.slides,tables=slides.filter(s=>s.elements.some(e=>e.type==='table'))
  assert.ok(tables.length>1)
  assert.ok(!slides[0].elements.some(e=>['table','chart'].includes(e.type)))
  assert.ok(slides.at(-1).elements.some(e=>e.type==='chart'))
  assert.equal(slides.length,tables.length+2)
  const rows=[]
  for(const slide of tables){
    const table=slide.elements.find(e=>e.type==='table').table
    assert.deepEqual([tableText(table,0,0),tableText(table,0,1)],value.slides[1].visual.headers)
    for(let r=1;r<table.rows.length;r++)rows.push([tableText(table,r,0),tableText(table,r,1)])
    assert.ok(slide.notes.includes(value.slides[1].notes))
  }
  assert.deepEqual(rows,value.slides[1].visual.rows.map(row=>row.map(cell=>cell??'—')))
  assert.ok(slides.every(s=>s.elements.some(e=>e.id==='gen-disclosure')&&s.notes.includes('Source: material')))
  const noPagination=structuredClone(value);noPagination.allowMoreSlides=false
  assert.throws(()=>compose(noPagination),{code:'component-capacity'})
  assert.throws(()=>compose(value,{maxSlides:slides.length-1}),{code:'component-slide-limit'})
  for(const mutate of [v=>v.slides[1].visual.rows[0].pop(),v=>v.slides[1].visual.rows[0][0]=42,v=>v.slides[1].visual.sourceRefs=['missing']]){
    const changed=mixedInput();mutate(changed);assert.throws(()=>compose(changed))
  }
  const changed=structuredClone(value);changed.slides[1].visual.rows[0][1]='50 000 ₽'
  assert.throws(()=>compose(changed),/Content hash mismatch/)
})

test('normal cards/charts preserve source text, data, template decor and input objects',()=>{
  const value=input(),t=template(),before=structuredClone({value,t}),r=compose(value,{template:t})
  assert.deepEqual({value,t},before)
  assert.equal(r.report.sourceSlides,2);assert.equal(r.report.visualAcceptance,'not-verified')
  assert.ok(r.create.slides.every(s=>s.elements.some(e=>e.id==='stripe')&&s.notes.includes('Source: material')))
  for(const item of value.slides[0].visual.items){assert.ok(strings(r.create.slides).includes(item.label));assert.ok(strings(r.create.slides).includes(item.detail))}
  const chart=r.create.slides.flatMap(s=>s.elements).find(e=>e.type==='chart').chart
  assert.deepEqual(chart.categories,value.slides[1].visual.categories)
  assert.deepEqual(chart.series.map(({name,values})=>({name,values})),value.slides[1].visual.series)
  assert.deepEqual(r.create.style.pageSize,t.manifest.style.pageSize)
  assert.ok(r.create.slides.every(s=>s.purpose==='content'))
  const first=r.create.slides[0],labels=first.elements.filter(e=>/^gen-item-\d+-0$/.test(e.id)),details=first.elements.filter(e=>/^gen-item-\d+-1$/.test(e.id))
  assert.equal(new Set(labels.map(e=>e.frame.y)).size,1)
  assert.equal(new Set(details.map(e=>e.frame.y)).size,1)
  for(const [i,detail]of details.entries()){
    const card=first.elements.find(e=>e.id==='gen-card-'+i)
    assert.ok(detail.frame.y+detail.frame.h<=card.frame.y+card.frame.h-155448)
  }
})

test('visualSpec rejects unsupported types, coordinates, malformed facts and invalid source bindings',()=>{
  for(const mutate of [
    v=>v.frame={},v=>v.sources[0].extra=true,v=>v.sources[0].id='bad id',v=>v.sources[0].synthetic=true,
    v=>v.slides[0].purpose='cover',v=>v.slides[0].visual.frame={},v=>v.slides[0].visual.type='unsupported',
    v=>v.slides[0].visual.items[0].iconId='unknown',v=>v.slides[0].visual.sourceRefs=['missing'],
    v=>v.slides[0].visual.items[0].sourceRefs=['missing'],v=>v.slides[0].visual.items[1].id='alpha',
    v=>v.slides.push(structuredClone(v.slides[0])),v=>v.slides[1].visual.series[0].values.pop(),
    v=>v.slides[1].visual.kind='line',v=>v.slides[1].visual.kind='pie',
    v=>{v.slides[1].visual.kind='pie';v.slides[1].visual.whole=true;v.slides[1].visual.series[0].values[0]=-1},
    v=>v.slides=null,v=>v.slides[0]=null,v=>v.sources=null,v=>v.allowMoreSlides='true'
  ]){const value=input();mutate(value);assert.throws(()=>compose(value))}
  const line=input();line.slides[1].visual.kind='line';line.slides[1].visual.ordered=true
  assert.ok(compose(line).create.slides.some(s=>s.elements.some(e=>e.type==='chart')))
  const pie=input();pie.slides[1].visual.kind='pie';pie.slides[1].visual.whole=true
  assert.ok(compose(pie).create.slides.some(s=>s.elements.some(e=>e.type==='chart')))
})

test('demo disclosures, verified hashes and explicit template choices keep ordinary create rules',()=>{
  const value=input();value.mode='demo';value.sources[0].synthetic=true
  value.contentHash=visualCreateContentHash(value)
  assert.ok(compose(value).create.slides.every(s=>s.elements.some(e=>e.id==='gen-disclosure')))
  const changed=structuredClone(value);changed.slides[0].visual.items[0].detail+=' '
  assert.throws(()=>compose(changed),/Content hash mismatch/)
  const ordered=structuredClone(value);ordered.slides[1].visual=Object.fromEntries(Object.entries(ordered.slides[1].visual).reverse())
  assert.equal(visualCreateContentHash(ordered),value.contentHash)
  assert.ok(compose(ordered).create.slides.length>0)
  const explicit=input();explicit.slides[0].designLayout='missing'
  assert.throws(()=>compose(explicit))
  assert.throws(()=>compose(input(),{template:{manifest:{schemaVersion:1},assets:{}}}))
})

test('cards and chart pagination require permission and retain complete items and ordered data',()=>{
  const value=input();value.slides=value.slides.slice(0,1);value.slides[0].visual.items=value.slides[0].visual.items.slice(0,2)
  for(const item of value.slides[0].visual.items)item.detail=('Full public source description for '+item.id+'. ').repeat(14)
  value.allowMoreSlides=false
  assert.throws(()=>compose(value),{code:'component-capacity'})
  value.allowMoreSlides=true
  const made=compose(value)
  assert.ok(made.report.slideCount>1)
  for(const item of value.slides[0].visual.items)assert.ok(strings(made.create.slides).includes(item.detail))
  assert.throws(()=>compose(value,{maxSlides:1}),{code:'component-slide-limit'})
  const many=input();many.slides=many.slides.slice(1)
  const chart=many.slides[0].visual;chart.categories=Array.from({length:24},(_,i)=>'Item '+i);chart.series[0].values=Array.from({length:24},(_,i)=>i+1)
  const charts=compose(many).create.slides.flatMap(s=>s.elements.filter(e=>e.type==='chart').map(e=>e.chart))
  assert.ok(charts.length>1);assert.deepEqual(charts.flatMap(c=>c.categories),chart.categories);assert.deepEqual(charts.flatMap(c=>c.series[0].values),chart.series[0].values)
  chart.kind='pie';chart.whole=true;assert.throws(()=>compose(many),{code:'component-capacity'})
})

test('ppt_create publishes all eight ordinary visual schemas',()=>{
  const schema=buildPptTools(resolvePptConfig({})).find(t=>t.name==='ppt_create').parameters.properties.visualSpec
  assert.deepEqual(schema.required,visualCreateSchema().required)
  assert.deepEqual(schema.properties.slides.items.properties.visual.oneOf.map(v=>v.properties.type.const),['cards','process','timeline','comparison','big_number','chart','table','image'])
})

test('ordinary visualSpec exports native editable chart/cards with authorized session storage',async t=>{
  const root=mkdtempSync(join(tmpdir(),'visual-create-'));t.after(()=>rmSync(root,{recursive:true,force:true}))
  const store=new PptTemplateStore({root:join(root,'templates'),templatesModuleLoader:async()=>templates})
  const identity={login:'alice',admin:false,local:false},record=template()
  await store.save({manifest:record.manifest,assets:record.assets,identity})
  const tools=createPptExecutors(resolvePptConfig({}),async()=>engine,{templateStore:store})
  const exec={agent:{session:{header:{cwd:root,id:'normal-visual',owner:'alice'}}}}
  const args={title:'Направления',templateId:'user:'+record.manifest.id,lang:'ru',visualSpec:mixedInput()}
  args.visualSpec.slides.push(...ordinaryVisualSlides())
  const made=await tools.create(args,exec)
  assert.ok(made.ok&&made.internalProject);assert.ok(made.outputDir.includes('session-'))
  assert.equal(made.visualComposition.sourceSlides,7);assert.equal(made.tableComposition,undefined)
  assert.equal(made.verification.visual,'not-verified')
  assert.ok(existsSync(made.htmlPath)&&existsSync(made.pptxPath)&&existsSync(made.jsonPath))
  const project=JSON.parse(readFileSync(made.jsonPath,'utf8'))
  assert.ok(strings(project.slides).includes(args.visualSpec.slides[0].visual.items[0].detail))
  assert.deepEqual(project.slides.flatMap(s=>s.elements).find(e=>e.type==='chart').chart.series[0].values,[17,9,5])
  const parts=unzipSync(readFileSync(made.pptxPath)),chart=Object.keys(parts).find(p=>/^ppt\/charts\/chart\d+\.xml$/.test(p))
  assert.ok(chart);assert.match(strFromU8(parts[chart]),/<c:v>17<\/c:v>/)
  assert.match(strFromU8(parts['ppt/slides/slide1.xml']),/<p:cxnSp>/)
  const nativeSlides=Object.keys(parts).filter(p=>/^ppt\/slides\/slide\d+\.xml$/.test(p)).map(p=>strFromU8(parts[p]))
  assert.ok(nativeSlides.filter(xml=>xml.includes('<a:tbl>')).length>1)
  assert.ok(nativeSlides.some(xml=>xml.includes('50\u00a0000 ₽')))
  for(const label of ['Подготовка','2026-11-15','Вариант А','Ожидает данных'])assert.ok(nativeSlides.some(xml=>xml.includes(label)))
  await assert.rejects(tools.create(args,{agent:{session:{header:{cwd:root,id:'other',owner:'bob'}}}}))
})

test('conflicts, invalid inputs, limits and cancellation do not export a draft or change legacy calls',async()=>{
  let builds=0,captured
  const tools=createPptExecutors(resolvePptConfig({}),async()=>({buildDeckAsync:async o=>{builds++;captured=o;return {ok:true}}}),{templateStore:{get:async()=>template()}})
  const args={title:'Направления',templateId:'user:chosen',lang:'ru',visualSpec:input()}
  for(const key of ['tableSpec','content','slides','deckPlan','generationPolicy','templateSelections','templateSamples','template','dataModel','assets','style','brand','theme'])await assert.rejects(tools.create({...args,[key]:{}}),/cannot be combined/)
  await assert.rejects(tools.create({...args,templateId:''}),/requires/)
  await assert.rejects(tools.create({...args,visualSpec:null}),/visualSpec/)
  await assert.rejects(tools.create({...args,visualSpec:{...input(),contentHash:'0'.repeat(64)}}),/Content hash mismatch/)
  const limited=createPptExecutors(resolvePptConfig({maxSlides:3}),async()=>({buildDeckAsync:async()=>{builds++;return {ok:true}}}),{templateStore:{get:async()=>template()}})
  const four=input();four.slides.push(...structuredClone(four.slides).map(s=>({...s,id:s.id+'-copy'})))
  await assert.rejects(limited.create({...args,visualSpec:four}),e=>e.code==='component-slide-limit')
  const controller=new AbortController();controller.abort(new Error('cancelled'))
  await assert.rejects(tools.create(args,{signal:controller.signal}),/cancelled/)
  assert.equal(builds,0)
  await tools.create({title:'Legacy',content:'## Facts\n- User fact'})
  assert.equal(builds,1);assert.equal(captured.content,'## Facts\n- User fact')
})
