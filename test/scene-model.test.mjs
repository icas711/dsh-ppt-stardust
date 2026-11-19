import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import * as model from '../skills/dsh-ppt/scripts/deck-model.mjs'
import { normalizeSlides, buildDeck } from '../skills/dsh-ppt/scripts/deck-core.mjs'
import { buildDeckAsync, editDeck, readDeckProject, previewDeckHtml } from '../skills/dsh-ppt/scripts/deck-advanced.mjs'

const built = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
const fragment = built.match(/\/\/ BEGIN DSH_DECK_MODEL\n([\s\S]*?)\/\/ END DSH_DECK_MODEL/)?.[1]
assert.ok(fragment)
const browser = runInNewContext(fragment + '\nDshDeckModel')
const frame = () => ({x:-100,y:200,w:300000,h:100000})
const text = (id = 'text') => ({id,type:'text',frame:frame(),paragraphs:[{runs:[{text:'Красный ',style:{bold:true,color:'#cf1f2f'}},{break:true},{text:'Next',style:{italic:true}}],style:{align:'right',lineSpacing:{kind:'pct',value:1.2},bullet:{kind:'bullet',character:'•',fontFamily:'Liberation Sans'}}}],textFrame:{anchor:'top',margins:{left:0,right:0}},textStyle:{fontFamily:'Liberation Sans',size:24,scriptFonts:{eastAsian:'Liberation Sans',complexScript:''}}})
const scene = elements => ({id:'slide-1',layout:'scene',label:'Complex page',purpose:'content',notes:'Keep\nnotes',elements:elements ?? [text()]})
const assets = {image:{mime:'image/png'}}
const outcome = (api, input, options) => {
  try { return {value:JSON.stringify(api.normalizeSceneSlide(input, options))} }
  catch (error) { return {message:error.message,code:error.code,path:error.path} }
}
function rejects(value, code, options) {
  const expected = outcome(model, value, options)
  assert.equal(expected.code, code, expected.message)
  assert.deepEqual(outcome(browser, value, options), expected)
}

test('scene normalizer keeps 10+ independent rich-text blocks and all supported object types', () => {
  const input = scene([
    ...Array.from({length:12}, (_,i) => text('text-'+i)),
    {id:'group',type:'group',frame:frame(),transform:[1,0,0,1,1000,2000],children:['text-0','text-1','text-2']},
    {id:'picture',type:'image',role:'decor',frame:frame(),assetId:'image',fit:'cover',crop:{left:.1,top:.2},alt:'Logo'},
    {id:'plate',type:'shape',frame:frame(),preset:'rect',fill:{color:'#cf1f2f',opacity:.5},stroke:{color:'#123456',width:1.5}},
    {id:'arrow',type:'line',frame:{x:0,y:0,w:0,h:400000},stroke:{color:'#000000',tail:'triangle',dash:'dash'}},
    {id:'ole-preview',type:'unsupported',frame:frame(),sourceKind:'OLE',reason:'Embedded binary is excluded',previewAssetId:'image',source:{part:'ppt/slides/slide1.xml',shapeId:'17',slide:1,kind:'OLE'},support:{mode:'preview',reason:'Image only'}},
  ])
  const before = structuredClone(input), normalized = model.normalizeSceneSlide(input, {assets})
  assert.deepEqual(input, before)
  assert.equal(normalized.elements.length, 17)
  assert.equal(normalized.elements[0].paragraphs[0].runs[0].style.color, '#CF1F2F')
  assert.equal(normalized.elements[0].paragraphs[0].style.align, 'right')
  assert.equal(normalized.elements[0].frame.x, -100)
  assert.deepEqual(normalized.elements[0].frame, input.elements[0].frame, 'Group transform is already composed in each child; normalization must not apply it again')
  assert.deepEqual(normalized.elements[13].crop, {left:.1,right:0,top:.2,bottom:0})
  assert.deepEqual(model.normalizeSceneSlide(normalized, {assets}), normalized)
  assert.deepEqual(outcome(browser, input, {assets}), outcome(model, input, {assets}))
})

test('mixed content, missing elements and unknown fields report matching browser/server paths', () => {
  for (const key of model.LEGACY_CONTENT_FIELDS) for (const value of ['',null,[],undefined]) rejects({...scene(),[key]:value}, 'mixed-slide-content')
  rejects({layout:'scene'}, 'missing-elements')
  rejects({...scene(),layout:'bullets'}, 'invalid-scene-layout')
  rejects({...scene(),extra:true}, 'unknown-field')
  rejects(scene([{...text(),extra:true}]), 'unknown-field')
  rejects(scene([{...text(),textStyle:{size:18,hidden:true}}]), 'unknown-field')
  rejects(scene([{...text(),textStyle:{scriptFonts:{hidden:'Font'}}}]), 'unknown-field')
  rejects(scene([{...text(),paragraphs:[{runs:[{text:'a'}],style:{bullet:{kind:'none',character:'•'}}}]}]), 'invalid-bullet')
  rejects(scene([{...text(),paragraphs:[{runs:[{text:'a'}],style:{bullet:{kind:'bullet',binary:'data'}}}]}]), 'unknown-field')
  rejects(scene([{...text(),textFrame:{align:'right',margins:{left:0,hidden:1}}}]), 'unknown-field')
  rejects(scene([{...text(),paragraphs:[{runs:[{text:'a'}],style:{lineSpacing:{kind:'pct',value:1,hidden:true}}}]}]), 'unknown-field')
  rejects(scene([{id:'ole',type:'unsupported',frame:frame(),sourceKind:'OLE',reason:'Preview',binary:'arbitrary attachment'}]), 'unknown-field')
  rejects(scene([{id:'chart',type:'chart',frame:frame()}]), 'invalid-object')
})

test('scene geometry, styles, crop and asset references are strict and never clamped', () => {
  for (const value of [NaN,Infinity,'100',.5]) rejects(scene([{...text(),frame:{...frame(),x:value}}]), 'invalid-number')
  rejects(scene([{...text(),frame:{...frame(),w:0}}]), 'invalid-number')
  rejects(scene([{...text(),transform:[1,0,0,0,0,0]}]), 'singular-transform')
  rejects(scene([{...text(),transform:[1024,0,0,1024,0,0]}]), 'geometry-range')
  rejects(scene([{...text(),transform:[1,0,0,1,0]}]), 'invalid-transform')
  rejects(scene([{...text(),textStyle:{bold:'true'}}]), 'invalid-text-style')
  rejects(scene([{...text(),textFrame:{anchor:'elsewhere'}}]), 'invalid-text-frame')
  rejects(scene([{...text(),paragraphs:[{runs:[{text:'a',break:true}]}]}]), 'invalid-break')
  const picture = {id:'p',type:'image',frame:frame(),assetId:'image'}
  rejects(scene([picture]), 'missing-asset')
  rejects(scene([picture]), 'invalid-image-asset', {assets:{image:{mime:'application/octet-stream'}}})
  rejects(scene([{...picture,crop:{left:.5,right:.5}}]), 'invalid-crop', {assets})
})

test('group validation rejects cycles, missing children, multiple parents and changed drawing order', () => {
  const group = (id, children) => ({id,type:'group',frame:frame(),children})
  rejects(scene([text('a'),text('a')]), 'duplicate-element-id')
  rejects(scene([group('g',['missing'])]), 'missing-element')
  rejects(scene([group('a',['b']),group('b',['a'])]), 'group-cycle')
  rejects(scene([text('a'),group('g',['a','a'])]), 'multiple-group-parents')
  rejects(scene([text('a'),group('g',['a']),group('h',['a'])]), 'multiple-group-parents')
  rejects(scene([text('a'),text('outside'),text('b'),group('g',['a','b'])]), 'group-order')
  rejects(scene([text('a'),text('b'),group('g',['b','a'])]), 'group-order')
  const chain = n => [text('leaf'), ...Array.from({length:n}, (_,i) => group('group-'+i, [i === n-1 ? 'leaf' : 'group-'+(i+1)]))]
  assert.equal(model.normalizeSceneSlide(scene(chain(16))).elements.length, 17)
  rejects(scene(chain(17)), 'group-depth')
  const nested = scene([text('a'),text('b'),text('c'),group('inner',['a','b']),group('outer',['inner','c'])])
  assert.deepEqual(model.normalizeSceneSlide(nested).elements.map(e=>e.id), ['a','b','c','inner','outer'])
})

test('scene budgets count all elements, placements rather than unique images, and complete documents', () => {
  const objects = Array.from({length:256}, (_,i)=>text('t-'+i))
  assert.equal(model.normalizeSceneSlide(scene(objects)).elements.length, 256)
  rejects(scene([...objects,text('extra')]), 'element-limit')
  rejects(scene(Array.from({length:129}, (_,i)=>({id:'p-'+i,type:'image',frame:frame(),assetId:'image'}))), 'image-limit', {assets})
  assert.equal(model.normalizeSceneSlides(Array.from({length:32},(_,i)=>({...scene(objects),id:'slide-'+i}))).length, 32)
  assert.throws(()=>model.normalizeSceneSlides(Array.from({length:33},(_,i)=>({...scene(objects),id:'slide-'+i}))), {code:'project-element-limit'})
  assert.throws(()=>model.normalizeSceneSlides([scene(),scene()]), {code:'duplicate-slide-id'})
  assert.throws(()=>model.normalizeSceneSlides(Array.from({length:121},(_,i)=>({...scene(),id:'slide-'+i}))), {code:'slide-limit'})
})

test('legacy create, preview, read and edit reject scene fields before losing data or changing files', async t => {
  const mixed = {...scene(),title:''}
  assert.throws(()=>normalizeSlides([mixed]), {code:'mixed-slide-content'})
  assert.throws(()=>buildDeck({title:'Mixed',slides:[mixed]}), {code:'mixed-slide-content'})
  assert.throws(()=>previewDeckHtml({title:'Mixed',slides:[mixed]}), {code:'mixed-slide-content'})
  await assert.rejects(buildDeckAsync({title:'Mixed',slides:[mixed]}), {code:'mixed-slide-content'})
  assert.throws(()=>normalizeSlides([scene()]), {code:'scene-not-enabled'})
  const root = mkdtempSync(join(tmpdir(),'ppt-scene-boundary-'))
  t.after(()=>rmSync(root,{recursive:true,force:true}))
  const created = await buildDeckAsync({title:'Legacy',slides:[{layout:'bullets',title:'Keep',bullets:['Text']}],outputDir:root,renderPdf:false})
  const path = created.jsonPath, before = readFileSync(path)
  await assert.rejects(editDeck({deckPath:path,expectedRevision:0,edits:[{slide:1,patch:{layout:'scene',elements:[],title:''}}]}), {code:'mixed-slide-content'})
  await assert.rejects(editDeck({deckPath:path,expectedRevision:0,edits:[{slide:1,patch:{layout:'scene',elements:[]}}]}), {code:'mixed-slide-content'})
  assert.deepEqual(readFileSync(path), before)
  const read = readDeckProject({deckPath:path}).manifest
  assert.equal(read.schemaVersion, 1); assert.equal(read.revision,0); assert.equal(read.history.length,0)
  for (const historical of [false,true]) {
    const invalid = JSON.parse(before)
    if (historical) invalid.history = [{title:'Prior',theme:invalid.theme,language:invalid.language,slides:[mixed]}]
    else invalid.slides = [mixed]
    const raw = JSON.stringify(invalid)
    writeFileSync(path, raw)
    assert.throws(()=>readDeckProject({deckPath:path}), {code:'mixed-slide-content'})
    assert.equal(readFileSync(path,'utf8'), raw, 'Read must not rewrite even invalid project snapshots')
  }
})
