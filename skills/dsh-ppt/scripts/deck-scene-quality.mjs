import {transformedBounds} from './deck-geometry.mjs'
import {mergeSceneTextStyles} from './deck-model.mjs'
const rgb=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16))
export function colorContrast(a,b){
 const lum=c=>rgb(c).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0)
 const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)
}
const blend=(a,b,t)=>'#'+rgb(a).map((v,i)=>Math.round(v*t+rgb(b)[i]*(1-t)).toString(16).padStart(2,'0')).join('').toUpperCase()
const overlaps=(a,b)=>a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h
const contains=(a,b)=>a.x<=b.x&&a.y<=b.y&&a.x+a.w>=b.x+b.w&&a.y+a.h>=b.y+b.h
const axisAligned=e=>!e.transform||(!e.transform[1]&&!e.transform[2])
/** Conservative solid-colour checks. Unknown/image backgrounds are never certified. */
export function sceneContrastIssues(slide,{background,textColor}){
 const issues=[],elements=slide.elements,byId=new Map(elements.map(e=>[e.id,e])),parents=new Map()
 for(const e of elements)if(e.type==='group')for(const id of e.children)parents.set(id,e.id)
 const hidden=e=>e.hidden||(parents.has(e.id)&&hidden(byId.get(parents.get(e.id))))
 function backdrop(target,index){
  let bg=slide.backgroundAssetId?undefined:slide.backgroundColor??background
  const box=transformedBounds(target.frame,target.transform)
  for(const prior of elements.slice(0,index)){
   if(hidden(prior)||['group','line','text'].includes(prior.type))continue
   if(prior.type==='shape'&&(!prior.fill||prior.fill.opacity===0))continue
   if(!overlaps(transformedBounds(prior.frame,prior.transform),box))continue
   if(prior.type==='shape'&&bg&&prior.fill.color.toUpperCase()===bg.toUpperCase())continue
   if(prior.type==='shape'&&prior.preset==='rect'&&axisAligned(prior)&&contains(transformedBounds(prior.frame,prior.transform),box)){
    const opacity=prior.fill.opacity??1
    bg=opacity===1?prior.fill.color:bg?blend(prior.fill.color,bg,opacity):undefined
   }else bg=undefined
  }
  return bg
 }
 for(const [index,e]of elements.entries()){
  if(hidden(e)||e.role==='decor'||!['text','table'].includes(e.type))continue
  const base=backdrop(e,index),samples=e.type==='text'?[e]:e.table.cells
  let bad,unverified=false
  for(const sample of samples){
   const bg=typeof sample.fill==='string'?sample.fill:base
   for(const p of sample.paragraphs??[])for(const run of p.runs){
    if(run.break||!run.text?.trim())continue
    const style=mergeSceneTextStyles({color:textColor},sample.textStyle,run.style)
    if(!bg||style.colorSpec?.transforms?.length){unverified=true;continue}
    const foreground=style.colorSpec?.base??style.color,ratio=colorContrast(foreground,bg)
    if(ratio<4.5&&(!bad||ratio<bad.ratio))bad={ratio,foreground,background:bg}
   }
  }
  if(bad)issues.push({code:'low-contrast',elementId:e.id,...bad})
  if(unverified)issues.push({code:'contrast-unverified',elementId:e.id})
 }
 return issues
}
