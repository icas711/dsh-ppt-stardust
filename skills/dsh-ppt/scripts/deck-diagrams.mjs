import {normalizeSceneSlide} from './deck-model.mjs'
import {normalizeSceneChart} from './deck-structured.mjs'
import {normalizePageSize} from './deck-page.mjs'
function fail(message){throw new Error('dsh-ppt: diagram-input: '+message)}
/** Explicit semantics only: never invent relationships, chronology or numeric values from bullets. */
export function diagramToScene(input,{pageSize,accent='#2864B4',color='#202020'}={}){
 const size=normalizePageSize(pageSize)??{width:12192000,height:6858000},d=input.diagram
 if(!d||!['process','timeline','comparison','hierarchy','relationship','chart'].includes(d.kind))fail('Choose an explicit semantic kind')
 const elements=[],margin=Math.round(size.width*.055),top=Math.round(size.height*.22),w=size.width-2*margin,h=Math.round(size.height*.65)
 const text=(id,label,x,y,width,height,bold=false)=>({id,type:'text',frame:{x:Math.round(x),y:Math.round(y),w:Math.round(width),h:Math.round(height)},textStyle:{size:bold?24:18,bold,color},textFrame:{anchor:'center',align:'center',margins:{left:40000,right:40000,top:40000,bottom:40000}},paragraphs:String(label).split('\n').map(s=>({runs:[{text:s}]}))})
 if(input.title)elements.push(text('diagram-title',input.title,margin,margin,w,size.height*.12,true))
 if(d.kind==='chart'){
  elements.push({id:'diagram-chart',type:'chart',frame:{x:margin,y:top,w,h},chart:normalizeSceneChart(d.chart)})
  return normalizeSceneSlide({layout:'scene',label:input.title??'',notes:input.notes??'',elements})
 }
 if(!Array.isArray(d.items)||!d.items.length||d.items.length>12)fail('Expected 1–12 items; split larger diagrams into several slides')
 const ids=new Set()
 const items=d.items.map((item,i)=>{if(!item||typeof item.label!=='string'||!item.label.trim()||item.label.length>8000)fail('Each item needs a non-empty label up to 8000 characters');const id=item.id??'item-'+(i+1);if(typeof id!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,80}$/.test(id)||ids.has(id))fail('Item IDs must be unique');ids.add(id);if(item.detail!==undefined&&typeof item.detail!=='string')fail('Item detail must be text');if(item.date!==undefined&&typeof item.date!=='string')fail('Dates must be explicit text');return {...item,id}})
 const positions=new Map(),links=[]
 if(['process','timeline','comparison'].includes(d.kind)){
  const columns=d.kind==='comparison'?Math.min(4,items.length):Math.min(6,items.length),rows=Math.ceil(items.length/columns),cw=w/columns,ch=h/rows
  items.forEach((item,i)=>positions.set(item.id,{x:margin+(i%columns)*cw+cw*.06,y:top+Math.floor(i/columns)*ch+ch*.1,w:cw*.88,h:ch*.65}))
  if(d.kind!=='comparison')for(let i=1;i<items.length;i++)links.push({from:items[i-1].id,to:items[i].id})
 }else if(d.kind==='hierarchy'){
  const depth=new Map(),active=new Set(),byId=new Map(items.map(i=>[i.id,i]))
  const level=id=>{if(active.has(id))fail('Hierarchy contains a cycle');if(depth.has(id))return depth.get(id);active.add(id);const item=byId.get(id);if(item.parentId&&!byId.has(item.parentId))fail('Unknown parent '+item.parentId);const n=item.parentId?level(item.parentId)+1:0;active.delete(id);depth.set(id,n);return n}
  items.forEach(item=>level(item.id));const max=Math.max(...depth.values()),ch=h/(max+1)
  for(let n=0;n<=max;n++){const row=items.filter(i=>depth.get(i.id)===n),cw=w/row.length;row.forEach((item,i)=>{positions.set(item.id,{x:margin+i*cw+cw*.06,y:top+n*ch+ch*.1,w:cw*.88,h:ch*.65});if(item.parentId)links.push({from:item.parentId,to:item.id})})}
 }else{
  items.forEach((item,i)=>{const a=i/items.length*2*Math.PI-Math.PI/2;positions.set(item.id,{x:margin+w/2+Math.cos(a)*w*.34-w*.12,y:top+h/2+Math.sin(a)*h*.32-h*.12,w:w*.24,h:h*.24})})
  if(!Array.isArray(d.links))fail('Relationship diagram requires explicit links')
  for(const link of d.links){if(!ids.has(link.from)||!ids.has(link.to)||link.from===link.to)fail('Invalid relationship endpoints');links.push(link)}
 }
 for(const [i,link]of links.entries()){
  const a=positions.get(link.from),b=positions.get(link.to),ac={x:a.x+a.w/2,y:a.y+a.h/2},bc={x:b.x+b.w/2,y:b.y+b.h/2},dx=bc.x-ac.x,dy=bc.y-ac.y
  const edge=box=>Math.min(dx?box.w/2/Math.abs(dx):Infinity,dy?box.h/2/Math.abs(dy):Infinity)
  const start=edge(a),end=edge(b),x1=ac.x+dx*start,y1=ac.y+dy*start,x2=bc.x-dx*end,y2=bc.y-dy*end
  const box={x:Math.round(Math.min(x1,x2)),y:Math.round(Math.min(y1,y2)),w:Math.round(Math.abs(x2-x1)),h:Math.round(Math.abs(y2-y1))}
  elements.push({id:'connection-'+i,type:'line',frame:box,...((x2<x1||y2<y1)?{transform:[x2<x1?-1:1,0,0,y2<y1?-1:1,x2<x1?2*box.x+box.w:0,y2<y1?2*box.y+box.h:0]}:{}),stroke:{color:accent,width:1.5,tail:'triangle'}})
 }
 for(const item of items){const box=positions.get(item.id),frame=Object.fromEntries(Object.entries(box).map(([k,v])=>[k,Math.round(v)]));elements.push({id:item.id+'-box',type:'shape',frame,preset:'roundRect',fill:{color:'#F3F5F8'},stroke:{color:accent,width:1.5}});elements.push(text(item.id,[item.date,item.label,item.detail].filter(s=>s!==undefined&&s!=='').join('\n'),box.x,box.y,box.w,box.h))}
 return normalizeSceneSlide({layout:'scene',label:input.title??'',notes:input.notes??'',elements})
}
export function expandDiagramSlides(slides,options){return slides?.map(s=>s?.layout==='diagram'?diagramToScene(s,options):s)}
