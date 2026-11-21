// Content-only entry point for normal ppt_create. No experiment or model calls.
import {generationSpecSchema,validateGenerationSpec} from './deck-generation-spec.mjs'
import {composeTemplateContent,contentSourcesSchema,validContentSources} from './deck-content-create.mjs'
import {createHash} from 'node:crypto'

const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)
const only=(v,keys)=>plain(v)&&Object.keys(v).every(k=>keys.includes(k))
function fail(message,diagnostics=[]){const e=new Error('dsh-ppt: tableSpec: '+message);e.code='table-spec';e.diagnostics=diagnostics;throw e}

export function tableCreateSchema(){
  const slide=generationSpecSchema().properties.slides.items.properties
  const visual=slide.visual.oneOf.find(v=>v.properties.type.const==='table').properties
  return {type:'object',additionalProperties:false,required:['version','mode','sources','tables'],properties:{
    version:{const:1,description:'Required numeric protocol version. Always include "version":1 inside tableSpec.'},mode:{enum:['factual','demo']},allowMoreSlides:{type:'boolean'},
    contentHash:{type:'string',pattern:'^[a-f0-9]{64}$',description:'Optional SHA-256 of the canonical content payload. Preserve a supplied hash; a mismatch is an error, never recompute it to accept altered data.'},
    sources:contentSourcesSchema(),
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
  if(!plain(value))fail('Expected tableSpec to be a JSON object, not a JSON string')
  if(!Object.hasOwn(value,'version'))fail('Missing required field tableSpec.version. Add "version":1 inside the existing tableSpec object; do not stringify it', [{path:'tableSpec.version',code:'required',message:'Required numeric version:1 is missing'}])
  if(value.version!==1)fail('tableSpec.version must be the number 1', [{path:'tableSpec.version',code:'const',message:'Expected numeric version:1'}])
  if(!only(value,['version','mode','sources','tables','allowMoreSlides','contentHash'])||!['factual','demo'].includes(value.mode)||value.allowMoreSlides!==undefined&&typeof value.allowMoreSlides!=='boolean')fail('Expected version:1, mode:factual|demo, sources, tables and optional allowMoreSlides:boolean, contentHash:string')
  if(!validContentSources(value.sources))fail('Provide 1–64 source records {id,text,synthetic?} with valid source IDs')
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
  return composeTemplateContent(spec,options)
}
