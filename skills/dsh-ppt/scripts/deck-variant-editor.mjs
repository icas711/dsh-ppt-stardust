// Shared authoring operations. Fixed family artwork is never reflowed.
import {describeVariant,normalizeVariantDescription,variantSignature} from './deck-generation.mjs'
import {transformedBounds} from './deck-geometry.mjs'
const clone=v=>JSON.parse(JSON.stringify(v))
export const VARIANT_PLACEHOLDER=Object.freeze({id:'img-9abb0aa959121b62398cb713a7fd50c71e658c22d94cba82676705559173cd05',mime:'image/png',width:2,height:2,data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGN49+7dfxBmgDEAh/APJZX/yYwAAAAASUVORK5CYII='})
function fail(message){const e=new Error('dsh-ppt: variant-edit: '+message);e.code='variant-edit';throw e}
export function reconcileVariantDescription(layout,pageSize){
 const fresh=describeVariant(layout,pageSize),old=layout.description
 if(!old||old.origin==='auto')return fresh
 return normalizeVariantDescription({...old,slots:fresh.slots.map(s=>{const previous=old.slots.find(v=>v.slotId===s.slotId&&v.types[0]===s.types[0]);return previous?{...previous,required:s.required,types:s.types}:s})},layout,pageSize)
}
export function createSceneVariant(layout,{id,mode='duplicate',pageSize={width:12192000,height:6858000},columns=2}={}){
 if(typeof id!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/.test(id))fail('Provide a new stable variant ID up to 80 characters')
 if(!['duplicate','mirror','columns','image-left','image-right','no-image'].includes(mode))fail('Unknown operation')
 const out=clone(layout),ids=new Map(out.elements.map((e,i)=>[e.id,id+'.object.'+i])),slots=new Map(out.slots.map((s,i)=>[s.id,id+'.slot.'+i]))
 out.id=id;out.name=layout.name+' — '+mode
 for(const e of out.elements){e.id=ids.get(e.id);if(e.children)e.children=e.children.map(c=>ids.get(c));if(e.slotId)e.slotId=slots.get(e.slotId)}
 out.slots=out.slots.map(s=>({...s,id:slots.get(s.id),elementId:ids.get(s.elementId)}))
 if(out.description)out.description.slots=out.description.slots.map(s=>({...s,slotId:slots.get(s.slotId)}))
 const targets=out.elements.filter(e=>out.slots.some(s=>s.elementId===e.id))
 if(mode!=='duplicate'&&out.elements.some(e=>e.type==='group'||e.type==='line'))fail('Automatic reflow of grouped/connected layouts requires explicit object editing; duplicate preserves them')
 const shift=(e,x)=>{const b=transformedBounds(e.frame,e.transform),dx=Math.round(x-b.x);if(e.transform)e.transform[4]+=dx;else e.frame.x+=dx}
 if(mode==='mirror')for(const e of targets){const b=transformedBounds(e.frame,e.transform);shift(e,pageSize.width-b.x-b.w)}
 if(mode==='columns'){
  if(!Number.isInteger(columns)||columns<1||columns>4)fail('Choose 1–4 columns')
  if(targets.some(e=>e.transform||e.type==='table'))fail('Reflow of rotated objects or tables requires explicit object editing')
  if(!targets.length)fail('No content areas to arrange')
  while(targets.length<columns){const prototype=targets[targets.length-1],oldSlot=out.slots.find(s=>s.elementId===prototype.id),n=targets.length,objectId=id+'.column.'+n,slotId=id+'.column-slot.'+n,e={...clone(prototype),id:objectId,slotId};out.elements.push(e);targets.push(e);out.slots.push({...oldSlot,id:slotId,elementId:objectId});const previous=out.description?.slots.find(s=>s.slotId===oldSlot.id);if(previous)out.description.slots.push({...clone(previous),slotId})}
  const margin=Math.round(pageSize.width*.055),gap=Math.round(pageSize.width*.025),width=Math.floor((pageSize.width-2*margin-gap*(columns-1))/columns)
  const top=targets.length?Math.min(...targets.map(e=>e.frame.y)):margin,bottom=targets.length?Math.max(...targets.map(e=>e.frame.y+e.frame.h)):pageSize.height-margin,rows=Math.ceil(targets.length/columns),height=Math.floor((bottom-top-gap*(rows-1))/Math.max(1,rows))
  if(height<=0)fail('Not enough space for this grid')
  targets.forEach((e,i)=>{e.frame={x:margin+(i%columns)*(width+gap),y:top+Math.floor(i/columns)*(height+gap),w:width,h:height}})
 }
 if(['image-left','image-right'].includes(mode)){
  if(!targets.some(e=>e.type==='image')){
   const e={id:id+'.new-image',type:'image',role:'content',frame:{x:0,y:targets[0]?.frame.y??500000,w:1000000,h:targets[0]?.frame.h??1000000},assetId:VARIANT_PLACEHOLDER.id,fit:'cover',alt:'Заполнить: изображение'}
   out.elements.push(e);targets.push(e);out.slots.push({id:id+'.new-image-slot',elementId:e.id,type:'image',required:true,name:'Image'})
  }
  const images=targets.filter(e=>e.type==='image'),texts=targets.filter(e=>e.type==='text');if(images.length!==1||!texts.length||targets.some(e=>e.transform))fail('This operation requires one image and unrotated text areas')
  const margin=Math.round(pageSize.width*.055),width=Math.round(pageSize.width*.4),left=mode==='image-left',gap=Math.round(pageSize.height*.02),top=Math.min(...targets.map(e=>e.frame.y)),bottom=Math.max(...targets.map(e=>e.frame.y+e.frame.h)),height=Math.floor((bottom-top-gap*(texts.length-1))/texts.length)
  if(height<=0)fail('Not enough space for text next to the image')
  images[0].frame={x:left?margin:pageSize.width-margin-width,y:top,w:width,h:bottom-top}
  texts.forEach((e,i)=>{e.frame={x:left?pageSize.width-margin-width:margin,y:top+i*(height+gap),w:width,h:height}})
 }
 if(mode==='no-image'){const removed=new Set(targets.filter(e=>e.type==='image').map(e=>e.id));out.elements=out.elements.filter(e=>!removed.has(e.id));out.slots=out.slots.filter(s=>!removed.has(s.elementId))}
 out.description=reconcileVariantDescription(out,pageSize)
 return out
}
export function duplicateVariantIds(layouts,pageSize){const seen=new Map(),duplicates=[];for(const l of layouts){const signature=variantSignature(l,pageSize);if(seen.has(signature))duplicates.push({variantId:l.id,duplicateOf:seen.get(signature)});else seen.set(signature,l.id)}return duplicates}
export function variantSampleValues(layout,length='short'){
 const values={}
 for(const slot of layout.slots){const e=layout.elements.find(e=>e.id===slot.elementId)
  if(slot.type==='text')values[slot.id]=Array.from({length:length==='long'?6:2},(_,i)=>'Sample '+(i+1)+(length==='long'?': a deliberately longer fact to inspect wrapping and overflow.':': a short fact.')).join('\n')
  if(slot.type==='image')values[slot.id]=e.assetId
  if(slot.type==='chart')values[slot.id]=clone(e.chart)
  if(slot.type==='table')values[slot.id]=clone(e.table)
 }
 return values
}
/** Explicit authoring operation: sample content is replaced; the editor records undo. */
export function changeSceneSlotType(layout,slotId,type,pageSize){
 if(!['text','image','chart','table'].includes(type))fail('Unsupported slot type')
 const out=clone(layout),slot=out.slots.find(s=>s.id===slotId);if(!slot)fail('Unknown slot')
 const old=out.elements.find(e=>e.id===slot.elementId);if(old.type===type)return out
 const e=Object.fromEntries(Object.entries(old).filter(([key])=>['id','role','frame','name','slotId','transform','source','hidden'].includes(key)));e.type=type
 if(type==='text'){const prototype=out.elements.find(e=>e.type==='text');e.paragraphs=[{runs:[{text:'Заполнить: текст'}]}];if(prototype?.textStyle)e.textStyle=clone(prototype.textStyle)}
 if(type==='image'){e.assetId=VARIANT_PLACEHOLDER.id;e.fit='contain';e.alt='Заполнить: изображение'}
 if(type==='chart')e.chart={kind:'column',categories:['Заполнить: категория'],series:[{name:'Заполнить: серия',values:[1]}]}
 if(type==='table')e.table={columns:[e.frame.w],rows:[e.frame.h],cells:[{row:0,col:0,rowSpan:1,colSpan:1,paragraphs:[{runs:[{text:'Заполнить: ячейка'}]}]}]}
 out.elements=out.elements.map(v=>v.id===e.id?e:v);slot.type=type;delete slot.maxCharacters
 out.description=reconcileVariantDescription(out,pageSize)
 return out
}
