// Opt-in end-to-end native PowerPoint comparison. Private content stays in the output directory.
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs'
import {resolve,join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {importPptxScenes} from '../skills/dsh-ppt/scripts/deck-pptx-scenes.mjs'
import {templateFromSceneManifest,buildTemplateBundle,readTemplateBundle,templateCreateOptions} from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import {buildDeckAsync} from '../skills/dsh-ppt/scripts/deck-advanced.mjs'
import {transformedBounds} from '../skills/dsh-ppt/scripts/deck-geometry.mjs'
const exec=promisify(execFile)
const [source,outArg]=process.argv.slice(2)
if(!source||process.platform!=='win32')throw new Error('Usage on Windows with PowerPoint: node scripts/golden-pptx-scene-native.mjs SOURCE.pptx OUTPUT')
const out=resolve(outArg??'.test-output/golden-scene-native'),original=resolve(source)
if(dirname(original)===out)throw new Error('Use a separate output directory')
mkdirSync(out,{recursive:true})
const imported=await importPptxScenes(readFileSync(original))
const extracted=templateFromSceneManifest({...imported,style:{pageSize:imported.pageSize}},{templateId:'golden-scene',name:'Golden fixture'})
writeFileSync(join(out,'template.zip'),buildTemplateBundle(extracted.manifest,extracted.assets))
const bundle=readTemplateBundle(join(out,'template.zip'))
const selections=bundle.manifest.style.layouts.map((layout,i)=>({layoutId:layout.id,values:Object.fromEntries(layout.slots.map(slot=>{const e=imported.slides[i].elements.find(e=>e.id===slot.elementId);return [slot.id,e.type==='text'?e.paragraphs:e.type==='image'?e.assetId:e[e.type]]}))}))
const {create}=templateCreateOptions(bundle.manifest,bundle.assets,{title:'Golden scene roundtrip',selections,assets:imported.assets})
create.slides.forEach((s,i)=>{s.notes=imported.slides[i].notes})
const built=await buildDeckAsync({...create,outputDir:out,fileName:'actual',lang:'ru',overwrite:true})
copyFileSync(original,join(out,'source.pptx'))
writeFileSync(join(out,'import-report.json'),JSON.stringify(imported.report,null,2))
const script=fileURLToPath(new URL('./golden-pptx-render.ps1',import.meta.url))
for(const only of ['source','actual']){
 await exec('pwsh',['-NoProfile','-NonInteractive','-File',script,'-SourcePath',join(out,'source.pptx'),'-ActualPath',built.pptxPath,'-OutputDirectory',out,'-Only',only],{timeout:120000,maxBuffer:4*1024*1024,windowsHide:true})
 console.log('Native PowerPoint rendered: '+only)
}
const native=JSON.parse(readFileSync(join(out,'source-properties.json'),'utf8').replace(/^\uFEFF/,'')),actual=JSON.parse(readFileSync(join(out,'actual-properties.json'),'utf8').replace(/^\uFEFF/,'')),differences=[]
for(const expected of native.filter(p=>!p.excludedField)){
 const index=actual.findIndex(p=>p.slide===expected.slide&&p.text===expected.text)
 if(index<0){differences.push({slide:expected.slide,code:'missing-native-text',name:expected.name});continue}
 const found=actual.splice(index,1)[0]
 for(const key of ['bold','colorRgb','alignment'])if(found[key]!==expected[key])differences.push({slide:expected.slide,code:'native-'+key,name:expected.name})
}
writeFileSync(join(out,'native-differences.json'),JSON.stringify(differences,null,2))
const inputs={files:{source:original,actual:built.pptxPath},slides:imported.slides.map((s,i)=>({regions:s.elements.filter(e=>e.type!=='group'&&!e.hidden).map(e=>{const box=transformedBounds(e.frame,e.transform);return {id:e.id,...Object.fromEntries(['x','y','w','h'].map(k=>[k,box[k]/(['x','w'].includes(k)?imported.pageSize.width:imported.pageSize.height)*100]))}}),unmapped:imported.report.objects.filter(o=>o.slide===i+1&&o.mode==='unsupported'&&!s.elements.find(e=>e.id===o.elementId)?.hidden)}))}
writeFileSync(join(out,'inputs.json'),JSON.stringify(inputs,null,2))
const metrics=await exec(process.env.DSH_PPT_GOLDEN_PYTHON??'python',[fileURLToPath(new URL('./golden-pptx-metrics.py',import.meta.url)),out],{timeout:120000,maxBuffer:16*1024*1024})
const report=JSON.parse(metrics.stdout)
console.log(JSON.stringify({passed:report.passed,slides:report.slides.map(s=>({slide:s.slide,ssim:s.wholeSlide.ssim,unmapped:s.unmapped.length})),nativeDifferences:differences.length,out},null,2))
if(!report.passed)process.exitCode=1
