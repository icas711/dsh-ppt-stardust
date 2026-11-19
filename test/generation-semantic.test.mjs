import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {unzipSync,strFromU8} from 'fflate'
import {readFileSync} from 'node:fs'
import {diagramToScene,restoreSemanticRepresentation} from '../skills/dsh-ppt/scripts/deck-diagrams.mjs'
import {validateSemanticDiagram} from '../skills/dsh-ppt/scripts/deck-semantic.mjs'
import {normalizeSceneTemplate} from '../skills/dsh-ppt/scripts/deck-template-scene.mjs'
import {templateCreateOptions} from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import {buildDeckAsync,editDeck,undoDeck,readDeckProject} from '../skills/dsh-ppt/scripts/deck-advanced.mjs'
import {validateDeckPlan} from '../skills/dsh-ppt/scripts/deck-generation.mjs'
import {generationFixture} from './fixtures/generation.mjs'
import {resolveTheme} from '../skills/dsh-ppt/scripts/deck-theme.mjs'

export const semanticExamples=[
 {version:2,kind:'cards',items:[{id:'a',label:'Clarity'},{id:'b',label:'Evidence'}]},
 {version:2,kind:'cycle',repeats:true,items:[{id:'a',label:'Measure'},{id:'b',label:'Learn'},{id:'c',label:'Adjust'}]},
 {version:2,kind:'kpi',items:[{id:'a',label:'Coverage',value:85,unit:'%',delta:5,deltaUnit:'pp'}]},
 {version:2,kind:'quote',items:[{id:'a',label:'A shared goal',source:'Public fixture author'}]},
 {version:2,kind:'number',items:[{id:'a',label:'Completed',value:12,unit:'tasks',source:'Fixture register'}]},
 {version:2,kind:'timeline',ordered:true,items:[{id:'a',label:'Start',date:'2026-01'},{id:'b',label:'Finish',date:'2026-04'}]},
 {version:2,kind:'comparison',criteria:['Cost','Quality'],items:[{id:'a',label:'Option A',values:['Low','High']},{id:'b',label:'Option B',values:['Medium',null]}]},
]
for(const diagram of semanticExamples)test('native '+diagram.kind+' preserves explicit source and reversibly renders',()=>{
 const scene=diagramToScene({diagram}),list=restoreSemanticRepresentation(scene,'list'),visual=restoreSemanticRepresentation(list,'visual')
 assert.deepEqual(scene.semanticSource.diagram,diagram);assert.deepEqual(visual.semanticSource.diagram,diagram)
 assert.equal(list.elements.length,1);for(const i of diagram.items)assert.ok(JSON.stringify(list.elements).includes(i.label))
 if(diagram.kind==='cycle')assert.equal(scene.elements.filter(e=>e.type==='line').length,3)
 if(diagram.kind==='comparison')assert.ok(JSON.stringify(scene.elements).includes('Quality: —'))
 if(diagram.kind==='kpi')assert.ok(JSON.stringify(scene.elements).includes('85 %'))
})
test('semantic contracts reject fabricated implications, invalid dates, missing attribution and incompatible comparison',()=>{
 assert.throws(()=>validateSemanticDiagram({...semanticExamples[1],repeats:false}),{code:'diagram-input'})
 assert.throws(()=>validateSemanticDiagram({...semanticExamples[5],items:[{label:'Wrong',date:'2026-02-31'}]}),{code:'diagram-input'})
 assert.throws(()=>validateSemanticDiagram({version:2,kind:'quote',items:[{label:'Unattributed'}]}),{code:'diagram-input'})
 assert.throws(()=>validateSemanticDiagram({...semanticExamples[6],items:[{label:'One',values:['Only']}]}),{code:'diagram-input'})
 assert.throws(()=>validateSemanticDiagram({version:2,kind:'hierarchy',items:[{label:'A'},{label:'B'}]}),{code:'diagram-input'})
 assert.throws(()=>validateSemanticDiagram({version:2,kind:'cycle',repeats:true,items:Array.from({length:7},(_,i)=>({label:'Stage '+i}))}),{code:'diagram-input'})
})
test('new diagrams use the selected theme palette and font instead of fixed blue cards',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'semantic-theme-'));t.after(()=>rmSync(dir,{recursive:true,force:true}))
 const made=await buildDeckAsync({title:'Selected theme',theme:'velvet',outputDir:dir,slides:[{layout:'diagram',diagram:semanticExamples[0]}]})
 const scene=readDeckProject({deckPath:made.jsonPath}).manifest.slides[0],theme=resolveTheme('velvet')
 assert.equal(scene.elements.find(e=>e.type==='shape').fill.color,theme.palette.bg)
 assert.equal(scene.elements.find(e=>e.type==='shape').stroke.color,theme.palette.accent)
 assert.ok(scene.elements.find(e=>e.type==='text').textStyle.fontFamily)
})
test('semantic conversion keeps supplied rich runs on matching labels and restores the full original text formatting',()=>{
 const {plan,...input}=generationFixture(1,1);input.style.layouts[0].elements[0].frame={x:500000,y:1000000,w:8000000,h:5000000};const t=normalizeSceneTemplate(input)
 plan[0].structure='cycle';plan[0].values.body=[{style:{align:'right'},runs:[{text:'Measure',style:{bold:true,color:'#AA0000'}}]},{runs:[{text:'Learn',style:{italic:true}}]}];plan[0].visual={slotId:'body',diagram:{version:2,kind:'cycle',repeats:true,items:[{label:'Measure'},{label:'Learn'}]}}
 const slide=templateCreateOptions(t,{}, {title:'Rich source',deckPlan:plan}).create.slides[0],label=slide.elements.find(e=>e.type==='text'&&e.paragraphs[0].runs[0].text==='Measure')
 assert.equal(label.paragraphs[0].runs[0].style.color,'#AA0000');assert.equal(label.paragraphs[0].style.align,'right')
 assert.equal(slide.elements.find(e=>e.type==='text'&&e.paragraphs[0].runs[0].text==='Learn').textStyle.color,'#242424')
 const list=restoreSemanticRepresentation(slide,'list');assert.deepEqual(list.elements[0].paragraphs,slide.semanticSource.originalTextObject.paragraphs)
})
test('planned native visual stays in the template region, keeps artwork/font/color, and toggles with undo',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'generation-visual-'));t.after(()=>rmSync(dir,{recursive:true,force:true}))
 const {plan,...input}=generationFixture(1,1),l=input.style.layouts[0];l.elements[0].frame={x:500000,y:1600000,w:8000000,h:4200000};l.elements[0].textStyle={fontFamily:'Liberation Sans',size:22,color:'#861122'}
 l.elements.unshift({id:'logo',type:'shape',role:'decor',preset:'rect',frame:{x:300000,y:300000,w:800000,h:300000},fill:{color:'#CC0000'}})
 const template=normalizeSceneTemplate(input),p=plan[0];p.structure='cycle';p.values.body='Measure\nLearn\nAdjust';p.visual={slotId:'body',diagram:semanticExamples[1]}
 assert.equal(validateDeckPlan(plan,template.style.layouts,{pageSize:template.style.pageSize}).valid,true)
 const {create}=templateCreateOptions(template,{}, {title:'Inside template',deckPlan:plan}),generated=create.slides[0]
 assert.deepEqual(generated.elements.find(e=>e.id==='logo'),template.style.layouts[0].elements[0]);assert.equal(generated.semanticSource.originalText,p.values.body)
 for(const e of generated.elements.filter(e=>e.type==='text')){assert.equal(e.textStyle.fontFamily,'Liberation Sans');assert.equal(e.textStyle.size,22);assert.equal(e.textStyle.color,'#861122')}
 const built=await buildDeckAsync({...create,outputDir:dir,lang:'en'}),z=unzipSync(readFileSync(built.pptxPath)),xml=strFromU8(z['ppt/slides/slide1.xml']);assert.ok(xml.includes('Measure'));assert.ok(xml.includes('861122'));assert.ok(xml.includes('cxnSp'))
 await editDeck({deckPath:built.jsonPath,edits:[{slide:p.id,patch:{restoreRepresentation:'list'}}]})
 const listed=readDeckProject({deckPath:built.jsonPath}).manifest;assert.equal(listed.slides[0].elements.filter(e=>e.type==='text').length,1)
 assert.deepEqual(listed.slides[0].elements.find(e=>e.id==='logo'),generated.elements[0])
 await undoDeck({deckPath:built.jsonPath});assert.equal(readDeckProject({deckPath:built.jsonPath}).manifest.slides[0].elements.filter(e=>e.type==='line').length,3)
 p.values.body+='\nDo not drop this';assert.equal(validateDeckPlan(plan,template.style.layouts).valid,false)
})
