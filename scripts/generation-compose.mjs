#!/usr/bin/env node
import {readFileSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {pathToFileURL} from 'node:url'
import {readTemplateBundle,templateFromPptxScene} from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import {composeGenerationSpec} from '../skills/dsh-ppt/scripts/deck-generation-compose.mjs'
import {buildDeckAsync} from '../skills/dsh-ppt/scripts/deck-advanced.mjs'

export async function runGenerationComposeCli(args){
  if(args.length!==2)throw new Error('Usage: generation-compose.mjs REQUEST.json OUTPUT_DIRECTORY')
  const requestPath=resolve(args[0]),request=JSON.parse(readFileSync(requestPath,'utf8'))
  const ref=request?.template
  if(!ref||typeof ref.path!=='string'||!['zip','pptx'].includes(ref.format))throw new Error('Request requires template:{format:zip|pptx,path,...}')
  const source=resolve(dirname(requestPath),ref.path)
  const template=ref.format==='zip'?readTemplateBundle(source):await templateFromPptxScene(source,{templateId:ref.id,name:ref.name})
  const result=composeGenerationSpec(request.spec,{template,context:request.context,assets:request.assets??{},allowMoreSlides:request.allowMoreSlides??false,maxSlides:request.maxSlides??120})
  const made=await buildDeckAsync({...result.create,outputDir:resolve(args[1])})
  return {...made,compositionReport:result.report,compositionDiagnostics:result.diagnostics}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{process.stdout.write(JSON.stringify(await runGenerationComposeCli(process.argv.slice(2)),null,2)+'\n')}
  catch(e){process.stdout.write(JSON.stringify({valid:false,code:e.code??'generation-compose',message:e.message,...(e.slideId?{slideId:e.slideId}:{}),...(e.path?{path:e.path}:{}),...(e.diagnostics?{diagnostics:e.diagnostics}:{})},null,2)+'\n');process.exitCode=1}
}
