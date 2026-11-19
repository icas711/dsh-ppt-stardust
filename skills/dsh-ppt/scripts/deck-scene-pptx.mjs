import { normalizeSceneSlide } from './deck-model.mjs'
import { IDENTITY_TRANSFORM, transformPoint } from './deck-geometry.mjs'
import { escapeXml as xml } from './deck-text.mjs'

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
  return `<a:rPr lang="${xml(lang)}" sz="${Math.round(style.size*100)}" b="${style.bold ? 1 : 0}" i="${style.italic ? 1 : 0}"${frame.kerning !== undefined ? ` kern="${frame.kerning}"` : ''}>${color(style.color)}<a:latin typeface="${xml(style.fontFamily)}"/><a:ea typeface="${xml(style.fontFamily)}"/><a:cs typeface="${xml(style.fontFamily)}"/></a:rPr>`
}
function paragraphProperties(style) {
  const attributes = ['marL','marR','indent'].filter(key=>style[key] !== undefined).map(key=>` ${key}="${Math.round(style[key])}"`).join('')
  const align = ({left:'l',right:'r',center:'ctr',justify:'just',distributed:'dist'})[style.align ?? 'left']
  const spacing = ['spaceBefore','spaceAfter'].filter(key=>style[key] !== undefined).map(key=>`<a:${key === 'spaceBefore' ? 'spcBef' : 'spcAft'}><a:spcPts val="${Math.round(style[key]*100)}"/></a:${key === 'spaceBefore' ? 'spcBef' : 'spcAft'}>`).join('')
  const line = style.lineSpacing ? `<a:lnSpc><a:${style.lineSpacing.kind === 'pct' ? 'spcPct' : 'spcPts'} val="${Math.round(style.lineSpacing.value*(style.lineSpacing.kind === 'pct' ? 100000 : 100))}"/></a:lnSpc>` : ''
  return `<a:pPr algn="${align}"${attributes}>${line}${spacing}<a:buNone/></a:pPr>`
}
function textBody(element, defaults, lang) {
  const frame = element.textFrame ?? {}, style = {...defaults,...element.textStyle}
  const margins = {left:91440,right:91440,top:45720,bottom:45720,...frame.margins}
  const attributes = Object.entries({left:'lIns',right:'rIns',top:'tIns',bottom:'bIns'}).map(([side,key])=>` ${key}="${Math.round(margins[side])}"`).join('')
  const fit = ({none:'noAutofit',normal:'normAutofit',shape:'spAutoFit'})[frame.autoFit ?? 'none']
  return `<p:txBody><a:bodyPr wrap="${frame.wrap ?? 'square'}" anchor="${({top:'t',center:'ctr',bottom:'b'})[frame.anchor ?? 'top']}"${attributes}><a:${fit}/></a:bodyPr><a:lstStyle/>${element.paragraphs.map(p=>`<a:p>${paragraphProperties({...frame,...p.style})}${p.runs.map(run=>run.break ? `<a:br>${runProperties(style,frame,lang)}</a:br>` : `<a:r>${runProperties({...style,...run.style},frame,lang)}<a:t xml:space="preserve">${xml(run.text)}</a:t></a:r>`).join('')}</a:p>`).join('')}</p:txBody>`
}
function identity(element, id, text = false) {
  return `<p:nvSpPr><p:cNvPr id="${id}" name="${xml(element.name ?? element.id)}" descr="${xml(element.id)}"/><p:cNvSpPr${text ? ' txBox="1"' : ''}/><p:nvPr/></p:nvSpPr>`
}

export function sceneImageBytes(asset, id) {
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(asset?.data ?? '')
  if (!match || match[2].length > 5*1024*1024*1.4) error('invalid-image-asset',id,'Expected an embedded PNG/JPEG up to 5 MiB')
  const bytes = Buffer.from(match[2],'base64')
  if (bytes.length > 5*1024*1024 || bytes.toString('base64') !== match[2] || asset.mime !== 'image/'+match[1]) error('invalid-image-asset',id,'Invalid embedded image encoding')
  const valid = match[1] === 'png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  if (!valid || !Number.isSafeInteger(asset.width) || !Number.isSafeInteger(asset.height) || asset.width < 1 || asset.height < 1) error('invalid-image-asset',id,'Invalid raster image or dimensions')
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
export function renderScenePptx(slide, {assets = {}, font = 'Liberation Sans', textColor = '#000000', lang = 'en-US', mediaRegistry = new Map()} = {}) {
  slide = normalizeSceneSlide(slide,{assets})
  const media = [], relationships = [], shapes = [], imageRelationships = new Map()
  let id = 2
  for (const source of slide.elements) {
    if (source.type === 'group') continue // Children already carry their final page transforms.
    let element = source
    const shapeId = id++
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
