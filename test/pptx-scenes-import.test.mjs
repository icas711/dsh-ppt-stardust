import test from 'node:test'
import assert from 'node:assert/strict'
import {fixtures} from './fixtures/pptx/generate.mjs'
import {importPptxScenes} from '../skills/dsh-ppt/scripts/deck-pptx-scenes.mjs'
for(const fixture of fixtures())test('native scene import: '+fixture.id,async()=>{
 const result=await importPptxScenes(fixture.bytes)
 assert.equal(result.pageSize.width,9906000);assert.equal(result.pageSize.height,6858000)
 const elements=result.slides[0].elements
 if(fixture.id==='dense')assert.equal(elements.filter(e=>e.type==='text').length,13)
 if(fixture.id==='groups'){assert.equal(elements.filter(e=>e.type==='group').length,2);assert.equal(elements.filter(e=>e.type==='text').length,4)}
 if(fixture.id==='artwork'){assert.equal(elements.filter(e=>e.type==='image').length,13);assert.equal(elements.filter(e=>e.type==='line').length,1)}
 if(fixture.id==='objects'){
  assert.equal(elements.filter(e=>e.type==='chart').length,1);assert.equal(elements.find(e=>e.type==='chart').chart.series[0].name,'Series');assert.equal(elements.filter(e=>e.type==='table').length,1)
  const ole=elements.find(e=>e.type==='unsupported');assert.ok(ole.previewAssetId);assert.equal(ole.support.mode,'preview')
  assert.ok(!JSON.stringify(result).includes('SYNTHETIC-OLE-DO-NOT-COPY'))
  assert.ok(result.report.objects.some(o=>o.mode==='preview'&&o.slide===1&&o.shapeId==='50'&&o.reason))
 }else assert.deepEqual(result.report.objects.filter(o=>o.mode!=='native'),[])
})

test('image backgrounds survive scene-template roundtrips as native slide backgrounds',async()=>{
 const {unzipSync,zipSync,strToU8}=await import('fflate'),lib=await import('@office-kit/pptx')
 const {buildPptx,resolveTheme,resolveLanguage}=await import('../skills/dsh-ppt/scripts/deck-core.mjs')
 const fixture=fixtures().find(f=>f.id==='artwork'),source=await lib.loadPresentation(fixture.bytes)
 lib.setSlideBackgroundImage(lib.getSlides(source)[0],unzipSync(fixture.bytes)['ppt/media/preview.png'])
 const imported=await importPptxScenes(await lib.savePresentation(source))
 assert.ok(imported.slides[0].backgroundAssetId)
 const bytes=buildPptx({slides:imported.slides,assets:imported.assets,style:{pageSize:imported.pageSize}},resolveTheme('swiss'),resolveLanguage('en'))
 const parts=unzipSync(bytes),xml=Buffer.from(parts['ppt/slides/slide1.xml']).toString()
 assert.match(xml,/<p:bg>[\s\S]*<a:blip r:embed="rIdScene1"/)
 assert.equal(Object.keys(parts).filter(k=>k.startsWith('ppt/media/')).length,1,'Background and logos share their validated image asset')
 const custom=unzipSync(fixtures().find(f=>f.id==='typography').bytes)
 custom['ppt/slides/slide1.xml']=strToU8(Buffer.from(custom['ppt/slides/slide1.xml']).toString().replaceAll('<a:latin typeface="Liberation Sans"/>','<a:latin typeface="Liberation Sans" panose="020B0604020202020204" charset="204"/>').replace('<a:srgbClr val="CF1F2F"/>','<a:srgbClr val="CF1F2F"><a:lumMod val="90000"/></a:srgbClr>'))
 const styled=await importPptxScenes(zipSync(custom)),run=styled.slides[0].elements.find(e=>e.type==='text').paragraphs[0].runs[0]
 assert.equal(run.style.fontHints.panose,'020B0604020202020204');assert.equal(run.style.fontHints.charset,204)
 assert.equal(run.style.colorSpec.base,'#CF1F2F');assert.deepEqual(run.style.colorSpec.transforms,[{name:'lumMod',value:90000}])
})
