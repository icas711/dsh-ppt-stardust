// Explicit version 2 semantics, shared by tools, plan checks and native layout.
import {normalizeSceneChart} from './deck-structured.mjs'
export const SEMANTIC_KINDS=['cards','process','timeline','cycle','comparison','hierarchy','relationship','kpi','quote','number','chart']
const newKinds=['cards','cycle','kpi','quote','number']
function fail(message){const e=new Error('dsh-ppt: diagram-input: '+message);e.code='diagram-input';throw e}
function text(v,label,max=8000){if(typeof v!=='string'||!v.trim()||v.length>max)fail(label+' must be explicit bounded text')}
export function validateSemanticDiagram(d){
 if(!d||!SEMANTIC_KINDS.includes(d.kind))fail('Unknown semantic kind')
 if(d.version!==undefined&&d.version!==2)fail('Unknown semantic version')
 const strict=d.version===2||newKinds.includes(d.kind)
 if(!strict)return d // Compatibility with the existing explicit version 1 input.
 for(const k of Object.keys(d))if(!['version','kind','items','links','chart','ordered','repeats','criteria'].includes(k))fail('Unknown diagram field '+k)
 if(d.kind==='chart'){normalizeSceneChart(d.chart);return d}
 if(!Array.isArray(d.items)||!d.items.length||d.items.length>12)fail('Expected 1–12 source items')
 if(['process','timeline','cycle','relationship'].includes(d.kind)&&d.items.length>6)fail('This connected layout supports at most 6 nodes; split the source explicitly instead of overlapping or shrinking it')
 const ids=new Set()
 for(const [i,item]of d.items.entries()){
  if(!item||typeof item!=='object'||Array.isArray(item))fail('Expected item object')
  for(const k of Object.keys(item))if(!['id','label','detail','date','parentId','value','unit','delta','deltaUnit','source','values'].includes(k))fail('Unknown item field '+k)
  text(item.label,'Label');if(item.detail!==undefined)text(item.detail,'Detail');if(item.source!==undefined)text(item.source,'Source',4096)
  for(const key of ['value','delta'])if(item[key]!==undefined&&(typeof item[key]!=='number'||!Number.isFinite(item[key])))fail(key+' must be a finite number')
  for(const key of ['unit','deltaUnit','date','parentId'])if(item[key]!==undefined)text(item[key],key,128)
  if(item.values!==undefined&&(!Array.isArray(item.values)||item.values.length>8||item.values.some(v=>v!==null&&(typeof v!=='string'||v.length>8000))))fail('Comparison values must be bounded text or null')
  const id=item.id??'item-'+(i+1);if(typeof id!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,80}$/.test(id)||ids.has(id))fail('Item IDs must be unique');ids.add(id)
 }
 if(d.kind==='process'&&d.ordered!==true)fail('Process order must be explicit')
 if(d.kind==='cycle'&&(d.repeats!==true||d.items.length<2))fail('A cycle requires explicit repetition and 2–12 stages')
 if(d.kind==='timeline'){
  if(d.ordered!==true)fail('Timeline order must be explicit')
  let previous=''
  for(const item of d.items){if(!/^\d{4}-\d{2}(?:-\d{2})?$/.test(item.date??''))fail('Each event requires an ISO date or month');const date=item.date.length===7?item.date+'-01':item.date;if(Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)fail('Invalid calendar date');if(date<previous)fail('Timeline dates must be ordered; reordering is explicit');previous=date}
 }
 if(d.kind==='comparison'){
  if(d.items.length<2||d.items.length>4||!Array.isArray(d.criteria)||!d.criteria.length||d.criteria.length>8||new Set(d.criteria).size!==d.criteria.length)fail('Comparison requires 2–4 alternatives and 1–8 shared criteria')
  d.criteria.forEach(c=>text(c,'Criterion',256))
  for(const item of d.items)if(!Array.isArray(item.values)||item.values.length!==d.criteria.length||item.values.some(v=>v!==null&&(typeof v!=='string'||v.length>8000)))fail('Every alternative must explicitly supply a string or null for each criterion')
 }
 if(d.kind==='hierarchy'){
  const byId=new Map(d.items.map((item,i)=>[item.id??'item-'+(i+1),item]));let edges=0
  for(const [id,item]of byId){const seen=new Set([id]);let parent=item.parentId;while(parent){if(!byId.has(parent)||seen.has(parent))fail('Hierarchy has an unknown parent or cycle');seen.add(parent);parent=byId.get(parent).parentId}if(item.parentId)edges++}
  if(d.items.length>1&&!edges)fail('Hierarchy needs explicit parent relationships')
 }
 if(d.kind==='relationship'){if(!Array.isArray(d.links)||d.links.length>64||d.links.some(l=>!ids.has(l.from)||!ids.has(l.to)||l.from===l.to))fail('Relationships require valid explicit endpoints')}
 if(d.kind==='kpi'||d.kind==='number'){
  if(d.items.length>(d.kind==='number'?1:6))fail('Use 1–6 KPI indicators or one large number')
  for(const item of d.items){if(typeof item.value!=='number'||!Number.isFinite(item.value))fail('Indicator value must be an explicit finite number');text(item.unit,'Unit',128);if(item.delta!==undefined){if(typeof item.delta!=='number'||!Number.isFinite(item.delta))fail('Delta must be explicit numeric data');text(item.deltaUnit,'Delta unit',128)}}
 }
 if(['quote','number'].includes(d.kind)){if(d.items.length!==1)fail('Accent requires exactly one source item');text(d.items[0].source,'Attribution/source',4096)}
 return d
}
export function semanticInputProperties(){return {type:'object',properties:{version:{type:'integer',enum:[2]},kind:{type:'string',enum:SEMANTIC_KINDS},ordered:{type:'boolean'},repeats:{type:'boolean'},criteria:{type:'array',maxItems:8,items:{type:'string'}},items:{type:'array',maxItems:12,items:{type:'object',properties:{id:{type:'string'},label:{type:'string'},detail:{type:'string'},date:{type:'string'},parentId:{type:'string'},value:{type:'number'},unit:{type:'string'},delta:{type:'number'},deltaUnit:{type:'string'},source:{type:'string'},values:{type:'array',items:{type:['string','null']}}},required:['label'],additionalProperties:false}},links:{type:'array',items:{type:'object',properties:{from:{type:'string'},to:{type:'string'}},required:['from','to'],additionalProperties:false}},chart:{type:'object'}},required:['kind'],additionalProperties:false,description:'Version 2 explicit semantics. Dates/order/repetition, comparison criteria, numeric indicators and attribution must come from supplied content. No invented values or links. Layouts use editable native objects.'}}
export function semanticListLines(d){
 validateSemanticDiagram(d)
 if(d.kind==='chart')return d.chart.categories.map((c,i)=>c+': '+d.chart.series.map(s=>s.name+' '+s.values[i]).join('; '))
 return d.items.map(i=>[i.date,i.label,i.value===undefined?undefined:i.value+' '+i.unit,i.delta===undefined?undefined:i.delta+' '+i.deltaUnit,i.detail,...(d.criteria??[]).map((c,n)=>c+': '+(i.values[n]??'—')),i.source].filter(v=>v!==undefined&&v!=='').join('\n'))
}
