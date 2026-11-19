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
  assert.equal(elements.filter(e=>e.type==='chart').length,1);assert.equal(elements.filter(e=>e.type==='table').length,1)
  const ole=elements.find(e=>e.type==='unsupported');assert.ok(ole.previewAssetId);assert.equal(ole.support.mode,'preview')
  assert.ok(!JSON.stringify(result).includes('SYNTHETIC-OLE-DO-NOT-COPY'))
  assert.ok(result.report.objects.some(o=>o.mode==='preview'&&o.slide===1&&o.shapeId==='50'&&o.reason))
 }else assert.deepEqual(result.report.objects.filter(o=>o.mode!=='native'),[])
})
