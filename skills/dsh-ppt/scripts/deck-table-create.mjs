// Content-only entry point for normal ppt_create. No experiment or model calls.
import {generationSpecSchema,validateGenerationSpec} from './deck-generation-spec.mjs'
import {composeGenerationSpec} from './deck-generation-compose.mjs'
import {createHash} from 'node:crypto'

const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)
const only=(v,keys)=>plain(v)&&Object.keys(v).every(k=>keys.includes(k))
function fail(message,diagnostics=[]){const e=new Error('dsh-ppt: tableSpec: '+message);e.code='table-spec';e.diagnostics=diagnostics;throw e}

export function tableCreateSchema(){
  const slide=generationSpecSchema().properties.slides.items.properties
  const visual=slide.visual.oneOf.find(v=>v.properties.type.const==='table').properties
  return {type:'object',additionalProperties:false,required:['version','mode','sources','tables'],properties:{
    version:{const:1},mode:{enum:['factual','demo']},allowMoreSlides:{type:'boolean'},
    contentHash:{type:'string',pattern:'^[a-f0-9]{64}$',description:'Optional SHA-256 of the canonical content payload. Preserve a supplied hash; a mismatch is an error, never recompute it to accept altered data.'},
    sources:{type:'array',minItems:1,maxItems:64,items:{type:'object',additionalProperties:false,required:['id','text'],properties:{id:structuredClone(slide.id),text:{type:'string',minLength:1,maxLength:262144,pattern:'\\S'},synthetic:{type:'boolean'}}}},
    tables:{type:'array',minItems:1,maxItems:120,items:{type:'object',additionalProperties:false,required:['id','title','sourceRefs','headers','rows'],properties:{
      id:structuredClone(slide.id),title:structuredClone(slide.title),notes:structuredClone(slide.notes),designLayout:structuredClone(slide.designLayout),
      sourceRefs:structuredClone(visual.sourceRefs),headers:structuredClone(visual.headers),rows:structuredClone(visual.rows)
    }}}
  }}
}

export function tableCreateContentHash(value){
  // Fixed property order; layout choices and pagination policy are not content.
  const payload={mode:value.mode,sources:value.sources.map(s=>({id:s.id,text:s.text,synthetic:s.synthetic??false})),tables:value.tables.map(t=>({id:t.id,title:t.title,sourceRefs:t.sourceRefs,headers:t.headers,rows:t.rows,notes:t.notes??null}))}
  return createHash('sha256').update(JSON.stringify(payload),'utf8').digest('hex')
}

export function composeTableCreate(value,{title,lang,template,maxSlides=120,signal}={}){
  signal?.throwIfAborted()
  if(!only(value,['version','mode','sources','tables','allowMoreSlides','contentHash'])||value.version!==1||!['factual','demo'].includes(value.mode)||value.allowMoreSlides!==undefined&&typeof value.allowMoreSlides!=='boolean')fail('Expected version:1, mode:factual|demo, sources, tables and optional allowMoreSlides:boolean, contentHash:string')
  if(!Array.isArray(value.sources)||value.sources.length<1||value.sources.length>64||value.sources.some(s=>!only(s,['id','text','synthetic'])||typeof s.id!=='string'||s.id.length>128||!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(s.id)))fail('Provide 1–64 source records {id,text,synthetic?} with valid source IDs')
  if(!Array.isArray(value.tables)||value.tables.length<1||value.tables.length>120||value.tables.some(t=>!only(t,['id','title','notes','designLayout','sourceRefs','headers','rows'])))fail('Provide 1–120 tables with id, title, sourceRefs, headers and rows; geometry and styling are not accepted')
  const spec={version:1,title,lang,mode:value.mode,slides:value.tables.map(t=>{
    const {headers,rows,sourceRefs,...slide}=structuredClone(t)
    return {...slide,purpose:'content',visual:{type:'table',headers,rows,sourceRefs}}
  })}
  const context={sources:structuredClone(value.sources)}
  const checked=validateGenerationSpec(spec,context)
  if(!checked.valid)fail(checked.diagnostics.map(d=>`${d.path}: ${d.message}`).join('; '),checked.diagnostics)
  if(value.contentHash!==undefined&&(typeof value.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(value.contentHash)||value.contentHash!==tableCreateContentHash(value)))fail('Content hash mismatch: input text, whitespace or source data changed. Use the original verified input; do not replace its hash.')
  const options={template,context,allowMoreSlides:value.allowMoreSlides===true,maxSlides,signal}
  // Imported templates may classify a sparse title page as content. Prefer the
  // fitting reference requiring fewer pages, never override an explicit ID.
  for(const slide of spec.slides){
    if(slide.designLayout)continue
    let lastError,best
    for(const layout of template?.manifest?.style?.layouts??[]){
      if(layout.purpose!=='content')continue
      try{
        const candidate=composeGenerationSpec({...spec,slides:[{...slide,designLayout:layout.id}]},options)
        const pages=candidate.report.slideCount,space=Math.min(...candidate.report.placements.map(p=>p.region.w*p.region.h))
        if(!best||pages<best.pages||pages===best.pages&&space>best.space)best={id:layout.id,pages,space}
      }catch(e){
        if(!['component-capacity','component-slide-limit'].includes(e.code))throw e
        lastError=e
      }
    }
    if(best)slide.designLayout=best.id
    else if(lastError)throw lastError
  }
  return composeGenerationSpec(spec,options)
}
