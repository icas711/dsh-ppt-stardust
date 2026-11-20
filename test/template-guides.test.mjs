import test from 'node:test'
import assert from 'node:assert/strict'
import {compositionGuides} from '../skills/dsh-ppt/scripts/deck-template-guides.mjs'
import {variantRevision} from '../skills/dsh-ppt/scripts/deck-generation.mjs'
import {groupTransform} from '../skills/dsh-ppt/scripts/deck-geometry.mjs'
import {templateFromSceneManifest} from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import {fillSceneLayout,composeSceneTemplateSlides} from '../skills/dsh-ppt/scripts/deck-template-scene.mjs'

const page={width:10000,height:20000}
const text=(id,align='left')=>({id,type:'text',frame:{x:-100,y:1000,w:4000,h:2000},textStyle:{fontFamily:'Arial',size:24,color:'#112233'},paragraphs:[{runs:[{text:''}]},{style:{align},runs:[{text:' '},{text:'PRIVATE SAMPLE',style:{bold:true,size:30}}]}]})

test('guides use real axes, outer anchors, first meaningful styles, rounding and no sample copy or mutation',()=>{
 const layout={elements:['left','right','center','justify'].map(a=>text(a,a))},before=structuredClone(layout)
 const guides=compositionGuides(layout,page)
 assert.deepEqual(guides.text.map(t=>t.anchor),[
  {horizontal:'left',x:-1,y:5},{horizontal:'right',x:39,y:5},{horizontal:'center',x:19,y:5},{horizontal:'left',x:-1,y:5}])
 assert.deepEqual(guides.text[0].referenceArea,{left:-1,top:5,width:40,height:10})
 assert.deepEqual(guides.text[0].typography,{fontFamily:'Arial',size:30,color:'#112233',bold:true})
 assert.doesNotMatch(JSON.stringify(guides),/PRIVATE|paragraphs|matrix|frame/)
 assert.deepEqual(layout,before)
 assert.equal(compositionGuides({elements:[{...text('round'),frame:{x:1,y:1,w:1,h:1}}]},{width:3,height:6}).text[0].anchor.x,33.33)
 assert.deepEqual(compositionGuides({elements:[]},page),{units:'percentOfPage',text:[],decor:[]})
 assert.throws(()=>compositionGuides(layout),/actual page size/)
})

test('guides handle empty paragraphs, transformed/reflected frames and flattened group children',()=>{
 const child={...text('child','right'),transform:groupTransform({outer:{x:1000,y:2000,w:8000,h:8000},inner:{x:0,y:0,w:4000,h:4000},rotation:90})}
 const layout={elements:[{id:'group',type:'group',frame:child.frame,children:['child']},child,
  {...text('empty'),paragraphs:[]},
  {...text('reflection'),transform:[-1,0,0,1,5000,0]},
  {id:'plate',role:'decor',type:'shape',frame:{x:0,y:0,w:10000,h:20000}}]}
 const before=structuredClone(layout),g=compositionGuides(layout,page)
 assert.equal(g.text[0].transformed,true);assert.equal(g.text[0].referenceAreaKind,'transformedBoundingBox')
 assert.match(g.text[0].anchorLimitation,/not the typesetting frame/)
 assert.equal(g.text[1].alignment,'left');assert.equal(g.text[2].transformed,true)
 assert.deepEqual(g.decor[0].referenceArea,{left:0,top:0,width:100,height:100})
 assert.deepEqual(layout,before)
})

test('new scene templates have optional text, preserve other requirements, explicit slots and free geometry',()=>{
 const source={theme:'data',style:{pageSize:page},slides:[{layout:'scene',purpose:'section',elements:[text('body','right'),
  {id:'chart',type:'chart',frame:{x:0,y:0,w:100,h:100},chart:{kind:'bar',categories:['Private category'],series:[{name:'Private series',values:[4]}]}},
  {id:'decor',role:'decor',type:'shape',preset:'rect',frame:{x:0,y:0,w:100,h:100}}]}]}
 const before=structuredClone(source),result=templateFromSceneManifest(source,{templateId:'optional-text',name:'Optional text'})
 const layout=result.manifest.style.layouts[0]
 assert.deepEqual(source,before);assert.equal(layout.purpose,'section')
 assert.equal(compositionGuides(layout,page).text[0].typography.size,30)
 assert.equal(compositionGuides(layout,page).text[0].alignment,'right')
 assert.equal(layout.slots.find(s=>s.type==='text').required,false)
 assert.equal(layout.slots.find(s=>s.type==='chart').required,true)
 assert.equal(layout.description.revision,variantRevision(layout,page))
 assert.equal(layout.description.slots.find(s=>s.slotId==='slot-body').required,false)
 assert.doesNotMatch(JSON.stringify(layout),/PRIVATE SAMPLE|Private category|Private series/)
 const slot=layout.slots.find(s=>s.type==='text')
 const filled=fillSceneLayout(layout,{[slot.id]:'Replacement'}).slide.elements.find(e=>e.id==='body')
 assert.deepEqual(filled.frame,source.slides[0].elements[0].frame)
 assert.equal(filled.paragraphs[0].runs[0].text,'Replacement')
 const old=structuredClone(layout);old.slots.find(s=>s.type==='text').required=true
 assert.ok(fillSceneLayout(old).diagnostics.some(d=>d.slotId===slot.id))
 assert.ok(!fillSceneLayout(layout).diagnostics.some(d=>d.slotId===slot.id))
 const free=composeSceneTemplateSlides([{layout:'scene',purpose:'section',elements:[]}],result.manifest,{})[0]
 assert.deepEqual(free.elements.map(e=>e.id),['decor'])
})
