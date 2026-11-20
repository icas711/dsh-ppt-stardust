#!/usr/bin/env node
// Read-only CLI for the experimental contract. JSON output only.
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {generationSpecSchema,generationBriefSchema,validateGenerationBrief,validateGenerationSpec,generationSpecToContent} from '../skills/dsh-ppt/scripts/deck-generation-spec.mjs'

export function runGenerationSpecCli(args){
  const [command,inputPath,contextPath,...extra]=args
  if(extra.length)throw new Error('Too many arguments')
  if(command==='schema'&&!inputPath)return generationSpecSchema()
  if(command==='brief-schema'&&!inputPath)return generationBriefSchema()
  if(!['validate','content','validate-brief'].includes(command)||!inputPath||((command==='validate'||command==='content')&&!contextPath))throw new Error('Usage: generation-spec.mjs schema | brief-schema | validate-brief BRIEF.json | validate SPEC.json CONTEXT.json | content SPEC.json CONTEXT.json')
  const input=JSON.parse(readFileSync(resolve(inputPath),'utf8'))
  if(command==='validate-brief')return validateGenerationBrief(input)
  const context=JSON.parse(readFileSync(resolve(contextPath),'utf8'))
  if(!context||typeof context!=='object'||Array.isArray(context))throw new Error('Context must be an object containing sources and optional assetIds/iconIds')
  return command==='content'?generationSpecToContent(input,context):validateGenerationSpec(input,context)
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const output=runGenerationSpecCli(process.argv.slice(2))
    process.stdout.write(JSON.stringify(output,null,2)+'\n')
    if(output.valid===false)process.exitCode=1
  }catch(error){
    process.stdout.write(JSON.stringify({valid:false,diagnostics:error.diagnostics??[{severity:'error',code:'generation-input',path:'input',message:error.message}]},null,2)+'\n')
    process.exitCode=1
  }
}
