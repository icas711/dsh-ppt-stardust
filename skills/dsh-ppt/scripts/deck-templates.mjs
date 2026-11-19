import {createHash} from 'node:crypto'
import {normalizeSceneTemplate,fillSceneLayout} from './deck-template-scene.mjs'
import {importPptxScenes} from './deck-pptx-scenes.mjs'
import {imageInfo as sceneImageInfo} from './deck-image.mjs'
import { normalizeTextZones } from './deck-model.mjs'
import { normalizePageSize } from './deck-page.mjs'
// deck-templates.mjs —— dsh-ppt 模板库核心：模板清单、校验、bundle 读写。
//
// 模板 = 样式（theme + brand + 背景页） + 页面骨架（outline，含占位符）
//       + 可选示例页（samples）。三部分都可缺省。
// 传输格式 bundle = ZIP（template.json + assets/*），也可用裸 template.json。
// 本模块不落 DSH 库（那是 src 侧的事），只负责「模板对象 ↔ 字节」的纯转换，
// CLI、工具与面板共用同一实现。
//
// 提取/应用都基于 manifest 的公开结构；PPTX 提取用 @office-kit/pptx 的读 API。

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'
import { inflateSync } from 'node:zlib'
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'
import { resolveTheme, resolveLanguage } from './deck-core.mjs'
import { extractPptxLayouts, solidPng } from './deck-pptx-layouts.mjs'
import { LAYOUT_TYPES, MAX_LAYOUTS, MAX_LAYOUT_IMAGES, sanitizeSvg } from './deck-layouts.mjs'
import { FONT_EXT, MAX_FONT, MAX_FONTS, fontInfo, fontFamily, normalizeTextStyles, normalizeThemeFonts, normalizeFontRefs, extractTypography } from './deck-fonts.mjs'

export const TEMPLATE_SCHEMA_VERSION = 1
/** Шаблон с style.layouts (макеты с картинками) записывается как schemaVersion 2; версия 1 читается как раньше. */
export const TEMPLATE_LAYOUTS_SCHEMA_VERSION = 2
const TEMPLATE_JSON = 'template.json'
const ASSETS_PREFIX = 'assets/'
const MAX_TEMPLATE_JSON = 1024 * 1024            // 1 MiB manifest
const MAX_ASSET = 5 * 1024 * 1024                // 5 MiB per asset (= engine MAX_IMAGE)
const MAX_TEMPLATE_ASSETS = 8 * 1024 * 1024      // 8 MiB total per template
const MAX_BUNDLE_INPUT = 64 * 1024 * 1024        // 64 MiB compressed input
const MAX_BUNDLE_UNPACKED = 64 * 1024 * 1024     // images and separately budgeted fonts
const MAX_OUTLINE = 120
const MAX_SAMPLES = 5
const MAX_BACKGROUNDS = 8
const MAX_TEXT = 2000
const NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} _/.,&()\-—–:]{0,80}$/u
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,48}$/
const FILE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/
const BACKGROUND_TYPES = ['cover', 'section', 'content', 'closing']
const BG_LAYOUT_OF = { cover: 'cover', section: 'section', closing: 'closing', bullets: 'content', statement: 'content', quote: 'content', table: 'content', image: 'content', 'image-left': 'content', 'image-right': 'content', chart: 'content' }

function fail(message) { throw new Error('dsh-ppt：' + message) }
const clone = value => structuredClone(value)
const L = (lang, zh, en, ru) => { const id = resolveLanguage(lang).id; return id === 'en' ? en : id === 'ru' ? (ru ?? en) : zh }
const placeholder = (lang, what) => L(lang, '待填写：' + what, 'To fill: ' + what, 'Заполнить: ' + what)
export function backgroundTypeOfLayout(layout) { return BG_LAYOUT_OF[layout] ?? 'content' }

// ---------------------------------------------------------------------------
// 校验
// ---------------------------------------------------------------------------

function checkHex(value, field) {
  if (!/^#[\da-f]{6}$/i.test(value)) fail(`${field} 必须为 #RRGGBB`)
  return value.toUpperCase()
}
function checkText(value, field, max = MAX_TEXT) {
  if (typeof value !== 'string' || value.length > max) fail(`${field} 需为不超过 ${max} 字符的字符串`)
  return value
}
function checkImageName(name) {
  if (typeof name !== 'string' || !FILE_PATTERN.test(name) || !/\.(png|jpe?g)$/i.test(name)) fail(`资产文件名不合法：${name}（需 assets/ 下的 PNG/JPEG）`)
  return name
}
function checkSvgName(name) {
  if (typeof name !== 'string' || !FILE_PATTERN.test(name) || !/\.svg$/i.test(name)) fail(`SVG 资产文件名不合法：${name}（需 assets/ 下的 .svg）`)
  return name
}
const ASSET_EXT = /\.(png|jpe?g|svg|ttf|otf|fntdata)$/i
const IMAGE_FIT = ['contain', 'cover', 'fill']
const IMAGE_ROLES = ['logo', 'decor', 'header', 'background', 'photo']
function checkNumber(value, field, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(`${field} 需为 ${min}…${max} 之间的数字`)
  return Math.round(value * 1000) / 1000
}

/** style.layouts → 规范化数组（引用的文件名放在 image / svg / background.image）。 */
function validateLayouts(list) {
  if (!Array.isArray(list) || list.length > MAX_LAYOUTS) fail(`style.layouts 需为不超过 ${MAX_LAYOUTS} 项的数组`)
  const seen = new Set()
  return list.map((raw, index) => {
    const path = `style.layouts[${index}]`
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(`${path} 必须是对象`)
    if (typeof raw.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,40}$/.test(raw.id)) fail(`${path}.id 需为小写字母/数字/连字符`)
    if (seen.has(raw.id)) fail(`style.layouts 有重复的 id：${raw.id}`)
    seen.add(raw.id)
    if (!LAYOUT_TYPES.includes(raw.layoutType)) fail(`${path}.layoutType 只支持 ${LAYOUT_TYPES.join(' / ')}`)
    const layout = { id: raw.id, ...(raw.name !== undefined ? { name: checkText(String(raw.name), `${path}.name`, 80) } : {}), layoutType: raw.layoutType }
    if (raw.familyId !== undefined) { if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(raw.familyId)) fail(`${path}.familyId неверен`); layout.familyId = raw.familyId }
    if (raw.textStyles !== undefined) layout.textStyles = normalizeTextStyles(raw.textStyles)
    if (raw.background !== undefined && raw.background !== null) {
      const bg = raw.background
      if (typeof bg !== 'object' || Array.isArray(bg)) fail(`${path}.background 必须是对象`)
      if (bg.fit !== undefined && !['contain', 'cover'].includes(bg.fit)) fail(`${path}.background.fit 只支持 contain / cover`)
      layout.background = { image: checkImageName(bg.image), fit: bg.fit ?? 'cover' }
    }
    if (raw.backgroundColor !== undefined && raw.backgroundColor !== '') layout.backgroundColor = checkHex(raw.backgroundColor, `${path}.backgroundColor`)
    const images = raw.images ?? []
    if (!Array.isArray(images) || images.length > MAX_LAYOUT_IMAGES) fail(`${path}.images 最多 ${MAX_LAYOUT_IMAGES} 项`)
    layout.images = images.map((image, i) => {
      const ipath = `${path}.images[${i}]`
      if (!image || typeof image !== 'object' || Array.isArray(image)) fail(`${ipath} 必须是对象`)
      const entry = {
        image: checkImageName(image.image),
        x: checkNumber(image.x, `${ipath}.x`, -50, 150), y: checkNumber(image.y, `${ipath}.y`, -50, 150),
        w: checkNumber(image.w, `${ipath}.w`, 0.1, 200), h: checkNumber(image.h, `${ipath}.h`, 0.1, 200),
        z: image.z === undefined ? i : Math.round(checkNumber(image.z, `${ipath}.z`, 0, 99)),
        fit: image.fit ?? 'contain',
      }
      if (!IMAGE_FIT.includes(entry.fit)) fail(`${ipath}.fit 只支持 ${IMAGE_FIT.join(' / ')}`)
      if (image.role !== undefined) {
        if (!IMAGE_ROLES.includes(image.role)) fail(`${ipath}.role 只支持 ${IMAGE_ROLES.join(' / ')}`)
        entry.role = image.role
      }
      if (image.svg !== undefined && image.svg !== null) entry.svg = checkSvgName(image.svg)
      return entry
    })
    if (raw.textZones !== undefined) {
      layout.textZones = normalizeTextZones(raw.textZones, `${path}.textZones`)
    }
    return layout
  })
}

/** 校验并规范一个模板清单；返回深拷贝。assets 用于引用检查，可省略。 */
export function validateTemplateManifest(input, { templateAssets } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('template.json 必须是对象')
  if (input.schemaVersion === 3) {
    const base = validateTemplateManifest({schemaVersion:1,id:input.id,name:input.name,description:input.description,author:input.author,revision:input.revision,createdAt:input.createdAt,updatedAt:input.updatedAt,style:{theme:input.style?.theme,pageSize:input.style?.pageSize,brand:input.style?.brand,themeFonts:input.style?.themeFonts,fonts:input.style?.fonts}})
    if (templateAssets) for (const a of Object.values(input.assetMap ?? {})) {
      const asset=templateAssets[a.file];if(!asset?.bytes) fail('Missing scene asset: '+a.file)
      const info=sceneImageInfo(asset.bytes,a.file);if(info.width!==a.width||info.height!==a.height||info.mime!==a.mime) fail('Scene asset metadata mismatch: '+a.file)
    }
    if(templateAssets)for(const f of input.style?.fonts??[]){if(!templateAssets[f.file]?.bytes)fail('Missing template font '+f.file);fontInfo(templateAssets[f.file].bytes)}
    return normalizeSceneTemplate({...input,...base,schemaVersion:3,style:{...input.style,...base.style}})
  }
  if (![TEMPLATE_SCHEMA_VERSION, TEMPLATE_LAYOUTS_SCHEMA_VERSION].includes(input.schemaVersion)) fail(`不支持的模板 schemaVersion：${input.schemaVersion}`)
  if (typeof input.id !== 'string' || !ID_PATTERN.test(input.id)) fail('模板 id 需为 2-49 位小写字母/数字/连字符，且以字母或数字开头')
  if (typeof input.name !== 'string' || !NAME_PATTERN.test(input.name.trim())) fail('模板 name 需为 1-81 字符')
  const manifest = {
    schemaVersion: input.schemaVersion, id: input.id, name: input.name.trim(),
    ...(input.description !== undefined ? { description: checkText(input.description, 'description', 500) } : {}),
    ...(typeof input.author === 'string' && input.author ? { author: checkText(input.author, 'author', 100) } : {}),
    revision: Number.isInteger(input.revision) && input.revision > 0 ? input.revision : 1,
    createdAt: typeof input.createdAt === 'string' ? input.createdAt : new Date().toISOString(),
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : new Date().toISOString(),
  }
  const style = input.style && typeof input.style === 'object' && !Array.isArray(input.style) ? input.style : {}
  if (style.theme !== undefined) {
    try { resolveTheme(style.theme) } catch { fail(`style.theme 需是内置主题之一（${style.theme}）`) }
  }
  const normalizedStyle = {}
  if (style.themeFonts !== undefined) normalizedStyle.themeFonts = normalizeThemeFonts(style.themeFonts)
  if (style.pageSize !== undefined) normalizedStyle.pageSize = normalizePageSize(style.pageSize)
  if (style.textStyles !== undefined) normalizedStyle.textStyles = normalizeTextStyles(style.textStyles)
  if (style.fonts !== undefined) normalizedStyle.fonts = normalizeFontRefs(style.fonts)
  if (style.theme !== undefined) normalizedStyle.theme = style.theme
  if (style.brand !== undefined) {
    const brand = style.brand
    if (!brand || typeof brand !== 'object' || Array.isArray(brand)) fail('style.brand 必须是对象')
    const out = {}
    for (const key of ['primaryColor', 'backgroundColor', 'textColor']) {
      if (brand[key] !== undefined && brand[key] !== '') out[key] = checkHex(brand[key], `style.brand.${key}`)
    }
    if (brand.fontFamily !== undefined) {
      const font = String(brand.fontFamily).trim()
      out.fontFamily = fontFamily(font)
    }
    if (brand.name !== undefined) out.name = checkText(brand.name, 'style.brand.name', 100)
    if (brand.footer !== undefined) {
      if (typeof brand.footer !== 'string' || brand.footer.length > 100) fail('style.brand.footer 最多 100 字符')
      out.footer = brand.footer
    }
    if (brand.logo !== undefined) out.logo = checkImageName(brand.logo)
    if (Object.keys(out).length) normalizedStyle.brand = out
  }
  if (style.backgrounds !== undefined) {
    if (!Array.isArray(style.backgrounds) || style.backgrounds.length > MAX_BACKGROUNDS) fail(`style.backgrounds 需为不超过 ${MAX_BACKGROUNDS} 项的数组`)
    const seen = new Set(), backgrounds = []
    for (const [index, bg] of style.backgrounds.entries()) {
      if (!bg || typeof bg !== 'object' || Array.isArray(bg)) fail(`style.backgrounds[${index}] 必须是对象`)
      const type = bg.layoutType ?? (bg.layout ? backgroundTypeOfLayout(bg.layout) : undefined)
      if (!BACKGROUND_TYPES.includes(type)) fail(`style.backgrounds[${index}].layoutType 只支持 ${BACKGROUND_TYPES.join(' / ')}`)
      if (seen.has(type)) fail(`style.backgrounds 有重复的 layoutType：${type}`)
      seen.add(type)
      if (!['contain', 'cover'].includes(bg.fit ?? 'cover')) fail(`style.backgrounds[${index}].fit 只支持 contain / cover`)
      backgrounds.push({ layoutType: type, image: checkImageName(bg.image), fit: bg.fit ?? 'cover' })
    }
    if (backgrounds.length) normalizedStyle.backgrounds = backgrounds
  }
  if (style.layouts !== undefined) {
    const layouts = validateLayouts(style.layouts)
    if (layouts.length) normalizedStyle.layouts = layouts
  }
  manifest.schemaVersion = normalizedStyle.layouts ? TEMPLATE_LAYOUTS_SCHEMA_VERSION : TEMPLATE_SCHEMA_VERSION
  if (Object.keys(normalizedStyle).length) manifest.style = normalizedStyle

  const slidesLike = (list, field, max) => {
    if (!Array.isArray(list) || list.length > max) fail(`${field} 需为不超过 ${max} 页的数组`)
    list.forEach((slide, index) => {
      if (!slide || typeof slide !== 'object' || Array.isArray(slide)) fail(`${field}[${index}] 必须是对象`)
      for (const key of Object.keys(slide)) {
        if (!['layout', 'layoutId', 'title', 'subtitle', 'kicker', 'text', 'bullets', 'rows', 'notes', 'image', 'chart'].includes(key)) fail(`${field}[${index}] 不支持字段 ${key}`)
      }
      if (slide.layoutId !== undefined && (typeof slide.layoutId !== 'string' || !/^[a-z0-9][a-z0-9-]{0,40}$/.test(slide.layoutId))) fail(`${field}[${index}].layoutId 无效`)
      if (slide.title !== undefined) checkText(slide.title, `${field}[${index}].title`, 300)
      if (slide.subtitle !== undefined) checkText(slide.subtitle, `${field}[${index}].subtitle`, 500)
      if (slide.kicker !== undefined) checkText(slide.kicker, `${field}[${index}].kicker`, 200)
      if (slide.text !== undefined) checkText(slide.text, `${field}[${index}].text`, 4000)
      if (slide.notes !== undefined) checkText(slide.notes, `${field}[${index}].notes`, 2000)
      if (slide.bullets !== undefined) {
        if (!Array.isArray(slide.bullets) || slide.bullets.length > 20 || slide.bullets.some(b => typeof b !== 'string' || b.length > 500)) fail(`${field}[${index}].bullets 需为不超过 20 条、每条 500 字符`)
      }
      if (slide.image !== undefined) {
        const image = slide.image
        if (!image || typeof image !== 'object' || Array.isArray(image)) fail(`${field}[${index}].image 必须是对象`)
        checkImageName(image.src)
        if (image.alt !== undefined) checkText(image.alt, `${field}[${index}].image.alt`, 500)
        if (image.fit !== undefined && !['contain', 'cover'].includes(image.fit)) fail(`${field}[${index}].image.fit 只支持 contain / cover`)
      }
      if (slide.chart !== undefined) fail(`${field}[${index}].chart 暂不支持（模板骨架页使用文字布局）`)
    })
  }
  if (input.outline !== undefined) slidesLike(input.outline, 'outline', MAX_OUTLINE)
  if (input.outline?.length) manifest.outline = clone(input.outline)
  if (input.samples !== undefined) slidesLike(input.samples, 'samples', MAX_SAMPLES)
  if (input.samples?.length) manifest.samples = clone(input.samples)

  // 引用完整性：brand.logo / backgrounds[].image / outline/sample 图片需在资产里。
  const referenced = new Set()
  for (const face of manifest.style?.fonts ?? []) referenced.add(face.file)
  if (manifest.style?.brand?.logo) referenced.add(manifest.style.brand.logo)
  for (const bg of manifest.style?.backgrounds ?? []) referenced.add(bg.image)
  for (const name of layoutAssetNames(manifest)) referenced.add(name)
  for (const list of [manifest.outline, manifest.samples]) {
    for (const slide of list ?? []) if (slide.image) referenced.add(slide.image.src)
  }
  const layoutIds = new Set((manifest.style?.layouts ?? []).map(layout => layout.id))
  for (const slide of manifest.outline ?? []) {
    if (slide.layoutId !== undefined && !layoutIds.has(slide.layoutId)) fail(`outline 引用了不存在的版式：${slide.layoutId}`)
  }
  if (templateAssets !== undefined) {
    for (const name of referenced) {
      if (!templateAssets[name]) fail(`模板资产缺失：assets/${name}`)
      if (FONT_EXT.test(name)) { fontInfo(templateAssets[name].bytes); continue }
      const vector = templateAssets[name].mime === 'image/svg+xml'
      if (vector !== /\.svg$/i.test(name)) fail(`模板资产类型与文件名不符：${name}`)
    }
  }
  return manifest
}

function layoutAssetNames(manifest) {
  const names = Object.values(manifest.assetMap ?? {}).map(a => a.file)
  for (const layout of manifest.style?.layouts ?? []) {
    if (layout.background) names.push(layout.background.image)
    for (const image of layout.images ?? []) { names.push(image.image); if (image.svg) names.push(image.svg) }
  }
  return names
}

/** 汇总模板元信息（列表/工具输出用），不携带资产。 */
export function summarizeTemplate(manifest) {
  const style = manifest.style ?? {}
  return {
    id: manifest.id, name: manifest.name, description: manifest.description ?? '',
    author: manifest.author ?? '', revision: manifest.revision,
    createdAt: manifest.createdAt, updatedAt: manifest.updatedAt,
    theme: style.theme ?? null,
    brand: style.brand ? Object.fromEntries(Object.entries(style.brand).filter(([k]) => k !== 'logo')) : null,
    hasLogo: Boolean(style.brand?.logo),
    backgrounds: (style.backgrounds ?? []).map(bg => ({ layoutType: bg.layoutType, fit: bg.fit })),
    layouts: (style.layouts ?? []).map(layout => ({ id: layout.id, name: layout.name ?? layout.id, layoutType: layout.layoutType, imageCount: layout.images?.length ?? layout.elements?.filter(e => e.type === 'image').length ?? 0, hasBackground: Boolean(layout.background) })),
    outlineCount: manifest.schemaVersion === 3 ? manifest.style.layouts.length : manifest.outline?.length ?? 0,
    sampleCount: manifest.samples?.length ?? 0,
    outlineTitles: (manifest.outline ?? []).map(s => s.title ?? '').slice(0, 12),
    assetCount: countTemplateAssets(manifest),
  }
}

export function countTemplateAssets(manifest) {
  const names = new Set()
  for (const face of manifest.style?.fonts ?? []) names.add(face.file)
  if (manifest.style?.brand?.logo) names.add(manifest.style.brand.logo)
  for (const bg of manifest.style?.backgrounds ?? []) names.add(bg.image)
  for (const name of layoutAssetNames(manifest)) names.add(name)
  for (const list of [manifest.outline, manifest.samples]) {
    for (const slide of list ?? []) if (slide.image) names.add(slide.image.src)
  }
  return names.size
}

// ---------------------------------------------------------------------------
// 资产
// ---------------------------------------------------------------------------

function imageInfo(bytes) {
  let width, height, mime
  const head = bytes.subarray(0, 64).toString('utf8').trimStart()
  if (head.startsWith('<')) {
    if (!sanitizeSvg(bytes)) fail('SVG 含脚本/外链或体积超过 300 KiB，已拒绝')
    return { width: 0, height: 0, mime: 'image/svg+xml' }
  }
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    if (bytes.length < 45 || bytes.toString('ascii', 12, 16) !== 'IHDR') fail('PNG 文件不完整')
    width = bytes.readUInt32BE(16); height = bytes.readUInt32BE(20); mime = 'image/png'
    let offset = 8, ended = false; const compressed = []
    while (offset + 12 <= bytes.length) {
      const length = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8)
      if (offset + length + 12 > bytes.length) fail('PNG 数据截断')
      if (type === 'IDAT') compressed.push(bytes.subarray(offset + 8, offset + 8 + length))
      if (type === 'IEND') { ended = true; break }
      offset += length + 12
    }
    if (!ended || compressed.length === 0) fail('PNG 缺少图像数据')
    try { inflateSync(Buffer.concat(compressed), { maxOutputLength: 128 * 1024 * 1024 }) } catch { fail('PNG 图像数据无法解码或过大') }
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    mime = 'image/jpeg'
    if (!bytes.subarray(-2).equals(Buffer.from([0xff, 0xd9]))) fail('JPEG 文件不完整')
    let offset = 2
    while (offset + 4 < bytes.length) {
      if (bytes[offset] !== 0xff) break
      while (bytes[offset] === 0xff) offset++
      const marker = bytes[offset++]
      if (marker === 0xd9 || marker === 0xda) break
      if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue
      const length = bytes.readUInt16BE(offset)
      if (length < 2 || offset + length > bytes.length) fail('JPEG 数据截断')
      if ([0xc0, 0xc1, 0xc2].includes(marker) && length >= 7) { height = bytes.readUInt16BE(offset + 3); width = bytes.readUInt16BE(offset + 5) }
      offset += length
    }
  } else fail('模板图片仅支持 PNG / JPEG')
  if (!width || !height || width > 16000 || height > 16000 || width * height > 32_000_000) fail('模板图片尺寸无效或超过 3200 万像素')
  return { width, height, mime }
}

/** 模板资产表：name → { bytes, mime, width, height, data(data URI) } */
export function normalizeTemplateAssets(input = {}) {
  const assets = {}
  let total = 0, fontTotal = 0
  for (const [name, value] of Object.entries(input)) {
    const isFont = FONT_EXT.test(name), limit = isFont ? MAX_FONT : MAX_ASSET
    if (!FILE_PATTERN.test(name) || !ASSET_EXT.test(name)) fail(`资产文件名不合法：${name}（需 assets/ 下的 PNG/JPEG/SVG）`)
    let bytes
    if (value && typeof value === 'object' && Buffer.isBuffer(value)) bytes = value
    else if (value && typeof value === 'object' && value.bytes) bytes = Buffer.from(value.bytes)
    else if (typeof value === 'string' && value.startsWith('data:')) {
      const match = /^data:(?:image\/(png|jpeg|svg\+xml)|font\/(ttf|otf)|application\/(x-fontdata));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(value)
      if (!match) fail(`模板资产 ${name} 的 data URI 无效`)
      bytes = Buffer.from(match[4], 'base64')
    } else if (typeof value === 'string') {
      const path = resolve(String(value))
      let size
      try { size = statSync(path).size } catch { fail(`模板资产文件不存在：${value}`) }
      if (size > limit) fail(`Asset exceeds ${limit} bytes: ${name}`)
      bytes = readFileSync(path)
    } else fail(`模板资产 ${name} 类型无效`)
    if (bytes.length > limit) fail(`Asset exceeds ${isFont ? 12 : 5} MiB: ${name}`)
    if (isFont) fontTotal += bytes.length
    else total += bytes.length
    if (fontTotal > MAX_FONTS) fail('Template fonts exceed 32 MiB')
    if (total > MAX_TEMPLATE_ASSETS) fail('模板资产总量超过 8 MiB，请压缩图片')
    const info = isFont ? { mime: fontInfo(bytes).mime } : imageInfo(bytes)
    assets[name] = { ...info, bytes, data: `data:${info.mime};base64,${bytes.toString('base64')}` }
  }
  return assets
}

// ---------------------------------------------------------------------------
// bundle 读写（ZIP 或裸 JSON）
// ---------------------------------------------------------------------------

function bundleEntries(template, assets) {
  const manifestText = JSON.stringify(template, null, 2) + '\n'
  if (Buffer.byteLength(manifestText) > MAX_TEMPLATE_JSON) fail('template.json 超过 1 MiB')
  const entries = { [TEMPLATE_JSON]: strToU8(manifestText) }
  for (const [name, asset] of Object.entries(assets)) entries[ASSETS_PREFIX + name] = new Uint8Array(asset.bytes)
  entries['README.txt'] = strToU8('dsh-ppt template bundle v1 / Шаблон dsh-ppt v1\n\n' +
    'template.json — 模板清单 / манифест шаблона\nassets/ — PNG/JPEG 资产 / изображения\n\n' +
    'Import in DSH via ppt_template { operation: "import" } or the Шаблоны panel.\n')
  return entries
}

/** 导出 bundle：返回 ZIP 字节。 */
export function buildTemplateBundle(template, assets = {}) {
  const checked = validateTemplateManifest(template, { templateAssets: assets })
  return Buffer.from(zipSync(bundleEntries(checked, assets), { level: 6 }))
}

/** 把 bundle 写到目录：<dir>/<id>-template-v<revision>.zip */
export function writeTemplateBundle(dir, template, assets = {}) {
  const checked = validateTemplateManifest(template, { templateAssets: assets })
  const zip = buildTemplateBundle(checked, assets)
  mkdirSync(resolve(String(dir)), { recursive: true })
  const path = resolve(String(dir), `${checked.id}-template-v${checked.revision}.zip`)
  writeFileSync(path, zip)
  return { path, bytes: zip.length }
}

function entryName(name) {
  if (typeof name !== 'string') return null
  const normalized = name.replace(/\\/g, '/')
  if (normalized.startsWith('/') || normalized.includes('..') || normalized.includes(':')) return null
  if (normalized === TEMPLATE_JSON) return TEMPLATE_JSON
  if (!normalized.startsWith(ASSETS_PREFIX)) return null
  const rest = normalized.slice(ASSETS_PREFIX.length)
  return FILE_PATTERN.test(rest) && ASSET_EXT.test(rest) ? rest : null
}

/** 读取 bundle（.zip 或裸 template.json）→ { manifest, assets } */
export function readTemplateBundle(source, { cwd } = {}) {
  const path = resolve(cwd ?? '.', String(source ?? ''))
  if (!existsSync(path)) fail(`模板文件不存在：${source}`)
  const ext = extname(path).toLowerCase()
  if (ext === '.json') {
    const text = readFileSync(path, 'utf8')
    if (Buffer.byteLength(text) > MAX_TEMPLATE_JSON) fail('template.json 超过 1 MiB')
    let parsed
    try { parsed = JSON.parse(text) } catch { fail('template.json 无法解析：' + path) }
    return { manifest: validateTemplateManifest(parsed), assets: {} }
  }
  if (ext !== '.zip') fail('模板 bundle 需为 .zip 或 template.json：' + source)
  const bytes = readFileSync(path)
  if (bytes.length > MAX_BUNDLE_INPUT) fail('模板 bundle 超过 64 MiB')
  let entries
  try { entries = unzipTemplate(bytes) } catch (error) { fail('模板 ZIP 无法解压：' + error.message) }
  return readTemplateEntries(entries)
}

/** 从内存中的 ZIP 字节读取 bundle（面板上传/工具 data 用）。 */
export function readTemplateZip(bytes) {
  if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes)
  if (bytes.byteLength > MAX_BUNDLE_INPUT) fail('模板 bundle 超过 64 MiB')
  let entries
  try { entries = unzipTemplate(bytes) } catch (error) { fail('模板 ZIP 无法解压：' + error.message) }
  return readTemplateEntries(entries)
}

/** 从已解压的 ZIP 条目读取 bundle。 */
function unzipTemplate(bytes) {
  let total = 0
  return unzipSync(new Uint8Array(bytes), { filter: entry => {
    total += entry.originalSize
    if (total > MAX_BUNDLE_UNPACKED) fail('Template ZIP exceeds 64 MiB unpacked')
    return true
  } })
}

export function readTemplateEntries(entries) {
  const names = Object.keys(entries)
  let total = 0
  for (const name of names) {
    total += entries[name].length
    if (total > MAX_BUNDLE_UNPACKED) fail('模板 ZIP 解压后超过 64 MiB')
  }
  const manifestEntry = entries[TEMPLATE_JSON]
  if (!manifestEntry) fail('模板 ZIP 缺少 template.json')
  if (manifestEntry.length > MAX_TEMPLATE_JSON) fail('template.json 超过 1 MiB')
  let parsed
  try { parsed = JSON.parse(strFromU8(manifestEntry)) } catch { fail('template.json 无法解析') }
  const assets = {}
  for (const name of names) {
    if (name === TEMPLATE_JSON) continue
    const assetName = entryName(name)
    if (assetName === null) continue
    assets[assetName] = Buffer.from(entries[name])
  }
  const normalizedAssets = normalizeTemplateAssets(assets)
  const manifest = validateTemplateManifest(parsed, { templateAssets: normalizedAssets })
  return { manifest, assets: normalizedAssets }
}

/** 把模板（清单 + 资产）写成一个模板目录（template.json + assets/*）。 */
export function writeTemplateDir(dir, template, assets = {}) {
  const checked = validateTemplateManifest(template, { templateAssets: assets })
  const root = resolve(String(dir))
  if (basename(root) !== checked.id) fail('模板目录名需与模板 id 一致：' + checked.id)
  mkdirSync(root, { recursive: true })
  if (existsSync(join(root, 'assets')) && readdirSync(join(root, 'assets')).some(name => !assets[name])) {
    fail('目标模板目录已含有其他资产，拒绝覆盖：' + root)
  }
  if (Object.keys(assets).length) {
    mkdirSync(join(root, 'assets'), { recursive: true })
    for (const [name, asset] of Object.entries(assets)) writeFileSync(join(root, 'assets', name), asset.bytes)
  }
  writeFileSync(join(root, TEMPLATE_JSON), JSON.stringify(checked, null, 2) + '\n')
  return root
}

/** 读取模板目录 → { manifest, assets } */
export function readTemplateDir(dir) {
  const root = resolve(String(dir))
  const manifestPath = join(root, TEMPLATE_JSON)
  if (!existsSync(manifestPath)) fail('模板目录缺少 template.json：' + dir)
  const manifest = validateTemplateManifest(JSON.parse(readFileSync(manifestPath, 'utf8')))
  const assetsDir = join(root, 'assets')
  const raw = {}
  if (existsSync(assetsDir)) {
    for (const name of readdirSync(assetsDir)) {
      if (!FILE_PATTERN.test(name) || !ASSET_EXT.test(name)) continue
      raw[name] = readFileSync(join(assetsDir, name))
    }
  }
  const assets = normalizeTemplateAssets(raw)
  validateTemplateManifest(manifest, { templateAssets: assets })
  return { manifest, assets }
}

// ---------------------------------------------------------------------------
// 应用：模板 → 创建 / 重设计参数
// ---------------------------------------------------------------------------

function substitute(value, vars) {
  if (typeof value !== 'string') return value
  let out = value
  for (const [key, replacement] of Object.entries(vars)) out = out.replaceAll(`{{${key}}}`, replacement)
  return out
}
function applyVars(slide, vars) {
  const out = {}
  for (const [key, value] of Object.entries(slide)) {
    if (typeof value === 'string') out[key] = substitute(value, vars)
    else if (Array.isArray(value)) out[key] = value.map(item => typeof item === 'string' ? substitute(item, vars) : item)
    else if (value && typeof value === 'object') out[key] = { ...value, ...(value.src !== undefined ? { src: substitute(value.src, vars) } : {}) }
    else out[key] = value
  }
  return out
}

/** style.backgrounds + style.layouts → 引擎 style 参数（src 为 data URI；SVG 以 data URI 放入图片的 svg 字段）。 */
function engineStyle(manifest, assets) {
  const out = {}
  if (manifest.style?.themeFonts) out.themeFonts = clone(manifest.style.themeFonts)
  if (manifest.style?.pageSize) out.pageSize = clone(manifest.style.pageSize)
  if (manifest.style?.textStyles) out.textStyles = clone(manifest.style.textStyles)
  if (manifest.style?.fonts) out.fonts = manifest.style.fonts.map(face => ({ family: face.family, variant: face.variant, src: assets[face.file]?.data }))
  const backgrounds = manifest.style?.backgrounds ?? []
  if (backgrounds.length) out.backgrounds = backgrounds.map(bg => ({ layoutType: bg.layoutType, src: assets[bg.image]?.data, fit: bg.fit }))
  const layouts = manifest.style?.layouts ?? []
  if (layouts.length) {
    out.layouts = layouts.map(layout => ({
      id: layout.id, ...(layout.familyId ? { familyId: layout.familyId } : {}), ...(layout.name ? { name: layout.name } : {}), layoutType: layout.layoutType,
      ...(layout.background ? { background: { src: assets[layout.background.image]?.data, fit: layout.background.fit } } : {}),
      ...(layout.backgroundColor ? { backgroundColor: layout.backgroundColor } : {}),
      images: layout.images.map(image => ({
        src: assets[image.image]?.data, x: image.x, y: image.y, w: image.w, h: image.h, z: image.z, fit: image.fit,
        ...(image.role ? { role: image.role } : {}), ...(image.svg ? { svg: assets[image.svg]?.data } : {}),
      })),
      ...(layout.textZones ? { textZones: layout.textZones } : {}),
      ...(layout.textStyles ? { textStyles: clone(layout.textStyles) } : {}),
    }))
  }
  return Object.keys(out).length ? out : undefined
}
function withDesignLayout(slide) {
  const { layoutId, ...rest } = slide
  return layoutId ? { ...rest, designLayout: layoutId } : rest
}

/**
 * 模板 → buildDeckAsync 参数：theme/brand/style/slides。
 * options: { title, includeSamples=true, lang }
 */
export function templateCreateOptions(template, assets, options = {}) {
  const manifest = validateTemplateManifest(template, { templateAssets: assets })
  if (manifest.schemaVersion === 3) return sceneTemplateCreate(manifest,assets,options)
  const title = String(options.title ?? '').trim()
  if (!title) fail('创建演示文稿需要标题')
  const lang = options.lang ?? 'zh'
  const vars = { 'deck.title': title }
  const outline = (manifest.outline ?? []).map(slide => withDesignLayout(applyVars(slide, vars)))
  const samples = options.includeSamples === false ? [] : (manifest.samples ?? []).map(slide => withDesignLayout(applyVars(slide, vars)))
  const slides = [...outline, ...samples]
  if (!slides.length) fail('模板没有页面骨架（outline）也没有示例页（samples），无法创建演示文稿')
  const create = { title, slides, ...(manifest.style?.theme ? { theme: manifest.style.theme } : {}) }
  const brandSource = manifest.style?.brand
  if (brandSource) {
    const brand = {}
    for (const key of ['primaryColor', 'backgroundColor', 'textColor', 'fontFamily', 'name', 'footer']) {
      if (brandSource[key] !== undefined) brand[key] = brandSource[key]
    }
    if (brandSource.logo && assets[brandSource.logo]) brand.logo = assets[brandSource.logo].data
    if (Object.keys(brand).length) create.brand = brand
  }
  const styled = engineStyle(manifest, assets)
  if (styled) create.style = styled
  return { create, lineage: { id: manifest.id, revision: manifest.revision } }
}

/**
 * Шаблон → аргументы HTML-превью (previewDeckHtml): фиксированный мини-дек из пяти страниц
 * (обложка, раздел, список, тезис, финал) в стиле шаблона. Показывает тему, палитру, шрифт,
 * логотип, футер и фоны по типам страниц, не зависит от каркаса и образцов шаблона.
 */
export function templatePreviewOptions(template, assets, options = {}) {
  const manifest = validateTemplateManifest(template, { templateAssets: assets })
  if (manifest.schemaVersion === 3) return {...sceneTemplateCreate(manifest,assets,{...options,title:manifest.name}).create,lang:options.lang??'ru'}
  const lang = options.lang ?? 'ru'
  const slides = [
    { layout: 'cover', kicker: L(lang, '模板预览', 'Template preview', 'Предпросмотр шаблона'), title: manifest.name,
      subtitle: manifest.description || L(lang, '副标题与日期', 'Subtitle and date', 'Подзаголовок и дата') },
    { layout: 'section', kicker: '01', title: L(lang, '章节标题', 'Section title', 'Заголовок раздела'),
      subtitle: L(lang, '一句话说明本章节', 'One line about this section', 'Одна строка о содержании раздела') },
    { layout: 'bullets', title: L(lang, '内容页标题', 'Content slide title', 'Заголовок слайда'),
      bullets: [L(lang, '第一条要点', 'First key point', 'Первый ключевой тезис'), L(lang, '第二条要点', 'Second key point', 'Второй ключевой тезис'), L(lang, '第三条要点', 'Third key point', 'Третий ключевой тезис')] },
    { layout: 'statement', kicker: L(lang, '核心观点', 'Core idea', 'Главная мысль'), title: L(lang, '一句话讲清楚核心结论', 'One sentence with the main conclusion', 'Главный вывод одной фразой'),
      subtitle: L(lang, '补充说明', 'Supporting note', 'Пояснение') },
    { layout: 'closing', title: L(lang, '谢谢', 'Thank you', 'Спасибо'), subtitle: L(lang, '联系方式', 'Contacts', 'Контакты') },
  ]
  // Если у шаблона есть макеты — по одному слайду на каждый макет, чтобы увидеть все фоны и картинки.
  const perLayout = (manifest.style?.layouts ?? []).map(layout => {
    const title = layout.name ?? layout.id
    const base = { layoutId: layout.id, title }
    if (layout.layoutType === 'cover') return { ...base, layout: 'cover', subtitle: manifest.description || L(lang, '副标题与日期', 'Subtitle and date', 'Подзаголовок и дата') }
    if (layout.layoutType === 'section') return { ...base, layout: 'section', kicker: '01', subtitle: L(lang, '一句话说明本章节', 'One line about this section', 'Одна строка о содержании раздела') }
    if (layout.layoutType === 'closing') return { ...base, layout: 'closing', subtitle: L(lang, '联系方式', 'Contacts', 'Контакты') }
    return { ...base, layout: 'bullets', bullets: [L(lang, '第一条要点', 'First key point', 'Первый ключевой тезис'), L(lang, '第二条要点', 'Second key point', 'Второй ключевой тезис')] }
  })
  const { create } = templateCreateOptions({ ...manifest, outline: perLayout.length ? perLayout : slides, samples: undefined }, assets, { title: manifest.name, lang })
  return { ...create, lang }
}

/** 模板 → editDeck 参数（重设计）：theme/brand/style。 */
export function templateRestyleOptions(template, assets) {
  const manifest = validateTemplateManifest(template, { templateAssets: assets })
  if (manifest.schemaVersion === 3) return {restyle:{convertToScene:true,theme:manifest.style.theme,assets:sceneTemplateAssets(manifest,assets),style:{pageSize:manifest.style.pageSize,themeFonts:manifest.style.themeFonts,...(manifest.style.fonts?.length?{fonts:manifest.style.fonts.map(f=>({family:f.family,variant:f.variant,src:assets[f.file].data}))}:{}),sceneLayouts:manifest.style.layouts}},lineage:{id:manifest.id,revision:manifest.revision}}
  const restyle = {}
  if (manifest.style?.theme) restyle.theme = manifest.style.theme
  const brandSource = manifest.style?.brand
  if (brandSource) {
    const brand = {}
    for (const key of ['primaryColor', 'backgroundColor', 'textColor', 'fontFamily', 'name', 'footer']) {
      if (brandSource[key] !== undefined) brand[key] = brandSource[key]
    }
    if (brandSource.logo && assets[brandSource.logo]) brand.logo = assets[brandSource.logo].data
    if (Object.keys(brand).length) restyle.brand = brand
  }
  const styled = engineStyle(manifest, assets)
  if (styled) restyle.style = styled
  if (!Object.keys(restyle).length) fail('模板没有可应用的样式（theme / brand / 背景）')
  return { restyle, lineage: { id: manifest.id, revision: manifest.revision } }
}

/** 项目 → 模板清单 + 资产。manifest 为 dsh-ppt 工程 manifest（含 assets）。 */
export function templateFromDeckManifest(deckManifest, options = {}) {
  if (deckManifest.slides?.every(s => s.layout === 'scene')) return templateFromSceneManifest(deckManifest,options)
  const lang = options.lang ?? deckManifest.language ?? 'zh'
  const id = options.templateId
  if (!id || !ID_PATTERN.test(id)) fail('templateId 需为 2-49 位小写字母/数字/连字符')
  const name = String(options.name ?? '').trim()
  if (!name) fail('需要模板名称')
  const assetsInput = {}
  const deckAssets = deckManifest.assets ?? {}
  const brand = deckManifest.brand ?? {}
  if (brand.logoAssetId && deckAssets[brand.logoAssetId]) assetsInput['logo.png'] = dataUriBytes(deckAssets[brand.logoAssetId].data, 'logo')
  const style = { theme: deckManifest.theme }
  if (deckManifest.style?.themeFonts) style.themeFonts = clone(deckManifest.style.themeFonts)
  if (deckManifest.style?.pageSize) style.pageSize = clone(deckManifest.style.pageSize)
  if (deckManifest.style?.textStyles) style.textStyles = clone(deckManifest.style.textStyles)
  if (deckManifest.style?.fonts?.length) style.fonts = deckManifest.style.fonts.map((face, i) => {
    const asset = deckAssets[face.assetId]
    const bytes = Buffer.from(asset.data.split(',')[1], 'base64'), info = fontInfo(bytes)
    const file = `font-${i + 1}.${info.mime === 'application/x-fontdata' ? 'fntdata' : info.mime === 'font/otf' ? 'otf' : 'ttf'}`
    assetsInput[file] = bytes
    return { family: face.family, variant: face.variant, file }
  })
  const normalizedBrand = {}
  for (const key of ['primaryColor', 'backgroundColor', 'textColor', 'fontFamily', 'name', 'footer']) {
    if (brand[key] !== undefined) normalizedBrand[key] = brand[key]
  }
  if (assetsInput['logo.png']) normalizedBrand.logo = 'logo.png'
  if (Object.keys(normalizedBrand).length) style.brand = normalizedBrand
  // Макеты проекта (картинки с положением) переходят в шаблон вместе с файлами.
  const deckLayouts = deckManifest.style?.layouts ?? []
  if (deckLayouts.length) {
    const nameOf = (assetId, stem) => {
      const asset = deckAssets[assetId]
      if (!asset?.data) return undefined
      const match = /^data:image\/(png|jpeg|svg\+xml);base64,/.exec(asset.data)
      const ext = match?.[1] === 'jpeg' ? 'jpg' : match?.[1] === 'svg+xml' ? 'svg' : 'png'
      const name = `${stem}.${ext}`
      assetsInput[name] = Buffer.from(asset.data.split(',')[1], 'base64')
      return name
    }
    style.layouts = deckLayouts.map((layout, li) => {
      const entry = { id: layout.id, ...(layout.familyId ? { familyId: layout.familyId } : {}), ...(layout.name ? { name: layout.name } : {}), layoutType: layout.layoutType, images: [] }
      const bg = layout.backgroundAssetId && nameOf(layout.backgroundAssetId, `layout-${li + 1}-bg`)
      if (bg) entry.background = { image: bg, fit: layout.fit ?? 'cover' }
      if (layout.backgroundColor) entry.backgroundColor = layout.backgroundColor
      for (const [ii, image] of (layout.images ?? []).entries()) {
        const file = nameOf(image.assetId, `layout-${li + 1}-img-${ii + 1}`)
        if (!file) continue
        const item = { image: file, x: image.x, y: image.y, w: image.w, h: image.h, z: image.z, fit: image.fit, ...(image.role ? { role: image.role } : {}) }
        if (image.svg) { const raw = Buffer.from(image.svg.split(',')[1], 'base64'); const svgName = `layout-${li + 1}-img-${ii + 1}.svg`; assetsInput[svgName] = raw; item.svg = svgName }
        entry.images.push(item)
      }
      if (layout.textZones) entry.textZones = layout.textZones
      if (layout.textStyles) entry.textStyles = clone(layout.textStyles)
      return entry
    })
  }

  const keepTitle = slide => {
    const title = String(slide.title ?? '').trim()
    return title && !/待填写|To fill:|Заполнить:/i.test(title) ? title : undefined
  }
  const outline = deckManifest.slides.map((slide, index) => {
    // Обложка всегда получает заголовок новой презентации
    const title = index === 0 ? '{{deck.title}}' : (keepTitle(slide) ?? placeholder(lang, 'страницы'))
    const entry = { layout: slide.layout, title }
    if (slide.designLayout && style.layouts?.some(item => item.id === slide.designLayout)) entry.layoutId = slide.designLayout
    if (slide.kicker) entry.kicker = slide.kicker
    if (slide.layout === 'bullets') entry.bullets = [placeholder(lang, 'конкретные факты, доказательства и следующий шаг')]
    else if (slide.subtitle && index !== 0) entry.subtitle = placeholder(lang, 'дополнение')
    return entry
  })
  const samples = options.includeSamples === false ? [] : deckManifest.slides
    .filter(slide => slide.image || slide.chart || (slide.bullets?.length && !slide.bullets.some(b => /待填写|To fill:|Заполнить:/i.test(b))) || slide.rows?.length)
    .slice(0, 3)
    .map(slide => {
      const sample = { layout: slide.layout, title: String(slide.title ?? '') }
      for (const key of ['subtitle', 'kicker', 'text']) if (slide[key]) sample[key] = slide[key]
      if (slide.bullets) sample.bullets = slide.bullets
      if (slide.rows) sample.rows = slide.rows
      if (slide.image?.assetId && deckAssets[slide.image.assetId]) {
        const name2 = `sample-${sampleAssetsCount(assetsInput) + 1}.png`
        const bytes = dataUriBytes(deckAssets[slide.image.assetId].data, '示例图片')
        assetsInput[name2] = bytes
        sample.image = { src: name2, alt: slide.image.alt ?? '示例图片', fit: slide.image.fit ?? 'contain' }
        sample.layout = ['image', 'image-left', 'image-right'].includes(sample.layout) ? sample.layout : 'image-right'
      }
      return sample
    })
    .filter(sample => sample.image || sample.bullets?.length || sample.rows?.length || sample.text)
  const manifest = {
    schemaVersion: TEMPLATE_SCHEMA_VERSION, id, name,
    ...(options.description ? { description: String(options.description) } : {}),
    ...(options.author ? { author: String(options.author) } : {}),
    revision: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    style, outline, ...(samples.length ? { samples } : {}),
  }
  const templateAssets = normalizeTemplateAssets(assetsInput)
  return { manifest: validateTemplateManifest(manifest, { templateAssets }), assets: templateAssets }
}
function sampleAssetsCount(assets) { return Object.keys(assets).filter(name => name.startsWith('sample-')).length }
function dataUriBytes(dataUri, label) {
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(String(dataUri ?? ''))
  if (!match) fail(`${label} 的嵌入图片无效`)
  return Buffer.from(match[2], 'base64')
}

// ---------------------------------------------------------------------------
// 从 PPTX 示例提取模板（样式，不复制几何）
// ---------------------------------------------------------------------------

function hexLuminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722
}
function mixHex(a, b, weight) {
  const pa = a.slice(1).match(/../g).map(v => parseInt(v, 16))
  const pb = b.slice(1).match(/../g).map(v => parseInt(v, 16))
  const mix = pa.map((v, i) => Math.round(v * (1 - weight) + pb[i] * weight))
  return '#' + mix.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase()
}
const normalizeSlot = value => {
  const raw = String(value ?? '').trim()
  if (!/^#[\da-fA-F]{6}$/.test(raw) && !/^#[\da-fA-F]{3}$/.test(raw)) return null
  const hex = raw.length === 4 ? '#' + raw.slice(1).split('').map(c => c + c).join('') : raw
  return hex.toUpperCase()
}

/** 主色调启发式：母版上第一张小图（≤ 22% 宽 / ≤ 30% 高，≤ 5 MiB）。 */
function pickLogoShape(pres, lib, slideSize, masterShapes) {
  for (const shape of masterShapes) {
    if (!lib.hasShapeImage(shape)) continue
    const bounds = lib.getShapeBoundsResolved(pres, shape)
    if (!bounds) continue
    const widthRatio = Number(bounds.w) / Number(slideSize.width), heightRatio = Number(bounds.h) / Number(slideSize.height)
    if (widthRatio > 0.22 || heightRatio > 0.3 || widthRatio <= 0 || heightRatio <= 0) continue
    const bytes = lib.getShapeImageBytes(shape)
    if (!bytes || bytes.length > MAX_ASSET) continue
    return { bytes }
  }
  return null
}

/**
 * 从 PPTX 提取模板：主题色、字体、母版/版式背景、候选 Logo、页面骨架。
 * 返回 { manifest, assets, report }；不落盘。
 */
export async function templateFromPptx(source, options = {}) {
  if (options.model === 'scene') return templateFromPptxScene(source,options)
  const id = options.templateId
  if (!id || !ID_PATTERN.test(id)) fail('templateId 需为 2-49 位小写字母/数字/连字符')
  const name = String(options.name ?? '').trim()
  if (!name) fail('需要模板名称')
  const lang = options.lang ?? 'zh'
  let bytes
  if (Buffer.isBuffer(source)) bytes = source
  else {
    const path = resolve(String(source ?? ''))
    let size
    try { size = statSync(path).size } catch { fail(`PPTX 文件不存在：${source}`) }
    if (size > 64 * 1024 * 1024) fail('PPTX 超过 64 MiB')
    bytes = readFileSync(path)
  }
  let lib
  try { lib = await import('@office-kit/pptx') } catch (error) {
    fail('提取模板需要 @office-kit/pptx@0.21.0。插件请重新安装；独立技能请在技能目录运行 npm install --ignore-scripts。' + error.message)
  }
  const pres = await lib.loadPresentation(new Uint8Array(bytes))
  const report = { colors: [], fonts: null, masterBackground: false, layoutBackgrounds: 0, logo: null, warnings: [] }

  // 1) 主题色 → dsh-ppt 品牌色
  const theme = lib.getPresentationTheme(pres)
  const style = { themeFonts: normalizeThemeFonts(lib.getPresentationFonts(pres)) }
  if (theme) {
    const slots = [normalizeSlot(theme.dark1), normalizeSlot(theme.light1), normalizeSlot(theme.accent1), normalizeSlot(theme.accent2)]
    const [dark1, light1, accent1, accent2] = slots
    if (dark1 && light1) {
      const bgIsLight = hexLuminance(light1) >= hexLuminance(dark1)
      const bg = bgIsLight ? light1 : dark1
      const fg = bgIsLight ? dark1 : light1
      const brand = { primaryColor: accent1 ?? mixHex(bg, fg, 0.55), backgroundColor: bg, textColor: fg }
      // dsh-ppt 主题需要 panel/muted；由主题本身按这几个色派生，这里不塞额外色
      report.colors = { bg, fg, accent1, accent2, dark1, light1 }
      style.theme = 'data'
      style.brand = brand
    } else report.warnings.push(L(lang, 'PPTX 没有可用的主题色板，使用默认主题', 'PPTX carries no usable color map; default theme kept', 'В PPTX нет палитры темы — оставлена тема по умолчанию'))
  } else {
    report.warnings.push(L(lang, 'PPTX 没有主题，使用默认主题', 'PPTX has no theme part; default theme kept', 'В PPTX нет темы — оставлена тема по умолчанию'))
  }

  // 2) 字体
  const fonts = lib.getPresentationFonts(pres)
  if (fonts) {
    const family = fonts.majorLatin || fonts.minorLatin || fonts.majorEastAsian || fonts.minorEastAsian
    if (family && /^[\p{L}\p{N} _-]{1,80}$/u.test(family)) {
      style.brand = { ...(style.brand ?? {}), fontFamily: family }
      report.fonts = { major: fonts.majorLatin, minor: fonts.minorLatin, picked: family }
    } else if (family) report.warnings.push(L(lang, `字体 ${family} 名称不合规，未采用`, `Font "${family}" has an unsupported name; skipped`, `Шрифт «${family}» имеет неподходящее имя — не принят`))
  }

  // 3a) Макеты с картинками и положением (новая модель). Если ничего не нашлось — старый путь (фон + логотип).
  const slideSize = lib.getSlideSize(pres) ?? { width: 9144000, height: 6858000 }
  style.pageSize = normalizePageSize({ width: Number(slideSize.width), height: Number(slideSize.height) })
  const assets = {}
  let layoutIdBySlide = new Map()
  let layoutIdByPart = new Map()
  try {
    const found = await extractPptxLayouts({ pres, lib, bytes, slideSize, theme, assets, report, lang })
    const useful = found.layouts.length > 0
    if (useful) { style.layouts = found.layouts; layoutIdByPart = found.layoutIdByPart; layoutIdBySlide = found.layoutIdBySlide }
    else for (const key of Object.keys(assets)) if (!FONT_EXT.test(key)) delete assets[key]
  } catch (error) {
    report.warnings.push(L(lang, `版式提取失败：${error.message}`, `Layout extraction failed: ${error.message}`, `Не удалось извлечь макеты: ${error.message}`))
    for (const key of Object.keys(assets)) if (!FONT_EXT.test(key)) delete assets[key]
  }

  try { Object.assign(style, extractTypography(bytes, style.layouts ?? [], layoutIdByPart, assets, report)) }
  catch (error) { report.warnings.push(`Не удалось извлечь оформление текста и шрифты: ${error.message}`) }

  // 3) 母版 / 版式背景（旧路径，仅当没有可用版式）
  const layouts = style.layouts ? [] : [...new Map(lib.getSlides(pres).map(slide => lib.getSlideLayout(slide)).filter(Boolean).map(layout => [lib.getSlideLayoutPartName(layout), layout])).values()]
  const masterBytes = new Map(), layoutBytesList = []
  for (const layout of layouts) {
    const master = lib.getSlideMasterBackgroundImageBytes(pres, layout)
    if (master) masterBytes.set(bytesKey(master), master)
    const layoutBg = lib.getSlideLayoutBackgroundImageBytes(pres, layout)
    if (layoutBg) layoutBytesList.push(layoutBg)
  }
  const master = [...masterBytes.values()][0]
  if (master) {
    const name = uniqueAssetName(assets, guessPngName(master))
    assets[name] = Buffer.from(master)
    style.backgrounds = [{ layoutType: 'content', image: name, fit: 'cover' }]
    report.masterBackground = true
  }
  if (layoutBytesList.length) {
    const name = uniqueAssetName(assets, guessPngName(layoutBytesList[0]))
    assets[name] = Buffer.from(layoutBytesList[0])
    style.backgrounds = [{ layoutType: 'cover', image: name, fit: 'cover' }, ...(style.backgrounds ?? [])]
    report.layoutBackgrounds = layoutBytesList.length
  }

  // 4) Logo：母版/版式上的小图
  if (layouts.length) {
    const masterShapes = lib.getSlideMasterShapes(pres, layouts[0])
    const logo = pickLogoShape(pres, lib, slideSize, masterShapes)
    if (logo) {
      const name = uniqueAssetName(assets, guessPngName(logo.bytes).replace('bg', 'logo'))
      assets[name] = Buffer.from(logo.bytes)
      style.brand = { ...(style.brand ?? {}), logo: name }
      report.logo = { bytes: logo.bytes.length }
    } else report.warnings.push(L(lang, '母版上没有找到合适的小图作为 Logo', 'No small master image found to use as a logo', 'На мастере не нашлось маленького изображения для логотипа'))
  }

  // 5) 页面骨架：占位符标题缺失时退回首行文本（许多生成器不用占位符）
  const slides = lib.getSlides(pres)
  const outline = slides.slice(0, MAX_OUTLINE).map((sourceSlide, index) => {
    const sourceLayoutId = slides[index] ? layoutIdBySlide.get(lib.getSlidePartName(slides[index])) : undefined
    const sourceType = style.layouts?.find(item => item.id === sourceLayoutId)?.layoutType
    const layout = sourceType === 'cover' ? 'cover' : sourceType === 'closing' ? 'closing' : sourceType === 'section' ? 'section' : 'bullets'
    // Обложка шаблона всегда получает заголовок новой презентации
    const slide = { layout, ...(sourceLayoutId ? { layoutId: sourceLayoutId } : {}), title: index === 0 ? '{{deck.title}}' : placeholder(lang, 'заголовок страницы') }
    if (layout === 'cover') slide.subtitle = placeholder(lang, 'докладчик и дата')
    else if (layout === 'bullets') slide.bullets = Array.from({ length: Math.max(1, style.layouts?.find(item => item.id === sourceLayoutId)?.textZones?.filter(z => z.kind === 'body').length ?? 0) }, () => placeholder(lang, 'конкретные факты, доказательства и следующий шаг'))
    else if (layout === 'closing') slide.subtitle = placeholder(lang, 'следующий шаг и ответственный')
    else if (layout === 'section') slide.subtitle = placeholder(lang, 'описание раздела')
    return slide
  })
  if (!outline.length) report.warnings.push(L(lang, 'PPTX 没有可读的页面，生成了最小骨架', 'PPTX has no readable slides; minimal outline generated', 'В PPTX нет читаемых страниц — собран минимальный каркас'))
  const finalOutline = outline.length ? outline : [
    { layout: 'cover', title: placeholder(lang, '封面标题'), subtitle: placeholder(lang, '汇报人和日期') },
    { layout: 'bullets', title: placeholder(lang, '本页标题'), bullets: [placeholder(lang, '具体事实、依据与下一步行动')] },
  ]

  const manifest = {
    schemaVersion: TEMPLATE_SCHEMA_VERSION, id, name,
    ...(options.description ? { description: String(options.description) } : {}),
    ...(options.author ? { author: String(options.author) } : {}),
    revision: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    ...(Object.keys(style).length ? { style } : {}),
    outline: finalOutline,
  }
  const templateAssets = normalizeTemplateAssets(assets)
  return { manifest: validateTemplateManifest(manifest, { templateAssets }), assets: templateAssets, report }
}

function guessPngName(u8) {
  const buffer = Buffer.from(u8)
  return buffer[0] === 0xff ? 'bg.jpeg' : 'bg.png'
}
function uniqueAssetName(assets, base) {
  if (!assets[base]) return base
  const dot = base.lastIndexOf('.'), stem = base.slice(0, dot), ext = base.slice(dot)
  for (let i = 2; ; i += 1) if (!assets[`${stem}-${i}${ext}`]) return `${stem}-${i}${ext}`
}

function sceneTemplateAssets(manifest,assets){
  return Object.fromEntries(Object.entries(manifest.assetMap??{}).map(([id,a])=>[id,{mime:a.mime,width:a.width,height:a.height,data:assets[a.file].data??`data:${a.mime};base64,${Buffer.from(assets[a.file].bytes).toString('base64')}`}]))
}
function sceneTemplateCreate(manifest,assets,options){
  const title=String(options.title??'').trim();if(!title)fail('Title is required')
  const bag={...sceneTemplateAssets(manifest,assets),...(options.assets??{})}
  const selections=options.selections??manifest.style.layouts.map(l=>({layoutId:l.id,values:{}}))
  const diagnostics=[]
  const slides=selections.map((selection,i)=>{
    const layout=manifest.style.layouts.find(l=>l.id===selection.layoutId);if(!layout)fail('Unknown layout '+selection.layoutId)
    const filled=fillSceneLayout(layout,selection.values??{},{assets:bag,slideId:'slide-'+(i+1)})
    diagnostics.push(...filled.diagnostics.map(d=>({...d,slide:i+1})));return filled.slide
  })
  return {create:{title,slides,assets:bag,theme:manifest.style.theme??'data',style:{pageSize:manifest.style.pageSize,themeFonts:manifest.style.themeFonts,...(manifest.style.fonts?.length?{fonts:manifest.style.fonts.map(f=>({family:f.family,variant:f.variant,src:assets[f.file].data}))}:{}),sceneLayouts:manifest.style.layouts}},lineage:{id:manifest.id,revision:manifest.revision},diagnostics}
}
export function templateFromSceneManifest(project,options={}){
  const assets={},assetMap={},fonts=[]
  for(const face of project.fonts??project.style?.fonts??[]){const a=project.assets[face.assetId];if(!a?.data)fail('Missing embedded source font');const bytes=Buffer.from(a.data.split(',')[1]??'','base64'),info=fontInfo(bytes),file=face.assetId+(info.mime==='application/x-fontdata'?'.fntdata':info.mime==='font/otf'?'.otf':'.ttf');assets[file]={...info,bytes,data:a.data};fonts.push({family:face.family,variant:face.variant,file})}
  for(const [id,a]of Object.entries(project.assets??{})){
    if(!a?.data?.startsWith('data:image/'))continue
    const bytes=Buffer.from(a.data.split(',')[1]??'','base64'),info=sceneImageInfo(bytes,id),file=id+(info.mime==='image/png'?'.png':'.jpg')
    assets[file]={...info,bytes,data:a.data};assetMap[id]={file,...info}
  }
  const families=new Map()
  const layouts=project.slides.map((s,i)=>{
    const signature=JSON.stringify(s.elements.filter(e=>e.role==='decor').map(({id,source,name,...e})=>e))
    if(!families.has(signature))families.set(signature,'family-'+(families.size+1))
    const elements=structuredClone(s.elements),slots=[]
    for(const e of elements)if(e.role!=='decor'&&['text','image','chart','table'].includes(e.type)){
      const slot={id:'slot-'+e.id,elementId:e.id,type:e.type,name:e.name??e.id,required:true};slots.push(slot);e.slotId=slot.id
      if(e.type==='text'){
        let first=true;for(const p of e.paragraphs)for(const r of p.runs)if(!r.break){r.text=first?'Заполнить: '+(e.name??'текст'):'';first=false}
      }
      if(e.type==='table')for(const c of e.table.cells)for(const p of c.paragraphs)for(const r of p.runs)if(!r.break)r.text='Заполнить:'
      if(e.type==='chart'){e.chart.categories=e.chart.categories.map((_,i)=>'Заполнить: '+(i+1));e.chart.series=e.chart.series.map((s,i)=>({...s,name:'Series '+(i+1),values:s.values.map(()=>1),...(s.pointDataLabels?{pointDataLabels:s.pointDataLabels.map(l=>l?{...l,text:undefined}:null)}:{}),...(s.dataLabels?{dataLabels:{...s.dataLabels,text:undefined}}:{})}))}
      if(e.type==='image'){
        const bytes=solidPng('#EEEEEE'),assetId='img-'+createHash('sha256').update(bytes).digest('hex'),info=sceneImageInfo(bytes,assetId),file=assetId+'.png'
        assets[file]={...info,bytes,data:`data:${info.mime};base64,${bytes.toString('base64')}`};assetMap[assetId]={file,...info};e.assetId=assetId;e.alt='Заполнить: изображение'
      }
    }
    return {id:'layout-'+(i+1),name:s.label||'Layout '+(i+1),familyId:families.get(signature),purpose:s.purpose??'content',...(s.backgroundColor?{backgroundColor:s.backgroundColor}:{}),...(s.backgroundAssetId?{backgroundAssetId:s.backgroundAssetId}:{}),elements,slots}
  })
  const used=new Set(layouts.flatMap(l=>[l.backgroundAssetId,...l.elements.flatMap(e=>[e.assetId,e.previewAssetId])].filter(Boolean)))
  for(const [key,a]of Object.entries(assetMap))if(!used.has(key)){delete assetMap[key];delete assets[a.file]}
  const manifest={schemaVersion:3,id:options.templateId,name:options.name,description:options.description,revision:1,style:{theme:project.theme??'data',pageSize:project.style?.pageSize??project.pageSize,...(project.themeFonts?{themeFonts:project.themeFonts}:{}),...(fonts.length?{fonts}:{}),...(project.sourceTheme?{brand:{primaryColor:project.sourceTheme.accent1,backgroundColor:project.sourceTheme.light1,textColor:project.sourceTheme.dark1}}:{}),layouts},assetMap}
  return {manifest:validateTemplateManifest(manifest,{templateAssets:assets}),assets}
}
export async function templateFromPptxScene(source,options={}){
  const bytes=source instanceof Uint8Array?source:readFileSync(source)
  const imported=await importPptxScenes(bytes,{signal:options.signal})
  const result=templateFromSceneManifest({...imported,theme:'data',style:{pageSize:imported.pageSize}},options)
  return {...result,report:{...imported.report,slideCount:imported.slides.length,layoutCount:result.manifest.style.layouts.length,pageSize:imported.pageSize,warnings:imported.report.warnings}}
}
