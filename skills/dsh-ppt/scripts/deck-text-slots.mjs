// Effective properties belong to a content area, independently of its semantic
// role. A body placeholder can serve as a visual heading in a corporate deck.
import { inheritedPlaceholderAutoFit, sourceTypefaceHints } from './deck-fonts.mjs'
import { normalizeSlotTypography, TEXT_COLOR_TRANSFORMS } from './deck-model.mjs'
export { normalizeSlotTypography } from './deck-model.mjs'

const TRANSFORMS = new Set(TEXT_COLOR_TRANSFORMS)

export function sourceColorSpec(xml, theme, colorMap) {
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
