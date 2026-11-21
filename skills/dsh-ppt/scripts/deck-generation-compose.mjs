// Experimental deterministic components. Font fit is an estimate, never visual approval.
import {generationSpecToContent} from './deck-generation-spec.mjs'
import {buildGenerationTemplateProfile} from './deck-generation-profile.mjs'
import {validateTemplateManifest,templateCreateOptions} from './deck-templates.mjs'
import {resolveSceneReference} from './deck-template-scene.mjs'
import {normalizeSceneSlide,mergeSceneTextStyles} from './deck-model.mjs'
import {transformedBounds,IDENTITY_TRANSFORM} from './deck-geometry.mjs'
import {sceneImageBytes} from './deck-scene-pptx.mjs'
import {semanticChartDesign} from './deck-chart-design.mjs'
import {resolveTheme} from './deck-theme.mjs'
import {createHash} from 'node:crypto'

const EMU=914400,PT=12700,GAP=Math.round(.14*EMU),PAD=Math.round(.17*EMU)
const clone=v=>JSON.parse(JSON.stringify(v))
export const GENERATION_COMPONENT_VERSION=13
export const GENERATION_ICON_IDS=Object.freeze(['check','clock','target','trend'])
function fail(code,message,extra={}){const e=new Error('dsh-ppt: '+message);e.code=code;Object.assign(e,extra);throw e}
const frame=(x,y,w,h)=>Object.fromEntries(Object.entries({x,y,w,h}).map(([k,v])=>[k,Math.round(v)]))
const inside=(a,b)=>a.x>=b.x&&a.y>=b.y&&a.x+a.w<=b.x+b.w&&a.y+a.h<=b.y+b.h
const intersects=(a,b)=>a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h
const area=r=>r.w*r.h
const boxBounds=e=>transformedBounds(e.frame,e.transform)
function styled(base,patch){const next=mergeSceneTextStyles(base,patch);if(patch?.color!==undefined)delete next.colorSpec;return next}
function mix(a,b,t){return '#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('').toUpperCase()}
function ink(bg){const channels=[1,3,5].map(i=>parseInt(bg.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722>.179?'#000000':'#FFFFFF'}

// Conservative approximation using glyph classes; no font discovery or auto-shrink.
function glyphWidth(c,size){return size*(/\s/u.test(c)?.30:/[\u3000-\u9fff\uac00-\ud7af]/u.test(c)?1:/[MW@%]/u.test(c)?.88:/[ilI.,:;!'|]/u.test(c)?.30:/[A-ZА-ЯЁ]/u.test(c)?.68:.57)*PT}
export function estimateGenerationTextHeight(text,width,style){
  return estimateTextHeight(text,width,style,glyphWidth)
}
function estimateTextHeight(text,width,style,widthOf){
  const available=width-4*PT,size=style.size??18
  if(available<=0)return Infinity
  let lines=0
  for(const paragraph of String(text).split('\n')){
    let used=0;lines++
    for(const word of paragraph.split(/([^\S\u00a0\u202f]+)/u)){
      const wordWidth=[...word].reduce((sum,c)=>sum+widthOf(c,size),0)
      if(wordWidth<=available){if(used&&used+wordWidth>available){lines++;used=0}used+=wordWidth}
      else for(const c of word){const w=widthOf(c,size);if(w>available)return Infinity;if(used&&used+w>available){lines++;used=0}used+=w}
    }
  }
  return Math.ceil(lines*size*PT*1.35+4*PT)
}
function text(id,value,box,style,align='left'){
  if(estimateGenerationTextHeight(value,box.w,style)>box.h)fail('component-capacity','Text does not fit at the template font size',{elementId:id})
  return {id,type:'text',frame:frame(box.x,box.y,box.w,box.h),textStyle:clone(style),textFrame:{anchor:'top',align,wrap:'square',autoFit:'none',margins:{left:2*PT,right:2*PT,top:2*PT,bottom:2*PT}},paragraphs:String(value).split('\n').map(s=>({style:{marL:0,marR:0,indent:0},runs:[{text:s}]}))}
}
const shape=(id,box,fill,preset='roundRect',stroke)=>({id,type:'shape',frame:frame(box.x,box.y,box.w,box.h),preset,...(fill?{fill:{color:fill}}:{}),...(stroke?{stroke:{color:stroke,width:1}}:{})})
const line=(id,x1,y1,x2,y2,color,arrow=false)=>{
  const b=frame(Math.min(x1,x2),Math.min(y1,y2),Math.abs(x2-x1),Math.abs(y2-y1))
  return {id,type:'line',frame:b,...(x2<x1||y2<y1?{transform:[x2<x1?-1:1,0,0,y2<y1?-1:1,x2<x1?2*b.x+b.w:0,y2<y1?2*b.y+b.h:0]}:{}),stroke:{color,width:1.5,...(arrow?{tail:'triangle'}:{})}}
}
function icon(id,type,b,color){
  const p=(x,y)=>[b.x+x*b.w,b.y+y*b.h],edge=(n,a,c)=>line(id+'-'+n,...p(...a),...p(...c),color)
  if(type==='check')return [edge(0,[.1,.55],[.4,.85]),edge(1,[.4,.85],[.9,.15])]
  if(type==='trend')return [edge(0,[.05,.85],[.35,.5]),edge(1,[.35,.5],[.6,.65]),{...edge(2,[.6,.65],[.95,.1]),stroke:{color,width:1.5,tail:'triangle'}}]
  const out=[shape(id+'-ring',b,undefined,'ellipse',color)]
  if(type==='target')out.push(shape(id+'-center',frame(b.x+b.w*.3,b.y+b.h*.3,b.w*.4,b.h*.4),color,'ellipse'))
  else out.push(edge(0,[.5,.5],[.5,.2]),edge(1,[.5,.5],[.75,.6]))
  return out
}

// Subtract rectangular obstacles, retaining several alternatives instead of a fixed slot.
function freeRegions(page,obstacles){
  let regions=[page]
  for(const obstacle of obstacles){
    const b=frame(obstacle.x-GAP/2,obstacle.y-GAP/2,obstacle.w+GAP,obstacle.h+GAP),next=[]
    for(const r of regions){
      if(!intersects(r,b)){next.push(r);continue}
      const x1=Math.max(r.x,b.x),x2=Math.min(r.x+r.w,b.x+b.w),y1=Math.max(r.y,b.y),y2=Math.min(r.y+r.h,b.y+b.h)
      next.push(frame(r.x,r.y,x1-r.x,r.h),frame(x2,r.y,r.x+r.w-x2,r.h),frame(r.x,r.y,r.w,y1-r.y),frame(r.x,y2,r.w,r.y+r.h-y2))
    }
    regions=next.filter(r=>r.w>PT&&r.h>PT).sort((a,b)=>area(b)-area(a)).filter((r,i,all)=>!all.slice(0,i).some(other=>inside(r,other))).slice(0,64)
  }
  return regions
}
function setup(slide,layout,profile,manifest,demo,lang){
  const size=profile.pageSize,whole=frame(0,0,size.width,size.height),margin=Math.round(Math.min(size.width,size.height)*.035)
  const bounds=frame(margin,margin,size.width-2*margin,size.height-2*margin)
  const theme=resolveTheme(manifest.style.theme),reference=profile.layouts.find(l=>l.id===layout.id)
  const background=layout.backgroundColor??manifest.style.brand?.backgroundColor??theme.palette.bg
  const styles={title:styled({fontFamily:manifest.style.brand?.fontFamily??'Liberation Sans',size:32,color:manifest.style.brand?.textColor??theme.palette.fg},reference.typography.title),body:styled({fontFamily:manifest.style.brand?.fontFamily??'Liberation Sans',size:18,color:manifest.style.brand?.textColor??theme.palette.fg},reference.typography.body)}
  const accent=manifest.style.brand?.primaryColor??theme.palette.accent
  const slots=new Set(layout.slots.map(s=>s.elementId)),fixed=layout.elements.filter(e=>e.role==='decor'&&!slots.has(e.id)&&!e.hidden)
  const refs=layout.elements.filter(e=>e.role!=='decor'&&e.type==='text'&&!e.hidden),heading=[...refs].sort((a,b)=>a.frame.y-b.frame.y)[0]
  const blockers=fixed.filter(e=>{
    if(e.type==='group')return false
    // Filled rectangles behind existing text are template plates, not exclusion zones.
    if(e.type==='shape'&&['rect','roundRect'].includes(e.preset)&&e.fill&&(e.fill.opacity??1)>0){
      const box=boxBounds(e)
      if(area(box)>=area(whole)*.9||refs.some(t=>inside(boxBounds(t),box)))return false
    }
    return true
  }).map(boxBounds)
  const footerStyle=styled(styles.body,{size:14,...(layout.backgroundAssetId?{color:ink(background)}:{})}),footerLabel=demo?(lang==='ru'?'Демонстрация · синтетические данные':lang==='zh'?'演示 · 合成数据':'Demo · synthetic data'):null
  let footer
  if(footerLabel){
    // Imported fonts may be substituted by the PDF backend. Reserve an em for
    // non-Latin glyphs plus headroom, rather than tightly fitting the caption.
    const disclosureWidth=(c,size)=>Math.max(glyphWidth(c,size),/[^\x00-\xff]/u.test(c)?size*PT:0)*1.1
    const disclosureHeight=w=>estimateTextHeight(footerLabel,w,footerStyle,disclosureWidth)
    const h=disclosureHeight(bounds.w)
    footer=frame(bounds.x,bounds.y+bounds.h-h,bounds.w,h)
    // A page number at the right must not exclude the entire footer strip.
    // Search the remaining free rectangles, preferring a compact bottom label.
    if(layout.backgroundAssetId||blockers.some(b=>intersects(footer,b))){
      const naturalWidth=Math.ceil([...footerLabel].reduce((w,c)=>w+disclosureWidth(c,footerStyle.size),0)+5*PT)
      const candidates=freeRegions(bounds,blockers).map(r=>{
        const w=Math.min(r.w,naturalWidth),height=disclosureHeight(w)
        const box=frame(r.x,r.y+r.h-height,w,height)
        return inside(box,r)&&!blockers.some(b=>intersects(box,b))?box:null
      }).filter(Boolean).sort((a,b)=>b.y+b.h-(a.y+a.h)||a.h-b.h||a.x-b.x)
      if(!candidates.length)fail('component-capacity','No clear region for visible demo disclosure')
      footer=candidates[0]
    }
    blockers.push(footer)
  }
  const free=freeRegions(bounds,blockers),original=heading?.frame,transform=heading?.transform??IDENTITY_TRANSFORM
  const transformed=transform.some((v,i)=>v!==IDENTITY_TRANSFORM[i]),align=reference.compositionGuides.text.find(e=>e.id===heading?.id)?.alignment??'left'
  let title
  if(transformed){
    const b=boxBounds(heading)
    if(!inside(b,whole)||blockers.some(o=>intersects(b,o)))fail('component-capacity','Transformed title reference collides with fixed artwork')
    title={...text('gen-title',slide.title,original,styles.title,align),transform:clone(transform)}
  }else{
    const candidates=free.map(r=>{
      const right=original?original.x+original.w:r.x+r.w,center=original?original.x+original.w/2:r.x+r.w/2
      const x=align==='right'?r.x:align==='center'?r.x:Math.max(r.x,Math.min(original?.x??r.x,r.x+r.w-EMU))
      const width=align==='right'?Math.min(r.w,right-r.x):align==='center'?Math.min(r.w,2*Math.min(center-r.x,r.x+r.w-center)):r.x+r.w-x
      if(width<=0)return null
      const h=estimateGenerationTextHeight(slide.title,width,styles.title),y=Math.max(r.y,Math.min(original?.y??r.y,r.y+r.h-h))
      const box=frame(align==='right'?right-width:align==='center'?center-width/2:x,y,width,h)
      return inside(box,r)&&h<=size.height*.35?{box,distance:Math.abs(box.y-(original?.y??bounds.y))}:null
    }).filter(Boolean).sort((a,b)=>a.distance-b.distance||b.box.w-a.box.w)
    if(!candidates.length)fail('component-capacity','No region fits the title at the template font size')
    title=text('gen-title',slide.title,candidates[0].box,styles.title,align)
  }
  const regions=freeRegions(bounds,[...blockers,boxBounds(title)]).filter(r=>r.w>=EMU*1.4&&r.h>=EMU*.8).sort((a,b)=>area(b)-area(a))
  if(!regions.length)fail('component-capacity','Fixed artwork and title leave no content region')
  return {styles,accent,background,surface:mix(background,accent,.08),regions:regions.slice(0,12),title,footer:footer?text('gen-disclosure',footerLabel,footer,footerStyle):null,
    footerBackdrop:footer&&layout.backgroundAssetId?shape('gen-disclosure-bg',footer,background,'rect'):null}
}

function stack(out,id,parts,b,gap=GAP){
  let y=b.y
  for(const [i,part]of parts.filter(p=>p.value!==undefined).entries()){
    const h=estimateGenerationTextHeight(part.value,b.w,part.style)
    if(y+h>b.y+b.h)fail('component-capacity','Component text exceeds available height')
    out.push(text(id+'-'+i,part.value,frame(b.x,y,b.w,h),part.style,part.align));y+=h+gap
  }
}
function cards(v,b,s,columns){
  const out=[]
  const measure=(value,width,style)=>estimateTextHeight(value,width,style,(c,size)=>glyphWidth(c,size)*1.15)
  if(v.caption){
    const h=measure(v.caption,b.w,s.styles.body)
    out.push(text('gen-caption',v.caption,frame(b.x,b.y,b.w,h),s.styles.body))
    b=frame(b.x,b.y+h+2*GAP,b.w,b.h-h-2*GAP)
  }
  const rows=Math.ceil(v.items.length/columns),w=(b.w-GAP*(columns-1))/columns
  const labelStyle=styled(s.styles.body,{bold:true,color:s.accent}),side=Math.round(.32*EMU),padding=Math.max(PAD,Math.round(side*.7))
  const hasDetails=v.items.some(item=>item.detail!==undefined),hasIcons=v.items.some(item=>item.iconId)
  const labelHeight=Math.max(...v.items.map(item=>measure(item.label,w-2*padding,labelStyle)))
  const heights=v.items.map(item=>labelHeight+(item.detail!==undefined?GAP+measure(item.detail,w-2*padding,s.styles.body):0)+(hasIcons?side+GAP:0))
  // Keep equal cards sized to their content; whitespace belongs around the group.
  const h=Math.max(2*padding+Math.max(...heights),Math.min(2.5*EMU,w*.85))
  const groupHeight=rows*h+(rows-1)*GAP
  if(groupHeight>b.h)fail('component-capacity','Cards require more vertical space')
  const top=b.y+(b.h-groupHeight)/2
  v.items.forEach((item,i)=>{
    const row=Math.floor(i/columns),rowItems=Math.min(columns,v.items.length-row*columns)
    const rowOffset=(columns-rowItems)*(w+GAP)/2
    const box=frame(b.x+rowOffset+(i%columns)*(w+GAP),top+row*(h+GAP),w,h)
    if(box.w<=2*padding||box.h<=2*padding)fail('component-capacity','Card has no content area')
    out.push(shape('gen-card-'+i,box,s.surface,'roundRect',s.accent))
    let y=hasDetails?box.y+padding:box.y+(box.h-heights[i])/2
    const align=item.detail!==undefined?'left':'center'
    if(hasIcons){if(item.iconId)out.push(...icon('gen-icon-'+i,item.iconId,frame(align==='center'?box.x+(box.w-side)/2:box.x+padding,y,side,side),s.accent));y+=side+GAP}
    out.push(text('gen-item-'+i+'-0',item.label,frame(box.x+padding,y,box.w-2*padding,labelHeight),labelStyle,align));y+=labelHeight+GAP
    if(item.detail!==undefined)out.push(text('gen-item-'+i+'-1',item.detail,frame(box.x+padding,y,box.w-2*padding,measure(item.detail,box.w-2*padding,s.styles.body)),s.styles.body,align))
  })
  return out
}
function connected(v,b,s,vertical,offset){
  const out=[],n=v.items.length,gutter=.37*EMU
  if(vertical){
    const h=(b.h-GAP*(n-1))/n
    if(n>1)out.push(line('gen-spine',b.x+gutter/2,b.y+gutter/2,b.x+gutter/2,b.y+(n-1)*(h+GAP)+gutter/2,s.accent,v.type==='process'))
    v.items.forEach((item,i)=>{
      const top=b.y+i*(h+GAP),node=frame(b.x,top,gutter,gutter)
      out.push(shape('gen-node-'+i,node,s.accent,'ellipse'))
      const right=frame(b.x+gutter+GAP,top,b.w-gutter-GAP,h)
      stack(out,'gen-item-'+i,[{value:v.type==='timeline'?item.date:String(offset+i+1),style:styled(s.styles.body,{bold:true,color:s.accent})},{value:item.label,style:styled(s.styles.body,{bold:true})},{value:item.detail,style:s.styles.body}],right,GAP/2)
    })
  }else{
    const w=(b.w-GAP*(n-1))/n
    v.items.forEach((item,i)=>{
      const x=b.x+i*(w+GAP),center=x+w/2,node=frame(center-gutter/2,b.y,gutter,gutter)
      if(i<n-1)out.push(line('gen-link-'+i,center+gutter/2,b.y+gutter/2,center+w+GAP-gutter/2,b.y+gutter/2,s.accent,v.type==='process'))
      out.push(shape('gen-node-'+i,node,s.accent,'ellipse'))
      stack(out,'gen-item-'+i,[{value:v.type==='timeline'?item.date:String(offset+i+1),style:styled(s.styles.body,{bold:true,color:s.accent})},{value:item.label,style:styled(s.styles.body,{bold:true})},{value:item.detail,style:s.styles.body}].map(part=>({...part,align:'center'})),frame(x,b.y+gutter+GAP,w,b.h-gutter-GAP))
    })
  }
  return out
}
function numbers(v,b,s,columns){
  const out=[],rows=Math.ceil(v.items.length/columns),w=(b.w-GAP*(columns-1))/columns,h=(b.h-GAP*(rows-1))/rows
  v.items.forEach((item,i)=>{
    const box=frame(b.x+(i%columns)*(w+GAP),b.y+Math.floor(i/columns)*(h+GAP),w,h)
    stack(out,'gen-number-'+i,[{value:String(item.value),style:styled(s.styles.title,{size:Math.max(60,s.styles.title.size),bold:true,color:s.accent})},{value:item.unit,style:styled(s.styles.body,{bold:true})},{value:item.label,style:s.styles.body},{value:item.detail,style:s.styles.body}],box)
  })
  return out
}
function tableData(v,lang){
  if(v.type==='table')return {headers:v.headers,rows:v.rows}
  const detail=v.items.some(i=>i.detail!==undefined)
  return {headers:[lang==='ru'?'Критерий':lang==='zh'?'标准':'Criterion',...v.items.map(i=>i.label)],rows:[...v.criteria.map((c,i)=>[c,...v.items.map(item=>item.values[i])]),...(detail?[[lang==='ru'?'Пояснение':lang==='zh'?'说明':'Detail',...v.items.map(i=>i.detail??null)]]:[])]}
}
function tableWeights(headers,rows){
  const weights=headers.map((_,col)=>Math.sqrt(Math.max(...rows.map(row=>[...String(row[col]??'')].length))))
  return weights.some(w=>w>0)?weights:weights.map(()=>1)
}
function tableColumnProfile(headers,rows,size){
  const padding=2*PAD+4*PT
  const width=value=>[...value].reduce((w,c)=>w+glyphWidth(c,size),0)*1.15
  const headerMin=headers.map(label=>Math.max(.5*EMU,Math.min(1.5*EMU,width(label)+padding)))
  const wordMin=headers.map((header,col)=>[header,...rows.map(r=>r[col]??'—')].reduce((max,value)=>String(value).split(/[^\S\u00a0\u202f]+/u).reduce((max,word)=>Math.max(max,width(word)+padding),max),headerMin[col]))
  return {weights:tableWeights(headers,rows),headerMin,wordMin}
}
function tableMetrics(v,b,s,lang){
  const {headers,rows}=tableData(v,lang),matrix=[headers,...rows]
  const {weights,headerMin,wordMin}=v.columnProfile??tableColumnProfile(headers,rows,s.styles.body.size)
  // Reserve readable headings, then give long data more room. An empty index
  // column must not consume the same minimum share as a paragraph column.
  // Protect complete words when the page can accommodate all column minima.
  // Explicit zero indents below prevent theme list defaults stealing this room.
  const protectWords=wordMin.reduce((a,b)=>a+b,0)<=b.w,minima=protectWords?wordMin:headerMin
  const minimumSum=minima.reduce((a,b)=>a+b,0),scale=protectWords?1:Math.min(1,b.w*.6/minimumSum),available=b.w-minimumSum*scale
  const sum=weights.reduce((a,b)=>a+b,0),columns=weights.map((w,col)=>Math.floor(minima[col]*scale+available*w/sum))
  columns[columns.length-1]+=b.w-columns.reduce((a,b)=>a+b,0)
  const styles=matrix.map((_,i)=>i===0?styled(s.styles.body,{bold:true,color:ink(s.accent)}):s.styles.body)
  const heights=matrix.map((row,i)=>Math.ceil(Math.max(...row.map((value,col)=>estimateGenerationTextHeight(value??'—',columns[col]-2*PAD,styles[i])))+2*PAD))
  return {matrix,columns,styles,heights}
}
function nativeTable(v,b,s,lang){
  const {matrix,columns,styles,heights}=tableMetrics(v,b,s,lang)
  const height=heights.reduce((a,b)=>a+b,0)
  if(height>b.h)fail('component-capacity','Table requires more vertical space')
  const cells=matrix.flatMap((row,r)=>row.map((value,col)=>({row:r,col,paragraphs:[{style:{marL:0,marR:0,indent:0},runs:[{text:String(value??'—')}]}],textStyle:clone(styles[r]),textFrame:{anchor:'center',margins:{left:PAD,right:PAD,top:PAD,bottom:PAD}},fill:r===0?s.accent:r%2?s.surface:s.background})))
  return [{id:'gen-table',type:'table',frame:frame(b.x,b.y,b.w,height),table:{columns,rows:heights,cells}}]
}

// Split only a row that cannot fit whole, and only under the caller's explicit
// pagination policy. Offsets retain every source character, including whitespace.
function fittingPrefix(value,width,height,style){
  const chars=[...value]
  let low=0,high=chars.length
  while(low<high){
    const mid=Math.ceil((low+high)/2)
    if(estimateGenerationTextHeight(chars.slice(0,mid).join(''),width,style)<=height)low=mid
    else high=mid-1
  }
  if(!low)return ''
  const prefix=chars.slice(0,low).join('')
  if(low===chars.length)return prefix
  // Keep words together where possible, preserving the separator in this part.
  const breaks=[...prefix.matchAll(/[^\S\u00a0\u202f]+/gu)]
  const last=breaks.at(-1)
  return last?prefix.slice(0,last.index+last[0].length):prefix
}
function tableCellParts(value,width,height,style,{maxParts,signal}){
  const split=(input,cap,limit)=>{
    const parts=[]
    while(input.length){
      signal?.throwIfAborted()
      const piece=fittingPrefix(input,width,cap,style)
      if(!piece.length)return null
      parts.push(piece)
      if(parts.length>limit)return parts
      input=input.slice(piece.length)
    }
    return parts
  }
  const greedy=split(value,height,maxParts)
  if(!greedy||greedy.length<2||greedy.length>maxParts)return greedy
  // Minimize the tallest fragment at the same page count, instead of greedily
  // leaving a few words on a nearly empty final slide.
  let low=0,high=Math.floor(height)
  while(low<high){
    const mid=Math.floor((low+high)/2),trial=split(value,mid,greedy.length)
    if(trial&&trial.length<=greedy.length)high=mid
    else low=mid+1
  }
  const parts=split(value,high,greedy.length)
  const leading=style.size*PT*1.35
  // Move nearby boundaries to paragraph/sentence ends when both neighbouring
  // fragments still fit; every separator stays in the source text.
  const rebalance=i=>{
    const pair=parts[i]+parts[i+1],current=parts[i].length
    const boundaries=new Map([[current,0]])
    for(const m of pair.matchAll(/\n[ \t]*\n(?:[ \t]*\n)*|[.!?…][ \t]+/gu))boundaries.set(m.index+m[0].length,m[0].includes('\n')?1:.45)
    let best
    for(const [end,bonus]of boundaries){
      if(!end||end===pair.length)continue
      const a=estimateGenerationTextHeight(pair.slice(0,end),width,style),b=estimateGenerationTextHeight(pair.slice(end),width,style)
      if(a>height||b>height)continue
      const score=Math.max(a,b)+Math.abs(a-b)*.25-leading*bonus
      if(!best||score<best.score)best={end,score}
    }
    if(best){parts[i]=pair.slice(0,best.end);parts[i+1]=pair.slice(best.end)}
  }
  for(let i=0;i<parts.length-1;i++)rebalance(i)
  for(let i=parts.length-2;i>=0;i--)rebalance(i)
  return parts
}
function splitTableRow(v,rowIndex,s,lang,{maxParts,signal}){
  const row=v.rows[rowIndex]
  for(const region of [...s.regions].sort((a,b)=>b.w-a.w||area(b)-area(a))){
    const chunks=[],offsets=row.map(()=>0)
    const caption=part=>lang==='ru'?`Строка ${rowIndex+1} · часть ${part}`:lang==='zh'?`第 ${rowIndex+1} 行 · 第 ${part} 部分`:`Row ${rowIndex+1} · part ${part}`
    const captionHeight=estimateGenerationTextHeight(caption('120/120'),region.w,s.styles.body)
    const box=frame(region.x,region.y+captionHeight+GAP,region.w,region.h-captionHeight-GAP)
    if(box.h<=0)continue
    const metrics=tableMetrics({...v,rows:[row]},box,s,lang),cellHeight=box.h-metrics.heights[0]-2*PAD
    if(estimateGenerationTextHeight('',Math.min(...metrics.columns)-2*PAD,s.styles.body)>cellHeight)continue
    const columns=row.map((value,col)=>tableCellParts(value??'',metrics.columns[col]-2*PAD,cellHeight,s.styles.body,{maxParts,signal}))
    if(columns.some(parts=>parts===null))continue
    const parts=Math.max(...columns.map(parts=>parts.length))
    if(parts>maxParts)fail('component-slide-limit','Row continuation exceeds the allowed slide count',{itemIndex:rowIndex})
    for(let part=0;part<parts;part++){
      signal?.throwIfAborted()
      const pieces=columns.map(parts=>parts[part]??'')
      const cellRanges=pieces.map((piece,col)=>row[col]===null?null:{start:offsets[col],end:offsets[col]+piece.length})
      const fragment=pieces.map((piece,col)=>row[col]===null&&!chunks.length?null:piece)
      const elements=nativeTable({...v,rows:[fragment]},box,s,lang)
      chunks.push({elements,region,composition:'table-row-continuation',start:rowIndex,end:rowIndex+1,rowContinuation:{sourceRow:rowIndex+1,part:chunks.length+1,cellRanges}})
      pieces.forEach((piece,col)=>{offsets[col]+=piece.length})
    }
    if(!chunks.length)continue
    for(const chunk of chunks){
      chunk.rowContinuation.parts=chunks.length
      const captionBox=frame(region.x,region.y,region.w,captionHeight)
      chunk.elements.unshift(shape('gen-table-continuation-bg',captionBox,s.background,'rect'),text('gen-table-continuation',caption(`${chunk.rowContinuation.part}/${chunks.length}`),captionBox,s.styles.body))
    }
    return chunks
  }
  return null
}
function nativeChart(v,b,s){
  const size=s.styles.body.size,labels=v.categories,n=labels.length
  const labelSpace=v.kind==='bar'?Math.max(...labels.map(label=>[...label].reduce((a,c)=>a+glyphWidth(c,size),0))):0
  if(labelSpace>b.w*.42||n>(v.kind==='bar'?Math.floor(b.h/(size*PT*1.8)):v.kind==='pie'?10:Math.min(12,Math.floor(b.w/(size*PT*3)))))fail('component-capacity','Native chart labels need more space; pie/line charts cannot be paginated')
  if(v.kind!=='bar'&&labels.some(label=>estimateGenerationTextHeight(label,b.w/Math.max(1,n),s.styles.body)>b.h*.30))fail('component-capacity','Category labels are too long for this chart region')
  if(v.series.some(series=>estimateGenerationTextHeight(series.name,b.w,s.styles.body)>b.h*.15)||estimateGenerationTextHeight(v.unit,b.w,s.styles.body)>b.h*.15)fail('component-capacity','Chart legend or unit needs more space')
  const data=semanticChartDesign({kind:v.kind,title:v.unit,categories:clone(v.categories),series:clone(v.series)},{accent:s.accent,background:s.background,color:s.styles.body.color,fontFamily:s.styles.body.fontFamily,size,unit:v.unit,showPercent:v.showPercent===true})
  return [{id:'gen-chart',type:'chart',frame:clone(b),chart:data}]
}
function chart(v,b,s){
  // A small comparison benefits from a chart plus exact, readable values.
  // Keep complex, signed and narrow charts on the full-width native path.
  if(['bar','column'].includes(v.kind)&&v.series.length===1&&v.categories.length>=2&&v.categories.length<=3&&v.series[0].values.every(n=>n>=0)&&b.w>=8*EMU&&b.w/b.h>=1.5){
    try{
      const width=Math.min(3*EMU,b.w*.27),x=b.x+b.w-width,color=ink(s.accent)
      const labelStyle=styled(s.styles.body,{color}),valueStyle=styled(s.styles.title,{size:Math.max(36,s.styles.title.size),bold:true,color})
      const heights=v.categories.map((label,i)=>estimateGenerationTextHeight(label,width-2*PAD,labelStyle)+GAP+estimateGenerationTextHeight(String(v.series[0].values[i]),width-2*PAD,valueStyle))
      const height=Math.max(1.2*EMU,Math.max(...heights)+2*PAD),total=height*v.categories.length+GAP*(v.categories.length-1)
      if(total>b.h)fail('component-capacity','Value cards need more vertical space')
      const out=nativeChart(v,frame(b.x,b.y,b.w-width-2*GAP,b.h),s)
      v.categories.forEach((label,i)=>{
        const box=frame(x,b.y+(b.h-total)/2+i*(height+GAP),width,height)
        out.push(shape('gen-chart-card-'+i,box,s.accent))
        stack(out,'gen-chart-value-'+i,[{value:label,style:labelStyle,align:'center'},{value:String(v.series[0].values[i]),style:valueStyle,align:'center'}],frame(box.x+PAD,box.y+(box.h-heights[i])/2,box.w-2*PAD,heights[i]))
      })
      return out
    }catch(e){if(e.code!=='component-capacity')throw e}
  }
  return nativeChart(v,b,s)
}
function image(v,b,s){
  const captionHeight=v.caption?estimateGenerationTextHeight(v.caption,b.w,s.styles.body)+GAP:0
  if(b.h-captionHeight<EMU*.6)fail('component-capacity','Image caption leaves no space for the picture')
  return [{id:'gen-image',type:'image',frame:frame(b.x,b.y,b.w,b.h-captionHeight),assetId:v.assetId,alt:v.alt,fit:'contain'},...(v.caption?[text('gen-caption',v.caption,frame(b.x,b.y+b.h-captionHeight+GAP,b.w,captionHeight-GAP),s.styles.body)]:[])]
}
function render(v,s,lang,offset=0){
  for(const b of s.regions){
    const alternatives=v.type==='cards'?[...new Set([Math.min(v.items.length,3),2,1])]:['process','timeline'].includes(v.type)?[...new Set([b.h>b.w,false,true])]:v.type==='big_number'?[...new Set([v.items.length,1])]:[null]
    for(const variant of alternatives){
      try{
        const elements=v.type==='cards'?cards(v,b,s,variant):v.type==='process'||v.type==='timeline'?connected(v,b,s,variant===true,offset):v.type==='big_number'?numbers(v,b,s,variant):v.type==='comparison'||v.type==='table'?nativeTable(v,b,s,lang):v.type==='chart'?chart(v,b,s):image(v,b,s)
        if(elements.some(e=>!inside(boxBounds(e),b)))fail('component-capacity','Rounded component geometry exceeds its region')
        return {elements,region:b,composition:String(variant??v.type)}
      }catch(e){if(e.code!=='component-capacity')throw e}
    }
  }
  fail('component-capacity','No composition fits at the template font sizes')
}
function count(v){return v.type==='table'?v.rows.length:v.type==='comparison'?v.criteria.length:v.type==='chart'&&['column','bar'].includes(v.kind)?v.categories.length:v.items?.length??1}
function slice(v,start,end){
  const copy=clone(v)
  if(v.type==='table')copy.rows=copy.rows.slice(start,end)
  else if(v.type==='comparison'){copy.criteria=copy.criteria.slice(start,end);copy.items=copy.items.map(i=>({...i,values:i.values.slice(start,end)}))}
  else if(v.type==='chart'){copy.categories=copy.categories.slice(start,end);copy.series=copy.series.map(s=>({...s,values:s.values.slice(start,end)}))}
  else copy.items=copy.items.slice(start,end)
  return copy
}

// The export engine requires content-addressed image IDs; model-facing aliases
// remain in the spec, while every slide and retained template reference is remapped.
function canonicalAssets(create){
  const ids=new Map(),assets={}
  for(const [alias,asset]of Object.entries(create.assets??{})){
    const bytes=sceneImageBytes(asset,alias),id='img-'+createHash('sha256').update(bytes).digest('hex')
    ids.set(alias,id);assets[id]=clone(asset)
  }
  const remap=slide=>{
    if(slide.backgroundAssetId)slide.backgroundAssetId=ids.get(slide.backgroundAssetId)??slide.backgroundAssetId
    for(const element of slide.elements??[])for(const key of ['assetId','previewAssetId'])if(element[key])element[key]=ids.get(element[key])??element[key]
  }
  const out=clone(create);out.assets=assets
  out.slides.forEach(remap);(out.style?.sceneLayouts??[]).forEach(remap)
  return out
}
export {canonicalAssets as canonicalGenerationAssets}

/** No writes or LLM calls. Caller authorizes the template and attachment roles first. */
export function composeGenerationSpec(input,{template,context,assets={},allowMoreSlides=false,maxSlides=120,signal}={}){
  signal?.throwIfAborted()
  if(!Number.isSafeInteger(maxSlides)||maxSlides<1||maxSlides>120||typeof allowMoreSlides!=='boolean')fail('component-options','Expected a boolean pagination policy and maxSlides 1–120')
  const prepared=buildGenerationTemplateProfile(template?.manifest,{assets:template?.assets,importReport:template?.report})
  if(!prepared.valid)fail('component-template','Template preflight failed',{diagnostics:prepared.diagnostics})
  const manifest=validateTemplateManifest(template.manifest,{templateAssets:template.assets??{}}),profile=prepared.profile
  for(const [id,a]of Object.entries(assets)){
    sceneImageBytes(a,id)
    if(Object.hasOwn(manifest.assetMap??{},id))fail('component-asset-collision','Content asset conflicts with a template asset: '+id)
  }
  const content=generationSpecToContent(input,{...context,assetIds:Object.keys(assets),iconIds:[...GENERATION_ICON_IDS]})
  const slides=[],placements=[],diagnostics=[...prepared.diagnostics,{severity:'warning',code:'fit-estimated',path:'slides',message:'Text fit uses estimates; exported slides need visual inspection'}],splits=[]
  const reserved=new Set(content.slides.map(s=>s.id))
  for(const [index,source]of content.slides.entries()){
    signal?.throwIfAborted()
    const layout=resolveSceneReference(source,manifest.style.layouts,index)
    let s
    try{s=setup(source,layout,profile,manifest,input.mode==='demo',input.lang)}
    catch(e){if(e.code==='component-capacity'){e.slideId=source.id;e.path=`spec.slides[${index}]`}throw e}
    const chunks=[]
    try{chunks.push({...render(source.visual,s,input.lang),start:0,end:count(source.visual)})}
    catch(e){
      if(e.code!=='component-capacity')throw e
      const n=count(source.visual)
      if(!allowMoreSlides||(n<2&&source.visual.type!=='table')||(source.visual.type==='chart'&&!['column','bar'].includes(source.visual.kind)))fail('component-capacity','Slide cannot fit without changing content or typography',{slideId:source.id,path:`spec.slides[${index}].visual`})
      // Freeze the full table's column proportions across physical pages.
      const visual=source.visual.type==='table'?{...source.visual,columnProfile:tableColumnProfile(source.visual.headers,source.visual.rows,s.styles.body.size)}:source.visual
      let start=0
      while(start<n){
        signal?.throwIfAborted();let chosen
        // For tables prefer a broad readable region over squeezing one extra row
        // into a narrow strip; continuation pages should use the same broad area.
        const alternatives=source.visual.type==='table'?[...s.regions].sort((a,b)=>b.w-a.w||area(b)-area(a)).map(region=>({...s,regions:[region]})):[s]
        for(const composition of alternatives){
          for(let end=n;end>start;end--){
            try{chosen={...render(slice(visual,start,end),composition,input.lang,start),start,end};break}
            catch(err){if(err.code!=='component-capacity')throw err}
          }
          if(chosen)break
        }
        if(!chosen&&visual.type==='table'){
          const continued=splitTableRow(visual,start,s,input.lang,{maxParts:maxSlides-slides.length-chunks.length,signal})
          if(continued){
            chunks.push(...continued)
            diagnostics.push({severity:'info',code:'table-row-paginated',path:`spec.slides[${index}].visual.rows[${start}]`,slideId:source.id,message:`Source row ${start+1} retained across ${continued.length} slides; blank continuation cells contain no further text`})
            start++;continue
          }
        }
        if(!chosen)fail('component-capacity','One source item cannot fit; no facts were removed',{slideId:source.id,path:`spec.slides[${index}].visual`,itemIndex:start})
        chunks.push(chosen);start=chosen.end
        if(slides.length+chunks.length>maxSlides)fail('component-slide-limit','Pagination exceeds the allowed slide count',{slideId:source.id})
      }
    }
    if(slides.length+chunks.length>maxSlides)fail('component-slide-limit','Presentation exceeds the allowed slide count',{slideId:source.id})
    if(chunks.length>1){splits.push({slideId:source.id,parts:chunks.length});diagnostics.push({severity:'info',code:'content-paginated',path:`spec.slides[${index}]`,slideId:source.id,message:'Content retained across '+chunks.length+' slides'})}
    chunks.forEach((chunk,part)=>{
      let id=source.id
      if(part){let suffix=part+1;do{id=source.id.slice(0,90)+'-part-'+suffix++}while(reserved.has(id));reserved.add(id)}
      const sourceRefs=[...new Set([...source.visual.sourceRefs,...(source.visual.items??[]).flatMap(i=>i.sourceRefs??[])])]
      const notes=[source.notes,...sourceRefs.map(ref=>'Source: '+ref),...(chunks.length>1?[`Continuation ${part+1}/${chunks.length}; items ${chunk.start+1}–${chunk.end}/${count(source.visual)}`]:[]),...(chunk.rowContinuation?[`Source row ${chunk.rowContinuation.sourceRow}; fragment ${chunk.rowContinuation.part}/${chunk.rowContinuation.parts}. Empty continuation cells have no further text; unknown values are shown as an em dash in the first fragment.`]:[])].filter(Boolean).join('\n')
      const elements=[clone(s.title),...chunk.elements,...(s.footerBackdrop?[clone(s.footerBackdrop)]:[]),...(s.footer?[clone(s.footer)]:[])]
      slides.push(normalizeSceneSlide({id,layout:'scene',purpose:source.purpose,designLayout:layout.id,label:source.title,notes,elements},{assets}))
      placements.push({slideId:id,sourceSlideId:source.id,component:source.visual.type,composition:chunk.composition,region:clone(chunk.region),part:part+1,parts:chunks.length,...(source.visual.type==='table'?{rowStart:chunk.start+1,rowEnd:chunk.end}:{}),...(chunk.rowContinuation?{rowContinuation:clone(chunk.rowContinuation)}:{})})
    })
  }
  signal?.throwIfAborted()
  const built=templateCreateOptions(manifest,template.assets??{},{title:input.title,slides,assets,lang:input.lang})
  return {...built,create:{...canonicalAssets(built.create),lang:input.lang,templateLineage:built.lineage},diagnostics:[...diagnostics,...built.diagnostics],report:{version:GENERATION_COMPONENT_VERSION,sourceSlides:input.slides.length,slideCount:slides.length,splits,placements,fit:'estimated',visualAcceptance:'not-verified'}}
}
