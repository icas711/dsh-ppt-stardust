#!/usr/bin/env node
// Reproducible synthetic review artifact; no LLM and no user attachments.
import {mkdirSync,readdirSync,writeFileSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {template,context,spec,picture} from '../test/fixtures/generation-components.mjs'
import {buildTemplateBundle} from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import {runGenerationComposeCli} from './generation-compose.mjs'

export async function createComponentsDemo(directory){
  const root=resolve(directory);mkdirSync(root,{recursive:true})
  if(readdirSync(root).length)throw new Error('Demo output directory must be empty; existing files are preserved')
  const t=template(),input=spec();input.mode='demo';input.title='Компоненты генерации — синтетический пример'
  const request={template:{format:'zip',path:'template.zip'},spec:input,context:{sources:context.sources.map(s=>({...s,synthetic:true}))},assets:{photo:picture()},allowMoreSlides:true}
  writeFileSync(join(root,'template.zip'),buildTemplateBundle(t.manifest,t.assets),{flag:'wx'})
  writeFileSync(join(root,'request.json'),JSON.stringify(request,null,2)+'\n',{flag:'wx'})
  const made=await runGenerationComposeCli([join(root,'request.json'),join(root,'output')])
  writeFileSync(join(root,'composition-report.json'),JSON.stringify({report:made.compositionReport,diagnostics:made.compositionDiagnostics},null,2)+'\n',{flag:'wx'})
  return made
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{process.stdout.write(JSON.stringify(await createComponentsDemo(process.argv[2]??'.test-output/generation-components-demo'),null,2)+'\n')}
  catch(e){process.stderr.write(e.message+'\n');process.exitCode=1}
}
