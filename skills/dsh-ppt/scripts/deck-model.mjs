// Shared browser/server model primitives. No Node, DOM or external imports.
// Existing schema 1/2 semantics remain until scene migration is implemented.
export const TEXT_ROLES = ['title', 'subtitle', 'body', 'kicker', 'footer', 'caption', 'quote', 'attribution', 'table']
export const LEGACY_TEXT_ZONE_LIMIT = 6
const fail = message => { throw new Error('dsh-ppt: ' + message) }
export function fontFamily(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 128 || !/^[\p{L}\p{N} _().&+\-]+$/u.test(value)) fail('Invalid font family')
  return value.trim()
}

export function normalizeTextStyles(input) {
  if (input === undefined) return undefined
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('textStyles must be an object')
  const out = {}
  for (const [role, raw] of Object.entries(input)) {
    if (!TEXT_ROLES.includes(role) || !raw || typeof raw !== 'object' || Array.isArray(raw)) fail('Invalid text role: ' + role)
    const style = {}
    if (raw.fontFamily !== undefined) style.fontFamily = fontFamily(raw.fontFamily)
    if (raw.size !== undefined) {
      if (!Number.isFinite(raw.size) || raw.size < 1 || raw.size > 400) fail('Font size must be 1–400 pt')
      style.size = raw.size
    }
    for (const key of ['bold', 'italic']) if (raw[key] !== undefined) {
      if (typeof raw[key] !== 'boolean') fail(key + ' must be boolean')
      style[key] = raw[key]
    }
    if (raw.color !== undefined) {
      if (!/^#[\da-f]{6}$/i.test(raw.color)) fail('Text color must be #RRGGBB')
      style.color = raw.color.toUpperCase()
    }
    out[role] = style
  }
  return out
}

export function normalizeThemeFonts(input) {
  if (input === undefined) return undefined
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Invalid themeFonts')
  const out = {}
  for (const key of ['majorLatin', 'majorEastAsian', 'majorComplexScript', 'minorLatin', 'minorEastAsian', 'minorComplexScript']) {
    if (input[key] !== undefined) {
      if (input[key] === null || input[key] === '') out[key] = ''
      else { fontFamily(input[key]); out[key] = input[key] }
    }
  }
  return out
}

const TRANSFORMS = new Set(['lumMod', 'lumOff', 'tint', 'shade', 'satMod', 'satOff', 'hueMod', 'hueOff', 'alpha', 'alphaMod', 'alphaOff', 'redMod', 'redOff', 'greenMod', 'greenOff', 'blueMod', 'blueOff'])
export const TEXT_COLOR_TRANSFORMS = Object.freeze([...TRANSFORMS])
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

export function normalizeTextZones(input, path = 'textZones') {
  if (!Array.isArray(input) || input.length > LEGACY_TEXT_ZONE_LIMIT) fail(`${path} 最多 ${LEGACY_TEXT_ZONE_LIMIT} 项`)
  return input.map((zone, index) => {
    const field = `${path}[${index}]`
    if (!zone || typeof zone !== 'object' || Array.isArray(zone) || !['title', 'body', 'image'].includes(zone.kind)) fail(`${field}.kind 只支持 title / body / image`)
    const number = (key, min) => {
      const value = zone[key]
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > 100) fail(`${field}.${key} 需为 ${min}…100 之间的数字`)
      return Math.round(value * 1000) / 1000
    }
    return { ...normalizeSlotTypography(zone), kind: zone.kind, x: number('x', 0), y: number('y', 0), w: number('w', 1), h: number('h', 1) }
  })
}
