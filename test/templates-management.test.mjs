import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runInNewContext } from 'node:vm'
import { PptTemplateStore } from '../lib/templates.js'
import { PptWorkbench } from '../lib/workbench.js'
import * as templates from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import * as DshDeckModel from '../skills/dsh-ppt/scripts/deck-client-model.mjs'
import * as advanced from '../skills/dsh-ppt/scripts/deck-advanced.mjs'
import { unzipSync } from 'fflate'

const admin = {login:'admin',admin:true}, user = {login:'alice',admin:false}
const manifest = id => ({schemaVersion:1,id,name:id,style:{theme:'data'},outline:[{layout:'cover',title:'{{deck.title}}'}]})
async function setup(fn) {
  const dir = mkdtempSync(join(tmpdir(),'dsh-template-management-'))
  const builtinDir = join(dir,'builtin'), root = join(dir,'templates')
  mkdirSync(join(builtinDir,'corp'),{recursive:true})
  writeFileSync(join(builtinDir,'corp','template.json'),JSON.stringify(manifest('corp')))
  const createStore = () => new PptTemplateStore({root,builtinDir,templatesModuleLoader:async()=>templates})
  const store = createStore(), wb = new PptWorkbench({catalogPath:join(dir,'catalog.jsonl')})
  wb.attachTemplateStore(store)
  try { await fn({dir,root,builtinDir,store,wb,createStore}) }
  finally { rmSync(dir,{recursive:true,force:true}) }
}

test('visibility persists across restart and builtin overrides, blocking every direct read for users', () => setup(async ({store,wb,createStore}) => {
  // Warm a cached read before changing access.
  await store.get('builtin:corp',user)
  await assert.rejects(()=>wb.action({operation:'template-visibility',templateId:'builtin:corp',hidden:true},undefined,user),/администратор/)
  await assert.rejects(()=>wb.action({operation:'template-visibility',templateId:'builtin:corp',hidden:'false'},undefined,admin),/hidden/)
  await wb.action({operation:'template-visibility',templateId:'builtin:corp',hidden:true},undefined,admin)
  assert.deepEqual(await store.list(user),[])
  assert.equal((await store.list(admin))[0].hidden,true)
  await assert.rejects(()=>store.get('builtin:corp',user),/не найден/)
  await assert.rejects(()=>store.restyleOptions('builtin:corp',user),/не найден/)
  await assert.rejects(()=>store.duplicate({key:'builtin:corp',newId:'copy',name:'Copy',identity:user}),/не найден/)
  await store.saveDraft({manifest:manifest('corp'),baseKey:'builtin:corp',scope:'public',identity:admin})
  const restarted = createStore()
  assert.deepEqual(await restarted.list(user),[])
  await assert.rejects(()=>restarted.get('public:corp',user),/не найден/)
  assert.equal((await restarted.get('builtin:corp',admin)).key,'public:corp')
  await restarted.setVisibility('public:corp',false,admin)
  assert.equal((await restarted.list(user))[0].hidden,false)
  assert.equal((await restarted.get('builtin:corp',user)).key,'public:corp')
}))

test('deleting an override never resurrects the asset; resetting is a separate admin operation', () => setup(async ({store,wb,builtinDir,createStore}) => {
  await store.save({manifest:manifest('corp'),scope:'public',identity:admin})
  await wb.action({operation:'template-delete',templateId:'public:corp'},undefined,admin)
  assert.equal(existsSync(join(builtinDir,'corp','template.json')),true)
  const restarted = createStore()
  assert.deepEqual(await restarted.list(admin),[])
  for (const key of ['builtin:corp','public:corp']) await assert.rejects(()=>restarted.get(key,admin),/не найден/)
  await restarted.save({manifest:manifest('corp'),scope:'public',identity:admin})
  await assert.rejects(()=>restarted.delete('public:corp',user,true),/администратор/)
  await restarted.delete('public:corp',admin,true)
  assert.equal((await restarted.get('builtin:corp',user)).key,'builtin:corp')
}))

test('visibility does not affect a private template with the same id, and users cannot change it', () => setup(async ({store}) => {
  await store.save({manifest:manifest('corp'),identity:user})
  await store.setVisibility('builtin:corp',true,admin)
  assert.equal((await store.get('user:corp',user)).key,'user:corp')
  assert.deepEqual((await store.list(user)).map(t=>t.key),['user:corp'])
  await assert.rejects(()=>store.setVisibility('user:corp',true,admin),/личного/)
}))

test('a prepared font is isolated until saving its draft, never changing the library or other templates', () => setup(async ({store,wb,root}) => {
  const a = manifest('font-one'), b = manifest('font-two')
  a.style.textStyles = b.style.textStyles = {body:{fontFamily:'DSH Test Body'}}
  await store.save({manifest:a,identity:user}); await store.save({manifest:b,identity:user})
  const bytes = readFileSync(new URL('./fixtures/fonts/DSH-Test-Body.ttf',import.meta.url))
  const input = {operation:'template-font-prepare',family:'DSH Test Body',variant:'regular',data:'data:font/ttf;base64,'+bytes.toString('base64')}
  const {font} = await wb.action({...input,templateId:'user:font-one'},undefined,user)
  assert.equal(existsSync(join(root,'font-library')),false)
  assert.equal((await store.get('user:font-one',user)).manifest.revision,1)
  a.style.fonts = [{family:font.family,variant:font.variant,file:font.file}]
  const saved = await store.saveDraft({manifest:a,uploads:{[font.file]:font.data},baseKey:'user:font-one',identity:user})
  assert.deepEqual(saved.assets[font.file].bytes,bytes)
  assert.equal((await store.get('user:font-two',user)).manifest.revision,1)
  assert.equal((await store.get('user:font-two',user)).manifest.style.fonts,undefined)
  assert.deepEqual(store.fontLibrary.list(user),[])
  await assert.rejects(()=>wb.action({...input,templateId:'builtin:corp'},undefined,user),/прав/)
  await assert.rejects(()=>wb.action({...input,data:'data:font/ttf;base64,YmFk'},undefined,user))
  await assert.rejects(()=>wb.action({...input,family:'../escape'},undefined,user))
}))

function editorApi() {
  const context = {DshDeckModel,languageOf:()=> 'ru'}
  runInNewContext(readFileSync(new URL('../templates/panels/template-editor.js',import.meta.url),'utf8')+'\nthis.api={tplDraftFrom,tplBuild,tplFontFamilies,tplEffectiveTypography,tplUpdateTypography,tplResetTypography};',context)
  return context.api
}
const plain = value => JSON.parse(JSON.stringify(value))
const text = (id,y,font,color) => ({id,type:'text',role:'content',frame:{x:0,y,w:1000000,h:100000},textStyle:{size:20},paragraphs:[{runs:[{text:id,style:{fontFamily:font,color}}]}]})
test('typography reads actual scene runs, reports differences and propagates only the edited property across layouts', () => {
  const api = editorApi()
  const input = {schemaVersion:3,id:'scene-type',name:'Type',style:{theme:'data',themeFonts:{majorLatin:'Theme Heading',minorLatin:'Theme Body'},layouts:[
    {id:'one',elements:[text('title',0,'Actual Heading','#123456'),text('body',200000,'Actual Body','#654321'),{...text('logo',500000,'Logo Font','#AAAAAA'),role:'decor'}]},
    {id:'two',elements:[text('title',0,'Actual Heading','#123456'),text('body',200000,'Actual Body','#987654')]},
  ]}}
  const draft = api.tplDraftFrom(input)
  assert.equal(api.tplEffectiveTypography(draft,'title').style.fontFamily,'Actual Heading')
  assert.equal(api.tplEffectiveTypography(draft,'title').style.color,'#123456')
  assert.deepEqual(plain(api.tplEffectiveTypography(draft,'body').mixed),['color'])
  assert.ok(api.tplFontFamilies(draft).includes('Actual Heading'))
  assert.ok(api.tplFontFamilies(draft).includes('Logo Font'))
  assert.ok(api.tplFontFamilies(draft).includes('Theme Body'))
  const edited = {...draft,...api.tplUpdateTypography(draft,'body','fontFamily','Replacement')}
  for (const layout of edited.layouts) {
    assert.equal(layout.elements[1].textStyle.fontFamily,'Replacement')
    assert.equal(layout.elements[1].paragraphs[0].runs[0].style.fontFamily,'Replacement')
    assert.equal(layout.elements[0].paragraphs[0].runs[0].style.fontFamily,'Actual Heading')
  }
  assert.equal(edited.layouts[0].elements[1].paragraphs[0].runs[0].style.color,'#654321')
  assert.equal(edited.layouts[0].elements[2].paragraphs[0].runs[0].style.fontFamily,'Logo Font')
  const reset = {...edited,...api.tplResetTypography(edited,draft,'body')}
  assert.equal(api.tplEffectiveTypography(reset,'body').style.fontFamily,'Actual Body')
  assert.deepEqual(plain(api.tplEffectiveTypography(reset,'body').mixed),['color'])
  assert.equal(draft.layouts[0].elements[1].paragraphs[0].runs[0].style.fontFamily,'Actual Body')
})

test('edited scene typography and a template-only font survive save, ZIP, HTML and native PPTX', () => setup(async ({store,wb,dir}) => {
  const api = editorApi(), element = text('body',200000,'Original Font','#123456')
  Object.assign(element.paragraphs[0].runs[0].style, {sourceTypeface:'Original Source',scriptFonts:{complexScript:'Original Script'},colorSpec:{base:'#FF0000',transforms:[]}})
  const input = {schemaVersion:3,id:'scene-font',name:'Scene Font',assetMap:{},style:{theme:'data',pageSize:{width:9144000,height:5143500},layouts:[{id:'content',purpose:'content',elements:[element],slots:[]}]}}
  const original = await store.save({manifest:input,identity:user})
  let draft = api.tplDraftFrom(original.manifest)
  assert.equal(api.tplEffectiveTypography(draft,'body').style.color,'#FF0000')
  draft = {...draft,...api.tplUpdateTypography(draft,'body','color','#ABCDEF')}
  draft = {...draft,...api.tplUpdateTypography(draft,'body','fontFamily','DSH Test Body')}
  const bytes = readFileSync(new URL('./fixtures/fonts/DSH-Test-Body.ttf',import.meta.url))
  const {font} = await wb.action({operation:'template-font-prepare',templateId:original.key,family:'DSH Test Body',variant:'regular',data:'data:font/ttf;base64,'+bytes.toString('base64')},undefined,user)
  draft.fonts = [{family:font.family,variant:font.variant,file:font.file}]
  const saved = await store.saveDraft({manifest:api.tplBuild(draft,original.manifest),uploads:{[font.file]:font.data},baseKey:original.key,identity:user})
  const run = saved.manifest.style.layouts[0].elements[0].paragraphs[0].runs[0]
  assert.equal(run.style.sourceTypeface,undefined)
  assert.equal(run.style.scriptFonts,undefined)
  assert.equal(run.style.colorSpec,undefined)
  const bundle = templates.readTemplateZip(templates.buildTemplateBundle(saved.manifest,saved.assets))
  assert.deepEqual(bundle.assets[font.file].bytes,bytes)
  const preview = advanced.previewDeckHtml(await store.previewOptions({manifest:saved.manifest,baseKey:saved.key,identity:user}))
  assert.match(preview.html,/@font-face/)
  assert.match(preview.html,/color:#ABCDEF/)
  const {create} = await store.createOptions(saved.key,user,{title:'Changed typography'})
  const deck = await advanced.buildDeckAsync({...create,outputDir:join(dir,'deck')})
  const zip = unzipSync(readFileSync(deck.pptxPath)), xml = Buffer.from(zip['ppt/slides/slide1.xml']).toString('utf8')
  assert.match(xml,/typeface="DSH Test Body"/)
  assert.match(xml,/val="ABCDEF"/)
  assert.doesNotMatch(xml,/Original Source|Original Script/)
  const reset = {...draft,...api.tplResetTypography(draft,api.tplDraftFrom(original.manifest),'body')}
  assert.equal(api.tplEffectiveTypography(reset,'body').style.color,'#FF0000')
  assert.equal(reset.layouts[0].elements[0].paragraphs[0].runs[0].style.sourceTypeface,'Original Source')
}))
