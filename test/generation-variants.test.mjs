import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import {generationFixture} from './fixtures/generation.mjs'
import {normalizeSceneTemplate} from '../skills/dsh-ppt/scripts/deck-template-scene.mjs'
import {createSceneVariant,reconcileVariantDescription,duplicateVariantIds,variantSampleValues} from '../skills/dsh-ppt/scripts/deck-variant-editor.mjs'
import {bundleClientModel} from '../scripts/bundle-client-model.mjs'
import {PptTemplateStore} from '../lib/templates.js'

test('variant duplication remaps references and retains fixed family artwork and typography',()=>{
 const {plan,...input}=generationFixture(1),t=normalizeSceneTemplate(input),l=t.style.layouts[0]
 l.elements.push({id:'logo',type:'shape',role:'decor',preset:'rect',frame:{x:0,y:0,w:200000,h:200000},fill:{color:'#CC0000'}})
 const before=structuredClone(l),copy=createSceneVariant(l,{id:'copy',mode:'mirror',pageSize:t.style.pageSize})
 assert.deepEqual(l,before);assert.equal(copy.familyId,l.familyId);assert.notEqual(copy.elements[0].id,l.elements[0].id)
 assert.equal(copy.slots[0].elementId,copy.elements[0].id);assert.equal(copy.description.slots[0].slotId,copy.slots[0].id)
 assert.deepEqual(copy.elements[1].frame,l.elements[1].frame);assert.deepEqual(copy.elements[0].textStyle,l.elements[0].textStyle)
 assert.equal(copy.elements[0].frame.x,t.style.pageSize.width-l.elements[0].frame.x-l.elements[0].frame.w)
 normalizeSceneTemplate({...t,style:{...t.style,layouts:[l,copy]}})
 assert.equal(duplicateVariantIds([l,createSceneVariant(l,{id:'exact-copy'})],t.style.pageSize).length,1)
})
test('group duplication remaps children; unsafe automatic reflow is explicitly rejected',()=>{
 const {plan,...input}=generationFixture(1),l=normalizeSceneTemplate(input).style.layouts[0]
 l.elements.unshift({id:'group',type:'group',role:'content',frame:{x:0,y:0,w:9000000,h:6000000},children:[l.elements[0].id]})
 const c=createSceneVariant(l,{id:'copy'});assert.equal(c.elements[0].children[0],c.elements[1].id)
 assert.throws(()=>createSceneVariant(l,{id:'mirror',mode:'mirror'}),{code:'variant-edit'})
})
test('edited slot roles reconcile without retaining references to deleted content areas',()=>{
 const {plan,...input}=generationFixture(1),l=normalizeSceneTemplate(input).style.layouts[0]
 l.description.origin='user';l.description.intent='Specific purpose';l.slots=[];l.elements[0].role='decor'
 const d=reconcileVariantDescription(l);assert.equal(d.slots.length,0);assert.equal(d.intent,'Specific purpose')
})
test('template sample preview uses original schema 3 and preserves artifact-free previews',async()=>{
 const {plan,...input}=generationFixture(1),t=normalizeSceneTemplate(input)
 const long=variantSampleValues(t.style.layouts[0],'long'),short=variantSampleValues(t.style.layouts[0],'short');assert.ok(long.body.length>short.body.length)
 const store=Object.create(PptTemplateStore.prototype);store.mod=async()=>await import('../skills/dsh-ppt/scripts/deck-templates.mjs');store.draftAssets=async()=>({})
 const options=await store.previewOptions({manifest:t,identity:{login:'local'},sampleLength:'long'})
 assert.equal(options.slides[0].layout,'scene');assert.equal(options.slides[0].elements[0].paragraphs.length,6)
})
test('actual template UI duplication changes draft through shared authoring functions',()=>{
 const {plan,...input}=generationFixture(1),l=normalizeSceneTemplate(input).style.layouts[0]
 const graph=bundleClientModel('skills/dsh-ppt/scripts','deck-client-model.mjs'),editor=readFileSync('templates/panels/template-editor.js','utf8')
 let changed
 const context=vm.createContext({React:{useState:v=>[v,()=>{}]},h:(type,props,...children)=>({type,props:props??{},children:children.flat(Infinity)}),W:{Button:'button',Status:'status'},PptSceneObjects:'inspector',languageOf:()=> 'ru',draft:{schemaVersion:3,layouts:[l],pageSize:input.style.pageSize},set:v=>changed=v})
 const tree=vm.runInContext(graph+'\n'+editor+'\nTplLayoutsEditor({draft,disabled:false,set})',context),nodes=[]
 function walk(n){if(!n||typeof n!=='object')return;nodes.push(n);n.children?.forEach(walk)}walk(tree)
 const duplicate=nodes.find(n=>n.type==='button'&&n.children.includes('Копия'));assert.ok(duplicate);duplicate.props.onClick()
 assert.equal(changed.layouts.length,2);assert.notEqual(changed.layouts[0].slots[0].id,changed.layouts[1].slots[0].id)
})
