import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import {generationFixture} from './fixtures/generation.mjs'
import {normalizeSceneTemplate} from '../skills/dsh-ppt/scripts/deck-template-scene.mjs'
import {createSceneVariant,reconcileVariantDescription,duplicateVariantIds,variantSampleValues,VARIANT_PLACEHOLDER,changeSceneSlotType} from '../skills/dsh-ppt/scripts/deck-variant-editor.mjs'
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
test('an image variant can be authored from a text-only template with an explicit draft placeholder',()=>{
 const {plan,...input}=generationFixture(1),l=normalizeSceneTemplate(input).style.layouts[0],copy=createSceneVariant(l,{id:'with-image',mode:'image-left',pageSize:input.style.pageSize}),image=copy.elements.find(e=>e.type==='image')
 assert.equal(image.assetId,VARIANT_PLACEHOLDER.id);assert.equal(copy.slots.find(s=>s.type==='image').required,true)
 assert.ok(image.frame.x+image.frame.w<copy.elements.find(e=>e.type==='text').frame.x)
 const asset={...VARIANT_PLACEHOLDER};delete asset.id
 assert.ok(normalizeSceneTemplate({...input,style:{...input.style,layouts:[copy]}},{assets:{[VARIANT_PLACEHOLDER.id]:asset}}))
 const noImage=createSceneVariant(copy,{id:'without-image',mode:'no-image'});assert.equal(noImage.slots.some(s=>s.type==='image'),false)
})
test('column creation adds addressable content areas without shrinking the existing font',()=>{
 const {plan,...input}=generationFixture(1),l=normalizeSceneTemplate(input).style.layouts[0],grid=createSceneVariant(l,{id:'three-columns',mode:'columns',columns:3,pageSize:input.style.pageSize})
 assert.equal(grid.slots.length,3);assert.equal(new Set(grid.slots.map(s=>s.id)).size,3)
 assert.equal(new Set(grid.elements.map(e=>e.frame.x)).size,3);assert.ok(grid.elements.every(e=>e.textStyle.size===l.elements[0].textStyle.size))
 normalizeSceneTemplate({...input,style:{...input.style,layouts:[grid]}})
})
test('edited slot roles reconcile without retaining references to deleted content areas',()=>{
 const {plan,...input}=generationFixture(1),l=normalizeSceneTemplate(input).style.layouts[0]
 l.description.origin='user';l.description.intent='Specific purpose';l.slots=[];l.elements[0].role='decor'
 const d=reconcileVariantDescription(l);assert.equal(d.slots.length,0);assert.equal(d.intent,'Specific purpose')
})
test('explicit slot type changes preserve frame/ID and validate placeholders for every supported type',()=>{
 const {plan,...input}=generationFixture(1),l=normalizeSceneTemplate(input).style.layouts[0],original=structuredClone(l)
 for(const type of ['image','chart','table','text']){const next=changeSceneSlotType(l,l.slots[0].id,type,input.style.pageSize);assert.equal(next.elements[0].id,l.elements[0].id);assert.deepEqual(next.elements[0].frame,l.elements[0].frame);assert.equal(next.slots[0].type,type);normalizeSceneTemplate({...input,style:{...input.style,layouts:[next]}},{assets:{[VARIANT_PLACEHOLDER.id]:VARIANT_PLACEHOLDER}})}
 assert.deepEqual(l,original)
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
test('preview measures DOM overflow and restores hidden slide styles without shrinking text',async()=>{
 const editor=readFileSync('templates/panels/template-editor.js','utf8'),context=vm.createContext({languageOf:()=> 'ru'})
 const html=vm.runInContext(editor+'\ntplFitPreview("<body></body>",7)',context),script=/<script>([\s\S]*?)<\/script>/.exec(html)[1]
 let message,restored
 const frame=height=>({clientWidth:100,clientHeight:100,scrollHeight:height,scrollWidth:100,firstElementChild:{scrollHeight:height,scrollWidth:100}})
 const slide={getAttribute:()=> 'display:none',style:{setProperty:()=>{}},querySelectorAll:()=>[frame(90),frame(160)],setAttribute:(key,value)=>restored=value}
 vm.runInNewContext(script,{document:{fonts:{ready:Promise.resolve()},querySelectorAll:()=>[slide]},parent:{postMessage:value=>message=value}})
 await new Promise(resolve=>setImmediate(resolve));assert.equal(message.count,1);assert.equal(message.checked,2);assert.equal(message.token,7);assert.equal(restored,'display:none')
 assert.ok(!script.includes('fontSize'))
})


test('preview fit script is inserted at the real body end, never into the presenter JavaScript string',()=>{
 const editor=readFileSync('templates/panels/template-editor.js','utf8'),context=vm.createContext({})
 const html='<html><body><script>const presenter="</body></html>";</script><div>Slide</div></body></html>'
 context.html=html
 const fixed=vm.runInContext(editor+'\ntplFitPreview(html,17)',context)
 assert.ok(fixed.includes('const presenter="</body></html>";</script>'))
 const scripts=[...fixed.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1])
 assert.equal(scripts.length,2);scripts.forEach(script=>new vm.Script(script))
 assert.ok(scripts[1].includes('token:17'))
})
