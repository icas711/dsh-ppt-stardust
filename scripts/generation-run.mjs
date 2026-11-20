#!/usr/bin/env node
// Offline replay only. Live DSH/provider adapter is deliberately not installed.
import {readFileSync,writeFileSync,appendFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs'
import {resolve,dirname,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {readTemplateBundle,templateFromPptxScene} from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import {buildDeckAsync} from '../skills/dsh-ppt/scripts/deck-advanced.mjs'
import {runCompactGeneration} from '../skills/dsh-ppt/scripts/deck-generation-run.mjs'

export function recordedGenerationAdapter(responses){
  if(!Array.isArray(responses))throw new Error('Recording requires a responses array')
  let cursor=0
  return async request=>{
    const row=responses[cursor++]
    if(!row)throw new Error('Recording exhausted before the run completed')
    if((row.stage&&row.stage!==request.stage)||(row.kind&&row.kind!==request.kind))throw new Error('Recording stage/kind does not match request '+request.call)
    if(row.error)throw new Error(row.error)
    return structuredClone(row)
  }
}

export async function runGenerationRunCli(args){
  if(args.length!==3)throw new Error('Usage: generation-run.mjs REQUEST.json RESPONSES.json NEW_OUTPUT_DIRECTORY')
  const requestPath=resolve(args[0]),recordingPath=resolve(args[1]),out=resolve(args[2])
  if(existsSync(out)&&readdirSync(out).length)throw new Error('Choose a new or empty output directory; run evidence must not be overwritten')
  const raw=readFileSync(requestPath,'utf8'),recorded=readFileSync(recordingPath,'utf8')
  const request=JSON.parse(raw),recording=JSON.parse(recorded),ref=request.template
  if(recording.version!==1)throw new Error('Recording version must be 1')
  const complete=recordedGenerationAdapter(recording.responses)
  if(!ref||typeof ref.path!=='string'||!['zip','pptx'].includes(ref.format))throw new Error('Request requires template:{format:zip|pptx,path,...}')
  mkdirSync(out,{recursive:true})
  writeFileSync(join(out,'request.json'),raw,{flag:'wx'})
  writeFileSync(join(out,'responses.json'),recorded,{flag:'wx'})
  const journalPath=join(out,'journal.jsonl')
  writeFileSync(journalPath,'',{flag:'wx'})
  try{
    const source=resolve(dirname(requestPath),ref.path)
    const template=ref.format==='zip'?readTemplateBundle(source):await templateFromPptxScene(source,{templateId:ref.id,name:ref.name})
    const result=await runCompactGeneration({mode:request.mode,brief:request.brief,dataMode:request.dataMode??'factual',context:request.context,assets:request.assets??{},manualInterventions:request.manualInterventions??[],template,complete,
      onEvent:event=>appendFileSync(journalPath,JSON.stringify(event)+'\n'),
      exportDeck:create=>buildDeckAsync({...create,outputDir:join(out,'deck')})})
    const {composition,journal,...summary}=result
    const report={...summary,replay:true,recordingProvenance:recording.provenance??null,compositionReport:composition?.report??null,compositionDiagnostics:composition?.diagnostics??[],journalPath,recordedResponses:recording.responses.length,unusedResponses:recording.responses.length-result.calls}
    writeFileSync(join(out,'result.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'})
    return report
  }catch(e){
    appendFileSync(journalPath,JSON.stringify({type:'fatal',at:new Date().toISOString(),code:e.code??'generation-run',message:e.message,diagnostics:e.diagnostics??[]})+'\n')
    throw e
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{const result=await runGenerationRunCli(process.argv.slice(2));process.stdout.write(JSON.stringify(result,null,2)+'\n');if(result.status!=='exported')process.exitCode=1}
  catch(e){process.stdout.write(JSON.stringify({valid:false,code:e.code??'generation-run',message:e.message,diagnostics:e.diagnostics??[]},null,2)+'\n');process.exitCode=1}
}
