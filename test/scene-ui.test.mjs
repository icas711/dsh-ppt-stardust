import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {bundleClientModel} from '../scripts/bundle-client-model.mjs'
import {resolve} from 'node:path'
function render(elements,selected){
 let changed
 const context={React:{useState:()=>[selected,()=>{}]},h:(type,props,...children)=>({type,props:props??{},children:children.flat(Infinity)}),languageOf:()=> 'ru',elements,onChange:value=>changed=value}
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
