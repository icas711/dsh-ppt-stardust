// Deterministic rubric checks; human acceptance is deliberately separate.
import {isDeepStrictEqual} from 'node:util'
import {validateGenerationSpec} from '../skills/dsh-ppt/scripts/deck-generation-spec.mjs'
import {GENERATION_ICON_IDS,canonicalGenerationAssets} from '../skills/dsh-ppt/scripts/deck-generation-compose.mjs'
import {templateCreateOptions} from '../skills/dsh-ppt/scripts/deck-templates.mjs'

export const finding=(code,path,message,slideId=null)=>({severity:'error',code,path,slideId,message})
const canonical=text=>String(text).normalize('NFC').replace(/\s+/g,' ').trim()
const numbers=text=>[...text.matchAll(/\d+(?:[.,]\d+)?/g)].map(m=>String(Number(m[0].replace(',','.'))))
const clean=value=>Array.isArray(value)?value.map(clean):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([k])=>!['id','sourceRefs','iconId'].includes(k)).map(([k,v])=>[k,clean(v)])):value
function chartDefaults(value){
  if(value?.type==='chart')for(const key of ['ordered','whole'])if(value[key]===false)delete value[key]
  return value
}
const textOf=paragraphs=>(paragraphs??[]).map(p=>(p.runs??[]).map(r=>r.break?' ':r.text??'').join('')).join('\n')
function chartText(chart){
  const circular=['pie','doughnut'].includes(chart.kind),parts=[chart.title??'']
  if((!circular&&!chart.categoryAxisHidden)||(circular&&chart.legend?.position&&chart.legend.position!=='none'))parts.push(...chart.categories)
  if(chart.legend?.position&&chart.legend.position!=='none'&&!circular)parts.push(...chart.series.map(s=>s.name))
  for(const s of chart.series)for(let i=0;i<s.values.length;i++){
    const label=s.pointDataLabels?.[i]??s.dataLabels??chart.dataLabels??{}
    if(label.text!==undefined)parts.push(label.text)
    else{if(label.showValue)parts.push(String(s.values[i]));if(label.showCategory)parts.push(chart.categories[i]);if(label.showSeriesName)parts.push(s.name)}
  }
  return parts.join('\n')
}
export function compactVisibleText(slides){return slides.flatMap(s=>s.elements.filter(e=>!e.hidden&&e.role!=='decor').map(e=>e.type==='text'?textOf(e.paragraphs):e.type==='table'?e.table.cells.map(c=>textOf(c.paragraphs)).join('\n'):e.type==='chart'?chartText(e.chart):'')).join('\n')}
function literalsCheck(text,task,rubric,path,slideId){
  const all=canonical(text),diagnostics=[]
  for(const literal of rubric.requiredTexts)if(!all.includes(canonical(literal)))diagnostics.push(finding('missing-fact',path,'Preserve visible text: '+literal,slideId))
  for(const literal of rubric.forbiddenTexts??[])if(all.includes(canonical(literal)))diagnostics.push(finding('instruction-as-content',path,'Keep this requirement in the brief, not on slides: '+literal,slideId))
  const allowed=new Set(numbers(task.context.sources.map(s=>s.text).join('\n')+'\n'+rubric.requiredTexts.join('\n')))
  for(const token of new Set(numbers(text)))if(!allowed.has(token))diagnostics.push(finding('unexpected-number',path,'Number absent from supplied facts: '+token,slideId))
  return diagnostics
}
function combinedVisual(visuals){
  const base=clean(visuals[0])
  if(base.items)base.items=visuals.flatMap(v=>clean(v.items))
  else if(base.type==='table'){
    if(visuals.some(v=>!isDeepStrictEqual(v.headers,base.headers)))return null
    base.rows=visuals.flatMap(v=>v.rows)
  }else if(base.type==='chart'&&visuals.length>1){
    if(visuals.some(v=>v.unit!==base.unit||v.kind!==base.kind||!isDeepStrictEqual(v.series.map(s=>s.name),base.series.map(s=>s.name))))return null
    base.categories=visuals.flatMap(v=>v.categories)
    base.series=base.series.map((s,i)=>({...s,values:visuals.flatMap(v=>v.series[i].values)}))
  }else if(visuals.length!==1)return null
  return base
}
export function compactPlanningConstraints(task,rubric){
  if(rubric.visual?.type!=='cards')return undefined
  return {visualType:'cards',maxPlannedSlides:task.brief.allowMoreSlides?Math.floor(rubric.visual.items.length/2):task.brief.slideCount??1,purpose:'content',enginePagination:true}
}
function cardStructure(value,target,task){
  if(value?.type!=='cards')return value
  // A caption may instead be represented by visible item details. Check its
  // required literals separately, never count speaker notes as visible content.
  if(value.caption!==undefined&&task.context.sources.some(s=>canonical(s.text).includes(canonical(value.caption))))delete value.caption
  value.items.forEach((item,i)=>{
    if(item.detail!==undefined&&target.items[i]?.detail===undefined&&task.context.sources.some(s=>canonical(s.text).includes(canonical(item.detail))))delete item.detail
  })
  return value
}
export function reviewCompactSpec(spec,task,rubric){
  const report=validateGenerationSpec(spec,{...task.context,assetIds:Object.keys(task.assets),iconIds:[...GENERATION_ICON_IDS]})
  if(!report.valid)return report.diagnostics
  const single=spec.slides.length===1?spec.slides[0].id:null,path=single?'spec.slides[0].visual':'spec.slides'
  const diagnostics=[]
  if(spec.lang!==task.brief.lang||spec.mode!==task.dataMode)diagnostics.push(finding('brief-contract','spec','Keep language and factual/demo mode'))
  if(rubric.visual){
    const target=chartDefaults(clean(rubric.visual)),types=spec.slides.map(s=>s.visual.type)
    const actual=chartDefaults(types.every(t=>t===target.type)?combinedVisual(spec.slides.map(s=>s.visual)):null)
    if(target.type==='cards'){
      cardStructure(actual,target,task)
      delete target.caption
    }
    if(actual?.type==='chart'&&['bar','column'].includes(actual.kind)&&['bar','column'].includes(target.kind))actual.kind=target.kind
    if(!isDeepStrictEqual(actual,target))diagnostics.push(finding('source-semantics',path,'Preserve source representation, labels, details, nulls, dates, order, values, units and associations. Consult the supplied material; do not add unsupported content.',single))
  }
  // Explicit literals are a controlled-case criterion, not a general entailment test.
  const content=spec.slides.map(s=>{
    const v=s.visual
    if(v.type==='table')return [...v.headers,...v.rows.flat().filter(x=>x!==null)].join('\n')
    if(v.type==='chart')return [v.unit,...v.categories,...v.series.flatMap(s=>[s.name,...s.values])].join('\n')
    if(v.type==='image')return [v.alt,v.caption??''].join('\n')
    return [v.caption??'',...(v.criteria??[]),...v.items.flatMap(i=>[i.label,i.detail??'',i.date??'',i.value??'',i.unit??'',...(i.values??[]).filter(x=>x!==null)])].join('\n')
  }).join('\n')
  diagnostics.push(...literalsCheck(content+'\n'+spec.title+'\n'+spec.slides.map(s=>s.title).join('\n'),task,rubric,path,single))
  return diagnostics
}

/** A uses the existing free scene/template path, never deckPlan or spec components. */
export function checkCompactScene(value,task,template,rubric){
  const diagnostics=[]
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['version','title','lang','mode','slides'].includes(k))||value.version!==1||typeof value.title!=='string'||!value.title.trim()||!Array.isArray(value.slides))return {diagnostics:[finding('scene-contract','scene','Expected {version:1,title,lang,mode,slides}')]}
  if(value.lang!==task.brief.lang||value.mode!==task.dataMode)diagnostics.push(finding('brief-contract','scene','Keep language and factual/demo mode'))
  if(value.slides.length<(task.brief.slideCount??1)||(!task.brief.allowMoreSlides&&value.slides.length!==(task.brief.slideCount??1)))diagnostics.push(finding('brief-slide-count','scene.slides','Follow the brief slide count'))
  if(value.slides.some(s=>!s||s.layout!=='scene'||typeof s.id!=='string'||!s.id))return {diagnostics:[...diagnostics,finding('scene-contract','scene.slides','Every slide requires a stable ID and layout:scene')]}
  let create
  try{create={...canonicalGenerationAssets(templateCreateOptions(template.manifest,template.assets,{title:value.title,lang:value.lang,slides:value.slides,assets:task.assets}).create),lang:value.lang}}
  catch(e){return {diagnostics:[...diagnostics,finding(e.code??'scene-contract',e.path??'scene',e.message)]}}
  const visible=compactVisibleText(create.slides)
  diagnostics.push(...literalsCheck(visible,task,rubric,'scene.slides',value.slides.length===1?value.slides[0].id:null))
  create.slides.forEach((s,i)=>{
    if(!task.context.sources.some(src=>s.notes?.includes(src.id)))diagnostics.push(finding('source-reference',`scene.slides[${i}].notes`,'Record supplied source IDs in slide notes',s.id))
    if(task.dataMode==='demo'&&!canonical(compactVisibleText([s])).includes('Синтетические данные'))diagnostics.push(finding('demo-disclosure',`scene.slides[${i}]`,'Show Синтетические данные on each slide',s.id))
  })
  const elements=create.slides.flatMap(s=>s.elements.filter(e=>!e.hidden&&e.role!=='decor'))
  if(rubric.visual?.type==='chart'){
    const charts=elements.filter(e=>e.type==='chart').map(e=>e.chart),v=rubric.visual
    if(charts.length!==1||!['bar','column'].includes(charts[0].kind)||!isDeepStrictEqual(charts[0].categories,v.categories)||!isDeepStrictEqual(charts[0].series.map(({name,values})=>({name,values})),v.series))diagnostics.push(finding('source-chart','scene.slides','Use a native category chart preserving categories, series and exact associations'))
  }
  if(rubric.visual?.type==='table'){
    const tables=elements.filter(e=>e.type==='table').map(e=>e.table),v=rubric.visual,rows=[]
    for(const t of tables){
      const grid=t.rows.map((_,row)=>t.columns.map((_,col)=>{const cell=t.cells.find(c=>c.row===row&&c.col===col);return cell?textOf(cell.paragraphs):null}))
      if(!isDeepStrictEqual(grid[0],v.headers))diagnostics.push(finding('source-table','scene.slides','Keep native table headers and grid'))
      rows.push(...grid.slice(1))
    }
    if(!tables.length||!isDeepStrictEqual(rows,v.rows.map(r=>r.map(c=>c??'—'))))diagnostics.push(finding('source-table','scene.slides','Preserve every native table row and column association'))
  }
  if(rubric.visual?.type==='image'){
    const expected=task.assets[rubric.visual.assetId]?.data
    if(!elements.some(e=>e.type==='image'&&create.assets[e.assetId]?.data===expected&&e.alt===rubric.visual.alt))diagnostics.push(finding('source-image','scene.slides','Use the supplied native image asset and preserve alt text'))
  }else if(elements.some(e=>e.type==='image'))diagnostics.push(finding('flattened-content','scene.slides','Use editable native content, not rasterized diagrams/text'))
  return {diagnostics,create}
}
