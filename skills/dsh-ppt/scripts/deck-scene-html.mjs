import {renderSceneChartSvg} from './deck-scene-chart-html.mjs'
import { normalizeSceneSlide, mergeSceneTextStyles } from './deck-model.mjs'
import { escapeHtml as html } from './deck-text.mjs'
import { pageSize } from './deck-page.mjs'
import { sceneImageGeometry, sceneImageBytes, scenePptxPlacement } from './deck-scene-pptx.mjs'

const px = emu => emu/9525
const fontCss = style => `font-family:${style.fontFamily.includes(',') ? style.fontFamily : JSON.stringify(style.fontFamily)};font-size:${style.size*4/3}px;color:${style.color};font-weight:${style.bold ? 700 : 400};font-style:${style.italic ? 'italic' : 'normal'}`
function textMarkup(element, theme) {
  const frame = element.textFrame ?? {}, base = mergeSceneTextStyles({fontFamily:theme.fonts.body,size:18,color:theme.palette.fg},element.textStyle)
  const margins = {left:91440,right:91440,top:45720,bottom:45720,...frame.margins}
  const spacing = style => style.lineSpacing ? style.lineSpacing.kind === 'pct' ? String(style.lineSpacing.value) : style.lineSpacing.value*4/3+'px' : 'normal'
  const paragraphs = element.paragraphs.map(p=>{
    const style = {...frame,...p.style}
    const bullet = style.bullet?.kind === 'bullet'
    const css = `position:relative;margin:${(style.spaceBefore ?? 0)*4/3}px ${px(style.marR ?? 0)}px ${(style.spaceAfter ?? 0)*4/3}px ${px(style.marL ?? 0)}px;text-indent:${bullet ? 0 : px(style.indent ?? 0)}px;text-align:${style.align === 'distributed' ? 'justify' : style.align ?? 'left'};line-height:${spacing(style)};white-space:${frame.wrap === 'none' ? 'pre' : 'pre-wrap'};overflow-wrap:normal`
    const marker = bullet ? `<span aria-hidden="true" style="${html(`position:absolute;left:${px(style.indent ?? 0)}px;${fontCss({...base,fontFamily:style.bullet.fontFamily ?? base.fontFamily})}`)}">${html(style.bullet.character)}</span>` : ''
    return `<p style="${html(css)}">${marker}${p.runs.map(run=>run.break ? '<br/>' : `<span style="${html(fontCss(mergeSceneTextStyles(base,run.style)))}">${html(run.text) || '&#8203;'}</span>`).join('')}</p>`
  }).join('')
  const css = `width:100%;height:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:${({top:'flex-start',center:'center',bottom:'flex-end'})[frame.anchor ?? 'top']};padding:${px(margins.top)}px ${px(margins.right)}px ${px(margins.bottom)}px ${px(margins.left)}px;overflow:hidden;${fontCss(base)}`
  return `<foreignObject x="${px(element.frame.x)}" y="${px(element.frame.y)}" width="${px(element.frame.w)}" height="${px(element.frame.h)}"><div xmlns="http://www.w3.org/1999/xhtml" style="${html(css)}"><div>${paragraphs}</div></div></foreignObject>`
}
export function renderSceneHtml(slide, manifest, theme, prefix = 'scene') {
  slide = normalizeSceneSlide(slide,{assets:manifest.assets ?? {}})
  const size = pageSize(manifest)
  const elements = slide.elements.map((source,index)=>{
    if (source.type === 'group') return ''
    let e = source, markup
    if (e.type === 'unsupported' && !e.previewAssetId) e = {...e,type:'text',textStyle:{size:12,color:'#B00020'},paragraphs:[{runs:[{text:`Unsupported object: ${e.sourceKind}\n${e.reason}`}]}]}
    if (e.type === 'image' || e.previewAssetId) {
      const asset = manifest.assets[e.assetId ?? e.previewAssetId]
      sceneImageBytes(asset,e.id)
      e = {...e,...sceneImageGeometry({...e,fit:e.fit ?? 'contain'},asset),fit:'fill'}
    }
    // Office scales the frame, not the point size or line width. Bake scale and
    // translation into the frame; only rotation/reflection act on the content.
    const placement = scenePptxPlacement(e)
    e = {...e,frame:{x:placement.x,y:placement.y,w:placement.w,h:placement.h}}
    if (e.type === 'text') markup = textMarkup(e,theme)
    else if (e.type === 'chart') markup = `<svg x="${px(e.frame.x)}" y="${px(e.frame.y)}" width="${px(e.frame.w)}" height="${px(e.frame.h)}">${renderSceneChartSvg(e.chart,theme)}</svg>`
    else if (e.type === 'table') {
      markup = e.table.cells.map(cell=>{
        const frame={x:e.frame.x+e.table.columns.slice(0,cell.col).reduce((a,b)=>a+b,0),y:e.frame.y+e.table.rows.slice(0,cell.row).reduce((a,b)=>a+b,0),w:e.table.columns.slice(cell.col,cell.col+cell.colSpan).reduce((a,b)=>a+b,0),h:e.table.rows.slice(cell.row,cell.row+cell.rowSpan).reduce((a,b)=>a+b,0)}
        const rect=`<rect x="${px(frame.x)}" y="${px(frame.y)}" width="${px(frame.w)}" height="${px(frame.h)}" fill="${cell.fill??'none'}"/>`
        const edges={left:[frame.x,frame.y,frame.x,frame.y+frame.h],right:[frame.x+frame.w,frame.y,frame.x+frame.w,frame.y+frame.h],top:[frame.x,frame.y,frame.x+frame.w,frame.y],bottom:[frame.x,frame.y+frame.h,frame.x+frame.w,frame.y+frame.h]}
        return rect+textMarkup({...cell,frame},theme)+Object.entries(cell.borders??{}).map(([side,b])=>{const [x1,y1,x2,y2]=edges[side].map(px);return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${b.color}" stroke-width="${b.width*4/3}"/>`}).join('')
      }).join('')
    }
    else if (e.type === 'image' || e.previewAssetId) {
      const asset = manifest.assets[e.assetId ?? e.previewAssetId]
      const {frame,crop} = e
      markup = `<svg x="${px(frame.x)}" y="${px(frame.y)}" width="${px(frame.w)}" height="${px(frame.h)}" viewBox="${crop.left*asset.width} ${crop.top*asset.height} ${(1-crop.left-crop.right)*asset.width} ${(1-crop.top-crop.bottom)*asset.height}" preserveAspectRatio="none" overflow="hidden"><title>${html(e.alt ?? e.reason ?? '')}</title><image href="${html(asset.data)}" width="${asset.width}" height="${asset.height}"/></svg>`
    } else {
      const {x,y,w,h} = Object.fromEntries(Object.entries(e.frame).map(([key,value])=>[key,px(value)]))
      const stroke = e.stroke, attributes = `fill="${e.fill?.color ?? 'none'}" fill-opacity="${e.fill?.opacity ?? 1}" stroke="${stroke?.color ?? 'none'}" stroke-opacity="${stroke?.opacity ?? 1}" stroke-width="${(stroke?.width ?? 0)*4/3}"${stroke?.dash === 'dash' ? ' stroke-dasharray="6 4"' : stroke?.dash === 'dot' ? ' stroke-dasharray="1 3"' : ''}`
      const markerId = prefix+'-arrow-'+index
      const marker = (side,type) => type && type !== 'none' ? ` marker-${side}="url(#${markerId}-${side})"` : ''
      const definitions = ['head','tail'].map((side,i)=>{
        const type = stroke?.[side]
        if (!type || type === 'none') return ''
        const shape = type === 'oval' ? '<circle cx="5" cy="5" r="4"/>' : type === 'diamond' ? '<path d="M0 5 5 0 10 5 5 10Z"/>' : type === 'arrow' ? '<path d="M1 1 9 5 1 9" fill="none" stroke="currentColor"/>' : type === 'stealth' ? '<path d="M0 0 10 5 0 10 3 5Z"/>' : '<path d="M0 0 10 5 0 10Z"/>'
        return `<marker id="${markerId}-${i ? 'end' : 'start'}" markerWidth="6" markerHeight="6" refX="8" refY="5" viewBox="0 0 10 10" orient="auto-start-reverse" fill="${stroke.color}" color="${stroke.color}">${shape}</marker>`
      }).join('')
      if (e.type === 'line') markup = `<defs>${definitions}</defs><line x1="${x}" y1="${y}" x2="${x+w}" y2="${y+h}" ${attributes}${marker('start',stroke?.head)}${marker('end',stroke?.tail)}/>`
      else if (e.preset === 'ellipse') markup = `<ellipse cx="${x+w/2}" cy="${y+h/2}" rx="${w/2}" ry="${h/2}" ${attributes}/>`
      else if (['triangle','diamond'].includes(e.preset)) markup = `<polygon points="${e.preset === 'triangle' ? `${x+w/2},${y} ${x+w},${y+h} ${x},${y+h}` : `${x+w/2},${y} ${x+w},${y+h/2} ${x+w/2},${y+h} ${x},${y+h/2}`}" ${attributes}/>`
      else markup = `<rect x="${x}" y="${y}" width="${w}" height="${h}"${e.preset === 'roundRect' ? ` rx="${Math.min(w,h)/6}"` : ''} ${attributes}/>`
    }
    const cx = px(e.frame.x+e.frame.w/2), cy = px(e.frame.y+e.frame.h/2)
    const transform = placement.rotation || placement.flipV ? `translate(${cx} ${cy}) rotate(${placement.rotation/60000}) scale(1 ${placement.flipV ? -1 : 1}) translate(${-cx} ${-cy})` : ''
    return `<g data-element-id="${html(e.id)}"${transform ? ` transform="${transform}"` : ''}>${markup}</g>`
  }).join('')
  return `<svg class="scene-canvas" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${px(size.width)} ${px(size.height)}" style="position:absolute;inset:0;width:100%;height:100%;overflow:hidden" role="img" aria-label="${html(slide.label ?? '')}"><rect width="100%" height="100%" fill="${theme.palette.bg}"/>${elements}</svg>`
}
