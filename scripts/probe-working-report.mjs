// Local product-path probe using public fictional data; never calls a model.
import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {createHash} from 'node:crypto'
import {workingReportFixture} from '../test/fixtures/working-report.mjs'
import {templateCreateOptions,buildTemplateBundle} from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import {buildDeckAsync,checkDeck} from '../skills/dsh-ppt/scripts/deck-advanced.mjs'
const output=resolve(process.argv[2]??'.test-output/working-report'),{template,plan}=workingReportFixture()
mkdirSync(output,{recursive:true})
const {create,generationReport}=templateCreateOptions(template,{}, {title:'Учебный пилот службы поддержки',deckPlan:plan})
assert.equal(generationReport.valid,true)
const made=await buildDeckAsync({...create,outputDir:output,fileName:'working-report',lang:'ru',overwrite:false})
const check=checkDeck({deckPath:made.jsonPath})
assert.equal(check.errorCount,0,JSON.stringify(check))
const bundle=buildTemplateBundle(template,{})
writeFileSync(join(output,'working-report-template.zip'),bundle)
const report={scope:'Public fictional data; local deterministic product path, not an LLM response',templateId:template.id,slides:made.slideCount,pptxPath:made.pptxPath,plan:generationReport,quality:check,sha256:createHash('sha256').update(readFileSync(made.pptxPath)).digest('hex')}
writeFileSync(join(output,'probe.json'),JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({pptxPath:made.pptxPath,templateZip:join(output,'working-report-template.zip'),errors:check.errorCount,warnings:check.warningCount},null,2))
