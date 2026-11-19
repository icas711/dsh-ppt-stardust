import test from 'node:test'
import assert from 'node:assert/strict'
import {sceneContrastIssues,colorContrast} from '../skills/dsh-ppt/scripts/deck-scene-quality.mjs'
import {checkManifest} from '../skills/dsh-ppt/scripts/deck-advanced.mjs'
const frame={x:100,y:100,w:100,h:100}
const text=(color='#242424')=>({id:'text',type:'text',frame,paragraphs:[{runs:[{text:'Readable fact',style:{color}}]}]})
const check=(elements,extra={})=>sceneContrastIssues({elements,...extra},{background:'#070B14',textColor:'#E8F1FF'})
test('scene contrast uses actual run colours, slide fill and opaque backing shapes',()=>{
 assert.ok(colorContrast('#242424','#070B14')<1.3)
 assert.equal(check([text()])[0].code,'low-contrast')
 assert.deepEqual(check([text()],{backgroundColor:'#FFFFFF'}),[])
 const backing={id:'backing',type:'shape',preset:'rect',frame,fill:{color:'#FFFFFF'}}
 assert.deepEqual(check([backing,text()]),[])
 assert.equal(check([text(),backing])[0].code,'low-contrast','later shape is not the background')
 assert.equal(check([{...backing,fill:{color:'#FFFFFF',opacity:.01}},text()])[0].code,'low-contrast')
 assert.equal(check([{...backing,preset:'roundRect',fill:{color:'#070B14'}},text()])[0].code,'low-contrast')
 const mixed=text('#FFFFFF');mixed.paragraphs[0].runs.push({text:' dark',style:{color:'#242424'}})
 assert.equal(check([mixed])[0].code,'low-contrast')
})
test('evaluation ZIP generates a light native PPTX and warns on the original dark fallback',async t=>{
 const {mkdtempSync,rmSync,writeFileSync,readFileSync}=await import('node:fs'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{unzipSync,strFromU8}=await import('fflate')
 const {generationEvaluationCases}=await import('./fixtures/generation-evaluation.mjs'),{buildTemplateBundle,readTemplateBundle,templateCreateOptions}=await import('../skills/dsh-ppt/scripts/deck-templates.mjs'),{buildDeckAsync}=await import('../skills/dsh-ppt/scripts/deck-advanced.mjs')
 const dir=mkdtempSync(join(tmpdir(),'scene-contrast-'));t.after(()=>rmSync(dir,{recursive:true,force:true}))
 const fixture=generationEvaluationCases().find(c=>c.id==='mixed-deck'),path=join(dir,'template.zip')
 writeFileSync(path,buildTemplateBundle(fixture.template,{}));const bundle=readTemplateBundle(path)
 const {create}=templateCreateOptions(bundle.manifest,bundle.assets,{title:'Readability',deckPlan:fixture.referencePlan})
 const built=await buildDeckAsync({...create,outputDir:dir,lang:'en'}),parts=unzipSync(readFileSync(built.pptxPath))
 assert.ok(strFromU8(parts['ppt/slides/slide1.xml']).includes('val="FFFFFF"'))
 assert.equal(built.quality.issues.filter(i=>i.code==='low-contrast'||i.code==='contrast-unverified').length,0)
 const bad=structuredClone(bundle.manifest);bad.style.theme='data';delete bad.style.brand;bad.style.layouts.forEach(l=>delete l.backgroundColor)
 const original=templateCreateOptions(bad,{}, {title:'Original dark fallback',deckPlan:fixture.referencePlan}).create
 assert.equal(new Set(checkManifest({theme:'data',slides:original.slides,style:original.style}).issues.filter(i=>i.code==='low-contrast').map(i=>i.slide)).size,8)
})
test('images, partial backings and transformed colours are reported as unverified',()=>{
 const image={id:'photo',type:'image',frame,assetId:'photo'}
 assert.equal(check([image,text()])[0].code,'contrast-unverified')
 assert.equal(check([text()],{backgroundAssetId:'photo'})[0].code,'contrast-unverified')
 assert.equal(check([{id:'shape',type:'shape',preset:'rect',frame:{...frame,w:50},fill:{color:'#FFFFFF'}},text()])[0].code,'contrast-unverified')
 const value=text();value.paragraphs[0].runs[0].style.colorSpec={base:'#242424',transforms:[{name:'alpha',value:50000}]}
 assert.equal(check([value])[0].code,'contrast-unverified')
 assert.deepEqual(check([{...text(),hidden:true}]),[])
})
test('scene contrast handles table fills and checkManifest emits an addressed warning',()=>{
 const table={id:'table',type:'table',frame,table:{cells:[{fill:'#FFFFFF',paragraphs:text().paragraphs}]}}
 assert.deepEqual(check([table]),[])
 delete table.table.cells[0].fill;assert.equal(check([table])[0].code,'low-contrast')
 const result=checkManifest({theme:'data',slides:[{id:'slide',layout:'scene',elements:[text()]}]})
 assert.ok(result.issues.some(i=>i.code==='low-contrast'&&i.elementId==='text'&&i.slideId==='slide'))
})
