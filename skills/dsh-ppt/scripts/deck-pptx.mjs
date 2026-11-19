// Legacy native OOXML serializer. No dependency on deck-core orchestration.
import { deflateRawSync } from 'node:zlib'
import { escapeXml } from './deck-text.mjs'
import { resolveTheme } from './deck-theme.mjs'
import { resolveLanguage } from './deck-language.mjs'
import { pageSize, resizeSlideXml, backgroundTypeOfLayout } from './deck-page.mjs'
import { zoneContents } from './deck-zones.mjs'
import { MEDIA_LAYOUTS, mediaBoxes } from './deck-media.mjs'
import { visualShapeXml } from './deck-visual.mjs'
import { pickDesignLayout, remapTextShapes } from './deck-layouts.mjs'
import { applyTextStylesPptx, slotColorXml } from './deck-fonts.mjs'

// ---------------------------------------------------------------------------
// PPTX（OOXML 手写 + node:zlib zip）
// ---------------------------------------------------------------------------

const EMU_W = 12192000
const EMU_H = 6858000

function hex(value) {
  return String(value).replace('#', '').toUpperCase()
}

export function pptxFontName(value) {
  const names = String(value ?? '').split(',').map(name => name.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
  // A CSS stack may start with an optional web font. Office receives one actual
  // family, so select a platform fallback instead of copying the first name.
  if (names.length === 1 && !['serif', 'sans-serif', 'system-ui'].includes(names[0])) return names[0]
  const available = process.platform === 'win32'
    ? ['Segoe UI', 'Arial', 'Arial Black', 'Impact', 'Georgia', 'Times New Roman', 'Microsoft YaHei', 'SimSun']
    : process.platform === 'darwin'
      ? ['Helvetica Neue', 'Arial', 'Impact', 'Georgia', 'Times New Roman', 'Avenir Next', 'PingFang SC', 'Songti SC']
      : ['Liberation Sans', 'Liberation Serif', 'Noto Sans', 'Noto Sans CJK SC', 'Noto Serif CJK SC']
  return names.find(name => available.includes(name)) || (names.includes('serif')
    ? process.platform === 'linux' ? 'Liberation Serif' : 'Georgia'
    : process.platform === 'win32' ? 'Segoe UI' : process.platform === 'darwin' ? 'Helvetica Neue' : 'Liberation Sans')
}

export function pptxEastAsianFont(value) {
  const font = pptxFontName(value)
  if (/Microsoft YaHei|SimSun|SimHei|PingFang|Songti|Heiti|Noto (Sans|Serif) CJK|[\u3400-\u9fff]/i.test(font)) return font
  const serif = /Georgia|Times New Roman|Cambria|Liberation Serif/i.test(font)
  return process.platform === 'win32' ? serif ? 'SimSun' : 'Microsoft YaHei'
    : process.platform === 'darwin' ? serif ? 'Songti SC' : 'PingFang SC'
    : serif ? 'Noto Serif CJK SC' : 'Noto Sans CJK SC'
}

function paragraphXml(text, options = {}) {
  const {
    size = 2000,
    color = 'FFFFFF',
    bold = false,
    lang = 'zh-CN',
    align = 'l',
    bullet = false,
    font = 'Arial',
    spaceBefore = 0,
    spaceAfter = 0,
    italic = false, colorSpec, frame,
  } = options
  const runFont = pptxFontName(font)
  const spacing = (spaceBefore > 0 ? '<a:spcBef><a:spcPts val="' + Math.round(spaceBefore) + '"/></a:spcBef>' : '') +
    (spaceAfter > 0 ? '<a:spcAft><a:spcPts val="' + Math.round(spaceAfter) + '"/></a:spcAft>' : '')
  const lineSpacing = frame?.lineSpacing ? '<a:lnSpc><a:' + (frame.lineSpacing.kind === 'pct' ? 'spcPct' : 'spcPts') + ' val="' + Math.round(frame.lineSpacing.value * (frame.lineSpacing.kind === 'pct' ? 100000 : 100)) + '"/></a:lnSpc>' : ''
  const paragraphMargins = ['marL', 'marR', 'indent'].filter(k => frame?.[k] !== undefined).map(k => ' ' + k + '="' + Math.round(frame[k]) + '"').join('')
  const pPr = '<a:pPr' + paragraphMargins + (bullet ? ' marL="285750" indent="-285750"' : align !== 'l' ? ' algn="' + align + '"' : '') + '>' + lineSpacing + spacing +
    (bullet ? '<a:buFont typeface="Arial" panose="020B0604020202020204"/><a:buChar char="•"/>' : '<a:buNone/>') + '</a:pPr>'
  return '<a:p>' + pPr +
    '<a:r><a:rPr lang="' + lang + '" sz="' + size + '" b="' + (bold ? 1 : 0) + '" i="' + (italic ? 1 : 0) + '"' + (frame?.kerning !== undefined ? ' kern="' + frame.kerning + '"' : '') + ' dirty="0">' +
    slotColorXml(colorSpec, color) +
    '<a:latin typeface="' + escapeXml(runFont) + '"/><a:ea typeface="' + escapeXml(pptxEastAsianFont(font)) + '"/></a:rPr>' +
    '<a:t>' + escapeXml(text) + '</a:t></a:r></a:p>'
}

function textShapeXml(id, name, box, paragraphs, options = {}) {
  const { x = 0, y = 0, w = EMU_W, h = EMU_H } = box
  const f = options.textFrame
  const bodyAttrs = f ? (f.anchor ? ' anchor="' + ({ top: 't', center: 'ctr', bottom: 'b' })[f.anchor] + '"' : '') + Object.entries({ left: 'lIns', top: 'tIns', right: 'rIns', bottom: 'bIns' }).filter(([side]) => f.margins?.[side] !== undefined).map(([side, key]) => ' ' + key + '="' + Math.round(f.margins[side]) + '"').join('') : ''
  const autoFit = f ? ({ none: '<a:noAutofit/>', normal: '<a:normAutofit/>', shape: '<a:spAutoFit/>' })[f.autoFit ?? 'none'] : '<a:normAutofit/>'
  return '<p:sp>' +
    '<p:nvSpPr><p:cNvPr id="' + id + '" name="' + escapeXml(name) + '"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>' +
    '<p:spPr><a:xfrm><a:off x="' + x + '" y="' + y + '"/><a:ext cx="' + w + '" cy="' + h + '"/></a:xfrm>' +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln/></p:spPr>' +
    '<p:txBody><a:bodyPr wrap="' + (f?.wrap ?? 'square') + '" rtlCol="0"' + bodyAttrs + '>' + autoFit + '</a:bodyPr><a:lstStyle/>' +
    paragraphs.join('') + '</p:txBody></p:sp>'
}

function accentBarXml(id, name, box, color) {
  const { x = 0, y = 0, w = EMU_W, h = EMU_H } = box
  return '<p:sp>' +
    '<p:nvSpPr><p:cNvPr id="' + id + '" name="' + escapeXml(name) + '"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>' +
    '<p:spPr><a:xfrm><a:off x="' + x + '" y="' + y + '"/><a:ext cx="' + w + '" cy="' + h + '"/></a:xfrm>' +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
    '<a:solidFill><a:srgbClr val="' + hex(color) + '"/></a:solidFill><a:ln/></p:spPr>' +
    '<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>'
}

/** 原生 OOXML 表格（graphicFrame + a:tbl）：首行主题色表头，隔行面板色。 */
function tableGraphicXml(id, name, box, rows, theme, langId) {
  const p = theme.palette
  const lang = langId || 'zh-CN'
  const font = pptxFontName(theme.fonts.body)
  const safeRows = rows.length > 0 ? rows : [['']]
  const cols = Math.max(1, safeRows[0].length)
  const fontSize = cols <= 6 ? 1700 : 1400
  const colW = Math.floor(box.w / cols)
  const grid = Array.from({ length: cols }, () => '<a:gridCol w="' + colW + '"/>').join('')
  const rowH = 420000
  const cellXml = (text, fill, color, bold) =>
    '<a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="l"><a:buNone/></a:pPr>' +
    '<a:r><a:rPr lang="' + lang + '" sz="' + fontSize + '" b="' + (bold ? 1 : 0) + '" dirty="0">' +
    '<a:solidFill><a:srgbClr val="' + hex(color) + '"/></a:solidFill>' +
    '<a:latin typeface="' + escapeXml(font) + '"/><a:ea typeface="' + escapeXml(pptxEastAsianFont(theme.fonts.body)) + '"/></a:rPr>' +
    '<a:t>' + escapeXml(text) + '</a:t></a:r></a:p></a:txBody>' +
    '<a:tcPr marL="91440" marR="91440" anchor="ctr">' +
    (fill !== '' ? '<a:solidFill><a:srgbClr val="' + hex(fill) + '"/></a:solidFill>' : '<a:noFill/>') +
    '</a:tcPr></a:tc>'
  const trs = safeRows.map((row, rowIndex) => {
    const padded = Array.from({ length: cols }, (_, i) => row[i] ?? '')
    const cells = rowIndex === 0
      ? padded.map((c) => cellXml(c, p.accent, p.bg, true)).join('')
      : padded.map((c) => cellXml(c, rowIndex % 2 === 1 ? p.panel : '', p.fg, false)).join('')
    return '<a:tr h="' + rowH + '">' + cells + '</a:tr>'
  }).join('')
  const height = Math.max(1, safeRows.length) * rowH
  return '<p:graphicFrame>' +
    '<p:nvGraphicFramePr><p:cNvPr id="' + id + '" name="' + escapeXml(name) + '"/>' +
    '<p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>' +
    '<p:xfrm><a:off x="' + box.x + '" y="' + box.y + '"/><a:ext cx="' + box.w + '" cy="' + height + '"/></p:xfrm>' +
    '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">' +
    '<a:tbl><a:tblPr firstRow="1" bandRow="1"/>' +
    '<a:tblGrid>' + grid + '</a:tblGrid>' + trs + '</a:tbl>' +
    '</a:graphicData></a:graphic></p:graphicFrame>'
}

function slideShapeList(slide, index, total, theme, langId) {
  const p = theme.palette
  const slots = zoneContents(slide, slide.__layout)
  if (slots && !['table', 'chart'].includes(slide.layout)) return slots.map(({ zone, role, lines, filled }, i) => {
    if (role === 'image' && filled) return ''
    const name = role === 'title' ? 'Title' : role === 'subtitle' ? 'Subtitle' : role === 'image' ? 'Caption' : 'Body'
    const box = { x: Math.round(zone.x / 100 * EMU_W), y: Math.round(zone.y / 100 * EMU_H), w: Math.round(zone.w / 100 * EMU_W), h: Math.round(zone.h / 100 * EMU_H) }
    const style = { ...slide.__textStyles?.[role], ...zone.textStyle }, frame = zone.textFrame
    return textShapeXml(2 + i, name, box, lines.some(line => line !== '') ? lines.map(line => paragraphXml(line, { lang: langId, size: Math.round((style.size ?? (role === 'title' ? 28 : 18)) * 100), font: style.fontFamily ?? (role === 'title' ? theme.fonts.heading : theme.fonts.body), color: style.color ?? p.fg, bold: style.bold, italic: style.italic, align: ({ left: 'l', center: 'ctr', right: 'r', justify: 'just', distributed: 'dist' })[frame?.align] ?? 'l', spaceBefore: (frame?.spaceBefore ?? 0) * 100, spaceAfter: (frame?.spaceAfter ?? 0) * 100, colorSpec: zone.colorSpec, frame })) : ['<a:p/>'], { textFrame: frame })
  }).join('')
  const font = pptxFontName(theme.fonts.heading)
  const bodyFont = pptxFontName(theme.fonts.body) // 保留：v0.1 后续用于统一正文字体
  const lang = langId || 'zh-CN'
  // PPTX 每个文本 run 的语言跟随 deck.lang（zh-CN / en-US），不再写死中文
  const para = (content, options = {}) => paragraphXml(content, { lang, ...options })
  const shapes = []
  const kicker = slide.kicker || ''
  const title = slide.title || ''
  const subtitle = slide.subtitle || ''
  const bullets = Array.isArray(slide.bullets) ? slide.bullets : []
  const idBase = (index + 1) * 10
  const footer = String(index + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0')

  if (MEDIA_LAYOUTS.has(slide.layout)) {
    const boxes = mediaBoxes(slide.layout)
    const emu = box => Object.fromEntries(Object.entries(box).map(([key, value]) => [key, Math.round(value * 914400)]))
    shapes.push(textShapeXml(idBase + 2, 'Title', emu(boxes.title), [para(title, { size: 3400, color: p.fg, bold: true, font })]))
    if (boxes.body) shapes.push(textShapeXml(idBase + 3, 'Body', emu(boxes.body), [
      ...(subtitle ? [para(subtitle, { size: 2000, color: p.fg, font: bodyFont })] : []),
      ...bullets.map(bullet => para(bullet, { size: 2000, color: p.fg, bullet: true, font: bodyFont, spaceAfter: 600 })),
    ]))
    const caption = slide.chart?.caption || slide.image?.caption
    if (caption) shapes.push(textShapeXml(idBase + 4, 'Caption', emu(boxes.caption), [para(caption, { size: 1400, color: p.muted, font: bodyFont })]))
  } else if (slide.layout === 'cover') {
    shapes.push(accentBarXml(idBase + 1, 'Accent bar', { x: 914400, y: 2250000, w: 240000, h: 1600000 }, p.accent))
    shapes.push(textShapeXml(idBase + 2, 'Title', { x: 1550000, y: 2160000, w: 9250000, h: 1800000 }, [
      para(title, { size: 4400, color: p.fg, bold: true, font }),
    ]))
    if (subtitle !== '') {
      shapes.push(textShapeXml(idBase + 3, 'Subtitle', { x: 1570000, y: 4150000, w: 9000000, h: 1200000 }, [
        para(subtitle, { size: 2200, color: p.muted, font: theme.fonts.body }),
      ]))
    }
    if (kicker !== '') {
      shapes.push(textShapeXml(idBase + 4, 'Kicker', { x: 1570000, y: 5800000, w: 7000000, h: 500000 }, [
        para(kicker, { size: 1400, color: p.accent, bold: true, font: theme.fonts.body }),
      ]))
    }
  } else if (slide.layout === 'section') {
    if (kicker !== '') {
      shapes.push(textShapeXml(idBase + 1, 'Kicker', { x: 1050000, y: 2250000, w: 9000000, h: 500000 }, [
        para(kicker, { size: 1600, color: p.accent, bold: true, font: theme.fonts.body }),
      ]))
    }
    shapes.push(accentBarXml(idBase + 2, 'Accent bar', { x: 1050000, y: 2850000, w: 1600000, h: 160000 }, p.accent2))
    shapes.push(textShapeXml(idBase + 3, 'Title', { x: 1050000, y: 3150000, w: 10200000, h: 1400000 }, [
      para(title, { size: 4000, color: p.fg, bold: true, font }),
    ]))
    if (subtitle !== '') {
      shapes.push(textShapeXml(idBase + 4, 'Subtitle', { x: 1070000, y: 4750000, w: 9000000, h: 900000 }, [
        para(subtitle, { size: 1800, color: p.muted, font: theme.fonts.body }),
      ]))
    }
  } else if (slide.layout === 'statement') {
    shapes.push(accentBarXml(idBase + 1, 'Accent bar', { x: 914400, y: 1900000, w: 200000, h: 2800000 }, p.accent))
    shapes.push(textShapeXml(idBase + 2, 'Statement', { x: 1500000, y: 1950000, w: 9400000, h: 2700000 }, [
      para(title || slide.text || '', { size: 3600, color: p.fg, bold: true, font }),
    ]))
    if (subtitle !== '') {
      shapes.push(textShapeXml(idBase + 3, 'Subtitle', { x: 1520000, y: 4900000, w: 9000000, h: 800000 }, [
        para(subtitle, { size: 1800, color: p.muted, font: theme.fonts.body }),
      ]))
    }
  } else if (slide.layout === 'quote') {
    shapes.push(textShapeXml(idBase + 1, 'Quote mark', { x: 900000, y: 1050000, w: 1700000, h: 1900000 }, [
      para('\u201C', { size: 9600, color: p.accent, bold: true, font }),
    ]))
    shapes.push(textShapeXml(idBase + 2, 'Quote', { x: 1050000, y: 2550000, w: 10100000, h: 2600000 }, [
      para(title || slide.text || '', { size: 3000, color: p.fg, bold: true, font }),
    ]))
    if (subtitle !== '') {
      shapes.push(textShapeXml(idBase + 3, 'Attribution', { x: 1070000, y: 5300000, w: 9000000, h: 600000 }, [
        para('\u2014\u2014 ' + subtitle, { size: 1600, color: p.muted, font: theme.fonts.body }),
      ]))
    }
  } else if (slide.layout === 'table') {
    const hasTitle = title !== ''
    if (kicker !== '' && kicker !== title) {
      shapes.push(textShapeXml(idBase + 1, 'Kicker', { x: 900000, y: 420000, w: 10000000, h: 420000 }, [
        para(kicker, { size: 1400, color: p.accent, bold: true, font: theme.fonts.body }),
      ]))
    }
    if (hasTitle) {
      shapes.push(textShapeXml(idBase + 2, 'Title', { x: 900000, y: 920000, w: 10300000, h: 800000 }, [
        para(title, { size: 3400, color: p.fg, bold: true, font }),
      ]))
    }
    shapes.push(tableGraphicXml(idBase + 3, 'Table', { x: 900000, y: hasTitle ? 1950000 : 900000, w: 10300000 }, Array.isArray(slide.rows) ? slide.rows : [], theme, lang))
  } else if (slide.layout === 'closing') {
    shapes.push(textShapeXml(idBase + 1, 'Title', { x: 1050000, y: 2300000, w: 10200000, h: 1700000 }, [
      para(title || '谢谢', { size: 5200, color: p.fg, bold: true, align: 'ctr', font }),
    ]))
    if (subtitle !== '') {
      shapes.push(textShapeXml(idBase + 2, 'Subtitle', { x: 1050000, y: 4200000, w: 10200000, h: 900000 }, [
        para(subtitle, { size: 2000, color: p.accent, bold: true, align: 'ctr', font: theme.fonts.body }),
      ]))
    }
  } else {
    // bullets（默认布局）
    if (kicker !== '') {
      shapes.push(textShapeXml(idBase + 1, 'Kicker', { x: 900000, y: 420000, w: 10000000, h: 420000 }, [
        para(kicker, { size: 1400, color: p.accent, bold: true, font: theme.fonts.body }),
      ]))
    }
    shapes.push(textShapeXml(idBase + 2, 'Title', { x: 900000, y: 920000, w: 10300000, h: 800000 }, [
      para(title, { size: 3400, color: p.fg, bold: true, font }),
    ]))
    const bodyParagraphs = bullets.length > 0
      ? bullets.map((bullet) => para(bullet, { size: 2000, color: p.fg, bullet: true, font: theme.fonts.body, spaceAfter: 600 }))
      : [para(subtitle || '', { size: 2000, color: p.fg, font: theme.fonts.body })]
    shapes.push(textShapeXml(idBase + 3, 'Body', { x: 1050000, y: 1850000, w: 10100000, h: 4500000 }, bodyParagraphs))
  }

  shapes.push(textShapeXml(idBase + 9, 'Page number', { x: 10600000, y: 6250000, w: 1200000, h: 400000 }, [
    para(footer, { size: 1000, color: p.muted, align: 'r', font: theme.fonts.body }),
  ]))

  return visualShapeXml(shapes.join(''), slide.visual)
}

/**
 * 原生逐条点击显现动画（PowerPoint「出现，按段落」的标准时序树）：
 * bldP 把正文文本框标记为按段落构建，主序列里每条要点一个点击节点。
 */
function bulletTimingXml(spid, clicks) {
  let id = 2
  const nextId = () => { id += 1; return String(id) }
  const clickPars = []
  for (let i = 0; i < clicks; i += 1) {
    clickPars.push(
      '<p:par><p:cTn id="' + nextId() + '" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst>' +
      '<p:par><p:cTn id="' + nextId() + '" presetID="1" presetClass="entr" presetSubtype="0" fill="hold" grpId="0" nodeType="clickEffect">' +
      '<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>' +
      '<p:set><p:cBhvr><p:cTn id="' + nextId() + '" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>' +
      '<p:tgtEl><p:spTgt spid="' + spid + '"/></p:tgtEl>' +
      '<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr>' +
      '<p:to><p:strVal val="visible"/></p:to></p:set>' +
      '</p:childTnLst></p:cTn></p:par>' +
      '</p:childTnLst></p:cTn></p:par>',
    )
  }
  return '<p:timing><p:tnLst><p:par>' +
    '<p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>' +
    '<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>' +
    clickPars.join('') +
    '</p:childTnLst></p:cTn>' +
    '<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>' +
    '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>' +
    '</p:seq></p:childTnLst></p:cTn></p:par></p:tnLst>' +
    '<p:bldLst><p:bldP spid="' + spid + '" grpId="0"/></p:bldLst></p:timing>'
}

function slideXml(slide, index, total, theme, langId, motion) {
  const p = theme.palette
  let motionXml = ''
  if (motion) {
    motionXml = '<p:transition spd="med"><p:fade/></p:transition>'
    const bullets = Array.isArray(slide.bullets) ? slide.bullets : []
    if (!slide.__layout?.familyId && slide.layout === 'bullets' && bullets.length >= 2) {
      motionXml += bulletTimingXml((index + 1) * 10 + 3, bullets.length)
    }
  }
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
    '<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="' + hex(p.bg) + '"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>' +
    '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
    (slide.__layout?.familyId && !['table', 'chart'].includes(slide.layout) ? applyTextStylesPptx(slideShapeList(slide, index, total, theme, langId), slide.__textStyles, slide.__layout.textZones) : remapTextShapes(applyTextStylesPptx(slideShapeList(slide, index, total, theme, langId), slide.__textStyles), slide.__layout)) +
    '</p:spTree></p:cSld>' +
    '<p:clrMapOvr><a:overrideClrMapping bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:clrMapOvr>' +
    motionXml +
    '</p:sld>'
}

function slideRelXml(hasNotes, slideIndex) {
  const notesRel = hasNotes
    ? '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide' + slideIndex + '.xml"/>'
    : ''
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>' +
    notesRel +
    '</Relationships>'
}

function presentationXml(slideCount, hasNotesMaster, size) {
  const slideIds = Array.from({ length: slideCount }, (_, i) =>
    '<p:sldId id="' + (256 + i) + '" r:id="rId' + (i + 2) + '"/>').join('')
  const notesMasterId = hasNotesMaster
    ? '<p:notesMasterIdLst><p:notesMasterId id="2147483649" r:id="rId' + (slideCount + 2) + '"/></p:notesMasterIdLst>'
    : ''
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
    '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
    '<p:sldIdLst>' + slideIds + '</p:sldIdLst>' +
    notesMasterId +
    '<p:sldSz cx="' + size.width + '" cy="' + size.height + '"/>' +
    '<p:notesSz cx="6858000" cy="9144000"/>' +
    '</p:presentation>'
}

function presentationRelXml(slideCount, hasNotesMaster) {
  const slideRels = Array.from({ length: slideCount }, (_, i) =>
    '<Relationship Id="rId' + (i + 2) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide' + (i + 1) + '.xml"/>').join('')
  const notesMasterRel = hasNotesMaster
    ? '<Relationship Id="rId' + (slideCount + 2) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster" Target="notesMasters/notesMaster1.xml"/>'
    : ''
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>' +
    slideRels +
    notesMasterRel +
    '</Relationships>'
}

function notesMasterXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<p:notesMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
    '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
    '</p:spTree></p:cSld>' +
    '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
    '<p:notesStyle><a:lvl1pPr><a:defRPr sz="1200"/></a:lvl1pPr></p:notesStyle>' +
    '</p:notesMaster>'
}

function notesMasterRelXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>' +
    '</Relationships>'
}

function notesSlideXml(notes, langId) {
  const lang = langId || 'zh-CN'
  const paragraphs = String(notes ?? '').split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => '<a:p><a:r><a:rPr lang="' + lang + '" sz="1200" dirty="0"/><a:t>' + escapeXml(line) + '</a:t></a:r></a:p>')
    .join('')
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
    '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
    '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr/><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp>' +
    '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/>' +
    '<p:txBody><a:bodyPr/><a:lstStyle/>' + paragraphs + '</p:txBody></p:sp>' +
    '</p:spTree></p:cSld>' +
    '<p:clrMapOvr><a:overrideClrMapping bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:clrMapOvr>' +
    '</p:notes>'
}

function notesSlideRelXml(slideIndex) {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="../slides/slide' + slideIndex + '.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster" Target="../notesMasters/notesMaster1.xml"/>' +
    '</Relationships>'
}

function slideMasterXml(theme) {
  const p = theme.palette
  const levels = Array.from({ length: 9 }, (_, i) => {
    const sz = Math.max(1100, 2000 - i * 100)
    return '<a:lvl' + (i + 1) + 'pPr marL="' + (342900 + i * 342900) + '" indent="' + (-342900 - i * 0) + '">' +
      '<a:defRPr sz="' + sz + '"><a:solidFill><a:srgbClr val="' + hex(p.fg) + '"/></a:solidFill><a:latin typeface="' + escapeXml(pptxFontName(theme.fonts.body)) + '"/><a:ea typeface="' + escapeXml(pptxEastAsianFont(theme.fonts.body)) + '"/></a:defRPr></a:lvl' + (i + 1) + 'pPr>'
  }).join('')
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
    '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
    '</p:spTree></p:cSld>' +
    '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
    '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>' +
    '<p:txStyles><p:titleStyle>' + levels + '</p:titleStyle><p:bodyStyle>' + levels + '</p:bodyStyle><p:otherStyle>' + levels + '</p:otherStyle></p:txStyles>' +
    '</p:sldMaster>'
}

function slideMasterRelXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>' +
    '</Relationships>'
}

function slideLayoutXml(theme) {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">' +
    '<p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
    '</p:spTree></p:cSld>' +
    '<p:clrMapOvr><a:overrideClrMapping bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:clrMapOvr>' +
    '</p:sldLayout>'
}

function slideLayoutRelXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>' +
    '</Relationships>'
}

function themeXml(theme, sourceFonts) {
  const p = theme.palette
  const color = (name, value) => '<a:' + name + '><a:srgbClr val="' + hex(value) + '"/></a:' + name + '>'
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="dsh-ppt ' + escapeXml(theme.name.en) + '">' +
    '<a:themeElements>' +
    '<a:clrScheme name="dsh-ppt">' +
    color('dk1', p.fg) + color('lt1', p.bg) + color('dk2', p.muted) + color('lt2', p.panel) +
    color('accent1', p.accent) + color('accent2', p.accent2) + color('accent3', p.fg) +
    color('accent4', p.muted) + color('accent5', p.accent) + color('accent6', p.accent2) +
    color('hlink', p.accent) + color('folHlink', p.accent2) +
    '</a:clrScheme>' +
    '<a:fontScheme name="dsh-ppt">' +
    '<a:majorFont><a:latin typeface="' + escapeXml(sourceFonts?.majorLatin ?? pptxFontName(theme.fonts.heading)) + '"/><a:ea typeface="' + escapeXml(sourceFonts?.majorEastAsian ?? pptxEastAsianFont(theme.fonts.heading)) + '"/><a:cs typeface="' + escapeXml(sourceFonts?.majorComplexScript ?? '') + '"/></a:majorFont>' +
    '<a:minorFont><a:latin typeface="' + escapeXml(sourceFonts?.minorLatin ?? pptxFontName(theme.fonts.body)) + '"/><a:ea typeface="' + escapeXml(sourceFonts?.minorEastAsian ?? pptxEastAsianFont(theme.fonts.body)) + '"/><a:cs typeface="' + escapeXml(sourceFonts?.minorComplexScript ?? '') + '"/></a:minorFont>' +
    '</a:fontScheme>' +
    '<a:fmtScheme name="dsh-ppt">' +
    '<a:fillStyleLst>' +
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
    '</a:fillStyleLst>' +
    '<a:lnStyleLst><a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst>' +
    '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>' +
    '<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>' +
    '</a:fmtScheme>' +
    '</a:themeElements>' +
    '<a:objectDefaults/><a:extraClrSchemeLst/>' +
    '</a:theme>'
}

function contentTypesXml(slideCount, noteIndexes) {
  const overrides = Array.from({ length: slideCount }, (_, i) =>
    '<Override PartName="/ppt/slides/slide' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>').join('')
  const notesOverrides = noteIndexes.map((index) =>
    '<Override PartName="/ppt/notesSlides/notesSlide' + (index + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>').join('')
  const notesMasterOverride = noteIndexes.length > 0
    ? '<Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/>'
    : ''
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
    '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>' +
    '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>' +
    '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
    notesMasterOverride +
    overrides +
    notesOverrides +
    '</Types>'
}

function rootRelXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
    '</Relationships>'
}

function coreXml(title) {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
    'xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    '<dc:title>' + escapeXml(title) + '</dc:title><dc:creator>dsh-ppt</dc:creator>' +
    '<cp:lastModifiedBy>dsh-ppt</cp:lastModifiedBy>' +
    '</cp:coreProperties>'
}

function appXml(slideCount, notesCount) {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ' +
    'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
    '<Application>dsh-ppt</Application><PresentationFormat>Widescreen</PresentationFormat>' +
    '<Slides>' + slideCount + '</Slides><Notes>' + notesCount + '</Notes><HiddenSlides>0</HiddenSlides>' +
    '</Properties>'
}

function buildZip(entries) {
  const chunks = []
  const central = []
  let offset = 0

  for (const entry of entries) {
    const entryOffset = offset
    const name = Buffer.from(entry.name, 'utf8')
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data), 'utf8')
    const crc = crc32(data)
    const compressed = deflateRawSync(data)
    const method = 8
    const nameLength = name.length
    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(0x0800, 6) // UTF-8 文件名
    localHeader.writeUInt16LE(method, 8)
    localHeader.writeUInt16LE(0, 10) // DOS time
    localHeader.writeUInt16LE(0x21, 12) // DOS date 1980-01-01
    localHeader.writeUInt32LE(crc, 14)
    localHeader.writeUInt32LE(compressed.length, 18)
    localHeader.writeUInt32LE(data.length, 22)
    localHeader.writeUInt16LE(nameLength, 26)
    localHeader.writeUInt16LE(0, 28)

    chunks.push(localHeader, name, compressed)
    offset += 30 + nameLength + compressed.length

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(0x0800, 8)
    centralHeader.writeUInt16LE(method, 10)
    centralHeader.writeUInt16LE(0, 12)
    centralHeader.writeUInt16LE(0x21, 14)
    centralHeader.writeUInt32LE(crc, 16)
    centralHeader.writeUInt32LE(compressed.length, 20)
    centralHeader.writeUInt32LE(data.length, 24)
    centralHeader.writeUInt16LE(nameLength, 28)
    centralHeader.writeUInt16LE(0, 30)
    centralHeader.writeUInt16LE(0, 32)
    centralHeader.writeUInt16LE(0, 34)
    centralHeader.writeUInt16LE(0, 36)
    centralHeader.writeUInt32LE(0, 38)
    centralHeader.writeUInt32LE(entryOffset, 42)
    central.push(centralHeader, name)
  }

  const centralOffset = offset
  const centralSize = central.reduce((sum, part) => sum + part.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(centralOffset, 16)
  end.writeUInt16LE(0, 20)

  chunks.push(...central, end)
  return Buffer.concat(chunks)
}

let CRC_TABLE = null
function crc32(buffer) {
  if (CRC_TABLE === null) {
    CRC_TABLE = new Int32Array(256)
    for (let n = 0; n < 256; n += 1) {
      let c = n
      for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
      CRC_TABLE[n] = c
    }
  }
  let crc = 0xffffffff
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

export function buildPptx(manifest, themeInput, languageInput) {
  const theme = themeInput?.id ? themeInput : resolveTheme(themeInput)
  const language = languageInput?.id ? languageInput : resolveLanguage(languageInput)
  const size = pageSize(manifest)
  const motion = manifest.motion !== false
  const slides = manifest.slides
  const noteIndexes = []
  slides.forEach((slide, index) => {
    if (typeof slide.notes === 'string' && slide.notes.trim() !== '') noteIndexes.push(index)
  })
  const hasNotesMaster = noteIndexes.length > 0
  const entries = [
    { name: '[Content_Types].xml', data: contentTypesXml(slides.length, noteIndexes) },
    { name: '_rels/.rels', data: rootRelXml() },
    { name: 'docProps/app.xml', data: appXml(slides.length, noteIndexes.length) },
    { name: 'docProps/core.xml', data: coreXml(manifest.title) },
    { name: 'ppt/presentation.xml', data: presentationXml(slides.length, hasNotesMaster, size) },
    { name: 'ppt/_rels/presentation.xml.rels', data: presentationRelXml(slides.length, hasNotesMaster) },
    { name: 'ppt/slideMasters/slideMaster1.xml', data: slideMasterXml(theme) },
    { name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: slideMasterRelXml() },
    { name: 'ppt/slideLayouts/slideLayout1.xml', data: slideLayoutXml(theme) },
    { name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: slideLayoutRelXml() },
    { name: 'ppt/theme/theme1.xml', data: themeXml(theme, manifest.style?.themeFonts) },
  ]
  if (hasNotesMaster) {
    entries.push({ name: 'ppt/notesMasters/notesMaster1.xml', data: notesMasterXml() })
    entries.push({ name: 'ppt/notesMasters/_rels/notesMaster1.xml.rels', data: notesMasterRelXml() })
  }
  slides.forEach((slide, index) => {
    const hasNotes = noteIndexes.includes(index)
    const layout = pickDesignLayout(manifest.style?.layouts, slide, backgroundTypeOfLayout(slide.layout))
    const textStyles = structuredClone(manifest.style?.textStyles ?? {})
    for (const [role, style] of Object.entries(layout?.textStyles ?? {})) textStyles[role] = { ...textStyles[role], ...style }
    entries.push({ name: 'ppt/slides/slide' + (index + 1) + '.xml', data: resizeSlideXml(slideXml({ ...slide, __layout: layout, __textStyles: textStyles }, index, slides.length, theme, language.attr, motion), size) })
    entries.push({ name: 'ppt/slides/_rels/slide' + (index + 1) + '.xml.rels', data: slideRelXml(hasNotes, index + 1) })
    if (hasNotes) {
      entries.push({ name: 'ppt/notesSlides/notesSlide' + (index + 1) + '.xml', data: notesSlideXml(slide.notes, language.attr) })
      entries.push({ name: 'ppt/notesSlides/_rels/notesSlide' + (index + 1) + '.xml.rels', data: notesSlideRelXml(index + 1) })
    }
  })
  return buildZip(entries)
}
