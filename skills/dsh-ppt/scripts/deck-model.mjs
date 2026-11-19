import {normalizeSceneChart, normalizeSceneTable} from './deck-structured.mjs'
// Shared browser/server model primitives. No Node, DOM or external imports.
import { transformedBounds } from './deck-geometry.mjs'
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
// Scene contract primitives. These do not enable a new on-disk project version.
export const LEGACY_CONTENT_FIELDS = Object.freeze(['title', 'subtitle', 'text', 'bullets', 'image', 'table', 'chart', 'rows', 'kicker'])
export const SCENE_ELEMENT_TYPES = Object.freeze(['text', 'image', 'shape', 'line', 'group', 'table', 'chart', 'unsupported'])
export const SCENE_LIMITS = Object.freeze({ elements: 256, images: 128, depth: 16, projectElements: 8192, slides: 120, emu: 51206400, paragraphs: 1024, runs: 4096, text: 262144 })
export function mergeSceneTextStyles(...styles) {
  const out = {}
  for (const style of styles) if (style) {
    const fonts = {...out.scriptFonts,...style.scriptFonts}
    Object.assign(out,style)
    if (Object.keys(fonts).length) out.scriptFonts = fonts
  }
  return out
}
const own = (value, key) => Object.hasOwn(value, key)
function sceneError(code, path, message) {
  const error = new Error(`dsh-ppt: ${code} at ${path}: ${message}`)
  error.code = code; error.path = path
  throw error
}
function record(value, path, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) sceneError('invalid-object', path, 'Expected an object')
  for (const key of Object.keys(value)) if (!allowed.includes(key)) sceneError('unknown-field', `${path}.${key}`, 'Field is not supported')
  return value
}
function sceneNumber(value, path, min, max, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || integer && !Number.isSafeInteger(value)) sceneError('invalid-number', path, `Expected ${integer ? 'integer ' : ''}${min}…${max}`)
  return value
}
function sceneString(value, path, max = 1024, empty = false) {
  if (typeof value !== 'string' || value.length > max || !empty && !value.trim()) sceneError('invalid-string', path, `Expected ${empty ? '' : 'nonempty '}string up to ${max} characters`)
  return value
}
function identifier(value, path) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(value)) sceneError('invalid-id', path, 'Expected a stable identifier of 1–128 ASCII characters')
  return value
}
function choice(value, path, allowed) {
  if (!allowed.includes(value)) sceneError('invalid-value', path, `Expected ${allowed.join(' / ')}`)
  return value
}
function sceneColor(value, path) {
  if (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value)) sceneError('invalid-color', path, 'Expected #RRGGBB')
  return value.toUpperCase()
}
export function validateSlideRepresentation(input, path = 'slide') {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return
  if (own(input, 'elements')) {
    const conflicts = LEGACY_CONTENT_FIELDS.filter(key => own(input, key))
    if (conflicts.length) sceneError('mixed-slide-content', path, 'elements conflicts with ' + conflicts.map(key => `${path}.${key}`).join(', '))
    if (input.layout !== 'scene') sceneError('invalid-scene-layout', `${path}.layout`, 'elements requires layout: scene')
  } else if (input.layout === 'scene') sceneError('missing-elements', `${path}.elements`, 'Scene requires elements')
}
export function assertLegacySlideInput(input, path = 'slide') {
  validateSlideRepresentation(input, path)
  if (input && typeof input === 'object' && (own(input, 'elements') || input.layout === 'scene')) sceneError('scene-not-enabled', path, 'Scene contract is available for validation; project migration and rendering are not enabled yet')
}
function sceneFrame(value, path, line = false) {
  record(value, path, ['x', 'y', 'w', 'h'])
  const out = {}
  for (const key of ['x', 'y', 'w', 'h']) out[key] = sceneNumber(value[key], `${path}.${key}`, ['x','y'].includes(key) ? -SCENE_LIMITS.emu : line ? 0 : 1, SCENE_LIMITS.emu, true)
  if (line && !out.w && !out.h) sceneError('empty-line', path, 'Line needs a nonzero dimension')
  return out
}
function sceneTransform(value, frame, path) {
  if (!Array.isArray(value) || value.length !== 6) sceneError('invalid-transform', path, 'Expected six affine coefficients')
  const matrix = value.map((number, index) => sceneNumber(number, `${path}[${index}]`, index < 4 ? -1024 : -SCENE_LIMITS.emu, index < 4 ? 1024 : SCENE_LIMITS.emu))
  if (matrix[0]*matrix[3]-matrix[1]*matrix[2] === 0) sceneError('singular-transform', path, 'Transform must be invertible')
  const bounds = transformedBounds(frame, matrix)
  if ([bounds.x, bounds.y, bounds.x+bounds.w, bounds.y+bounds.h].some(value => Math.abs(value) > SCENE_LIMITS.emu)) sceneError('geometry-range', path, 'Transformed corners exceed the safe EMU range')
  return matrix
}
function sceneTextStyle(value, path) {
  record(value, path, ['fontFamily', 'size', 'bold', 'italic', 'color', 'scriptFonts'])
  let style
  try { style = normalizeTextStyles({body:value}).body } catch (error) { sceneError('invalid-text-style', path, error.message) }
  if (value.scriptFonts !== undefined) {
    record(value.scriptFonts, `${path}.scriptFonts`, ['eastAsian','complexScript'])
    style.scriptFonts = {}
    for (const key of ['eastAsian','complexScript']) if (value.scriptFonts[key] !== undefined) {
      try { style.scriptFonts[key] = value.scriptFonts[key] === '' ? '' : fontFamily(value.scriptFonts[key]) } catch (error) { sceneError('invalid-text-style',`${path}.scriptFonts.${key}`,error.message) }
    }
  }
  return style
}
function sceneParagraphs(value, path, budget) {
  if (!Array.isArray(value) || !value.length || value.length > SCENE_LIMITS.paragraphs) sceneError('paragraph-limit', path, 'Expected 1–1024 paragraphs')
  return value.map((paragraph, index) => {
    const at = `${path}[${index}]`
    record(paragraph, at, ['runs', 'style'])
    if (!Array.isArray(paragraph.runs) || !paragraph.runs.length) sceneError('missing-runs', `${at}.runs`, 'Use a text run with an empty string for an empty paragraph')
    budget.runs += paragraph.runs.length
    if (budget.runs > SCENE_LIMITS.runs) sceneError('run-limit', `${at}.runs`, 'Scene exceeds 4096 runs')
    const out = {runs: paragraph.runs.map((run, i) => {
      const p = `${at}.runs[${i}]`
      record(run, p, ['text', 'style', 'break'])
      if (own(run, 'break')) {
        if (run.break !== true || own(run, 'text') || own(run, 'style')) sceneError('invalid-break', p, 'Break must be exactly {break:true}')
        return {break:true}
      }
      const text = sceneString(run.text, `${p}.text`, 65536, true)
      budget.text += text.length
      if (budget.text > SCENE_LIMITS.text) sceneError('text-limit', p, 'Scene exceeds 262144 text characters')
      return {text, ...(run.style !== undefined ? {style:sceneTextStyle(run.style, `${p}.style`)} : {})}
    })}
    if (paragraph.style !== undefined) {
      record(paragraph.style, `${at}.style`, ['align', 'spaceBefore', 'spaceAfter', 'marL', 'marR', 'indent', 'lineSpacing', 'bullet'])
      if (paragraph.style.lineSpacing !== undefined) record(paragraph.style.lineSpacing, `${at}.style.lineSpacing`, ['kind','value'])
      try { out.style = normalizeSlotTypography({textFrame:paragraph.style}).textFrame } catch (error) { sceneError('invalid-paragraph-style', `${at}.style`, error.message) }
      if (paragraph.style.bullet !== undefined) {
        const bullet = paragraph.style.bullet, p = `${at}.style.bullet`
        record(bullet,p,['kind','character','fontFamily'])
        out.style.bullet = {kind:choice(bullet.kind,`${p}.kind`,['none','bullet'])}
        if (bullet.kind === 'none' && (own(bullet,'character') || own(bullet,'fontFamily'))) sceneError('invalid-bullet',p,'Bullet none cannot carry a character or font')
        if (bullet.kind === 'bullet') {
          out.style.bullet.character = sceneString(bullet.character ?? '•',`${p}.character`,8)
          if (bullet.fontFamily !== undefined) {
            try { out.style.bullet.fontFamily = fontFamily(bullet.fontFamily) } catch (error) { sceneError('invalid-bullet',p,error.message) }
          }
        }
      }
    }
    return out
  })
}
function sceneStroke(value, path) {
  record(value, path, ['color', 'width', 'opacity', 'dash', 'head', 'tail'])
  const out = {color:sceneColor(value.color, `${path}.color`), width:sceneNumber(value.width ?? 1, `${path}.width`, 0, 100)}
  if (value.opacity !== undefined) out.opacity = sceneNumber(value.opacity, `${path}.opacity`, 0, 1)
  if (value.dash !== undefined) out.dash = choice(value.dash, `${path}.dash`, ['solid', 'dash', 'dot'])
  for (const key of ['head', 'tail']) if (value[key] !== undefined) out[key] = choice(value[key], `${path}.${key}`, ['none', 'triangle', 'stealth', 'diamond', 'oval', 'arrow'])
  return out
}
function sceneAsset(value, path, assets) {
  const id = identifier(value, path)
  if (!assets || !own(assets, id) || !assets[id]) sceneError('missing-asset', path, 'Asset is not present in this document')
  if (!['image/png', 'image/jpeg'].includes(assets[id].mime)) sceneError('invalid-image-asset', path, 'Image and preview references require a raster image asset')
  return id
}
function sceneElement(value, path, assets, budget) {
  const common = ['id', 'type', 'role', 'frame', 'name', 'slotId', 'transform', 'source', 'support']
  const fields = {text:['paragraphs', 'textFrame', 'textStyle'], image:['assetId', 'alt', 'fit', 'crop'], shape:['preset', 'fill', 'stroke'], line:['stroke'], group:['children'], table:['table'], chart:['chart'], unsupported:['sourceKind', 'reason', 'previewAssetId']}
  if (!value || !SCENE_ELEMENT_TYPES.includes(value.type)) sceneError('unsupported-element-type', `${path}.type`, 'This contract revision supports ' + SCENE_ELEMENT_TYPES.join(', '))
  record(value, path, [...common, ...fields[value.type]])
  const out = {id:identifier(value.id, `${path}.id`),type:value.type,role:choice(value.role ?? 'content', `${path}.role`, ['content','decor']),frame:sceneFrame(value.frame, `${path}.frame`, value.type === 'line')}
  for (const key of ['name', 'slotId']) if (value[key] !== undefined) out[key] = key === 'slotId' ? identifier(value[key], `${path}.${key}`) : sceneString(value[key], `${path}.${key}`, 1024, true)
  if (value.transform !== undefined) out.transform = sceneTransform(value.transform, out.frame, `${path}.transform`)
  if (value.source !== undefined) {
    record(value.source, `${path}.source`, ['part', 'shapeId', 'slide', 'kind'])
    out.source = {}
    for (const key of ['part', 'shapeId', 'kind']) if (value.source[key] !== undefined) out.source[key] = sceneString(value.source[key], `${path}.source.${key}`)
    if (value.source.slide !== undefined) out.source.slide = sceneNumber(value.source.slide, `${path}.source.slide`, 1, 120, true)
  }
  if (value.support !== undefined) {
    record(value.support, `${path}.support`, ['mode', 'reason'])
    out.support = {mode:choice(value.support.mode, `${path}.support.mode`, ['native','preview','lossy','unsupported'])}
    if (value.support.reason !== undefined) out.support.reason = sceneString(value.support.reason, `${path}.support.reason`, 4096)
  }
  if (value.type === 'text') {
    out.paragraphs = sceneParagraphs(value.paragraphs, `${path}.paragraphs`, budget)
    if (value.textStyle !== undefined) out.textStyle = sceneTextStyle(value.textStyle, `${path}.textStyle`)
    if (value.textFrame !== undefined) {
      record(value.textFrame, `${path}.textFrame`, ['align','anchor','wrap','autoFit','margins','spaceBefore','spaceAfter','marL','marR','indent','lineSpacing','kerning'])
      if (value.textFrame.margins !== undefined) record(value.textFrame.margins, `${path}.textFrame.margins`, ['left','top','right','bottom'])
      if (value.textFrame.lineSpacing !== undefined) record(value.textFrame.lineSpacing, `${path}.textFrame.lineSpacing`, ['kind','value'])
      try { out.textFrame = normalizeSlotTypography({textFrame:value.textFrame}).textFrame } catch (error) { sceneError('invalid-text-frame', `${path}.textFrame`, error.message) }
    }
  }
  if (value.type === 'image' || value.type === 'unsupported' && value.previewAssetId !== undefined) {
    if (++budget.images > SCENE_LIMITS.images) sceneError('image-limit', path, 'Scene exceeds 128 image placements')
    const key = value.type === 'image' ? 'assetId' : 'previewAssetId'
    out[key] = sceneAsset(value[key], `${path}.${key}`, assets)
  }
  if (value.type === 'image') {
    out.fit = choice(value.fit ?? 'contain', `${path}.fit`, ['contain','cover','fill'])
    if (value.alt !== undefined) out.alt = sceneString(value.alt, `${path}.alt`, 4096, true)
    if (value.crop !== undefined) {
      record(value.crop, `${path}.crop`, ['left','right','top','bottom'])
      out.crop = Object.fromEntries(['left','right','top','bottom'].map(key => [key, sceneNumber(value.crop[key] ?? 0, `${path}.crop.${key}`, 0, 1)]))
      if (out.crop.left+out.crop.right >= 1 || out.crop.top+out.crop.bottom >= 1) sceneError('invalid-crop', `${path}.crop`, 'Crop removes the whole image')
    }
  }
  if (value.type === 'shape') {
    out.preset = choice(value.preset, `${path}.preset`, ['rect','roundRect','ellipse','triangle','diamond'])
    if (value.fill !== undefined) {
      record(value.fill, `${path}.fill`, ['color','opacity'])
      out.fill = {color:sceneColor(value.fill.color, `${path}.fill.color`), ...(value.fill.opacity !== undefined ? {opacity:sceneNumber(value.fill.opacity, `${path}.fill.opacity`, 0, 1)} : {})}
    }
  }
  if (value.type === 'line' || value.type === 'shape' && value.stroke !== undefined) out.stroke = sceneStroke(value.stroke, `${path}.stroke`)
  if (value.type === 'chart') out.chart = normalizeSceneChart(value.chart, `${path}.chart`)
  if (value.type === 'table') {
    out.table = normalizeSceneTable(value.table, `${path}.table`, (cell, at) => {
      const text = sceneElement({id:'cell',type:'text',frame:value.frame,paragraphs:cell.paragraphs,...(cell.textStyle ? {textStyle:cell.textStyle} : {}),...(cell.textFrame ? {textFrame:cell.textFrame} : {})}, at, assets, budget)
      return Object.fromEntries(['paragraphs','textStyle','textFrame'].filter(k => text[k] !== undefined).map(k => [k,text[k]]))
    })
    if (out.table.columns.reduce((a,b)=>a+b,0) !== out.frame.w || out.table.rows.reduce((a,b)=>a+b,0) !== out.frame.h) sceneError('table-size', path, 'Column and row sizes must sum to the object frame')
  }
  if (value.type === 'group') {
    if (!Array.isArray(value.children) || !value.children.length || value.children.length > SCENE_LIMITS.elements) sceneError('invalid-group', `${path}.children`, 'Expected 1–256 child identifiers')
    out.children = value.children.map((id, index) => identifier(id, `${path}.children[${index}]`))
  }
  if (value.type === 'unsupported') {
    out.sourceKind = sceneString(value.sourceKind, `${path}.sourceKind`)
    out.reason = sceneString(value.reason, `${path}.reason`, 4096)
  }
  return out
}
function sceneGroups(elements, path) {
  const byId = new Map(), parents = new Map()
  elements.forEach((element, index) => {
    if (byId.has(element.id)) sceneError('duplicate-element-id', `${path}[${index}].id`, element.id)
    byId.set(element.id, element)
  })
  const positions = new Map(elements.filter(e => e.type !== 'group').map((e, i) => [e.id, i]))
  for (const [index, element] of elements.entries()) if (element.type === 'group') for (const [i, id] of element.children.entries()) {
    const at = `${path}[${index}].children[${i}]`
    if (!byId.has(id)) sceneError('missing-element', at, id)
    if (parents.has(id)) sceneError('multiple-group-parents', at, id)
    parents.set(id, element.id)
  }
  const active = new Set()
  function leaves(element, depth) {
    if (active.has(element.id)) sceneError('group-cycle', path, element.id)
    if (depth > SCENE_LIMITS.depth) sceneError('group-depth', path, 'Group depth exceeds 16')
    if (element.type !== 'group') return [positions.get(element.id)]
    active.add(element.id)
    const members = element.children.flatMap(id => leaves(byId.get(id), depth+1))
    active.delete(element.id)
    if (members.some((position, index) => index && position !== members[index-1]+1)) sceneError('group-order', path, 'Group leaves must follow their contiguous drawing order')
    return members
  }
  // Inspect every component, including cycles with no root. Starting at each
  // group also checks the longest path, irrespective of element array order.
  for (const element of elements) if (element.type === 'group') leaves(element, 0)
}
export function normalizeSceneSlide(input, { assets = {}, path = 'slide' } = {}) {
  validateSlideRepresentation(input, path)
  record(input, path, ['id','layout','purpose','label','notes','designLayout','elements'])
  if (input.layout !== 'scene') sceneError('invalid-scene-layout', `${path}.layout`, 'Expected scene')
  if (!Array.isArray(input.elements) || input.elements.length > SCENE_LIMITS.elements) sceneError('element-limit', `${path}.elements`, 'Expected at most 256 objects')
  const budget = {images:0,runs:0,text:0}
  const out = {layout:'scene',purpose:choice(input.purpose ?? 'content', `${path}.purpose`, ['cover','section','content','closing']),elements:input.elements.map((value,index) => sceneElement(value, `${path}.elements[${index}]`, assets, budget))}
  for (const key of ['id','designLayout']) if (input[key] !== undefined) out[key] = identifier(input[key], `${path}.${key}`)
  for (const key of ['label','notes']) if (input[key] !== undefined) out[key] = sceneString(input[key], `${path}.${key}`, key === 'notes' ? 65536 : 1024, true)
  sceneGroups(out.elements, `${path}.elements`)
  return out
}
export function normalizeSceneSlides(input, {assets = {}, path = 'slides'} = {}) {
  if (!Array.isArray(input) || !input.length || input.length > SCENE_LIMITS.slides) sceneError('slide-limit', path, 'Expected 1–120 scenes')
  const slides = input.map((slide,index) => normalizeSceneSlide(slide, {assets,path:`${path}[${index}]`}))
  const ids = new Set()
  let elements = 0
  for (const [index, slide] of slides.entries()) {
    if (slide.id !== undefined) {
      if (ids.has(slide.id)) sceneError('duplicate-slide-id', `${path}[${index}].id`, slide.id)
      ids.add(slide.id)
    }
    elements += slide.elements.length
    if (elements > SCENE_LIMITS.projectElements) sceneError('project-element-limit', path, 'Document exceeds 8192 objects')
  }
  return slides
}
