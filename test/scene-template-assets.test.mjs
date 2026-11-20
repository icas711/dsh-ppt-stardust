import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,writeFileSync,readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {PNG} from 'pngjs'
import * as engine from '../skills/dsh-ppt/scripts/deck-advanced.mjs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate'
import {PptTemplateStore} from '../lib/templates.js'
import {PptWorkbench} from '../lib/workbench.js'
import * as templates from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import {fixtures} from './fixtures/pptx/generate.mjs'

const identity={login:'scene-assets-user',admin:false,local:false}

test('unused scene layout backgrounds survive creation, edits, history-only retention and undo',async t=>{
 const root=mkdtempSync(join(tmpdir(),'layout-background-'));t.after(()=>rmSync(root,{recursive:true,force:true}))
 function image(red){
  const png=new PNG({width:1,height:1});png.data.set([red,0,0,255]);const bytes=PNG.sync.write(png)
  return ['img-'+createHash('sha256').update(bytes).digest('hex'),{mime:'image/png',width:1,height:1,data:'data:image/png;base64,'+bytes.toString('base64')}]
 }
 const background=image(255),unused=image(64),pageSize={width:9906000,height:6858000}
 const scene={layout:'scene',designLayout:'title',elements:[{id:'title',type:'text',frame:{x:100000,y:100000,w:4000000,h:500000},paragraphs:[{runs:[{text:'Title'}]}]}]}
 const style={pageSize,sceneLayouts:[{id:'title',purpose:'content',elements:[],slots:[]},{id:'body',purpose:'content',backgroundAssetId:background[0],elements:[],slots:[]}]}
 const made=await engine.buildDeckAsync({title:'Preserved background',outputDir:root,slides:[scene],style,assets:Object.fromEntries([background,unused])})
 const saved=()=>JSON.parse(readFileSync(made.jsonPath,'utf8'))
 assert.deepEqual(saved().assets[background[0]],background[1]);assert.equal(saved().assets[unused[0]],undefined)
 assert.equal(engine.checkDeck({deckPath:made.jsonPath}).revision,0)
 await engine.editDeck({deckPath:made.jsonPath,expectedRevision:0,edits:[{slide:1,patch:{label:'Changed'}}]})
 assert.equal(engine.checkDeck({deckPath:made.jsonPath}).revision,1)
 // The background is now referenced ONLY by undo snapshots, not current slides/style.
 await engine.editDeck({deckPath:made.jsonPath,expectedRevision:1,style:{pageSize}})
 assert.equal(saved().style.sceneLayouts,undefined)
 assert.deepEqual(saved().assets[background[0]],background[1])
 assert.equal(engine.checkDeck({deckPath:made.jsonPath}).revision,2)
 await engine.undoDeck({deckPath:made.jsonPath,expectedRevision:2})
 assert.equal(saved().style.sceneLayouts[1].backgroundAssetId,background[0])
 assert.deepEqual(saved().assets[background[0]],background[1])
 assert.equal(engine.checkDeck({deckPath:made.jsonPath}).revision,3)
})
test('panel PPTX upload retains scene images through font binding, draft save, preview and ZIP export',async t=>{
 const root=mkdtempSync(join(tmpdir(),'scene-template-assets-'));t.after(()=>rmSync(root,{recursive:true,force:true}))
 const store=new PptTemplateStore({root:join(root,'library'),templatesModuleLoader:async()=>templates})
 const wb=new PptWorkbench({catalogPath:join(root,'catalog.jsonl')});wb.attachTemplateStore(store)
 const source=fixtures().find(f=>f.id==='artwork').bytes
 const expected=await templates.templateFromPptxScene(source,{templateId:'image-template',name:'Images'})
 assert.ok(Object.keys(expected.manifest.assetMap).length>0)
 const request=new Request('http://localhost/api/dsh-ppt/template-upload?templateId=image-template&name=Images',{method:'POST',headers:{'x-dsh-ppt-action':'1'},body:source})
 const response=await wb.fetchTemplateUpload(request,identity),result=await response.json()
 assert.equal(response.status,200,JSON.stringify(result))
 assert.equal(result.key,'user:image-template')
 const saved=await store.get(result.key,identity)
 assert.ok(saved.manifest.style.layouts.flatMap(l=>l.slots).filter(s=>s.type==='text').every(s=>s.required===false))
 for(const a of Object.values(saved.manifest.assetMap))assert.deepEqual(saved.assets[a.file].bytes,expected.assets[a.file].bytes)
 const edited=await store.saveDraft({manifest:{...saved.manifest,name:'Edited images'},baseKey:saved.key,expectedRevision:saved.manifest.revision,identity})
 const preview=await store.previewOptions({manifest:edited.manifest,baseKey:edited.key,identity})
 assert.equal(preview.slides.length,edited.manifest.style.layouts.length)
 assert.ok(Object.keys(preview.assets).length>0)
 const path=join(root,'roundtrip.zip');writeFileSync(path,templates.buildTemplateBundle(edited.manifest,edited.assets))
 const bundle=templates.readTemplateBundle(path)
 for(const a of Object.values(bundle.manifest.assetMap))assert.deepEqual(bundle.assets[a.file].bytes,expected.assets[a.file].bytes)
 // Deleting the image references still removes their bytes; unrelated uploads stay out.
 const draft=structuredClone(edited.manifest);draft.assetMap={}
 for(const layout of draft.style.layouts){delete layout.backgroundAssetId;layout.elements=layout.elements.filter(e=>!e.assetId&&!e.previewAssetId);layout.slots=layout.slots.filter(s=>layout.elements.some(e=>e.id===s.elementId))}
 const cleared=await store.saveDraft({manifest:draft,baseKey:edited.key,uploads:expected.assets,identity})
 assert.deepEqual(Object.keys(cleared.assets),[])
})
test('scene draft save still rejects genuinely missing raster bytes',async t=>{
 const root=mkdtempSync(join(tmpdir(),'scene-template-missing-'));t.after(()=>rmSync(root,{recursive:true,force:true}))
 const store=new PptTemplateStore({root,templatesModuleLoader:async()=>templates})
 const source=await templates.templateFromPptxScene(fixtures().find(f=>f.id==='artwork').bytes,{templateId:'missing-image',name:'Missing'})
 await assert.rejects(store.saveDraft({manifest:source.manifest,identity}),/Missing scene asset/)
})


test('scene import reports actual groups, images, backgrounds and invisible fields; a save-subset flag is not an embedded font',async()=>{
 const source=fixtures().find(f=>f.id==='artwork').bytes,parts=unzipSync(source)
 const field=(id,w,text)=>'<p:sp><p:nvSpPr><p:cNvPr id="'+id+'" name="Page field '+id+'"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="100000" y="100000"/><a:ext cx="'+w+'" cy="200000"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:fld id="{11111111-1111-1111-1111-111111111111}" type="slidenum"><a:rPr sz="1000"/><a:t>'+text+'</a:t></a:fld></a:p></p:txBody></p:sp>'
 parts['ppt/slides/slide1.xml']=strToU8(strFromU8(parts['ppt/slides/slide1.xml']).replace('</p:spTree>',field(900,0,'1')+field(901,300000,'1')+'</p:spTree>'))
 parts['ppt/presentation.xml']=strToU8(strFromU8(parts['ppt/presentation.xml']).replace('<p:presentation ','<p:presentation saveSubsetFonts="1" '))
 const r=await templates.templateFromPptxScene(zipSync(parts),{templateId:'stats-fields',name:'Stats'})
 assert.equal(r.report.layouts,new Set(r.manifest.style.layouts.map(l=>l.familyId)).size)
 assert.equal(r.report.layoutVariants,r.manifest.style.layouts.length)
 assert.ok(r.report.layoutStats.images>0);assert.ok(r.report.layoutStats.backgrounds>0)
 assert.equal(r.report.slide.adapted,false)
 assert.ok(r.report.skippedObjects.some(o=>o.name==='Page field 900'&&o.reason.includes('нулевой')))
 assert.ok(!r.report.objects.some(o=>o.mode==='unsupported'&&o.reason?.includes('invalid-number')))
 assert.equal(r.report.fonts.embedded,0);assert.ok(!r.report.warnings.some(w=>typeof w==='string'&&w.includes('подмножества')))
 assert.equal(r.manifest.style.layouts[0].elements.find(e=>e.name==='Page field 901').role,'decor')
 assert.ok(!r.manifest.style.layouts[0].slots.some(s=>s.name==='Page field 901'))
})
