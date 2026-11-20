import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync} from 'node:fs'
import {join,relative} from 'node:path'
import {runCompactGeneration} from '../skills/dsh-ppt/scripts/deck-generation-run.mjs'
import {buildDeckAsync} from '../skills/dsh-ppt/scripts/deck-advanced.mjs'
import {recordedGenerationAdapter} from './generation-run.mjs'
import {loadCompactKit,loadCompactTask,safeFile,jsonFile,saveJson,sha,sceneRequest,promptText} from './generation-compact-kit.mjs'
import {reviewCompactSpec,checkCompactScene,finding,compactPlanningConstraints} from './generation-compact-review.mjs'

const pendingMessage='compact-offline-awaiting-response'
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)
const clone=v=>structuredClone(v)

async function replayScene({task,template,rubric,complete,onEvent,exportDeck,signal}){
  const journal=[],initial=sceneRequest(task,template)
  let current=null,diagnostics=[],ids=null,corrections=0,calls=0,artifacts=null,create=null
  const emit=async(type,data={})=>{const e={version:1,seq:journal.length+1,type,...data};journal.push(e);await onEvent(e)}
  const finish=async status=>{await emit('finished',{status,calls,corrections,diagnostics,acceptance:'not-verified'});return {status,calls,corrections,final:current,artifacts,journal,diagnostics,acceptance:'not-verified'}}
  await emit('started',{mode:'A',brief:task.brief,context:task.context,limits:{corrections:2}})
  for(let attempt=0;attempt<3;attempt++){
    if(signal?.aborted){diagnostics=[finding('aborted','scene','Run cancelled')];return finish('cancelled')}
    const request={...initial,call:++calls,correctionsUsed:corrections,kind:attempt?'repair':'initial',diagnostics,
      ...(attempt?{current:ids?{slides:current.slides.filter(s=>ids.includes(s.id))}:current,...(ids?{slideIds:ids,schema:{type:'object',required:['slides'],additionalProperties:false,properties:{slides:initial.schema.properties.slides}}}:{})}:{}),
      instructions:initial.instructions+(ids?' Return {slides:[...]} replacing exactly the requested slide IDs; preserve every other slide.':'')}
    if(ids){
      delete request.brief
      const sources=initial.sources.filter(source=>request.current.slides.some(s=>s.notes?.includes(source.id)))
      if(sources.length)request.sources=sources
    }
    await emit('request',{request})
    let response
    try{response=await complete(request)}catch(e){diagnostics=[finding('model-call','scene',e.message)];await emit('transport-error',{message:e.message});return finish('provider-error')}
    await emit('response',{stage:'scene',response})
    try{
      if(typeof response?.text!=='string')throw new Error('Expected exact text response')
      const parsed=JSON.parse(response.text)
      if(ids){
        if(!plain(parsed)||Object.keys(parsed).some(k=>k!=='slides')||!Array.isArray(parsed.slides)||parsed.slides.length!==ids.length||parsed.slides.some(s=>!ids.includes(s?.id))||new Set(parsed.slides.map(s=>s.id)).size!==ids.length)throw new Error('Replace exactly the requested IDs in {slides:[...]}')
        current={...current,slides:current.slides.map(s=>clone(parsed.slides.find(p=>p.id===s.id)??s))}
      }else current=parsed
      const checked=checkCompactScene(current,task,template,rubric)
      diagnostics=checked.diagnostics;create=checked.create
    }catch(e){diagnostics=[finding('response-json','scene',e.message)]}
    await emit('validation',{stage:'scene',valid:!diagnostics.length,diagnostics})
    if(!diagnostics.length){
      if(!exportDeck)return finish('composed')
      try{signal?.throwIfAborted();artifacts=await exportDeck(create)}catch(e){diagnostics=[finding('export-error','export',e.message)];return finish(signal?.aborted?'cancelled':'export-error')}
      if(signal?.aborted){diagnostics=[finding('aborted','export','Run cancelled; inspect recorded artifacts')];return finish('cancelled')}
      await emit('artifacts',{artifacts});return finish('exported')
    }
    if(attempt===2)return finish('budget-exhausted')
    if(!(ids&&diagnostics.every(d=>d.code==='response-json'))){
      const affected=[...new Set(diagnostics.map(d=>d.slideId).filter(Boolean))]
      ids=affected.length&&diagnostics.every(d=>d.slideId)&&Array.isArray(current?.slides)&&current.slides.every(s=>plain(s)&&typeof s.id==='string')&&new Set(current.slides.map(s=>s.id)).size===current.slides.length?affected:null
    }
    corrections++
  }
}

/** Re-execute local validation, not LLM calls; missing recording yields a prompt. */
export async function processCompactRecording({mode,task,template,rubric,recording,manualInterventions=[],exportDeck,signal}){
  if(recording.version!==1||!Array.isArray(recording.responses))throw new Error('Expected recording {version:1,responses:[]}')
  const adapter=recordedGenerationAdapter(recording.responses),journal=[]
  let cursor=0,pending=null
  const complete=async request=>{
    if(cursor>=recording.responses.length){pending=clone(request);throw new Error(pendingMessage)}
    cursor++;return adapter(request)
  }
  let result
  if(mode==='A')result=await replayScene({task,template,rubric,complete,onEvent:e=>journal.push(clone(e)),exportDeck,signal})
  else{
    const raw=await runCompactGeneration({mode,brief:task.brief,context:task.context,template,assets:task.assets,dataMode:task.dataMode,planningConstraints:compactPlanningConstraints(task,rubric),manualInterventions,complete,onEvent:e=>journal.push(clone(e)),reviewSpec:spec=>reviewCompactSpec(spec,task,rubric),exportDeck,signal})
    const {composition,journal:ignored,...other}=raw
    result={...other,final:raw.spec,compositionReport:composition?.report??null,compositionDiagnostics:composition?.diagnostics??[]}
  }
  if(pending){
    // The runner's adapter exception is local control flow, not a provider failure.
    const requestIndex=journal.findLastIndex(e=>e.type==='request')
    journal.splice(requestIndex+1)
    journal.push({version:1,seq:journal.length+1,type:'awaiting-recorded-response',call:pending.call})
    result={...result,status:'waiting-for-response',calls:cursor,diagnostics:[]}
  }
  return {...result,journal,pending,unusedResponses:recording.responses.length-cursor,replay:true,acceptance:'not-verified'}
}

export function loadCompactRun(kit,runId){
  const expected=kit.schedule.find(r=>r.id===runId)
  if(!expected)throw new Error('Unknown scheduled run ID')
  const dir=safeFile(kit.root,'runs/'+runId+'/run.json').replace(/[\\/]run\.json$/,'')
  const run=jsonFile(join(dir,'run.json'))
  if(run.suiteId!==kit.manifest.suiteId||Object.entries(expected).some(([key,value])=>run[key]!==value))throw new Error('Run identity/order differs from immutable schedule')
  const loaded=loadCompactTask(kit,expected.taskId)
  if(run.inputSha256!==kit.manifest.files[kit.manifest.tasks.find(t=>t.id===expected.taskId).requestPath])throw new Error('Run input fingerprint mismatch')
  return {dir,run,...loaded}
}

export function readCompactHistory(dir){
  const path=join(dir,'history.json'),history=existsSync(path)?jsonFile(path):[]
  if(!Array.isArray(history))throw new Error('Invalid attempt history')
  let prefix=[]
  for(const entry of history){
    if(!/^\d{4}$/.test(entry.attempt))throw new Error('Invalid saved attempt ID')
    const out=join(dir,'attempts',entry.attempt),raw=readFileSync(join(out,'responses.json')),recording=JSON.parse(raw),resultRaw=readFileSync(join(out,'result.json')),result=JSON.parse(resultRaw)
    if(sha(raw)!==entry.recordingSha256||sha(resultRaw)!==entry.resultSha256||!Array.isArray(recording.responses)||recording.responses.length!==entry.responseHashes.length||entry.responseHashes.some((h,i)=>h!==sha(recording.responses[i]))||prefix.some((h,i)=>h!==entry.responseHashes[i]))throw new Error('Saved response/attempt evidence changed')
    if(result.journalSha256!==sha(readFileSync(join(out,'journal.jsonl')))||result.runInputSha256!==sha(jsonFile(join(out,'run-input.json'))))throw new Error('Saved journal or run input snapshot changed')
    prefix=entry.responseHashes
  }
  return history
}

export async function advanceCompactEvaluation(directory,runId){
  const kit=loadCompactKit(directory),loaded=loadCompactRun(kit,runId),{dir,run,task,template,rubric}=loaded
  const raw=readFileSync(join(dir,'responses.json'),'utf8'),recording=JSON.parse(raw)
  if(recording.version!==1||!Array.isArray(recording.responses))throw new Error('Invalid responses recording')
  const hashes=recording.responses.map(sha),historyPath=join(dir,'history.json'),history=readCompactHistory(dir)
  if(history.length&&history.at(-1).responseHashes.some((h,i)=>hashes[i]!==h))throw new Error('Earlier responses changed or disappeared; append responses and retain original evidence')
  if(history.length&&history.at(-1).status!=='waiting-for-response')throw new Error('Run is terminal; retain its outcome and start a separately scheduled run')
  const attempts=join(dir,'attempts');mkdirSync(attempts,{recursive:true})
  const name=String(readdirSync(attempts).length+1).padStart(4,'0'),out=join(attempts,name)
  mkdirSync(out)
  writeFileSync(join(out,'responses.json'),raw,{flag:'wx'});saveJson(join(out,'run-input.json'),run)
  const result=await processCompactRecording({mode:run.mode,task,template,rubric,recording,manualInterventions:run.manualInterventions,exportDeck:create=>buildDeckAsync({...create,outputDir:join(out,'deck')})})
  // A and B/C journal formats differ in timing detail; all are offline replay events.
  const journal=result.journal.map((e,i)=>({...e,seq:i+1,offlineReplay:true}))
  const journalText=journal.map(e=>JSON.stringify(e)).join('\n')+'\n'
  writeFileSync(join(out,'journal.jsonl'),journalText,{flag:'wx'})
  if(result.pending){saveJson(join(out,'next-request.json'),result.pending);writeFileSync(join(out,'next-prompt.md'),promptText(result.pending),{flag:'wx'})}
  const artifactIndex=[]
  for(const key of ['htmlPath','pptxPath','pdfPath'])if(result.artifacts?.[key]){
    const file=result.artifacts[key],path=relative(dir,file).replace(/\\/g,'/')
    if(safeFile(dir,path)!==file)throw new Error('Export artifact escaped its run directory')
    artifactIndex.push({kind:key.replace('Path',''),path,sha256:sha(readFileSync(file))})
  }
  const {journal:ignored,pending,...summary}=result
  const report={...summary,runId,suiteId:kit.manifest.suiteId,artifactIndex,artifactSetSha256:artifactIndex.length?sha(artifactIndex):null,recordingSha256:sha(raw),responseHashes:hashes,runInputSha256:sha(run),journalSha256:sha(journalText),nextPrompt:pending?relative(kit.root,join(out,'next-prompt.md')).replace(/\\/g,'/'):null,offlineTiming:true}
  saveJson(join(out,'result.json'),report)
  history.push({attempt:name,status:report.status,responseHashes:hashes,recordingSha256:report.recordingSha256,resultSha256:sha(readFileSync(join(out,'result.json')))})
  writeFileSync(historyPath,JSON.stringify(history,null,2)+'\n')
  writeFileSync(join(dir,'run.json'),JSON.stringify({...run,status:report.status,latestAttempt:'attempts/'+name},null,2)+'\n')
  return {runId,status:report.status,calls:report.calls,corrections:report.corrections,directory:out,nextPrompt:report.nextPrompt,artifactSetSha256:report.artifactSetSha256,diagnostics:report.diagnostics,unusedResponses:report.unusedResponses}
}

/** Append exact response text without requiring the operator to JSON-escape it. */
export async function recordCompactResponse(directory,runId,textPath,metadataPath){
  const kit=loadCompactKit(directory),{dir,run,task,template,rubric}=loadCompactRun(kit,runId)
  const history=readCompactHistory(dir),path=join(dir,'responses.json'),recording=jsonFile(path)
  if(history.length&&history.at(-1).responseHashes.some((h,i)=>h!==sha(recording.responses?.[i]??null)))throw new Error('Earlier responses changed; original evidence must be preserved')
  const replay=await processCompactRecording({mode:run.mode,task,template,rubric,recording,manualInterventions:run.manualInterventions})
  if(!replay.pending)throw new Error('Run has no pending model response; retain terminal outcome')
  const metadata=metadataPath?jsonFile(metadataPath):{}
  if(!plain(metadata)||Object.keys(metadata).some(k=>!['usage','usageOrigin','model','provider','error'].includes(k)))throw new Error('Metadata supports usage, usageOrigin, model, provider and error only')
  const raw=readFileSync(textPath,'utf8')
  recording.responses.push({...metadata,stage:replay.pending.stage,kind:replay.pending.kind,text:raw,responseSha256:sha(raw)})
  writeFileSync(path,JSON.stringify(recording,null,2)+'\n')
  return {runId,status:'recorded',responses:recording.responses.length,stage:replay.pending.stage,kind:replay.pending.kind,responseSha256:sha(raw)}
}
