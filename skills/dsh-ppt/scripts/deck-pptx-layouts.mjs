// deck-pptx-layouts.mjs —— извлечение макетов (фон + картинки с положением) из PPTX.
// Используется templateFromPptx. Положение хранится в долях слайда (%), поэтому не зависит от формата
// исходного слайда; для не-16:9 (например A4) положение пересчитывается с сохранением физических пропорций.

import { createHash } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import { unzipSync, strFromU8 } from 'fflate'
import { sanitizeSvg, MAX_LAYOUT_IMAGES, MAX_LAYOUTS } from './deck-layouts.mjs'

const TARGET_RATIO = 16 / 9
const RASTER_SHRINK_BYTES = 700 * 1024     // крупнее — пробуем ужать
const RASTER_MAX_SIDE = 2560
const HARD_MAX_ASSET = 5 * 1024 * 1024
const HARD_MAX_TOTAL = 8 * 1024 * 1024

const num = value => Number(value)
const round3 = value => Math.round(value * 1000) / 1000

// --- мелкий PNG-генератор для однотонных плашек ----------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0 }
  return table
})()
function crc32(buffer) { let c = 0xffffffff; for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0); out.write(type, 4, 'ascii'); data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}
/** PNG 2×2 одного цвета (RGBA). Растягивается fit:fill — получается сплошная плашка. */
export function solidPng(hex, alpha = 1) {
  const value = String(hex).replace('#', ''), r = parseInt(value.slice(0, 2), 16), g = parseInt(value.slice(2, 4), 16), b = parseInt(value.slice(4, 6), 16)
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
  const row = Buffer.from([0, r, g, b, a, r, g, b, a])
  const raw = Buffer.concat([row, row])
  const header = Buffer.alloc(13); header.writeUInt32BE(2, 0); header.writeUInt32BE(2, 4); header[8] = 8; header[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

// --- сжатие крупных растров (jpeg-js / pngjs загружаются лениво) -------------------------
async function loadCodecs() {
  try {
    const [jpeg, png] = await Promise.all([import('jpeg-js'), import('pngjs')])
    return { jpeg: jpeg.default ?? jpeg, PNG: (png.default ?? png).PNG }
  } catch { return null }
}
function resizeRgba(src, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4)
  const xr = sw / dw, yr = sh / dh
  for (let y = 0; y < dh; y++) {
    const y0 = Math.floor(y * yr), y1 = Math.max(y0 + 1, Math.min(sh, Math.floor((y + 1) * yr)))
    for (let x = 0; x < dw; x++) {
      const x0 = Math.floor(x * xr), x1 = Math.max(x0 + 1, Math.min(sw, Math.floor((x + 1) * xr)))
      let r = 0, g = 0, b = 0, a = 0, n = 0
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const i = (yy * sw + xx) * 4; r += src[i]; g += src[i + 1]; b += src[i + 2]; a += src[i + 3]; n++ }
      const o = (y * dw + x) * 4; out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = a / n
    }
  }
  return out
}
/** Ужать растр: длинная сторона ≤ maxSide, JPEG quality. Возвращает { bytes, width, height } или null. */
export async function shrinkRaster(bytes, { maxSide = RASTER_MAX_SIDE, quality = 82 } = {}) {
  const codecs = await loadCodecs()
  if (!codecs) return null
  try {
    const isPng = bytes[0] === 0x89
    const image = isPng ? codecs.PNG.sync.read(Buffer.from(bytes)) : codecs.jpeg.decode(Buffer.from(bytes), { useTArray: true, maxMemoryUsageInMB: 512 })
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height))
    const width = Math.max(1, Math.round(image.width * scale)), height = Math.max(1, Math.round(image.height * scale))
    const data = scale < 1 ? resizeRgba(image.data, image.width, image.height, width, height) : image.data
    const out = isPng ? codecs.PNG.sync.write({ width, height, data }, { colorType: 6, deflateLevel: 9 })
      : Buffer.from(codecs.jpeg.encode({ width, height, data }, quality).data)
    return out.length < bytes.length ? { bytes: out, width, height } : null
  } catch { return null }
}

// --- вспомогательное ---------------------------------------------------------------------
function rasterDims(bytes) {
  if (bytes[0] === 0x89) return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), ext: 'png' }
  let offset = 2
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset++; continue }
    const marker = bytes[offset + 1]
    if ([0xc0, 0xc1, 0xc2].includes(marker)) return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7), ext: 'jpg' }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue }
    offset += 2 + bytes.readUInt16BE(offset + 2)
  }
  return { width: 0, height: 0, ext: 'jpg' }
}

/** Тип страницы по названию макета: титульный / раздел / финал / остальное — контент. */
export function layoutTypeByName(name) {
  const text = String(name ?? '').toLowerCase()
  if (/титул|обложк|title slide|cover|封面/.test(text)) return 'cover'
  if (/финал|заключ|спасибо|благодар|closing|final|thank|end\b|结束|谢谢/.test(text)) return 'closing'
  if (/раздел|section|章节/.test(text)) return 'section'
  return 'content'
}

function resolveColor(color, theme) {
  if (typeof color !== 'string') return undefined
  if (/^#[\da-f]{6}$/i.test(color)) return color.toUpperCase()
  const match = /^scheme:(\w+)$/.exec(color)
  if (!match || !theme) return undefined
  const key = { bg1: 'light1', tx1: 'dark1', bg2: 'light2', tx2: 'dark2' }[match[1]] ?? match[1]
  const value = theme[key]
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value.toUpperCase() : undefined
}

/** Пары PNG→SVG из rels/XML макетов и мастера (расширение svgBlip). */
function svgPairs(bytes, report) {
  const pairs = new Map(), files = new Map()
  try {
    const entries = unzipSync(new Uint8Array(bytes), { filter: file => /^ppt\/(slideLayouts|slideMasters)\/(_rels\/)?[^/]+\.(xml|rels)$/.test(file.name) || /^ppt\/media\/[^/]+\.svg$/i.test(file.name) })
    for (const [name, data] of Object.entries(entries)) {
      if (/\.svg$/i.test(name)) { files.set(name.split('/').pop(), Buffer.from(data)); continue }
      if (!/\/(slideLayouts|slideMasters)\/[^/]+\.xml$/.test(name)) continue
      const xml = strFromU8(data), relsName = name.replace(/([^/]+)$/, '_rels/$1.rels'), rels = entries[relsName] ? strFromU8(entries[relsName]) : ''
      const target = id => new RegExp(`<Relationship [^>]*Id="${id}"[^>]*Target="([^"]+)"|<Relationship [^>]*Target="([^"]+)"[^>]*Id="${id}"`).exec(rels)
      for (const blip of xml.matchAll(/<a:blip\b[^>]*\br:embed="(rId\d+)"[^>]*>([\s\S]*?)<\/a:blip>/g)) {
        const svg = /<[\w]+:svgBlip\b[^>]*\br:embed="(rId\d+)"/.exec(blip[2])
        if (!svg) continue
        const png = target(blip[1]), vec = target(svg[1])
        if (png && vec) pairs.set((png[1] ?? png[2]).split('/').pop(), (vec[1] ?? vec[2]).split('/').pop())
      }
    }
  } catch { report.warnings.push('SVG-пары не прочитаны') }
  return { pairs, files }
}

/**
 * Извлечь макеты. Возвращает { layouts, layoutIdByPart, usedAssets } и дополняет assets/report.
 * assets: объект имя → Buffer (наполняется). report: изменяется.
 */
export async function extractPptxLayouts({ pres, lib, bytes, slideSize, theme, assets, report, lang }) {
  const slideW = num(slideSize.width), slideH = num(slideSize.height)
  const srcRatio = slideW / slideH
  const adapt = Math.abs(srcRatio - TARGET_RATIO) > 0.02
  const widthScale = adapt ? srcRatio / TARGET_RATIO : 1
  report.slide = { ratio: round3(srcRatio), adapted: adapt }
  const { pairs, files: svgFiles } = svgPairs(bytes, report)
  const byHash = new Map()
  const skipped = {}
  const skip = kind => { skipped[kind] = (skipped[kind] ?? 0) + 1 }
  const stats = { images: 0, backgrounds: 0, plates: 0, svg: 0, shrunk: 0, zones: 0 }

  const storeBytes = async (raw, hint) => {
    const buffer = Buffer.from(raw)
    const key = createHash('sha1').update(buffer).digest('hex')
    if (byHash.has(key)) return byHash.get(key)
    let data = buffer, dims = rasterDims(data)
    if (!dims.width || !dims.height) return null
    if (data.length > RASTER_SHRINK_BYTES || Math.max(dims.width, dims.height) > RASTER_MAX_SIDE) {
      const shrunk = await shrinkRaster(data, { maxSide: RASTER_MAX_SIDE })
      if (shrunk) { data = shrunk.bytes; dims = { ...rasterDims(data) }; stats.shrunk++ }
    }
    if (data.length > HARD_MAX_ASSET) { report.warnings.push(`Изображение ${hint} (${(data.length / 1048576).toFixed(1)} МиБ) слишком велико и пропущено`); byHash.set(key, null); return null }
    const name = `img-${key.slice(0, 8)}.${rasterDims(data).ext}`
    assets[name] = data
    byHash.set(key, name)
    return name
  }
  const storeSvg = partName => {
    const base = pairs.get(String(partName).split('/').pop())
    const raw = base && svgFiles.get(base)
    if (!raw) return undefined
    if (!sanitizeSvg(raw)) { report.warnings.push(`SVG ${base} отклонён (скрипты, внешние ссылки или размер)`); return undefined }
    const name = `vec-${createHash('sha1').update(raw).digest('hex').slice(0, 8)}.svg`
    assets[name] = raw
    stats.svg++
    return name
  }
  const plateCache = new Map()
  const storePlate = (hex, alpha) => {
    const key = hex + ':' + alpha
    if (!plateCache.has(key)) { const name = `fill-${hex.slice(1).toLowerCase()}${alpha < 1 ? '-' + Math.round(alpha * 100) : ''}.png`; assets[name] = solidPng(hex, alpha); plateCache.set(key, name) }
    return plateCache.get(key)
  }

  // Бокс в EMU → доли слайда с пересчётом под 16:9
  const toBox = bounds => {
    let x = num(bounds.x) / slideW * 100, y = num(bounds.y) / slideH * 100, w = num(bounds.w) / slideW * 100, h = num(bounds.h) / slideH * 100
    if (adapt && w < 95) {
      const nw = w * widthScale, center = x + w / 2
      if (center < 40) x = x * widthScale
      else if (center > 60) x = 100 - (100 - (x + w)) * widthScale - nw
      else x = 50 - nw / 2
      w = nw
    }
    return { x: round3(x), y: round3(y), w: round3(Math.max(w, 0.1)), h: round3(Math.max(h, 0.1)) }
  }
  const project = (bounds, transform) => {
    if (!transform) return bounds
    const { outer, inner } = transform
    const sx = num(outer.w) / (num(inner.w) || 1), sy = num(outer.h) / (num(inner.h) || 1)
    return { x: num(outer.x) + (num(bounds.x) - num(inner.x)) * sx, y: num(outer.y) + (num(bounds.y) - num(inner.y)) * sy, w: num(bounds.w) * sx, h: num(bounds.h) * sy }
  }

  const collect = async (shapes, push, ctx) => {
    for (const shape of shapes) {
      const kind = lib.getShapeKind(shape)
      if (lib.isShapePlaceholder(shape)) continue
      if (kind === 'group') {
        const transform = lib.getGroupTransform(shape)
        const children = lib.getGroupChildren(shape)
        for (const child of children) ctx.nested.add(nestedKey(lib, child))
        await collect(children, push, { ...ctx, transform: composeTransform(ctx.transform, transform) })
        continue
      }
      if (ctx.nested.has(nestedKey(lib, shape)) && !ctx.transform) continue   // плоская копия вложенной картинки
      const raw = lib.getShapeBoundsResolved(ctx.pres, shape)
      if (!raw) { skip(kind); continue }
      const bounds = ctx.transform ? project(raw, ctx.transform) : raw
      if (kind === 'picture' && lib.hasShapeImage(shape)) {
        const data = lib.getShapeImageBytes(shape)
        const name = data ? await storeBytes(data, lib.getShapeName(shape)) : null
        if (!name) { skip('picture'); continue }
        const svg = storeSvg(lib.getShapeImagePartName(shape))
        push({ image: name, ...(svg ? { svg } : {}), ...toBox(bounds), fit: 'fill', hint: lib.getShapeName(shape) })
        stats.images++
        continue
      }
      if (kind === 'shape' && lib.getShapePreset(shape) === 'rect' && !String(lib.getShapeText(shape) ?? '').trim()) {
        const fill = lib.getShapeFillEffective?.(ctx.pres, shape)
        const color = fill?.kind === 'solid' ? resolveColor(fill.color, ctx.theme) : undefined
        if (color) {
          const opacity = lib.getShapeFillOpacity?.(shape)
          push({ image: storePlate(color, typeof opacity === 'number' ? opacity : 1), ...toBox(bounds), fit: 'fill', role: 'decor', hint: lib.getShapeName(shape) })
          stats.plates++
          continue
        }
      }
      skip(kind)
    }
  }

  const layouts = [], layoutIdByPart = new Map(), partNames = new Set()
  for (const layout of lib.getSlideLayouts(pres)) {
    if (layouts.length >= MAX_LAYOUTS) { skip('layout'); continue }
    const part = lib.getSlideLayoutPartName(layout)
    const number = /(\d+)\.xml$/.exec(part)?.[1] ?? String(layouts.length + 1)
    let id = `layout-${number}`
    while (partNames.has(id)) id += 'x'
    partNames.add(id)
    const name = lib.getSlideLayoutName(layout) || id
    const entry = { id, name: name.slice(0, 80), layoutType: layoutTypeByName(name), images: [] }

    // фон: картинка макета → картинка мастера → однотонный цвет
    const bgBytes = lib.getSlideLayoutBackgroundImageBytes(pres, layout) ?? lib.getSlideMasterBackgroundImageBytes(pres, layout)
    if (bgBytes) {
      const bgName = await storeBytes(bgBytes, `фон «${name}»`)
      if (bgName) { entry.background = { image: bgName, fit: 'cover' }; stats.backgrounds++ }
    } else {
      const bg = lib.getSlideLayoutBackground(layout)
      const color = bg?.kind === 'solid' ? resolveColor(bg.color, theme) : undefined
      if (color) entry.backgroundColor = color
    }

    const found = []
    const ctx = { pres, theme, nested: new Set(), transform: null }
    // мастер → макет; вложенные дубликаты отсекаются по nestedKey
    await collect(lib.getSlideMasterShapes(pres, layout), box => found.push(box), { ...ctx, nested: new Set() })
    await collect(lib.getSlideLayoutShapes(pres, layout), box => found.push(box), ctx)
    if (found.length > MAX_LAYOUT_IMAGES) { skip('image-over-limit'); found.length = MAX_LAYOUT_IMAGES }
    entry.images = found.map((box, index) => {
      const { hint, ...rest } = box
      // Полноэкранная картинка без фона макета считается фоном
      return { ...rest, z: index, role: rest.role ?? roleOf(rest) }
    })
    const zone = deriveTextZone(entry.images)
    if (zone) { entry.textZones = [zone]; stats.zones++ }
    layouts.push(entry)
    layoutIdByPart.set(part, id)
  }
  report.layouts = layouts.length
  report.layoutStats = stats
  report.skippedShapes = skipped
  return { layouts, layoutIdByPart }
}

function roleOf(box) {
  if (box.w >= 95 && box.h >= 95) return 'background'
  if (box.w <= 30 && box.h <= 20) return 'logo'
  return box.y < 25 && box.w >= 60 ? 'header' : 'decor'
}
function nestedKey(lib, shape) { return `${lib.getShapeKind(shape)}|${lib.getShapeName(shape)}|${lib.hasShapeImage(shape) ? lib.getShapeImagePartName(shape) : ''}` }
function composeTransform(parent, child) {
  if (!parent) return child
  // Вложенные группы: внутренние координаты ребёнка проецируются родителем
  const p = (x, y, w, h) => ({ x: parent.outer.x + (x - parent.inner.x) * (num(parent.outer.w) / (num(parent.inner.w) || 1)), y: parent.outer.y + (y - parent.inner.y) * (num(parent.outer.h) / (num(parent.inner.h) || 1)), w: w * (num(parent.outer.w) / (num(parent.inner.w) || 1)), h: h * (num(parent.outer.h) / (num(parent.inner.h) || 1)) })
  return { outer: p(num(child.outer.x), num(child.outer.y), num(child.outer.w), num(child.outer.h)), inner: child.inner }
}

/**
 * Область текста по геометрии макета: ниже самой нижней «шапочной» картинки/плашки (логотипы, линия, белая плашка
 * над мозаикой). Без таких элементов зона не создаётся — действует типовая вёрстка.
 */
export function deriveTextZone(images) {
  const header = images.filter(item => item.role !== 'background' && item.y < 30 && item.y + item.h <= 55 && !(item.w >= 95 && item.h >= 95))
  if (!header.length) return null
  const top = Math.min(50, Math.max(...header.map(item => item.y + item.h)) + 2)
  if (top < 12) return null
  const bottom = 93
  return { kind: 'body', x: 6, y: round3(top), w: 88, h: round3(bottom - top) }
}
