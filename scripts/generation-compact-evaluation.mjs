import {readFileSync,existsSync,readdirSync,mkdirSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {loadCompactKit,safeFile,jsonFile,saveJson,sha} from './generation-compact-kit.mjs'
import {loadCompactRun,processCompactRecording,readCompactHistory} from './generation-compact-session.mjs'

const validTime=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value))
const duration=(start,end)=>validTime(start)&&validTime(end)&&Date.parse(end)>=Date.parse(start)?Date.parse(end)-Date.parse(start):null
const finite=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0
const median=values=>{const sorted=values.filter(finite).sort((a,b)=>a-b);return sorted.length?(sorted[Math.floor((sorted.length-1)/2)]+sorted[Math.floor(sorted.length/2)])/2:null}

/** No duration/token estimates from replay runtime or response text length. */
export function compactRunMetrics(run,responses,accepted){
  const timing=run.timing??{},usage=responses.map(r=>r.usageOrigin==='provider'?r.usage:null)
  const tokenRows=usage.filter(u=>u&&Number.isSafeInteger(u.inputTokens)&&u.inputTokens>=0&&Number.isSafeInteger(u.outputTokens)&&u.outputTokens>=0)
  const costs=usage.map(u=>u?.cost),knownCosts=costs.filter(c=>c&&finite(c.amount)&&typeof c.currency==='string'&&c.currency.trim())
  const allTokens=responses.length>0&&tokenRows.length===responses.length,allCosts=responses.length>0&&knownCosts.length===responses.length&&new Set(knownCosts.map(c=>c.currency)).size===1
  return {firstResponseMs:duration(timing.generationStartedAt,timing.firstResponseAt),totalUntilFinishedMs:duration(timing.generationStartedAt,timing.finishedAt),timeToAcceptedMs:accepted?duration(timing.generationStartedAt,timing.acceptedAt):null,
    clarificationMs:finite(timing.clarificationMs)?timing.clarificationMs:null,templateReadMs:finite(timing.templateReadMs)?timing.templateReadMs:null,importMs:finite(timing.importMs)?timing.importMs:null,profileMs:finite(timing.profileMs)?timing.profileMs:null,
    inputTokens:allTokens?tokenRows.reduce((s,u)=>s+u.inputTokens,0):null,outputTokens:allTokens?tokenRows.reduce((s,u)=>s+u.outputTokens,0):null,tokenCallsCovered:tokenRows.length,
    cost:allCosts?{amount:knownCosts.reduce((s,c)=>s+c.amount,0),currency:knownCosts[0].currency}:null,costCallsCovered:knownCosts.length}
}
function acceptanceEvidence(dir,run,result){
  const issues=[],add=(code,message)=>issues.push({code,message})
  const review=jsonFile(join(dir,'human-review.json'))
  const names=['facts','filesOpen','noCriticalOverlap','readable','templateStyle','editable']
  if(typeof review.reviewer!=='string'||!review.reviewer.trim()||!validTime(review.reviewedAt))add('human-review','Named human reviewer and timezone-aware reviewedAt are required')
  if(!result.artifactSetSha256||review.artifactSetSha256!==result.artifactSetSha256)add('review-artifacts','Human review must reference the exact current artifact set')
  for(const name of names)if(review.checks?.[name]!==true)add('human-'+name,'Human check pending/failed: '+name)
  if(!Array.isArray(review.renderEvidence)||!review.renderEvidence.length)add('render-evidence','Rendered PNG/PDF evidence is required for prototype acceptance')
  else for(const record of review.renderEvidence){
    try{
      if(!record||typeof record.sha256!=='string'||!(/\.(png|pdf)$/i.test(record.path)))throw new Error('Expected {path: relative PNG/PDF, sha256}')
      const bytes=readFileSync(safeFile(dir,record.path))
      if(!bytes.length||sha(bytes)!==record.sha256)throw new Error('Render evidence missing or changed')
      const signature=record.path.toLowerCase().endsWith('.png')?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes.subarray(0,5).toString()==='%PDF-'
      if(!signature)throw new Error('Invalid PNG/PDF evidence signature')
    }catch(e){add('render-evidence',e.message)}
  }
  for(const key of ['dsh','installedPlugin','provider','model'])if(typeof run.versions?.[key]!=='string'||!run.versions[key].trim())add('run-version','Record actual '+key)
  if(run.versions?.model!=='glm-5.3-flash')add('run-model','This suite targets exactly glm-5.3-flash')
  if(run.versions?.installedPlugin!==run.versions?.plugin)add('run-version','Installed plugin version differs from prepared plugin version')
  if(!['cold','repeated'].includes(run.cache?.condition)||typeof run.cache.scope!=='string'||!run.cache.scope.trim())add('cache-condition','Record actual cold/repeated cache condition and scope; unknown cannot enter speed comparisons')
  const t=run.timing??{}
  if(duration(t.generationStartedAt,t.firstResponseAt)===null||duration(t.firstResponseAt,t.finishedAt)===null||duration(t.finishedAt,review.reviewedAt)===null||duration(review.reviewedAt,t.acceptedAt)===null)add('run-timing','Record ordered live generation/first response/finish/review/acceptance timestamps with timezone')
  if(!Array.isArray(run.manualInterventions))add('manual-interventions','Keep an explicit manual interventions array')
  return issues
}

/** Replays exact recordings through the new spec path (or A free scenes).
 * Missing and unsuccessful runs remain rows; human attestations are never inferred.
 */
export async function evaluateCompactKit(directory){
  const kit=loadCompactKit(directory),results=[]
  for(const planned of kit.schedule){
    const base={runId:planned.id,caseId:planned.caseId,templateKey:planned.templateKey,mode:planned.mode,phase:planned.phase,repetition:planned.repetition,accepted:false,technicalPassed:false,successFirstAttempt:false,calls:0,corrections:0,status:'not-run',issues:[]}
    let responses=[],run={}
    try{
      const loaded=loadCompactRun(kit,planned.id);run=loaded.run
      const {dir,task,template,rubric}=loaded,recording=jsonFile(join(dir,'responses.json'))
      if(recording.version!==1||!Array.isArray(recording.responses))throw new Error('Invalid response recording')
      responses=recording.responses
      const attempted=responses.length>0||validTime(run.timing?.generationStartedAt)||['provider-error','cancelled','export-error','composition-error','budget-exhausted'].includes(run.status)
      if(!run.latestAttempt){
        if(attempted)base.issues.push({code:'unprocessed-recording',message:'Run has no saved local validation attempt'})
        results.push({...base,calls:attempted?null:0,status:attempted?(run.status==='not-run'?'incomplete':run.status):'not-run',attempted,route:run.versions,cacheCondition:run.cache?.condition??'unknown',metrics:compactRunMetrics(run,responses,false)});continue
      }
      const history=readCompactHistory(dir)
      if(!history.length||run.latestAttempt!=='attempts/'+history.at(-1).attempt)throw new Error('Latest attempt pointer differs from preserved history')
      const attemptDir=safeFile(dir,run.latestAttempt),result=jsonFile(join(attemptDir,'result.json'))
      if(result.runId!==run.id||result.suiteId!==kit.manifest.suiteId||result.recordingSha256!==sha(readFileSync(join(dir,'responses.json')))||result.responseHashes.length!==responses.length||result.responseHashes.some((h,i)=>h!==sha(responses[i])))throw new Error('Saved result does not match the exact live recording; advance the run again before review')
      if(run.status!==result.status)throw new Error('Run status differs from saved outcome')
      for(const key of ['plugin','codeSha256','spec','components','runner','profile'])if(run.versions?.[key]!==kit.manifest.versions[key])throw new Error('Prepared version changed in run record: '+key)
      const replay=await processCompactRecording({mode:run.mode,task,template,rubric,recording,manualInterventions:run.manualInterventions})
      base.calls=replay.calls;base.corrections=replay.corrections;base.status=result.status
      base.issues.push(...replay.diagnostics)
      if(sha(replay.final??null)!==sha(result.final??null))throw new Error('Saved final object differs from actual response replay')
      if(replay.unusedResponses)base.issues.push({code:'unused-responses',message:'Extra responses after terminal outcome: '+replay.unusedResponses})
      if(replay.status==='waiting-for-response')base.issues.push({code:'incomplete',message:'Waiting for the next recorded DSH response'})
      if(result.status==='exported'){
        if(replay.status!=='composed')throw new Error('Exported result no longer passes deterministic checks')
        if(!Array.isArray(result.artifactIndex)||!['html','pptx'].every(kind=>result.artifactIndex.some(a=>a.kind===kind))||sha(result.artifactIndex)!==result.artifactSetSha256)throw new Error('Incomplete or changed artifact index')
        for(const a of result.artifactIndex)if(sha(readFileSync(safeFile(dir,a.path)))!==a.sha256)throw new Error('Export artifact changed: '+a.path)
        base.technicalPassed=!base.issues.length
        base.issues.push(...acceptanceEvidence(dir,run,result))
        base.accepted=base.technicalPassed&&!base.issues.length
      }else if(replay.status==='composed'&&result.status!=='export-error')throw new Error('Recorded terminal status is inconsistent with replay')
      base.successFirstAttempt=base.accepted&&base.corrections===0
      if(responses.some(r=>r.model&&r.model!==run.versions?.model)){base.accepted=false;base.successFirstAttempt=false;base.issues.push({code:'response-model',message:'Response model metadata differs from run route'})}
      const metrics=compactRunMetrics(run,responses,base.accepted)
      results.push({...base,attempted,route:run.versions,cacheCondition:run.cache?.condition??'unknown',cacheScope:run.cache?.scope??null,manualInterventions:run.manualInterventions,toolHistory:run.toolHistory,limitations:run.limitations,metrics})
    }catch(e){results.push({...base,status:'invalid-evidence',attempted:responses.length>0||validTime(run.timing?.generationStartedAt),issues:[...base.issues,{code:'run-evidence',message:e.message}],route:run.versions,cacheCondition:run.cache?.condition??'unknown',metrics:compactRunMetrics(run,responses,false)})}
  }
  const groups=[],byGroup=new Map()
  for(const r of results){
    const key=JSON.stringify([r.phase,r.caseId,r.templateKey,r.mode,r.cacheCondition,r.route?.provider??null,r.route?.model??null,r.route?.dsh??null,r.route?.installedPlugin??null])
    if(!byGroup.has(key))byGroup.set(key,[])
    byGroup.get(key).push(r)
  }
  for(const rows of byGroup.values()){
    const first=rows[0]
    const accepted=rows.filter(r=>r.accepted),measured=accepted.filter(r=>finite(r.metrics.timeToAcceptedMs))
    groups.push({phase:first.phase,caseId:first.caseId,templateKey:first.templateKey,mode:first.mode,cacheCondition:first.cacheCondition,provider:first.route?.provider??null,model:first.route?.model??null,dsh:first.route?.dsh??null,installedPlugin:first.route?.installedPlugin??null,planned:rows.length,attempted:rows.filter(r=>r.attempted).length,notRun:rows.filter(r=>!r.attempted).length,accepted:accepted.length,failedOrPending:rows.filter(r=>r.attempted&&!r.accepted).length,firstAttemptAccepted:accepted.filter(r=>r.successFirstAttempt).length,medianTimeToAcceptedMs:median(measured.map(r=>r.metrics.timeToAcceptedMs)),rangeTimeToAcceptedMs:measured.length?[Math.min(...measured.map(r=>r.metrics.timeToAcceptedMs)),Math.max(...measured.map(r=>r.metrics.timeToAcceptedMs))]:null,measuredAccepted:measured.length})
  }
  const attempted=results.filter(r=>r.attempted)
  return {version:1,suiteId:kit.manifest.suiteId,scope:'Recorded responses replayed through spec/components or free scene A. Human review and live timestamps are external evidence; replay wall time is never model speed.',status:'reviewed',planned:results.length,attempted:attempted.length,notRun:results.filter(r=>!r.attempted).length,accepted:results.filter(r=>r.accepted).length,allAttemptedAccepted:attempted.length>0&&attempted.every(r=>r.accepted),complete:results.every(r=>r.accepted),winner:null,winnerReason:'Live pilot and repeated comparable measurements require stage 6; no speed winner inferred from offline replay or pooled heterogeneous tasks.',versions:kit.manifest.versions,groups,results}
}
export async function reviewCompactEvaluation(directory,output){
  const out=resolve(output)
  if(existsSync(out)&&readdirSync(out).length)throw new Error('Choose a new or empty report directory; evidence must not be overwritten')
  const report=await evaluateCompactKit(directory)
  mkdirSync(out,{recursive:true});saveJson(join(out,'report.json'),report)
  return report
}
