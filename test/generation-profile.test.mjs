import test from 'node:test'
import assert from 'node:assert/strict'
import {PNG} from 'pngjs'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {fixtures} from './fixtures/pptx/generate.mjs'
import {buildGenerationTemplateProfile,prepareGenerationTemplateProfile,prepareGenerationTemplateFromPptx,createGenerationProfileCache} from '../skills/dsh-ppt/scripts/deck-generation-profile.mjs'

const text=(id,y,w=7000000)=>({id,type:'text',role:'content',frame:{x:500000,y,w,h:600000},textStyle:{fontFamily:'Arial',size:id==='title'?32:18,color:'#123456'},paragraphs:[{runs:[{text:'PRIVATE SAMPLE PROSE'}]}]})
function fixture({dark=false,page={width:9906000,height:6858000}}={}){
  return {manifest:{schemaVersion:3,id:'profile-test',name:'Profile test',revision:1,style:{pageSize:page,brand:{primaryColor:'#CC1122'},layouts:['cover','content'].map(purpose=>({id:purpose,name:purpose,purpose,backgroundColor:dark?'#111111':'#FFFFFF',slots:[],elements:[
    {id:'side',type:'shape',role:'decor',preset:'rect',frame:{x:0,y:0,w:100000,h:page.height},fill:{color:'#CC1122'}},
    text('title',300000),{...text('body',1800000),frame:{x:500000,y:1800000,w:7000000,h:3500000}}
  ]}))},assetMap:{}},assets:{},report:{objects:[],warnings:[]}}
}
const build=b=>buildGenerationTemplateProfile(b.manifest,{assets:b.assets,importReport:b.report})
const codes=r=>r.diagnostics.map(d=>d.code)
function addImage(bundle){
  const png=new PNG({width:1,height:1});png.data.set([255,0,0,255]);const bytes=PNG.sync.write(png)
  bundle.manifest.assetMap.photo={file:'photo.png',mime:'image/png',width:1,height:1}
  bundle.assets['photo.png']={bytes,data:'data:image/png;base64,'+bytes.toString('base64')}
  bundle.manifest.style.layouts[0].backgroundAssetId='photo'
}

test('light, dark and nonstandard pages retain style, native dimensions and guides without sample prose',()=>{
  for(const options of [{},{dark:true},{page:{width:10691813,height:7559675}}]){
    const b=fixture(options),before=structuredClone(b),r=build(b)
    assert.equal(r.valid,true,JSON.stringify(r.diagnostics));assert.deepEqual(b,before)
    assert.deepEqual(r.profile.pageSize,b.manifest.style.pageSize)
    assert.equal(r.profile.layouts[0].backgroundColor,options.dark?'#111111':'#FFFFFF')
    assert.equal(r.profile.layouts[0].typography.title.size,32);assert.equal(r.profile.layouts[0].typography.body.size,18)
    assert.equal(r.profile.layouts[0].fixedArtwork[0].bounds.w,100000)
    assert.equal(r.profile.layouts[0].compositionGuides.units,'percentOfPage')
    assert.equal(JSON.stringify(r.profile).includes('PRIVATE SAMPLE PROSE'),false)
    assert.ok(r.profile.palette.includes('#CC1122'))
    assert.equal(r.profile.fonts.find(f=>f.family==='Arial').availability,'not-verified')
    assert.equal(r.profile.limits.visualAcceptance,'not-verified')
  }
})

test('reference selection matches runtime fallback and never guesses a cover',()=>{
  const b=fixture();b.manifest.style.layouts.shift()
  const r=build(b);assert.equal(r.valid,true)
  assert.deepEqual(r.profile.defaultReferences,{cover:null,content:'content',section:'content',closing:'content'})
  assert.ok(codes(r).includes('cover-reference-required'))
  b.manifest.style.layouts[0].purpose='cover'
  assert.equal(build(b).profile.defaultReferences.content,null)
})

test('missing bytes, malformed geometry and legacy input block preflight',()=>{
  const b=fixture();addImage(b);delete b.assets['photo.png']
  assert.equal(build(b).valid,false);assert.equal(build(b).profile,null)
  const malformed=fixture();malformed.manifest.style.layouts[0].elements[0].frame.w=-1
  assert.equal(build(malformed).valid,false)
  assert.equal(buildGenerationTemplateProfile({schemaVersion:2}).valid,false)
  assert.equal(buildGenerationTemplateProfile(fixture().manifest,{assets:null}).valid,false)
  const invalid=fixture();invalid.manifest.assetMap.photo=null
  assert.equal(prepareGenerationTemplateProfile(invalid,{scope:'owner'}).valid,false)
})

test('raster backgrounds preserve IDs without bytes and remain visually unverified',()=>{
  const b=fixture();addImage(b);const r=build(b)
  assert.equal(r.valid,true);assert.equal(r.profile.layouts[0].backgroundAssetId,'photo')
  assert.ok(codes(r).includes('background-content-unverified'))
  assert.equal(JSON.stringify(r.profile).includes('base64'),false)
})

test('unsupported visible artwork blocks; available previews and sample content disclose limitations',()=>{
  const b=fixture(),e={id:'unsupported',type:'unsupported',role:'decor',frame:{x:200000,y:500000,w:200000,h:200000},sourceKind:'ole',reason:'Cannot retain OLE',support:{mode:'unsupported',reason:'No native object'}}
  b.manifest.style.layouts[0].elements.push(e)
  assert.equal(build(b).valid,false);assert.ok(codes(build(b)).includes('artwork-unsupported'))
  addImage(b);e.previewAssetId='photo';e.support.mode='preview'
  assert.equal(build(b).valid,true);assert.ok(build(b).diagnostics.some(d=>d.code==='artwork-unsupported'&&d.previewAvailable&&d.severity==='warning'))
  delete e.previewAssetId;e.role='content'
  assert.equal(build(b).valid,true);assert.ok(codes(build(b)).includes('sample-unsupported'))
  e.role='decor';e.hidden=true;assert.equal(build(b).valid,true)
})

test('import report carries absent objects and lost backgrounds; missing history is explicit',()=>{
  const b=fixture();b.report.warnings.push({code:'background-unsupported',reason:'Gradient not retained',slide:1})
  assert.equal(build(b).valid,false);assert.ok(codes(build(b)).includes('import-background-unsupported'))
  b.report.warnings=[];b.report.objects=[{elementId:'missing',mode:'unsupported',reason:'Object omitted',slide:1}]
  assert.equal(build(b).valid,false)
  delete b.report;assert.equal(build(b).valid,true);assert.ok(codes(build(b)).includes('import-history-unavailable'))
  b.report={objects:'not-an-array'};assert.equal(build(b).valid,false)
})

test('right anchors, rotation and hidden sample objects do not become false usable areas',()=>{
  const b=fixture(),layout=b.manifest.style.layouts[0],title=layout.elements[1]
  title.textFrame={align:'right'};title.transform=[-1,0,0,1,8000000,0]
  layout.elements.push({...text('hidden',6000000),hidden:true})
  const p=build(b).profile.layouts[0],guide=p.compositionGuides.text.find(t=>t.id==='title')
  assert.equal(guide.anchor.horizontal,'right');assert.equal(guide.referenceAreaKind,'transformedBoundingBox')
  assert.equal(p.compositionGuides.text.some(t=>t.id==='hidden'),false)
  assert.equal(p.contentReferenceBounds.y+p.contentReferenceBounds.h,5300000)
})

test('profile cache isolates scopes, clones results, and invalidates on content/importer/report changes',()=>{
  const cache=createGenerationProfileCache(),b=fixture(),options={scope:'owner-a/library',cache}
  const cold=prepareGenerationTemplateProfile(b,options)
  assert.equal(cold.cache.hit,false);assert.equal(prepareGenerationTemplateProfile(b,options).cache.hit,true)
  cold.profile.layouts[0].typography.title.size=1
  assert.equal(prepareGenerationTemplateProfile(b,options).profile.layouts[0].typography.title.size,32)
  assert.equal(prepareGenerationTemplateProfile(b,{...options,scope:'owner-b/library'}).cache.hit,false)
  assert.equal(prepareGenerationTemplateProfile(b,{...options,importerVersion:2}).cache.hit,false)
  const reordered={...b,manifest:Object.fromEntries(Object.entries(b.manifest).reverse())}
  assert.equal(prepareGenerationTemplateProfile(reordered,options).cache.hit,true)
  b.report.warnings.push('New warning');assert.equal(prepareGenerationTemplateProfile(b,options).cache.hit,false)
  b.manifest.style.layouts[0].backgroundColor='#222222';assert.equal(prepareGenerationTemplateProfile(b,options).cache.hit,false)
  b.manifest.unexpected=undefined;assert.equal(prepareGenerationTemplateProfile(b,options).cache.hit,false)
  assert.throws(()=>prepareGenerationTemplateProfile(b,{cache}),/scope/)
})

test('asset byte changes invalidate cache even when filename and manifest stay unchanged',()=>{
  const cache=createGenerationProfileCache(),b=fixture();addImage(b)
  const options={scope:'owner-a',cache},first=prepareGenerationTemplateProfile(b,options)
  const png=new PNG({width:1,height:1});png.data.set([0,0,255,255]);b.assets['photo.png'].bytes=PNG.sync.write(png)
  const next=prepareGenerationTemplateProfile(b,options)
  assert.notEqual(next.cache.key,first.cache.key);assert.equal(next.cache.hit,false)
})

test('cache evicts least recently used entries, enforces byte budget and does not cache blocked profiles',()=>{
  const cache=createGenerationProfileCache({maxEntries:2,maxBytes:100000}),b=fixture()
  const run=scope=>prepareGenerationTemplateProfile(b,{scope,cache})
  run('a');run('b');assert.equal(run('a').cache.hit,true);run('c');assert.equal(run('b').cache.hit,false)
  assert.equal(cache.stats().entries,2);cache.clear();assert.equal(cache.stats().bytes,0)
  const tiny=createGenerationProfileCache({maxBytes:1})
  prepareGenerationTemplateProfile(b,{scope:'a',cache:tiny});assert.equal(tiny.stats().entries,0)
  b.manifest.schemaVersion=2;run('a');assert.equal(cache.stats().entries,0)
})

test('real PPTX import prepares a profile and warm source cache skips import; other owners stay cold',async()=>{
  const source=fixtures().find(f=>f.id==='artwork').bytes,cache=createGenerationProfileCache()
  const options={scope:'owner-a',cache,templateId:'import-profile',name:'Imported profile'}
  const cold=await prepareGenerationTemplateFromPptx(source,options)
  assert.equal(cold.valid,true,JSON.stringify(cold.diagnostics));assert.equal(cold.cache.hit,false)
  assert.equal(cold.profile.pageSize.width,9906000);assert.ok(cold.timings.importMs>0)
  const warm=await prepareGenerationTemplateFromPptx(source,options)
  assert.equal(warm.cache.hit,true);assert.equal(warm.timings.importMs,0)
  assert.deepEqual(warm.profile,cold.profile)
  assert.equal((await prepareGenerationTemplateFromPptx(source,{...options,scope:'owner-b'})).cache.hit,false)
  assert.equal((await prepareGenerationTemplateFromPptx(source,{...options,name:'Another name'})).cache.hit,false)
  const controller=new AbortController();controller.abort(new Error('Stopped'))
  await assert.rejects(prepareGenerationTemplateFromPptx(source,{...options,signal:controller.signal}),/Stopped/)
})

test('nested imported groups retain final transforms without multiplying them twice',async()=>{
  const r=await prepareGenerationTemplateFromPptx(fixtures().find(f=>f.id==='groups').bytes,{scope:'group-owner',templateId:'group-profile',name:'Groups'})
  assert.equal(r.valid,true,JSON.stringify(r.diagnostics))
  const guides=r.profile.layouts[0].compositionGuides.text
  assert.equal(guides.length,4);assert.ok(guides.some(g=>g.transformed))
  assert.ok(guides.every(g=>Number.isFinite(g.anchor.x)&&Number.isFinite(g.anchor.y)))
})

test('profile CLI rejects missing arguments as JSON and never treats inspection as visual approval',()=>{
  const cli=fileURLToPath(new URL('../scripts/generation-profile.mjs',import.meta.url))
  const r=spawnSync(process.execPath,[cli,'pptx'],{encoding:'utf8'})
  assert.equal(r.status,1);assert.equal(JSON.parse(r.stdout).valid,false)
})
