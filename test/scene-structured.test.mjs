import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {unzipSync} from 'fflate'
import * as lib from '@office-kit/pptx'
import {buildDeckAsync,readDeckProject,editDeck} from '../skills/dsh-ppt/scripts/deck-advanced.mjs'
import {normalizeSceneSlide} from '../skills/dsh-ppt/scripts/deck-model.mjs'
import {probeChartSpec,probeVariants} from '../scripts/probe-pptx-charts.mjs'
const paragraphs=text=>[{runs:[{text}]}]
const table={id:'merged-table',type:'table',frame:{x:100000,y:4000000,w:3000000,h:1200000},table:{columns:[1000000,1000000,1000000],rows:[600000,600000],cells:[{row:0,col:0,colSpan:2,paragraphs:paragraphs('Merged'),fill:'#FF0000'},{row:0,col:2,rowSpan:2,paragraphs:paragraphs('Vertical')},{row:1,col:0,paragraphs:paragraphs('A')},{row:1,col:1,paragraphs:paragraphs('B')}]}}
test('merged native table retains grid spans, text, fills and dimensions',async()=>{
 const scene=normalizeSceneSlide({layout:'scene',elements:[table]})
 const {buildPptx,resolveTheme,resolveLanguage}=await import('../skills/dsh-ppt/scripts/deck-core.mjs')
 const bytes=buildPptx({slides:[scene]},resolveTheme('swiss'),resolveLanguage('en'))
 const pres=await lib.loadPresentation(bytes),shape=lib.getSlideTables(lib.getSlides(pres)[0])[0]
 assert.ok(shape)
 const xml=Buffer.from(unzipSync(bytes)['ppt/slides/slide1.xml']).toString()
 assert.match(xml,/gridSpan="2"/);assert.match(xml,/rowSpan="2"/);assert.match(xml,/hMerge="1"/);assert.match(xml,/vMerge="1"/)
 assert.match(xml,/FF0000/);assert.match(xml,/Merged/)
 const invalid=structuredClone(scene);invalid.elements[0].table.cells[0].rowSpan=2
 assert.throws(()=>normalizeSceneSlide(invalid),{code:'table-overlap'})
})
test('multiple native charts keep drawing order and regenerate embedded Edit Data workbooks on edits',async t=>{
 const root=mkdtempSync(join(tmpdir(),'scene-chart-'));t.after(()=>rmSync(root,{recursive:true,force:true}))
 const slides=[{layout:'scene',label:'Charts',elements:probeVariants.map((variant,i)=>({id:'chart-'+i,type:'chart',frame:{x:100000+(i%4)*2900000,y:100000+Math.floor(i/4)*3000000,w:2800000,h:2800000},chart:probeChartSpec(variant)}))}]
 const created=await buildDeckAsync({title:'Charts',theme:'swiss',lang:'en',slides,outputDir:root})
 let pres=await lib.loadPresentation(readFileSync(created.pptxPath)),charts=lib.getSlideCharts(lib.getSlides(pres)[0])
 assert.equal(charts.length,8);assert.deepEqual(charts.map(c=>lib.getShapeName(c.shape)),slides[0].elements.map(e=>e.id))
 let parts=unzipSync(readFileSync(created.pptxPath));assert.equal(Object.keys(parts).filter(k=>k.endsWith('.xlsx')).length,8)
 const project=readDeckProject({deckPath:created.jsonPath}).manifest,elements=project.slides[0].elements
 elements[0].chart.series[0].values=[18,4]
 await editDeck({deckPath:created.jsonPath,expectedRevision:0,edits:[{slide:1,patch:{elements}}]})
 pres=await lib.loadPresentation(readFileSync(created.pptxPath));charts=lib.getSlideCharts(lib.getSlides(pres)[0])
 assert.deepEqual(charts[0].spec.series[0].values,[18,4]);assert.deepEqual(charts[1].spec.series[0].values,[12,8])
 parts=unzipSync(readFileSync(created.pptxPath));const books=Object.entries(parts).filter(([k])=>k.endsWith('.xlsx'));const xml=Buffer.from(unzipSync(books[0][1])['xl/worksheets/sheet1.xml']).toString();assert.match(xml,/<v>18<\/v>/);assert.match(xml,/<v>4<\/v>/)
})
