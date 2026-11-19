import {posix} from 'node:path'
import {normalizeSceneChart} from './deck-structured.mjs'
function failure(message){throw new Error('dsh-ppt: '+message)}
export function readNativeChart(lib,shape,{pres,onDiagnostic}={}){
 const spec=lib.getShapeChartSpec(shape)
 if(!spec)failure('Chart type cannot be represented natively')
 if(spec.series.some(s=>s.values.length!==spec.categories.length)&&pres){
  const n=spec.series[0].values.length
  if(spec.series.some(s=>s.values.length!==n))failure('Chart series caches have different lengths')
  const part=lib.getSlidePartName(lib.getShapeSlide(shape)),relId=/<c:chart\b[^>]*r:id="([^"]+)"/.exec(lib.getShapeXmlString(shape))?.[1]
  const rels=Buffer.from(lib.readPackagePart(pres,posix.join(posix.dirname(part),'_rels',posix.basename(part)+'.rels'))??[]).toString('utf8')
  let xml=''
  for(const rel of rels.match(/<Relationship\s[^>]*\/?>/g)??[]){
   if(!relId||!rel.includes('Id="'+relId+'"')||!rel.includes('/chart"')||/TargetMode="External"/.test(rel))continue
   const target=/Target="([^"]+)"/.exec(rel)?.[1],resolved=target?.startsWith('/')?target:target&&posix.normalize(posix.join(posix.dirname(part),target))
   if(resolved&&/^\/ppt\/charts\/[^/]+\.xml$/.test(resolved))xml=Buffer.from(lib.readPackagePart(pres,resolved)??[]).toString('utf8')
  }
  const cache=/<c:multiLvlStrCache\b[^>]*>([\s\S]*?)<\/c:multiLvlStrCache>/.exec(xml)?.[1],leaf=cache&&/<c:lvl\b[^>]*>([\s\S]*?)<\/c:lvl>/.exec(cache)?.[1],points=new Map()
  for(const m of leaf?.matchAll(/<c:pt\b[^>]*idx="(\d+)"[^>]*>[\s\S]*?<c:v>([\s\S]*?)<\/c:v>[\s\S]*?<\/c:pt>/g)??[])points.set(Number(m[1]),m[2].replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,v)=>v[0]==='#'?String.fromCodePoint(v[1].toLowerCase()==='x'?parseInt(v.slice(2),16):Number(v.slice(1))):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[v]))
  if(points.size!==n||Array.from({length:n},(_,i)=>!points.has(i)).some(Boolean))failure('Chart categories and values caches disagree; no complete leaf category cache')
  spec.categories=Array.from({length:n},(_,i)=>points.get(i))
  onDiagnostic?.('Multi-level category axis flattened to leaf labels; numeric values are preserved')
 }
 return normalizeSceneChart(spec)
}
export function readNativeTable(lib,pres,shape){
 const columns=lib.getTableColumnWidths(shape).map(Number),rows=lib.getTableRowHeights(shape).map(Number),cells=[]
 for(let r=0;r<rows.length;r++)for(let c=0;c<columns.length;c++){
  const cell=lib.getTableCell(shape,r,c),span=lib.getTableCellSpan(cell)
  if(span.hMerge||span.vMerge)continue
  const paragraphs=lib.getTableCellParagraphs(cell).map(p=>({style:{align:p.align??'left'},runs:p.elements.length?p.elements.map(e=>{
   if(e.kind==='br')return {break:true}
   if(e.kind!=='r')failure('Dynamic table fields are not supported')
   const f=e.format??{},style={fontFamily:f.font??'Liberation Sans',size:f.size??18,color:f.color??'#000000',bold:f.bold??false,italic:f.italic??false}
   if(!/^#[\da-f]{6}$/i.test(style.color))failure('Unresolved table theme color')
   return {text:e.text,style}
  }):[{text:''}]}))
  const out={row:r,col:c,colSpan:span.gridSpan,rowSpan:span.rowSpan,paragraphs:paragraphs.length?paragraphs:[{runs:[{text:''}]}]}
  const fill=lib.getTableCellFill(cell);if(fill){if(!/^#[\da-f]{6}$/i.test(fill))failure('Unresolved table fill');out.fill=fill}
  const margins=lib.getTableCellMargins(cell);out.textFrame={anchor:lib.getTableCellAnchor(cell)??'center',...(margins?{margins:Object.fromEntries(Object.entries(margins).filter(([,v])=>v!=null))}:{})}
  const borders=lib.getTableCellBorders(pres,cell),sides={}
  for(const [side,b]of Object.entries(borders))if(b?.color){if(!/^#[\da-f]{6}$/i.test(b.color)||b.dash&&b.dash!=='solid')failure('Unsupported table border');sides[side]={color:b.color,width:(b.widthEmu??12700)/12700}}
  if(Object.keys(sides).length)out.borders=sides
  cells.push(out)
 }
 return {columns,rows,cells}
}
