import { normalizeSlotTypography } from './deck-text-slots.mjs'
// Макеты шаблона: фон + картинки с положением в долях слайда (проценты 0..100).
// Чистые функции без зависимостей от deck-core/deck-advanced (их импортируют оба).
//
// Форма на входе (из шаблона/инструмента):
//   { id, name?, layoutType: cover|section|content|closing, fit?: cover|contain,
//     background?: { src|assetId, fit? }, backgroundColor?: '#RRGGBB',
//     images?: [{ src|assetId, svg?, x, y, w, h, z?, fit?, role? }],
//     textZones?: [{ kind: title|body, x, y, w, h }] }
// Форма в движке: то же, но src → assetId, background → backgroundAssetId.

import { normalizeTextStyles } from './deck-fonts.mjs'

export const LAYOUT_TYPES = ['cover', 'section', 'content', 'closing']
export const MAX_LAYOUTS = 120
export const MAX_LAYOUT_IMAGES = 12
export const MAX_SVG_BYTES = 300 * 1024
const LAYOUT_ID = /^[a-z0-9][a-z0-9-]{0,40}$/
const IMAGE_FITS = ['contain', 'cover', 'fill']
const ROLES = ['logo', 'decor', 'header', 'background', 'photo']
const ZONE_KINDS = ['title', 'body', 'image']

const round = value => Math.round(value * 1000) / 1000

function number(value, field, min, max, fail) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(`${field} 需为 ${min}…${max} 之间的数字`)
  return round(value)
}

/** SVG → безопасный data URI либо null (скрипты, внешние ссылки, foreignObject, DTD отвергаются). */
export function sanitizeSvg(input) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(String(input ?? ''), 'utf8')
  if (!bytes.length || bytes.length > MAX_SVG_BYTES) return null
  const text = bytes.toString('utf8')
  if (!/<svg[\s>]/i.test(text)) return null
  if (/<\s*(script|foreignObject|iframe|object|embed|audio|video|style\b[^>]*>[^<]*@import)/i.test(text)) return null
  if (/<!(ENTITY|DOCTYPE)/i.test(text) || /<\?xml-stylesheet/i.test(text)) return null
  if (/\son[a-z]+\s*=/i.test(text) || /javascript:/i.test(text)) return null
  for (const match of text.matchAll(/(?:xlink:)?href\s*=\s*["']([^"']*)["']/gi)) {
    if (!/^(#|data:image\/(png|jpeg|svg\+xml);base64,)/i.test(match[1].trim())) return null
  }
  for (const match of text.matchAll(/url\(\s*["']?([^)"']*)/gi)) {
    if (!/^(#|data:image\/)/i.test(match[1].trim())) return null
  }
  return 'data:image/svg+xml;base64,' + bytes.toString('base64')
}

function checkSvgUri(value, field, fail) {
  if (typeof value !== 'string' || value.length > MAX_SVG_BYTES * 1.4 + 40) fail(`${field} 无效或过大`)
  const match = /^data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)$/.exec(value)
  if (!match || !sanitizeSvg(Buffer.from(match[1], 'base64'))) fail(`${field} 不是安全的 SVG`)
  return value
}

/**
 * Нормализация layouts → форма движка. addAsset(image, page) вставляет src в таблицу ассетов
 * и возвращает assetId (для assetId просто проверяет наличие).
 */
export function normalizeDesignLayouts(input, assets, addAsset, fail) {
  if (input === undefined || input === null) return undefined
  if (!Array.isArray(input) || input.length > MAX_LAYOUTS) fail(`style.layouts 需为不超过 ${MAX_LAYOUTS} 项的数组`)
  const seen = new Set(), out = []
  for (const [index, raw] of input.entries()) {
    const path = `style.layouts[${index}]`
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(`${path} 必须是对象`)
    if (typeof raw.id !== 'string' || !LAYOUT_ID.test(raw.id)) fail(`${path}.id 需为小写字母/数字/连字符`)
    if (seen.has(raw.id)) fail(`style.layouts 有重复的 id：${raw.id}`)
    seen.add(raw.id)
    if (!LAYOUT_TYPES.includes(raw.layoutType)) fail(`${path}.layoutType 只支持 ${LAYOUT_TYPES.join(' / ')}`)
    const layout = { id: raw.id, layoutType: raw.layoutType, fit: raw.fit ?? 'cover', images: [] }
    if (raw.familyId !== undefined) { if (!LAYOUT_ID.test(raw.familyId)) fail(`${path}.familyId неверен`); layout.familyId = raw.familyId }
    if (raw.textStyles !== undefined) layout.textStyles = normalizeTextStyles(raw.textStyles)
    if (!['cover', 'contain'].includes(layout.fit)) fail(`${path}.fit 只支持 contain / cover`)
    if (raw.name !== undefined) layout.name = String(raw.name).slice(0, 80)
    const bg = raw.background
    if (bg !== undefined && bg !== null) {
      if (typeof bg !== 'object' || Array.isArray(bg)) fail(`${path}.background 必须是对象`)
      if (bg.fit !== undefined) {
        if (!['cover', 'contain'].includes(bg.fit)) fail(`${path}.background.fit 只支持 contain / cover`)
        layout.fit = bg.fit
      }
      layout.backgroundAssetId = addAsset(bg, `${path}.background`)
    } else if (raw.backgroundAssetId !== undefined) {
      layout.backgroundAssetId = addAsset({ assetId: raw.backgroundAssetId }, `${path}.background`)
    }
    if (raw.backgroundColor !== undefined && raw.backgroundColor !== '') {
      if (!/^#[\da-f]{6}$/i.test(raw.backgroundColor)) fail(`${path}.backgroundColor 必须为 #RRGGBB`)
      layout.backgroundColor = raw.backgroundColor.toUpperCase()
    }
    if (raw.images !== undefined) {
      if (!Array.isArray(raw.images) || raw.images.length > MAX_LAYOUT_IMAGES) fail(`${path}.images 最多 ${MAX_LAYOUT_IMAGES} 项`)
      for (const [i, image] of raw.images.entries()) {
        const ipath = `${path}.images[${i}]`
        if (!image || typeof image !== 'object' || Array.isArray(image)) fail(`${ipath} 必须是对象`)
        const entry = {
          assetId: addAsset(image, ipath),
          x: number(image.x, `${ipath}.x`, -50, 150, fail), y: number(image.y, `${ipath}.y`, -50, 150, fail),
          w: number(image.w, `${ipath}.w`, 0.1, 200, fail), h: number(image.h, `${ipath}.h`, 0.1, 200, fail),
          z: image.z === undefined ? i : Math.round(number(image.z, `${ipath}.z`, 0, 99, fail)),
          fit: image.fit ?? 'contain',
        }
        if (!IMAGE_FITS.includes(entry.fit)) fail(`${ipath}.fit 只支持 ${IMAGE_FITS.join(' / ')}`)
        if (image.role !== undefined) {
          if (!ROLES.includes(image.role)) fail(`${ipath}.role 只支持 ${ROLES.join(' / ')}`)
          entry.role = image.role
        }
        if (image.svg !== undefined && image.svg !== null) entry.svg = checkSvgUri(image.svg, `${ipath}.svg`, fail)
        layout.images.push(entry)
      }
    }
    if (raw.textZones !== undefined) {
      if (!Array.isArray(raw.textZones) || raw.textZones.length > 6) fail(`${path}.textZones 最多 6 项`)
      layout.textZones = raw.textZones.map((zone, i) => {
        const zpath = `${path}.textZones[${i}]`
        if (!zone || typeof zone !== 'object' || !ZONE_KINDS.includes(zone.kind)) fail(`${zpath}.kind 只支持 ${ZONE_KINDS.join(' / ')}`)
        return { ...normalizeSlotTypography(zone), kind: zone.kind, x: number(zone.x, `${zpath}.x`, 0, 100, fail), y: number(zone.y, `${zpath}.y`, 0, 100, fail),
          w: number(zone.w, `${zpath}.w`, 1, 100, fail), h: number(zone.h, `${zpath}.h`, 1, 100, fail) }
      })
    }
    out.push(layout)
  }
  return out.length ? out : undefined
}

/** Макет слайда: явный slide.designLayout, иначе первый макет нужного типа страницы. */
export function pickDesignLayout(layouts, slide, type) {
  if (!Array.isArray(layouts) || !layouts.length) return undefined
  if (typeof slide?.designLayout === 'string') {
    const exact = layouts.find(layout => layout.id === slide.designLayout)
    if (exact) return exact
  }
  return layouts.find(layout => layout.layoutType === type)
}

export function layoutAssetIds(layout) {
  const ids = []
  if (layout.backgroundAssetId) ids.push(layout.backgroundAssetId)
  for (const image of layout.images ?? []) ids.push(image.assetId)
  return ids
}

const attr = text => String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
const pct = value => round(value) + '%'

/** HTML слоя макета: фон и картинки под текстом слайда (z-index:-1 как у ::after фонов). */
export function renderLayoutLayer(layout, assets) {
  const parts = []
  const bg = layout.backgroundAssetId ? assets?.[layout.backgroundAssetId]?.data : undefined
  const size = layout.fit === 'contain' ? 'contain' : 'cover'
  if (layout.backgroundColor || bg) {
    parts.push('<div class="tpl-bg" style="' + (layout.backgroundColor ? 'background-color:' + attr(layout.backgroundColor) + ';' : '') +
      (bg ? 'background-image:url(&quot;' + attr(bg) + '&quot;);background-size:' + size + ';background-position:center;background-repeat:no-repeat' : '') + '"></div>')
  }
  const images = [...(layout.images ?? [])].sort((a, b) => a.z - b.z)
  for (const image of images) {
    const src = image.svg ?? assets?.[image.assetId]?.data
    if (!src) continue
    const fit = image.fit === 'fill' ? 'fill' : image.fit
    parts.push('<img class="tpl-img" alt="" src="' + attr(src) + '" style="left:' + pct(image.x) + ';top:' + pct(image.y) + ';width:' + pct(image.w) + ';height:' + pct(image.h) + ';object-fit:' + fit + '"/>')
  }
  return parts.length ? '<div class="tpl-layer" aria-hidden="true">' + parts.join('') + '</div>' : ''
}

export const LAYOUT_CSS = `.tpl-layer{position:absolute;inset:0;z-index:-1;pointer-events:none;overflow:hidden}
.tpl-bg{position:absolute;inset:0}
.tpl-img{position:absolute;max-width:none;user-select:none}`

/** Область текста макета (объединение всех textZones) в % слайда либо undefined. */
export function zoneRect(layout) {
  const zones = layout?.textZones
  if (!Array.isArray(zones) || !zones.length) return undefined
  const x0 = Math.min(...zones.map(z => z.x)), y0 = Math.min(...zones.map(z => z.y))
  const x1 = Math.max(...zones.map(z => z.x + z.w)), y1 = Math.max(...zones.map(z => z.y + z.h))
  return { x: round(x0), y: round(y0), w: round(x1 - x0), h: round(y1 - y0) }
}

/** Inline-стиль .slide-inner: текст слайда занимает область текста макета. */
export function zoneInnerStyle(layout) {
  const r = zoneRect(layout)
  return r ? `position:absolute;left:${pct(r.x)};top:${pct(r.y)};width:${pct(r.w)};height:${pct(r.h)};max-width:none;box-sizing:border-box;padding:0;overflow:hidden` : ''
}

// Типовая область текста генератора (EMU слайда 12192000×6858000), в неё «вписываются» тексты по умолчанию.
const DEFAULT_FRAME = { x: 900000, y: 900000, w: 10400000, h: 5100000 }
const TEXT_SHAPES = /^(Title|Subtitle|Kicker|Body|Quote|Attribution|Statement|Caption|Table|Accent bar)$/
/** Перенос текстовых фигур PPTX-слайда из типовой области в область текста макета. */
export function remapTextShapes(shapesXml, layout) {
  const r = zoneRect(layout)
  if (!r) return shapesXml
  const zx = r.x / 100 * 12192000, zy = r.y / 100 * 6858000, zw = r.w / 100 * 12192000, zh = r.h / 100 * 6858000
  const sx = zw / DEFAULT_FRAME.w, sy = zh / DEFAULT_FRAME.h
  return shapesXml.replace(/<p:(sp|graphicFrame)>[\s\S]*?<\/p:\1>/g, block => {
    const name = /<p:cNvPr id="\d+" name="([^"]*)"/.exec(block)?.[1]
    if (!name || !TEXT_SHAPES.test(name)) return block
    return block.replace(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/, (_, x, y, w, h) => {
      const nx = Math.round(zx + (Number(x) - DEFAULT_FRAME.x) * sx), ny = Math.round(zy + (Number(y) - DEFAULT_FRAME.y) * sy)
      const nw = Math.max(200000, Math.round(Number(w) * sx)), nh = Math.max(150000, Math.round(Number(h) * sy))
      return `<a:off x="${Math.max(0, nx)}" y="${Math.max(0, ny)}"/><a:ext cx="${Math.min(nw, 12192000 - Math.max(0, nx))}" cy="${Math.min(nh, 6858000 - Math.max(0, ny))}"/>`
    })
  })
}
