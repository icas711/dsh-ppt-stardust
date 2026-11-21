// Experimental content contract. No coordinates, template mutation or model calls.
import {validateSemanticDiagram} from './deck-semantic.mjs'

const text = (maxLength=8000) => ({type:'string',minLength:1,maxLength,pattern:'\\S'})
const identifier = {type:'string',minLength:1,maxLength:128,pattern:'^[A-Za-z0-9][A-Za-z0-9._:-]*$'}
const array = (items,minItems=1,maxItems=12) => ({type:'array',items,minItems,maxItems})
const object = (properties,required=Object.keys(properties)) => ({type:'object',properties,required,additionalProperties:false})
const refs = {...array(identifier,1,64),uniqueItems:true}
const nullableText = {oneOf:[text(),{type:'null'}]}
const number = {type:'number',minimum:-1e100,maximum:1e100}
const baseItem = {id:identifier,label:text(500),detail:text(),sourceRefs:refs}
const item = (extra={},required=['id','label']) => object({...baseItem,...extra},required)
const visual = (type,properties,required=Object.keys(properties)) => object({type:{const:type},sourceRefs:refs,...properties},['type','sourceRefs',...required])
const visuals = [
  visual('cards',{items:array(item({iconId:identifier}),2,4),caption:text()},['items']),
  visual('process',{ordered:{const:true},items:array(item(),3,5)}),
  visual('timeline',{ordered:{const:true},items:array(item({date:{...text(10),pattern:'^\\d{4}-\\d{2}(-\\d{2})?$'}},['id','label','date']),2,6)}),
  visual('comparison',{criteria:{...array(text(256),1,8),uniqueItems:true},items:array(item({values:array(nullableText,1,8)},['id','label','values']),2,4)}),
  visual('big_number',{items:array(item({value:number,unit:text(128)},['id','label','value','unit']),1,2)}),
  visual('chart',{
    kind:{enum:['column','bar','line','pie']},unit:text(128),categories:array(text(256),1,24),
    series:array(object({name:text(256),values:array(number,1,24)}),1,4),
    ordered:{type:'boolean'},whole:{type:'boolean'},showPercent:{type:'boolean',description:'Pie only. Add a percentage beside the original amount and unit. Default false.'}
  },['kind','unit','categories','series']),
  visual('table',{headers:array(text(500),1,8),rows:array(array(nullableText,1,8),1,30)}),
  visual('image',{assetId:identifier,alt:text(2000),caption:text(2000)},['assetId','alt'])
]
const spec = object({
  version:{const:1},title:text(500),lang:{enum:['ru','en','zh']},mode:{enum:['factual','demo']},
  slides:array(object({id:identifier,purpose:{enum:['cover','content','section','closing']},title:text(500),
    designLayout:identifier,notes:text(16000),visual:{oneOf:visuals}},['id','purpose','title','visual']),1,120)
})
const brief = object({
  version:{const:1},goal:text(),audience:text(2000),lang:{enum:['ru','en','zh']},templateId:text(256),
  allowMoreSlides:{type:'boolean'},slideCount:{type:'integer',minimum:1,maximum:120},
  attachments:array(object({id:identifier,role:{enum:['content','style','both']}}),0,64),
  requiredFacts:array(text(),0,256)
},['version','goal','audience','lang','templateId','allowMoreSlides','attachments','requiredFacts'])

const clone = value => JSON.parse(JSON.stringify(value))
export const GENERATION_SPEC_VERSION = 1
export const GENERATION_VISUAL_TYPES = Object.freeze(visuals.map(v=>v.properties.type.const))
export function generationSpecSchema(){return {$schema:'https://json-schema.org/draft/2020-12/schema',...clone(spec)}}
export function generationBriefSchema(){return {$schema:'https://json-schema.org/draft/2020-12/schema',...clone(brief)}}

// Executes exactly the JSON Schema subset used above; no coercion or repair.
function check(value,schema,path,errors){
  const add = (message,code='generation-schema') => {if(errors.length<100)errors.push({severity:'error',code,path,message})}
  if(schema.oneOf){
    const branches=schema.oneOf.map(s=>{const e=[];check(value,s,path,e);return e})
    if(branches.filter(e=>!e.length).length===1)return
    const chosen=schema.oneOf.findIndex(s=>s.properties?.type?.const===value?.type)
    if(chosen>=0){for(const e of branches[chosen])if(errors.length<100)errors.push(e)}
    else add('Expected exactly one supported alternative')
    return
  }
  if(Object.hasOwn(schema,'const')&&value!==schema.const)add('Expected '+JSON.stringify(schema.const))
  if(schema.enum&&!schema.enum.includes(value))add('Expected one of '+schema.enum.join(', '))
  if(schema.type){
    const valid=schema.type==='object'?value!==null&&typeof value==='object'&&!Array.isArray(value)
      :schema.type==='array'?Array.isArray(value):schema.type==='null'?value===null
      :schema.type==='integer'?Number.isSafeInteger(value):schema.type==='number'?typeof value==='number'&&Number.isFinite(value)
      :typeof value===schema.type
    if(!valid){add('Expected '+schema.type);return}
  }
  if(schema.type==='object'){
    for(const key of schema.required)if(!Object.hasOwn(value,key)){
      if(errors.length<100)errors.push({severity:'error',code:'generation-schema',path:path+'.'+key,message:'Required field is missing'})
    }
    for(const [key,v]of Object.entries(value)){
      if(!Object.hasOwn(schema.properties,key)){
        if(errors.length<100)errors.push({severity:'error',code:'unknown-field',path:path+'.'+key,message:'Unknown field'})
      }else check(v,schema.properties[key],path+'.'+key,errors)
    }
  }
  if(schema.type==='array'){
    if(value.length<schema.minItems||value.length>schema.maxItems){add(`Expected ${schema.minItems}–${schema.maxItems} items`);return}
    if(schema.uniqueItems&&new Set(value.map(v=>JSON.stringify(v))).size!==value.length)add('Items must be unique')
    for(let i=0;i<value.length;i++)check(value[i],schema.items,path+'['+i+']',errors)
  }
  if(schema.type==='string'&&(value.length<schema.minLength||value.length>schema.maxLength||(schema.pattern&&!new RegExp(schema.pattern).test(value))))add('Invalid or oversized text')
  if((schema.type==='number'||schema.type==='integer')&&(value<schema.minimum||value>schema.maximum))add('Number is out of range')
}
const result = diagnostics => ({valid:!diagnostics.some(d=>d.severity==='error'),diagnostics})
function duplicateIds(items,path,diagnostics){
  const seen=new Set()
  items.forEach((item,i)=>{if(seen.has(item.id))diagnostics.push({severity:'error',code:'duplicate-id',path:`${path}[${i}].id`,message:'Duplicate ID '+item.id});seen.add(item.id)})
}
export function validateGenerationBrief(input){
  const diagnostics=[];check(input,brief,'brief',diagnostics)
  if(!diagnostics.length)duplicateIds(input.attachments,'brief.attachments',diagnostics)
  return result(diagnostics)
}

function diagram(visual){
  if(['table','image'].includes(visual.type))return null
  if(visual.type==='chart')return {version:2,kind:'chart',chart:{kind:visual.kind,categories:clone(visual.categories),series:clone(visual.series),title:visual.unit}}
  return {version:2,kind:visual.type==='big_number'?(visual.items.length===1?'number':'kpi'):visual.type,
    ...(visual.ordered!==undefined?{ordered:visual.ordered}:{}),...(visual.criteria?{criteria:clone(visual.criteria)}:{}),
    items:visual.items.map(({sourceRefs,iconId,...i})=>({...clone(i),source:(sourceRefs??visual.sourceRefs).join(', ')}))}
}

/** Sources are supplied by the caller, never trusted from a model response.
 * Binding verifies reference existence, NOT factual entailment or completeness.
 */
export function validateGenerationSpec(input,{sources,assetIds=[],iconIds=[]}={}){
  const diagnostics=[];check(input,spec,'spec',diagnostics)
  if(diagnostics.length)return result(diagnostics)
  const add=(code,path,message,slideId)=>diagnostics.push({severity:'error',code,path,message,...(slideId?{slideId}:{})})
  if(!Array.isArray(sources)||sources.some(s=>!s||typeof s.id!=='string'||typeof s.text!=='string'||!s.text.trim()||s.text.length>262144||(s.synthetic!==undefined&&typeof s.synthetic!=='boolean'))||new Set(sources.map(s=>s.id)).size!==sources.length){
    add('source-registry','sources','Supply unique source records {id,text,synthetic?}');return result(diagnostics)
  }
  if(![assetIds,iconIds].every(ids=>Array.isArray(ids)&&ids.every(id=>typeof id==='string'))){
    add('asset-registry','assets','Asset and icon registries must be arrays of IDs');return result(diagnostics)
  }
  const byId=new Map(sources.map(s=>[s.id,s])),assets=new Set(assetIds),icons=new Set(iconIds)
  duplicateIds(input.slides,'spec.slides',diagnostics)
  input.slides.forEach((slide,index)=>{
    const path=`spec.slides[${index}].visual`,v=slide.visual
    const error=(code,at,message)=>add(code,at,message,slide.id)
    const bind=(refs,at)=>refs.forEach((id,i)=>{
      const source=byId.get(id)
      if(!source)error('unknown-source',`${at}[${i}]`,'Unknown source '+id)
      else if(source.synthetic&&input.mode!=='demo')error('synthetic-source',`${at}[${i}]`,'Synthetic sources require mode:demo')
    })
    bind(v.sourceRefs,path+'.sourceRefs')
    if(v.items){
      duplicateIds(v.items,path+'.items',diagnostics)
      v.items.forEach((item,i)=>{
        if(item.sourceRefs)bind(item.sourceRefs,`${path}.items[${i}].sourceRefs`)
        if(item.iconId&&!icons.has(item.iconId))error('unknown-icon',`${path}.items[${i}].iconId`,'Unknown icon '+item.iconId)
      })
    }
    if(v.type==='image'&&!assets.has(v.assetId))error('unknown-asset',path+'.assetId','Unknown image '+v.assetId)
    if(v.type==='table'&&v.rows.some(row=>row.length!==v.headers.length))error('table-dimensions',path+'.rows','Every row must match the header width')
    if(v.type==='chart'){
      if(v.kind==='line'&&v.ordered!==true)error('chart-order',path+'.ordered','Line chart requires explicit category order')
      if(v.kind==='pie'&&v.whole!==true)error('chart-whole',path+'.whole','Pie chart requires explicit parts of one whole')
      if(v.showPercent!==undefined&&v.kind!=='pie')error('chart-percent',path+'.showPercent','showPercent is only supported on pie charts')
    }
    try{const d=diagram(v);if(d)validateSemanticDiagram(d)}
    catch(e){error('generation-semantic',path,e.message)}
  })
  return result(diagnostics)
}

/** Content-only intermediate representation; not yet a ppt_create slides array. */
export function generationSpecToContent(input,context){
  const report=validateGenerationSpec(input,context)
  if(!report.valid){const e=new Error('dsh-ppt: invalid generation spec');e.code='generation-spec';e.diagnostics=report.diagnostics;throw e}
  return {...clone(input),disclosures:input.mode==='demo'?['Синтетические данные / Synthetic demo data']:[],
    slides:input.slides.map(slide=>({...clone(slide),...(diagram(slide.visual)?{diagram:diagram(slide.visual)}:{})}))}
}
