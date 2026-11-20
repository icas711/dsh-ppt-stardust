#!/usr/bin/env node
// Explicit local inspection only; does not register templates or write artifacts.
import {pathToFileURL} from 'node:url'
import {resolve} from 'node:path'
import {readTemplateBundle} from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import {prepareGenerationTemplateFromPptx,prepareGenerationTemplateProfile} from '../skills/dsh-ppt/scripts/deck-generation-profile.mjs'

export async function runGenerationProfileCli(args){
  const [command,path,...options]=args
  if(command==='pptx'&&path&&options.length===3){
    const [templateId,name,scope]=options
    return prepareGenerationTemplateFromPptx(resolve(path),{templateId,name,scope})
  }
  if(command==='zip'&&path&&options.length===1){
    return prepareGenerationTemplateProfile(readTemplateBundle(resolve(path)),{scope:options[0]})
  }
  throw new Error('Usage: generation-profile.mjs pptx SOURCE.pptx TEMPLATE_ID NAME SCOPE | zip TEMPLATE.zip SCOPE')
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const result=await runGenerationProfileCli(process.argv.slice(2))
    process.stdout.write(JSON.stringify(result,null,2)+'\n')
    if(!result.valid)process.exitCode=1
  }catch(e){
    process.stdout.write(JSON.stringify({valid:false,profile:null,diagnostics:[{severity:'error',code:'profile-input',path:'input',message:e.message}]},null,2)+'\n')
    process.exitCode=1
  }
}
