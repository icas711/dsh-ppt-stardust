import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,readFileSync,rmSync,truncateSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {createPptExecutors} from '../lib/execution.js'
import {resolvePptConfig} from '../lib/config.js'
import {PptTemplateStore} from '../lib/templates.js'
import {buildPptTools} from '../lib/tools.js'
import {visualCreateContentHash} from '../skills/dsh-ppt/scripts/deck-visual-create.mjs'
import {tableCreateContentHash} from '../skills/dsh-ppt/scripts/deck-table-create.mjs'
import {ordinaryVisualSlides} from './fixtures/ordinary-visuals.mjs'
import {template} from './fixtures/generation-components.mjs'
import * as templates from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import * as engine from '../skills/dsh-ppt/scripts/deck-advanced.mjs'

const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const request=()=>{
  const slides=ordinaryVisualSlides(),visualSpec={version:1,mode:'demo',allowMoreSlides:true,sources:[{id:'material',synthetic:true,text:JSON.stringify(slides)}],slides}
  visualSpec.contentHash=visualCreateContentHash(visualSpec)
  return {title:'Проверка файла',templateId:'user:compose-test',lang:'ru',visualSpec}
}
const setup=t=>{const root=mkdtempSync(join(tmpdir(),'ppt-request-'));t.after(()=>rmSync(root,{recursive:true,force:true}));return root}
const wrapper=(root,value,bytes=JSON.stringify(value))=>{
  writeFileSync(join(root,'request.json'),bytes)
  return {title:value.title,requestFile:'request.json',requestSha256:sha(Buffer.from(bytes))}
}
const exec=root=>({agent:{session:{header:{cwd:root,id:'file-create',owner:'alice'}}}})

test('file create preserves Unicode in sources and visuals through normal native export and session authorization',async t=>{
  const root=setup(t),store=new PptTemplateStore({root:join(root,'templates'),templatesModuleLoader:async()=>templates}),record=template()
  await store.save({manifest:record.manifest,assets:record.assets,identity:{login:'alice',admin:false,local:false}})
  const tools=createPptExecutors(resolvePptConfig({}),async()=>engine,{templateStore:store}),value=request(),args=wrapper(root,value)
  const original=readFileSync(join(root,'request.json')),result=await tools.create(args,exec(root))
  assert.ok(result.ok&&result.outputDir.includes('session-'))
  assert.equal(result.visualComposition.sourceSlides,4)
  assert.deepEqual(result.requestInput,{sha256:sha(original),bytes:original.length})
  assert.deepEqual(readFileSync(join(root,'request.json')),original)
  const project=JSON.parse(readFileSync(result.jsonPath,'utf8')),table=project.slides[2].elements.find(e=>e.type==='table').table
  assert.equal(table.cells.find(c=>c.row===1&&c.col===1).paragraphs[0].runs[0].text,'50\u00a0000 ₽')
  await assert.rejects(tools.create(args,{agent:{session:{header:{cwd:root,id:'other',owner:'bob'}}}}))
})

test('file and content checksums, malformed JSON and conflicting overrides stop before engine loading',async t=>{
  const root=setup(t);let loads=0,exports=0
  const tools=createPptExecutors(resolvePptConfig({}),async()=>{loads++;return {buildDeckAsync:async()=>{exports++;return {ok:true}}}},{templateStore:{get:async()=>template()}})
  const value=request(),args=wrapper(root,value)
  for(const extra of [{visualSpec:value.visualSpec},{templateId:'public:other'},{outputDir:'elsewhere'},{title:'Other title'},{requestSha256:'0'.repeat(64)},{requestSha256:undefined}])await assert.rejects(tools.create({...args,...extra},exec(root)))
  await assert.rejects(tools.create({title:value.title,requestSha256:args.requestSha256},exec(root)),/requires requestFile/)
  for(const invalid of ['{','[]',Buffer.from([0xff]),JSON.stringify({...value,requestFile:'other.json'}),JSON.stringify({...value,visualSpec:{...value.visualSpec,contentHash:undefined}})]){
    const bad=wrapper(root,value,invalid);await assert.rejects(tools.create(bad,exec(root)))
  }
  writeFileSync(join(root,'large.json'),'');truncateSync(join(root,'large.json'),32*1024*1024+1)
  await assert.rejects(tools.create({...args,requestFile:'large.json'},exec(root)),/regular file/)
  const controller=new AbortController();controller.abort(new Error('cancelled'))
  await assert.rejects(tools.create(wrapper(root,value),{...exec(root),signal:controller.signal}),/cancelled/)
  assert.equal(loads,0)
  // Even an accurate byte checksum cannot accept changed content under the original contentHash.
  const changed=JSON.stringify(value).replaceAll('\u00a0',' ')
  await assert.rejects(tools.create(wrapper(root,value,changed),exec(root)),/Content hash mismatch/)
  assert.equal(exports,0)
})

test('absolute paths, escaped NBSP, UTF-8 BOM and prepared table requests retain the existing contracts',async t=>{
  const root=setup(t);let captured
  const tools=createPptExecutors(resolvePptConfig({}),async()=>({buildDeckAsync:async args=>{captured=args;return {ok:true}}}),{templateStore:{get:async()=>template()}})
  const value=request(),args=wrapper(root,value,'\ufeff'+JSON.stringify(value).replaceAll('\u00a0','\\u00a0'))
  assert.ok((await tools.create({...args,requestFile:join(root,'request.json')},exec(root))).ok)
  const table=captured.slides[2].elements.find(e=>e.type==='table').table
  assert.equal(table.cells.find(c=>c.row===1&&c.col===1).paragraphs[0].runs[0].text,'50\u00a0000 ₽')
  const tableSpec={version:1,mode:'factual',sources:[{id:'data',text:'50\u00a0000 ₽'}],tables:[{id:'t',title:'Таблица',sourceRefs:['data'],headers:['Сумма'],rows:[['50\u00a0000 ₽']]}]}
  tableSpec.contentHash=tableCreateContentHash(tableSpec)
  const tableValue={title:'Таблица',lang:'ru',templateId:'public:test',tableSpec}
  assert.ok((await tools.create(wrapper(root,tableValue),exec(root))).tableComposition)
  const schema=buildPptTools(resolvePptConfig({})).find(t=>t.name==='ppt_create').parameters
  assert.equal(schema.properties.requestFile.type,'string');assert.equal(schema.properties.requestSha256.type,'string');assert.ok(schema.required.includes('title'))
})
