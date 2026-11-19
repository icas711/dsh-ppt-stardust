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
const data={kind:'column',categories:['A','B'],series:[{name:'Requests',values:[17,9]}]}
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
})
test('all eight confirmed semantic chart variants export with the visible-label defaults',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'semantic-chart-matrix-'));t.after(()=>rmSync(dir,{recursive:true,force:true}))
 const {selectSceneChartVariant,CONFIRMED_CHART_VARIANTS}=await import('../skills/dsh-ppt/scripts/deck-generation.mjs')
 const slides=CONFIRMED_CHART_VARIANTS.map((v,i)=>({...diagramToScene({diagram:{version:2,kind:'chart',chart:selectSceneChartVariant(data,v)}},{accent:'#7C3AED',background:'#FFFFFF',color:'#242424'}),id:'chart-'+i,backgroundColor:'#FFFFFF'}))
 const built=await buildDeckAsync({title:'Chart matrix',slides,outputDir:dir,lang:'en'}),parts=unzipSync(readFileSync(built.pptxPath))
 assert.equal(Object.keys(parts).filter(p=>/^ppt\/charts\/chart\d+\.xml$/.test(p)).length,8)
 for(let i=1;i<=8;i++){const xml=strFromU8(parts['ppt/charts/chart'+i+'.xml']);assert.match(xml,/<c:title[ >]/);assert.match(xml,/<c:showVal val="1"/);assert.ok(xml.includes('7C3AED'))}
})
