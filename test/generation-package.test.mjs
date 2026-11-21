import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,rmSync,existsSync} from 'node:fs'
import {join,dirname,resolve} from 'node:path'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

import {picture} from './fixtures/generation-components.mjs'
import {ordinaryVisualSlides} from './fixtures/ordinary-visuals.mjs'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
test('npm tarball runs the UI protocol without src, development scripts, fixtures or git',t=>{
  mkdirSync(join(root,'.test-output'),{recursive:true})
  const out=mkdtempSync(join(root,'.test-output','generation-package-'))
  t.after(()=>rmSync(out,{recursive:true,force:true}))
  const cli=process.env.npm_execpath??join(dirname(process.execPath),'node_modules','npm','bin','npm-cli.js')
  assert.ok(existsSync(cli),'npm CLI must be available for the deployment smoke test')
  const packed=spawnSync(process.execPath,[cli,'pack','--json','--pack-destination',out],{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024})
  assert.equal(packed.status,0,packed.stderr)
  const manifest=JSON.parse(packed.stdout)[0],paths=manifest.files.map(f=>f.path)
  for(const required of ['lib/generation.js','lib/create-request.js','scripts/generation-compact-session.mjs','scripts/generation-compact-cases.mjs','scripts/generation-run.mjs','docs/GENERATION-DSH-PILOT.md','skills/dsh-ppt/scripts/deck-table-create.mjs','skills/dsh-ppt/scripts/deck-content-create.mjs','skills/dsh-ppt/scripts/deck-visual-create.mjs'])assert.ok(paths.includes(required),required)
  assert.ok(paths.every(p=>!p.startsWith('test/')&&!p.startsWith('src/')&&!p.startsWith('.test-output/')))
  const extracted=spawnSync('tar',['-xf',join(out,manifest.filename),'-C',out],{encoding:'utf8'})
  assert.equal(extracted.status,0,extracted.stderr)
  const code=`
    import {createPptExecutors} from './package/lib/execution.js';
    import {resolvePptConfig} from './package/lib/config.js';
    const tools=createPptExecutors(resolvePptConfig({}),async()=>({buildDeckAsync:async()=>({ok:true})}),{generationRoot:process.cwd()+'/state'});
    const exec={agent:{session:{header:{id:'packaged-ui',owner:'smoke',cwd:process.cwd()},requestContext:()=>({provider:'smoke',model:'glm-5.3-flash'})}}};
    let r=await tools.generation({operation:'start',experimental:true,mode:'B',caseId:'big_number',templateKey:'portrait'},exec);
    if(r.expectedTurn!==1)throw new Error('No initial prompt');
    const value={version:1,title:'Выпуск видео',lang:'ru',mode:'demo',slides:[{id:'s',purpose:'content',title:'Выпуск видео',visual:{type:'big_number',sourceRefs:['material'],items:[{id:'videos',label:'Создано видео',value:30,unit:'видео'}]}}]};
    r=await tools.generation({operation:'submit',runId:r.runId,expectedTurn:r.expectedTurn,responseText:JSON.stringify(value)},exec);
    if(r.status!=='exported'||r.calls!==1)throw new Error(JSON.stringify(r));
    console.log('packaged-ui-exported');
    const {compactTemplates}=await import('./package/scripts/generation-compact-cases.mjs');
    const {buildPptTools}=await import('./package/lib/tools.js');
    if(!buildPptTools(resolvePptConfig({})).find(t=>t.name==='ppt_create').parameters.properties.tableSpec)throw new Error('No tableSpec schema');
    let captured;
    const normal=createPptExecutors(resolvePptConfig({}),async()=>({buildDeckAsync:async o=>{captured=o;return {ok:true}}}),{templateStore:{get:async()=>compactTemplates().find(t=>t.key==='portrait')}});
    const made=await normal.create({title:'Реестр',lang:'ru',templateId:'user:register',tableSpec:{version:1,mode:'factual',allowMoreSlides:true,sources:[{id:'data',text:'Source register'}],tables:[{id:'t',title:'Реестр',sourceRefs:['data'],headers:['Проект'],rows:Array.from({length:30},(_,i)=>['Строка '+i])}]}},exec);
    if(!made.ok||captured.slides.length<2||!captured.slides.every(s=>s.elements.some(e=>e.type==='table')))throw new Error('Packaged table create failed');
    console.log('packaged-table-exported');
    const visualSpec={version:1,mode:'demo',sources:[{id:'data',text:'Synthetic project data',synthetic:true}],slides:[{id:'cards',title:'Projects',visual:{type:'cards',sourceRefs:['data'],items:[{id:'a',label:'Alpha',detail:'Full alpha description.'},{id:'b',label:'Beta',detail:'Full beta description.'}]}},{id:'chart',title:'Requests',visual:{type:'chart',sourceRefs:['data'],kind:'column',unit:'requests',categories:['North','South'],series:[{name:'Count',values:[17,9]}]}}]};
    if(!buildPptTools(resolvePptConfig({})).find(t=>t.name==='ppt_create').parameters.properties.visualSpec)throw new Error('No visualSpec schema');
    const visual=await normal.create({title:'Projects',lang:'en',templateId:'user:register',visualSpec},exec);
    if(!visual.ok||!visual.visualComposition||!captured.slides.some(s=>s.elements.some(e=>e.type==='chart')))throw new Error('Packaged visual create failed');
    console.log('packaged-visual-exported');
    visualSpec.allowMoreSlides=true;
    visualSpec.slides.splice(1,0,{id:'table',title:'Register',visual:{type:'table',sourceRefs:['data'],headers:['Project','Value'],rows:Array.from({length:30},(_,i)=>['Project '+i,i===0?null:'001.20'])}});
    const mixed=await normal.create({title:'Mixed projects',lang:'en',templateId:'user:register',visualSpec},exec);
    const kinds=captured.slides.map(s=>s.elements.some(e=>e.type==='table')?'table':s.elements.some(e=>e.type==='chart')?'chart':'cards');
    if(!mixed.ok||mixed.visualComposition.sourceSlides!==3||kinds[0]!=='cards'||kinds.at(-1)!=='chart'||kinds.filter(k=>k==='table').length<2)throw new Error('Packaged mixed create failed');
    console.log('packaged-mixed-exported');
    const added=${JSON.stringify(ordinaryVisualSlides())};
    visualSpec.slides=added.map(s=>({...s,visual:{...s.visual,sourceRefs:['data']}}));
    const extended=await normal.create({title:'Extended visuals',lang:'ru',templateId:'user:register',visualSpec},exec);
    if(!extended.ok||extended.visualComposition.sourceSlides!==4||!captured.slides.some(s=>s.elements.some(e=>e.type==='table')))throw new Error('Packaged extended create failed');
    console.log('packaged-extended-exported');
    const {visualCreateContentHash}=await import('./package/skills/dsh-ppt/scripts/deck-visual-create.mjs');
    const {writeFileSync}=await import('node:fs');const {createHash}=await import('node:crypto');
    visualSpec.assets=${JSON.stringify([{id:'pack-image',...picture()}])};
    visualSpec.slides.push({id:'image',title:'Original picture',visual:{type:'image',sourceRefs:['data'],assetId:'pack-image',alt:'Red and blue source image',caption:'Preserve full image'}});
    visualSpec.contentHash=visualCreateContentHash(visualSpec);
    const fileArgs={title:'File projects',lang:'ru',templateId:'user:register',visualSpec};
    const bytes=JSON.stringify(fileArgs);writeFileSync('prepared.json',bytes);
    const fromFile=await normal.create({title:fileArgs.title,requestFile:'prepared.json',requestSha256:createHash('sha256').update(bytes).digest('hex')},exec);
    if(!fromFile.ok||!fromFile.requestInput||fromFile.visualComposition.sourceSlides!==5)throw new Error('Packaged requestFile create failed');
    console.log('packaged-file-exported');
  `
  const run=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:out,encoding:'utf8'})
  assert.equal(run.status,0,run.stderr);assert.match(run.stdout,/packaged-ui-exported/);assert.match(run.stdout,/packaged-table-exported/);assert.match(run.stdout,/packaged-visual-exported/);assert.match(run.stdout,/packaged-mixed-exported/);assert.match(run.stdout,/packaged-extended-exported/);assert.match(run.stdout,/packaged-file-exported/)
})
