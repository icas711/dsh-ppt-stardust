import test from 'node:test'
import assert from 'node:assert/strict'
import { unzipSync } from 'fflate'
import * as lib from '@office-kit/pptx'
import { sceneFixtures } from './fixtures/pptx/scenes.mjs'
import { buildPptx, renderHtml, resolveLanguage } from '../skills/dsh-ppt/scripts/deck-core.mjs'
import { renderScenePptx, scenePptxPlacement, sceneImageGeometry } from '../skills/dsh-ppt/scripts/deck-scene-pptx.mjs'
import { frameTransform } from '../skills/dsh-ppt/scripts/deck-geometry.mjs'
import { sceneFixtureTheme } from '../scripts/golden-pptx-scenes.mjs'

for (const fixture of sceneFixtures()) test(`scene serialization: ${fixture.id} keeps all objects and physical geometry`, async () => {
  const manifest = fixture.manifest, scene = manifest.slides[0]
  const pptx = buildPptx(manifest,sceneFixtureTheme(),resolveLanguage('en'))
  const pres = await lib.loadPresentation(pptx), slide = lib.getSlides(pres)[0]
  assert.deepEqual(lib.validatePresentation(pres).filter(i=>i.severity === 'error'),[])
  const shapes = lib.getSlideShapes(slide), visible = scene.elements.filter(e=>e.type !== 'group')
  assert.equal(shapes.length,visible.length)
  assert.equal(Number(lib.getSlideSize(pres).width),manifest.style.pageSize.width)
  for (const [index,e] of visible.entries()) {
    assert.equal(lib.getShapeName(shapes[index]),e.id)
    assert.deepEqual(lib.getShapeBounds(shapes[index]),e.frame)
  }
  const html = renderHtml(manifest,sceneFixtureTheme(),resolveLanguage('en'))
  assert.equal((html.match(/data-element-id=/g) ?? []).length,visible.length)
  assert.ok(html.includes('scene-canvas'))
  if (fixture.id === 'typography') {
    const style = lib.getShapeRunFormatEffective(pres,shapes[0],0,0)
    assert.equal(style.bold,true); assert.equal(style.color,'#CF1F2F')
    assert.equal(lib.getShapeRunFormatEffective(pres,shapes[0],1,0).italic,true)
    assert.match(html,/<br\/>/)
  }
  if (fixture.id === 'artwork') {
    const parts = unzipSync(pptx)
    assert.equal(Object.keys(parts).filter(n=>n.startsWith('ppt/media/')).length,1,'Repeated placements share one media part')
    assert.ok(!Object.keys(parts).some(n=>n.endsWith('.bin')))
    assert.match(Buffer.from(parts['ppt/slides/slide1.xml']).toString(),/<p:cxnSp>/)
  }
})

test('PPTX placement preserves rotation, reflection and independent scales and rejects shear', () => {
  const frame = {x:100000,y:200000,w:300000,h:400000}
  const e = {id:'shape',type:'shape',frame,transform:frameTransform(frame,{rotation:90,flipH:true})}
  assert.deepEqual(scenePptxPlacement(e),{...frame,rotation:16200000,flipV:true})
  assert.deepEqual(scenePptxPlacement({...e,transform:[2,0,0,3,0,0]}),{x:200000,y:600000,w:600000,h:1200000,rotation:0,flipV:false})
  assert.throws(()=>scenePptxPlacement({...e,transform:[1,0,.5,1,0,0]}),{code:'scene-transform-unsupported'})
})

test('scene images preserve explicit crop and fit, deduplicate across slides and reject non-image data', () => {
  const fixture = sceneFixtures().find(f=>f.id === 'artwork'), manifest = fixture.manifest
  const bytes = buildPptx({...manifest,slides:[manifest.slides[0],{...manifest.slides[0],id:'second'}]},sceneFixtureTheme(),resolveLanguage('en'))
  const parts = unzipSync(bytes)
  assert.equal(Object.keys(parts).filter(n=>n.startsWith('ppt/media/')).length,1)
  assert.match(Buffer.from(parts['ppt/slides/_rels/slide2.xml.rels']).toString(),/scene-image-1\.png/)
  const image = {id:'image',type:'image',assetId:'image',frame:{x:0,y:0,w:1000000,h:1000000}}
  assert.deepEqual(sceneImageGeometry({...image,fit:'contain'},manifest.assets.image).frame,{x:0,y:250000,w:1000000,h:500000})
  const crop = sceneImageGeometry({...image,fit:'cover',crop:{left:.1}},manifest.assets.image).crop
  for (const [key,value] of Object.entries({left:.3,right:.2,top:0,bottom:0})) assert.ok(Math.abs(crop[key]-value)<1e-12)
  const invalid = {...manifest.assets.image,data:'data:image/png;base64,'+Buffer.from('OLE binary').toString('base64')}
  assert.throws(()=>renderScenePptx({layout:'scene',elements:[image]},{assets:{image:invalid}}),{code:'invalid-image-asset'})
})

test('scene notes and per-slide arrow IDs survive serialization; unsupported content stays visibly identified', () => {
  const fixture = sceneFixtures()[0], frame = {x:100000,y:200000,w:900000,h:400000}
  const scene = {layout:'scene',label:'Scene',notes:'Notes & <keep>',elements:[{id:'arrow',type:'line',frame,stroke:{color:'#CF1F2F',width:2,head:'oval',tail:'triangle'}},{id:'ole',type:'unsupported',sourceKind:'OLE',reason:'Binary excluded',frame}]}
  const manifest = {...fixture.manifest,slides:[scene,scene]}
  const parts = unzipSync(buildPptx(manifest,sceneFixtureTheme(),resolveLanguage('en')))
  assert.match(Buffer.from(parts['ppt/notesSlides/notesSlide1.xml']).toString(),/Notes &amp; &lt;keep&gt;/)
  assert.match(Buffer.from(parts['ppt/slides/slide1.xml']).toString(),/Unsupported object: OLE/)
  const html = renderHtml(manifest,sceneFixtureTheme(),resolveLanguage('en'))
  assert.match(html,/id="scene-0-arrow-0-end"/)
  assert.match(html,/id="scene-1-arrow-0-end"/)
  assert.match(html,/data-notes="Notes &amp; &lt;keep&gt;"/)
  assert.ok(!Object.keys(parts).some(n=>n.endsWith('.bin')))
})

test('overriding one script font in a run retains the other inherited script font', async ()=>{
  const fixture = sceneFixtures()[0], scene = structuredClone(fixture.manifest.slides[0])
  scene.elements = [scene.elements[0]]
  scene.elements[0].textStyle.scriptFonts = {eastAsian:'Microsoft YaHei',complexScript:'Arial'}
  scene.elements[0].paragraphs[0].runs[0].style = {scriptFonts:{complexScript:'Georgia'}}
  const pres = await lib.loadPresentation(buildPptx({...fixture.manifest,slides:[scene]},sceneFixtureTheme(),resolveLanguage('en')))
  const style = lib.getShapeRunFormatEffective(pres,lib.getSlideShapes(lib.getSlides(pres)[0])[0],0,0)
  assert.equal(style.fontEastAsian,'Microsoft YaHei')
  assert.equal(style.fontComplexScript,'Georgia')
})
