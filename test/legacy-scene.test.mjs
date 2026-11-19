import test from 'node:test'
import assert from 'node:assert/strict'
import * as lib from '@office-kit/pptx'
import { buildPptx, resolveLanguage } from '../skills/dsh-ppt/scripts/deck-core.mjs'
import { legacySlidesToScenes } from '../skills/dsh-ppt/scripts/deck-legacy.mjs'
import { renderSceneHtml } from '../skills/dsh-ppt/scripts/deck-scene-html.mjs'
import { sceneFixtureTheme } from '../scripts/golden-pptx-scenes.mjs'
import { legacyFixtureStates, sceneFixtures } from './fixtures/pptx/scenes.mjs'
import { createHash } from 'node:crypto'
import { frameTransform } from '../skills/dsh-ppt/scripts/deck-geometry.mjs'

for (const fixture of legacyFixtureStates()) test(`legacy adapter: ${fixture.id} preserves geometry, runs, notes and stable IDs`, async ()=>{
  const source = structuredClone(fixture.manifest), theme = sceneFixtureTheme()
  const adapted = await legacySlidesToScenes(source,{theme})
  assert.deepEqual(source,fixture.manifest,'Adapter must not mutate project state')
  assert.deepEqual(await legacySlidesToScenes(source,{theme}),adapted)
  const s = adapted.slides[0]
  assert.equal(s.id,source.slides[0].id); assert.equal(s.notes,source.slides[0].notes)
  for (const key of ['title','subtitle','kicker','bullets','text']) assert.ok(!Object.hasOwn(s,key))
  const before = await lib.loadPresentation(buildPptx(source,theme,resolveLanguage('en')))
  const after = await lib.loadPresentation(buildPptx({...source,assets:adapted.assets,slides:adapted.slides},theme,resolveLanguage('en')))
  assert.deepEqual(lib.validatePresentation(after).filter(e=>e.severity === 'error'),[])
  const original = lib.getSlideShapes(lib.getSlides(before)[0]), result = lib.getSlideShapes(lib.getSlides(after)[0])
  assert.equal(result.length,original.length)
  for (let i=0;i<result.length;i++) {
    assert.equal(lib.getShapeText(result[i]),lib.getShapeText(original[i]))
    assert.deepEqual(lib.getShapeBounds(result[i]),lib.getShapeBounds(original[i]))
    if (s.elements[i].type === 'text') assert.ok(!Object.hasOwn(s.elements[i].textFrame,'margins'),'Implicit source insets must stay implicit')
  }
  if (fixture.id === 'legacy-bullets') {
    const body = s.elements.find(e=>e.name === 'Body')
    assert.equal(body.paragraphs[0].style.bullet.character,'•')
    assert.equal(body.paragraphs[0].style.indent,-285750)
    assert.equal(body.paragraphs[0].style.spaceAfter,6)
    assert.ok(body.paragraphs[0].runs[0].style.scriptFonts.eastAsian)
    assert.match(renderSceneHtml(s,{assets:adapted.assets,style:source.style},theme),/aria-hidden="true"/)
  }
})

test('adapter IDs depend on slide identity and object role, not deck order or mutable content', async ()=>{
  const [a,b] = legacyFixtureStates(), state = {...a.manifest,slides:[a.manifest.slides[0],b.manifest.slides[0]]}, theme = sceneFixtureTheme()
  const first = await legacySlidesToScenes(state,{theme})
  const second = await legacySlidesToScenes({...state,slides:[{...state.slides[1],title:'Changed'},state.slides[0]]},{theme})
  assert.deepEqual(first.slides[0].elements.map(e=>e.id),second.slides[1].elements.map(e=>e.id))
  assert.deepEqual(first.slides[1].elements.map(e=>e.id),second.slides[0].elements.map(e=>e.id))
})

test('unimplemented legacy data bindings and tables/charts fail explicitly without changing inputs', async ()=>{
  const source = legacyFixtureStates()[0].manifest, theme = sceneFixtureTheme()
  for (const extra of [{dataModel:{}},{slides:[{id:'table',layout:'table',title:'Table',rows:[['A']]}]},{slides:[{id:'chart',layout:'chart',title:'Chart',chart:{}}]},{brand:{name:'Brand'}}]) {
    const input = {...source,...extra}, before = structuredClone(input)
    await assert.rejects(legacySlidesToScenes(input,{theme}),{code:'legacy-scene-unsupported'})
    assert.deepEqual(input,before)
  }
  const controller = new AbortController(); controller.abort()
  await assert.rejects(legacySlidesToScenes(source,{theme,signal:controller.signal}),{name:'AbortError'})
})

test('full renderer hook preserves embedded images and materializes solid/image backgrounds without copying attachments', async ()=>{
  const asset = sceneFixtures().find(f=>f.id === 'artwork').manifest.assets.image
  const bytes = Buffer.from(asset.data.split(',')[1],'base64'), id = 'img-'+createHash('sha256').update(bytes).digest('hex')
  const source = {...legacyFixtureStates()[0].manifest,brand:{name:'Brand'},assets:{[id]:asset}}
  for (const background of ['solid','image']) {
    const renderPptx = async (manifest,theme,language) => {
      const pres = await lib.loadPresentation(buildPptx(manifest,theme,language)), slide = lib.getSlides(pres)[0]
      if (background === 'solid') lib.setSlideBackground(slide,'#223344')
      else lib.setSlideBackgroundImage(slide,bytes)
      lib.addSlideImage(slide,bytes,{x:200000,y:200000,w:600000,h:300000,name:'Brand logo',fit:'fill'})
      return lib.savePresentation(pres)
    }
    const adapted = await legacySlidesToScenes(source,{theme:sceneFixtureTheme(),renderPptx})
    assert.equal(adapted.slides[0].elements[0].name,'Background')
    assert.equal(adapted.slides[0].elements[0].type,background === 'solid' ? 'shape' : 'image')
    assert.equal(adapted.slides[0].elements.at(-1).type,'image')
    assert.equal(adapted.slides[0].elements.at(-1).assetId,id)
    assert.deepEqual(Object.keys(adapted.assets),[id])
    const pres = await lib.loadPresentation(buildPptx({...source,assets:adapted.assets,slides:adapted.slides},sceneFixtureTheme(),resolveLanguage('en')))
    assert.deepEqual(lib.validatePresentation(pres).filter(e=>e.severity === 'error'),[])
  }
})

test('HTML and native placement scale frames while retaining point sizes and line widths', ()=>{
  const frame = {x:100000,y:200000,w:300000,h:400000}
  const e = {id:'text',type:'text',frame,transform:[2,0,0,3,0,0],textStyle:{size:24,fontFamily:'Liberation Sans'},paragraphs:[{runs:[{text:'Keep size'}]}]}
  const html = renderSceneHtml({layout:'scene',elements:[e]},{assets:{}},sceneFixtureTheme())
  assert.ok(html.includes(`width="${600000/9525}"`))
  assert.ok(html.includes('font-size:32px'))
  assert.doesNotMatch(html,/matrix\(2/)
  const rotated = renderSceneHtml({layout:'scene',elements:[{...e,transform:frameTransform(frame,{rotation:90})}]},{assets:{}},sceneFixtureTheme())
  assert.match(rotated,/rotate\(90\)/)
})

test('raw typeface aliases are rejected rather than silently trimmed during migration', async ()=>{
  const source = legacyFixtureStates()[0].manifest
  const renderPptx = async (manifest,theme,language) => {
    const pres = await lib.loadPresentation(buildPptx(manifest,theme,language))
    const title = lib.getSlideShapes(lib.getSlides(pres)[0]).find(s=>lib.getShapeName(s) === 'Title')
    lib.setShapeTextFormat(title,{font:'Liberation Sans '})
    return lib.savePresentation(pres)
  }
  await assert.rejects(legacySlidesToScenes(source,{theme:sceneFixtureTheme(),renderPptx}),{code:'legacy-scene-unsupported'})
})
