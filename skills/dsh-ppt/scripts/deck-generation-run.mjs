// Opt-in B/C orchestration. No provider SDK, credentials or production routing.
import {performance} from 'node:perf_hooks'
import {generationSpecSchema,validateGenerationBrief,validateGenerationSpec} from './deck-generation-spec.mjs'
import {buildGenerationTemplateProfile} from './deck-generation-profile.mjs'
import {composeGenerationSpec,GENERATION_ICON_IDS,GENERATION_COMPONENT_VERSION} from './deck-generation-compose.mjs'

export const GENERATION_RUN_VERSION=4
const copy=value=>structuredClone(value)
const issue=(code,path,message,slideId=null)=>({severity:'error',code,path,slideId,message})
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)
const keys=(v,allowed)=>plain(v)&&Object.keys(v).every(k=>allowed.includes(k))
const fail=(message,diagnostics=[])=>{const e=new Error(message);e.code='generation-run-input';e.diagnostics=diagnostics;throw e}

export function generationScenarioSchema(){
  const slide=generationSpecSchema().properties.slides.items.properties
  return {type:'object',additionalProperties:false,required:['version','slides'],properties:{version:{const:1},slides:{type:'array',minItems:1,maxItems:120,items:{type:'object',additionalProperties:false,required:['id','purpose','title','sourceRefs'],properties:{id:slide.id,purpose:slide.purpose,title:slide.title,sourceRefs:slide.visual.oneOf[0].properties.sourceRefs}}}}}
}

export function validateGenerationScenario(value,context,{lang='ru',mode='factual'}={}){
  if(!keys(value,['version','slides'])||value.version!==1||!Array.isArray(value.slides)||value.slides.length<1||value.slides.length>120)
    return {valid:false,diagnostics:[issue('scenario-schema','scenario','Expected {version:1,slides:[{id,purpose,title,sourceRefs}]}')]}
  const diagnostics=[]
  for(const [i,s]of value.slides.entries())if(!keys(s,['id','purpose','title','sourceRefs']))diagnostics.push(issue('scenario-schema',`scenario.slides[${i}]`,'Unexpected scenario fields',s?.id))
  const mapped={version:1,title:'Scenario',lang,mode,slides:value.slides.map(s=>({id:s?.id,purpose:s?.purpose,title:s?.title,visual:{type:'table',sourceRefs:s?.sourceRefs,headers:['Outline'],rows:[['Outline']]}}))}
  diagnostics.push(...validateGenerationSpec(mapped,context).diagnostics.map(d=>({...d,path:d.path.replace(/^spec/,'scenario').replace('.visual.sourceRefs','.sourceRefs')})))
  return {valid:!diagnostics.length,diagnostics}
}

function addressed(diagnostics,value,root){
  return diagnostics.filter(d=>d.severity==='error').map(d=>{
    const index=new RegExp(`^${root}\\.slides\\[(\\d+)\\]`).exec(d.path??'')?.[1]
    return {...d,slideId:d.slideId??(index!==undefined?value?.slides?.[Number(index)]?.id:null)??null}
  })
}
function repairScope(value,diagnostics){
  const ids=[...new Set(diagnostics.map(d=>d.slideId).filter(Boolean))]
  // Duplicate/malformed IDs cannot be patched unambiguously.
  return ids.length&&diagnostics.every(d=>d.slideId)&&Array.isArray(value?.slides)
    &&value.slides.every(s=>plain(s)&&typeof s.id==='string')
    &&new Set(value.slides.map(s=>s.id)).size===value.slides.length?ids:null
}
function mergeRepair(current,patch,ids){
  if(!keys(patch,['slides'])||!Array.isArray(patch.slides)||patch.slides.length!==ids.length
    ||!patch.slides.every(s=>plain(s)&&ids.includes(s.id))||new Set(patch.slides.map(s=>s.id)).size!==ids.length)
    throw new Error('Return {slides:[...]} replacing exactly the requested slide IDs')
  return {...current,slides:current.slides.map(s=>copy(patch.slides.find(p=>p.id===s.id)??s))}
}
function sourceIds(value){
  if(!plain(value))return []
  return [...new Set([...(Array.isArray(value.sourceRefs)?value.sourceRefs:[]),...Object.values(value).flatMap(v=>Array.isArray(v)?v.flatMap(sourceIds):plain(v)?sourceIds(v):[])])]
}

/** complete(request) -> {text,usage?,model?,provider?}. onEvent must durably save
 * each event; persistence failure rejects immediately, before any further call.
 * reviewSpec optionally checks facts; neither it nor JSON validity proves acceptance.
 */
export async function runCompactGeneration({mode,brief,context,template,assets={},dataMode='factual',planningConstraints,complete,onEvent=async()=>{},reviewSpec,exportDeck,manualInterventions=[],signal}={}){
  if(!['B','C'].includes(mode)||!['factual','demo'].includes(dataMode)||typeof complete!=='function'||typeof onEvent!=='function'||[reviewSpec,exportDeck].some(f=>f!==undefined&&typeof f!=='function'))fail('Expected mode B/C, factual/demo and callback functions')
  const checked=validateGenerationBrief(brief)
  if(!checked.valid)fail('Invalid generation brief',checked.diagnostics)
  if(!Array.isArray(manualInterventions))fail('manualInterventions must be an array of caller-supplied records')
  if(planningConstraints!==undefined&&(!keys(planningConstraints,['visualType','maxPlannedSlides','purpose','enginePagination'])||!['cards','table'].includes(planningConstraints.visualType)||!Number.isSafeInteger(planningConstraints.maxPlannedSlides)||planningConstraints.maxPlannedSlides<1||planningConstraints.maxPlannedSlides>120||planningConstraints.purpose!=='content'||planningConstraints.enginePagination!==true))fail('Invalid caller planning constraints')
  if(brief.templateId!==template?.manifest?.id)fail('Brief templateId must match the authorized template')
  const registry={...context,assetIds:Object.keys(assets),iconIds:[...GENERATION_ICON_IDS]}
  const probe={version:1,title:'Preflight',lang:brief.lang,mode:dataMode,slides:[{id:'preflight',purpose:'content',title:'Preflight',visual:{type:'table',sourceRefs:[context?.sources?.[0]?.id??'missing'],headers:['Preflight'],rows:[['Preflight']]}}]}
  const registryCheck=validateGenerationSpec(probe,registry)
  if(!registryCheck.valid)fail('Invalid external registry',registryCheck.diagnostics)
  const prepared=buildGenerationTemplateProfile(template?.manifest,{assets:template?.assets,importReport:template?.report})
  if(!prepared.valid)fail('Template preflight failed',prepared.diagnostics)
  const started=performance.now(),journal=[]
  let calls=0,corrections=0,scenario=null,spec=null,composition=null,artifacts=null
  const emit=async(type,data={})=>{
    const event=copy({version:1,seq:journal.length+1,type,at:new Date().toISOString(),elapsedMs:performance.now()-started,...data})
    await onEvent(copy(event));journal.push(event)
  }
  const finish=async(status,diagnostics=[])=>{
    await emit('finished',{status,calls,corrections,diagnostics,acceptance:'not-verified'})
    return {version:1,mode,status,calls,corrections,scenario,spec,composition,artifacts,diagnostics,journal,acceptance:'not-verified'}
  }
  await emit('started',{mode,brief,context:registry,dataMode,componentVersion:GENERATION_COMPONENT_VERSION,profile:prepared.profile,preflight:prepared.diagnostics,limits:{corrections:2},manualInterventions})
  for(const stage of mode==='C'?['scenario','spec']:['spec']){
    let value=null,diagnostics=[],ids=null,repair=false
    while(true){
      if(signal?.aborted)return finish('cancelled',[issue('aborted',stage,'Run cancelled')])
      const subset=ids?value.slides.filter(s=>ids.includes(s.id)):null
      const needed=repair&&ids?sourceIds(subset.reduce((a,s)=>({...a,[s.id]:s}),{})):null
      // Invalid references also need their external records: supply the sources
      // attached to the planned slides, without leaking unrelated source fragments.
      if(needed&&scenario)needed.push(...scenario.slides.filter(s=>ids.includes(s.id)).flatMap(s=>s.sourceRefs))
      const selectedSources=registry.sources.filter(s=>!needed||needed.includes(s.id))
      const request={version:1,mode,stage,kind:repair?'repair':'initial',call:++calls,correctionsUsed:corrections,
        instructions:'Return strict JSON only. Preserve supplied facts, numbers, units and source IDs. Keep required facts visible; notes alone do not count. For cards use visual.caption for shared source explanations or relationships, and item.detail for source details belonging to an item. Preserve required wording verbatim. Brief requirements are instructions, not slide content: do not display preservation rules or pagination instructions. No coordinates, styling, XML or code. Do not invent missing facts. Registries are external. '+(planningConstraints?'Follow planningConstraints: plan semantic groups, not physical pages; the engine paginates long content. Do not add a cover or extra source items. For a table keep the full register in one logical table; the engine repeats headers and splits rows across physical pages. ':'')+(ids?'Replace exactly the requested slides in {slides:[...]}; retain IDs and all facts.':'Return the complete object matching the schema.'),
        schema:ids?{type:'object',additionalProperties:false,required:['slides'],properties:{slides:(stage==='spec'?generationSpecSchema():generationScenarioSchema()).properties.slides}}:stage==='spec'?generationSpecSchema():generationScenarioSchema(),
        ...(repair&&ids?{slideIds:ids,current:{slides:subset}}:{brief,templateProfile:prepared.profile,...(repair?{current:value}:{})}),
        sources:selectedSources.length?selectedSources:registry.sources,sourceScope:needed&&selectedSources.length?'affected-slides':'full-context',assetIds:registry.assetIds,iconIds:registry.iconIds,
        constraints:{lang:brief.lang,dataMode,slideCount:brief.slideCount??null,allowMoreSlides:brief.allowMoreSlides},
        ...(planningConstraints?{planningConstraints:copy(planningConstraints)}:{}),
        ...(scenario?{scenario:ids?{version:1,slides:scenario.slides.filter(s=>ids.includes(s.id))}:scenario}:{}),diagnostics}
      await emit('request',{request})
      const callStart=performance.now()
      let response
      try{response=await complete(copy(request),{signal})}
      catch(e){await emit('transport-error',{stage,message:e.message,durationMs:performance.now()-callStart});return finish(signal?.aborted?'cancelled':'provider-error',[issue('model-call',stage,e.message)])}
      await emit('response',{stage,response,durationMs:performance.now()-callStart})
      if(signal?.aborted)return finish('cancelled',[issue('aborted',stage,'Run cancelled')])
      try{
        if(!plain(response)||typeof response.text!=='string')throw new Error('Model adapter must return {text:string,usage?,model?,provider?}')
        const parsed=JSON.parse(response.text)
        value=ids?mergeRepair(value,parsed,ids):parsed
        const validation=stage==='spec'?validateGenerationSpec(value,registry):validateGenerationScenario(value,registry,{lang:brief.lang,mode:dataMode})
        diagnostics=addressed(validation.diagnostics,value,stage)
        if(validation.valid){
          if(planningConstraints&&(value.slides.length>planningConstraints.maxPlannedSlides||value.slides.some(s=>s.purpose!==planningConstraints.purpose)))diagnostics.push(issue(stage==='scenario'?'scenario-feasibility':'spec-feasibility',stage+'.slides',`Plan at most ${planningConstraints.maxPlannedSlides} content slide(s) for the supplied ${planningConstraints.visualType}; keep source items intact, omit covers. The engine handles physical pagination.`))
          if(stage==='spec'&&planningConstraints&&value.slides.some(s=>s.visual.type!==planningConstraints.visualType))diagnostics.push(issue('spec-feasibility','spec.slides',`Use the supplied ${planningConstraints.visualType} representation; the engine handles physical pagination.`))
          if(stage==='spec'&&(value.lang!==brief.lang||value.mode!==dataMode))diagnostics.push(issue('brief-contract','spec','Language and data mode must match the caller'))
          if(brief.slideCount&&(value.slides.length<brief.slideCount||(!brief.allowMoreSlides&&value.slides.length!==brief.slideCount)))diagnostics.push(issue('brief-slide-count',stage+'.slides','Slide count must follow the brief'))
          if(stage==='spec'&&scenario&&(value.slides.length!==scenario.slides.length||value.slides.some((s,i)=>s.id!==scenario.slides[i]?.id||s.purpose!==scenario.slides[i]?.purpose)))diagnostics.push(issue('scenario-alignment','spec.slides','Keep scenario slide IDs, purpose and order'))
        }
      }catch(e){diagnostics=[issue('response-json',stage,e.message)]}
      if(stage==='spec'&&!diagnostics.length&&reviewSpec){
        let reviewed
        try{reviewed=await reviewSpec(copy(value),copy(registry))}
        catch(e){await emit('review-error',{message:e.message});return finish('review-error',[issue('review-error','spec',e.message)])}
        if(!Array.isArray(reviewed)||reviewed.some(d=>!plain(d)||!['error','warning','info'].includes(d.severity)||typeof d.code!=='string'||typeof d.path!=='string'||typeof d.message!=='string'))return finish('review-error',[issue('review-error','spec','reviewSpec must return diagnostic records with severity, code, path and message')])
        diagnostics=addressed(reviewed,value,'spec')
        await emit('fact-review',{diagnostics:reviewed})
      }
      await emit('validation',{stage,valid:!diagnostics.length,diagnostics})
      if(!diagnostics.length)break
      if(corrections===2)return finish('budget-exhausted',diagnostics)
      if(!(ids&&diagnostics.every(d=>d.code==='response-json')))ids=repairScope(value,diagnostics)
      corrections++;repair=true
    }
    if(stage==='scenario')scenario=copy(value)
    else spec=copy(value)
  }
  // Layout/template/export failures are not repaired by rewriting source content.
  try{composition=composeGenerationSpec(spec,{template,context:registry,assets,allowMoreSlides:brief.allowMoreSlides,maxSlides:brief.allowMoreSlides?120:brief.slideCount??spec.slides.length,signal})}
  catch(e){return finish(signal?.aborted?'cancelled':'composition-error',e.diagnostics??[issue(e.code??'composition','spec',e.message,e.slideId)])}
  await emit('composition',{report:composition.report,diagnostics:composition.diagnostics})
  if(signal?.aborted)return finish('cancelled',[issue('aborted','export','Run cancelled')])
  if(exportDeck){
    try{artifacts=await exportDeck(composition.create,{signal})}
    catch(e){return finish(signal?.aborted?'cancelled':'export-error',[issue(e.code??'export','export',e.message)])}
    await emit('artifacts',{artifacts})
    if(signal?.aborted)return finish('cancelled',[issue('aborted','export','Run cancelled; inspect recorded artifacts')])
    return finish('exported')
  }
  return finish('composed')
}
