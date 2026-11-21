import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {unzipSync,strFromU8} from 'fflate'
import jpeg from 'jpeg-js'
import {picture,template} from './fixtures/generation-components.mjs'
import {composeVisualCreate,visualCreateContentHash} from '../skills/dsh-ppt/scripts/deck-visual-create.mjs'
import {createPptExecutors} from '../lib/execution.js'
import {resolvePptConfig} from '../lib/config.js'
import * as engine from '../skills/dsh-ppt/scripts/deck-advanced.mjs'

const hash=b=>createHash('sha256').update(b).digest('hex')
const input=()=>{
  const jpg=jpeg.encode({width:1,height:2,data:Buffer.from([0,255,0,255,0,0,255,255])},90).data
  return {version:1,mode:'demo',sources:[{id:'image-source',text:'Synthetic orientation markers, original image bytes.',synthetic:true}],assets:[{id:'wide',...picture()},{id:'tall',mime:'image/jpeg',width:1,height:2,data:'data:image/jpeg;base64,'+jpg.toString('base64')}],slides:[
    {id:'wide',title:'Широкое изображение',visual:{type:'image',sourceRefs:['image-source'],assetId:'wide',alt:'Красная и синяя области',caption:'Полное изображение без обрезки.'}},
    {id:'tall',title:'Высокое изображение',visual:{type:'image',sourceRefs:['image-source'],assetId:'tall',alt:'Зелёная и синяя области',caption:'Пропорции исходного изображения сохранены.'}}
  ]}
}
const compose=v=>composeVisualCreate(v,{title:'Изображения',lang:'ru',template:template()})

test('image composition preserves bytes, captions and alt text without changing the source or template',()=>{
  const value=input(),before=structuredClone(value);value.contentHash=visualCreateContentHash(value);before.contentHash=value.contentHash
  const made=compose(value);assert.deepEqual(value,before);assert.equal(made.report.slideCount,2)
  for(const [i,slide]of made.create.slides.entries()){
    const image=slide.elements.find(e=>e.type==='image'),asset=made.create.assets[image.assetId]
    assert.equal(image.fit,'contain');assert.equal(image.alt,value.slides[i].visual.alt)
    assert.equal(asset.data,value.assets[i].data)
    assert.ok(slide.elements.some(e=>e.id==='gen-caption'&&e.paragraphs[0].runs[0].text===value.slides[i].visual.caption))
    assert.ok(slide.elements.some(e=>e.id==='gen-disclosure'))
  }
  const changed=structuredClone(value);changed.assets[0].data=changed.assets[1].data;changed.assets[0].mime='image/jpeg';changed.assets[0].width=1;changed.assets[0].height=2
  assert.throws(()=>compose(changed),/Content hash mismatch/)
})

test('invalid images, metadata, references and unsafe overrides fail before export',async()=>{
  let builds=0
  const tools=createPptExecutors(resolvePptConfig({}),async()=>({buildDeckAsync:async()=>{builds++;return {ok:true}}}),{templateStore:{get:async()=>template()}})
  for(const mutate of [
    v=>v.assets.push(v.assets[0]),v=>v.assets=[],v=>v.assets=Array.from({length:17},(_,i)=>({...v.assets[0],id:'image-'+i})),v=>v.assets[0].path='/tmp/file.png',
    v=>v.assets[0].data='https://example.invalid/source.png',v=>v.assets[0].width=3,
    v=>v.assets[0].width=2.5,v=>v.assets[0].mime='image/jpeg',v=>v.assets[0].id='bad id',
    v=>v.assets[0].data='data:image/png;base64,AA==',v=>delete v.assets,
    v=>v.slides[0].visual.assetId='missing',v=>v.slides[0].visual.fit='cover',
    v=>v.slides[0].visual.alt='',v=>v.mode='factual'
  ]){
    const value=input();mutate(value)
    await assert.rejects(tools.create({title:'Изображения',lang:'ru',templateId:'public:test',visualSpec:value}))
  }
  const collision=input(),t=template(),photo=picture();t.manifest.assetMap.wide={file:'wide.png',mime:photo.mime,width:photo.width,height:photo.height};t.assets['wide.png']={bytes:Buffer.from(photo.data.split(',')[1],'base64'),data:photo.data}
  assert.throws(()=>composeVisualCreate(collision,{title:'Изображения',lang:'ru',template:t}),{code:'component-asset-collision'})
  assert.equal(builds,0)
})

test('file request exports exact native PNG/JPEG bytes and original aspect ratios in PPTX',async t=>{
  const root=mkdtempSync(join(tmpdir(),'ppt-images-'));t.after(()=>rmSync(root,{recursive:true,force:true}))
  const value=input();value.contentHash=visualCreateContentHash(value)
  const args={title:'Изображения',lang:'ru',templateId:'public:test',visualSpec:value},bytes=Buffer.from(JSON.stringify(args))
  writeFileSync(join(root,'request.json'),bytes)
  const tools=createPptExecutors(resolvePptConfig({}),async()=>engine,{templateStore:{get:async()=>template()}})
  const result=await tools.create({title:args.title,requestFile:'request.json',requestSha256:hash(bytes)},{agent:{session:{header:{cwd:root,id:'image-test',owner:'alice'}}}})
  assert.equal(result.visualComposition.sourceSlides,2);assert.equal(result.requestInput.sha256,hash(bytes))
  const parts=unzipSync(readFileSync(result.pptxPath)),media=Object.keys(parts).filter(p=>p.startsWith('ppt/media/'))
  for(const [i,asset]of value.assets.entries()){
    const raw=Buffer.from(asset.data.split(',')[1],'base64');assert.ok(media.some(n=>hash(parts[n])===hash(raw)))
    const xml=strFromU8(parts[`ppt/slides/slide${i+1}.xml`]),pic=xml.match(/<p:pic>.*?<\/p:pic>/s)?.[0]
    assert.ok(pic);assert.ok(pic.includes(asset.id==='wide'?'Красная и синяя области':'Зелёная и синяя области'))
    const extent=pic.match(/<a:ext cx="(\d+)" cy="(\d+)"/);assert.ok(extent)
    assert.ok(Math.abs(Number(extent[1])/Number(extent[2])-asset.width/asset.height)<1e-5)
    assert.match(pic,/<a:srcRect l="0" r="0" t="0" b="0"\/>/)
  }
})
