import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {unzipSync,strFromU8} from 'fflate'
import {createPptExecutors} from '../lib/execution.js'
import {PptTemplateStore} from '../lib/templates.js'
import * as templates from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import * as engine from '../skills/dsh-ppt/scripts/deck-advanced.mjs'

const frame={x:500000,y:500000,w:7500000,h:600000}
const text=(id,value,y=500000)=>({id,type:'text',frame:{...frame,y},paragraphs:[{runs:[{text:value}]}]})
function fixture(){
 const reference=purpose=>({id:purpose,purpose,name:purpose,elements:[
  {id:'art',type:'shape',role:'decor',preset:'rect',frame:{x:0,y:0,w:100000,h:6000000},fill:{color:purpose==='cover'?'#FF0000':'#0000FF'}},
  {...text('heading','Sample heading'),textStyle:{fontFamily:'Arial',size:32,color:'#123456'}},
  {...text('body','Sample body',1500000),frame:{...frame,y:1500000,h:3500000},textStyle:{fontFamily:'Arial',size:18,color:'#234567'}}
 ],slots:[{id:'title',elementId:'heading',type:'text',required:true},{id:'body',elementId:'body',type:'text',required:true,maxCharacters:2}]})
 const template={schemaVersion:3,id:'free-compose',name:'Two references',revision:1,style:{pageSize:{width:9906000,height:6858000},layouts:[reference('cover'),reference('content')]},assetMap:{}}
 const slides=Array.from({length:11},(_,i)=>({layout:'scene',id:'page-'+i,purpose:i?'content':'cover',elements:[text('heading','Conclusion '+i),
  {id:'art',type:'shape',preset:'roundRect',frame:{x:400000,y:1400000,w:8000000,h:4000000},fill:{color:'#EEEEEE'}},
  text('detail-a','Evidence and explanation '+i,1600000),text('detail-b','Additional substantive material '+i,3000000),
  ...(i===1?[{id:'data',type:'chart',frame:{x:1000000,y:3800000,w:6000000,h:1800000},chart:{kind:'column',categories:['A','B'],series:[{name:'Values',values:[12,8]}]}}]:[])
 ]}))
 return {template,slides}
}

test('two references allow eleven freely composed slides without slot limits or sample content',()=>{
 const {template,slides}=fixture(),before=structuredClone({template,slides})
 const {create}=templates.templateCreateOptions(template,{}, {title:'Composition',slides})
 assert.equal(create.slides.length,11);assert.equal(create.generation,undefined)
 create.slides.forEach((s,i)=>{
  assert.equal(s.designLayout,i?'content':'cover');assert.equal(s.elements.length,i===1?6:5)
  assert.equal(s.elements[0].fill.color,i?'#0000FF':'#FF0000')
  assert.equal(new Set(s.elements.map(e=>e.id)).size,s.elements.length)
  assert.equal(s.elements.find(e=>e.id==='heading').textStyle.size,32)
  assert.equal(s.elements.find(e=>e.id==='detail-a').textStyle.size,18)
  assert.ok(!JSON.stringify(s).includes('Sample'))
 })
 assert.deepEqual(create.style.pageSize,template.style.pageSize)
 assert.deepEqual({template,slides},before)
 assert.throws(()=>templates.templateCreateOptions(template,{}, {title:'Bad',slides,deckPlan:[]}),/mutually exclusive/)
 const closing=templates.templateCreateOptions(template,{}, {title:'End',slides:[{...slides[1],purpose:'closing'}]}).create.slides[0]
 assert.equal(closing.purpose,'closing');assert.equal(closing.designLayout,'content')
 assert.throws(()=>templates.templateCreateOptions(template,{}, {title:'Bad ref',slides:[{...slides[1],designLayout:'missing'}]}),/No reference/)
})

test('real tool exports all free content, fixed artwork and editable chart from a two-page template',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'free-composition-'));t.after(()=>rmSync(dir,{recursive:true,force:true}))
 const {template,slides}=fixture(),identity={login:'composition-user',admin:false,local:false}
 const store=new PptTemplateStore({root:join(dir,'library'),templatesModuleLoader:async()=>templates,admins:[]})
 await store.save({manifest:template,assets:{},identity})
 const tools=createPptExecutors({outputDir:dir,maxSlides:60,defaultTheme:'data',defaultLang:'en',admins:[]},async()=>engine,{templateStore:store})
 const made=await tools.create({title:'Free composition',templateId:'user:'+template.id,slides,lang:'en'}, {agent:{session:{header:{owner:identity.login}}}})
 assert.equal(made.slideCount,11)
 const saved=engine.readDeckProject({deckPath:made.jsonPath}).manifest
 assert.equal(saved.slides[10].elements[0].fill.color,'#0000FF')
 assert.equal(saved.slides[10].elements.find(e=>e.id==='detail-b').paragraphs[0].runs[0].text,'Additional substantive material 10')
 const parts=unzipSync(readFileSync(made.pptxPath)),xml=strFromU8(parts['ppt/slides/slide11.xml'])
 assert.ok(xml.includes('Evidence and explanation 10'));assert.ok(xml.includes('0000FF'));assert.ok(xml.includes('roundRect'))
 assert.ok(Object.keys(parts).some(k=>/^ppt\/charts\/chart\d+\.xml$/.test(k)))
 assert.deepEqual(saved.slides[1].elements.find(e=>e.id==='data').chart.series[0].values,[12,8])
})
