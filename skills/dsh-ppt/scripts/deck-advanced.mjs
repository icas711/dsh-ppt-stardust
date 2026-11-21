import {transformedBounds} from './deck-geometry.mjs'
import {preserveSceneChartFormatting} from './deck-chart-export.mjs'
import {pptxFontName} from './deck-pptx.mjs'
import {validateDeckPlan,generationFingerprint} from './deck-generation.mjs'
import {normalizeSceneTemplate,remapSceneLayout} from './deck-template-scene.mjs'
import {expandDiagramSlides,diagramToScene,restoreSemanticRepresentation} from './deck-diagrams.mjs'
import {scenePptxPlacement} from './deck-scene-pptx.mjs'
import {sceneContrastIssues} from './deck-scene-quality.mjs'
import { normalizePageSize, pageSize } from './deck-page.mjs'
import { assertLegacySlideInput, validateSlideRepresentation, normalizeSceneSlides, normalizeSceneSlide, mergeSceneTextStyles } from './deck-model.mjs'
import { PROJECT_SCHEMA_VERSION, MAX_PROJECT_HISTORY as MAX_HISTORY, normalizeProjectEnvelope, nextProjectRevision } from './deck-migrations.mjs'
import { mkdirSync, readFileSync, statSync, openSync, closeSync, rmSync, existsSync, unlinkSync } from 'node:fs'
import { resolve, dirname, extname, basename, join, isAbsolute } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { imageInfo } from './deck-image.mjs'
import { buildPptx, renderHtml, normalizeBuildOptions, normalizeSlides, resolveTheme, resolveLanguage, resolveDeckFileName, commitDeckArtifacts, DECK_VERSION, pptxEastAsianFont, backgroundTypeOfLayout, TEMPLATE_BACKGROUND_TYPES } from './deck-core.mjs'
import { MEDIA_LAYOUTS, mediaBoxes, LOGO_BOX, FOOTER_BOX, chartColors, normalizeChart } from './deck-media.mjs'
import { normalizeDataModel, prepareDataSlides, validateDataSnapshot, previewDataChange, dataNotes, dataReport } from './deck-data.mjs'
import { normalizeVisual, applyVisualActions } from './deck-visual.mjs'
import { normalizeDesignLayouts, pickDesignLayout, layoutAssetIds } from './deck-layouts.mjs'
import { fontFamily, normalizeTextStyles, normalizeThemeFonts, embedFontAssets, embedPptxFonts, MAX_FONTS } from './deck-fonts.mjs'
import { projectPaths, storedProjectPaths, pluginStorageDir } from './deck-storage.mjs'
export { readRenderReceipt } from './deck-render.mjs'
export { dataNotes, dataReport } from './deck-data.mjs'
export { buildDeck, buildThemePreview, listThemes, resolveTheme, resolveLanguage } from './deck-core.mjs'

const MAX_IMAGE = 5 * 1024 * 1024, MAX_ASSETS = 32 * 1024 * 1024, MAX_DOCUMENT = 64 * 1024 * 1024
const layouts = new Set(['cover', 'section', 'bullets', 'statement', 'closing', 'quote', 'table', ...MEDIA_LAYOUTS])
const hash = data => createHash('sha256').update(data).digest('hex')
const clone = value => structuredClone(value)
function abort(signal) { signal?.throwIfAborted() }
function semanticRenderOptions(options){
  const theme=resolveTheme(options.theme||scenarios.find(s=>s.id===options.template)?.theme),body=options.style?.textStyles?.body??{},font=body.fontFamily||options.brand?.fontFamily||options.style?.themeFonts?.minorLatin||pptxFontName(theme.fonts.body)
  return {pageSize:options.style?.pageSize,textStyles:options.style?.textStyles,accent:options.brand?.primaryColor??theme.palette.accent,color:options.brand?.textColor??theme.palette.fg,background:options.brand?.backgroundColor??theme.palette.bg,textStyle:{fontFamily:font.trim(),...(font!==font.trim()?{sourceTypeface:font}:{}),...(body.size?{size:body.size}:{})}}
}
function fail(message) { throw new Error('dsh-ppt：' + message) }

const scenarios = [
  { id: 'weekly', name: { zh: '工作周报', en: 'Weekly report', ru: 'Рабочая неделя' }, theme: 'data', sections: [['本周工作', 'This week', 'Текущая неделя'], ['完成情况', 'Progress', 'Статус'], ['问题与风险', 'Risks', 'Проблемы и риски'], ['下周计划', 'Next week', 'Планы на неделю']] },
  { id: 'defense', name: { zh: '论文答辩', en: 'Thesis defense', ru: 'Защита работы' }, theme: 'soft', sections: [['研究问题', 'Research question', 'Исследовательский вопрос'], ['相关研究', 'Related work', 'Связанные работы'], ['研究方法', 'Method', 'Метод'], ['研究结果', 'Results', 'Результаты'], ['结论与局限', 'Conclusions and limitations', 'Выводы и ограничения']] },
  { id: 'project', name: { zh: '项目汇报', en: 'Project update', ru: 'Отчёт по проекту' }, theme: 'swiss', sections: [['目标与范围', 'Goals and scope', 'Цели и охват'], ['进度与交付', 'Progress and delivery', 'Ход и поставка'], ['数据与证据', 'Evidence', 'Данные и доказательства'], ['风险与决策', 'Risks and decisions', 'Риски и решения'], ['下一步', 'Next steps', 'Дальнейшие шаги']] },
  { id: 'pitch', name: { zh: '项目路演', en: 'Pitch deck', ru: 'Питч-презентация' }, theme: 'velvet', sections: [['用户问题', 'Customer problem', 'Проблема клиента'], ['解决方案', 'Solution', 'Решение'], ['产品与证据', 'Product and evidence', 'Продукт и доказательства'], ['商业模式', 'Business model', 'Бизнес-модель'], ['计划与需求', 'Plan and ask', 'План и запрос']] },
]

export function listTemplates(lang = 'zh') {
  const id = resolveLanguage(lang).id, language = id === 'en' || id === 'ru' ? id : 'zh'
  return scenarios.map(s => ({ id: s.id, name: s.name[language], theme: s.theme,
    outline: s.sections.map(p => p[language === 'en' ? 1 : language === 'ru' ? 2 : 0]),
    slides: templateSlides(s, s.name[language], language) }))
}
function templateSlides(scenario, title, lang) {
  const en = lang === 'en', ru = lang === 'ru', L = (zh, english, ruText) => ru ? (ruText ?? english) : en ? english : zh
  return [{ layout: 'cover', title, subtitle: L('待填写：汇报人和日期', 'To fill: presenter and date', 'Заполнить: докладчик и дата') },
    ...scenario.sections.map(section => ({ layout: 'bullets', title: section[en ? 1 : ru ? 2 : 0], bullets: [L('待填写：具体事实、依据与下一步行动', 'To fill: specific facts, evidence and next action', 'Заполнить: конкретные факты, доказательства и следующий шаг')] })),
    { layout: 'closing', title: L('下一步行动', 'Next action', 'Следующее действие'), subtitle: L('待填写：负责人和时间', 'To fill: owner and deadline', 'Заполнить: ответственный и срок') }]
}

function addAsset(image, assets, cwd, page) {
  if (image.assetId && !image.src) {
    if (!assets[image.assetId]) fail(`${page} 找不到嵌入图片 ${image.assetId}`)
    return image.assetId
  }
  const source = String(image.src ?? '').trim()
  let bytes
  if (/^data:/i.test(source)) {
    const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(source)
    if (!match || source.length > MAX_IMAGE * 1.4) fail(`${page} 图片 data URI 无效或超过 5 MiB`)
    bytes = Buffer.from(match[2], 'base64')
  } else {
    if (!source || /^[a-z][a-z0-9+.-]*:/i.test(source) && !/^[a-z]:[\\/]/i.test(source)) fail(`${page} 图片需本地路径或 PNG/JPEG data URI，不支持外链`)
    const path = resolve(cwd, source)
    let size
    try { size = statSync(path).size } catch { fail(`${page} 图片不存在：${path}`) }
    if (size > MAX_IMAGE) fail(`${page} 图片超过 5 MiB：${path}`)
    try { bytes = readFileSync(path) } catch { fail(`${page} 图片无法读取：${path}`) }
  }
  if (bytes.length > MAX_IMAGE) fail(`${page} 图片超过 5 MiB`)
  const info = imageInfo(bytes, page), id = 'img-' + hash(bytes)
  assets[id] = { ...info, data: `data:${info.mime};base64,${bytes.toString('base64')}` }
  return id
}

function normalizeBrand(input, assets, cwd) {
  if (input === undefined || input === null) return undefined
  if (typeof input !== 'object' || Array.isArray(input)) fail('brand 必须是对象')
  const brand = {}
  for (const key of ['primaryColor', 'backgroundColor', 'textColor']) {
    if (input[key] !== undefined && input[key] !== '') {
      if (!/^#[\da-f]{6}$/i.test(input[key])) fail(`brand.${key} 必须为 #RRGGBB`)
      brand[key] = input[key].toUpperCase()
    }
  }
  if (input.fontFamily) {
    const font = String(input.fontFamily).trim()
    brand.fontFamily = fontFamily(font)
  }
  if (input.name) brand.name = String(input.name).slice(0, 100)
  if (input.footer) {
    if (String(input.footer).length > 100) fail('brand.footer 最多 100 字符')
    brand.footer = String(input.footer)
  }
  if (input.logo) brand.logoAssetId = addAsset({ src: input.logo }, assets, cwd, '品牌 Logo')
  else if (input.logoAssetId) {
    if (!assets[input.logoAssetId]) fail('品牌 Logo 嵌入资产不存在')
    brand.logoAssetId = input.logoAssetId
  }
  return brand
}
function brandedTheme(manifest) {
  const theme = clone(resolveTheme(manifest.theme)), brand = manifest.brand
  if (brand?.primaryColor) theme.palette.accent = brand.primaryColor
  if (brand?.backgroundColor) theme.palette.bg = brand.backgroundColor
  if (brand?.textColor) theme.palette.fg = brand.textColor
  if (brand?.fontFamily) theme.fonts = { heading: JSON.stringify(brand.fontFamily), body: JSON.stringify(brand.fontFamily) }
  if (manifest.style?.textStyles?.title?.fontFamily) theme.fonts.heading = JSON.stringify(manifest.style.textStyles.title.fontFamily)
  if (manifest.style?.textStyles?.body?.fontFamily) theme.fonts.body = JSON.stringify(manifest.style.textStyles.body.fontFamily)
  return theme
}
// Template slide backgrounds by page type: cover / section / content / closing.
function normalizeStyle(input, assets, cwd) {
  if (input === undefined || input === null) return undefined
  if (typeof input !== 'object' || Array.isArray(input)) fail('style 必须是对象')
  const pageSize = normalizePageSize(input.pageSize)
  const sceneLayouts = input.sceneLayouts === undefined ? undefined : normalizeSceneTemplate({schemaVersion:3,style:{layouts:input.sceneLayouts,...(pageSize?{pageSize}:{})}}, {assets}).style.layouts
  if (sceneLayouts && input.layouts) fail('mixed-template-layout: legacy layouts and scene layouts')
  const themeFonts = normalizeThemeFonts(input.themeFonts)
  const backgrounds = input.backgrounds ?? []
  const layouts = normalizeDesignLayouts(input.layouts, assets, (image, page) => addAsset(image, assets, cwd, page), fail)
  const fonts = input.fonts === undefined ? undefined : embedFontAssets(input.fonts, assets)
  const textStyles = normalizeTextStyles(input.textStyles)
  if (!Array.isArray(backgrounds) || backgrounds.length > 8) fail('style.backgrounds 需为不超过 8 项的数组')
  const seen = new Set(), normalized = []
  for (const [index, bg] of backgrounds.entries()) {
    if (bg === null) continue
    if (!bg || typeof bg !== 'object' || Array.isArray(bg)) fail(`style.backgrounds[${index}] 必须是对象`)
    const type = bg.layoutType
    if (!TEMPLATE_BACKGROUND_TYPES.includes(type)) fail(`style.backgrounds[${index}].layoutType 只支持 ${TEMPLATE_BACKGROUND_TYPES.join(' / ')}`)
    if (seen.has(type)) fail(`style.backgrounds 重复的 layoutType：${type}`)
    seen.add(type)
    if (!['contain', 'cover'].includes(bg.fit ?? 'cover')) fail(`style.backgrounds[${index}].fit 只支持 contain / cover`)
    // 引擎内规范形态是 assetId（已在资产里）；来自工具的 src 会在此嵌入
    const assetId = bg.src === undefined && bg.assetId
      ? (assets[bg.assetId] ? bg.assetId : fail(`style.backgrounds[${index}] 找不到背景资产 ${bg.assetId}`))
      : addAsset({ src: bg.src }, assets, cwd, `背景 ${type}`)
    normalized.push({ layoutType: type, assetId, fit: bg.fit ?? 'cover' })
  }
  if (!normalized.length && !layouts && !sceneLayouts && !fonts?.length && !textStyles && !pageSize && !themeFonts) return undefined
  return { ...(sceneLayouts ? {sceneLayouts} : {}), ...(themeFonts ? { themeFonts } : {}), ...(pageSize ? { pageSize } : {}), ...(normalized.length ? { backgrounds: normalized } : {}), ...(layouts ? { layouts } : {}), ...(fonts?.length ? { fonts } : {}), ...(textStyles ? { textStyles } : {}) }
}
function embedSlides(slides, assets, cwd) {
  return slides.map((slide, index) => {
    if (!slide.image) return slide
    const assetId = addAsset(slide.image, assets, cwd, `第 ${index + 1} 页`)
    const { src, ...image } = slide.image
    return { ...slide, image: { ...image, assetId } }
  })
}
function validateRawSlides(slides) {
  if (slides === undefined || slides === null) return
  if (!Array.isArray(slides)) fail('slides 必须是数组')
  slides.forEach((s, i) => {
    if (!s || typeof s !== 'object' || Array.isArray(s)) fail(`第 ${i + 1} 页必须是对象`)
    validateSlideRepresentation(s, `slides[${i}]`)
    if (s.layout === 'scene') return
    assertLegacySlideInput(s, `slides[${i}]`)
    if (s.layout && !layouts.has(s.layout)) fail(`第 ${i + 1} 页未知布局 ${s.layout}`)
    normalizeVisual(s.visual)
    if (s.chart && s.image) fail(`第 ${i + 1} 页不能同时放入 image 和 chart`)
    if (s.image && s.layout && !['image', 'image-left', 'image-right'].includes(s.layout)) fail(`第 ${i + 1} 页图片需使用 image / image-left / image-right 布局`)
    if (s.chart && s.layout && s.layout !== 'chart') fail(`第 ${i + 1} 页图表需使用 chart 布局`)
  })
}
function snapshot(manifest) {
  return clone(Object.fromEntries(['title', 'theme', 'language', 'motion', 'slides', 'brand', 'style', 'template', 'dataModel', 'generation'].filter(k => manifest[k] !== undefined).map(k => [k, manifest[k]])))
}
function collectAssets(manifest) {
  const ids = new Set()
  for (const state of [manifest, ...(manifest.history ?? [])]) {
    if (state.brand?.logoAssetId) ids.add(state.brand.logoAssetId)
    for (const face of state.style?.fonts ?? []) ids.add(face.assetId)
    for (const bg of state.style?.backgrounds ?? []) ids.add(bg.assetId)
    for (const layout of state.style?.sceneLayouts ?? []) {
      if(layout.backgroundAssetId)ids.add(layout.backgroundAssetId)
      for (const e of layout.elements) {if(e.assetId)ids.add(e.assetId);if(e.previewAssetId)ids.add(e.previewAssetId)}
    }
    for (const layout of state.style?.layouts ?? []) for (const id of layoutAssetIds(layout)) ids.add(id)
    for (const slide of state.slides) {
      if(slide.backgroundAssetId)ids.add(slide.backgroundAssetId)
      if (slide.image?.assetId) ids.add(slide.image.assetId)
      for (const e of slide.elements ?? []) { if (e.assetId) ids.add(e.assetId); if (e.previewAssetId) ids.add(e.previewAssetId) }
    }
  }
  manifest.assets = Object.fromEntries([...ids].map(id => [id, manifest.assets[id]]))
  const size = Object.entries(manifest.assets).filter(([id]) => !id.startsWith('font-')).reduce((sum, [, asset]) => sum + (asset?.data?.length ?? 0), 0)
  const fontSize = Object.entries(manifest.assets).filter(([id]) => id.startsWith('font-')).reduce((sum, [, asset]) => sum + (asset?.data?.length ?? 0), 0)
  if (fontSize > MAX_FONTS * 1.4) fail('Project fonts exceed 32 MiB')
  if (size > MAX_ASSETS * 1.4) fail('工程内图片总量超过 32 MiB，请压缩图片或减少图片')
}

function embeddedAssetError(asset, id) {
  try {
    if (!asset || typeof asset.data !== 'string' || asset.data.length > MAX_IMAGE * 1.4) fail('嵌入图片数据缺失或过大')
    const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(asset.data)
    if (!match) fail('嵌入图片格式无效')
    const bytes = Buffer.from(match[2], 'base64')
    if (bytes.length > MAX_IMAGE || bytes.toString('base64') !== match[2]) fail('嵌入图片编码无效或过大')
    const info = imageInfo(bytes, '嵌入图片')
    if (asset.width !== info.width || asset.height !== info.height || asset.mime !== info.mime || id !== 'img-' + hash(bytes)) fail('嵌入图片尺寸或内容摘要不匹配')
    return undefined
  } catch (error) { return error.message }
}

// This is a conservative fit estimate. Fonts and PowerPoint/WPS rendering still need visual inspection.
function textWidth(text) { return [...String(text ?? '')].reduce((n, c) => n + (/[^\x00-\xff]/.test(c) ? 1 : 0.55), 0) }
function contrast(a, b) {
  const lum = color => {
    const rgb = color.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722
  }
  const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05)
}
// Fixed translations for embedded-image validator messages (exact matches and
// “嵌入图片 <suffix>” combinations produced by imageInfo / embeddedAssetError).
const ASSET_ERROR_TEXT = {
  '嵌入图片数据缺失或过大': { en: 'Embedded image data is missing or too large.', ru: 'Данные внедрённого изображения отсутствуют или слишком велики.' },
  '嵌入图片格式无效': { en: 'Embedded image format is invalid.', ru: 'Недопустимый формат внедрённого изображения.' },
  '嵌入图片编码无效或过大': { en: 'Embedded image encoding is invalid or too large.', ru: 'Кодирование внедрённого изображения недопустимо или слишком велико.' },
  '嵌入图片尺寸或内容摘要不匹配': { en: 'Embedded image size or content digest mismatch.', ru: 'Размер или контрольная сумма внедрённого изображения не совпадают.' },
}
const ASSET_ERROR_SUFFIXES = [
  ['PNG 文件不完整', { en: 'Embedded PNG file is incomplete.', ru: 'Внедрённый файл PNG неполон.' }],
  ['PNG 数据截断', { en: 'Embedded PNG data is truncated.', ru: 'Данные внедрённого PNG усечены.' }],
  ['PNG 缺少图像数据', { en: 'Embedded PNG has no image data.', ru: 'Во внедрённом PNG нет данных изображения.' }],
  ['PNG 图像数据无法解码或过大', { en: 'Embedded PNG image data cannot be decoded or is too large.', ru: 'Данные изображения внедрённого PNG не декодируются или слишком велики.' }],
  ['JPEG 数据截断', { en: 'Embedded JPEG data is truncated.', ru: 'Данные внедрённого JPEG усечены.' }],
  ['JPEG 文件不完整', { en: 'Embedded JPEG file is incomplete.', ru: 'Внедрённый файл JPEG неполон.' }],
]
function localizeAssetError(text) {
  if (typeof text !== 'string') return undefined
  const exact = ASSET_ERROR_TEXT[text]
  if (exact) return exact
  if (text.startsWith('嵌入图片')) {
    const suffix = ASSET_ERROR_SUFFIXES.find(([key]) => text.includes(key))
    if (suffix) return suffix[1]
  }
  return undefined
}
function sceneTextOverflows(e,frame=e.frame){
  if(e.textFrame?.autoFit==='normal')return false
  const margins={left:91440,right:91440,top:45720,bottom:45720,...e.textFrame?.margins}
  const width=Math.max(1,frame.w-margins.left-margins.right),height=Math.max(0,frame.h-margins.top-margins.bottom)
  let estimated=0
  for(const p of e.paragraphs){
    let lineWidth=0,lineHeight=0
    const finish=()=>{estimated+=lineHeight||18*12700*1.2;lineWidth=0;lineHeight=0}
    for(const r of p.runs){
      if(r.break){finish();continue}
      const size=r.style?.size??e.textStyle?.size??18
      const leading=p.style?.lineSpacing??e.textFrame?.lineSpacing
      const h=leading?.kind==='pt'?leading.value*12700:size*12700*(leading?.value??1.2)
      for(const c of r.text){if(c==='\n'){lineHeight=Math.max(lineHeight,h);finish();continue}const w=textWidth(c)*size*12700;if(e.textFrame?.wrap!=='none'&&lineWidth+w>width&&lineWidth>0)finish();lineWidth+=w;lineHeight=Math.max(lineHeight,h)}
    }
    finish();estimated+=((p.style?.spaceBefore??0)+(p.style?.spaceAfter??0))*12700
  }
  return estimated>height
}
export function checkManifest(manifest) {
  const issues = [], theme = brandedTheme(manifest)
  const invalidAssets = new Map()
  const assetError = id => {
    if (!invalidAssets.has(id)) invalidAssets.set(id, embeddedAssetError(manifest.assets?.[id], id))
    return invalidAssets.get(id)
  }
  // Static-check texts in three languages. zh stays the canonical message/suggestion;
  // messageEn/suggestionEn/messageRu/suggestionRu are parallel fields for the GUI,
  // the deck review panel and localized tool output.
  const TEXT = {
    'missing-title': {
      zh: ['页面没有标题', '补充能说明本页内容的标题'],
      en: ['This slide has no title.', 'Add a title that explains the slide.'],
      ru: ['На слайде нет заголовка', 'Добавьте заголовок, который поясняет его содержание'],
    },
    'title-overflow': {
      zh: ['标题可能换行过多或超过标题区域', '缩短标题，把解释移入正文'],
      en: ['The title may wrap too much or exceed its area.', 'Shorten the title and move explanations into the body.'],
      ru: ['Заголовок может не поместиться из-за переносов', 'Сократите заголовок, объяснение перенесите в текст слайда'],
    },
    'dense-bullets': {
      zh: ({ count }) => `本页有 ${count} 条要点，放映时过密`,
      en: ({ count }) => `This slide has ${count} bullets — too dense when presenting.`,
      ru: ({ count }) => `На слайде ${count} тезисов — при показе это слишком плотно`,
    },
    'dense-bullets-suggestion': {
      zh: ['减少要点或拆成多页'],
      en: ['Reduce the bullets or split them across slides.'],
      ru: ['Уменьшите число тезисов или разнесите их на несколько слайдов'],
    },
    'body-overflow': {
      zh: ['正文估计超过可用高度', '先精简文字，再分拆页面，避免继续缩小字体'],
      en: ['The body may exceed the available height.', 'Shorten or split the text before reducing font size.'],
      ru: ['Текст, по оценке, не помещается по высоте', 'Сначала сократите текст и разнесите его по слайдам, не уменьшая шрифт дальше'],
    },
    'template-unfilled': {
      zh: ['模板中还有待填写内容', '提供实际事实、依据和行动，填完后重新检查'],
      en: ['Template placeholders remain.', 'Fill in actual facts, evidence and actions, then check again.'],
      ru: ['В шаблоне остались незаполненные места', 'Внесите фактические данные, основания и действия, затем проверьте снова'],
    },
    'small-font': {
      zh: ['表格超过 6 列，使用 14pt，小屏放映可能难以阅读', '减少列数或把重点数据改成图表，导出后检查可读性'],
      en: ['This table uses more than 6 columns at 14pt and may be hard to read.', 'Reduce the columns or use a chart; check readability after export.'],
      ru: ['В таблице больше 6 колонок при 14pt — на небольшом экране читать трудно', 'Уменьшите число колонок или замените ключевые данные диаграммой; проверьте читаемость после экспорта'],
    },
    'table-density': {
      zh: ['表格单元格文字较长，可能换行拥挤', '精简单元格或减少列数'],
      en: ['Long table cells may cause crowded wrapping.', 'Shorten the cells or reduce the columns.'],
      ru: ['Текст в ячейках таблицы длинный — перенос может стать тесным', 'Сократите текст ячеек или уменьшите число колонок'],
    },
    'missing-image': {
      zh: ['找不到本页的嵌入图片', '重新指定图片路径后编辑本页'],
      en: ['The embedded image of this slide is missing.', 'Edit the slide with a valid image.'],
      ru: ['Внедрённое изображение этого слайда не найдено', 'Отредактируйте слайд, указав корректное изображение'],
    },
    'invalid-image-suggestion': {
      zh: ['重新提供本地图片后编辑该页'],
      en: ['Replace it with a valid local image and edit the slide.'],
      ru: ['Замените изображение корректным локальным файлом и отредактируйте слайд'],
    },
    'low-resolution': {
      zh: ({ w, h }) => `图片为 ${w}×${h}，放大后可能模糊`,
      en: ({ w, h }) => `The image is ${w}×${h} and may look blurry when enlarged.`,
      ru: ({ w, h }) => `Изображение ${w}×${h} — при увеличении может быть размытым`,
    },
    'low-resolution-suggestion': {
      zh: ['换成更高分辨率图片；Logo 等小图可忽略此提示'],
      en: ['Use a higher-resolution image. Small logos may be acceptable.'],
      ru: ['Используйте изображение с бо́льшим разрешением; для мелких логотипов это некритично'],
    },
    'missing-alt': {
      zh: ['图片没有说明文字', '填写 image.alt，方便读屏及理解图片'],
      en: ['The image has no description.', 'Fill in image.alt for accessibility and context.'],
      ru: ['У изображения нет описания', 'Заполните image.alt — это нужно для читалок и понимания картинки'],
    },
    'invalid-chart': {
      zh: ['图表数据无效'],
      en: ['The chart data is invalid.'],
      ru: ['Данные диаграммы недопустимы'],
    },
    'invalid-chart-suggestion': {
      zh: ['修正图表类别和数值'],
      en: ['Check the chart categories, series and numeric values.'],
      ru: ['Проверьте категории, ряды и числовые значения диаграммы'],
    },
    'chart-density': {
      zh: ['图表类别较多或标签较长，可能相互遮挡', '减少类别，或使用横向条形图'],
      en: ['Chart categories or labels may overlap.', 'Reduce categories or use a horizontal bar chart.'],
      ru: ['Категорий диаграммы много или подписи длинные — они могут перекрываться', 'Уменьшите число категорий или используйте горизонтальные полосы'],
    },
    'chart-legend': {
      zh: ['图例名称较长', '精简系列名称并检查渲染'],
      en: ['Chart legend labels are long.', 'Shorten the series names and check the render.'],
      ru: ['Подписи легенды длинные', 'Сократите названия рядов и проверьте рендер'],
    },
    'low-contrast': {
      zh: ['正文与背景对比度低于 4.5:1', '调整品牌背景色或文字色'],
      en: ['Body text and background contrast is below 4.5:1.', 'Adjust the brand background or text colour.'],
      ru: ['Контраст текста и фона ниже 4.5:1', 'Скорректируйте цвет фона или текста бренда'],
    },
    'contrast-unverified': {
      zh: ['无法静态确认该对象的文字对比度', '背景含图片、局部覆盖或颜色变换；请查看实际渲染'],
      en: ['Text contrast could not be verified for this object.', 'Inspect the render: the background is an image, partial overlay or has colour transforms.'],
      ru: ['Контраст текста объекта не проверен', 'Просмотрите рендер: фон содержит изображение, частичное перекрытие или преобразования цвета'],
    },
    'missing-logo': {
      zh: ['品牌 Logo 资产不存在', '重新提供 Logo'],
      en: ['The brand logo asset is missing.', 'Provide the logo again.'],
      ru: ['Внедрённый логотип бренда отсутствует', 'Предоставьте логотип снова'],
    },
    'invalid-logo-suggestion': {
      zh: ['重新提供 Logo'],
      en: ['Replace the logo with a valid image.'],
      ru: ['Замените логотип корректным изображением'],
    },
  }
  const text = (code, lang, field = 0, args) => {
    const entry = TEXT[code]?.[lang] ?? TEXT[code]?.zh ?? TEXT[code]?.en ?? TEXT[code]?.ru
    const value = Array.isArray(entry) ? entry[field] : entry
    return typeof value === 'function' ? value(args ?? {}) : String(value ?? '')
  }
  const issue = (index, code, { severity = 'warning', detail, suggestionCode, args } = {}) => {
    const assetText = detail === undefined ? undefined : localizeAssetError(detail)
    issues.push({
      slide: index + 1, slideId: manifest.slides[index]?.id, severity, code,
      message: detail ?? text(code, 'zh', 0, args),
      suggestion: suggestionCode ? text(suggestionCode, 'zh') : text(code, 'zh', 1, args),
      messageEn: detail === undefined ? text(code, 'en', 0, args) : (assetText?.en ?? text(code, 'en', 0, args)),
      suggestionEn: suggestionCode ? text(suggestionCode, 'en') : (TEXT[code + '-suggestion'] ? text(code + '-suggestion', 'en') : text(code, 'en', 1, args)),
      messageRu: detail === undefined ? text(code, 'ru', 0, args) : (assetText?.ru ?? text(code, 'ru', 0, args)),
      suggestionRu: suggestionCode ? text(suggestionCode, 'ru') : (TEXT[code + '-suggestion'] ? text(code + '-suggestion', 'ru') : text(code, 'ru', 1, args)),
    })
  }
  manifest.slides.forEach((slide, i) => {
    if (slide.layout === 'scene') {
      const size = pageSize(manifest)
      for(const finding of sceneContrastIssues(slide,{background:theme.palette.bg,textColor:theme.palette.fg})){
        issue(i,finding.code);Object.assign(issues.at(-1),finding)
      }
      for (const e of slide.elements) {
        const id = e.assetId ?? e.previewAssetId
        if (id && assetError(id)) issue(i, 'invalid-image', {severity:'error', detail:assetError(id), suggestionCode:'invalid-image-suggestion'})
        if (e.slotId && /待填写|To fill:|Заполнить:/i.test(JSON.stringify(e.paragraphs ?? e.table ?? e.chart?.categories ?? e.alt ?? ''))) issue(i,'template-unfilled')
        if (e.support?.mode === 'lossy') issues.push({slide:i+1,slideId:slide.id,elementId:e.id,code:'lossy-object',severity:'warning',message:e.support.reason,messageRu:e.support.reason,messageEn:e.support.reason})
        if (e.type === 'unsupported') issues.push({slide:i+1,slideId:slide.id,elementId:e.id,code:'unsupported-object',severity:'warning',message:e.reason,messageRu:e.reason,messageEn:e.reason})
        if(e.type==='text'&&e.role!=='decor'&&!e.hidden&&sceneTextOverflows(e,scenePptxPlacement(e))){issue(i,'body-overflow');issues.at(-1).elementId=e.id}
        const bounds=transformedBounds(e.frame,e.transform)
        if (!e.hidden && (bounds.x < 0 || bounds.y < 0 || bounds.x+bounds.w > size.width || bounds.y+bounds.h > size.height)) issues.push({slide:i+1,slideId:slide.id,elementId:e.id,code:'outside-slide',severity:'warning',message:'Object extends beyond slide',messageRu:'Объект выходит за границы слайда',messageEn:'Object extends beyond slide'})
      }
      return
    }
    if (!slide.title?.trim()) issue(i, 'missing-title')
    const titleLimit = ['cover', 'closing', 'statement', 'quote', 'section'].includes(slide.layout) ? 40 : 24
    if (textWidth(slide.title) > titleLimit) issue(i, 'title-overflow')
    const mixed = ['image-left', 'image-right'].includes(slide.layout), bullets = slide.bullets ?? []
    if (bullets.length > (mixed ? 5 : 8)) issue(i, 'dense-bullets', { args: { count: bullets.length }, suggestionCode: 'dense-bullets-suggestion' })
    const width = mixed ? 19 : 37
    const lines = bullets.reduce((sum, b) => sum + Math.max(1, Math.ceil(textWidth(b) / width)), 0)
      + (slide.subtitle ? Math.ceil(textWidth(slide.subtitle) / width) : 0)
    if (lines > (mixed ? 9 : 11)) issue(i, 'body-overflow')
    const design = pickDesignLayout(manifest.style?.layouts, slide, backgroundTypeOfLayout(slide.layout))
    const missingImage = design?.familyId && (design.textZones?.filter(z => z.kind === 'image').length ?? 0) > (slide.image ? 1 : 0)
    if (missingImage || [slide.title, slide.subtitle, ...bullets].some(s => /待填写|To fill:|Заполнить:/i.test(String(s)))) issue(i, 'template-unfilled')
    if (slide.layout === 'table') {
      if ((slide.rows?.[0]?.length ?? 0) > 6) issue(i, 'small-font')
      if (slide.rows?.some(row => row.some(c => textWidth(c) > 18))) issue(i, 'table-density')
    }
    if (slide.image) {
      const asset = manifest.assets?.[slide.image.assetId], box = mediaBoxes(slide.layout).image
      if (!asset) issue(i, 'missing-image', { severity: 'error' })
      else {
        if (assetError(slide.image.assetId)) issue(i, 'invalid-image', { severity: 'error', detail: assetError(slide.image.assetId), suggestionCode: 'invalid-image-suggestion' })
        if (asset.width < box.w * 100 || asset.height < box.h * 100) issue(i, 'low-resolution', { args: { w: asset.width, h: asset.height }, suggestionCode: 'low-resolution-suggestion' })
      }
      if (!slide.image.alt?.trim()) issue(i, 'missing-alt')
    }
    if (slide.chart) {
      try { normalizeChart(slide.chart, i + 1) } catch (error) { issue(i, 'invalid-chart', { severity: 'error', detail: error.message, suggestionCode: 'invalid-chart-suggestion' }) }
      if (slide.chart.categories?.length > 10 || slide.chart.categories?.some(c => textWidth(c) > 10)) issue(i, 'chart-density')
      if (slide.chart.series?.some(s => textWidth(s.name) > 14)) issue(i, 'chart-legend')
    }
    if (contrast(theme.palette.bg, theme.palette.fg) < 4.5) issue(i, 'low-contrast')
  })
  if (manifest.brand?.logoAssetId && !manifest.assets?.[manifest.brand.logoAssetId]) issue(0, 'missing-logo', { severity: 'error' })
  else if (manifest.brand?.logoAssetId && assetError(manifest.brand.logoAssetId)) issue(0, 'invalid-logo', { severity: 'error', detail: assetError(manifest.brand.logoAssetId), suggestionCode: 'invalid-logo-suggestion' })
  const reportLanguage = manifest.language === 'ru' ? 'ru' : manifest.language === 'en' ? 'en' : 'zh'
  const suggestions = {ru:'Проверьте объект в итоговом рендере; выход декора за край может быть частью оформления.',en:'Inspect the object in the final render; artwork may intentionally extend beyond the page.',zh:'请检查最终渲染；装饰对象可能有意超出页面。'}
  const localizedIssues = issues.map(issue => ({...issue,
    message: reportLanguage === 'ru' ? issue.messageRu ?? issue.message : reportLanguage === 'en' ? issue.messageEn ?? issue.message : issue.message,
    suggestion: (reportLanguage === 'ru' ? issue.suggestionRu : reportLanguage === 'en' ? issue.suggestionEn : issue.suggestion) ?? issue.suggestion ?? suggestions[reportLanguage],
  }))
  return { ok: !issues.some(i => i.severity === 'error'), slideCount: manifest.slides.length, language:reportLanguage,
    errorCount: issues.filter(i => i.severity === 'error').length, warningCount: issues.filter(i => i.severity === 'warning').length,
    issues:localizedIssues, note: reportLanguage === 'ru' ? 'Размеры текста и переполнение — статическая оценка; проверьте итоговый HTML и отображение в PowerPoint / WPS. Мелкий текст колонтитулов и номеров страниц не считается основным текстом.' : reportLanguage === 'en' ? 'Text size and overflow are static estimates; verify HTML playback and PowerPoint / WPS rendering. Small footer and page-number text is not counted as body text.' : '文字尺寸与溢出为静态估算；最终请检查 HTML 放映和 PowerPoint / WPS 实际显示。页脚和页码的小字号不计入正文检查。',
    noteEn: 'Text size and overflow are static estimates; verify the actual HTML playback and PowerPoint / WPS rendering. Small footer and page-number text is not counted as body text.',
    noteRu: 'Размеры текста и переполнение — статическая оценка; итоговую вёрстку проверяйте в HTML-показе и в PowerPoint / WPS. Мелкий текст колонтитула и номеров страниц телом слайда не считается.' }
}

async function exportPptx(manifest, theme, language, signal) {
  const size = pageSize(manifest), SLIDE_W_IN = size.width / 914400, SLIDE_H_IN = size.height / 914400
  const base = buildPptx({ ...manifest, _deferSceneCharts:true, slides: manifest.slides.map(s => ({ ...s, notes: dataNotes(manifest,s) })) }, theme, language)
  if (manifest.slides.every(s => s.layout === 'scene')) {
    if (!manifest.slides.some(s => s.elements.some(e => e.type === 'chart'))) return embedPptxFonts(base, manifest)
    const lib = await import('@office-kit/pptx')
    const presentation = await lib.loadPresentation(base)
    for (const [index,source] of manifest.slides.entries()) {
      const slide = lib.getSlides(presentation)[index]
      for (const e of source.elements.filter(e => e.type === 'chart')) {
        abort(signal)
        const marker = lib.getSlideShapes(slide).find(shape=>lib.getShapeName(shape)==='__scene_chart__'+e.id&&lib.getShapeDescription(shape)===e.id)
        if (!marker) fail('Missing native chart placeholder '+e.id)
        const at = lib.getShapeZIndex(marker), placement = scenePptxPlacement(e)
        lib.removeShape(marker)
        const {amountLabels,...nativeChart}=e.chart
        const spec=nativeChart.legend?.position==='none'?{...nativeChart,legend:undefined}:nativeChart
        const chart = lib.addSlideChart(slide,{name:e.name ?? e.id,x:placement.x,y:placement.y,w:placement.w,h:placement.h,spec})
        lib.setShapeRotation(chart,placement.rotation/60000)
        if(e.hidden)lib.setShapeHidden(chart,true)
        if (placement.flipV) lib.setShapeFlip(chart,{vertical:true})
        lib.setShapeZIndex(chart,at)
      }
    }
    return embedPptxFonts(preserveSceneChartFormatting(Buffer.from(await lib.savePresentation(presentation))),manifest)
  }
  const hasBackgrounds = (Array.isArray(manifest.style?.backgrounds) && manifest.style.backgrounds.some(bg => manifest.assets?.[bg.assetId]?.data)) || Boolean(manifest.style?.layouts?.length)
  if (!manifest.brand?.logoAssetId && !manifest.brand?.footer && !hasBackgrounds && !manifest.slides.some(s => s.image || s.chart)) return embedPptxFonts(base, manifest)
  abort(signal)
  let lib
  try { lib = await import('@office-kit/pptx') } catch (error) { fail('图片、图表和品牌导出需要 @office-kit/pptx@0.21.0。插件请重新安装；独立技能请在技能目录运行 npm install --ignore-scripts。' + error.message) }
  abort(signal)
  const presentation = await lib.loadPresentation(base), slides = lib.getSlides(presentation)
  const scaleBox = box => ({ x: box.x * SLIDE_W_IN / 13.3333333333, y: box.y * SLIDE_H_IN / 7.5, w: box.w * SLIDE_W_IN / 13.3333333333, h: box.h * SLIDE_H_IN / 7.5 })
  const emu = box => Object.fromEntries(Object.entries(box).map(([k, v]) => [k, Math.round(v * 914400)]))
  // 模板背景：按页面类型铺底图（cover / section / content / closing）
  const backgrounds = Array.isArray(manifest.style?.backgrounds) ? manifest.style.backgrounds : []
  const backgroundBytes = new Map()
  for (const bg of backgrounds) {
    const asset = manifest.assets?.[bg.assetId]
    if (!asset?.data) continue
    try {
      const bytes = Buffer.from(asset.data.split(',')[1] ?? '', 'base64')
      if (bytes.length) backgroundBytes.set(bg.layoutType, bytes)
    } catch {}
  }
  if (backgroundBytes.size) {
    manifest.slides.forEach((source, index) => {
      if (pickDesignLayout(manifest.style?.layouts, source, backgroundTypeOfLayout(source.layout))) return
      const bytes = backgroundBytes.get(backgroundTypeOfLayout(source.layout))
      if (bytes) lib.setSlideBackgroundImage(slides[index], bytes)
    })
  }
  const putImage = (slide, id, box, fit, name, alt) => {
    const asset = manifest.assets[id], bytes = Buffer.from(asset.data.split(',')[1], 'base64')
    const shape = lib.addSlideImage(slide, bytes, { ...emu(box), name, fit: fit === 'contain' ? 'contain' : 'fill' })
    lib.setShapeDescription(shape, alt || name)
    if (fit === 'cover') {
      const natural = asset.width / asset.height, target = box.w / box.h
      const fraction = natural > target ? (1 - target / natural) / 2 : (1 - natural / target) / 2
      lib.setShapeImageCrop(shape, natural > target ? { left: fraction, right: fraction } : { top: fraction, bottom: fraction })
    }
    return shape
  }
  const putImageShape = (slide, id, box, fit, name) => putImage(slide, id, box, fit, name, name)
  // Макеты шаблона: фон макета и его картинки кладутся под текст слайда (в PPTX — PNG/JPEG; SVG только в HTML).
  manifest.slides.forEach((source, index) => {
    const layout = pickDesignLayout(manifest.style?.layouts, source, backgroundTypeOfLayout(source.layout))
    if (!layout) return
    const slide = slides[index], bgAsset = layout.backgroundAssetId && manifest.assets?.[layout.backgroundAssetId]
    const layers = []
    if (layout.backgroundColor) lib.setSlideBackground(slide, layout.backgroundColor)
    if (bgAsset?.data) layers.push(['Template background', layout.backgroundAssetId, { x: 0, y: 0, w: SLIDE_W_IN, h: SLIDE_H_IN }, layout.fit === 'contain' ? 'contain' : 'cover'])
    for (const image of [...(layout.images ?? [])].sort((a, b) => a.z - b.z)) {
      if (!manifest.assets?.[image.assetId]?.data) continue
      layers.push([`Template ${image.role ?? 'image'}`, image.assetId, { x: image.x / 100 * SLIDE_W_IN, y: image.y / 100 * SLIDE_H_IN, w: image.w / 100 * SLIDE_W_IN, h: image.h / 100 * SLIDE_H_IN }, image.fit === 'fill' ? 'fill' : image.fit])
    }
    // Каждый следующий слой отправляется «назад» в обратном порядке, чтобы итоговый порядок совпал с z.
    const shapes = layers.map(([name, id, box, fit]) => putImageShape(slide, id, box, fit, name))
    for (let i = shapes.length - 1; i >= 0; i--) lib.sendShapeToBack(shapes[i])
  })
  manifest.slides.forEach((source, index) => {
    abort(signal)
    const slide = slides[index], boxes = mediaBoxes(source.layout)
    const design = pickDesignLayout(manifest.style?.layouts, source, backgroundTypeOfLayout(source.layout))
    const imageZone = design?.familyId && design.textZones?.find(z => z.kind === 'image')
    const imageBox = imageZone ? { x: imageZone.x / 100 * SLIDE_W_IN, y: imageZone.y / 100 * SLIDE_H_IN, w: imageZone.w / 100 * SLIDE_W_IN, h: imageZone.h / 100 * SLIDE_H_IN } : scaleBox(boxes.image)
    if (source.image) putImage(slide, source.image.assetId, imageBox, source.image.fit, 'Slide image', source.image.alt)
    if (source.chart) {
      const colors = chartColors(theme), font = pptxEastAsianFont(theme.fonts.body)
      const style = { font, sizePt: source.visual?.chartLabelSize ?? 17, color: theme.palette.fg }
      lib.addSlideChart(slide, { ...emu(scaleBox(boxes.chart)), name: 'Editable data chart', spec: {
        kind: source.chart.kind, categories: source.chart.categories,
        series: source.chart.series.map((s, i) => ({ ...s, color: colors[i], ...(source.chart.kind === 'pie' ? { pointColors: source.chart.categories.map((_, j) => colors[j % colors.length]) } : {}) })),
        chartAreaFill: theme.palette.bg, chartAreaStrokeColor: theme.palette.bg, plotAreaFill: theme.palette.bg,
        categoryAxisLabelStyle: style, valueAxisLabelStyle: style,
        valueAxisMinorTickMark: 'none', categoryAxisMinorTickMark: 'none', valueAxisMajorTickMark: 'none', categoryAxisMajorTickMark: 'none',
        valueAxisMajorGridlines: true, valueAxisMajorGridlineColor: theme.palette.panel,
        ...(source.chart.kind === 'bar' ? { categoryAxisOrientation: 'maxMin', valueAxisCrosses: 'max' } : {}),
        ...(source.chart.kind === 'pie' ? { dataLabels: { showPercent: true, showValue: false, showCategory: false, showSeriesName: false, numberFormat: '0.0%', position: 'bestFit', textStyle: style } } : {}),
        ...(source.chart.unit ? { valueAxisTitle: source.chart.unit, valueAxisTitleStyle: style } : {}),
        legend: { position: 'b', textStyle: style },
      } })
    }
    if (manifest.brand?.logoAssetId) putImage(slide, manifest.brand.logoAssetId, scaleBox(LOGO_BOX), 'contain', 'Brand logo', manifest.brand.name)
    if (manifest.brand?.footer) {
      const footer = lib.addSlideTextBox(slide, { ...emu(scaleBox(FOOTER_BOX)), text: manifest.brand.footer, name: 'Brand footer' })
      lib.setShapeTextFormat(footer, { size: 10, font: pptxEastAsianFont(theme.fonts.body), color: theme.palette.muted })
    }
  })
  const invalid = lib.validatePresentation(presentation).filter(i => i.severity === 'error')
  if (invalid.length) fail('PPTX 结构校验失败：' + invalid.map(i => i.message).join('；'))
  const bytes = await lib.savePresentation(presentation)
  abort(signal)
  return embedPptxFonts(Buffer.from(bytes), manifest)
}

function documentBytes(manifest) {
  const text = JSON.stringify(manifest, null, 2) + '\n'
  if (Buffer.byteLength(text) > MAX_DOCUMENT) fail('JSON 工程含历史超过 64 MiB，请缩减图片或清理历史后另存工程')
  return text
}
function result(manifest, paths) {
  return { ok: true, title: manifest.title, theme: manifest.theme, language: manifest.language,
    slideCount: manifest.slides.length, deckId: manifest.deckId, revision: manifest.revision,
    slides: manifest.slides.map((s, i) => ({ slide: i + 1, id: s.id, title: s.label ?? s.title ?? '', layout: s.layout })),
    undoAvailable: manifest.history.length, deliveryStatus: manifest.quality?.issues.some(i => i.code === 'template-unfilled') ? 'draft' : 'ready-for-review',
    quality: manifest.quality, ...(manifest.generation?{generationReport:{...manifest.generation.report,stale:manifest.generation.contentFingerprint!==generationFingerprint(manifest.slides)}}:{}), verification: { static: 'checked', pptxRender: 'not-verified', visual: 'not-verified' }, outputDir: dirname(paths.html),
    internalProject: !!manifest.delivery,
    ...(manifest.delivery?.pdfWarning ? { pdfWarning: manifest.delivery.pdfWarning } : {}),
    files: { ...paths, ...(manifest.delivery && existsSync(paths.pptx.slice(0, -5) + '.pdf') ? { pdf: paths.pptx.slice(0, -5) + '.pdf' } : {}) },
    ...(manifest.delivery && existsSync(paths.pptx.slice(0, -5) + '.pdf') ? { pdfPath: paths.pptx.slice(0, -5) + '.pdf' } : {}),
    htmlPath: paths.html, pptxPath: paths.pptx, jsonPath: paths.json }
}
function pathsFor(jsonPath) {
  return existsSync(jsonPath) ? storedProjectPaths(jsonPath) : projectPaths(jsonPath)
}

async function finishDelivery(manifest, paths, signal, render = renderDeck) {
  const value = result(manifest, paths)
  if (!manifest.delivery) return value
  delete value.pdfWarning
  try {
    const rendered = await render({ pptxPath: paths.pptx, format: 'pdf', signal, cacheScope: manifest.delivery.cacheScope })
    abort(signal)
    if (!rendered.ok || !rendered.pdfPath) throw new Error([rendered.message, rendered.installationHint].filter(Boolean).join('\n') || 'PDF renderer unavailable')
    withLock(paths.json, () => {
      const current = JSON.parse(readFileSync(paths.json, 'utf8'))
      if (current.revision !== manifest.revision || hash(readFileSync(paths.pptx)) !== rendered.sourceSha256) fail('Проект изменён во время экспорта PDF; повторите экспорт')
      const pdf = paths.pptx.slice(0, -5) + '.pdf'
      commitDeckArtifacts([{ path: pdf, data: readFileSync(rendered.pdfPath) }])
      value.pdfPath = pdf
      value.files.pdf = pdf
    })
  } catch (error) {
    abort(signal)
    value.pdfWarning = 'PDF не создан: ' + error.message
  }
  // Keep the export explanation available in the workbench after the tool call.
  try {
    withLock(paths.json, () => {
      const current = JSON.parse(readFileSync(paths.json, 'utf8'))
      if (current.revision !== manifest.revision || current.deckId !== manifest.deckId) return
      if (value.pdfWarning) current.delivery.pdfWarning = value.pdfWarning
      else delete current.delivery.pdfWarning
      commitDeckArtifacts([{ path: paths.json, data: documentBytes(current), encoding: 'utf8' }])
    })
  } catch { /* A concurrent edit must not be overwritten by export metadata. */ }
  return value
}
function withLock(path, commit) {
  const lock = path + '.dsh-ppt-lock'
  let fd
  try { fd = openSync(lock, 'wx') } catch { fail('该工程正在被另一次修改，请稍后重试：' + path) }
  try { return commit() } finally { closeSync(fd); rmSync(lock, { force: true }) }
}
async function generate(manifest, signal) {
  abort(signal)
  validateSnapshot(manifest, manifest.assets)
  collectAssets(manifest)
  manifest.slideCount = manifest.slides.length
  manifest.quality = checkManifest(manifest)
  if (manifest.quality.errorCount) fail(manifest.quality.issues.filter(i => i.severity === 'error').map(i => `第 ${i.slide} 页：${i.message}`).join('；'))
  const theme = brandedTheme(manifest), language = resolveLanguage(manifest.language)
  const json = documentBytes(manifest)
  const pptx = await exportPptx(manifest, theme, language, signal)
  abort(signal)
  return { json, pptx, manifest, theme, language }
}
function commit(paths, data) {
  const html = renderHtml(data.manifest, data.theme, data.language, data.manifest.delivery ? { html: paths.html, pptx: paths.pptx } : paths)
  data.manifest.artifacts = { html: hash(html), pptx: hash(data.pptx) }
  commitDeckArtifacts([{ path: paths.json, data: documentBytes(data.manifest), encoding: 'utf8' }, { path: paths.html, data: html, encoding: 'utf8' }, { path: paths.pptx, data: data.pptx }])
  // A PDF from the previous revision must never be offered after a failed export.
  const pdf = paths.pptx.slice(0, -5) + '.pdf'
  if (data.manifest.delivery && existsSync(pdf)) unlinkSync(pdf)
}

function validateSnapshot(value, assets) {
  resolveTheme(value.theme); resolveLanguage(value.language)
  validateRawSlides(value.slides)
  const scenes = value.slides.some(s => s.layout === 'scene')
  if (scenes) {
    if (value.dataModel) fail('scene-data-binding-not-supported: explicit object bindings are required')
    value.slides = normalizeSceneSlides(value.slides, {assets})
  }
  validateDataSnapshot(value, normalizeSlides)
  if (value.brand != null) {
    if (Object.hasOwn(value.brand, 'logo')) fail('工程品牌仅支持嵌入的 logoAssetId，不读取本地 logo 路径')
    for (const key of ['primaryColor', 'backgroundColor', 'textColor', 'fontFamily', 'name', 'footer']) {
      if (value.brand[key] !== undefined && typeof value.brand[key] !== 'string') fail('工程 brand.' + key + ' 必须为字符串')
    }
    normalizeBrand(value.brand, assets, '.')
  }
  if (value.style != null) {
    const normalized = normalizeStyle(value.style, assets, '.')
    // 引擎内存储用 assetId；来自工具的 src 形式已在上面嵌入资产
    if (normalized) value.style = normalized
  }
  for (const slide of value.slides) {
    if (slide.image) {
      if (slide.image.fit !== undefined && !['contain', 'cover'].includes(slide.image.fit)) fail('工程 image.fit 只允许 contain / cover')
      if (slide.image.src !== undefined || !assets[slide.image.assetId]) fail('工程图片必须使用有效的嵌入资产')
    }
    if (slide.chart) normalizeChart(slide.chart)
  }
}
function artifactProblem(manifest, paths) {
  if (!manifest.artifacts) return '旧工程没有成品校验记录，无法确认外部修改；请另存副本，保留原文件。'
  for (const kind of ['html', 'pptx']) {
    try { if (hash(readFileSync(paths[kind])) === manifest.artifacts[kind]) continue } catch {}
    return kind.toUpperCase() + ' 已在外部修改或缺失，不会覆盖；请另存副本。副本从 JSON 生成，不导入 Office 手工修改。 Project '+manifest.deckId+': delivery files changed or are missing (possibly overwritten by a new ppt_create project). Use the current project jsonPath, or saveAs:true to recover this JSON as a separate copy; do not retry against shared delivery paths.'
  }
}

export async function buildDeckAsync(options = {}) {
  options = {...options,slides:expandDiagramSlides(options.slides,semanticRenderOptions(options))}
  abort(options.signal)
  validateRawSlides(options.slides)
  const scenario = options.template ? scenarios.find(s => s.id === options.template) : undefined
  if (options.template && !scenario) fail('未知 template，请使用 weekly / defense / project / pitch')
  const input = { ...options, theme: options.theme || scenario?.theme,
    ...(!options.content?.trim() && !options.slides?.length && scenario ? { slides: templateSlides(scenario, String(options.title ?? ''), options.lang) } : {}) }
  const cwd = resolve(options.cwd || '.')
  const dataModel = options.dataModel ? normalizeDataModel(options.dataModel, { cwd, allowFiles:true }) : undefined
  if (dataModel && (!Array.isArray(input.slides) || !input.slides.length)) fail('数据绑定需使用结构化 slides / Data binding requires structured slides')
  const prepared = dataModel ? prepareDataSlides(input.slides, dataModel, normalizeSlides, resolveLanguage(input.lang).id) : undefined
  const normalized = normalizeBuildOptions({ ...input, ...(prepared ? { slides:prepared } : {}) })
  if(prepared) normalized.deck.slides = prepared
  const assets = clone(options.assets ?? {})
  const brand = normalizeBrand(options.brand, assets, cwd)
  const style = normalizeStyle(options.style, assets, cwd)
  let generation
  if(options.generation!==undefined){
    if(options.generation?.version!==1||!style?.sceneLayouts)fail('generation-plan-invalid: expected versioned plan and scene template')
    const report=validateDeckPlan(options.generation.plan,style.sceneLayouts,{pageSize:style.pageSize,policy:options.generation.policy})
    if(!report.valid)fail('generation-plan-invalid: '+report.diagnostics.filter(d=>d.severity==='error').map(d=>d.message).join('; '))
    generation={version:1,plan:clone(options.generation.plan),report,contentFingerprint:generationFingerprint(normalized.deck.slides)}
  }
  const lineage = options.templateLineage
  if (lineage !== undefined && (lineage === null || typeof lineage !== 'object' || Array.isArray(lineage)
    || typeof lineage.id !== 'string' || !Number.isInteger(lineage.revision))) fail('templateLineage 需为 { id, revision }')
  const manifest = { version: DECK_VERSION, schemaVersion: normalized.deck.slides.every(s => s.layout === 'scene') ? 2 : PROJECT_SCHEMA_VERSION, deckId: randomUUID(), revision: 0,
    title: normalized.title, theme: normalized.theme.id, language: normalized.language.id, motion: normalized.motion,
    ...(scenario ? { template: scenario.id } : {}), ...(lineage ? { template: { id: lineage.id, revision: lineage.revision } } : {}),
    ...(brand ? { brand } : {}), ...(style ? { style } : {}), ...(dataModel ? {dataModel} : {}), ...(generation?{generation}:{}), assets, history: [],
    slides: embedSlides(normalized.deck.slides, assets, cwd).map(s => ({ ...s, id: s.layout==='scene' ? s.id??randomUUID() : randomUUID() })) }
  const data = await generate(manifest, options.signal)
  mkdirSync(normalized.outputDir, { recursive: true })
  // Resolve collisions after asynchronous rendering; an earlier call may have committed meanwhile.
  const file = resolveDeckFileName(normalized.outputDir, normalized.fileName, normalized.overwrite)
  let paths = pathsFor(resolve(normalized.outputDir, file + '.json'))
  if (options.internalProject === true) {
    const directory = join(pluginStorageDir(), 'projects', manifest.deckId)
    mkdirSync(directory, { recursive: true, mode: 0o700 })
    manifest.delivery = { base: resolve(normalized.outputDir, file), ...(options.cacheScope ? {cacheScope: options.cacheScope} : {}) }
    paths = projectPaths(join(directory, file + '.json'), manifest)
  }
  withLock(paths.json, () => { abort(options.signal); commit(paths, data) })
  return finishDelivery(manifest, paths, options.signal, options.renderPdf)
}

/**
 * HTML-only rendering for editors (template preview): nothing is written to disk,
 * no PPTX is built and the quality gate is skipped, so it is cheap enough to call
 * on every edit. Accepts the same theme / brand / style / slides arguments as buildDeckAsync.
 */
export function previewDeckHtml(options = {}) {
  options = {...options,slides:expandDiagramSlides(options.slides,semanticRenderOptions(options))}
  validateRawSlides(options.slides)
  const normalized = normalizeBuildOptions({ ...options, outputDir: '.' })
  const cwd = resolve('.'), assets = clone(options.assets ?? {})
  const brand = normalizeBrand(options.brand, assets, cwd)
  const style = normalizeStyle(options.style, assets, cwd)
  const manifest = { version: DECK_VERSION, schemaVersion: PROJECT_SCHEMA_VERSION, deckId: 'preview', revision: 0,
    title: normalized.title, theme: normalized.theme.id, language: normalized.language.id, motion: false,
    ...(brand ? { brand } : {}), ...(style ? { style } : {}), assets, history: [],
    slides: embedSlides(normalized.deck.slides, assets, cwd).map((slide, index) => ({ ...slide, id: 'preview-' + (index + 1) })) }
  validateSnapshot(manifest, manifest.assets)
  collectAssets(manifest)
  manifest.slideCount = manifest.slides.length
  const html = renderHtml(manifest, brandedTheme(manifest), resolveLanguage(manifest.language), { pptx: 'preview.pptx', json: 'preview.json' })
  const quality=checkManifest(manifest)
  quality.issues=quality.issues.map(issue=>{const element=manifest.slides[issue.slide-1]?.elements?.find(e=>e.id===issue.elementId);return {...issue,...(element?.name?{elementName:element.name}:{}),scope:'sample'}})
  return { ok: true, html, slideCount: manifest.slideCount,quality,fitAssessment:'estimated' }
}

function readDocument(pathInput, cwd = '.') {
  const path = resolve(cwd, String(pathInput ?? ''))
  if (!pathInput || extname(path).toLowerCase() !== '.json') fail('deckPath 需指向本插件生成的 .json 工程')
  if (statSync(path).size > MAX_DOCUMENT) fail('工程文件超过 64 MiB')
  const bytes = readFileSync(path)
  let document
  try { document = JSON.parse(bytes) } catch { fail('JSON 工程无法解析：' + path) }
  const fingerprint = hash(bytes)
  document = normalizeProjectEnvelope(document, {fingerprint})
  if (document.delivery !== undefined && (!document.delivery || typeof document.delivery.base !== 'string' || !isAbsolute(document.delivery.base))) fail('Некорректные пути выдачи проекта')
  resolveTheme(document.theme); resolveLanguage(document.language)
  validateSnapshot(document, document.assets)
  for (const prior of document.history) validateSnapshot(prior, document.assets)
  if (document.artifacts !== undefined && (!document.artifacts || typeof document.artifacts !== 'object'
    || ['html', 'pptx'].some(kind => !/^[a-f0-9]{64}$/.test(document.artifacts[kind])))) fail('工程成品校验记录无效')
  for (const slide of document.slides) {
    if (!slide || slide.layout !== 'scene' && !layouts.has(slide.layout)) fail('工程含有未知页面布局')
  }
  return { manifest: document, path, fingerprint }
}
/** Validated project snapshot for the operator workbench; no file is modified. */
export function readDeckProject(options = {}) {
  abort(options.signal)
  const { manifest, path } = readDocument(options.deckPath, options.cwd)
  return { manifest: clone(manifest), path }
}
function expected(manifest, revision) {
  if (revision !== undefined && (!Number.isInteger(revision) || revision !== manifest.revision)) fail(`修订号冲突：当前 revision=${manifest.revision}，请重新读取工程后修改`)
}
async function saveRevision(state, next, signal, saveAs = false, preserveUndo = false) {
  if (!saveAs) { const problem = artifactProblem(state.manifest, pathsFor(state.path)); if (problem) fail(problem) }
  next.version = DECK_VERSION; next.schemaVersion = next.slides.every(s => s.layout === 'scene') ? 2 : PROJECT_SCHEMA_VERSION; next.revision = saveAs ? 0 : nextProjectRevision(state.manifest.revision)
  if (saveAs) { next.deckId = randomUUID(); next.revision = 0; next.history = preserveUndo ? [snapshot(state.manifest)] : [] }
  const data = await generate(next, signal)
  let paths = pathsFor(state.path)
  withLock(state.path, () => {
    abort(signal)
    if (hash(readFileSync(state.path)) !== state.fingerprint) fail('工程已被其他操作修改，请重新读取后重试')
    if (saveAs) {
      const directory = next.delivery ? dirname(paths.html) : dirname(state.path)
      const file = resolveDeckFileName(directory, basename(paths.html, '.html') + '-dsh', false)
      if (next.delivery) {
        next.delivery = { ...next.delivery, base: resolve(directory, file) }
        const projectDir = dirname(state.path)
        mkdirSync(projectDir, { recursive: true, mode: 0o700 })
        paths = projectPaths(join(projectDir, file + '.json'), next)
      } else paths = pathsFor(resolve(dirname(state.path), file + '.json'))
    } else {
      const problem = artifactProblem(state.manifest, paths); if (problem) fail(problem)
    }
    commit(paths, data)
  })
  return finishDelivery(next, paths, signal)
}

/** Convert every historical state before committing a schema 2 project. Failure leaves all files untouched. */
async function migrateLegacyContent(manifest,signal){
  if(manifest.schemaVersion===2)return clone(manifest)
  const {legacySlidesToScenes}=await import('./deck-legacy-scene.mjs')
  const document=clone(manifest)
  for(const value of [document,...document.history]){
    const adapted=await legacySlidesToScenes({...value,assets:document.assets},{theme:brandedTheme(value),language:resolveLanguage(value.language),renderPptx:exportPptx,signal})
    Object.assign(document.assets,adapted.assets)
    value.slides=adapted.slides
    value.style={...value.style,pageSize:adapted.pageSize}
    delete value.schemaVersion
  }
  document.schemaVersion=2
  return document
}
export async function migrateDeckToScenes(options={}) { return editDeck({...options,convertToScene:true}) }

export async function editDeck(options = {}) {
  abort(options.signal)
  const state = readDocument(options.deckPath, options.cwd)
  expected(state.manifest, options.expectedRevision)
  const current = options.convertToScene === true || options.edits?.some(e=>e.patch?.layout==='diagram') ? await migrateLegacyContent(state.manifest,options.signal) : state.manifest
  const next = clone(current)
  if (options.assets !== undefined) {
    if (!options.assets || typeof options.assets !== 'object' || Array.isArray(options.assets)) fail('Invalid scene asset bag')
    Object.assign(next.assets,clone(options.assets))
  }
  if (!Array.isArray(options.edits) || !options.edits.length) {
    if (options.brand === undefined && options.theme === undefined && options.style === undefined && options.templateLineage === undefined && options.order === undefined && options.duplicate === undefined && options.remove === undefined && options.append === undefined && options.saveAs !== true && options.convertToScene !== true) fail('请提供 edits、order、duplicate、remove、append、brand、theme 或 style')
  }
  const used = new Set(), allowed = new Set(['layout', 'title', 'subtitle', 'kicker', 'text', 'bullets', 'rows', 'notes', 'image', 'chart', 'visual'])
  for (const edit of options.edits ?? []) {
    const index = typeof edit.slide === 'number' && Number.isInteger(edit.slide) ? edit.slide - 1 : next.slides.findIndex(s => s.id === edit.slide)
    if (index < 0 || index >= next.slides.length) fail('找不到要修改的页面：' + edit.slide)
    if (used.has(index)) fail('一次修改不能重复指定同一页：' + (index + 1))
    used.add(index)
    if (!edit.patch || typeof edit.patch !== 'object' || Array.isArray(edit.patch)) fail('第 ' + (index + 1) + ' 页 patch 需为对象; use edits:[{slide: '+(index+1)+', patch:{elementUpdates:[{id:"existing-id", changes:{paragraphs:[{runs:[{text:"New text"}]}]}}]}}]')
    if(edit.patch.restoreRepresentation!==undefined){if(Object.keys(edit.patch).some(k=>k!=='restoreRepresentation'))fail('Restore representation must be a separate explicit operation');next.slides[index]=restoreSemanticRepresentation(next.slides[index],edit.patch.restoreRepresentation,{...semanticRenderOptions(next),assets:next.assets});continue}
    if (edit.patch.layout === 'diagram') {
      if(Object.keys(edit.patch).some(k=>!['layout','diagram','title','notes'].includes(k)))fail('Diagram patches only accept layout, diagram, title and notes')
      const original=state.manifest.slides.find(s=>s.id===next.slides[index].id)
      const title=edit.patch.title??original.title??original.label??''
      const source=original.layout==='scene'?original.elements.filter(e=>e.type==='text'&&e.role!=='decor').flatMap(e=>e.paragraphs.map(p=>p.runs.map(r=>r.text??'').join(''))).filter(t=>t&&t!==title):[original.subtitle,original.kicker,original.text,...(original.bullets??[])].filter(Boolean)
      const labels=(edit.patch.diagram?.items??[]).flatMap(item=>[item.label,item.detail,item.date].filter(Boolean)).join('\n')
      if(edit.patch.diagram?.kind!=='chart'&&source.some(text=>!labels.includes(text)))fail('diagram-content-unmapped: include every source text in diagram labels/details')
      if(edit.patch.diagram?.kind==='chart'&&source.length)fail('diagram-content-unmapped: create a separate numeric chart from explicit categories and values; retain the source list')
      const converted=diagramToScene({layout:'diagram',title,notes:edit.patch.notes??original.notes,diagram:edit.patch.diagram},semanticRenderOptions(next))
      next.slides[index]={...converted,id:next.slides[index].id}
      continue
    }
    validateSlideRepresentation({ ...next.slides[index], ...edit.patch }, `slides[${index}]`)
    if (next.slides[index].layout === 'scene') {
      for (const key of Object.keys(edit.patch)) if (!['elements','elementUpdates','notes','label','purpose','designLayout','backgroundColor'].includes(key)) fail('Unsupported scene patch: '+key)
      const {elementUpdates,...patch}=edit.patch
      if(elementUpdates!==undefined){
        if(patch.elements!==undefined)fail('Use either elements (full replacement) or elementUpdates (preserve other objects), not both')
        if(!Array.isArray(elementUpdates)||!elementUpdates.length||elementUpdates.length>256)fail('elementUpdates requires 1–256 {id, changes} entries')
        const updates=new Map()
        for(const update of elementUpdates){
          if(!update||typeof update.id!=='string'||!update.changes||typeof update.changes!=='object'||Array.isArray(update.changes)||Object.keys(update).some(k=>!['id','changes'].includes(k)))fail('elementUpdates entries require {id, changes:{...}}')
          if(updates.has(update.id)||!next.slides[index].elements.some(e=>e.id===update.id))fail('Duplicate or unknown elementUpdates ID on slide '+(index+1)+': '+update.id)
          if(Object.hasOwn(update.changes,'id')||Object.hasOwn(update.changes,'type'))fail('elementUpdates cannot change id or type: '+update.id)
          updates.set(update.id,update.changes)
        }
        patch.elements=next.slides[index].elements.map(e=>{
          const changes=updates.get(e.id)
          return changes?{...e,...changes,...(changes.textStyle?{textStyle:mergeSceneTextStyles(e.textStyle,changes.textStyle)}:{})}:e
        })
      }
      next.slides[index] = normalizeSceneSlide({...next.slides[index],...patch}, {assets:next.assets,path:`slides[${index}] (slide ${index+1})`})
      continue
    }
    assertLegacySlideInput({ ...next.slides[index], ...edit.patch }, `slides[${index}]`)
    for (const key of Object.keys(edit.patch)) if (!allowed.has(key)) fail('不支持修改页面字段：' + key)
    validateRawSlides([edit.patch])
    const changed = { ...next.slides[index], ...next.slides[index].dataTemplate, ...edit.patch }
    delete changed.dataTemplate
    for (const key of Object.keys(changed)) if (changed[key] === null) delete changed[key]
    if (edit.patch.chart) { if (!edit.patch.layout) changed.layout = 'chart'; if (changed.layout === 'chart') delete changed.image }
    if (edit.patch.image) { if (!edit.patch.layout && !['image', 'image-left', 'image-right'].includes(changed.layout)) changed.layout = 'image-right'; if (['image', 'image-left', 'image-right'].includes(changed.layout)) delete changed.chart }
    if (edit.patch.layout && !MEDIA_LAYOUTS.has(edit.patch.layout)) { delete changed.image; delete changed.chart }
    validateRawSlides([changed])
    let slides
    try { slides = next.dataModel ? prepareDataSlides([changed], next.dataModel, normalizeSlides, next.language) : normalizeSlides([changed], 120, next.language) } catch (error) { fail(`第 ${index + 1} 页修改失败：${error.message}`) }
    if (slides.length !== 1) fail(`第 ${index + 1} 页修改会产生分页，请减少表格行数或另建演示文稿`)
    const embedded = embedSlides(slides, next.assets, resolve(options.cwd || '.'))[0]
    next.slides[index] = { ...embedded, id: current.slides[index].id }
  }
  if (options.order !== undefined) {
    if (!Array.isArray(options.order) || options.order.length !== next.slides.length || options.order.some(id => typeof id !== 'string') || new Set(options.order).size !== next.slides.length) fail('order 必须包含每个页面 ID，且各出现一次')
    const byId = new Map(next.slides.map(slide => [slide.id, slide]))
    if (options.order.some(id => !byId.has(id))) fail('order 含有不属于本工程的页面 ID')
    next.slides = options.order.map(id => byId.get(id))
  }
  function selectedIds(value, field) {
    if (value === undefined) return new Set()
    if (!Array.isArray(value) || value.length === 0 || value.length > 120) fail(field + ' 需为 1-120 个页码或页面 ID')
    const ids = value.map(ref => {
      const slide = typeof ref === 'number' && Number.isInteger(ref) ? current.slides[ref - 1] : current.slides.find(s => s.id === ref)
      if (!slide) fail(field + ' 找不到页面：' + ref)
      return slide.id
    })
    if (new Set(ids).size !== ids.length) fail(field + ' 不能重复指定同一页')
    return new Set(ids)
  }
  const duplicate = selectedIds(options.duplicate, 'duplicate'), remove = selectedIds(options.remove, 'remove')
  if ([...duplicate].some(id => remove.has(id))) fail('同一页不能同时复制和删除')
  const count = next.slides.length + duplicate.size - remove.size
  if (count < 1) fail('至少保留一页')
  if (count > 120) fail('工程页数超过 120')
  if (duplicate.size || remove.size) next.slides = next.slides.flatMap(slide => remove.has(slide.id) ? [] :
    duplicate.has(slide.id) ? [slide, { ...clone(slide), id: randomUUID() }] : [slide])
  if (options.append !== undefined) {
    if (!Array.isArray(options.append) || options.append.length < 1 || options.append.length > 5) fail('append 需为 1-5 页')
    validateRawSlides(expandDiagramSlides(options.append,semanticRenderOptions(next)))
    let added
    if(next.slides[0].layout==='scene'){
      const expanded=expandDiagramSlides(options.append,semanticRenderOptions(next))
      if(expanded.every(s=>s.layout==='scene'))added=normalizeSceneSlides(expanded,{assets:next.assets})
      else{
        if(expanded.some(s=>s.layout==='scene'))fail('Append cannot mix legacy slides and scenes')
        const {legacySlidesToScenes}=await import('./deck-legacy-scene.mjs')
        const adapted=await legacySlidesToScenes({...next,slides:normalizeSlides(expanded,120,next.language)},{theme:brandedTheme(next),language:resolveLanguage(next.language),renderPptx:exportPptx,signal:options.signal})
        Object.assign(next.assets,adapted.assets);added=adapted.slides
      }
    }else added=next.dataModel?prepareDataSlides(options.append,next.dataModel,normalizeSlides,next.language):normalizeSlides(options.append,120,next.language)
    if (next.slides.length + added.length > 120) fail('工程页数超过 120')
    next.slides.push(...embedSlides(added, next.assets, resolve(options.cwd || '.')).map(slide => ({ ...slide, id: randomUUID() })))
  }
  if (options.brand !== undefined) next.brand = normalizeBrand(options.brand === null ? null : { ...next.brand, ...options.brand,
    ...(options.brand?.logo === null ? { logo: undefined, logoAssetId: undefined } : {}) }, next.assets, resolve(options.cwd || '.'))
  // Restyle support: swap the base theme (template application). null clears template lineage.
  if (options.theme !== undefined) {
    if (options.theme === null) delete next.template
    else {
      try { resolveTheme(options.theme) } catch { fail('未知主题：' + options.theme) }
      next.theme = resolveTheme(options.theme).id
    }
  }
  if (options.style !== undefined) {
    next.style = normalizeStyle(options.style, next.assets, resolve(options.cwd || '.'))
    if (next.style?.sceneLayouts && next.slides.every(s=>s.layout==='scene')) {
      next.slides = next.slides.map(slide=>{
        const existing=current.style?.sceneLayouts?.find(l=>l.id===slide.designLayout)
        const from=existing??{slots:slide.elements.filter(e=>e.role!=='decor'&&['text','image','table','chart'].includes(e.type)).map(e=>({id:e.slotId??'slot-'+e.id,elementId:e.id,type:e.type}))}
        const target=next.style.sceneLayouts.find(l=>l.id===(options.layoutMap?.[slide.id]??slide.designLayout))??(next.style.sceneLayouts.length===1?next.style.sceneLayouts[0]:undefined)
        if(!target)fail('Choose a target variant in layoutMap for slide '+slide.id)
        return remapSceneLayout(slide,from,target,{...semanticRenderOptions(next),assets:next.assets}).slide
      })
    }
  }
  // Template lineage: { id, revision } for library templates; null clears it. A
  // bare string stays reserved for scenario ids and is rejected here.
  if (options.templateLineage !== undefined) {
    const lineage = options.templateLineage
    if (lineage === null) delete next.template
    else {
      if (!lineage || typeof lineage !== 'object' || Array.isArray(lineage) || typeof lineage.id !== 'string' || !Number.isInteger(lineage.revision) || lineage.revision < 1) fail('templateLineage 需为 { id, revision }')
      next.template = { id: lineage.id, revision: lineage.revision }
    }
  }
  if (options.convertToScene !== true && options.saveAs !== true && JSON.stringify(snapshot(next)) === JSON.stringify(snapshot(current))) return { ...result(current, pathsFor(state.path)), changed: false }
  next.history = [...next.history, snapshot(current)].slice(-MAX_HISTORY)
  return { ...await saveRevision(state, next, options.signal, options.saveAs === true, options.preserveUndo === true), changed: true }
}

/** An AI-selected, bounded formatting vocabulary; always an undoable new copy. */
export async function repairDeckVisual(options = {}) {
  abort(options.signal)
  const state = readDocument(options.deckPath, options.cwd)
  expected(state.manifest, options.expectedRevision)
  const next = clone(state.manifest)
  next.slides = applyVisualActions(next, options.actions)
  // Splitting can move the only binding off a continuation page. Rebuild each
  // page's canonical template so plain fields do not remain falsely bound.
  if (next.dataModel) next.slides = next.slides.map(slide => ({ ...prepareDataSlides([slide], next.dataModel, normalizeSlides, next.language)[0], id: slide.id }))
  if (JSON.stringify(next.slides) === JSON.stringify(state.manifest.slides)) fail('排版操作没有变化 / Formatting actions made no changes')
  return saveRevision(state, next, options.signal, true, true)
}

export async function undoDeck(options = {}) {
  abort(options.signal)
  const state = readDocument(options.deckPath, options.cwd)
  expected(state.manifest, options.expectedRevision)
  if (!state.manifest.history.length) fail('该工程没有可撤销的修改')
  const next = clone(state.manifest), prior = next.history.pop()
  for (const key of ['brand', 'style', 'template', 'dataModel']) delete next[key]
  Object.assign(next, prior)
  return saveRevision(state, next, options.signal)
}

function dataChange(state, options) {
  expected(state.manifest, options.expectedRevision)
  const packet=options.scenario
  if(packet && (packet.schemaVersion!==1||packet.deckId!==state.manifest.deckId||packet.revision!==state.manifest.revision||packet.fingerprint!==state.manifest.dataModel?.fingerprint))fail('推演参数来自其他工程或旧版本，请重新导出 / Scenario belongs to another project or revision')
  return previewDataChange(state.manifest,{...options,...(packet?{parameters:packet.parameters}:{})},normalizeSlides)
}
export function previewDeckData(options = {}) {
  abort(options.signal)
  const state=readDocument(options.deckPath, options.cwd)
  return { ok:true, deckId:state.manifest.deckId, revision:state.manifest.revision, ...dataChange(state,options).preview }
}
export async function updateDeckData(options = {}) {
  abort(options.signal)
  const state=readDocument(options.deckPath,options.cwd),change=dataChange(state,options)
  if(options.confirmed!==true||options.expectedRevision===undefined||options.previewToken!==change.preview.token)fail('请先预览差异，再携带修订号与预览凭证确认 / Preview changes and confirm with the revision and preview token')
  if(!change.preview.changed)return {...result(state.manifest,pathsFor(state.path)),changed:false}
  const next={...clone(state.manifest),dataModel:change.model,slides:change.slides,history:[...state.manifest.history,snapshot(state.manifest)].slice(-MAX_HISTORY)}
  return {...await saveRevision(state,next,options.signal,options.saveAs!==false,true),changed:true}
}

export function checkDeck(options = {}) {
  abort(options.signal)
  const { manifest, path } = readDocument(options.deckPath, options.cwd)
  const quality = checkManifest(manifest), problem = artifactProblem(manifest, pathsFor(path))
  if (problem) {
    quality.issues.push({ slide: 0, severity: 'error', code: 'artifact-conflict', message: quality.language==='ru'?'Файлы выдачи изменены или отсутствуют; текущий JSON может относиться к старому проекту.':quality.language==='en'?'Delivery files changed or are missing; this JSON may belong to an older project.':problem, suggestion: quality.language==='ru'?'Используйте jsonPath актуального проекта либо saveAs:true для восстановления отдельной копии из этого JSON.':quality.language==='en'?'Use the current project jsonPath or saveAs:true to recover a separate copy from this JSON.':'保留原成品，使用 saveAs:true 或面板「另存副本」。副本不包含 Office 手工修改。' })
    quality.errorCount++; quality.ok = false
  }
  let selectedSlide
  if(options.slide!==undefined){
    // Prefer exact IDs, including numeric-looking IDs, before accepting a page string.
    const exact=manifest.slides.findIndex(s=>s.id===options.slide)
    const numeric=typeof options.slide==='number'?options.slide:typeof options.slide==='string'&&/^[1-9]\d*$/.test(options.slide)?Number(options.slide):NaN
    const index=exact>=0?exact:Number.isSafeInteger(numeric)?numeric-1:-1
    if(index<0||index>=manifest.slides.length)fail('Unknown slide: '+options.slide+'; use a 1-based page number (e.g. slide:1) or an existing slide ID: '+manifest.slides.map(s=>s.id).join(', '))
    selectedSlide={slide:index+1,...clone(manifest.slides[index])}
  }
  return { ...quality, deckPath: path, deckId: manifest.deckId, revision: manifest.revision,
    ...(selectedSlide?{selectedSlide}:{}),
    ...(manifest.generation?{generationReport:{...manifest.generation.report,stale:manifest.generation.contentFingerprint!==generationFingerprint(manifest.slides)}}:{}),
    verification: { static: 'checked', pptxRender: 'not-verified', visual: 'not-verified' },
    undoAvailable: manifest.history.length, slides: manifest.slides.map((s, i) => ({ slide: i + 1, id: s.id, title: s.label ?? s.title ?? '', layout: s.layout })),
    template: manifest.template ?? null }
}

export async function checkDeckAsync(options = {}) {
  const report = checkDeck(options)
  if (options.renderReceipt === undefined) return report
  if (typeof options.renderReceipt !== 'string' || !options.renderReceipt.trim()) fail('renderReceipt 需为收据文件路径')
  const { readRenderReceipt } = await import('./deck-render.mjs')
  abort(options.signal)
  report.render = await readRenderReceipt(pathsFor(report.deckPath).pptx, resolve(options.cwd || '.', options.renderReceipt))
  if (report.render.status === 'rendered') report.verification.pptxRender = 'rendered'
  return report
}

export async function renderDeck(options = {}) {
  abort(options.signal)
  if (typeof options.pptxPath !== 'string' || !options.pptxPath.trim()) fail('pptxPath 需为 PPTX 文件路径')
  if (options.outputDir !== undefined && (typeof options.outputDir !== 'string' || !options.outputDir.trim())) fail('outputDir 需为目录路径')
  const renderer = await import('./deck-render.mjs')
  abort(options.signal)
  const cwd = options.cwd || '.'
  return renderer.renderDeck({ ...options, pptxPath: resolve(cwd, options.pptxPath),
    ...(options.outputDir !== undefined ? { outputDir: resolve(cwd, options.outputDir) } : {}) })
}
