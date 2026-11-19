// Pure, shared generation planning. Never repairs content or silently substitutes layouts.
import {transformedBounds} from './deck-geometry.mjs'
import {normalizeSceneChart,normalizeSceneTable} from './deck-structured.mjs'
export const GENERATION_POLICY=Object.freeze({version:1,minSlides:6,maxVariantRun:2,maxStructureRun:2,accentWindow:5})
export const VISUAL_STRUCTURES=Object.freeze(['list','cards','process','hierarchy','timeline','cycle','comparison','kpi','quote','number','relationship','chart','table','image'])
export const CONFIRMED_CHART_VARIANTS=Object.freeze(['column','bar','line','pie','doughnut','area','stacked-column','percent-stacked-bar'])
const clone=v=>JSON.parse(JSON.stringify(v))
function fail(code,path,message){const e=new Error(`dsh-ppt: ${code} at ${path}: ${message}`);e.code=code;e.path=path;throw e}
function object(v,path,keys){if(!v||typeof v!=='object'||Array.isArray(v))fail('generation-schema',path,'Expected object');for(const k of Object.keys(v))if(!keys.includes(k))fail('unknown-field',path+'.'+k,'Unknown field')}
function string(v,path,max=1024){if(typeof v!=='string'||!v.trim()||v.length>max)fail('generation-schema',path,'Expected non-empty bounded text');return v}
function integer(v,path,min=1,max=262144){if(!Number.isSafeInteger(v)||v<min||v>max)fail('generation-schema',path,'Expected bounded integer');return v}
function strings(v,path,choices){if(!Array.isArray(v)||v.length>32||new Set(v).size!==v.length)fail('generation-schema',path,'Expected unique list');return v.map((x,i)=>{string(x,path+'['+i+']');if(choices&&!choices.includes(x))fail('generation-schema',path,'Unknown choice '+x);return x})}
const defaultPage={width:12192000,height:6858000}
/** Structural signature deliberately excludes IDs, text, assets, colors and typography. */
export function variantSignature(layout,page=defaultPage){
 const parts=layout.elements.filter(e=>e.role!=='decor'&&!e.hidden&&e.type!=='group').map(e=>{
  const b=transformedBounds(e.frame,e.transform)
  return [e.type,...['x','y','w','h'].map(k=>Math.round(b[k]/(['x','w'].includes(k)?page.width:page.height)*100))]
 }).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))
 return JSON.stringify(parts)
}
export function variantRevision(layout){
 // Exact inputs to capacity estimation. Unlike the diversity signature, typography matters.
 let hash=14695981039346656037n
 for(const ch of JSON.stringify({elements:layout.elements,slots:layout.slots})){hash^=BigInt(ch.codePointAt(0));hash=BigInt.asUintN(64,hash*1099511628211n)}
 return hash.toString(16).padStart(16,'0')
}
export function describeVariant(layout,page=defaultPage){
 const slots=layout.slots.map(s=>{
  const e=layout.elements.find(e=>e.id===s.elementId),b=transformedBounds(e.frame,e.transform)
  const size=e.textStyle?.size??e.paragraphs?.[0]?.runs?.find(r=>r.style?.size)?.style.size??18
  const margins=e.textFrame?.margins??{},w=Math.max(0,b.w-(margins.left??91440)-(margins.right??91440)),h=Math.max(0,b.h-(margins.top??45720)-(margins.bottom??45720))
  const estimate=s.type==='text'?{characters:Math.max(1,Math.floor(w/(size*12700*.6))*Math.floor(h/(size*12700*1.25)))}:{}
  return {slotId:s.id,role:e.role??'content',types:[s.type],required:s.required??false,...(s.maxCharacters?{capacity:{characters:s.maxCharacters}}:{}),estimate,origin:'auto'}
 })
 const types=new Set(layout.slots.map(s=>s.type))
 return {version:1,origin:'auto',revision:variantRevision(layout),intent:'Заполнение областей: '+layout.slots.map(s=>s.name??s.type).join(', ').slice(0,900),suitableFor:[],constraints:[],frequency:'main',structures:[...(types.has('text')?['list']:[]),...['chart','table','image'].filter(t=>types.has(t))],slots}
}
export function normalizeVariantDescription(input,layout,page=defaultPage){
 if(input===undefined)return describeVariant(layout,page)
 const path='description';object(input,path,['version','origin','revision','intent','suitableFor','constraints','frequency','structures','slots'])
 if(input.version!==1||!['auto','user'].includes(input.origin))fail('generation-schema',path,'Unknown description version/origin')
 const out=clone(input);out.intent=string(input.intent,path+'.intent');out.suitableFor=strings(input.suitableFor??[],path+'.suitableFor');out.constraints=strings(input.constraints??[],path+'.constraints');out.structures=strings(input.structures??[],path+'.structures',VISUAL_STRUCTURES)
 if(!['main','support','accent'].includes(input.frequency))fail('generation-schema',path+'.frequency','Unknown frequency')
 if(input.revision!==undefined)string(input.revision,path+'.revision',1000000)
 if(!Array.isArray(input.slots)||input.slots.length!==layout.slots.length)fail('generation-schema',path+'.slots','Describe every slot exactly once')
 const seen=new Set()
 out.slots=input.slots.map((s,i)=>{
  const at=path+'.slots['+i+']';object(s,at,['slotId','role','types','required','capacity','estimate','origin'])
  const slot=layout.slots.find(v=>v.id===s.slotId);if(!slot||seen.has(s.slotId))fail('unknown-slot',at,'Unknown or duplicate slot');seen.add(s.slotId)
  string(s.role,at+'.role',128);strings(s.types,at+'.types',['text','image','chart','table']);if(s.types.length!==1||s.types[0]!==slot.type)fail('slot-type',at,'Description must match the actual slot type')
  if(typeof s.required!=='boolean'||s.required!==(slot.required??false))fail('generation-schema',at,'Required flag must match slot')
  if(!['auto','user'].includes(s.origin))fail('generation-schema',at,'Unknown capacity origin')
  for(const key of ['capacity','estimate'])if(s[key]!==undefined){const allowed={text:['characters','items'],chart:['categories','series'],table:['rows','columns'],image:[]}[slot.type];object(s[key],at+'.'+key,allowed);for(const [k,v]of Object.entries(s[key]))integer(v,at+'.'+key+'.'+k)}
  if(slot.maxCharacters&&s.capacity?.characters&&s.capacity.characters>slot.maxCharacters)fail('slot-limit',at,'Description cannot override the slot character limit')
  return clone(s)
 })
 // Recompute stale estimates, retaining user intent and hard capacities.
 if(input.revision!==variantRevision(layout)){
  const calculated=describeVariant(layout,page)
  out.slots=out.slots.map(s=>({...s,estimate:calculated.slots.find(x=>x.slotId===s.slotId).estimate}))
  out.revision=calculated.revision
 }
 return out
}
export function chartApplicability(chart,evidence={}){
 const issues=[],add=(code,message)=>issues.push({code,severity:'error',message})
 const variant=chart.grouping==='stacked'&&chart.kind==='column'?'stacked-column':chart.grouping==='percentStacked'&&chart.kind==='bar'?'percent-stacked-bar':chart.kind
 if(!CONFIRMED_CHART_VARIANTS.includes(variant)||(['stacked','percentStacked'].includes(chart.grouping)&&!['stacked-column','percent-stacked-bar'].includes(variant)))add('chart-unconfirmed','Chart variant has not passed the capability matrix')
 if(['line','area'].includes(chart.kind)&&evidence.ordered!==true)add('chart-order','An ordered axis must be explicitly confirmed')
 if(['pie','doughnut'].includes(chart.kind)||chart.grouping==='percentStacked'){if(evidence.whole!==true)add('chart-whole','Parts of a whole must be explicitly confirmed')}
 if(['stacked','percentStacked'].includes(chart.grouping)&&evidence.additive!==true)add('chart-additivity','Additive components must be explicitly confirmed')
 if(['pie','doughnut'].includes(chart.kind)||['stacked','percentStacked'].includes(chart.grouping)){
  if(chart.series.some(s=>s.values.some(v=>v<0)))add('chart-sign','This representation requires nonnegative components')
  if(chart.grouping==='percentStacked'&&chart.categories.some((_,i)=>chart.series.reduce((n,s)=>n+s.values[i],0)<=0))add('chart-zero-whole','Each whole must have a positive sum')
 }
 return issues
}
export function generationInputProperties(){return {
 deckPlan:{type:'array',minItems:1,maxItems:120,description:'Schema 3 template plan. Choose variant IDs and structures from template descriptions by meaning. Include original slot values; validator reports errors and rhythm warnings without replacing the choice.',items:{type:'object',additionalProperties:false,required:['id','variantId','intent','structure','values'],properties:{id:{type:'string'},variantId:{type:'string'},intent:{type:'string'},structure:{type:'string',enum:[...VISUAL_STRUCTURES]},values:{type:'object',additionalProperties:true},sources:{type:'array',items:{type:'string'}},evidence:{type:'object',additionalProperties:false,properties:{ordered:{type:'boolean'},whole:{type:'boolean'},additive:{type:'boolean'},repeats:{type:'boolean'}}}}}}
}}
/** Deterministic maximum distinct feasible variants, not number of IDs in the ZIP. */
function reachableDistinct(sets){const matched=new Map();function visit(i,seen){for(const signature of sets[i]){if(seen.has(signature))continue;seen.add(signature);if(!matched.has(signature)||visit(matched.get(signature),seen)){matched.set(signature,i);return true}}return false}for(let i=0;i<sets.length;i++)visit(i,new Set());return matched.size}
export function validateDeckPlan(plan,layouts,{pageSize=defaultPage,policy=GENERATION_POLICY}={}){
 if(!Array.isArray(plan)||!plan.length||plan.length>120)fail('plan-limit','deckPlan','Expected 1–120 slides')
 object(policy,'policy',Object.keys(GENERATION_POLICY));if(policy.version!==1)fail('generation-schema','policy.version','Unknown policy version');for(const k of ['minSlides','maxVariantRun','maxStructureRun','accentWindow'])integer(policy[k],'policy.'+k,1,120)
 const descriptions=new Map(layouts.map(l=>[l.id,normalizeVariantDescription(l.description,l,pageSize)])),signatures=new Map(layouts.map(l=>[l.id,variantSignature(l,pageSize)])),diagnostics=[],seen=new Set()
 const add=(severity,code,p,message,extra={})=>diagnostics.push({severity,code,slideId:p.id,variantId:p.variantId,message,...extra})
 function compatibility(p,l,report){
  const d=descriptions.get(l.id),issues=[]
  if(!d.structures.includes(p.structure))issues.push({code:'plan-structure',message:'Variant does not support this structure'})
  if(['process','timeline'].includes(p.structure)&&p.evidence?.ordered!==true)issues.push({code:'plan-order',message:'Order must be explicitly confirmed'})
  if(p.structure==='cycle'&&p.evidence?.repeats!==true)issues.push({code:'plan-cycle',message:'Repetition must be explicitly confirmed'})
  for(const key of Object.keys(p.values))if(!l.slots.some(s=>s.id===key))issues.push({code:'unknown-slot',slotId:key,message:'Unknown slot'})
  for(const s of d.slots){const value=p.values[s.slotId];if(value===undefined){if(s.required)issues.push({code:'plan-required',slotId:s.slotId,message:'Required slot has no content'});continue}
   const slot=l.slots.find(x=>x.id===s.slotId),type=slot.type
   const text=type==='text'?(typeof value==='string'?value:Array.isArray(value)?value.map(p=>p.runs?.map(r=>r.text??'').join('')??'').join('\n'):null):null
   const valid=type==='text'?text!==null:type==='image'?typeof value==='string':value&&typeof value==='object'&&!Array.isArray(value)
   if(!valid){issues.push({code:'slot-type',slotId:s.slotId,message:'Content does not match slot type'});continue}
   try{if(type==='chart')normalizeSceneChart(value);if(type==='table')normalizeSceneTable(value)}catch(error){issues.push({code:error.code??'slot-type',slotId:s.slotId,message:error.message});continue}
   const counts=type==='text'?{characters:text.length,items:typeof value==='string'?value.split('\n').length:value.length}:type==='chart'?{categories:value.categories?.length??0,series:value.series?.length??0}:type==='table'?{rows:value.rows?.length??0,columns:value.columns?.length??0}:{}
   for(const [k,n]of Object.entries(counts))if(s.capacity?.[k]&&n>s.capacity[k])issues.push({code:'plan-capacity',slotId:s.slotId,message:'Content exceeds '+k+' limit'})
   if(slot.maxCharacters&&counts.characters>slot.maxCharacters)issues.push({code:'plan-capacity',slotId:s.slotId,message:'Content exceeds slot character limit'})
   if(report&&counts.characters>s.estimate?.characters)add('warning','plan-fit-risk',p,'Estimated text capacity exceeded; verify rendered fit',{slotId:s.slotId})
   if(type==='chart'&&Array.isArray(value.series)&&Array.isArray(value.categories))issues.push(...chartApplicability(value,p.evidence).map(i=>({...i,slotId:s.slotId})))
  }
  if(report)for(const i of issues)add('error',i.code,p,i.message,i.slotId?{slotId:i.slotId}:{})
  return issues.length===0
 }
 const rows=plan.map((p,i)=>{
  object(p,'deckPlan['+i+']',['id','variantId','intent','structure','values','sources','evidence']);string(p.id,'id',128);if(seen.has(p.id))fail('duplicate-slide','id','Duplicate plan slide ID');seen.add(p.id);string(p.variantId,'variantId',128);string(p.intent,'intent',4096);if(!VISUAL_STRUCTURES.includes(p.structure))fail('generation-schema','structure','Unknown structure');object(p.values,'values',Object.keys(p.values??{}));if(p.sources!==undefined)strings(p.sources,'sources');if(p.evidence!==undefined){object(p.evidence,'evidence',['ordered','whole','additive','repeats']);for(const v of Object.values(p.evidence))if(typeof v!=='boolean')fail('generation-schema','evidence','Expected boolean')}
  const l=layouts.find(l=>l.id===p.variantId);if(!l){add('error','unknown-variant',p,'Unknown variant');return {p,eligible:[],signature:'',content:true,accent:false}}
  compatibility(p,l,true)
  // Alternative layouts must accept actual values by stable slot IDs; never remap them silently.
  const eligible=layouts.filter(l=>compatibility(p,l,false)).map(l=>l.id)
  return {p,eligible,signature:signatures.get(l.id),content:!['cover','section','closing'].includes(l.purpose),accent:descriptions.get(l.id).frequency==='accent'}
 })
 const content=rows.filter(r=>r.content),structures=new Set(content.map(r=>r.p.structure)),used=new Set(content.map(r=>r.signature)),achievable=reachableDistinct(content.map(r=>new Set(r.eligible.map(id=>signatures.get(id)))))
 let maxVariantRun=0,maxStructureRun=0,vr=0,sr=0
 for(let i=0;i<content.length;i++){const r=content[i];vr=i&&r.signature===content[i-1].signature?vr+1:1;sr=i&&r.p.structure===content[i-1].p.structure?sr+1:1;maxVariantRun=Math.max(maxVariantRun,vr);maxStructureRun=Math.max(maxStructureRun,sr)
  if(content.length>=policy.minSlides){if(vr===policy.maxVariantRun+1)add('warning','rhythm-variant-run',r.p,'Repeated structural variant',{alternatives:r.eligible.filter(id=>signatures.get(id)!==r.signature)})
   if(sr===policy.maxStructureRun+1)add('warning','rhythm-structure-run',r.p,'Repeated visual structure',{alternatives:[]})
   if(r.accent&&content.slice(Math.max(0,i-policy.accentWindow+1),i).some(x=>x.accent))add('warning','rhythm-accent',r.p,'Accent slides are too close',{alternatives:r.eligible.filter(id=>descriptions.get(id).frequency!=='accent')})
  }
 }
 const target=Math.min(achievable,Math.ceil(content.length/3))
 if(content.length>=policy.minSlides){if(achievable<=1)add('warning','rhythm-limited-variants',content[0].p,'Template/content has only one compatible structural variant')
  if(used.size<target)add('warning','rhythm-variety',content[0].p,'Too few structural variants',{expected:target,actual:used.size})
  if(structures.size===1)add('warning','rhythm-uniform-content',content[0].p,'One visual structure; use other structures only if supported by the material')
 }
 return {version:1,policy:{...policy},valid:!diagnostics.some(d=>d.severity==='error'),diagnostics,metrics:{contentSlides:content.length,variants:used.size,structures:structures.size,reachableVariants:achievable,targetVariants:target,maxVariantRun,maxStructureRun},usedVariants:[...new Set(rows.map(r=>r.p.variantId))],usedStructures:[...structures],unusedVariants:layouts.filter(l=>!rows.some(r=>r.p.variantId===l.id)).map(l=>l.id)}
}
