// Portable typography and embedded PPTX fonts. Originals are retained for Office;
// EOT/MTX is decoded to sfnt for browsers, without installing system fonts.
import { posix } from 'node:path'
import { createHash } from 'node:crypto'
import { unzipSync, zipSync, strToU8 } from 'fflate'
import { eotToTtf } from 'mtx-decompressor'
import { TEXT_ROLES, fontFamily, normalizeTextStyles, normalizeThemeFonts } from './deck-model.mjs'
export { TEXT_ROLES, fontFamily, normalizeTextStyles, normalizeThemeFonts } from './deck-model.mjs'

export const MAX_FONT = 12 * 1024 * 1024
export const MAX_FONTS = 32 * 1024 * 1024
export const FONT_EXT = /\.(ttf|otf|fntdata)$/i
const variants = ['regular', 'bold', 'italic', 'boldItalic']
const fail = message => { throw new Error('dsh-ppt: ' + message) }
const xml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]))
const decode = value => String(value).replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, s) => s[0] === '#' ? String.fromCodePoint(s[1].toLowerCase() === 'x' ? parseInt(s.slice(2), 16) : Number(s.slice(1))) : ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[s]))
export function normalizeFontRefs(input, engine = false) {
  if (input === undefined) return undefined
  if (!Array.isArray(input) || input.length > 64) fail('At most 64 embedded font faces are allowed')
  const seen = new Set()
  return input.map(raw => {
    const family = fontFamily(raw?.family), variant = raw.variant ?? 'regular'
    if (!variants.includes(variant)) fail('Invalid font variant')
    const key = family.toLowerCase() + ':' + variant
    if (seen.has(key)) fail('Duplicate font face: ' + key)
    seen.add(key)
    if (engine) return { family, variant, ...(raw.assetId ? { assetId: String(raw.assetId) } : { src: raw.src }) }
    if (typeof raw.file !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/.test(raw.file) || !FONT_EXT.test(raw.file)) fail('Invalid font filename')
    return { family, variant, file: raw.file }
  })
}

function sfntInfo(bytes) {
  if (bytes.length < 12 || !(bytes.readUInt32BE(0) === 0x10000 || bytes.toString('ascii', 0, 4) === 'OTTO' || bytes.toString('ascii', 0, 4) === 'true')) fail('Unsupported font data')
  const count = bytes.readUInt16BE(4)
  if (!count || count > 256 || 12 + count * 16 > bytes.length) fail('Invalid font table directory')
  let fsType = 0
  for (let i = 0; i < count; i++) {
    const p = 12 + i * 16, offset = bytes.readUInt32BE(p + 8), length = bytes.readUInt32BE(p + 12)
    if (offset + length > bytes.length) fail('Truncated font table')
    if (bytes.toString('ascii', p, p + 4) === 'OS/2' && length >= 10) fsType = bytes.readUInt16BE(offset + 8)
  }
  return { mime: bytes.toString('ascii', 0, 4) === 'OTTO' ? 'font/otf' : 'font/ttf', fsType }
}

export function fontInfo(input) {
  const bytes = Buffer.from(input)
  if (!bytes.length || bytes.length > MAX_FONT) fail('Font exceeds 12 MiB or is empty')
  const eot = bytes.length >= 82 && bytes.readUInt16LE(34) === 0x504c
  if (!eot) return { ...sfntInfo(bytes), preview: bytes }
  if (bytes.readUInt32LE(0) !== bytes.length) fail('Invalid EOT length')
  const preview = Buffer.from(eotToTtf(bytes, { maxOutputBytes: MAX_FONT }))
  const info = sfntInfo(preview)
  return { mime: 'application/x-fontdata', fsType: bytes.readUInt16LE(32) | info.fsType, subset: Boolean(bytes.readUInt32LE(12) & 1), preview, previewMime: info.mime }
}

// PowerPoint uses EOT in application/x-fontdata parts, even for uncompressed sfnt.
// https://learn.microsoft.com/openspecs/office_standards/ms-oi29500/ea097c57-5794-4624-b08e-017b47051b1d
function officeFont(bytes, face) {
  const info = fontInfo(bytes)
  if (info.mime === 'application/x-fontdata') return bytes
  const fixed = Buffer.alloc(82), chunks = [fixed]
  fixed.writeUInt32LE(0x10000, 8)
  fixed[26] = 1; fixed[27] = /italic/i.test(face.variant) ? 1 : 0
  fixed.writeUInt32LE(/bold/i.test(face.variant) ? 700 : 400, 28)
  fixed.writeUInt16LE(info.fsType, 32); fixed.writeUInt16LE(0x504c, 34)
  const count = bytes.readUInt16BE(4)
  for (let i = 0; i < count; i++) {
    const p = 12 + i * 16, offset = bytes.readUInt32BE(p + 8), length = bytes.readUInt32BE(p + 12), tag = bytes.toString('ascii', p, p + 4)
    if (tag === 'OS/2') {
      if (length >= 42) bytes.copy(fixed, 16, offset + 32, offset + 42)
      if (length >= 58) for (let j = 0; j < 4; j++) fixed.writeUInt32LE(bytes.readUInt32BE(offset + 42 + j * 4), 36 + j * 4)
      if (length >= 86) for (let j = 0; j < 2; j++) fixed.writeUInt32LE(bytes.readUInt32BE(offset + 78 + j * 4), 52 + j * 4)
    }
    if (tag === 'head' && length >= 12) fixed.writeUInt32LE(bytes.readUInt32BE(offset + 8), 60)
  }
  for (const [i, value] of [face.family, face.variant, 'Version 1.0', face.family].entries()) {
    const str = Buffer.from(value, 'utf16le'), size = Buffer.alloc(2)
    size.writeUInt16LE(str.length); chunks.push(size, str)
    if (i < 3) chunks.push(Buffer.alloc(2))
  }
  chunks.push(bytes)
  const data = Buffer.concat(chunks)
  data.writeUInt32LE(data.length, 0); data.writeUInt32LE(bytes.length, 4)
  return data
}

export function fontBytesFromUri(uri) {
  if (typeof uri !== 'string' || uri.length > MAX_FONT * 1.4 + 80) fail('Invalid embedded font URI')
  const m = /^data:(font\/(?:ttf|otf)|application\/x-fontdata);base64,([A-Za-z0-9+/=]+)$/.exec(uri)
  if (!m) fail('Invalid embedded font URI')
  const bytes = Buffer.from(m[2], 'base64'), info = fontInfo(bytes)
  if (bytes.toString('base64') !== m[2] || info.mime !== m[1]) fail('Font encoding or MIME mismatch')
  return bytes
}

export function embedFontAssets(input, assets) {
  let total = 0
  return (normalizeFontRefs(input, true) ?? []).map(face => {
    const bytes = fontBytesFromUri(face.src ?? assets[face.assetId]?.data)
    total += bytes.length
    if (total > MAX_FONTS) fail('Embedded fonts exceed 32 MiB')
    const id = 'font-' + createHash('sha256').update(bytes).digest('hex'), info = fontInfo(bytes)
    if (face.assetId && face.assetId !== id) fail('Font content digest mismatch')
    assets[id] = { mime: info.mime, data: `data:${info.mime};base64,${bytes.toString('base64')}` }
    return { family: face.family, variant: face.variant, assetId: id }
  })
}

// Small namespace-independent XML reader. DTD/entity definitions are never evaluated.
function parse(text) {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) fail('DTD is not supported')
  const root = { name: '', attrs: {}, children: [] }, stack = [root]
  for (const m of text.matchAll(/<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<\/?([\w:.-]+)\b([^>]*?)\s*\/?>/g)) {
    if (!m[1]) continue
    if (m[0][1] === '/') { if (stack.length > 1) stack.pop(); continue }
    const node = { name: m[1].split(':').at(-1), attrs: {}, children: [] }
    for (const a of m[2].matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) node.attrs[a[1]] = decode(a[2] ?? a[3])
    stack.at(-1).children.push(node)
    if (!m[0].endsWith('/>')) stack.push(node)
  }
  return root
}
const child = (node, name) => node?.children.find(n => n.name === name)
function all(node, name) { return (node?.children ?? []).flatMap(n => [...(n.name === name ? [n] : []), ...all(n, name)]) }
const first = (node, name) => all(node, name)[0]
function readXml(files, path) { return parse(Buffer.from(files[path] ?? []).toString('utf8')) }
function relationships(files, part) {
  const rel = posix.join(posix.dirname(part), '_rels', posix.basename(part) + '.rels')
  return all(readXml(files, rel), 'Relationship').filter(n => n.attrs.TargetMode !== 'External').map(n => ({
    id: n.attrs.Id, type: n.attrs.Type?.split('/').at(-1),
    target: posix.normalize(n.attrs.Target?.startsWith('/') ? n.attrs.Target.slice(1) : posix.join(posix.dirname(part), n.attrs.Target ?? '')),
  })).filter(r => !r.target.startsWith('../'))
}

// Decoration readers intentionally exclude placeholders. Read their bodyPr from
// the actual part when resolving autofit inherited by a slide content area.
function sourceTextNodes(lib, pres, shape) {
  const nodes = [first(parse(lib.getShapeXmlString(shape)), 'sp')]
  if (!lib.isShapePlaceholder(shape)) return nodes
  const slide = lib.getShapeSlide(shape), layout = lib.getSlideLayout(slide)
  if (!layout) return nodes
  const idx = lib.getShapePlaceholderIdx(shape), type = lib.getShapePlaceholderType(shape)
  for (const part of [lib.getSlideLayoutPartName(layout), lib.getSlideMasterPartName(slide)]) {
    if (!part) continue
    const xml = parse(Buffer.from(lib.readPackagePart(pres, part) ?? []).toString('utf8'))
    const candidates = all(xml, 'sp').filter(s => first(s, 'ph'))
    const inherited = (idx !== null ? candidates.find(s => Number(first(s, 'ph').attrs.idx ?? 0) === idx) : undefined) ?? candidates.find(s => (first(s, 'ph').attrs.type ?? 'body') === type)
    if (inherited) nodes.push(inherited)
  }
  return nodes
}

export function inheritedPlaceholderAutoFit(lib, pres, shape) {
  for (const inherited of sourceTextNodes(lib, pres, shape).slice(1)) {
    const body = child(child(inherited, 'txBody'), 'bodyPr')
    if (child(body, 'spAutoFit')) return 'shape'
    if (child(body, 'normAutofit')) return 'normal'
    if (child(body, 'noAutofit')) return 'none'
  }
  return undefined
}

export function sourceTypefaceHints(lib, pres, shape) {
  for (const node of sourceTextNodes(lib, pres, shape)) {
    const tx = child(node, 'txBody'), paragraph = child(tx, 'p')
    const layers = [first(paragraph, 'rPr'), first(child(paragraph, 'pPr'), 'defRPr'), first(child(tx, 'lstStyle'), 'defRPr')]
    for (const layer of layers) {
      const face = child(layer, 'latin')?.attrs
      if (!face) continue
      const hints = {}
      if (/^[\da-f]{20}$/i.test(face.panose ?? '')) hints.panose = face.panose
      for (const key of ['pitchFamily', 'charset']) if (/^\d+$/.test(face[key] ?? '')) hints[key] = Number(face[key])
      if (Object.keys(hints).length) return hints
    }
  }
  return undefined
}

// Filters are checked against central-directory sizes before allocating inflated data.
export function unzipTypography(bytes) {
  let total = 0
  return unzipSync(new Uint8Array(bytes), { filter: entry => {
    const keep = /^(ppt\/.*\.(xml|rels|fntdata|ttf|otf)|\[Content_Types\]\.xml)$/.test(entry.name)
    if (!keep) return false
    const limit = FONT_EXT.test(entry.name) ? MAX_FONT : 8 * 1024 * 1024
    total += entry.originalSize
    if (entry.originalSize > limit || total > 64 * 1024 * 1024) fail('PPTX typography exceeds size limits')
    return true
  } })
}

// Decode only declared embedded faces for an isolated renderer font directory.
// EOT is an Office container; the renderer's font index expects sfnt originals.
export function extractRenderFonts(bytes) {
  const files = unzipTypography(bytes), part = 'ppt/presentation.xml'
  const rels = relationships(files, part), result = new Map()
  let total = 0, count = 0
  for (const item of all(readXml(files, part), 'embeddedFont')) {
    for (const variant of variants) {
      const ref = Object.entries(child(item, variant)?.attrs ?? {}).find(([key]) => key.endsWith(':id'))?.[1]
      if (!ref) continue
      if (++count > 64) fail('At most 64 embedded font faces are allowed')
      const rel = rels.find(r => r.id === ref && r.type === 'font')
      if (!rel || !files[rel.target]) fail('Missing embedded font part')
      const info = fontInfo(Buffer.from(files[rel.target])), data = info.preview
      const digest = createHash('sha256').update(data).digest('hex')
      if (result.has(digest)) continue
      total += data.length
      if (total > MAX_FONTS) fail('Embedded renderer fonts exceed 32 MiB')
      result.set(digest, { file: `${digest}.${(info.previewMime ?? info.mime) === 'font/otf' ? 'otf' : 'ttf'}`, bytes: data })
    }
  }
  return [...result.values()]
}

export function extractTypography(bytes, layouts, layoutIdByPart, assets, report) {
  const files = unzipTypography(bytes), presentation = 'ppt/presentation.xml'
  const rels = relationships(files, presentation), fonts = [], used = new Set()
  const root = readXml(files, presentation)
  const warn = message => report.warnings.push(message)
  for (const item of all(root, 'embeddedFont')) {
    const family = first(item, 'font')?.attrs.typeface
    if (!family) continue
    for (const variant of variants) {
      const ref = Object.entries(child(item, variant)?.attrs ?? {}).find(([key]) => key.endsWith(':id'))?.[1], rel = rels.find(r => r.id === ref && r.type === 'font')
      if (!rel || !files[rel.target]) continue
      try {
        fontFamily(family)
        const data = Buffer.from(files[rel.target]), info = fontInfo(data)
        const file = `font-${createHash('sha256').update(data).digest('hex').slice(0, 24)}.${info.mime === 'application/x-fontdata' ? 'fntdata' : info.mime === 'font/otf' ? 'otf' : 'ttf'}`
        assets[file] = data
        fonts.push({ family: fontFamily(family), variant, file })
        if (info.fsType) warn(`Шрифт «${family}»: ограничения встраивания fsType=0x${info.fsType.toString(16)}; файл сохранён.`)
        if (info.subset) warn(`Шрифт «${family}» содержит подмножество символов; для нового текста могут отсутствовать глифы.`)
      } catch (error) { warn(`Не удалось прочитать встроенный шрифт «${family}»: ${error.message}`) }
    }
  }
  if (fonts.length && ['1', 'true'].includes(first(root, 'presentation')?.attrs.saveSubsetFonts)) warn('В PPTX встроены подмножества шрифтов: символы нового текста могут отсутствовать.')
  const firstMaster = rels.find(r => r.type === 'slideMaster')?.target
  const mainTheme = (firstMaster && relationships(files, firstMaster).find(r => r.type === 'theme')?.target) ?? Object.keys(files).find(p => /^ppt\/theme\/theme\d+\.xml$/.test(p))
  const themeFor = (part, fallback) => {
    const target = relationships(files, part).find(r => r.type === 'theme')?.target
    return target ? readXml(files, target) : fallback
  }
  const themeFonts = theme => {
    const major = first(theme, 'majorFont'), minor = first(theme, 'minorFont')
    const pick = n => child(n, 'latin')?.attrs.typeface || child(n, 'ea')?.attrs.typeface || child(n, 'cs')?.attrs.typeface
    return { heading: pick(major), body: pick(minor) }
  }
  const globalTheme = readXml(files, mainTheme), globalFonts = themeFonts(globalTheme)
  const resolveFamily = (value, tf) => value?.startsWith('+mj') ? tf.heading : value?.startsWith('+mn') ? tf.body : value
  const color = (node, theme) => {
    const rgb = first(node, 'srgbClr')?.attrs.val
    if (rgb && /^[\da-f]{6}$/i.test(rgb)) return '#' + rgb.toUpperCase()
    const slot = first(node, 'schemeClr')?.attrs.val
    if (!slot) return undefined
    const aliases = { tx1: 'dk1', bg1: 'lt1', tx2: 'dk2', bg2: 'lt2' }
    const item = child(first(theme, 'clrScheme'), aliases[slot] ?? slot)
    const hex = first(item, 'srgbClr')?.attrs.val ?? first(item, 'sysClr')?.attrs.lastClr
    return hex && /^[\da-f]{6}$/i.test(hex) ? '#' + hex.toUpperCase() : undefined
  }
  const readStyle = (node, tf, theme) => {
    if (!node) return {}
    const out = {}, a = node.attrs
    const family = resolveFamily(child(node, 'latin')?.attrs.typeface || child(node, 'ea')?.attrs.typeface, tf)
    if (family) out.fontFamily = fontFamily(family)
    if (a.sz !== undefined && Number(a.sz) >= 100 && Number(a.sz) <= 40000) out.size = Number(a.sz) / 100
    if (a.b !== undefined) out.bold = a.b === '1' || a.b === 'true'
    if (a.i !== undefined) out.italic = a.i === '1' || a.i === 'true'
    const c = color(node, theme)
    if (c) out.color = c
    return out
  }
  const roleOf = (shape, placeholders) => {
    const ph = first(shape, 'ph')
    const type = ph?.attrs.type
    if (ph && !type && placeholders.has(ph.attrs.idx ?? '0')) return placeholders.get(ph.attrs.idx ?? '0')
    if (['title', 'ctrTitle'].includes(type)) return 'title'
    if (type === 'subTitle') return 'subtitle'
    if (['ftr', 'dt', 'sldNum'].includes(type)) return 'footer'
    if (ph) return 'body'
    const name = first(shape, 'cNvPr')?.attrs.name?.toLowerCase() ?? ''
    if (name.includes('statement')) return 'title'
    return [...TEXT_ROLES].sort((a, b) => b.length - a.length).find(r => name.includes(r)) ?? 'body'
  }
  const addShapes = (styles, node, tf, theme, placeholders) => {
    for (const shape of all(node, 'sp')) {
      const tx = child(shape, 'txBody')
      if (!tx) continue
      const role = roleOf(shape, placeholders), result = {}, ph = first(shape, 'ph')
      if (ph) placeholders.set(ph.attrs.idx ?? '0', role)
      const styleRef = first(shape, 'fontRef')
      if (styleRef) {
        const family = styleRef.attrs.idx === 'major' ? tf.heading : tf.body
        if (family) result.fontFamily = family
        const c = color(styleRef, theme)
        if (c) result.color = c
      }
      Object.assign(result, readStyle(first(first(tx, 'lstStyle'), 'defRPr'), tf, theme))
      const paragraph = child(tx, 'p')
      Object.assign(result, readStyle(first(child(paragraph, 'pPr'), 'defRPr'), tf, theme),
        readStyle(first(paragraph, 'rPr') ?? child(paragraph, 'endParaRPr'), tf, theme))
      styles[role] = { ...styles[role], ...result }
    }
  }
  const textStyles = {}
  if (globalFonts.heading) textStyles.title = { fontFamily: globalFonts.heading }
  if (globalFonts.body) textStyles.body = { fontFamily: globalFonts.body }
  for (const [sourcePart, id] of layoutIdByPart) {
    const part = sourcePart.replace(/^\/+/, '')
    const layout = layouts.find(l => l.id === id)
    if (!layout) continue
    const sourceSlide = /^ppt\/slides\//.test(part) ? part : undefined
    const layoutPart = sourceSlide ? relationships(files, part).find(r => r.type === 'slideLayout')?.target : part
    const masterPart = relationships(files, layoutPart).find(r => r.type === 'slideMaster')?.target
    const master = readXml(files, masterPart), theme = themeFor(masterPart ?? part, globalTheme), tf = themeFonts(theme)
    const styles = { title: { fontFamily: tf.heading ?? globalFonts.heading }, body: { fontFamily: tf.body ?? globalFonts.body } }
    for (const [role, key] of [['title', 'titleStyle'], ['body', 'bodyStyle'], ['footer', 'otherStyle']]) {
      const props = first(first(master, key), 'defRPr')
      styles[role] = { ...styles[role], ...readStyle(props, tf, theme) }
    }
    const placeholders = new Map()
    addShapes(styles, master, tf, theme, placeholders)
    addShapes(styles, readXml(files, layoutPart), tf, theme, placeholders)
    // Slide-level formatting is the final override for this layout's role defaults.
    const slideParts = rels.filter(r => r.type === 'slide').map(r => r.target)
    const source = sourceSlide ?? slideParts.find(s => relationships(files, s).some(r => r.type === 'slideLayout' && r.target === part))
    if (source) addShapes(styles, readXml(files, source), tf, theme, placeholders)
    for (const s of Object.values(styles)) if (s.fontFamily === undefined) delete s.fontFamily
    layout.textStyles = normalizeTextStyles(styles)
  }
  for (const styles of [textStyles, ...layouts.map(l => l.textStyles ?? {})]) for (const s of Object.values(styles)) if (s.fontFamily) used.add(s.fontFamily)
  for (const family of new Set([...used].map(f=>f.trim()))) if (!fonts.some(f => f.family.trim().toLowerCase() === family.toLowerCase())) warn(`Шрифт «${family}» не встроен в исходный PPTX; сохранено название, потребуется установленный шрифт.`)
  report.fonts = { ...(report.fonts ?? {}), major: globalFonts.heading, minor: globalFonts.body, embedded: fonts.length }
  return { textStyles: normalizeTextStyles(textStyles), fonts: normalizeFontRefs(fonts) }
}

const selectors = { title: 'h1,h2,.statement-title', subtitle: '.subtitle', body: 'li,.media-caption,.quote-text,td,th', kicker: '.kicker', footer: '.brand-footer,.meta', caption: '.media-caption', quote: '.quote-text', attribution: '.quote-attr', table: 'td,th' }
const shapeRoles = { Title: 'title', Statement: 'title', Subtitle: 'subtitle', Body: 'body', Kicker: 'kicker', Footer: 'footer', 'Brand footer': 'footer', Caption: 'caption', Quote: 'quote', Attribution: 'attribution', Table: 'table' }
export function typographyCss(manifest) {
  const faces = (manifest.style?.fonts ?? []).map(face => {
    const asset = manifest.assets?.[face.assetId]
    if (!asset) return ''
    const info = fontInfo(fontBytesFromUri(asset.data)), data = info.preview
    return `@font-face{font-family:${JSON.stringify(face.family).replace(/</g, '\\3c ')};src:url(data:${info.previewMime ?? info.mime};base64,${data.toString('base64')});font-weight:${/bold/i.test(face.variant) ? 700 : 400};font-style:${/italic/i.test(face.variant) ? 'italic' : 'normal'};font-display:block}`
  }).join('\n')
  const rules = (styles, scope) => Object.entries(styles ?? {}).map(([role, s]) => {
    const css = [s.fontFamily && `font-family:${JSON.stringify(s.fontFamily).replace(/</g, '\\3c ')}`, s.size !== undefined && `font-size:${s.size * 96 / 72}px`, s.bold !== undefined && `font-weight:${s.bold ? 700 : 400}`, s.italic !== undefined && `font-style:${s.italic ? 'italic' : 'normal'}`, s.color && `color:${s.color}`].filter(Boolean).map(v => v + '!important').join(';')
    return selectors[role].split(',').map(sel => scope + ' ' + sel).join(',') + '{' + css + '}'
  }).join('\n')
  return faces + '\n' + rules(manifest.style?.textStyles, '.slide') + '\n' + (manifest.style?.layouts ?? []).map(l => rules(l.textStyles, `.slide[data-design="${l.id}"]`)).join('\n')
}

export function slotColorXml(spec, fallback) {
  return `<a:solidFill><a:srgbClr val="${(spec?.base ?? fallback).replace('#', '')}">${(spec?.transforms ?? []).map(t => `<a:${t.name} val="${t.value}"/>`).join('')}</a:srgbClr></a:solidFill>`
}

export function applyTextStylesPptx(shapes, styles, zones) {
  if (!styles) return shapes
  return shapes.replace(/<p:(sp|graphicFrame)>[\s\S]*?<\/p:\1>/g, block => {
    const name = /<p:cNvPr\b[^>]*\bname="([^"]*)"/.exec(block)?.[1], role = shapeRoles[name]
    const shapeId = Number(/<p:cNvPr\b[^>]*\bid="(\d+)"/.exec(block)?.[1])
    const zone = zones?.[shapeId - 2]
    const s = { ...(styles[role] ?? (role === 'quote' || role === 'table' || role === 'caption' ? styles.body : {})), ...zone?.textStyle }
    if (!s) return block
    return block.replace(/<a:(rPr|defRPr|endParaRPr)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/a:\1>)/g, (_, tag, attrs, content = '') => {
      for (const [key, value] of [['sz', s.size === undefined ? undefined : Math.round(s.size * 100)], ['b', s.bold === undefined ? undefined : Number(s.bold)], ['i', s.italic === undefined ? undefined : Number(s.italic)]]) {
        if (value === undefined) continue
        attrs = attrs.replace(new RegExp(`\\s${key}="[^"]*"`, 'g'), '') + ` ${key}="${value}"`
      }
      if (s.fontFamily) {
        content = content.replace(/<a:(latin|ea|cs)\b[^>]*\/>/g, '')
        content += ['latin', 'ea', 'cs'].map(tag => {
          const family = tag === 'ea' ? zone?.scriptFonts?.eastAsian : tag === 'cs' ? zone?.scriptFonts?.complexScript : undefined
          const latin = zone?.sourceTypeface?.trim() === s.fontFamily.trim() ? zone.sourceTypeface : s.fontFamily
          return `<a:${tag} typeface="${xml(family ?? latin)}"${tag === 'latin' && zone?.fontHints ? Object.entries(zone.fontHints).map(([key, value]) => ` ${key}="${value}"`).join('') : ''}/>`
        }).join('')
      }
      if (s.color || zone?.colorSpec) {
        content = content.replace(/<a:(solidFill|gradFill|pattFill)>[\s\S]*?<\/a:\1>|<a:noFill\s*\/>/g, '')
        content = slotColorXml(zone?.colorSpec, s.color) + content
      }
      return `<a:${tag}${attrs}>${content}</a:${tag}>`
    })
  })
}

// Run after the media exporter, which may rebuild presentation relationships.
export function embedPptxFonts(bytes, manifest) {
  const fonts = manifest.style?.fonts ?? []
  if (!fonts.length && !manifest.style?.textStyles && !manifest.style?.layouts?.some(l => l.textStyles)) return bytes
  const files = unzipSync(new Uint8Array(bytes)), get = name => Buffer.from(files[name]).toString('utf8')
  manifest.slides.forEach((slide, i) => {
    const type = ['cover', 'section', 'closing'].includes(slide.layout) ? slide.layout : 'content'
    const layouts = manifest.style?.layouts ?? []
    const layout = layouts.find(l => l.id === slide.designLayout) ?? layouts.find(l => l.layoutType === type)
    const styles = structuredClone(manifest.style?.textStyles ?? {})
    for (const [role, style] of Object.entries(layout?.textStyles ?? {})) styles[role] = { ...styles[role], ...style }
    const path = `ppt/slides/slide${i + 1}.xml`
    files[path] = strToU8(applyTextStylesPptx(get(path), styles, layout?.familyId ? layout.textZones : undefined))
  })
  if (!fonts.length) return Buffer.from(zipSync(files, { level: 6 }))
  let rels = get('ppt/_rels/presentation.xml.rels'), types = get('[Content_Types].xml'), index = 0
  const groups = new Map(), usedIds = new Set([...rels.matchAll(/\bId="([^"]+)"/g)].map(m => m[1]))
  for (const face of fonts) {
    const data = officeFont(fontBytesFromUri(manifest.assets[face.assetId].data), face)
    let id
    do { id = 'rIdEmbeddedFont' + (++index) } while (usedIds.has(id))
    usedIds.add(id)
    const path = `ppt/fonts/font${index}.fntdata`
    files[path] = data
    rels = rels.replace('</Relationships>', `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/font${index}.fntdata"/></Relationships>`)
    types = types.replace('</Types>', `<Override PartName="/${path}" ContentType="application/x-fontdata"/></Types>`)
    const group = groups.get(face.family) ?? []
    group.push(`<p:${face.variant} r:id="${id}"/>`); groups.set(face.family, group)
  }
  const list = '<p:embeddedFontLst>' + [...groups].map(([family, entries]) => `<p:embeddedFont><p:font typeface="${xml(family)}"/>${variants.flatMap(v => entries.filter(e => e.startsWith(`<p:${v} `))).join('')}</p:embeddedFont>`).join('') + '</p:embeddedFontLst>'
  let pres = get('ppt/presentation.xml').replace(/<p:embeddedFontLst>[\s\S]*?<\/p:embeddedFontLst>/g, '')
  pres = pres.replace(/<p:presentation\b([^>]*)>/, (_, attrs) => '<p:presentation' + attrs.replace(/\s(?:embedTrueTypeFonts|saveSubsetFonts)="[^"]*"/g, '') + ' embedTrueTypeFonts="1" saveSubsetFonts="0">')
  const next = /<p:(custShowLst|photoAlbum|custDataLst|kinsoku|defaultTextStyle|modifyVerifier|extLst)\b/.exec(pres)
  pres = next ? pres.slice(0, next.index) + list + pres.slice(next.index) : pres.replace('</p:presentation>', list + '</p:presentation>')
  files['ppt/presentation.xml'] = strToU8(pres)
  files['ppt/_rels/presentation.xml.rels'] = strToU8(rels)
  files['[Content_Types].xml'] = strToU8(types)
  return Buffer.from(zipSync(files, { level: 6 }))
}
