// Shared schema 3 template contract and addressable slot filling.
import {normalizeSceneSlide,SCENE_LIMITS} from './deck-model.mjs'
import {normalizeVariantDescription} from './deck-generation.mjs'
const clone=value=>JSON.parse(JSON.stringify(value))
function fail(code,path,message){const e=new Error(`dsh-ppt: ${code} at ${path}: ${message}`);e.code=code;e.path=path;throw e}
const id=(x,p)=>{if(typeof x!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(x))fail('invalid-id',p,'Expected stable ID');return x}
export function normalizeSceneTemplate(input,{assets}={}){
 if(!input||input.schemaVersion!==3)fail('template-schema','schemaVersion','Expected schema 3')
 const out=clone(input)
 for(const key of Object.keys(out))if(!['schemaVersion','id','name','description','author','revision','createdAt','updatedAt','style','assetMap'].includes(key))fail('unknown-field',key,'Unknown scene template field')
 for(const key of Object.keys(out.style??{}))if(!['theme','pageSize','themeFonts','fonts','textStyles','brand','layouts'].includes(key))fail('unknown-field','style.'+key,'Unknown scene style field')
 if(out.style?.backgrounds||out.style?.layouts?.some(l=>Object.hasOwn(l,'textZones')||Object.hasOwn(l,'images')||Object.hasOwn(l,'background')))fail('mixed-template-layout','style.layouts','Scene templates cannot carry legacy layout fields')
 if(!Array.isArray(out.style?.layouts)||!out.style.layouts.length||out.style.layouts.length>120)fail('layout-limit','style.layouts','Expected 1–120 layouts')
 const bag=assets??Object.fromEntries(Object.entries(out.assetMap??{}).map(([key,v])=>[key,{mime:v.mime,width:v.width,height:v.height}]))
 let total=0;const seen=new Set()
 out.style.layouts=out.style.layouts.map((l,i)=>{
  const path=`style.layouts[${i}]`;id(l.id,path+'.id');if(seen.has(l.id))fail('duplicate-layout',path,l.id);seen.add(l.id)
  if(Object.keys(l).some(k=>!['id','name','familyId','purpose','backgroundColor','backgroundAssetId','elements','slots','description'].includes(k)))fail('unknown-field',path,'Unknown layout field')
  const normalized=normalizeSceneSlide({layout:'scene',purpose:l.purpose??'content',elements:l.elements,...(l.backgroundColor?{backgroundColor:l.backgroundColor}:{}),...(l.backgroundAssetId?{backgroundAssetId:l.backgroundAssetId}:{})},{assets:bag,path})
  total+=normalized.elements.length;if(total>SCENE_LIMITS.projectElements)fail('project-element-limit',path,'Template exceeds 8192 objects')
  if(!Array.isArray(l.slots)||l.slots.length>256)fail('slot-limit',path+'.slots','Expected 0–256 slots')
  const slots=new Set(),targets=new Set()
  const clean=l.slots.map((slot,j)=>{
   const at=path+`.slots[${j}]`;id(slot.id,at);if(slots.has(slot.id))fail('duplicate-slot',at,slot.id);slots.add(slot.id)
   if(Object.keys(slot).some(k=>!['id','elementId','type','name','required','maxCharacters'].includes(k)))fail('unknown-field',at,'Unknown slot field')
   const target=normalized.elements.find(e=>e.id===slot.elementId)
   if(!target||!['text','image','table','chart'].includes(slot.type)||target.type!==slot.type||targets.has(target.id))fail('invalid-slot',at,'Slot must target one distinct object of the same type')
   targets.add(target.id)
   if(slot.maxCharacters!==undefined&&(!Number.isInteger(slot.maxCharacters)||slot.maxCharacters<1||slot.maxCharacters>262144))fail('slot-limit',at,'Invalid character limit')
   if(slot.required!==undefined&&typeof slot.required!=='boolean')fail('invalid-slot',at,'required must be boolean')
   if(slot.name!==undefined&&(typeof slot.name!=='string'||slot.name.length>1024))fail('invalid-slot',at,'Invalid slot name')
   return {...slot}
  })
  const layout={id:l.id,name:l.name??l.id,...(l.familyId?{familyId:id(l.familyId,path+'.familyId')}:{}),purpose:normalized.purpose,...(normalized.backgroundColor?{backgroundColor:normalized.backgroundColor}:{}),...(normalized.backgroundAssetId?{backgroundAssetId:normalized.backgroundAssetId}:{}),elements:normalized.elements,slots:clean}
  layout.description=normalizeVariantDescription(l.description,layout,out.style.pageSize)
  return layout
 })
 for(const [key,a]of Object.entries(out.assetMap??{})){
  id(key,'assetMap');if(!a||Object.keys(a).some(k=>!['file','mime','width','height'].includes(k))||!/^[-a-zA-Z0-9_.]+\.(png|jpe?g)$/.test(a.file)||!['image/png','image/jpeg'].includes(a.mime)||!Number.isInteger(a.width)||a.width<1||!Number.isInteger(a.height)||a.height<1)fail('template-asset','assetMap.'+key,'Only safe raster references are allowed')
 }
 return out
}
/** A value addresses a slot ID. No positional bullet distribution. */
export function fillSceneLayout(layout,values={}, {assets={},slideId='scene',label}={}){
 if(!values||typeof values!=='object'||Array.isArray(values))fail('slot-values','values','Expected object keyed by slot ID')
 const elements=clone(layout.elements),diagnostics=[]
 for(const key of Object.keys(values))if(!layout.slots.some(s=>s.id===key))fail('unknown-slot','values.'+key,'No matching slot')
 for(const slot of layout.slots){
  const e=elements.find(e=>e.id===slot.elementId),value=values[slot.id]
  if(value===undefined){if(slot.required)diagnostics.push({code:'template-unfilled',slotId:slot.id,elementId:e.id});continue}
  if(slot.type==='text'){
   if(typeof value==='string'){
    if(slot.maxCharacters&&value.length>slot.maxCharacters)fail('slot-text-limit','values.'+slot.id,'Text exceeds slot limit')
    const style=e.paragraphs[0]?.runs.find(r=>!r.break)?.style
    e.paragraphs=value.split('\n').map(text=>({...(e.paragraphs[0]?.style?{style:e.paragraphs[0].style}:{}),runs:[{text,...(style?{style}: {})}]}))
   }else if(Array.isArray(value))e.paragraphs=clone(value)
   else fail('slot-type','values.'+slot.id,'Text slot expects a string or paragraphs')
   if(slot.maxCharacters && e.paragraphs.reduce((sum,p)=>sum+p.runs.reduce((n,r)=>n+(r.text?.length??0),0),0)>slot.maxCharacters)fail('slot-text-limit','values.'+slot.id,'Text exceeds slot limit')
  }else if(slot.type==='image'){
   if(typeof value!=='string')fail('slot-type','values.'+slot.id,'Image slot expects an asset ID');e.assetId=value;e.alt=''
  }else e[slot.type]=clone(value)
  e.slotId=slot.id
 }
 return {slide:normalizeSceneSlide({id:slideId,layout:'scene',designLayout:layout.id,label:label??layout.name,purpose:layout.purpose,...(layout.backgroundColor?{backgroundColor:layout.backgroundColor}:{}),...(layout.backgroundAssetId?{backgroundAssetId:layout.backgroundAssetId}:{}),elements},{assets}),diagnostics}
}
/** Match stable slots only; preserve unmatched old content and report it. */
export function remapSceneLayout(slide,from,to,{assets={}}={}){
 const values={},unmatched=[]
 for(const old of from.slots){const e=slide.elements.find(e=>e.slotId===old.id||e.id===old.elementId);if(!e)continue;const target=to.slots.find(s=>s.id===old.id&&s.type===old.type);if(target)values[target.id]=e.type==='text'?e.paragraphs:e.type==='image'?e.assetId:e[e.type];else unmatched.push(e)}
 const filled=fillSceneLayout(to,values,{assets,slideId:slide.id,label:slide.label})
 const ids=new Set(filled.slide.elements.map(e=>e.id))
 for(const e of unmatched){const copy=clone(e);let suffix=1;while(ids.has(copy.id))copy.id=e.id+'-preserved-'+suffix++;ids.add(copy.id);delete copy.slotId;copy.support={mode:'lossy',reason:'Content preserved outside matched slots; review its placement'};filled.slide.elements.push(copy);filled.diagnostics.push({code:'unmapped-content-preserved',elementId:copy.id})}
 filled.slide=normalizeSceneSlide(filled.slide,{assets})
 return filled
}
