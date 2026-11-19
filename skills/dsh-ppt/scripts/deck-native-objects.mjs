import {normalizeSceneChart} from './deck-structured.mjs'
function failure(message){throw new Error('dsh-ppt: '+message)}
export function readNativeChart(lib,shape){
 const spec=lib.getShapeChartSpec(shape)
 if(!spec)failure('Chart type cannot be represented natively')
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
  const margins=lib.getTableCellMargins(cell);out.textFrame={anchor:lib.getTableCellAnchor(cell)??'top',...(margins?{margins:Object.fromEntries(Object.entries(margins).filter(([,v])=>v!=null))}:{})}
  const borders=lib.getTableCellBorders(pres,cell),sides={}
  for(const [side,b]of Object.entries(borders))if(b?.color){if(!/^#[\da-f]{6}$/i.test(b.color)||b.dash&&b.dash!=='solid')failure('Unsupported table border');sides[side]={color:b.color,width:(b.widthEmu??12700)/12700}}
  if(Object.keys(sides).length)out.borders=sides
  cells.push(out)
 }
 return {columns,rows,cells}
}
