import { normalizeSceneSlide, mergeSceneTextStyles } from './deck-model.mjs'
import { IDENTITY_TRANSFORM, transformPoint } from './deck-geometry.mjs'
import { escapeXml as xml } from './deck-text.mjs'
import { imageInfo } from './deck-image.mjs'

const hex = value => value.replace('#','')
const color = (value, opacity) => `<a:solidFill><a:srgbClr val="${hex(value)}">${opacity !== undefined ? `<a:alpha val="${Math.round(opacity*100000)}"/>` : ''}</a:srgbClr></a:solidFill>`
function error(code, id, message) { const e = new Error(`dsh-ppt: ${code} at element ${id}: ${message}`); e.code = code; throw e }

export function scenePptxPlacement(element) {
  const [a,b,c,d] = element.transform ?? IDENTITY_TRANSFORM
  const sx = Math.hypot(a,b), sy = Math.hypot(c,d)
  if (!sx || !sy || Math.abs(a*c+b*d) > sx*sy*1e-9) error('scene-transform-unsupported', element.id, 'PPTX cannot represent shear without changing the object')
  const centre = transformPoint({x:element.frame.x+element.frame.w/2,y:element.frame.y+element.frame.h/2}, element.transform)
  const w = Math.round(element.frame.w*sx), h = Math.round(element.frame.h*sy)
  if (element.type !== 'line' && (!w || !h)) error('scene-render-size',element.id,'Object becomes smaller than one EMU')
  const rotation = (Math.round(Math.atan2(b,a)*180/Math.PI*60000)+21600000)%21600000
  return {x:Math.round(centre.x-w/2),y:Math.round(centre.y-h/2),w,h,rotation,flipV:a*d-b*c<0}
}
function xfrm(element) {
  const p = scenePptxPlacement(element)
  return `<a:xfrm${p.rotation ? ` rot="${p.rotation}"` : ''}${p.flipV ? ' flipV="1"' : ''}><a:off x="${p.x}" y="${p.y}"/><a:ext cx="${p.w}" cy="${p.h}"/></a:xfrm>`
}
function stroke(value) {
  if (!value) return '<a:ln><a:noFill/></a:ln>'
  return `<a:ln w="${Math.round(value.width*12700)}">${color(value.color,value.opacity)}<a:prstDash val="${({solid:'solid',dash:'dash',dot:'sysDot'})[value.dash ?? 'solid']}"/>${['head','tail'].map(key=>value[key] ? `<a:${key}End type="${value[key]}"/>` : '').join('')}</a:ln>`
}
function runProperties(style, frame, lang) {
  return `<a:rPr lang="${xml(lang)}" sz="${Math.round(style.size*100)}" b="${style.bold ? 1 : 0}" i="${style.italic ? 1 : 0}"${(style.kerning??frame.kerning) !== undefined ? ` kern="${style.kerning??frame.kerning}"` : ''}${style.underline !== undefined ? ` u="${style.underline===true?'sng':style.underline===false?'none':style.underline}"` : ''}>${color(style.color)}<a:latin typeface="${xml(style.sourceTypeface??style.fontFamily)}"/><a:ea typeface="${xml(style.scriptFonts?.eastAsian ?? style.fontFamily)}"/><a:cs typeface="${xml(style.scriptFonts?.complexScript ?? style.fontFamily)}"/></a:rPr>`
}
function paragraphProperties(style) {
  const attributes = ['marL','marR','indent'].filter(key=>style[key] !== undefined).map(key=>` ${key}="${Math.round(style[key])}"`).join('')
  const align = ({left:'l',right:'r',center:'ctr',justify:'just',distributed:'dist'})[style.align ?? 'left']
  const spacing = ['spaceBefore','spaceAfter'].filter(key=>style[key] !== undefined).map(key=>`<a:${key === 'spaceBefore' ? 'spcBef' : 'spcAft'}><a:spcPts val="${Math.round(style[key]*100)}"/></a:${key === 'spaceBefore' ? 'spcBef' : 'spcAft'}>`).join('')
  const line = style.lineSpacing ? `<a:lnSpc><a:${style.lineSpacing.kind === 'pct' ? 'spcPct' : 'spcPts'} val="${Math.round(style.lineSpacing.value*(style.lineSpacing.kind === 'pct' ? 100000 : 100))}"/></a:lnSpc>` : ''
  const bullet = style.bullet?.kind === 'bullet' ? (style.bullet.fontFamily ? `<a:buFont typeface="${xml(style.bullet.fontFamily)}"/>` : '') + `<a:buChar char="${xml(style.bullet.character)}"/>` : '<a:buNone/>'
  return `<a:pPr algn="${align}"${attributes}>${line}${spacing}${bullet}</a:pPr>`
}
function textBody(element, defaults, lang) {
  const frame = element.textFrame ?? {}, style = mergeSceneTextStyles(defaults,element.textStyle)
  const margins = frame.margins ?? {}
  const attributes = Object.entries({left:'lIns',right:'rIns',top:'tIns',bottom:'bIns'}).filter(([side])=>margins[side] !== undefined).map(([side,key])=>` ${key}="${Math.round(margins[side])}"`).join('')
  const fit = ({none:'noAutofit',normal:'normAutofit',shape:'spAutoFit'})[frame.autoFit ?? 'none']
  return `<p:txBody><a:bodyPr wrap="${frame.wrap ?? 'square'}" anchor="${({top:'t',center:'ctr',bottom:'b'})[frame.anchor ?? 'top']}"${attributes}><a:${fit}/></a:bodyPr><a:lstStyle/>${element.paragraphs.map(p=>`<a:p>${paragraphProperties({...frame,...p.style})}${p.runs.map(run=>run.break ? `<a:br>${runProperties(style,frame,lang)}</a:br>` : `<a:r>${runProperties(mergeSceneTextStyles(style,run.style),frame,lang)}<a:t xml:space="preserve">${xml(run.text)}</a:t></a:r>`).join('')}</a:p>`).join('')}</p:txBody>`
}
function identity(element, id, text = false) {
  return `<p:nvSpPr><p:cNvPr id="${id}" name="${xml(element.name ?? element.id)}" descr="${xml(element.id)}"/><p:cNvSpPr${text ? ' txBox="1"' : ''}/><p:nvPr/></p:nvSpPr>`
}

export function sceneImageBytes(asset, id) {
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(asset?.data ?? '')
  if (!match || match[2].length > 5*1024*1024*1.4) error('invalid-image-asset',id,'Expected an embedded PNG/JPEG up to 5 MiB')
  const bytes = Buffer.from(match[2],'base64')
  if (bytes.length > 5*1024*1024 || bytes.toString('base64') !== match[2] || asset.mime !== 'image/'+match[1]) error('invalid-image-asset',id,'Invalid embedded image encoding')
  let info
  try { info = imageInfo(bytes,id) } catch { error('invalid-image-asset',id,'Invalid raster image or dimensions') }
  if (info.width !== asset.width || info.height !== asset.height || info.mime !== asset.mime) error('invalid-image-asset',id,'Image metadata does not match its bytes')
  return bytes
}
export function sceneImageGeometry(element, asset) {
  let frame = {...element.frame}, crop = {left:0,right:0,top:0,bottom:0,...element.crop}
  const natural = asset.width*(1-crop.left-crop.right)/(asset.height*(1-crop.top-crop.bottom)), target = frame.w/frame.h
  if (element.fit === 'contain') {
    const w = natural > target ? frame.w : frame.h*natural, h = natural > target ? frame.w/natural : frame.h
    frame = {x:Math.round(frame.x+(frame.w-w)/2),y:Math.round(frame.y+(frame.h-h)/2),w:Math.round(w),h:Math.round(h)}
  } else if (element.fit === 'cover') {
    const fraction = natural > target ? (1-target/natural)/2 : (1-natural/target)/2
    const [start,end] = natural > target ? ['left','right'] : ['top','bottom']
    const remaining = 1-crop[start]-crop[end]
    crop = {...crop,[start]:crop[start]+remaining*fraction,[end]:crop[end]+remaining*fraction}
  }
  return {frame,crop}
}
function tableXml(e,id,defaults,lang) {
  const t=e.table
  const rows=t.rows.map((height,row)=>`<a:tr h="${height}">${t.columns.map((_,col)=>{
    const cell=t.cells.find(c=>row>=c.row&&row<c.row+c.rowSpan&&col>=c.col&&col<c.col+c.colSpan)
    const origin=cell.row===row&&cell.col===col
    const attrs=origin ? `${cell.colSpan>1 ? ` gridSpan="${cell.colSpan}"` : ''}${cell.rowSpan>1 ? ` rowSpan="${cell.rowSpan}"` : ''}` : `${col>cell.col ? ' hMerge="1"' : ''}${row>cell.row ? ' vMerge="1"' : ''}`
    if(!origin)return `<a:tc${attrs}><a:txBody><a:bodyPr/><a:lstStyle/><a:p/></a:txBody><a:tcPr/></a:tc>`
    const borders=Object.entries(cell.borders??{}).map(([side,b])=>`<a:ln${({left:'L',right:'R',top:'T',bottom:'B'})[side]} w="${Math.round(b.width*12700)}">${color(b.color)}<a:prstDash val="solid"/></a:ln${({left:'L',right:'R',top:'T',bottom:'B'})[side]}>`).join('')
    return `<a:tc${attrs}>${textBody(cell,defaults,lang).replaceAll('p:txBody','a:txBody')}<a:tcPr>${borders}${cell.fill?color(cell.fill):'<a:noFill/>'}</a:tcPr></a:tc>`
  }).join('')}</a:tr>`).join('')
  const placement=xfrm(e).replaceAll('a:xfrm','p:xfrm')
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="${xml(e.name??e.id)}" descr="${xml(e.id)}"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>${placement}<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr/><a:tblGrid>${t.columns.map(w=>`<a:gridCol w="${w}"/>`).join('')}</a:tblGrid>${rows}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`
}
export function renderScenePptx(slide, {assets = {}, font = 'Liberation Sans', textColor = '#000000', lang = 'en-US', mediaRegistry = new Map(), deferCharts = false} = {}) {
  slide = normalizeSceneSlide(slide,{assets})
  const media = [], relationships = [], shapes = [], imageRelationships = new Map()
  let id = 2
  for (const source of slide.elements) {
    if (source.type === 'group') continue // Children already carry their final page transforms.
    let element = source
    const shapeId = id++
    if (element.type === 'chart') {
      if (!deferCharts) error('async-chart-export',element.id,'Native scene charts require buildDeckAsync')
      element = {...element,type:'text',name:'__scene_chart__'+element.id,paragraphs:[{runs:[{text:''}]}]}
    }
    if (element.type === 'table') { shapes.push(tableXml(element,shapeId,{fontFamily:font,size:18,color:textColor},lang)); continue }
    if (element.type === 'unsupported' && !element.previewAssetId) element = {...element,type:'text',textStyle:{size:12,color:'#B00020'},paragraphs:[{runs:[{text:`Unsupported object: ${element.sourceKind}\n${element.reason}`}]}]}
    if (element.type === 'image' || element.previewAssetId) {
      const assetId = element.assetId ?? element.previewAssetId, asset = assets[assetId]
      let name = mediaRegistry.get(assetId)
      if (!name) {
        const bytes = sceneImageBytes(asset,element.id), extension = asset.mime === 'image/png' ? 'png' : 'jpg'
        name = `scene-image-${mediaRegistry.size+1}.${extension}`
        mediaRegistry.set(assetId,name)
        media.push({name:'ppt/media/'+name,data:bytes})
      }
      let rel = imageRelationships.get(assetId)
      if (!rel) {
        rel = `rIdScene${imageRelationships.size+1}`
        imageRelationships.set(assetId,rel)
        relationships.push(`<Relationship Id="${rel}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${name}"/>`)
      }
      const geometry = sceneImageGeometry({...element,fit:element.fit ?? 'contain'},asset)
      const crop = Object.entries({left:'l',right:'r',top:'t',bottom:'b'}).map(([side,key])=>` ${key}="${Math.round(geometry.crop[side]*100000)}"`).join('')
      shapes.push(`<p:pic><p:nvPicPr><p:cNvPr id="${shapeId}" name="${xml(element.name ?? element.id)}" descr="${xml(element.alt ?? element.reason ?? '')}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rel}"/><a:srcRect${crop}/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${xfrm({...element,frame:geometry.frame})}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`)
    } else if (element.type === 'text') {
      shapes.push(`<p:sp>${identity(element,shapeId,true)}<p:spPr>${xfrm(element)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr>${textBody(element,{fontFamily:font,size:18,color:textColor,bold:false,italic:false},lang)}</p:sp>`)
    } else {
      const line = element.type === 'line'
      const nv = line ? `<p:nvCxnSpPr><p:cNvPr id="${shapeId}" name="${xml(element.name ?? element.id)}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>` : identity(element,shapeId)
      shapes.push(`<p:${line ? 'cxnSp' : 'sp'}>${nv}<p:spPr>${xfrm(element)}<a:prstGeom prst="${line ? 'line' : element.preset}"><a:avLst/></a:prstGeom>${element.fill ? color(element.fill.color,element.fill.opacity) : '<a:noFill/>'}${stroke(element.stroke)}</p:spPr></p:${line ? 'cxnSp' : 'sp'}>`)
    }
  }
  return {xml:shapes.join(''),media,relationships:relationships.join('')}
}
