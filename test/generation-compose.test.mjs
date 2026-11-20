import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {unzipSync,strFromU8} from 'fflate'
import * as lib from '@office-kit/pptx'
import {composeGenerationSpec} from '../skills/dsh-ppt/scripts/deck-generation-compose.mjs'
import {buildDeckAsync} from '../skills/dsh-ppt/scripts/deck-advanced.mjs'
import {context,picture,template,visuals,spec,items,sourceRefs} from './fixtures/generation-components.mjs'

const compose=(input=spec(),options={})=>composeGenerationSpec(input,{template:template(),context,assets:{photo:picture()},...options})
const strings=slides=>slides.flatMap(s=>s.elements.flatMap(e=>e.type==='text'?e.paragraphs.flatMap(p=>p.runs.map(r=>r.text??'')):e.type==='table'?e.table.cells.flatMap(c=>c.paragraphs.flatMap(p=>p.runs.map(r=>r.text??''))):[])).join('\n')

test('eight components create native scenes, preserve source content, fixed artwork and input objects',()=>{
  const input=spec(),t=template(),before=structuredClone({input,t}),r=compose(input,{template:t})
  assert.equal(r.create.slides.length,8);assert.equal(r.report.visualAcceptance,'not-verified')
  assert.deepEqual({input,t},before);assert.deepEqual(r.create.style.pageSize,t.manifest.style.pageSize)
  assert.equal(r.create.slides.every(s=>s.elements.some(e=>e.id==='stripe')),true)
  assert.equal(strings(r.create.slides).includes('SAMPLE MUST DISAPPEAR'),false)
  assert.ok(r.create.slides[5].elements.some(e=>e.type==='chart'))
  assert.ok(r.create.slides[6].elements.some(e=>e.type==='table'))
  assert.ok(r.create.slides[7].elements.some(e=>e.type==='image'&&e.alt==='Source image'))
  assert.equal(r.create.slides.every(s=>s.notes.includes('Preserve speaker notes')&&s.notes.includes('source-1')),true)
  assert.ok(strings(r.create.slides).includes('Source detail 1'))
  assert.ok(strings(r.create.slides).includes('—'))
  assert.ok(r.create.slides[4].elements.some(e=>e.type==='text'&&e.textStyle.size>=60))
})

test('dark and portrait-like templates retain source dimensions and typography',()=>{
  for(const options of [{dark:true},{page:{width:7559675,height:10691813}}]){
    const t=template(options),r=compose(spec([visuals()[0]]),{template:t})
    assert.deepEqual(r.create.style.pageSize,t.manifest.style.pageSize)
    const title=r.create.slides[0].elements.find(e=>e.id==='gen-title')
    assert.equal(title.textStyle.fontFamily,'Arial');assert.equal(title.textStyle.size,32)
    if(options.dark)assert.equal(title.textStyle.color,'#FFFFFF')
  }
})

test('short cards stay compact and centered with a visible caption and optional icons',()=>{
  for(const icons of [false,true]){
    const input=spec([{type:'cards',sourceRefs,caption:'Three equal principles. These are not stages or rankings.',items:items(3).map(i=>({id:i.id,label:i.label,...(icons?{iconId:'check'}:{})}))}])
    const r=compose(input),slide=r.create.slides[0],cards=slide.elements.filter(e=>e.id.startsWith('gen-card-'))
    const caption=slide.elements.find(e=>e.id==='gen-caption'),region=r.report.placements[0].region
    assert.ok(strings([slide]).includes(input.slides[0].visual.caption))
    assert.equal(cards.length,3)
    assert.ok(cards.every(c=>c.frame.h<region.h*.65&&c.frame.y>caption.frame.y+caption.frame.h))
    assert.equal(new Set(cards.map(c=>c.frame.h)).size,1)
    for(let i=0;i<cards.length;i++){
      const label=slide.elements.find(e=>e.id===`gen-item-${i}-0`)
      assert.equal(label.textFrame.align,'center')
      assert.ok(label.frame.y>cards[i].frame.y+cards[i].frame.h*.2)
      assert.ok(label.frame.y+label.frame.h<cards[i].frame.y+cards[i].frame.h)
    }
  }
})

test('dense tables paginate only with permission and preserve every row with repeated headers',()=>{
  const visual={type:'table',sourceRefs,headers:['Project','Status'],rows:Array.from({length:24},(_,i)=>['Unique row '+i,'Source status '+i])},input=spec([visual])
  assert.throws(()=>compose(input),e=>e.code==='component-capacity'&&e.slideId==='slide-1')
  const r=compose(input,{allowMoreSlides:true})
  assert.ok(r.create.slides.length>1);assert.equal(r.report.splits[0].slideId,'slide-1')
  const all=strings(r.create.slides)
  for(let i=0;i<24;i++)assert.ok(all.includes('Unique row '+i))
  for(const s of r.create.slides){const table=s.elements.find(e=>e.type==='table');assert.equal(table.table.cells[0].paragraphs[0].runs[0].text,'Project')}
  assert.throws(()=>compose(input,{allowMoreSlides:true,maxSlides:1}),{code:'component-slide-limit'})
})

test('unfittable single items fail without shrinking fonts or dropping facts',()=>{
  const input=spec([{type:'cards',sourceRefs,items:items(2).map(i=>({...i,detail:'Very long source fact '.repeat(300)}))}])
  assert.throws(()=>compose(input,{allowMoreSlides:true}),e=>e.code==='component-capacity'&&e.itemIndex===0)
})

test('pie and line graphs are not divided into misleading partial charts',()=>{
  const v={type:'chart',sourceRefs,kind:'pie',whole:true,unit:'share',categories:Array.from({length:24},(_,i)=>'Category '+i),series:[{name:'Share',values:Array(24).fill(1)}]}
  assert.throws(()=>compose(spec([v]),{allowMoreSlides:true}),{code:'component-capacity'})
  v.kind='line';v.ordered=true
  assert.throws(()=>compose(spec([v]),{allowMoreSlides:true}),{code:'component-capacity'})
})

test('categorical charts paginate all series together with exact values and units',()=>{
  const v={type:'chart',sourceRefs,kind:'column',unit:'requests',categories:Array.from({length:24},(_,i)=>'Item '+i),series:[{name:'First',values:Array.from({length:24},(_,i)=>i)},{name:'Second',values:Array.from({length:24},(_,i)=>i+100)}]}
  const r=compose(spec([v]),{allowMoreSlides:true}),charts=r.create.slides.map(s=>s.elements.find(e=>e.type==='chart').chart)
  assert.ok(charts.length>1);assert.deepEqual(charts.flatMap(c=>c.categories),v.categories)
  for(let i=0;i<2;i++)assert.deepEqual(charts.flatMap(c=>c.series[i].values),v.series[i].values)
  assert.ok(charts.every(c=>c.title==='requests'))
})

test('demo disclosures are visible on every output slide including continuation pages',()=>{
  const input=spec([{type:'table',sourceRefs,headers:['Project'],rows:Array.from({length:20},(_,i)=>['Row '+i])}]);input.mode='demo'
  const r=compose(input,{allowMoreSlides:true,context:{sources:[{id:'source-1',text:'Synthetic facts',synthetic:true}]}})
  for(const s of r.create.slides)assert.ok(s.elements.some(e=>e.id==='gen-disclosure'&&e.paragraphs[0].runs[0].text.includes('синтетические')))
})

test('reference selection, asset ownership and icon catalogue remain strict',()=>{
  const input=spec([visuals()[0]]),t=template();t.manifest.style.layouts.shift();input.slides[0].purpose='cover'
  assert.throws(()=>compose(input,{template:t}),{code:'composition-reference'})
  input.slides[0].designLayout='content';assert.equal(compose(input,{template:t}).create.slides[0].purpose,'cover')
  input.slides[0].visual.items[0].iconId='unknown';assert.throws(()=>compose(input,{template:t}),{code:'generation-spec'})
  const colliding=template(),photo=picture();colliding.manifest.assetMap.photo={file:'photo.png',mime:photo.mime,width:photo.width,height:photo.height};colliding.assets['photo.png']={bytes:Buffer.from(photo.data.split(',')[1],'base64'),data:photo.data}
  assert.throws(()=>compose(spec([visuals()[7]]),{template:colliding}),{code:'component-asset-collision'})
})

test('large fixed pictures are avoided; backdrop plates remain usable',()=>{
  const t=template(),layout=t.manifest.style.layouts[1],photo=picture()
  t.manifest.assetMap.logo={file:'logo.png',mime:photo.mime,width:photo.width,height:photo.height};t.assets['logo.png']={bytes:Buffer.from(photo.data.split(',')[1],'base64'),data:photo.data}
  layout.elements.unshift({id:'plate',role:'decor',type:'shape',preset:'rect',frame:{x:0,y:0,w:9906000,h:6858000},fill:{color:'#FFFFFF'}})
  layout.elements.push({id:'logo',role:'decor',type:'image',assetId:'logo',frame:{x:7400000,y:1500000,w:2000000,h:4700000}})
  const r=compose(spec([visuals()[0]]),{template:t}),p=r.report.placements[0].region
  assert.ok(p.x+p.w<7400000);assert.ok(r.create.slides[0].elements.some(e=>e.id==='plate'))
})

test('real HTML/PPTX export keeps physical size, native charts/tables/images and editable diagram shapes',async t=>{
  const root=mkdtempSync(join(tmpdir(),'generation-components-'));t.after(()=>rmSync(root,{recursive:true,force:true}))
  const r=compose(),made=await buildDeckAsync({...r.create,outputDir:root}),parts=unzipSync(readFileSync(made.pptxPath))
  assert.ok(Object.keys(parts).some(p=>/^ppt\/charts\/chart\d+\.xml$/.test(p)))
  assert.match(strFromU8(parts['ppt/slides/slide7.xml']),/<a:tbl>/)
  assert.match(strFromU8(parts['ppt/slides/slide8.xml']),/<p:pic>/)
  assert.match(strFromU8(parts['ppt/slides/slide2.xml']),/<p:cxnSp>/)
  assert.match(strFromU8(parts['ppt/slides/slide5.xml']),/sz="6000"/)
  assert.match(readFileSync(made.htmlPath,'utf8'),/Original screenshot/)
  const pres=await lib.loadPresentation(readFileSync(made.pptxPath))
  assert.equal(lib.getSlides(pres).length,8);assert.equal(Number(lib.getSlideSize(pres).width),9906000)
  assert.deepEqual(lib.validatePresentation(pres).filter(i=>i.severity==='error'),[])
})
