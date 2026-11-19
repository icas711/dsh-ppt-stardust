import {readNativeChart,readNativeTable} from './deck-native-objects.mjs'
// Adapt the existing generator's normalized content using its actual native
// geometry. No second copy of cover/bullets/quote layout coordinates.
import { createHash } from 'node:crypto'
import { buildPptx, pptxFontName } from './deck-pptx.mjs'
import { resolveTheme } from './deck-theme.mjs'
import { resolveLanguage } from './deck-language.mjs'
import { normalizeSceneSlides, assertLegacySlideInput } from './deck-model.mjs'
import { frameTransform } from './deck-geometry.mjs'
import { imageInfo } from './deck-image.mjs'

const hash = value => createHash('sha256').update(value).digest('hex')
function unsupported(path, message) { const error = new Error(`dsh-ppt: legacy-scene-unsupported at ${path}: ${message}`); error.code = 'legacy-scene-unsupported'; error.path = path; throw error }
const numericFrame = value => Object.fromEntries(['x','y','w','h'].map(key=>[key,Number(value[key])]))

function textStyle(format, fonts, defaults, path) {
  const resolve = (value, suffix) => value?.startsWith('+mj') ? fonts['major'+suffix] : value?.startsWith('+mn') ? fonts['minor'+suffix] : value
  const font = resolve(format.font,'Latin') || defaults.font
  if (font !== font.trim() && !defaults.allowTypeface) unsupported(path,'Raw typeface aliases require a sourceTypeface field before migration')
  const style = {fontFamily:font.trim(),size:format.size ?? 18,color:format.color ?? defaults.color,bold:format.bold ?? false,italic:format.italic ?? false}
  if (font !== font.trim()) style.sourceTypeface=font
  if (format.underline !== undefined) style.underline=format.underline
  if (format.kern !== undefined) style.kerning=format.kern
  const scriptFonts = {}
  for (const [key,field,suffix] of [['eastAsian','fontEastAsian','EastAsian'],['complexScript','fontComplexScript','ComplexScript']]) if (format[field] !== undefined) scriptFonts[key] = resolve(format[field],suffix) ?? ''
  if (Object.keys(scriptFonts).length) style.scriptFonts = scriptFonts
  return style
}
export function textElement(lib, pres, shape, common, defaults, path) {
  const body = lib.getShapeBodyPrEffective(pres,shape), fonts = lib.getPresentationFonts(pres)
  if (body.vert && body.vert !== 'horz') unsupported(path,'Vertical text is not supported by this adapter')
  const autoFit = lib.getShapeTextAutoFitParams(shape)
  if (autoFit && (autoFit.fontScale !== 1 || autoFit.lnSpcReduction !== 0)) unsupported(path,'Explicit autofit scale/reduction must be preserved by a later text-contract extension')
  const textbox = lib.isShapeTextBox(shape)
  const paragraphs = []
  for (let p=0;p<lib.getShapeParagraphCount(shape);p++) {
    const properties = lib.getParagraphPropertiesEffective(pres,shape,p)
    const style = {align:properties.align ?? (textbox ? 'left' : 'center')}
    for (const [key,source] of [['marL','marL'],['marR','marR'],['indent','indent'],['spaceBefore','spcBefPts'],['spaceAfter','spcAftPts'],['lineSpacing','lineSpacing']]) if (properties[source] != null) style[key] = properties[source]
    if (properties.rtl) unsupported(path,'RTL paragraph direction is not supported by this adapter')
    if (properties.bullet === 'bullet') {
      const bullet = lib.getParagraphBulletStyle(pres,shape,p)
      if (bullet.color != null || bullet.sizePct != null || bullet.sizePts != null || lib.isParagraphBulletPicture(shape,p)) unsupported(path,'Custom bullet color/size or image bullet is not supported')
      style.bullet = {kind:'bullet',character:'•',...(bullet.font ? {fontFamily:bullet.font} : {})}
    } else if (properties.bullet !== 'none' && properties.bullet != null) unsupported(path,'Automatic numbering is not supported by this adapter')
    let index = 0
    const runs = lib.getShapeParagraphElements(shape,p).map(item=>{
      if (item.kind === 'br') return {break:true}
      if (item.kind !== 'r') unsupported(path,'Dynamic text fields cannot be flattened silently')
      const format = lib.getShapeRunFormatEffective(pres,shape,p,index++)
      if (format.kern != null && !defaults.allowTypeface) unsupported(path,'Per-run kerning is not yet supported by the adapter')
      return {text:item.text,style:textStyle(format,fonts,defaults,path)}
    })
    paragraphs.push({style,runs:runs.length ? runs : [{text:'',style:textStyle(lib.getParagraphEndFormat(shape,p) ?? {},fonts,defaults,path)}]})
  }
  // Absence is significant: materializing the nominal OOXML defaults causes
  // LibreOffice to round text layout differently under normAutofit.
  const margins = Object.fromEntries(Object.entries(body.margins).filter(([,value])=>value != null))
  return {...common,type:'text',paragraphs:paragraphs.length ? paragraphs : [{runs:[{text:''}]}],textFrame:{anchor:body.anchor ?? (textbox ? 'top' : 'center'),wrap:body.wrap ?? 'square',autoFit:lib.getShapeTextAutoFit(shape) ?? 'none',...(Object.keys(margins).length ? {margins} : {})}}
}

export async function legacySlidesToScenes(manifest, {theme,language,renderPptx,signal} = {}) {
  signal?.throwIfAborted()
  if (!manifest || !Array.isArray(manifest.slides) || !manifest.slides.length) unsupported('slides','Expected a normalized legacy state')
  if (manifest.dataModel !== undefined || manifest.slides.some(s=>s?.dataTemplate !== undefined)) unsupported('dataModel','Bound content requires a data-binding migration; it must not become static text')
  for (const [i,slide] of manifest.slides.entries()) {
    assertLegacySlideInput(slide,`slides[${i}]`)
  }
  if (!renderPptx && (manifest.brand || manifest.slides.some(s=>s.image || s.chart || s.layout === 'table') || manifest.style?.layouts?.length || manifest.style?.backgrounds?.length)) unsupported('renderPptx','Branded, image and template states require the full existing project renderer')
  theme ??= resolveTheme(manifest.theme)
  language ??= resolveLanguage(manifest.language)
  const bytes = renderPptx ? await renderPptx(manifest,theme,language,signal) : buildPptx(manifest,theme,language)
  signal?.throwIfAborted()
  if (!(bytes instanceof Uint8Array) || bytes.length > 64*1024*1024) unsupported('renderPptx','Expected generated native bytes up to 64 MiB')
  const lib = await import('@office-kit/pptx')
  const pres = await lib.loadPresentation(bytes), sourceSlides = lib.getSlides(pres)
  if (sourceSlides.length !== manifest.slides.length) unsupported('slides','Native renderer changed slide count')
  const assets = structuredClone(manifest.assets ?? {}), defaults = {font:pptxFontName(theme.fonts.body),color:theme.palette.fg}
  const storeImage = (raw,path) => {
    if (!raw || raw.length > 5*1024*1024) unsupported(path,'Missing or oversized embedded image')
    const data = Buffer.from(raw), info = imageInfo(data,path), id = 'img-'+hash(data)
    assets[id] = {...info,data:`data:${info.mime};base64,${data.toString('base64')}`}
    return id
  }
  const slides = sourceSlides.map((slide,index)=>{
    signal?.throwIfAborted()
    const input = manifest.slides[index], slideId = input.id ?? `legacy-slide-${index+1}`, counts = new Map(), elements = []
    const background = lib.getSlideBackground(slide)
    if (background.kind === 'solid' && background.color.toUpperCase() !== theme.palette.bg.toUpperCase()) {
      if (!/^#[\da-f]{6}$/i.test(background.color)) unsupported(`slides[${index}].background`,'Unresolved background color')
      elements.push({id:'element-'+hash(`${slideId}|background`).slice(0,24),type:'shape',role:'decor',name:'Background',frame:{x:0,y:0,w:Number(lib.getSlideSize(pres).width),h:Number(lib.getSlideSize(pres).height)},preset:'rect',fill:{color:background.color}})
    } else if (background.kind === 'image') {
      const rawBackground = /<p:bg>[\s\S]*?<\/p:bg>/.exec(lib.getSlideXmlString(slide))?.[0] ?? ''
      if (/<a:(?:tile|srcRect)\b/.test(rawBackground)) unsupported(`slides[${index}].background`,'Tiled/cropped background images require an explicit background contract')
      elements.push({id:'element-'+hash(`${slideId}|background`).slice(0,24),type:'image',role:'decor',name:'Background',frame:{x:0,y:0,w:Number(lib.getSlideSize(pres).width),h:Number(lib.getSlideSize(pres).height)},assetId:storeImage(lib.getSlideBackgroundImageBytes(slide),`slides[${index}].background`),fit:'fill',alt:'Background'})
    } else if (background.kind !== 'solid') unsupported(`slides[${index}].background`,'Unsupported or inherited native background')
    for (const shape of lib.getSlideShapes(slide)) {
      const kind = lib.getShapeKind(shape), name = lib.getShapeName(shape) || kind
      const role = /^(Page number|Quote mark|Brand footer|Brand logo|Template |Accent bar)/.test(name) ? 'decor' : 'content'
      const key = kind+'|'+name, ordinal = counts.get(key) ?? 0
      counts.set(key,ordinal+1)
      const id = 'element-'+hash(`${slideId}|${key}|${ordinal}`).slice(0,24)
      const path = `slides[${index}].${name}`
      const bounds = lib.getShapeBoundsResolved(pres,shape)
      if (!bounds) unsupported(path,'Object has no resolved frame')
      const frame = numericFrame(bounds), rotation = lib.getShapeRotation(shape), flip = lib.getShapeFlip(shape)
      const transform = rotation || flip?.horizontal || flip?.vertical ? frameTransform(frame,{rotation,flipH:flip?.horizontal ?? false,flipV:flip?.vertical ?? false}) : undefined
      const common = {id,name,role,frame,...(transform ? {transform} : {}),source:{part:`ppt/slides/slide${index+1}.xml`,shapeId:String(lib.getShapeId(shape)),slide:index+1,kind}}
      elements.push(nativeShapeElement(lib,pres,shape,common,defaults,path,storeImage))
    }
    return {id:slideId,layout:'scene',purpose:({cover:'cover',section:'section',closing:'closing'})[input.layout] ?? 'content',label:input.title || input.kicker || '',...(input.notes !== undefined ? {notes:input.notes} : {}),elements}
  })
  return {slides:normalizeSceneSlides(slides,{assets}),assets,pageSize:{width:Number(lib.getSlideSize(pres).width),height:Number(lib.getSlideSize(pres).height)}}
}

export function nativeShapeElement(lib,pres,shape,common,defaults,path,storeImage) {
  const kind=lib.getShapeKind(shape),name=lib.getShapeName(shape) || kind
      if (lib.isChartShape(shape)) return {...common,type:'chart',chart:readNativeChart(lib,shape)}
      if (lib.isTableShape(shape)) return {...common,type:'table',table:readNativeTable(lib,pres,shape)}
      if (kind === 'picture') {
        const raw = lib.getShapeImageBytes(shape)
        if (lib.getShapeImageOpacity(shape) != null && lib.getShapeImageOpacity(shape) !== 1) unsupported(path,'Image opacity is not supported by the scene contract')
        const assetId = storeImage(raw,path)
        const crop = lib.getShapeImageCrop(shape)
        return ({...common,type:'image',assetId,fit:'fill',alt:lib.getShapeDescription(shape) ?? name,...(crop ? {crop} : {})})
      } else if (kind === 'shape' || kind === 'connector') {
        const hasText = lib.isShapeTextBox(shape) || lib.getShapeText(shape) !== ''
        const fill = lib.getShapeFillEffective(pres,shape), stroke = lib.getShapeStrokeEffective(pres,shape)
        if (hasText && (fill.kind === 'solid' || stroke.kind === 'solid')) unsupported(path,'Text with a visible shape fill/outline needs a compound scene object')
        if (hasText) return (textElement(lib,pres,shape,common,defaults,path))
        else {
          if (!['solid','none','inherit'].includes(fill.kind) || !['solid','none','inherit'].includes(stroke.kind)) unsupported(path,'Complex fill/stroke is not supported')
          const line = kind === 'connector', preset = lib.getShapePreset(shape)
          if (!line && !['rect','roundRect','ellipse','triangle','diamond'].includes(preset)) unsupported(path,'Unsupported native geometry: '+preset)
          const element = {...common,type:line ? 'line' : 'shape',...(line ? {} : {preset})}
          if (fill.kind === 'solid') element.fill = {color:lib.getShapeFillColorResolved(pres,shape) ?? fill.color,opacity:lib.getShapeFillOpacity(shape) ?? 1}
          if (stroke.kind === 'solid') {
            const dash = lib.getShapeStrokeDash(shape)
            if (dash && !['solid','dash','sysDot'].includes(dash)) unsupported(path,'Unsupported stroke dash: '+dash)
            element.stroke = {color:lib.getShapeStrokeColorResolved(pres,shape) ?? stroke.color,width:(stroke.widthEmu ?? 12700)/12700,opacity:lib.getShapeStrokeOpacity(shape) ?? 1,...(dash ? {dash:dash === 'sysDot' ? 'dot' : dash} : {})}
            for (const end of ['head','tail']) {
              const arrow = lib.getShapeStrokeArrow(shape,end)
              if (arrow?.type) element.stroke[end] = arrow.type
            }
          } else if (line) unsupported(path,'Connector without a resolved solid stroke')
          return (element)
        }
      } else unsupported(path,'Native '+kind+' is outside this adapter revision')

}
