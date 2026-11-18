// Effective properties belong to a content area, independently of its semantic
// role. A body placeholder can serve as a visual heading in a corporate deck.
import { normalizeTextStyles, inheritedPlaceholderAutoFit, sourceTypefaceHints, fontFamily } from './deck-fonts.mjs'

const TRANSFORMS = new Set(['lumMod', 'lumOff', 'tint', 'shade', 'satMod', 'satOff', 'hueMod', 'hueOff', 'alpha', 'alphaMod', 'alphaOff', 'redMod', 'redOff', 'greenMod', 'greenOff', 'blueMod', 'blueOff'])
const check = (value, name, min, max) => {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid text frame ${name}`)
  return value
}
export function normalizeSlotTypography(zone) {
  const out = {}
  if (zone.textStyle !== undefined) out.textStyle = normalizeTextStyles({ body: zone.textStyle }).body
  if (zone.sourceTypeface !== undefined) { fontFamily(zone.sourceTypeface); out.sourceTypeface = zone.sourceTypeface }
  if (zone.scriptFonts !== undefined) {
    out.scriptFonts = {}
    for (const key of ['eastAsian', 'complexScript']) if (zone.scriptFonts[key] !== undefined) out.scriptFonts[key] = zone.scriptFonts[key] === '' ? '' : fontFamily(zone.scriptFonts[key])
  }
  if (zone.fontHints !== undefined) {
    const hints = {}
    if (zone.fontHints.panose !== undefined) {
      if (!/^[\da-f]{20}$/i.test(zone.fontHints.panose)) throw new Error('Invalid font panose')
      hints.panose = zone.fontHints.panose
    }
    for (const key of ['pitchFamily', 'charset']) if (zone.fontHints[key] !== undefined) hints[key] = Math.round(check(zone.fontHints[key], key, 0, 255))
    out.fontHints = hints
  }
  if (zone.colorSpec !== undefined) {
    const { base, transforms = [] } = zone.colorSpec ?? {}
    if (!/^#[\da-f]{6}$/i.test(base) || !Array.isArray(transforms) || transforms.length > 24) throw new Error('Invalid slot colorSpec')
    out.colorSpec = { base: base.toUpperCase(), transforms: transforms.map(t => {
      if (!TRANSFORMS.has(t.name)) throw new Error('Unsupported text color transform')
      return { name: t.name, value: check(t.value, t.name, -21600000, 21600000) }
    }) }
  }
  if (zone.textFrame !== undefined) {
    const f = zone.textFrame
    if (!f || typeof f !== 'object' || Array.isArray(f)) throw new Error('Invalid text frame')
    const frame = {}
    for (const [key, allowed] of Object.entries({ align: ['left', 'center', 'right', 'justify', 'distributed'], anchor: ['top', 'center', 'bottom'], wrap: ['square', 'none'], autoFit: ['none', 'normal', 'shape'] })) {
      if (f[key] !== undefined) { if (!allowed.includes(f[key])) throw new Error(`Invalid text frame ${key}`); frame[key] = f[key] }
    }
    if (f.margins !== undefined) {
      frame.margins = {}
      for (const side of ['left', 'top', 'right', 'bottom']) if (f.margins[side] !== undefined) frame.margins[side] = check(f.margins[side], side, 0, 51206400)
    }
    for (const key of ['spaceBefore', 'spaceAfter']) if (f[key] !== undefined) frame[key] = check(f[key], key, 0, 4000)
    for (const key of ['marL', 'marR', 'indent']) if (f[key] !== undefined) frame[key] = check(f[key], key, -51206400, 51206400)
    if (f.lineSpacing !== undefined) {
      if (!['pct', 'pts'].includes(f.lineSpacing?.kind)) throw new Error('Invalid line spacing')
      frame.lineSpacing = { kind: f.lineSpacing.kind, value: check(f.lineSpacing.value, 'lineSpacing', 0, f.lineSpacing.kind === 'pct' ? 100 : 4000) }
    }
    if (f.kerning !== undefined) frame.kerning = check(f.kerning, 'kerning', 0, 400000)
    out.textFrame = frame
  }
  return out
}

function sourceColorSpec(xml, theme, colorMap) {
  // Only typed color data is retained, never arbitrary source XML.
  const run = /<a:rPr\b[^>]*(?:\/>|>[\s\S]*?<\/a:rPr>)/.exec(xml)?.[0]
  const color = run && /<a:(srgbClr|schemeClr|sysClr)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/a:\1>)/.exec(run)
  if (!color) return undefined
  const attr = key => new RegExp(`\\b${key}="([^"]*)"`).exec(color[2])?.[1]
  const slot = colorMap?.[attr('val')] ?? attr('val')
  const keys = { dk1: 'dark1', dk2: 'dark2', lt1: 'light1', lt2: 'light2', hlink: 'hyperlink', folHlink: 'followedHyperlink' }
  const base = color[1] === 'schemeClr' ? theme?.[keys[slot] ?? slot] : '#' + (attr('lastClr') ?? attr('val'))
  if (!/^#[\da-f]{6}$/i.test(base)) return undefined
  const transforms = [...(color[3] ?? '').matchAll(/<a:(\w+)\b[^>]*\bval="(-?\d+)"[^>]*\/>/g)].filter(m => TRANSFORMS.has(m[1])).map(m => ({ name: m[1], value: Number(m[2]) }))
  return { base, transforms }
}

export function extractSlotTypography(lib, pres, shape) {
  let paragraph = 0, run = 0, found = false
  for (let p = 0; p < lib.getShapeParagraphCount(shape) && !found; p++) {
    for (let r = 0; r < lib.getShapeRunCount(shape, p); r++) if (lib.getShapeRunText(shape, p, r).trim()) { paragraph = p; run = r; found = true; break }
  }
  if (!found) return {}
  const f = lib.getShapeRunFormatEffective(pres, shape, paragraph, run)
  const p = lib.getParagraphPropertiesEffective(pres, shape, paragraph)
  const body = lib.getShapeBodyPrEffective(pres, shape)
  const textStyle = { ...(f.font && !f.font.startsWith('+') ? { fontFamily: f.font.trim() } : {}), ...(f.size ? { size: f.size } : {}), ...(f.color ? { color: f.color } : {}), bold: f.bold ?? false, italic: f.italic ?? false }
  const margins = Object.fromEntries(Object.entries(body.margins).filter(([, v]) => v !== null))
  const autoFit = lib.getShapeTextAutoFit(shape) ?? inheritedPlaceholderAutoFit(lib, pres, shape) ?? 'none'
  const textFrame = { align: p.align ?? 'left', anchor: body.anchor ?? 'top', ...(body.wrap ? { wrap: body.wrap } : {}), margins, autoFit }
  for (const [key, value] of Object.entries({ lineSpacing: p.lineSpacing, spaceBefore: p.spcBefPts, spaceAfter: p.spcAftPts, marL: p.marL, marR: p.marR, indent: p.indent, kerning: f.kern })) if (value !== null && value !== undefined) textFrame[key] = value
  const colorSpec = sourceColorSpec(lib.getShapeXmlString(shape), lib.getPresentationTheme(pres), lib.getEffectiveColorMap(lib.getShapeSlide(shape)))
  const fontHints = sourceTypefaceHints(lib, pres, shape)
  const fonts = lib.getPresentationFonts(pres)
  const resolveScript = (value, suffix) => value?.startsWith('+mj') ? fonts['major' + suffix] ?? '' : value?.startsWith('+mn') ? fonts['minor' + suffix] ?? '' : value ?? ''
  const scriptFonts = { eastAsian: resolveScript(f.fontEastAsian, 'EastAsian'), complexScript: resolveScript(f.fontComplexScript, 'ComplexScript') }
  return normalizeSlotTypography({ textStyle, textFrame, scriptFonts, ...(f.font && !f.font.startsWith('+') ? { sourceTypeface: f.font } : {}), ...(fontHints ? { fontHints } : {}), ...(colorSpec ? { colorSpec } : {}) })
}
