// Node-only experimental preparation. Profiles contain no sample prose or asset bytes.
import {createHash} from 'node:crypto'
import {readFileSync,statSync} from 'node:fs'
import {performance} from 'node:perf_hooks'
import {validateTemplateManifest,templateFromPptxScene} from './deck-templates.mjs'
import {PPTX_SCENE_IMPORTER_VERSION} from './deck-pptx-scenes.mjs'
import {compositionGuides} from './deck-template-guides.mjs'
import {resolveSceneReference} from './deck-template-scene.mjs'
import {pageSize} from './deck-page.mjs'
import {transformedBounds} from './deck-geometry.mjs'
import {mergeSceneTextStyles} from './deck-model.mjs'
import {sceneTextColor} from './deck-scene-color.mjs'

export const GENERATION_PROFILE_VERSION = 1
const clone=value=>JSON.parse(JSON.stringify(value))
const hash=value=>createHash('sha256').update(value).digest('hex')
const purposes=['cover','content','section','closing']
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
function canonical(value){
  if(Array.isArray(value))return '['+value.map(v=>canonical(v??null)).join(',')+']'
  if(plain(value))return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}'
  return value===undefined?'undefined':JSON.stringify(value)
}
function error(code,path,message,extra={}){return {severity:'error',code,path,message,...extra}}
function union(frames){
  if(!frames.length)return null
  const x=Math.min(...frames.map(f=>f.x)),y=Math.min(...frames.map(f=>f.y))
  return {x,y,w:Math.max(...frames.map(f=>f.x+f.w))-x,h:Math.max(...frames.map(f=>f.y+f.h))-y}
}
function firstStyle(element){
  const run=element?.paragraphs?.flatMap(p=>p.runs).find(r=>!r.break&&r.text?.trim())??element?.paragraphs?.flatMap(p=>p.runs).find(r=>!r.break)
  return mergeSceneTextStyles(element?.textStyle,run?.style)
}

/** No import/research/render occurs here. Actual bytes are validated by the existing importer contract. */
export function buildGenerationTemplateProfile(manifest,{assets={},importReport,importerVersion=PPTX_SCENE_IMPORTER_VERSION}={}){
  const diagnostics=[]
  if(manifest?.schemaVersion!==3)return {valid:false,profile:null,diagnostics:[error('profile-schema','template.schemaVersion','Import the PPTX as a schema 3 scene template first')]}
  if(!plain(assets))return {valid:false,profile:null,diagnostics:[error('profile-assets','assets','Supply a file-keyed asset registry, including bytes')]}
  if(!Number.isSafeInteger(importerVersion)||importerVersion<1)return {valid:false,profile:null,diagnostics:[error('profile-version','importerVersion','Expected a positive importer version')]}
  let normalized
  try{normalized=validateTemplateManifest(manifest,{templateAssets:assets})}
  catch(e){return {valid:false,profile:null,diagnostics:[error('profile-template',e.path??'template',e.message)]}}
  const size=pageSize(normalized),style=normalized.style
  const add=(severity,code,path,message,extra={})=>diagnostics.push({severity,code,path,message,...extra})
  const palette=new Set(),fontFamilies=new Set()
  const color=value=>{if(/^#[a-f0-9]{6}$/i.test(value??''))palette.add(value.toUpperCase())}
  const typography=value=>{
    if(value.fontFamily)fontFamilies.add(value.fontFamily)
    if(value.sourceTypeface&&!value.sourceTypeface.startsWith('+'))fontFamilies.add(value.sourceTypeface)
    for(const family of Object.values(value.scriptFonts??{}))if(family)fontFamilies.add(family)
    color(sceneTextColor(value).color)
  }
  Object.values(style.brand??{}).forEach(color)
  Object.values(style.themeFonts??{}).filter(Boolean).forEach(f=>fontFamilies.add(f))
  for(const face of style.fonts??[])fontFamilies.add(face.family)
  Object.values(style.textStyles??{}).forEach(typography)
  const layouts=style.layouts.map((layout,index)=>{
    const at=`template.style.layouts[${index}]`,slots=new Set(layout.slots.map(s=>s.elementId))
    // Mirror the existing composition rule: fixed artwork excludes addressed slots.
    const fixed=layout.elements.filter(e=>e.role==='decor'&&!slots.has(e.id))
    const visible=layout.elements.filter(e=>!e.hidden)
    const texts=visible.filter(e=>e.type==='text'&&e.role!=='decor')
    const heading=[...texts].sort((a,b)=>a.frame.y-b.frame.y)[0]
    const body=[...texts].sort((a,b)=>b.frame.w*b.frame.h-a.frame.w*a.frame.h)[0]
    const guides=compositionGuides({...layout,elements:visible},size)
    const regionElements=visible.filter(e=>e.role!=='decor'&&e.type!=='group')
    const fonts={title:mergeSceneTextStyles(firstStyle(heading),style.textStyles?.title),body:mergeSceneTextStyles(firstStyle(body),style.textStyles?.body)}
    Object.values(fonts).forEach(typography)
    color(layout.backgroundColor)
    for(const element of layout.elements){
      const path=at+'.elements['+layout.elements.indexOf(element)+']',extra={layoutId:layout.id,elementId:element.id}
      if(element.type==='text'){
        typography(element.textStyle??{})
        for(const p of element.paragraphs)for(const r of p.runs)typography(r.style??{})
      }
      color(element.fill?.color);color(element.stroke?.color)
      if(element.type==='group')continue // Child transforms are already final in scene.
      const bounds=transformedBounds(element.frame,element.transform)
      if(!element.hidden&&(bounds.x<0||bounds.y<0||bounds.x+bounds.w>size.width||bounds.y+bounds.h>size.height))add('warning','reference-outside-page',path,'Reference extends outside the physical page; inspect clipping',extra)
      const retained=fixed.includes(element)&&!element.hidden
      if(element.type==='unsupported')add(retained&&!element.previewAssetId?'error':'warning',retained?'artwork-unsupported':'sample-unsupported',path,element.reason,{...extra,previewAvailable:!!element.previewAssetId})
      else if(element.support&&element.support.mode!=='native')add(retained&&element.support.mode==='unsupported'?'error':'warning','reference-'+element.support.mode,path,element.support.reason??'Import limitation',extra)
    }
    if(!heading)add('warning','title-guide-missing',at,'No visible title text reference; component defaults will require review',{layoutId:layout.id})
    if(!regionElements.length)add('warning','content-guide-missing',at,'No sample content geometry; placement must use artwork-aware defaults',{layoutId:layout.id})
    if(Object.values(fonts).some(s=>['fontFamily','size','color'].some(key=>s[key]===undefined)))add('warning','typography-incomplete',at,'Reference does not specify complete title/body styling',{layoutId:layout.id})
    if(layout.backgroundAssetId)add('warning','background-content-unverified',at+'.backgroundAssetId','Raster background is preserved; embedded lettering and safe placement require inspection',{layoutId:layout.id})
    return {id:layout.id,name:layout.name,purpose:layout.purpose,
      ...(layout.backgroundColor?{backgroundColor:layout.backgroundColor}:{}),...(layout.backgroundAssetId?{backgroundAssetId:layout.backgroundAssetId}:{}),
      typography:fonts,compositionGuides:guides,
      contentReferenceBounds:union(regionElements.map(e=>transformedBounds(e.frame,e.transform))),
      fixedArtwork:fixed.map(e=>({id:e.id,type:e.type,frame:clone(e.frame),bounds:transformedBounds(e.frame,e.transform),
        ...(e.hidden?{hidden:true}:{}),...(e.transform?{transform:clone(e.transform)}:{}),
        ...(e.assetId?{assetId:e.assetId}:{}),...(e.previewAssetId?{previewAssetId:e.previewAssetId}:{}),
        ...(e.type==='group'?{children:e.children.filter(id=>fixed.some(child=>child.id===id))}:{}),...(e.support?{support:clone(e.support)}:{})}))}
  })
  if(importReport!==undefined){
    if(!plain(importReport)||!['objects','warnings'].every(k=>importReport[k]===undefined||Array.isArray(importReport[k])))add('error','import-report','importReport','Expected importer objects/warnings arrays')
    else{
      for(const [i,w]of (importReport.warnings??[]).entries())add(w?.code==='background-unsupported'?'error':'warning','import-'+(w?.code??'warning'),`importReport.warnings[${i}]`,typeof w==='string'?w:String(w?.reason??w?.message??'Importer warning'),w?.slide?{slide:w.slide}:{})
      // Some ignored/lost objects have no corresponding scene object at all.
      const known=new Set(style.layouts.flatMap(l=>l.elements.filter(e=>e.type==='unsupported'||e.support?.mode&&e.support.mode!=='native').map(e=>e.id)))
      for(const [i,o]of (importReport.objects??[]).entries())if(o&&o.mode!=='native'&&!known.has(o.elementId))add(o.mode==='unsupported'?'error':o.mode==='ignored'?'info':'warning','import-object-'+o.mode,`importReport.objects[${i}]`,String(o.reason??'Importer object limitation'),{...(o.elementId?{elementId:o.elementId}:{}),...(o.slide?{slide:o.slide}:{})})
    }
  }else add('warning','import-history-unavailable','importReport','No import report supplied; losses absent from the scene cannot be assessed')
  const defaultReferences=Object.fromEntries(purposes.map(purpose=>{
    try{return [purpose,resolveSceneReference({purpose},style.layouts).id]}catch{return [purpose,null]}
  }))
  if(!defaultReferences.cover)add('warning','cover-reference-required','template.style.layouts','No automatic cover reference; explicitly choose an existing designLayout for a cover')
  if(!defaultReferences.content)add('warning','content-reference-required','template.style.layouts','No content reference; explicit designLayout is required for unmatched purposes')
  const embedded=style.fonts??[]
  const profile={version:GENERATION_PROFILE_VERSION,importerVersion,template:{id:normalized.id,name:normalized.name,revision:normalized.revision},
    pageSize:clone(size),theme:style.theme,...(style.brand?{brand:clone(style.brand)}:{}),
    defaultReferences,palette:[...palette].sort(),themeFonts:clone(style.themeFonts??{}),
    fonts:[...fontFamilies].sort().map(family=>({family,availability:'not-verified',embeddedVariants:embedded.filter(f=>f.family.toLowerCase()===family.toLowerCase()).map(f=>f.variant)})),
    layouts,limits:{visualAcceptance:'not-verified',safeAreas:'reference-only',fidelity:'import-limitations-apply'}}
  return {valid:!diagnostics.some(d=>d.severity==='error'),profile,diagnostics}
}

function cacheKey(bundle,scope,importerVersion,sourceHash){
  const files=new Set([...Object.values(bundle.manifest?.assetMap??{}).map(a=>a?.file),...(Array.isArray(bundle.manifest?.style?.fonts)?bundle.manifest.style.fonts:[]).map(f=>f?.file)].filter(f=>typeof f==='string'))
  const digests=[...files].sort().map(file=>[file,bundle.assets?.[file]?.bytes instanceof Uint8Array?hash(bundle.assets[file].bytes):null])
  return hash(canonical({version:GENERATION_PROFILE_VERSION,importerVersion,scope,sourceHash,manifest:bundle.manifest,assets:digests,report:bundle.report}))
}

/** Caller must authorize the template before use and supply a user/library scope.
 * Memory-only, bounded, cloned on return. Never caches the private source bytes.
 */
export function createGenerationProfileCache({maxEntries=16,maxBytes=8*1024*1024}={}){
  if(!Number.isSafeInteger(maxEntries)||maxEntries<1||!Number.isSafeInteger(maxBytes)||maxBytes<1)throw new Error('Positive cache limits required')
  const entries=new Map();let bytes=0
  return {
    get(key){const entry=entries.get(key);if(!entry)return null;entries.delete(key);entries.set(key,entry);return clone(entry.result)},
    set(key,result){
      const data=JSON.stringify(result),size=Buffer.byteLength(data)
      if(entries.has(key)){bytes-=entries.get(key).size;entries.delete(key)}
      if(size>maxBytes)return
      while(entries.size>=maxEntries||bytes+size>maxBytes){const first=entries.keys().next().value;bytes-=entries.get(first).size;entries.delete(first)}
      entries.set(key,{result:JSON.parse(data),size});bytes+=size
    },
    clear(){entries.clear();bytes=0},
    stats(){return {entries:entries.size,bytes,maxEntries,maxBytes}}
  }
}

export function prepareGenerationTemplateProfile(bundle,{scope,cache,importerVersion=PPTX_SCENE_IMPORTER_VERSION,sourceHash}={}){
  if(typeof scope!=='string'||!scope.trim()||scope.length>1024)throw new Error('Explicit authorized user/library scope is required')
  if(!plain(bundle))throw new Error('Expected an imported template bundle')
  const started=performance.now(),key=cacheKey(bundle,scope,importerVersion,sourceHash),hit=cache?.get(key)
  const result=hit??buildGenerationTemplateProfile(bundle.manifest,{assets:bundle.assets,importReport:bundle.report,importerVersion})
  if(!hit&&result.valid)cache?.set(key,result)
  return {...result,cache:{hit:!!hit,key},timings:{profileMs:performance.now()-started}}
}

/** Cold import is measured separately. Reuses existing PPTX importer unchanged. */
export async function prepareGenerationTemplateFromPptx(source,{scope,cache,templateId,name,signal}={}){
  const started=performance.now()
  signal?.throwIfAborted()
  if(typeof scope!=='string'||!scope.trim()||scope.length>1024)throw new Error('Explicit authorized user/library scope is required')
  if(!(source instanceof Uint8Array)&&statSync(source).size>64*1024*1024)throw new Error('PPTX exceeds 64 MiB')
  const bytes=source instanceof Uint8Array?source:readFileSync(source)
  if(bytes.length>64*1024*1024)throw new Error('PPTX exceeds 64 MiB')
  const sourceHash=hash(bytes),key=hash(canonical({kind:'pptx-profile',version:GENERATION_PROFILE_VERSION,importerVersion:PPTX_SCENE_IMPORTER_VERSION,scope,sourceHash,templateId,name})),hit=cache?.get(key)
  const sourceMs=performance.now()-started
  if(hit){signal?.throwIfAborted();return {...hit,cache:{hit:true,key},timings:{sourceMs,importMs:0,profileMs:0}}}
  const importStarted=performance.now(),bundle=await templateFromPptxScene(bytes,{templateId,name,signal}),importMs=performance.now()-importStarted
  const prepared=prepareGenerationTemplateProfile(bundle,{scope,sourceHash})
  const {cache:unused,timings,...result}=prepared
  if(result.valid)cache?.set(key,result)
  return {...result,cache:{hit:false,key},timings:{...timings,sourceMs,importMs}}
}
