// Content-only ordinary visuals for normal ppt_create, using the shared compositor.
import {createHash} from 'node:crypto'
import {generationSpecSchema,validateGenerationSpec} from './deck-generation-spec.mjs'
import {sceneImageBytes} from './deck-scene-pptx.mjs'
import {GENERATION_ICON_IDS} from './deck-generation-compose.mjs'
import {composeTemplateContent,contentSourcesSchema,validContentSources} from './deck-content-create.mjs'

export const VISUAL_CREATE_TYPES=Object.freeze(['cards','process','timeline','comparison','big_number','chart','table','image'])

const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)
const only=(v,keys)=>plain(v)&&Object.keys(v).every(k=>keys.includes(k))
function fail(message,diagnostics=[]){const e=new Error('dsh-ppt: visualSpec: '+message);e.code='visual-spec';e.diagnostics=diagnostics;throw e}
export function visualCreateSchema(){
  const slide=generationSpecSchema().properties.slides.items.properties
  const alternatives=slide.visual.oneOf.filter(v=>VISUAL_CREATE_TYPES.includes(v.properties.type.const))
  alternatives.find(v=>v.properties.type.const==='cards').properties.items.items.properties.iconId={enum:[...GENERATION_ICON_IDS]}
  return {type:'object',additionalProperties:false,required:['version','mode','sources','slides'],properties:{
    version:{const:1},mode:{enum:['factual','demo']},allowMoreSlides:{type:'boolean'},
    contentHash:{type:'string',pattern:'^[a-f0-9]{64}$',description:'Optional verified content hash. Preserve a supplied hash; never recompute it to accept changed data.'},
    sources:contentSourcesSchema(),
    assets:{type:'array',minItems:1,maxItems:16,items:{type:'object',additionalProperties:false,required:['id','mime','width','height','data'],properties:{id:slide.id,mime:{enum:['image/png','image/jpeg']},width:{type:'integer',minimum:1,maximum:16000},height:{type:'integer',minimum:1,maximum:16000},data:{type:'string',minLength:1,maxLength:7340032,pattern:'^data:image/(png|jpeg);base64,[A-Za-z0-9+/=]+$'}}}},
    slides:{type:'array',minItems:1,maxItems:120,items:{type:'object',additionalProperties:false,required:['id','title','visual'],properties:{id:slide.id,title:slide.title,notes:slide.notes,designLayout:slide.designLayout,visual:{oneOf:alternatives}}}}
  }}
}
const canonical=v=>Array.isArray(v)?v.map(canonical):plain(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v
export function visualCreateContentHash(value){
  const payload={mode:value.mode,sources:value.sources.map(s=>({id:s.id,text:s.text,synthetic:s.synthetic??false})),slides:value.slides.map(s=>({id:s.id,title:s.title,visual:s.visual,notes:s.notes??null}))}
  if(value.assets!==undefined)payload.assets=value.assets.map(({id,mime,width,height,data})=>({id,mime,width,height,sha256:createHash('sha256').update(sceneImageBytes({mime,width,height,data},id)).digest('hex')}))
  return createHash('sha256').update(JSON.stringify(canonical(payload)),'utf8').digest('hex')
}
export function composeVisualCreate(value,{title,lang,template,maxSlides=120,signal}={}){
  signal?.throwIfAborted()
  if(!only(value,['version','mode','sources','slides','allowMoreSlides','contentHash','assets'])||value.version!==1||!['factual','demo'].includes(value.mode)||(value.allowMoreSlides!==undefined&&typeof value.allowMoreSlides!=='boolean'))fail('Expected version:1, mode:factual|demo, sources, slides and optional allowMoreSlides:boolean, contentHash:string')
  if(!validContentSources(value.sources))fail('Provide 1–64 source records {id,text,synthetic?} with valid source IDs')
  if(!Array.isArray(value.slides)||value.slides.length<1||value.slides.length>120||value.slides.some(s=>!only(s,['id','title','visual','notes','designLayout'])||!VISUAL_CREATE_TYPES.includes(s.visual?.type)))fail(`Provide 1–120 content slides with id, title and visual:${VISUAL_CREATE_TYPES.join('|')}; coordinates, styles and other visual types are not supported`)
  const spec={version:1,title,lang,mode:value.mode,slides:value.slides.map(s=>({...structuredClone(s),purpose:'content'}))}
  const assets={},seen=new Set();let total=0
  if(value.assets!==undefined){
    if(!Array.isArray(value.assets)||value.assets.length<1||value.assets.length>16)fail('Provide 1–16 embedded PNG/JPEG assets')
    for(const asset of value.assets){
      if(!only(asset,['id','mime','width','height','data'])||typeof asset.id!=='string'||asset.id.length>128||!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(asset.id)||seen.has(asset.id)||!Number.isSafeInteger(asset.width)||!Number.isSafeInteger(asset.height))fail('Asset IDs must be valid and unique; dimensions must be integers')
      const bytes=sceneImageBytes(asset,asset.id);total+=bytes.length
      if(total>8*1024*1024)fail('Content images exceed 8 MiB in total')
      seen.add(asset.id);Object.defineProperty(assets,asset.id,{value:{mime:asset.mime,width:asset.width,height:asset.height,data:asset.data},enumerable:true})
    }
  }
  const context={sources:structuredClone(value.sources),iconIds:[...GENERATION_ICON_IDS],assetIds:Object.keys(assets)}
  const checked=validateGenerationSpec(spec,context)
  if(!checked.valid)fail(checked.diagnostics.map(d=>`${d.path}: ${d.message}`).join('; '),checked.diagnostics)
  if(value.contentHash!==undefined&&(typeof value.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(value.contentHash)||value.contentHash!==visualCreateContentHash(value)))fail('Content hash mismatch: use the original verified input; do not replace its hash')
  return composeTemplateContent(spec,{template,context,assets,allowMoreSlides:value.allowMoreSlides===true,maxSlides,signal})
}
