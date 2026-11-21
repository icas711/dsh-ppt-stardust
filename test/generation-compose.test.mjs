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

test('small category charts retain native data and add editable values; complex charts keep their space',()=>{
  const v={type:'chart',sourceRefs,kind:'column',unit:'заявки',categories:['Север','Юг'],series:[{name:'Заявки',values:[17,9]}]}
  const r=compose(spec([v])),slide=r.create.slides[0],chart=slide.elements.find(e=>e.id==='gen-chart')
  assert.deepEqual(chart.chart.categories,v.categories)
  assert.deepEqual(chart.chart.series.map(({name,values})=>({name,values})),v.series)
  const cards=slide.elements.filter(e=>e.id.startsWith('gen-chart-card-'))
  assert.equal(cards.length,2)
  assert.ok(cards.every(c=>c.frame.x>=chart.frame.x+chart.frame.w))
  for(const fact of ['Север','Юг','17','9'])assert.ok(strings([slide]).includes(fact))
  for(const changed of [
    {...v,series:[{name:'Заявки',values:[17,-9]}]},
    {...v,series:[...v.series,{name:'Вторая серия',values:[3,4]}]},
    {...v,kind:'line',ordered:true},
    {...v,kind:'pie',whole:true}
  ])assert.equal(compose(spec([changed])).create.slides[0].elements.some(e=>e.id.startsWith('gen-chart-card-')),false)
  assert.equal(compose(spec([v]),{template:template({page:{width:7559675,height:10691813}})}).create.slides[0].elements.some(e=>e.id.startsWith('gen-chart-card-')),false)
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

test('oversized table rows continue with exact cell ranges, stable columns and explicit row labels',()=>{
  const rows=[['1','Short opening','0,00'],[null,('Long source paragraph with 50\u00a0000 units and emoji 😀. \n\n').repeat(35)+'Trailing spaces  ','12,50%'],['3','Short ending',null]]
  const input=spec([{type:'table',sourceRefs,headers:['№','Description','Amount'],rows}]),before=structuredClone(input)
  const r=compose(input,{allowMoreSlides:true})
  assert.deepEqual(input,before)
  const recovered=rows.map(row=>row.map(v=>v===null?null:'')),widths=[]
  for(const [i,placement]of r.report.placements.entries()){
    const slide=r.create.slides[i],table=slide.elements.find(e=>e.type==='table').table
    widths.push(table.columns)
    const value=(row,col)=>table.cells.find(c=>c.row===row&&c.col===col).paragraphs.flatMap(p=>p.runs.map(r=>r.text??'')).join('')
    assert.deepEqual(table.cells.filter(c=>c.row===0).map(c=>c.paragraphs[0].runs[0].text),input.slides[0].visual.headers)
    for(let row=placement.rowStart;row<=placement.rowEnd;row++)for(let col=0;col<3;col++){
      if(rows[row-1][col]!==null)recovered[row-1][col]+=value(row-placement.rowStart+1,col)
    }
    if(placement.rowContinuation){
      const continued=placement.rowContinuation
      assert.equal(continued.sourceRow,2)
      assert.ok(slide.elements.some(e=>e.id==='gen-table-continuation'&&e.paragraphs[0].runs[0].text.includes(`${continued.part}/${continued.parts}`)))
      assert.ok(slide.notes.includes('Empty continuation cells'))
      for(let col=0;col<3;col++){
        const range=continued.cellRanges[col]
        if(range)assert.equal(value(1,col),rows[1][col].slice(range.start,range.end))
        else assert.equal(value(1,col),continued.part===1?'—':'')
      }
    }
    assert.ok(table.cells.every(c=>c.textStyle.size===18))
  }
  assert.ok(r.report.placements.filter(p=>p.rowContinuation).length>1)
  assert.deepEqual(recovered,rows)
  assert.ok(widths.every(w=>JSON.stringify(w)===JSON.stringify(widths[0])))
  assert.throws(()=>compose(input),{code:'component-capacity'})
  assert.throws(()=>compose(input,{allowMoreSlides:true,maxSlides:2}),{code:'component-slide-limit'})
  const single=spec([{type:'table',sourceRefs,headers:['№','Description','Amount'],rows:[rows[1]]}])
  assert.ok(compose(single,{allowMoreSlides:true}).report.slideCount>1)
})

test('empty index columns stay compact beside long table paragraphs',()=>{
  const r=compose(spec([{type:'table',sourceRefs,headers:['№','Description','Notes'],rows:[[null,'Descriptive project name','Long note '.repeat(25)]]}]),{allowMoreSlides:true})
  const table=r.create.slides[0].elements.find(e=>e.type==='table').table
  assert.ok(table.columns[0]<table.columns[2]/3)
})

test('row fragments are balanced instead of leaving a short final page',()=>{
  const value='Project planning and implementation details. '.repeat(25)+'Final note.'
  const r=compose(spec([{type:'table',sourceRefs,headers:['Description'],rows:[[value]]}]),{allowMoreSlides:true})
  const tables=r.create.slides.map(s=>s.elements.find(e=>e.type==='table').table)
  assert.ok(tables.length>1)
  const heights=tables.map(t=>t.rows[1])
  assert.ok(Math.min(...heights)>=Math.max(...heights)*.55)
  assert.equal(tables.map(t=>t.cells.find(c=>c.row===1).paragraphs[0].runs[0].text).join(''),value)
})

test('whole-word column minima protect Russian deadlines without inherited paragraph indents',()=>{
  const rows=[['1.','Подготовка материалов','В соответствии с утвержденными сроками','Проверка полученных документов '.repeat(8)]]
  const r=compose(spec([{type:'table',sourceRefs,headers:['№','Мероприятие','Срок','Комментарий'],rows}]),{allowMoreSlides:true})
  const table=r.create.slides[0].elements.find(e=>e.type==='table').table
  // Include padding and conservative font headroom for the longest deadline word.
  assert.ok(table.columns[2]>=('утвержденными'.length*18*.57*1.15+4)*12700+2*.17*914400)
  assert.ok(table.cells.every(c=>c.paragraphs[0].style.marL===0&&c.paragraphs[0].style.indent===0))
})

test('row continuation still rejects a header that leaves no room for a fragment',()=>{
  const input=spec([{type:'table',sourceRefs,headers:['Long heading '.repeat(38),'Value'],rows:[[null,'Unchanged source value']]}])
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

test('demo disclosure fits beside a fixed page number and remains legible on picture backgrounds',()=>{
  const t=template(),layout=t.manifest.style.layouts[1],page=t.manifest.style.pageSize
  const number={id:'fixed-page-number',role:'decor',type:'text',frame:{x:page.width-2200000,y:page.height-500000,w:1800000,h:250000},textStyle:{size:9,fontFamily:'Arial',color:'#222222'},paragraphs:[{runs:[{text:'1'}]}]}
  layout.elements.push(number)
  const input=spec([{type:'table',sourceRefs,headers:['Project'],rows:Array.from({length:20},(_,i)=>['Row '+i])}]);input.mode='demo'
  const context={sources:[{id:'source-1',text:'Synthetic facts',synthetic:true}]}
  const clear=compose(input,{template:t,context,allowMoreSlides:true})
  const overlaps=(a,b)=>a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h
  for(const s of clear.create.slides){
    const label=s.elements.find(e=>e.id==='gen-disclosure')
    assert.ok(label);assert.ok(!overlaps(label.frame,number.frame))
    assert.deepEqual(s.elements.find(e=>e.id===number.id).frame,number.frame)
  }
  const photo=picture();t.manifest.assetMap.wall={file:'wall.png',mime:photo.mime,width:photo.width,height:photo.height};t.assets['wall.png']={data:photo.data,bytes:Buffer.from(photo.data.split(',')[1],'base64')};layout.backgroundAssetId='wall'
  const r=compose(input,{template:t,context,allowMoreSlides:true})
  for(const s of r.create.slides){
    const label=s.elements.find(e=>e.id==='gen-disclosure'),plate=s.elements.find(e=>e.id==='gen-disclosure-bg')
    assert.ok(plate);assert.deepEqual(plate.frame,label.frame)
    assert.ok(s.elements.indexOf(plate)<s.elements.indexOf(label))
    assert.ok(!overlaps(label.frame,number.frame))
    assert.equal(plate.fill.opacity??1,1)
  }
})

test('table continuation pages prefer the wide content region beside header decoration',()=>{
  const t=template(),layout=t.manifest.style.layouts[1]
  layout.elements.push({id:'header-symbol',type:'shape',role:'decor',preset:'ellipse',frame:{x:4000000,y:100000,w:1200000,h:1600000},fill:{color:'#667788'}})
  const v={type:'table',sourceRefs,headers:['Project','Status'],rows:Array.from({length:30},(_,i)=>['Row '+i,'Ready'])}
  const r=compose(spec([v]),{template:t,allowMoreSlides:true})
  assert.ok(r.create.slides.length>1)
  const widths=r.create.slides.map(s=>s.elements.find(e=>e.type==='table').frame.w)
  assert.ok(widths.every(w=>w>t.manifest.style.pageSize.width*.8))
  assert.equal(new Set(widths).size,1)
})

test('demo label reserves enough room for native renderer font substitution',async t=>{
  const root=mkdtempSync(join(tmpdir(),'disclosure-fit-'));t.after(()=>rmSync(root,{recursive:true,force:true}))
  const templateRecord=template(),layout=templateRecord.manifest.style.layouts[1],photo=picture()
  templateRecord.manifest.assetMap.wall={file:'wall.png',mime:photo.mime,width:photo.width,height:photo.height}
  templateRecord.assets['wall.png']={data:photo.data,bytes:Buffer.from(photo.data.split(',')[1],'base64')}
  layout.backgroundAssetId='wall'
  const input=spec([{type:'table',sourceRefs,headers:['Проект'],rows:[['Проект 01']]}]);input.mode='demo'
  const r=compose(input,{template:templateRecord,context:{sources:[{id:'source-1',text:'Synthetic facts',synthetic:true}]}})
  const label=r.create.slides[0].elements.find(e=>e.id==='gen-disclosure')
  assert.equal(label.textStyle.size,14)
  const caption=label.paragraphs[0].runs[0].text
  // An em per Cyrillic character is deliberately more conservative than the
  // normal component estimator; the old tight plate failed this real export.
  const conservativeWidth=[...caption].reduce((sum,c)=>sum+(/[^\x00-\xff]/u.test(c)?1:.55)*14*12700,4*12700)
  assert.ok(label.frame.w>=conservativeWidth)
  const made=await buildDeckAsync({...r.create,outputDir:root})
  assert.ok(!made.quality.issues.some(i=>i.elementId==='gen-disclosure'&&i.code==='body-overflow'))
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
  assert.match(strFromU8(parts['ppt/slides/slide7.xml']),/<a:pPr[^>]*marL="0"[^>]*marR="0"[^>]*indent="0"/)
  assert.match(strFromU8(parts['ppt/slides/slide8.xml']),/<p:pic>/)
  assert.match(strFromU8(parts['ppt/slides/slide2.xml']),/<p:cxnSp>/)
  assert.match(strFromU8(parts['ppt/slides/slide5.xml']),/sz="6000"/)
  assert.match(readFileSync(made.htmlPath,'utf8'),/Original screenshot/)
  const pres=await lib.loadPresentation(readFileSync(made.pptxPath))
  assert.equal(lib.getSlides(pres).length,8);assert.equal(Number(lib.getSlideSize(pres).width),9906000)
  assert.deepEqual(lib.validatePresentation(pres).filter(i=>i.severity==='error'),[])
})
