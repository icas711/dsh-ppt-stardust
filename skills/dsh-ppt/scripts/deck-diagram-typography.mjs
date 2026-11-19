// Explicit template typography only. No automatic font scaling or invented facts.
export function typographicDiagram(d,items,{region,text,textStyle={},textStyles,accent}){
 const enabled=d.kind==='kpi'?textStyles?.title:d.kind==='comparison'?textStyles?.subtitle:undefined
 if(!enabled)return undefined
 const {x,y,w,h}=region,out=[]
 const label=(id,value,frame,role,align='left')=>{
  const e=text(id,value,frame.x,frame.y,frame.w,frame.h)
  e.textStyle={...e.textStyle,...textStyle,...textStyles[role]}
  e.textFrame={...e.textFrame,align}
  return e
 }
 const rule=(id,x,y,w,h=0)=>({id,type:'line',frame:{x:Math.round(x),y:Math.round(y),w:Math.round(w),h:Math.round(h)},stroke:{color:accent,width:1}})
 if(d.kind==='kpi'){
  const columns=Math.min(3,items.length),rows=Math.ceil(items.length/columns),cw=w/columns,ch=h/rows
  items.forEach((item,i)=>{
   const left=x+(i%columns)*cw+cw*.06,top=y+Math.floor(i/columns)*ch+ch*.06,width=cw*.86
   if(i%columns)out.push(rule(item.id+'-divider',left-cw*.04,top,0,ch*.78))
   out.push(label(item.id+'-value',item.value+' '+item.unit,{x:left,y:top,w:width,h:ch*.32},'title'))
   out.push(label(item.id,item.label,{x:left,y:top+ch*.34,w:width,h:ch*.32},'body'))
   const extra=[item.delta!==undefined?item.delta+' '+item.deltaUnit:undefined,item.detail,item.source,item.date].filter(v=>v!==undefined&&v!=='')
   if(extra.length)out.push(label(item.id+'-detail',extra.join('\n'),{x:left,y:top+ch*.7,w:width,h:ch*.24},'caption'))
  })
 }else{
  const hasExtra=items.some(item=>[item.detail,item.source,item.date].some(v=>v!==undefined&&v!==''))
  const criteriaWidth=w*.24,cw=(w-criteriaWidth)/items.length,header=h*.34,rowHeight=(h-header)/(d.criteria.length+(hasExtra?1:0))
  items.forEach((item,i)=>{
   const left=x+criteriaWidth+i*cw
   out.push(label(item.id,item.label,{x:left+cw*.04,y,w:cw*.92,h:header},'subtitle'))
   const extra=[item.detail,item.source,item.date].filter(v=>v!==undefined&&v!=='')
   if(extra.length)out.push(label(item.id+'-detail',extra.join('\n'),{x:left+cw*.04,y:y+header+d.criteria.length*rowHeight,w:cw*.92,h:rowHeight},'caption'))
  })
  d.criteria.forEach((criterion,r)=>{
   const top=y+header+r*rowHeight
   out.push(rule('criterion-'+r+'-rule',x,top,w))
   out.push(label('criterion-'+r,criterion,{x,y:top,w:criteriaWidth*.94,h:rowHeight},'caption'))
   items.forEach((item,i)=>out.push(label(item.id+'-criterion-'+r,item.values[r]??'—',{x:x+criteriaWidth+i*cw+cw*.04,y:top,w:cw*.92,h:rowHeight},'body')))
  })
 }
 return out
}
