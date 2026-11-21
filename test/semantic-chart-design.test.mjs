import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {unzipSync,strFromU8} from 'fflate'
import {diagramToScene} from '../skills/dsh-ppt/scripts/deck-diagrams.mjs'
import {buildDeckAsync,editDeck,undoDeck,readDeckProject} from '../skills/dsh-ppt/scripts/deck-advanced.mjs'
import {normalizeSceneChart} from '../skills/dsh-ppt/scripts/deck-structured.mjs'
import {templateCreateOptions} from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import {generationEvaluationCases} from './fixtures/generation-evaluation.mjs'
import {semanticChartDesign} from '../skills/dsh-ppt/scripts/deck-chart-design.mjs'
import {renderSceneChartSvg} from '../skills/dsh-ppt/scripts/deck-scene-chart-html.mjs'
const data={kind:'column',categories:['A','B'],series:[{name:'Requests',values:[17,9]}]}
test('compact chartValues updates preserve charts, reject invalid changes atomically and support undo',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'chart-values-'));t.after(()=>rmSync(dir,{recursive:true,force:true}))
 const style={accent:'#79C6FF',background:'#121826',color:'#F5F7FA',fontFamily:'Arial'}
 const pie=semanticChartDesign({kind:'pie',categories:['Equipment','Licenses','Training'],series:[{name:'Budget',values:[100,60,40]}]},{...style,unit:'тыс. ₽',showPercent:true})
 const column={kind:'column',categories:['A','B'],series:[{name:'First',values:[1,2]},{name:'Second',values:[3,4]}]}
 const slides=[pie,column].map((chart,i)=>({...diagramToScene({title:'Budget',diagram:{version:2,kind:'chart',chart}},style),id:'chart-'+i}))
 const made=await buildDeckAsync({title:'Compact edits',slides,outputDir:dir}),before=readDeckProject({deckPath:made.jsonPath}).manifest
 const files=[made.jsonPath,made.pptxPath,made.htmlPath],bytes=files.map(p=>readFileSync(p))
 const invalid=[
  {id:'diagram-title',changes:{chartValues:[[1,2,3]]}},
  {id:'diagram-chart',changes:{chartValues:null}},
  {id:'diagram-chart',changes:{chartValues:[[1,2,3],[4,5,6]]}},
  {id:'diagram-chart',changes:{chartValues:[1,2,3]}},
  {id:'diagram-chart',changes:{chartValues:[[1,2]]}},
  {id:'diagram-chart',changes:{chartValues:[[-1,60,40]]}},
  {id:'diagram-chart',changes:{chartValues:[[0,0,0]]}},
  {id:'diagram-chart',changes:{chartValues:[['80',60,60]]}},
  {id:'diagram-chart',changes:{chartValues:[[80,60,60]],chart:pie}},
 ]
 for(const update of invalid){
  await assert.rejects(editDeck({deckPath:made.jsonPath,expectedRevision:0,edits:[{slide:1,patch:{elementUpdates:[update]}}]}))
  files.forEach((p,i)=>assert.deepEqual(readFileSync(p),bytes[i]))
 }
 const args={deckPath:made.jsonPath,expectedRevision:0,edits:[
  {slide:1,patch:{elementUpdates:[{id:'diagram-chart',changes:{chartValues:[[80,60,60]]}}]}},
  {slide:2,patch:{elementUpdates:[{id:'diagram-chart',changes:{chartValues:[[5,6],[7,8]]}}]}},
 ]}
 const edited=await editDeck(JSON.parse(JSON.stringify(args))),after=readDeckProject({deckPath:made.jsonPath}).manifest
 assert.equal(edited.revision,1)
 for(const [i,slide]of after.slides.entries()){
  assert.deepEqual(slide.elements.find(e=>e.id==='diagram-title'),before.slides[i].elements.find(e=>e.id==='diagram-title'))
  const chart=slide.elements.find(e=>e.type==='chart'),old=before.slides[i].elements.find(e=>e.type==='chart')
  assert.deepEqual(chart.frame,old.frame);assert.equal(chart.chart.kind,old.chart.kind)
  assert.deepEqual(chart.chart.categories,old.chart.categories);assert.equal(chart.chart.chartAreaFill,old.chart.chartAreaFill)
  assert.ok(!Object.hasOwn(chart,'chartValues'))
 }
 const chart=after.slides[0].elements.find(e=>e.type==='chart').chart
 assert.deepEqual(chart.amountLabels,pie.amountLabels);assert.equal(chart.series[0].pointDataLabels[0].text,'Equipment: 80\u00a0тыс.\u00a0₽ (40%)')
 assert.deepEqual(after.slides[1].elements.find(e=>e.type==='chart').chart.series.map(s=>s.values),[[5,6],[7,8]])
 const parts=unzipSync(readFileSync(edited.pptxPath));assert.ok(strFromU8(parts['ppt/charts/chart1.xml']).includes('80\u00a0тыс.\u00a0₽ (40%)'))
 const noop=await editDeck({...args,expectedRevision:1});assert.equal(noop.changed,false);assert.equal(noop.revision,1)
 await undoDeck({deckPath:made.jsonPath,expectedRevision:1});assert.deepEqual(readDeckProject({deckPath:made.jsonPath}).manifest.slides,before.slides)
})
test('editing bound pie values refreshes amounts and optional percentages; undo restores original chart',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'pie-edit-'));t.after(()=>rmSync(dir,{recursive:true,force:true}))
 const style={accent:'#79C6FF',background:'#121826',color:'#F5F7FA',fontFamily:'Arial',unit:'тыс. ₽'}
 const slides=[false,true].map((showPercent,i)=>({...diagramToScene({diagram:{version:2,kind:'chart',chart:semanticChartDesign({kind:'pie',categories:['Equipment','Licenses','Training'],series:[{name:'Budget',values:[100,60,40]}]},{...style,showPercent})}},style),id:'budget-'+i}))
 const made=await buildDeckAsync({title:'Editable amounts',slides,outputDir:dir}),before=readDeckProject({deckPath:made.jsonPath}).manifest
 const edits=before.slides.map((slide,i)=>{
  const element=slide.elements.find(e=>e.type==='chart'),chart=structuredClone(element.chart)
  chart.series[0].values=[80,60,60]
  return {slide:i+1,patch:{elementUpdates:[{id:element.id,changes:{chart}}]}}
 })
 const edited=await editDeck({deckPath:made.jsonPath,expectedRevision:made.revision,edits}),after=readDeckProject({deckPath:made.jsonPath}).manifest,parts=unzipSync(readFileSync(edited.pptxPath))
 for(const [i,slide]of after.slides.entries()){
  const element=slide.elements.find(e=>e.type==='chart'),old=before.slides[i].elements.find(e=>e.type==='chart')
  assert.deepEqual(element.frame,old.frame);assert.deepEqual(element.chart.series[0].values,[80,60,60])
  const expected=['Equipment: 80\u00a0тыс.\u00a0₽','Licenses: 60\u00a0тыс.\u00a0₽','Training: 60\u00a0тыс.\u00a0₽'].map((s,j)=>s+(i?' ('+[40,30,30][j]+'%)':''))
  assert.deepEqual(element.chart.series[0].pointDataLabels.map(l=>l.text),expected)
  const xml=strFromU8(parts['ppt/charts/chart'+(i+1)+'.xml'])
  for(const text of expected)assert.ok(xml.includes(text))
  assert.match(xml,/<c:v>80<\/c:v>/)
  const book=unzipSync(parts['ppt/embeddings/Microsoft_Excel_Worksheet'+(i+1)+'.xlsx'])
  assert.ok(strFromU8(book['xl/worksheets/sheet1.xml']).includes('<v>80</v>'))
  const normalized=normalizeSceneChart(element.chart);assert.deepEqual(normalized,element.chart)
 }
 const restored=await undoDeck({deckPath:made.jsonPath,expectedRevision:edited.revision})
 assert.equal(restored.revision,2);assert.deepEqual(readDeckProject({deckPath:made.jsonPath}).manifest.slides,before.slides)
 const custom={kind:'pie',categories:['A','B'],series:[{name:'Custom',values:[2,6],dataLabels:{showValue:false},pointDataLabels:[{text:'Manual A'},{text:'Manual B'}]}]}
 assert.equal(normalizeSceneChart(custom).series[0].pointDataLabels[0].text,'Manual A')
 assert.throws(()=>normalizeSceneChart({...custom,amountLabels:{unit:'',showPercent:true}}),/non-empty unit/)
 assert.throws(()=>normalizeSceneChart({...custom,amountLabels:{unit:'₽',showPercent:'yes'}}),/Expected boolean/)
 assert.throws(()=>normalizeSceneChart({...custom,kind:'column',amountLabels:{unit:'₽'}}),/requires pie/)
})
test('signed bars keep category labels outside the plot and negative point fills in native PPTX',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'signed-chart-'));t.after(()=>rmSync(dir,{recursive:true,force:true}))
 const style={accent:'#79C6FF',background:'#121826',color:'#F5F7FA',fontFamily:'Arial'}
 const slides=['bar','column'].map(kind=>{
  const input={kind,categories:['Negative','Zero','Positive'],series:[{name:'Deviation',values:[-12,0,20]}]},before=structuredClone(input)
  const chart=semanticChartDesign(input,style)
  assert.deepEqual(input,before)
  assert.equal(chart.categoryAxisTickLabelPos,'low')
  assert.equal(chart.series[0].color,'#79C6FF')
  const scene=diagramToScene({diagram:{version:2,kind:'chart',chart}},style)
  return {...scene,id:kind,backgroundColor:style.background}
 })
 const built=await buildDeckAsync({title:'Signed chart',slides,outputDir:dir,lang:'en'}),parts=unzipSync(readFileSync(built.pptxPath))
 for(let i=1;i<=2;i++){
  const xml=strFromU8(parts['ppt/charts/chart'+i+'.xml'])
  assert.match(xml,/<c:tickLblPos val="low"/)
  assert.match(xml,/<c:invertIfNegative val="0"\/>/)
  assert.ok(xml.includes('79C6FF'))
  assert.match(xml,/<c:v>-12<\/c:v>/);assert.match(xml,/<c:v>0<\/c:v>/)
 }
 const explicit=semanticChartDesign({kind:'bar',categories:['A','B'],categoryAxisTickLabelPos:'high',series:[{name:'X',values:[-1,2],pointColors:['#FF0000','#00FF00']}]},style)
 assert.equal(explicit.categoryAxisTickLabelPos,'high');assert.deepEqual(explicit.series[0].pointColors,['#FF0000','#00FF00'])
 assert.equal(semanticChartDesign(data,style).series[0].pointColors,undefined)
})
test('semantic chart inherits template style, exposes metric and values, and retains original source',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'semantic-chart-'));t.after(()=>rmSync(dir,{recursive:true,force:true}))
 const fixture=generationEvaluationCases().find(c=>c.id==='categories'),before=JSON.stringify(fixture.referencePlan)
 const {create}=templateCreateOptions(fixture.template,{}, {title:'Chart',deckPlan:fixture.referencePlan}),chart=create.slides[0].elements.find(e=>e.type==='chart').chart
 assert.equal(chart.title,'Заявки');assert.equal(chart.dataLabels.showValue,true);assert.equal(chart.series[0].color,'#7C3AED')
 assert.equal(chart.titleStyle.font,'Liberation Sans');assert.equal(chart.titleStyle.color,'#242424')
 assert.equal(chart.chartAreaFill,'#FFFFFF');assert.equal(chart.dataLabels.textStyle.sizePt,20)
 assert.equal(JSON.stringify(fixture.referencePlan),before);assert.equal(create.slides[0].semanticSource.diagram.chart.title,undefined)
 const built=await buildDeckAsync({...create,outputDir:dir,lang:'en'}),parts=unzipSync(readFileSync(built.pptxPath)),xml=strFromU8(parts['ppt/charts/chart1.xml'])
 assert.ok(xml.includes('Заявки'));assert.match(xml,/<c:title[ >]/);assert.match(xml,/<c:showVal val="1"/);assert.ok(xml.includes('7C3AED'))
 assert.ok(parts['ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx'])
 assert.deepEqual(chart.series[0].values,[17,9])
})
test('explicit chart settings win, legacy charts stay compatible, and large sets avoid automatic labels',()=>{
 const chart={...data,title:'Explicit',titleStyle:{color:'#FF0000'},legend:{position:'r'},dataLabels:{showValue:false},series:[{...data.series[0],color:'#008844'}]}
 const scene=diagramToScene({diagram:{version:2,kind:'chart',chart}},{accent:'#7C3AED'}),actual=scene.elements[0].chart
 assert.equal(actual.title,'Explicit');assert.equal(actual.titleStyle.color,'#FF0000');assert.equal(actual.series[0].color,'#008844');assert.equal(actual.dataLabels.showValue,false);assert.equal(actual.legend.position,'r')
 const old=diagramToScene({diagram:{kind:'chart',chart:data}}).elements[0].chart
 assert.equal(old.title,undefined);assert.equal(old.series[0].color,undefined)
 const large={...data,categories:Array.from({length:13},(_,i)=>String(i)),series:[{name:'Known series',values:Array(13).fill(2)}]}
 assert.equal(diagramToScene({diagram:{version:2,kind:'chart',chart:large}}).elements[0].chart.dataLabels,undefined)
 const pie=diagramToScene({diagram:{version:2,kind:'chart',chart:{...data,kind:'pie'}}},{accent:'#7C3AED',background:'#FFFFFF',color:'#242424'}).elements[0].chart
 assert.equal(new Set(pie.series[0].pointColors).size,2);assert.equal(pie.dataLabels.position,'outEnd')
 const area=diagramToScene({diagram:{version:2,kind:'chart',chart:{...data,kind:'area'}}}).elements[0].chart
 assert.equal(area.dataLabels,undefined,'area labels require deliberate placement after visual review')
 for(const kind of ['area','doughnut'])assert.throws(()=>diagramToScene({diagram:{version:2,kind:'chart',chart:{...data,kind,dataLabels:{showValue:true,position:'t'}}}}),{code:'chart-label-position'})
})
test('all eight confirmed semantic chart variants export with supported label defaults',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'semantic-chart-matrix-'));t.after(()=>rmSync(dir,{recursive:true,force:true}))
 const {selectSceneChartVariant,CONFIRMED_CHART_VARIANTS}=await import('../skills/dsh-ppt/scripts/deck-generation.mjs')
 const slides=CONFIRMED_CHART_VARIANTS.map((v,i)=>({...diagramToScene({diagram:{version:2,kind:'chart',chart:selectSceneChartVariant(data,v)}},{accent:'#7C3AED',background:'#FFFFFF',color:'#242424'}),id:'chart-'+i,backgroundColor:'#FFFFFF'}))
 const built=await buildDeckAsync({title:'Chart matrix',slides,outputDir:dir,lang:'en'}),parts=unzipSync(readFileSync(built.pptxPath))
 assert.equal(Object.keys(parts).filter(p=>/^ppt\/charts\/chart\d+\.xml$/.test(p)).length,8)
 for(let i=1;i<=8;i++){const xml=strFromU8(parts['ppt/charts/chart'+i+'.xml']);assert.match(xml,/<c:title[ >]/);if(CONFIRMED_CHART_VARIANTS[i-1]!=='area')assert.match(xml,/<c:showVal val="1"/);assert.ok(xml.includes('7C3AED'))}
})
test('pie labels use shares of the actual total in HTML and native PPTX without changing data',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'pie-percent-'));t.after(()=>rmSync(dir,{recursive:true,force:true}))
 const style={accent:'#79C6FF',background:'#121826',color:'#F5F7FA',fontFamily:'Arial'},theme={palette:{accent:style.accent,bg:style.background,fg:style.color}}
 const slides=[]
 for(const [index,values]of [[50,30,20],[100,60,40],[0,1,3],[1,1,1]].entries()){
  const raw={kind:'pie',categories:['Equipment','Licenses','Training'],series:[{name:'Budget',values}]},before=structuredClone(raw),chart=semanticChartDesign(raw,{...style,unit:'тыс. ₽',showPercent:true})
  assert.deepEqual(raw,before);assert.deepEqual(chart.series[0].values,values)
  assert.equal(chart.dataLabels.showValue,false);assert.equal(chart.dataLabels.showPercent,false)
  const svg=renderSceneChartSvg(chart,theme),total=values.reduce((a,b)=>a+b,0)
  for(const [i,v]of values.entries())assert.ok(svg.includes(chart.categories[i]+': '+v+'\u00a0тыс.\u00a0₽ ('+(v/total*100).toFixed(0)+'%)'))
  slides.push({...diagramToScene({diagram:{version:2,kind:'chart',chart}},style),id:'pie-'+index})
 }
 const built=await buildDeckAsync({title:'Shares',slides,outputDir:dir,lang:'en'}),parts=unzipSync(readFileSync(built.pptxPath))
 for(let i=1;i<=4;i++){
  const xml=strFromU8(parts['ppt/charts/chart'+i+'.xml'])
  assert.match(xml,/<c:showPercent val="0"/);assert.match(xml,/<c:showVal val="0"/)
  assert.ok(xml.includes('\u00a0тыс.\u00a0₽ ('));assert.ok(!xml.includes(' — '))
  assert.match(xml,/<c:rich>[\s\S]*?<a:r><a:rPr sz="1800">[\s\S]*?<a:srgbClr val="F5F7FA"\/>/)
 }
 const explicit=semanticChartDesign({kind:'pie',categories:['A','B'],series:[{name:'S',values:[2,6]}],dataLabels:{showCategory:true,showValue:true,separator:': '}},style)
 assert.equal(explicit.dataLabels.showPercent,undefined);assert.ok(renderSceneChartSvg(explicit,theme).includes('A: 2'))
 const noUnit=semanticChartDesign({kind:'pie',categories:['A','B'],series:[{name:'S',values:[2,6]}]},style)
 assert.equal(noUnit.dataLabels.showValue,true);assert.equal(noUnit.dataLabels.showPercent,undefined);assert.equal(noUnit.dataLabels.separator,', ')
 for(const extra of [{},{showPercent:false}]){
  const chart=semanticChartDesign({kind:'pie',categories:['A','B'],series:[{name:'S',values:[2,6]}]},{...style,unit:'₽',...extra})
  const svg=renderSceneChartSvg(chart,theme)
  assert.ok(svg.includes('A: 2\u00a0₽'));assert.doesNotMatch(svg,/>[^<]*%[^<]*<\/text>/)
 }
})
