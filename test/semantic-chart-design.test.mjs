import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {unzipSync,strFromU8} from 'fflate'
import {diagramToScene} from '../skills/dsh-ppt/scripts/deck-diagrams.mjs'
import {buildDeckAsync} from '../skills/dsh-ppt/scripts/deck-advanced.mjs'
import {templateCreateOptions} from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import {generationEvaluationCases} from './fixtures/generation-evaluation.mjs'
import {semanticChartDesign} from '../skills/dsh-ppt/scripts/deck-chart-design.mjs'
const data={kind:'column',categories:['A','B'],series:[{name:'Requests',values:[17,9]}]}
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
