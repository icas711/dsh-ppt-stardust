import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {bundleClientModel} from '../scripts/bundle-client-model.mjs'
import {resolve} from 'node:path'
function render(elements,selected){
 let changed
 const context={React:{useState:()=>[selected,()=>{}],useRef:value=>({current:value}),useEffect:()=>{}},h:(type,props,...children)=>({type,props:props??{},children:children.flat(Infinity)}),languageOf:()=> 'ru',elements,onChange:value=>changed=value}
 const source=readFileSync(new URL('../templates/panels/scene-objects.js',import.meta.url),'utf8')
 const tree=runInNewContext(source+'\nPptSceneObjects({elements,onChange,disabled:false})',context)
 const all=[];const walk=node=>{if(!node||typeof node!=='object')return;all.push(node);node.children?.forEach(walk)};walk(tree)
 return {all,get changed(){return JSON.parse(JSON.stringify(changed))}}
}
test('object inspector edits one run without flattening styles, breaks or independent text blocks',()=>{
 const frame={x:0,y:0,w:1000000,h:1000000},elements=[{id:'a',type:'text',frame,paragraphs:[{style:{align:'right'},runs:[{text:'Red',style:{bold:true,color:'#CC0000'}},{break:true},{text:'Second',style:{italic:true}}]}]},{id:'b',type:'text',frame,paragraphs:[{runs:[{text:'Keep'}]}]}]
 const ui=render(elements,'a'),input=ui.all.filter(n=>n.type==='textarea')[1]
 input.props.onChange({target:{value:'Changed'}})
 assert.equal(ui.changed[0].paragraphs[0].runs[2].text,'Changed')
 assert.deepEqual(ui.changed[0].paragraphs[0].runs[0],elements[0].paragraphs[0].runs[0])
 assert.deepEqual(ui.changed[0].paragraphs[0].runs[1],{break:true})
 assert.equal(ui.changed[0].paragraphs[0].style.align,'right');assert.deepEqual(ui.changed[1],elements[1])
})
test('object inspector changes chart data by category and keeps the other series',()=>{
 const e={id:'chart',type:'chart',frame:{x:0,y:0,w:1000000,h:1000000},chart:{kind:'column',categories:['A','B'],series:[{name:'Actual',values:[12,8]},{name:'Plan',values:[10,6]}]}}
 const ui=render([e],'chart'),input=ui.all.find(n=>n.type==='input'&&n.props.type==='number'&&n.props.value===12)
 input.props.onChange({target:{value:'18'}})
 assert.deepEqual(ui.changed[0].chart.series[0].values,[18,8]);assert.deepEqual(ui.changed[0].chart.series[1],e.chart.series[1])
})
test('schema 3 template editor roundtrips through the actual shared browser graph',()=>{
 const graph=bundleClientModel(resolve('skills/dsh-ppt/scripts'),'deck-client-model.mjs')
 const input={schemaVersion:3,id:'scene-test',name:'Test',revision:2,assetMap:{},style:{theme:'data',pageSize:{width:9906000,height:6858000},layouts:[{id:'layout-1',name:'Variant',familyId:'family-1',purpose:'content',elements:[{id:'text',type:'text',role:'content',frame:{x:1,y:1,w:1000000,h:1000000},paragraphs:[{runs:[{text:'Placeholder',style:{bold:true,color:'#CC0000'}}]}]}],slots:[{id:'slot-text',elementId:'text',type:'text',required:true}]}]}}
 const editor=readFileSync(new URL('../templates/panels/template-editor.js',import.meta.url),'utf8')
 const serialized=runInNewContext(graph+'\n'+editor+'\nJSON.stringify(tplBuild(tplDraftFrom(input),input))',{input,languageOf:()=> 'ru'})
 const out=JSON.parse(serialized)
 assert.equal(out.schemaVersion,3);assert.deepEqual(out.style.layouts[0].elements,input.style.layouts[0].elements);assert.deepEqual(out.style.layouts[0].slots,input.style.layouts[0].slots)
})

test('reloading a scene draft preserves unrelated remote object edits and additions',async()=>{
 const {mergeSceneDraftElements}=await import('../skills/dsh-ppt/scripts/deck-model.mjs')
 const old=[{id:'a',text:'Old A'},{id:'b',text:'Old B'}],draft=[{id:'a',text:'Local A'},old[1]],latest=[old[0],{id:'b',text:'Remote B'},{id:'c',text:'New C'}]
 const result=mergeSceneDraftElements(old,draft,latest)
 assert.deepEqual(result.elements,[draft[0],latest[1],latest[2]]);assert.deepEqual(result.conflicts,[])
 const conflict=mergeSceneDraftElements(old,draft,[{id:'a',text:'Remote A'},old[1]])
 assert.equal(conflict.conflicts.length,1);assert.equal(conflict.conflicts[0].id,'a');assert.equal(conflict.elements[0].text,'Local A')
})

test('cancelled scene image upload cannot replace the selected object after hashing completes',async()=>{
 let resolveDigest;const updates=[],pending=[],generation={current:0}
 const context={React:{useState:()=>['image',()=>{}],useRef:value=>({current:value}),useEffect:setup=>setup()},h:(type,props,...children)=>({type,props:props??{},children:children.flat(Infinity)}),languageOf:()=> 'ru',crypto:{subtle:{digest:()=>new Promise(resolve=>{resolveDigest=resolve})}},generation,onAsset:(...args)=>updates.push(args),onPending:value=>pending.push(value)}
 const source=readFileSync(new URL('../templates/panels/scene-objects.js',import.meta.url),'utf8')
 const tree=runInNewContext(source+`\nPptSceneObjects({elements:[{id:'image',type:'image',frame:{x:0,y:0,w:1,h:1},assetId:'old'}],onChange:()=>{},onAsset,onPending,uploadGeneration:generation})`,context)
 const all=[];const walk=n=>{if(n&&typeof n==='object'){all.push(n);n.children?.forEach(walk)}};walk(tree)
 const file={type:'image/png',size:100,arrayBuffer:async()=>new ArrayBuffer(100)}
 const task=all.find(n=>n.type==='input'&&n.props.type==='file').props.onChange({target:{files:[file]}})
 await new Promise(setImmediate);assert.equal(typeof resolveDigest,'function')
 generation.current++;pending.push(false);resolveDigest(new ArrayBuffer(32));await task
 assert.deepEqual(updates,[]);assert.deepEqual(pending,[true,false])
})
