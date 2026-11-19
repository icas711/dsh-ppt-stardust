import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {unzipSync,strFromU8} from 'fflate'
import * as engine from '../skills/dsh-ppt/scripts/deck-advanced.mjs'
import {composeSceneTemplateSlides} from '../skills/dsh-ppt/scripts/deck-template-scene.mjs'
import {mergeSceneTextStyles,normalizeSceneSlide,sceneInputProperties} from '../skills/dsh-ppt/scripts/deck-model.mjs'
import {sceneTextColor} from '../skills/dsh-ppt/scripts/deck-scene-color.mjs'
import {renderScenePptx} from '../skills/dsh-ppt/scripts/deck-scene-pptx.mjs'
import {createPptExecutors} from '../lib/execution.js'
import {buildPptTools} from '../lib/tools.js'
import {resolvePptConfig} from '../lib/config.js'
import {PptWorkbench} from '../lib/workbench.js'

const frame={x:100000,y:100000,w:4000000,h:600000}
const text=(id,content,color='#FFFFFF')=>({id,type:'text',frame,paragraphs:[{runs:[{text:content,style:{color}}]}]})
const inherited={fontFamily:'Arial',size:18,color:'#000000',colorSpec:{base:'#000000',transforms:[]}}
function composed(count=8){
  const reference=purpose=>({id:purpose,purpose,slots:[],elements:[
    {id:'decor',role:'decor',type:'shape',preset:'rect',frame,fill:{color:'#CF1F2F'}},
    {...text('prototype','Sample'),textStyle:inherited},
  ]})
  return composeSceneTemplateSlides(Array.from({length:count},(_,i)=>({layout:'scene',purpose:i?'content':'cover',elements:[text('heading','Heading '+i),text('label','Label '+i,'#CF1F2F'),text('body','Evidence '+i)]})),{style:{layouts:[reference('cover'),reference('content')]}},{})
}
const lossless=value=>assert.deepEqual(JSON.parse(JSON.stringify(value)),value)
const xml=(path,page=1)=>strFromU8(unzipSync(readFileSync(path))[`ppt/slides/slide${page}.xml`])
function temporary(t){const root=mkdtempSync(join(tmpdir(),'ppt-inference-'));t.after(()=>rmSync(root,{recursive:true,force:true}));return root}

test('actual scene tool outputs round-trip; ID updates retain decor, objects and frames; stale retries fail; undo restores',async t=>{
  const root=temporary(t)
  // Real executor boundary, real engine and artifacts; avoid requiring an optional PDF backend.
  const executors=createPptExecutors(resolvePptConfig({}),async()=>({...engine,buildDeckAsync:args=>engine.buildDeckAsync({...args,internalProject:false})}))
  const made=await executors.create({title:'Inference',outputDir:root,slides:composed(),lang:'ru'})
  lossless(made);assert.equal(made.slides[0].title,'');assert.equal(made.revision,0)
  const inspected=await executors.check({deckPath:made.jsonPath,slide:5});lossless(inspected)
  const before=inspected.selectedSlide.elements
  assert.equal(before.length,4);assert.equal(before[0].id,'decor')
  const args={deckPath:made.jsonPath,expectedRevision:0,edits:[{slide:5,patch:{elementUpdates:[
    {id:'heading',changes:{paragraphs:[{runs:[{text:'Changed heading',style:{color:'#FFFFFF'}}]}]}},
    {id:'label',changes:{textStyle:{color:'#CF1F2F'}}},
    {id:'body',changes:{paragraphs:[{runs:[{text:'Changed evidence'}]}]}},
  ]}}]}
  const edited=await executors.edit(args);lossless(edited);assert.equal(edited.revision,1)
  const after=(await executors.check({deckPath:made.jsonPath,slide:5})).selectedSlide.elements
  assert.deepEqual(after.map(e=>e.id),before.map(e=>e.id));assert.deepEqual(after[0],before[0])
  assert.deepEqual(after.map(e=>e.frame),before.map(e=>e.frame))
  assert.match(xml(made.pptxPath,5),/Changed heading/);assert.match(xml(made.pptxPath,5),/val="FFFFFF"/)
  const project=engine.readDeckProject({deckPath:made.jsonPath}).manifest
  assert.deepEqual(project.slides[3].elements,composed()[3].elements)
  const bytes=readFileSync(made.jsonPath)
  await assert.rejects(executors.edit(args),/revision=1/);assert.deepEqual(readFileSync(made.jsonPath),bytes)
  const noop=await executors.edit({deckPath:made.jsonPath,expectedRevision:1,edits:[{slide:5,patch:{elements:after}}]})
  lossless(noop);assert.equal(noop.changed,false)
  const undone=await executors.undo({deckPath:made.jsonPath,expectedRevision:1});lossless(undone)
  assert.equal(undone.revision,2);assert.deepEqual((await executors.check({deckPath:made.jsonPath,slide:'slide-5'})).selectedSlide.elements,before)
  const tools=buildPptTools(resolvePptConfig({}))
  for(const [name,value] of [['ppt_create',made],['ppt_edit',edited],['ppt_edit',noop],['ppt_undo',undone]]){
    const rendered=tools.find(tool=>tool.name===name).output.render({},value)[0].text
    const state=JSON.parse(rendered.split('Project state (internal; do not attach JSON):\n')[1].split('\n')[0])
    assert.deepEqual(state,{deckPath:value.jsonPath,deckId:value.deckId,revision:value.revision,undoAvailable:value.undoAvailable})
  }
})

test('invalid scene updates are atomic; legacy full replacement still deletes explicitly omitted objects',async t=>{
  const root=temporary(t),made=await engine.buildDeckAsync({title:'Atomic',outputDir:root,slides:composed(1)})
  const bytes=readFileSync(made.jsonPath),pptx=readFileSync(made.pptxPath),html=readFileSync(made.htmlPath)
  for(const patch of [
    {elementUpdates:[{id:'missing',changes:{name:'x'}}]},
    {elementUpdates:[{id:'heading',changes:{id:'new'}}]},
    {elementUpdates:[{id:'heading',changes:{type:'shape'}}]},
    {elementUpdates:[{id:'heading',changes:{}},{id:'heading',changes:{}}]},
    {elementUpdates:[{id:'heading',changes:{frame:{x:1}}}]},
    {elementUpdates:[{id:'heading',changes:{}}],elements:[]},
    {elements:[{id:'heading',type:'text',paragraphs:[]}]},
  ]){
    await assert.rejects(engine.editDeck({deckPath:made.jsonPath,expectedRevision:0,edits:[{slide:1,patch}]}))
    assert.deepEqual(readFileSync(made.jsonPath),bytes);assert.deepEqual(readFileSync(made.pptxPath),pptx);assert.deepEqual(readFileSync(made.htmlPath),html)
  }
  await assert.rejects(engine.editDeck({deckPath:made.jsonPath,edits:[{slide:1,elements:[]}]}),/use edits:/)
  const elements=composed(1)[0].elements.filter(e=>e.type==='text')
  await engine.editDeck({deckPath:made.jsonPath,expectedRevision:0,edits:[{slide:1,patch:{elements}}]})
  assert.equal(engine.checkDeck({deckPath:made.jsonPath,slide:1}).selectedSlide.elements.length,3)
  await engine.editDeck({deckPath:made.jsonPath,expectedRevision:1,edits:[{slide:1,patch:{label:'Still damaged'}}]})
  await engine.undoDeck({deckPath:made.jsonPath,expectedRevision:2})
  assert.equal(engine.checkDeck({deckPath:made.jsonPath,slide:1}).selectedSlide.elements.length,3)
  await engine.undoDeck({deckPath:made.jsonPath,expectedRevision:3})
  assert.deepEqual(engine.checkDeck({deckPath:made.jsonPath,slide:1}).selectedSlide.elements,composed(1)[0].elements)
})

test('explicit colours override inherited DrawingML colour at template, element and run levels',()=>{
  assert.equal(mergeSceneTextStyles(inherited,{bold:true}).colorSpec.base,'#000000')
  assert.equal(mergeSceneTextStyles(inherited,{color:'#FFFFFF'}).colorSpec,undefined)
  const slide=composed(1)[0]
  const output=renderScenePptx(slide).xml
  assert.match(output,/val="FFFFFF"/);assert.match(output,/val="CF1F2F"/)
  const transforms={base:'#000000',transforms:[{name:'tint',value:50000},{name:'alpha',value:50000}]}
  const style=mergeSceneTextStyles(inherited,{color:'#FF0000',colorSpec:transforms})
  assert.deepEqual(sceneTextColor(style),{color:'#BCBCBC',opacity:.5})
  assert.deepEqual(mergeSceneTextStyles(style,{bold:true}).colorSpec,transforms)
  assert.equal(sceneTextColor({colorSpec:{base:'#FF0000',transforms:[{name:'hueOff',value:7200000}]}}).color,'#00FF00')
  const overridden=composeSceneTemplateSlides([{layout:'scene',elements:[{...text('body','Explicit'),textStyle:{color:'#CF1F2F'}}]}],{style:{layouts:[{id:'content',purpose:'content',slots:[],elements:[{...text('source','Source'),textStyle:inherited}]}]}},{})
  assert.equal(overridden[0].elements[0].textStyle.colorSpec,undefined)
})

test('HTML resolves colour transforms while PPTX preserves original DrawingML specification',()=>{
  const spec={base:'#000000',transforms:[{name:'tint',value:50000},{name:'alpha',value:50000}]}
  const slide={layout:'scene',elements:[{...text('t','Tint'),textStyle:{...inherited,colorSpec:spec},paragraphs:[{runs:[{text:'Tint'}]}]}]}
  assert.match(engine.previewDeckHtml({title:'Tint',slides:[slide]}).html,/color:#BCBCBC;opacity:0.5/)
  assert.match(renderScenePptx(slide).xml,/<a:tint val="50000"\/><a:alpha val="50000"\/>/)
})

test('stroke schema and runtime agree on pt; context identifies content after template decor',()=>{
  for(const width of [0,.75,100]){
    const element={id:'outline',type:'shape',preset:'rect',frame,stroke:{color:'#000000',width}}
    normalizeSceneSlide({layout:'scene',elements:[element]})
    assert.match(renderScenePptx({layout:'scene',elements:[element]}).xml,new RegExp('w="'+Math.round(width*12700)+'"'))
  }
  const props=sceneInputProperties(),shape=props.elements.items.oneOf.find(v=>v.properties.type.enum[0]==='shape')
  assert.equal(shape.properties.stroke.properties.width.maximum,100)
  assert.equal(shape.properties.stroke.properties.width.default,1)
  const bad={layout:'scene',elements:[{id:'card',name:'Card',type:'shape',preset:'rect',frame,stroke:{color:'#000000',width:9525}}]}
  assert.throws(()=>composeSceneTemplateSlides([bad],{style:{layouts:[{id:'content',purpose:'content',slots:[],elements:[{id:'decor',type:'shape',role:'decor',preset:'rect',frame}]}]}},{}),error=>{
    assert.match(error.message,/slide 1/);assert.match(error.message,/object card \(Card\), content/)
    assert.match(error.message,/Received 9525; expected 0…100 pt/);assert.equal(error.elementId,'card');return true
  })
  const table=width=>({layout:'scene',elements:[{id:'table',type:'table',frame:{x:0,y:0,w:1000000,h:500000},table:{columns:[1000000],rows:[500000],cells:[{row:0,col:0,paragraphs:[{runs:[{text:'Cell'}]}],borders:{bottom:{color:'#000000',width}}}]}}]})
  assert.match(renderScenePptx(table(.75)).xml,/<a:lnB w="9525">/)
  assert.throws(()=>normalizeSceneSlide(table(9525)),/expected 0…100 pt, not EMU/)
  const tools=buildPptTools(resolvePptConfig({}))
  assert.ok(tools.find(t=>t.name==='ppt_check').parameters.properties.slide)
  assert.ok(tools.find(t=>t.name==='ppt_edit').parameters.properties.edits.items.properties.patch.properties.elementUpdates)
})

test('overwrite creates a new project; old index entry cannot silently overwrite shared delivery',async t=>{
  const root=temporary(t),previous=process.env.DSH_HOME
  process.env.DSH_HOME=join(root,'profile')
  t.after(()=>{if(previous===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=previous})
  const options={title:'First',outputDir:root,internalProject:true,fileName:'same',slides:composed(1),renderPdf:async()=>({ok:false,message:'Test backend unavailable'})}
  const first=await engine.buildDeckAsync(options),oldJson=readFileSync(first.jsonPath)
  const second=await engine.buildDeckAsync({...options,title:'Second',overwrite:true})
  lossless(first);lossless(second)
  const summary=buildPptTools(resolvePptConfig({})).find(tool=>tool.name==='ppt_create').output.render({},second)[0].text
  const renderedState=JSON.parse(summary.split('Project state (internal; do not attach JSON):\n')[1].split('\n')[0])
  assert.equal(renderedState.revision,0);assert.equal(renderedState.deckPath,second.jsonPath)
  assert.notEqual(first.deckId,second.deckId);assert.notEqual(first.jsonPath,second.jsonPath)
  assert.equal(first.pptxPath,second.pptxPath);assert.equal(second.revision,0);assert.equal(second.undoAvailable,0)
  assert.deepEqual(readFileSync(first.jsonPath),oldJson)
  const wb=new PptWorkbench({catalogPath:join(root,'catalog.jsonl'),loadEngine:async()=>engine})
  await wb.remember(first,{});await wb.remember(second,{})
  assert.equal((await wb.action({operation:'list'})).projects.length,2)
  const saved=readFileSync(second.pptxPath)
  await assert.rejects(engine.editDeck({deckPath:first.jsonPath,expectedRevision:0,edits:[{slide:1,patch:{label:'Old'}}]}),/另存副本/)
  assert.deepEqual(readFileSync(second.pptxPath),saved)
  lossless(engine.checkDeck({deckPath:first.jsonPath}))
  assert.ok(engine.checkDeck({deckPath:first.jsonPath}).issues.some(i=>i.code==='artifact-conflict'))
})

test('check renders Russian report data, revision, IDs, full selected slide and all warnings without undefined',async t=>{
  const root=temporary(t),scene=composed(1)[0]
  scene.elements.push(...Array.from({length:14},(_,i)=>({id:'bleed-'+i,type:'shape',role:'decor',preset:'rect',frame:{x:-100,y:100,w:500,h:500}})))
  const made=await engine.buildDeckAsync({title:'Report',lang:'ru',outputDir:root,slides:[scene]})
  const tool=buildPptTools(resolvePptConfig({})).find(t=>t.name==='ppt_check')
  const result=await tool.execute({deckPath:made.jsonPath,slide:'1'})
  lossless(result);assert.equal(result.selectedSlide.id,'slide-1')
  assert.ok(result.warningCount>=14);assert.ok(result.issues.every(issue=>typeof issue.suggestion==='string'))
  const rendered=tool.output.render({},result)[0].text
  assert.match(rendered,/Проверка качества:/);assert.doesNotMatch(rendered,/undefined|[\u3400-\u9fff]/)
  const data=JSON.parse(rendered.split('Данные проекта:\n')[1])
  assert.equal(data.revision,0);assert.equal(data.deckId,made.deckId)
  assert.equal(data.slides[0].id,'slide-1');assert.deepEqual(data.selectedSlide,result.selectedSlide)
  assert.equal(data.issues.length,result.issues.length)
  assert.match(rendered,/renderReceipt нужен только для запрошенной/)
})

test('check accepts numeric page strings, prefers exact numeric-looking IDs and explains invalid references',async t=>{
  const root=temporary(t),slides=composed(2);slides[0].id='2'
  const made=await engine.buildDeckAsync({title:'IDs',outputDir:root,slides})
  assert.equal(engine.checkDeck({deckPath:made.jsonPath,slide:'1'}).selectedSlide.id,'2')
  assert.equal(engine.checkDeck({deckPath:made.jsonPath,slide:'2'}).selectedSlide.id,'2')
  assert.equal(engine.checkDeck({deckPath:made.jsonPath,slide:2}).selectedSlide.id,'slide-2')
  for(const slide of [0,-1,1.5,'0','1.0','missing','999999999999999999999999']){
    assert.throws(()=>engine.checkDeck({deckPath:made.jsonPath,slide}),/use a 1-based page number.*slide-2/)
  }
})
