// Local diagnostic only. SDK controls retain the original package, including attachments.
// This is NOT the template/export pipeline and must not be used to publish sanitized files.
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,statSync,existsSync} from 'node:fs'
import {resolve,join,posix,relative,isAbsolute,sep} from 'node:path'
import {createHash} from 'node:crypto'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {fileURLToPath} from 'node:url'
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate'
import * as sdk from '@office-kit/pptx'
import {importPptxScenes} from '../skills/dsh-ppt/scripts/deck-pptx-scenes.mjs'
import {buildDeckAsync} from '../skills/dsh-ppt/scripts/deck-advanced.mjs'

const [sourceArg,outArg,...flags]=process.argv.slice(2)
if(!sourceArg||!outArg)throw new Error('Usage: node scripts/diagnose-pptx-fidelity.mjs SOURCE.pptx OUTPUT [--render]')
const source=resolve(sourceArg),out=resolve(outArg),exec=promisify(execFile)
const rel=relative(out,source)
if(rel!=='..'&&!rel.startsWith('..'+sep)&&!isAbsolute(rel))throw new Error('Use a separate output directory')
mkdirSync(out,{recursive:true})
if(statSync(source).size>64*1024*1024)throw new Error('Source exceeds 64 MiB')
const bytes=readFileSync(source),hash=b=>createHash('sha256').update(b).digest('hex')
if(existsSync(join(out,'controls.json'))&&JSON.parse(readFileSync(join(out,'controls.json'),'utf8')).sourceSha256!==hash(bytes))throw new Error('Output directory belongs to a different source; use a new directory')
const imported=await importPptxScenes(bytes)
const parts=unzipSync(bytes),pres=await sdk.loadPresentation(bytes)
const noop=await sdk.savePresentation(pres)
const changes=b=>{const next=unzipSync(b);return {changed:Object.keys(parts).filter(k=>next[k]&&hash(parts[k])!==hash(next[k])),removed:Object.keys(parts).filter(k=>!next[k]),added:Object.keys(next).filter(k=>!parts[k])}}
const noopChanges=changes(noop)
let edit
function findText(shapes){for(const s of shapes){if(sdk.getShapeKind(s)==='group'){const found=findText(sdk.getGroupChildren(s));if(found)return found}else{try{const text=sdk.getShapeRunText(s,0,0);if(text?.trim())return {shape:s,text}}catch{}}}}
for(const [i,s] of sdk.getSlides(pres).entries()){
 if(i!==1)continue
 const found=findText(sdk.getSlideShapes(s))
 if(found){sdk.setShapeRunText(found.shape,0,0,found.text.replace(/\S/g,'X'));edit={slide:i+1,shapeId:sdk.getShapeId(found.shape),part:sdk.getSlidePartName(s)}}
}
if(!edit)throw new Error('No editable text run found on slide 2')
const patched=await sdk.savePresentation(pres),patchChanges=changes(patched)
// Rewriting an unchanged chart spec is a separate control: setChartSpec rebuilds XML.
const chartPres=await sdk.loadPresentation(bytes),chartEntry=sdk.getAllCharts(chartPres).find(c=>c.slideIndex===5)
let chartRewrite
if(chartEntry){sdk.setChartSpec(chartEntry.chart,chartEntry.chart.spec);chartRewrite=await sdk.savePresentation(chartPres)}
writeFileSync(join(out,'imported-scenes.json'),JSON.stringify(imported,null,2))
const directDir=join(out,'direct');mkdirSync(directDir,{recursive:true})
const build=async(slides,dir)=>buildDeckAsync({title:'Diagnostic scene',slides,assets:imported.assets,style:{fonts:imported.fonts,pageSize:imported.pageSize,themeFonts:imported.themeFonts},outputDir:dir,fileName:'actual',lang:'ru',overwrite:true})
const direct=await build(imported.slides,directDir)
const controls={noop,patch:patched,direct:readFileSync(direct.pptxPath)}
if(chartRewrite)controls['chart-rewrite']=chartRewrite
const report={sourceSha256:hash(bytes),noop:noopChanges,patch:{...patchChanges,edit},slides:imported.slides.map((s,i)=>({slide:i+1,types:Object.fromEntries([...new Set(s.elements.map(e=>e.type))].map(t=>[t,s.elements.filter(e=>e.type===t).length])),unsupported:imported.report.objects.filter(o=>o.slide===i+1&&o.mode!=='native').map(({slide,elementId,shapeId,kind,mode,reason})=>({slide,elementId,shapeId,kind,mode,reason}))}))}
if(chartRewrite)report.chartRewrite=changes(chartRewrite)
if(chartRewrite){
 const changed=unzipSync(chartRewrite),chartPart=report.chartRewrite.changed.find(k=>/^ppt\/charts\/[^/]+\.xml$/.test(k))
 const relPart=chartPart&&posix.join(posix.dirname(chartPart),'_rels',posix.basename(chartPart)+'.rels')
 const rels=relPart&&changed[relPart]&&strFromU8(changed[relPart]),xml=chartPart&&strFromU8(changed[chartPart])
 const packageRel=(rels?.match(/<Relationship\s[^>]*\/?>/g)??[]).find(r=>/Type="[^"]*\/package"/.test(r)),expectedId=packageRel&&/\bId="([^"]+)"/.exec(packageRel)?.[1]
 const actualId=xml&&/<c:externalData\b[^>]*r:id="([^"]+)"/.exec(xml)?.[1]
 report.chartRewrite.relationship={chartPart,expectedId,actualId,valid:expectedId===actualId}
 if(expectedId&&actualId&&expectedId!==actualId){
  changed[chartPart]=strToU8(xml.replace(/(<c:externalData\b[^>]*r:id=")[^"]+"/,'$1'+expectedId+'"'))
  controls['chart-rewrite-fixed-rel']=zipSync(changed)
 }
}
if(flags.includes('--ablations')){
 // Isolate visual noise introduced by diagnostic placeholders; missing content remains missing.
 const quiet=structuredClone(imported.slides)
 for(const slide of quiet)for(const e of slide.elements)if(e.type==='unsupported')e.hidden=true
 const quietBuilt=await build(quiet,join(out,'quiet'))
 controls.quiet=readFileSync(quietBuilt.pptxPath)
 // Isolate lost chart colors. Resolve source fills using SDK shape color resolution,
 // which supports the source theme and color transforms; never guess chart numbers.
 const colors=structuredClone(imported.slides),probeParts={...parts},probes=[]
 const sourcePres=await sdk.loadPresentation(bytes)
 for(const [i,slide]of sdk.getSlides(sourcePres).entries()){
  const part=sdk.getSlidePartName(slide).replace(/^\//,''),rels=parts[posix.join(posix.dirname(part),'_rels',posix.basename(part)+'.rels')]
  let extra='',ordinal=0
  for(const {shape}of sdk.getSlideCharts(slide)){
   const e=colors[i].elements.find(e=>e.type==='chart'&&e.source?.shapeId===String(sdk.getShapeId(shape)))
   if(!e)continue
   const rid=/<c:chart\b[^>]*r:id="([^"]+)"/.exec(sdk.getShapeXmlString(shape))?.[1]
   const rel=(strFromU8(rels??new Uint8Array()).match(/<Relationship\s[^>]*\/?>/g)??[]).find(r=>r.includes('Id="'+rid+'"'))
   if(!rel||/TargetMode="External"/.test(rel))continue
   const target=/Target="([^"]+)"/.exec(rel)?.[1],key=target?.startsWith('/')?target.slice(1):posix.normalize(posix.join(posix.dirname(part),target??''))
   const xml=parts[key]&&strFromU8(parts[key])
   for(const [j,m]of [...(xml?.matchAll(/<c:ser\b[^>]*>([\s\S]*?)<\/c:ser>/g)??[])].entries()){
    const add=(fragment,point)=>{const sp=/<c:spPr\b[^>]*>([\s\S]*?)<\/c:spPr>/.exec(fragment)?.[1];if(!sp||!/<a:solidFill>/.test(sp.split('<a:ln')[0]))return
     const id=100000+(ordinal++);extra+=`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Color probe"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${sp}</p:spPr></p:sp>`;probes.push({i,id,elementId:e.id,series:j,point})}
    add(m[1].replace(/<c:dPt\b[^>]*>[\s\S]*?<\/c:dPt>/g,''))
    for(const point of m[1].matchAll(/<c:dPt\b[^>]*>([\s\S]*?)<\/c:dPt>/g))add(point[1],Number(/<c:idx val="(\d+)"/.exec(point[1])?.[1]))
   }
  }
  probeParts[part]=strToU8(strFromU8(parts[part]).replace('</p:spTree>',extra+'</p:spTree>'))
 }
 const probePres=await sdk.loadPresentation(zipSync(probeParts)),resolved=[]
 for(const p of probes){const shape=sdk.getSlideShapes(sdk.getSlides(probePres)[p.i]).find(s=>sdk.getShapeId(s)===p.id),color=sdk.getShapeFillColorResolved(probePres,shape)
  if(!/^#[\da-f]{6}$/i.test(color??''))continue
  const series=colors[p.i].elements.find(e=>e.id===p.elementId).chart.series[p.series]
  if(p.point!==undefined&&(!Number.isInteger(p.point)||p.point<0||p.point>=series.values.length))continue
  if(p.point===undefined)series.color=color
  else{series.pointColors??=Array(series.values.length).fill(null);series.pointColors[p.point]=color}
  resolved.push({...p,color})
 }
 report.chartColorRestorations=resolved
 const colorBuilt=await build(colors,join(out,'chart-colors'));controls['chart-colors']=readFileSync(colorBuilt.pptxPath)
}
writeFileSync(join(out,'controls.json'),JSON.stringify(report,null,2))
for(const [name,data] of Object.entries(controls)){
 const dir=join(out,name);mkdirSync(dir,{recursive:true});writeFileSync(join(dir,'actual.pptx'),data)
 if(flags.includes('--render')&&(!flags.some(f=>f.startsWith('--render-only='))||flags.includes('--render-only='+name))){
  if(process.platform!=='win32')throw new Error('Native rendering requires Windows PowerPoint')
  copyFileSync(source,join(dir,'source.pptx'))
  try{
   for(const only of name==='noop'?['source','actual']:['actual'])await exec('pwsh',['-NoProfile','-NonInteractive','-File',fileURLToPath(new URL('./golden-pptx-render.ps1',import.meta.url)),'-SourcePath',join(dir,'source.pptx'),'-ActualPath',join(dir,'actual.pptx'),'-OutputDirectory',dir,'-Only',only],{timeout:120000,maxBuffer:4*1024*1024,windowsHide:true})
   console.log('Rendered '+name)
  }catch(error){(report.nativeErrors??=[]).push({control:name,message:error.stderr??error.message});console.error('Native render failed: '+name);process.exitCode=1}
 }
}
report.sourceUnmodified=hash(readFileSync(source))===report.sourceSha256
writeFileSync(join(out,'controls.json'),JSON.stringify(report,null,2))
if(!report.sourceUnmodified)throw new Error('Source changed during diagnosis')
console.log(JSON.stringify({out,noop:noopChanges,patch:patchChanges,edit},null,2))
