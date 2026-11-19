import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {PptTemplateStore} from '../lib/templates.js'
import {PptWorkbench} from '../lib/workbench.js'
import * as templates from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import {fixtures} from './fixtures/pptx/generate.mjs'

const identity={login:'scene-assets-user',admin:false,local:false}
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
