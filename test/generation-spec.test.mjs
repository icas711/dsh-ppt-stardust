import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {generationSpecSchema,generationBriefSchema,validateGenerationBrief,validateGenerationSpec,generationSpecToContent,GENERATION_VISUAL_TYPES} from '../skills/dsh-ppt/scripts/deck-generation-spec.mjs'

const context={sources:[{id:'source-1',text:'Supplied project facts'}],assetIds:['photo-1'],iconIds:['check']}
const refs={sourceRefs:['source-1']}
const items=n=>Array.from({length:n},(_,i)=>({id:'item-'+i,label:'Item '+i}))
const samples=[
  {type:'cards',...refs,items:items(2).map(i=>({...i,iconId:'check'}))},
  {type:'process',...refs,ordered:true,items:items(3)},
  {type:'timeline',...refs,ordered:true,items:items(2).map((i,n)=>({...i,date:'2026-0'+(n+1)}))},
  {type:'comparison',...refs,criteria:['Status'],items:items(2).map((i,n)=>({...i,values:[n?'Ready':null]}))},
  {type:'big_number',...refs,items:items(2).map((i,n)=>({...i,value:30+n,unit:'videos'}))},
  {type:'chart',...refs,kind:'column',unit:'videos',categories:['A','B'],series:[{name:'Count',values:[30,15]}]},
  {type:'table',...refs,headers:['Project','Status'],rows:[['Avatar','Ready'],['Assistant',null]]},
  {type:'image',...refs,assetId:'photo-1',alt:'Project screenshot',caption:'Prototype'}
]
const make=(visual=samples[0])=>({version:1,title:'Projects',lang:'ru',mode:'factual',slides:[{id:'slide-1',purpose:'content',title:'Pilot',visual:structuredClone(visual)}]})
const codes=report=>report.diagnostics.map(d=>d.code)

test('all eight content types bind to external registries without geometry or mutation',()=>{
  assert.deepEqual(samples.map(s=>s.type),GENERATION_VISUAL_TYPES)
  for(const sample of samples){
    const input=make(sample),before=structuredClone(input),content=generationSpecToContent(input,context)
    assert.equal(validateGenerationSpec(input,context).valid,true)
    assert.deepEqual(input,before);assert.deepEqual(content.slides[0].visual,sample)
    assert.equal(JSON.stringify(content).includes('"frame"'),false)
    assert.equal(!!content.slides[0].diagram,!['table','image'].includes(sample.type))
  }
})

test('schema is portable and independent; brief requires an explicit attachment role',()=>{
  const schema=generationSpecSchema();schema.properties.slides.maxItems=1
  assert.equal(generationSpecSchema().properties.slides.maxItems,120)
  assert.equal(generationBriefSchema().properties.attachments.items.properties.role.enum.includes('both'),true)
  const brief={version:1,goal:'Explain projects',audience:'Managers',lang:'ru',templateId:'user:corporate',allowMoreSlides:true,attachments:[{id:'file-1',role:'content'}],requiredFacts:['30 videos']}
  assert.equal(validateGenerationBrief(brief).valid,true)
  delete brief.attachments[0].role;assert.equal(validateGenerationBrief(brief).valid,false)
})

test('unknown fields, unsupported versions/types and incomplete items are rejected at an exact path',()=>{
  const input=make();input.slides[0].visual.frame={x:1}
  assert.ok(validateGenerationSpec(input,context).diagnostics.some(d=>d.path==='spec.slides[0].visual.frame'&&d.code==='unknown-field'))
  delete input.slides[0].visual.frame;delete input.slides[0].visual.items[0].label
  assert.equal(validateGenerationSpec(input,context).valid,false)
  input.version=2;assert.equal(validateGenerationSpec(input,context).valid,false)
  input.version=1;input.slides[0].visual.type='smartart';assert.equal(validateGenerationSpec(input,context).valid,false)
  assert.equal(validateGenerationSpec(null,context).valid,false)
})

test('references cannot be self-authorized by the model; unknown assets and icons block conversion',()=>{
  assert.ok(codes(validateGenerationSpec(make())).includes('source-registry'))
  const input=make();input.slides[0].visual.sourceRefs=['invented']
  assert.ok(codes(validateGenerationSpec(input,context)).includes('unknown-source'))
  assert.throws(()=>generationSpecToContent(input,context),e=>e.code==='generation-spec'&&e.diagnostics[0].slideId==='slide-1')
  assert.ok(codes(validateGenerationSpec(make(samples[7]),{...context,assetIds:[]})).includes('unknown-asset'))
  assert.ok(codes(validateGenerationSpec(make(),{...context,iconIds:[]})).includes('unknown-icon'))
})

test('synthetic source requires demo mode and emits a disclosure for subsequent rendering',()=>{
  const ctx={...context,sources:[{...context.sources[0],synthetic:true}]},input=make()
  assert.ok(codes(validateGenerationSpec(input,ctx)).includes('synthetic-source'))
  input.mode='demo';assert.equal(validateGenerationSpec(input,ctx).valid,true)
  assert.ok(generationSpecToContent(input,ctx).disclosures[0].includes('Синтетические'))
})

test('duplicate slide and item IDs, blank text and oversized content fail before composition',()=>{
  const input=make();input.slides.push(structuredClone(input.slides[0]))
  assert.ok(codes(validateGenerationSpec(input,context)).includes('duplicate-id'))
  input.slides.pop();input.slides[0].visual.items[1].id=input.slides[0].visual.items[0].id
  assert.ok(codes(validateGenerationSpec(input,context)).includes('duplicate-id'))
  input.title='   ';assert.equal(validateGenerationSpec(input,context).valid,false)
  input.title='x'.repeat(501);assert.equal(validateGenerationSpec(input,context).valid,false)
})

test('semantic checks preserve chronology, shared comparison criteria and unknown values',()=>{
  const timeline=make(samples[2]);timeline.slides[0].visual.items[1].date='2025-02'
  assert.ok(codes(validateGenerationSpec(timeline,context)).includes('generation-semantic'))
  timeline.slides[0].visual.items[1].date='2026-02-30'
  assert.equal(validateGenerationSpec(timeline,context).valid,false)
  const comparison=make(samples[3]);assert.equal(generationSpecToContent(comparison,context).slides[0].diagram.items[0].values[0],null)
  comparison.slides[0].visual.items[0].values.push('Extra');assert.equal(validateGenerationSpec(comparison,context).valid,false)
  const process=make(samples[1]);process.slides[0].visual.ordered=false;assert.equal(validateGenerationSpec(process,context).valid,false)
})

test('charts reject unaligned series, non-finite values and unsupported statistical implications',()=>{
  const input=make(samples[5]),v=input.slides[0].visual
  v.series[0].values.pop();assert.equal(validateGenerationSpec(input,context).valid,false)
  v.series[0].values=[30,NaN];assert.equal(validateGenerationSpec(input,context).valid,false)
  v.series[0].values=[30,15];v.kind='line';assert.ok(codes(validateGenerationSpec(input,context)).includes('chart-order'))
  v.ordered=true;assert.equal(validateGenerationSpec(input,context).valid,true)
  v.kind='pie';assert.ok(codes(validateGenerationSpec(input,context)).includes('chart-whole'))
  v.whole=true;v.series[0].values=[-30,15];assert.equal(validateGenerationSpec(input,context).valid,false)
})

test('table rows preserve missing values and must match header width',()=>{
  const input=make(samples[6]);assert.equal(generationSpecToContent(input,context).slides[0].visual.rows[1][1],null)
  input.slides[0].visual.rows[0].pop();assert.ok(codes(validateGenerationSpec(input,context)).includes('table-dimensions'))
})

test('single and paired numeric accents retain exact values, units and source bindings',()=>{
  const input=make(samples[4]);input.slides[0].visual.items.pop()
  const one=generationSpecToContent(input,context).slides[0].diagram
  assert.equal(one.kind,'number');assert.equal(one.items[0].value,30);assert.equal(one.items[0].source,'source-1')
  assert.equal(generationSpecToContent(make(samples[4]),context).slides[0].diagram.kind,'kpi')
})

test('CLI exposes portable schema and reports input failures as JSON with nonzero exit',()=>{
  const cli=fileURLToPath(new URL('../scripts/generation-spec.mjs',import.meta.url))
  const schema=spawnSync(process.execPath,[cli,'schema'],{encoding:'utf8'})
  assert.equal(schema.status,0,schema.stderr);assert.deepEqual(JSON.parse(schema.stdout),generationSpecSchema())
  const invalid=spawnSync(process.execPath,[cli,'validate'],{encoding:'utf8'})
  assert.equal(invalid.status,1);assert.equal(JSON.parse(invalid.stdout).valid,false)
})
