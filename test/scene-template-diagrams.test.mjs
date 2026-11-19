import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fixtures} from './fixtures/pptx/generate.mjs'
import {templateFromPptxScene,templateCreateOptions,buildTemplateBundle,readTemplateBundle} from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import {fillSceneLayout,remapSceneLayout,normalizeSceneTemplate} from '../skills/dsh-ppt/scripts/deck-template-scene.mjs'
import {buildDeckAsync,readDeckProject} from '../skills/dsh-ppt/scripts/deck-advanced.mjs'
import {diagramToScene} from '../skills/dsh-ppt/scripts/deck-diagrams.mjs'
test('schema 3 template ZIP roundtrip preserves 13 addressable slots and source page size',async t=>{
 const root=mkdtempSync(join(tmpdir(),'ppt-template3-'));t.after(()=>rmSync(root,{recursive:true,force:true}))
 const extracted=await templateFromPptxScene(fixtures()[0].bytes,{templateId:'scene-template',name:'Dense'})
 const path=join(root,'template.zip');writeFileSync(path,buildTemplateBundle(extracted.manifest,extracted.assets))
 const bundle=readTemplateBundle(path),layout=bundle.manifest.style.layouts[0]
 assert.equal(bundle.manifest.schemaVersion,3);assert.equal(layout.slots.length,13)
 assert.ok(!JSON.stringify(bundle.manifest).includes('Independent block 12'))
 const values=Object.fromEntries(layout.slots.map((s,i)=>[s.id,'Replacement '+i]))
 const filled=templateCreateOptions(bundle.manifest,bundle.assets,{title:'New content',selections:[{layoutId:layout.id,values}]})
 const made=await buildDeckAsync({...filled.create,outputDir:root,lang:'en'})
 const project=readDeckProject({deckPath:made.jsonPath}).manifest
 assert.equal(project.schemaVersion,2);assert.equal(project.style.pageSize.width,9906000)
 assert.ok(JSON.stringify(project.slides).includes('Replacement 12'))
 assert.equal(project.slides[0].elements.filter(e=>e.type==='text').length,13)
 assert.equal(project.quality.issues.filter(i=>i.code==='template-unfilled').length,0)
 assert.throws(()=>fillSceneLayout(layout,{unknown:'Lost?'}),{code:'unknown-slot'})
 const mixed=structuredClone(bundle.manifest);mixed.style.layouts[0].textZones=[]
 assert.throws(()=>normalizeSceneTemplate(mixed),{code:'mixed-template-layout'})
 const target={...layout,id:'other-layout',slots:layout.slots.slice(0,1),elements:layout.elements.slice(0,1)}
 const remapped=remapSceneLayout(project.slides[0],layout,target,{assets:project.assets})
 assert.equal(remapped.slide.elements.filter(e=>e.type==='text').length,13)
 assert.equal(remapped.diagnostics.filter(d=>d.code==='unmapped-content-preserved').length,12)
})
for(const kind of ['process','timeline','comparison','hierarchy','relationship'])test('semantic diagram: '+kind+' keeps labels and editable native objects',()=>{
 const items=[{id:'a',label:'Analyze',date:kind==='timeline'?'2026-01':undefined},{id:'b',label:'Build',detail:'Retain every fact',...(kind==='hierarchy'?{parentId:'a'}:{})}]
 const scene=diagramToScene({title:'Plan',layout:'diagram',diagram:{kind,items,links:[{from:'a',to:'b'}]}},{pageSize:{width:9906000,height:6858000}})
 const serialized=JSON.stringify(scene)
 for(const label of ['Analyze','Build','Retain every fact'])assert.ok(serialized.includes(label))
 assert.equal(scene.elements.filter(e=>e.type==='chart').length,0)
 assert.equal(scene.elements.filter(e=>e.type==='shape').length,2)
 if(kind!=='comparison')assert.equal(scene.elements.filter(e=>e.type==='line').length,1)
})
test('semantic diagrams reject invented numeric data, cycles and unknown relationships',()=>{
 assert.throws(()=>diagramToScene({diagram:{kind:'chart',chart:{kind:'column',categories:['A'],series:[{name:'Data',values:['unspecified']}]}}}),{code:'invalid-number'})
 assert.throws(()=>diagramToScene({diagram:{kind:'hierarchy',items:[{id:'a',label:'A',parentId:'b'},{id:'b',label:'B',parentId:'a'}]}}),/cycle/)
 assert.throws(()=>diagramToScene({diagram:{kind:'relationship',items:[{id:'a',label:'A'}],links:[{from:'a',to:'missing'}]}}),/endpoints/)
})
