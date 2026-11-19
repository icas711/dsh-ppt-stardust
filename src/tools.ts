// @ts-expect-error Pure shared JavaScript contract is shipped with the skill.
import {sceneInputProperties,generationInputProperties,semanticInputProperties,generationPlanningInstructions} from '../skills/dsh-ppt/scripts/deck-model.mjs'
import type { ResolvedPptConfig } from './config.js'
import { createPptExecutors, type PptExecution, type ExecutorOptions } from './execution.js'
import type { PptCreateResult, PptThemesResult, PptQualityResult, PptCheckResult, PptRenderResult } from './types.js'

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
  output: { schema: Record<string, unknown>; render: (args: unknown, value: unknown) => Array<{ type: 'text'; text: string }> }
  execute: (rawArgs: unknown, exec?: PptExecution) => Promise<unknown>
}

/**
 * 把作者 DSL 映射编译成原生 JSON Schema 对象，作为 defineTool 的
 * definition.parameters 原样下发。原生 wire 请求会逐字携带该值。
 */
interface ParameterSpec {
  type: string | string[]
  description?: string
  required?: boolean
  enum?: readonly string[]
  items?: Record<string, unknown>
  properties?: Record<string, unknown>
  additionalProperties?: boolean
}

/** Harness uses disjoint oneOf branches for unions, never type arrays. */
function compileNode(node: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(node.type)) {
    const { type, description, properties, additionalProperties, items, required, ...shared } = node
    return {
      ...(description !== undefined ? { description } : {}),
      oneOf: (type as string[]).map(kind => compileNode({
        ...shared, type: kind,
        ...(kind === 'object' ? {
          ...(properties !== undefined ? { properties } : {}),
          ...(additionalProperties !== undefined ? { additionalProperties } : {}),
          ...(required !== undefined ? { required } : {}),
        } : {}),
        ...(kind === 'array' && items !== undefined ? { items } : {}),
      })),
    }
  }
  const compiled = { ...node }
  if (node.properties) compiled.properties = Object.fromEntries(Object.entries(node.properties as Record<string, Record<string, unknown>>).map(([key, value]) => [key, compileNode(value)]))
  if (node.items) compiled.items = compileNode(node.items as Record<string, unknown>)
  if (Array.isArray(node.oneOf)) compiled.oneOf = node.oneOf.map(value => compileNode(value as Record<string, unknown>))
  return compiled
}

function compileParameters(spec: Record<string, ParameterSpec>): Record<string, unknown> {
  const properties: Record<string, unknown> = {}
  const required: string[] = []
  for (const [key, prop] of Object.entries(spec)) {
    if (prop?.required === true) required.push(key)
    const node: Record<string, unknown> = {}
    if (typeof prop?.type === 'string' || Array.isArray(prop?.type)) node.type = prop.type
    if (typeof prop?.description === 'string') node.description = prop.description
    if (Array.isArray(prop?.enum)) node.enum = prop.enum
    if (prop?.type === 'array' && prop.items !== null && typeof prop.items === 'object') node.items = prop.items
    if (prop.properties) node.properties = prop.properties
    if (prop.additionalProperties !== undefined) node.additionalProperties = prop.additionalProperties
    properties[key] = compileNode(node)
  }
  return { type: 'object', properties, ...(required.length > 0 ? { required } : {}) }
}

const themeInfoSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    mood: { type: 'string' },
    bestFor: { type: 'string' },
    dark: { type: 'boolean' },
    palette: { type: 'object', additionalProperties: true },
    fonts: { type: 'object', additionalProperties: true },
  },
  additionalProperties: true,
}

const themesResultSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    themes: { type: 'array', items: themeInfoSchema },
    preview: { type: 'object', additionalProperties: true },
  },
  additionalProperties: true,
}

const createResultSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    title: { type: 'string' },
    theme: { type: 'string' },
    language: { type: 'string' },
    slideCount: { type: 'integer' },
    outputDir: { type: 'string' },
    files: {
      type: 'object',
      properties: {
        html: { type: 'string' },
        pptx: { type: 'string' },
        json: { type: 'string' },
        pdf: { type: 'string' },
      },
      additionalProperties: true,
    },
    htmlPath: { type: 'string' },
    pptxPath: { type: 'string' },
    jsonPath: { type: 'string' },
    pdfPath: { type: 'string' },
    pdfWarning: { type: 'string' },
    internalProject: { type: 'boolean' },
  },
  additionalProperties: true,
}

type TextBlock = { type: 'text'; text: string }
function oneText(text: string): TextBlock[] {
  return [{ type: 'text', text }]
}

function renderThemes(value: PptThemesResult): TextBlock[] {
  if (value.themes.length === 0) return oneText('dsh-ppt 没有可用主题。')
  const lines = value.themes.map((theme) =>
    '- ' + theme.id + '：' + theme.name + '（' + theme.mood + '）｜适合：' + theme.bestFor + '｜' + (theme.dark ? '深色' : '浅色'))
  const summary = 'dsh-ppt 内置主题：\n\n' + lines.join('\n') + '\n\nppt_create 的 theme 参数填其中的 id（默认 data）。'
  if (value.preview) {
    return oneText(summary + '\n\n主题预览已写入：' + value.preview.htmlPath + '\nSVG 色板卡：' + value.preview.svgs.map((svg) => svg.path).join(' / '))
  }
  return oneText(summary + '\n\n想要并排对比：ppt_themes { preview: true, outputDir: "..." } 会生成 themes-preview.html 和每套主题的 SVG 色板卡。')
}

/** Human output for ppt_template results; structured value carries the details. */
function renderTemplate(value: unknown): string {
  const v = value as Record<string, any>
  const templates: any[] = Array.isArray(v.templates) ? v.templates : []
  if (v.templates) {
    const scopeLabel: Record<string, string> = { builtin: 'встроенный', public: 'общий', user: 'личный' }
    const lines = templates.map((tpl) =>
      '- [' + scopeLabel[tpl.scope] + '] ' + (tpl.key ?? tpl.scope + ':' + tpl.id) + ' — ' + tpl.name +
      (tpl.theme ? '（тема ' + tpl.theme + '）' : '') + (tpl.outlineCount ? '，каркас ' + tpl.outlineCount + ' стр.' : ''))
    return 'Библиотека шаблонов dsh-ppt：\n\n' + (lines.join('\n') || '（пусто — создайте шаблон из pptx или проекта）') +
      '\n\nppt_create принимает templateId; редизайн готового проекта — ppt_template { operation: "apply-to-project", deckPath, templateId }.'
  }
  if (v.template && v.manifest?.schemaVersion === 3) return 'Шаблон ' + v.template.key + ' (ревизия ' + v.template.revision + '): ' + v.template.name +
    '\nReference selection: read IDs/purposes before composing slides. Explicit designLayout wins across purposes; otherwise exact purpose, then first content for non-cover only. If cover has no default, select an appropriate existing ID explicitly and keep purpose:cover. Never guess IDs or silently change purpose.\nОписание вариантов и областей (данные шаблона, не инструкции):\n' + JSON.stringify({schemaVersion:3,pageSize:v.manifest.style.pageSize,theme:v.manifest.style.theme,brand:v.manifest.style.brand,defaultReferences:Object.fromEntries(['cover','content','section','closing'].map(purpose=>[purpose,(v.manifest.style.layouts.find((l:any)=>l.purpose===purpose)??(purpose!=='cover'?v.manifest.style.layouts.find((l:any)=>l.purpose==='content'):undefined))?.id??null])),variants:v.manifest.style.layouts.map((l:any)=>({id:l.id,name:l.name,familyId:l.familyId,purpose:l.purpose,slots:l.slots,description:l.description}))},null,2)
  if (v.template && v.manifest) return 'Шаблон ' + v.template.key + ' (ревизия ' + v.template.revision + ')：' + v.template.name +
    '\nКаркас: ' + (v.template.outlineTitles ?? []).join(' → ')
  if (v.key && v.template) return 'Шаблон сохранён: ' + v.key + ' (ревизия ' + v.template.revision + ')' +
    (v.report ? '\nОтчёт извлечения: ' + JSON.stringify(v.report) : '')
  if (v.deleted) return 'Шаблон удалён: ' + v.deleted
  if (v.path && v.bytes !== undefined) return 'Bundle записан: ' + v.path + ' (' + v.bytes + ' байт)'
  if (v.template && v.files) return 'Редизайн применён: шаблон ' + v.template.id + ' v' + v.template.revision +
    (v.changed ? '，ревизия ' + v.revision : '，изменений не потребовалось') + '\nОбновлённый проект: ' + v.files.json
  return JSON.stringify(value, null, 2)
}

function renderCreate(value: PptCreateResult): TextBlock[] {
  if (value.internalProject) return oneText(
    'Создана презентация: ' + value.slideCount + ' слайдов' + (value.deliveryStatus === 'draft' ? ' (черновик)' : '') + '.\n' +
    'HTML: ' + value.htmlPath + '\nPPTX: ' + value.pptxPath +
    (value.pdfPath ? '\nPDF: ' + value.pdfPath : '') +
    (value.pdfWarning ? '\n' + value.pdfWarning : '') +
    '\nJSON проекта хранится внутри плагина для дальнейшего редактирования. Выдавайте только HTML, PDF (если создан) и PPTX; технические файлы не прикладывайте.' +
    (value.quality ? '\n\n' + qualityText(value.quality) : '') + generationText(value.generationReport))
  return oneText(
    'dsh-ppt 已生成 ' + value.slideCount + ' 页' + (value.deliveryStatus === 'draft' ? '草稿（还有待填写内容，不能作为成品交付）' : '演示文稿') + '（主题 ' + value.theme + '，语言 ' + value.language + '）：\n' +
    '打开演示文稿：' + value.htmlPath + '\n' +
    '可直接修改的 PPTX：' + value.pptxPath + '\n' +
    '可继续编辑的项目：' + value.jsonPath + '\n' +
    'HTML 双击即可放映；可点击上一页/下一页、输入页码，以及“检查与导出”定位问题或下载 PPTX。PPTX 可用 PowerPoint / WPS / Keynote 直接编辑。' +
    (value.revision !== undefined ? '\n修订号：' + value.revision + '；可撤销修改：' + value.undoAvailable + '。用 ppt_edit 修改指定页，ppt_undo 撤销。' : '') +
    (value.quality ? '\n\n' + qualityText(value.quality) : '') + generationText(value.generationReport),
  )
}

function generationText(report: PptCreateResult['generationReport']): string {
  if(!report)return ''
  const errors=report.diagnostics.filter(d=>d.severity==='error').length,warnings=report.diagnostics.filter(d=>d.severity==='warning').length
  return '\n\nПроверка плана: '+errors+' ошибок, '+warnings+' предупреждений'+(report.stale?' (отчёт устарел после правок; повторите проверку текущего содержимого)':'')+'.\n'+
    JSON.stringify({valid:report.valid,stale:report.stale??false,metrics:report.metrics,usedVariants:report.usedVariants,usedStructures:report.usedStructures,unusedVariants:report.unusedVariants,diagnostics:report.diagnostics},null,2)
}

function qualityText(value: PptQualityResult): string {
  const lang=value.language ?? 'ru'
  const rows=value.issues.slice(0,12).map(issue=>{
    const message=lang==='ru'?issue.messageRu??issue.message:lang==='en'?issue.messageEn??issue.message:issue.message
    const suggestion=lang==='ru'?issue.suggestionRu??issue.suggestion:lang==='en'?issue.suggestionEn??issue.suggestion:issue.suggestion
    return (lang==='zh'?'第 '+issue.slide+' 页：':lang==='en'?'Slide '+issue.slide+': ':'Слайд '+issue.slide+': ')+message+(suggestion?' — '+suggestion:'')
  }).join('\n')
  const header=lang==='zh'?'质量检查：'+value.errorCount+' 个错误，'+value.warningCount+' 个提醒。':lang==='en'?'Quality check: '+value.errorCount+' errors, '+value.warningCount+' warnings.':'Проверка качества: '+value.errorCount+' ошибок, '+value.warningCount+' предупреждений.'
  const more=value.issues.length>12?(lang==='zh'?'\n其余提醒见报告数据。':lang==='en'?'\nRemaining warnings are included in the report data.':'\nОстальные предупреждения включены в данные отчёта.') : ''
  const note=lang==='ru'?value.noteRu??value.note:lang==='en'?value.noteEn??value.note:value.note
  return header+'\n'+rows+more+'\n'+note
}

function renderCheck(value: PptCheckResult): TextBlock[] {
  const lang=value.language??'ru'
  const labels=lang==='zh'?{template:'模板',scenario:'场景',render:'PPTX 渲染',checked:'已验证当前文件',unchecked:'此报告尚未验证；传入 renderReceipt 可核对现有渲染',visual:'视觉检查仍需实际查看；无法查看时请明确告知用户并请其自行检查',fonts:'缺失字体',data:'工程数据'}:lang==='en'?{template:'Template',scenario:'Scenario',render:'PPTX render',checked:'Current file verified',unchecked:'Not verified by this report; pass renderReceipt to validate an existing render',visual:'Visual inspection requires viewing the pages; if unavailable, disclose this and ask the user to inspect them',fonts:'Missing fonts',data:'Project data'}:{template:'Шаблон',scenario:'Сценарий',render:'Рендер PPTX',checked:'Проверен для текущего файла',unchecked:'В этом отчёте не проверен; передайте renderReceipt для сверки готового рендера',visual:'Визуальная проверка требует осмотра страниц; если он недоступен, сообщите об этом пользователю и попросите проверить их самостоятельно',fonts:'Отсутствующие шрифты',data:'Данные проекта'}
  const lineage = (value as unknown as Record<string, unknown>).template
  const lineageText = lineage && typeof lineage === 'object' ? '\n'+labels.template+': '+(lineage as any).id+' v'+(lineage as any).revision : lineage && typeof lineage === 'string' ? '\n'+labels.scenario+': '+lineage : ''
  // The host may expose only output.render text to the model, not the raw value.
  // Keep revision, IDs and the requested full slide in that text as well.
  const data={deckPath:value.deckPath,deckId:value.deckId,revision:value.revision,slides:value.slides,
    ...(value.selectedSlide?{selectedSlide:value.selectedSlide}:{}),
    issues:value.issues.map(issue=>({slide:issue.slide,elementId:(issue as any).elementId,code:issue.code,severity:issue.severity,message:issue.message,suggestion:issue.suggestion}))}
  return oneText(qualityText(value)+lineageText+'\n'+labels.render+': '+(value.verification?.pptxRender==='rendered'?labels.checked:labels.unchecked)+'\n'+labels.visual+
    (value.render?.message?'\n'+value.render.message:'')+
    (value.render?.missingFonts?.length?'\n'+labels.fonts+': '+value.render.missingFonts.join(', '):'')+generationText(value.generationReport)+
    '\n\n'+labels.data+':\n'+JSON.stringify(data,null,2))
}

function renderPreview(value: PptRenderResult): TextBlock[] {
  if (!value.ok) return oneText((value.message || 'PPTX 尚未渲染。') + (value.installationHint ? '\n' + value.installationHint : ''))
  return oneText('PPTX 已渲染 ' + value.slideCount + ' 页（' + value.backend + '）：\n' +
    'Технические файлы рендеринга хранятся во временной папке плагина и не предназначены для выдачи. Пути для проверки доступны в структурированном результате.' +
    '\n缺失字体：' + (value.missingFonts?.join('、') || '引擎未报告缺失字体') +
    (value.missingFonts?.length ? '\n请先替换为环境和目标机器可用字体，重新生成并渲染检查；解决前不能声称已验收。' : '') +
    '\n请查看实际画面，确认文字、图片和图表后再交付。原可编辑 PPTX 保留。' +
    '\nIf image viewing is unavailable or read_image fails with a provider/adapter error, immediately tell the user that visual inspection was not completed and ask them to inspect the delivered pages. Keep visual:not-verified, finish available structural checks and deliver the existing files. Do not automatically delegate to subagents or trigger provider/model/review-role configuration; separate AI review requires an explicit user request.')
}

const imageSchema = { type: ['object', 'string', 'null'], properties: {
  src: { type: 'string', description: 'Local PNG/JPEG path relative to the session cwd, or image data URI. Embedded into all output files.' },
  alt: { type: 'string' }, fit: { type: 'string', enum: ['contain', 'cover'] }, caption: { type: 'string' },
}, additionalProperties: false }
const chartSchema = { type: ['object', 'null'], properties: {
  kind: { type: 'string', enum: ['column', 'bar', 'line', 'pie'] },
  categories: { type: 'array', items: { type: ['string', 'number'] } },
  series: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, values: { type: 'array', items: { type: ['number', 'string'] } } }, required: ['name', 'values'], additionalProperties: false } },
  rows: { type: 'array', items: { type: 'array', items: { type: ['string', 'number'] } }, description: 'Alternative: header row [category, series names], then category/value rows.' },
  unit: { type: 'string' }, caption: { type: 'string' },
}, additionalProperties: false }
const brandProperties = {
  name: { type: 'string' }, primaryColor: { type: 'string' }, backgroundColor: { type: 'string' }, textColor: { type: 'string' },
  fontFamily: { type: 'string', description: 'One installed font family; choose a font available on the recipient computer.' },
  logo: { type: ['string', 'null'], description: 'Local PNG/JPEG logo path; null clears logo during edit.' }, footer: { type: 'string' },
}
const slideProperties = {
  ...sceneInputProperties(),
  layout: { type: 'string', enum: ['cover', 'section', 'bullets', 'statement', 'quote', 'table', 'closing', 'image', 'image-left', 'image-right', 'chart', 'scene', 'diagram'] },
  title: { type: 'string' }, subtitle: { type: 'string' }, kicker: { type: 'string' }, text: { type: 'string' }, notes: { type: 'string' },
  bullets: { type: 'array', items: { type: 'string' } }, rows: { type: 'array', items: { type: 'array', items: { type: ['string', 'number'] } } },
  image: imageSchema, chart: chartSchema,
  diagram: semanticInputProperties(),
  restoreRepresentation:{type:'string',enum:['list','visual'],description:'Edit only: explicitly rebuild a semantic-source scene as its original list or visual representation. Preserves family artwork; undo retains manual object edits.'},
}
const projectParameters = {
  deckPath: { type: 'string', required: true, description: 'Path to a dsh-ppt .json project, relative to this session cwd or absolute. Arbitrary external PPTX editing is not supported.' },
  expectedRevision: { type: 'integer', description: 'Use revision returned by ppt_create/ppt_check to prevent overwriting another edit.' },
}

const sourceProperties = {
  id:{type:'string',description:'Letters and digits, starting with a letter; unique ID.'}, name:{type:'string'},
  format:{type:'string',enum:['csv','tsv','text']},content:{type:'string',description:'CSV/TSV or text content, combined sources at most 1 MiB.'},
  path:{type:'string',description:'Explicit local CSV/TSV/TXT/Markdown import path, relative to session cwd. Embedded once; no file watcher.'},
  kind:{type:'string',enum:['table','text']},rows:{type:'array',items:{type:'array',items:{oneOf:[{type:'string'},{type:'number'}]}}},text:{type:'string'},
}
const metricProperties = {
  id:{type:'string'},label:{type:'string'},kind:{type:'string',enum:['source','input','formula']},
  source:{type:'object',properties:{sourceId:{type:'string'},cell:{type:'string',description:'A1 to Z500; first CSV row counts as row 1.'},line:{type:'integer',description:'1-based text line.'},numberIndex:{type:'integer',description:'0-based numeric token on that line.'}},required:['sourceId']},
  value:{type:'number'},min:{type:'number'},max:{type:'number'},step:{type:'number'},note:{type:'string',description:'Explain the user assumption; do not invent factual provenance.'},
  formula:{type:'string',description:'Metric IDs, + - * / % **, parentheses and min/max/sum/abs/floor/ceil/round only. No JS property access or I/O.'},
  format:{type:'object',properties:{style:{type:'string',enum:['number','percent']},digits:{type:'integer'},unit:{type:'string'}}},
}

/** Assemble presentation schemas, rendering and the session-aware executors. */
export function buildPptTools(config: ResolvedPptConfig, options: ExecutorOptions = {}): ToolDefinition[] {
  const executors = createPptExecutors(config, undefined, options)
  return [
    {
      name: 'ppt_themes',
      description: 'List the built-in visual themes of dsh-ppt (id, name, mood, best-for, light/dark palette) before building a deck. Pass preview: true with outputDir to also write a self-contained theme gallery HTML plus one SVG palette card per theme (ready for README/npm screenshots). Use a theme id as the theme argument of ppt_create. 中文：列出 dsh-ppt 内置视觉主题（id、名称、情绪、适用场景、明暗色板）；传 preview: true + outputDir 会额外生成主题对比页和每套主题的 SVG 色板卡（可直接放 README/npm 首屏），用于选择 ppt_create 的 theme 参数。',
      parameters: compileParameters({
        lang: { type: 'string', description: 'Theme description language: zh (default), en, or bilingual.' },
        preview: { type: 'boolean', description: 'Write a theme gallery HTML and one SVG palette card per theme into outputDir. Default false (list only).' },
        outputDir: { type: 'string', description: 'Directory for preview files when preview is true. Default: a session-specific subdirectory of the working directory. An explicit separate directory or plugin outputDir config is preserved.' },
        overwrite: { type: 'boolean', description: 'Overwrite existing preview files instead of adding a numeric suffix. Default false.' },
      }),
      output: {
        schema: themesResultSchema,
        render: (_args: unknown, value: unknown) => renderThemes(value as PptThemesResult),
      },
      execute: executors.themes,
    },
    {
      name: 'ppt_create',
      description: 'Generate a standalone HTML slideshow, editable PPTX preserving the requested physical slide size and PDF from prepared content. PDF export is optional: if the renderer fails or is unavailable, return HTML/PPTX with pdfWarning. The project JSON is stored permanently inside the plugin for editing; never attach it by default. Deliver only htmlPath, pptxPath and pdfPath when present. PNGs, manifests and receipts are internal render cache files, never deliver them. Organize real facts before calling; the deterministic generator does not research or invent missing facts. Check and visually review artifacts before delivery; template-only output is a draft.\n' + generationPlanningInstructions(),
      parameters: compileParameters({
        title: { type: 'string', required: true, description: 'Deck title (used for the cover and file names).' },
        ...generationInputProperties(),
        content: { type: 'string', description: 'Markdown content: one sentence, a paragraph, or a full document. First # heading becomes the cover title; ## headings become slides; -/* lists become bullets; | ... | tables paginate with repeated headers (8 data rows/page, up to 8 columns and 60 characters/cell); > blockquotes become quote slides; <!-- 备注: ... --> comments become speaker notes. Provide content, slides or a schema 3 deckPlan; do not mix deckPlan with other content inputs.' },
        theme: { type: 'string', description: 'Visual theme id: swiss / velvet / data / soft / bold. Default data. See ppt_themes.' },
        lang: { type: 'string', description: 'UI language of the generated player: zh (default), en, or bilingual. Content language is whatever you write.' },
        motion: { type: 'string', enum: ['on', 'off'], description: 'Slide transitions plus bullet entrance animations: on (default) or off for a fully static deck.' },
        slides: { type: 'array', items: { type: 'object', properties: slideProperties, additionalProperties: true }, description: 'Structured slides including image/image-left/image-right and chart. Images: {src, alt, fit: contain|cover, caption}. Charts: {kind: column|bar|line|pie, categories, series:[{name,values}]} or rows with header. Tables paginate at 8 data rows. Keep full content editable; use images only for actual photos/screenshots/logos.' },
        template: { type: 'string', enum: ['weekly', 'defense', 'project', 'pitch'], description: 'Scenario reference from ppt_templates. Provide finished content/slides following its outline. Template alone creates a clearly marked draft with unfilled slots, never a finished presentation.' },
        templateId: { type: 'string', description: 'Installed library key from ppt_template list. Confirm via ask_user_question before generation. For schema 3 use templateId + freely composed scene slides; the engine retains fixed decor, page size and typography. deckPlan is an optional compatibility path for fixed slots.' },
        templateSelections: {type:'array',items:{type:'object',properties:{layoutId:{type:'string'},values:{type:'object',additionalProperties:true}},required:['layoutId'],additionalProperties:false},description:'Schema 3: select variants and fill slots by stable slot IDs from ppt_template get. Text = string or paragraphs; image = asset ID; chart/table = typed data objects. Omitted required values remain a draft.'},
        templateSamples: { type: 'boolean', description: 'Include the template sample slides after the outline; default true.' },
        assets: {type:'object',additionalProperties:true,description:'Embedded scene asset bag: asset ID → {mime: image/png|image/jpeg,width,height,data: data URI}. IDs use img- plus SHA-256 of decoded bytes.'},
        style: {type:'object',properties:{pageSize:{type:'object',properties:{width:{type:'integer'},height:{type:'integer'}},required:['width','height']}},additionalProperties:false,description:'Original physical slide size in EMU. Preserve print and screen formats.'},
        brand: { type: 'object', properties: brandProperties, additionalProperties: false, description: 'Shared brand: #RRGGBB primary/background/text colors, fontFamily, logo and footer. Applied to HTML and PPTX. A templateId brand is applied on top unless overridden here.' },
        dataModel: {type:'object',properties:{schemaVersion:{type:'integer',enum:[1]},sources:{type:'array',items:{type:'object',properties:sourceProperties,required:['id']}},metrics:{type:'array',items:{type:'object',properties:metricProperties,required:['id','kind']}}},additionalProperties:false,description:'Optional explicit lineage and what-if model. Use with structured slides containing {{metricId}} in text/tables or an exact token as chart values. Source facts reference a real cell or text line; assumptions require value/min/max/step. Formulas compute derived metrics. HTML offers live sliders; PPTX includes confirmed static values, formulas and assumptions in speaker notes. Leave absent for ordinary finished decks.'},
        outputDir: { type: 'string', description: 'Directory to write the files into. Default: a session-specific subdirectory of the working directory. An explicit separate directory or plugin outputDir config is preserved.' },
        fileName: { type: 'string', description: 'Base file name for HTML/PDF/PPTX deliverables. Default: sanitized deck title.' },
        overwrite: { type: 'boolean', description: 'Overwrite same-name delivery files only. Always creates a NEW internal project with new deckId, revision 0 and empty undo history; does not restore the old JSON. Use the returned jsonPath for subsequent edits. Default false: choose a unique numeric suffix.' },
      }),
      output: {
        schema: createResultSchema,
        render: (_args: unknown, value: unknown) => renderCreate(value as PptCreateResult),
      },
      execute: executors.create,
    },
    {
      name: 'ppt_templates',
      description: 'List weekly report, thesis defense, project update and pitch scenario outlines and draft structures. Use as internal content planning references; fill actual facts before delivering a finished deck. 中文：查看周报、答辩、项目汇报和路演的结构参考，组织并填写真实内容后再调用 ppt_create 交付成品。',
      parameters: compileParameters({ lang: { type: 'string', description: 'zh / en / bilingual, default zh.' } }),
      output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => oneText(JSON.stringify(value, null, 2)) },
      execute: executors.templates,
    },
    {
      name: 'ppt_template',
      description: 'Template library: list builtin/public/private templates, create templates from example PPTX files or existing projects, import/export template bundles (.zip/.json), publish to public (admin), delete, and restyle an existing project with a template (apply-to-project keeps content, swaps theme/brand/backgrounds, undoable). Admin checks follow the host webAuth with a config `admins` fallback; fail-closed. 中文：模板库：列出/创建（来自 pptx 或工程）/导入导出/发布（管理员）/删除模板；apply-to-project 用模板重设计现有工程（只换外观，内容不变，可撤销）。',
      parameters: compileParameters({
        operation: { type: 'string', required: true, enum: ['list', 'get', 'validate-plan', 'create-from-pptx', 'create-from-project', 'save', 'delete', 'export', 'import', 'publish', 'apply-to-project'], description: 'Library operation. validate-plan checks a schema 3 deckPlan without writing artifacts; get returns shared variant descriptions.' },
        ...generationInputProperties(),
        templateId: { type: 'string', description: 'Template key: builtin:<id> / public:<id> / user:<id>. For create-from-* this is NOT needed; use newTemplateId.' },
        newTemplateId: { type: 'string', description: 'New template slug for create-from-pptx / create-from-project (2-49 lowercase letters/digits/hyphens).' },
        name: { type: 'string', description: 'Human template name for create-from-*.' },
        description: { type: 'string', description: 'Optional template description.' },
        pptxPath: { type: 'string', description: 'Example PPTX path for create-from-pptx (session-relative or absolute).' },
        deckPath: { type: 'string', description: 'dsh-ppt .json project path for create-from-project or apply-to-project.' },
        bundlePath: { type: 'string', description: 'Template bundle (.zip/.json) for apply-to-project without the library.' },
        path: { type: 'string', description: 'Template bundle file for import.' },
        data: { type: 'string', description: 'Base64 zip/json template for import (panel uploads).' },
        manifest: { type: 'object', additionalProperties: true, description: 'Template manifest for save (supported schemaVersion 1, 2 or 3).' },
        assets: { type: 'object', additionalProperties: true, description: 'Assets for save: name → local path / data URI.' },
        scope: { type: 'string', enum: ['user', 'public'], description: 'Target scope for save/import; public requires admin.' },
        owner: { type: 'string', description: 'Admin only: publish a named user\'s own template (their login).' },
        outputDir: { type: 'string', description: 'Directory for export (default: session-specific subdirectory).' },
        samples: { type: 'boolean', description: 'create-from-project: include up to 3 sample slides; default true.' },
        expectedRevision: { type: 'integer', description: 'apply-to-project: expected deck revision.' },
        layoutMap:{type:'object',additionalProperties:true,description:'Schema 3 restyle: source slide ID → chosen target layout ID. Required when multiple target variants cannot be matched by ID.'},
        saveAs: { type: 'boolean', description: 'apply-to-project: save as a separate copy instead of in-place undoable edit.' },
        lang: { type: 'string', description: 'Summary language: zh / en / ru (default zh).' },
      }),
      output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => oneText(renderTemplate(value)) },
      execute: executors.template,
    },
    {
      name: 'ppt_edit',
      description: 'Modify selected slides preserving other pages and stable IDs. Use ppt_check {deckPath,slide} first to read complete objects and revision. Safe scene text edits: edits:[{slide:5,patch:{elementUpdates:[{id:"existing-id",changes:{paragraphs:[{runs:[{text:"New text"}]}]}}]}}]. Updates merge object fields by ID and preserve all other objects, frames and decor. Nested fields except textStyle are replaced as a whole. patch.elements instead REPLACES THE ENTIRE ARRAY: supply ALL complete objects, including unchanged decor; omitted objects are deleted and designLayout does not restore them. Use expectedRevision. Stores undo history. After an output/transport error the edit may already be saved: check revision/content before retrying; try ppt_undo before recreating.',
      parameters: compileParameters({ ...projectParameters,
        convertToScene: {type:'boolean',description:'Explicitly migrate legacy slides and every history snapshot to schema 2 before applying edits. Bindings or unsupported objects abort without writes.'},
        saveAs: { type: 'boolean', description: 'Save a new uniquely named trio, leaving the originals untouched. Rebuilds from JSON; does not import external Office edits. Required for legacy projects or externally changed outputs.' },
        edits: { type: 'array', items: { type: 'object', properties: { slide: { type: ['integer', 'string'], description: '1-based page number or stable slide ID' }, patch: { type: 'object', properties: {...slideProperties,
          elements:{...slideProperties.elements,description:'FULL replacement of every object, including decor. Omitted objects are deleted. Every object requires id, type, frame and type-specific fields. Prefer elementUpdates for text/style changes.'},
          elementUpdates:{type:'array',minItems:1,maxItems:256,description:'Scene only. Update existing objects by ID without deleting other objects. Cannot combine with elements. Requires unique existing IDs; cannot change id/type. changes replaces supplied fields; textStyle merges with existing style. Read complete paragraphs via ppt_check {slide} before changing runs.',items:{type:'object',properties:{id:{type:'string'},changes:{type:'object',additionalProperties:true}},required:['id','changes'],additionalProperties:false}},
        }, additionalProperties: false } }, required: ['slide', 'patch'], additionalProperties: false } },
        order: { type: 'array', items: { type: 'string' }, description: 'Reorder pages using every stable slide ID exactly once. May be used alone or together with edits; one undo restores the previous content and order.' },
        duplicate: { type: 'array', items: { type: ['integer', 'string'] }, description: 'Copy selected existing slides immediately after their originals, including images/charts/notes. References are 1-based page numbers or stable IDs from before this edit. Copies get new IDs; undo restores the previous deck.' },
        remove: { type: 'array', items: { type: ['integer', 'string'] }, description: 'Remove selected slides by their original 1-based page number or stable ID. At least one page must remain. A slide cannot be copied and removed in the same edit.' },
        brand: { type: ['object', 'null'], properties: brandProperties, additionalProperties: false, description: 'Merge shared branding. null clears all branding. Empty footer clears footer; logo:null clears logo.' },
      }),
      output: { schema: createResultSchema, render: (_args, value) => renderCreate(value as PptCreateResult) },
      execute: executors.edit,
    },
    {
      name:'ppt_data',
      description:'Preview or confirm source/assumption changes in a data-enabled project. Preview first; inspect affected slides and before/after values, then apply with confirmed:true, exact previewToken and expectedRevision. Default saves an undoable new copy. HTML remains interactive; PPTX is a confirmed static snapshot. Never invent provenance or silently treat assumptions as facts. 中文：预览来源更新或推演参数的影响，确认后保存可撤销副本；只允许更改声明的假设。',
      parameters:compileParameters({...projectParameters,
        action:{type:'string',enum:['preview','apply'],required:true},
        parameters:{type:'object',additionalProperties:true,description:'Declared input metric IDs to numeric values only.'},
        sourceUpdates:{type:'array',items:{type:'object',properties:sourceProperties,required:['id']},description:'Replacement content for existing source IDs; keep source type.'},
        scenario:{type:'object',additionalProperties:true,description:'Exact scenario.json from HTML: schemaVersion, deckId, revision, fingerprint, parameters. Rejects stale/foreign projects.'},
        previewToken:{type:'string'},confirmed:{type:'boolean'},saveAs:{type:'boolean',description:'Default true. false updates only when artifacts have not been externally modified.'},
      }),
      output:{schema:{type:'object',additionalProperties:true},render:(_args,value)=>oneText(JSON.stringify(value,null,2))},
      execute:executors.data,
    },
    {
      name: 'ppt_undo',
      description: 'Undo the most recent edit in a dsh-ppt JSON project, restoring slides, charts, embedded images and branding together. Revision increases so stale edits cannot overwrite the undo. Keeps up to 20 edits. 中文：撤销最近一次修改，恢复正文、图表、图片和品牌设置。',
      parameters: compileParameters(projectParameters),
      output: { schema: createResultSchema, render: (_args, value) => renderCreate(value as PptCreateResult) },
      execute: executors.undo,
    },
    {
      name: 'ppt_check',
      description: 'Inspect a dsh-ppt JSON project without rewriting artifacts. Report revision, slide IDs, page-specific errors and warnings. Pass slide (1-based number or ID) to read selectedSlide with complete elements, frames, styles and decor before editing. After an output error inspect revision and content before retrying: the operation may already be saved. Static estimates require visual review of the current PPTX. Font availability must be checked against embedded template/library files and actual render missingFonts, not inferred only from system installation.',
      parameters: compileParameters({ deckPath: projectParameters.deckPath,
        slide: {type:['integer','string'],description:'Optional 1-based slide number or stable ID. Returns selectedSlide with complete elements, frame, styles and decor for safe editing; does not rewrite the project.'},
        renderReceipt: { type: 'string', description: 'Optional receiptPath returned by ppt_render. Rechecks current PPTX hash and every rendered output; never implies a visual pass.' },
      }),
      output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => renderCheck(value as PptCheckResult) },
      execute: executors.check,
    },
    {
      name: 'ppt_render',
      description: 'Read the final PPTX and render all pages to PNG, PDF, or both using the optional official @deepseek-ai/libreoffice-kit (0.2.3, bundled by DSH 0.2.2+, or 0.1.5). Returns unavailable plus installation guidance when neither version is present; ordinary deck creation remains usable. Retains original editable PPTX and creates a separate unique output folder and integrity receipt. Reports missing fonts. Inspect actual pages if image viewing is available. If read_image is unavailable or fails with a provider/adapter error, immediately disclose that visual inspection was not completed and ask the user to inspect the delivered pages; keep visual:not-verified and deliver available files after structural checks. Do not automatically delegate to subagents or configure/select a review model. 中文：把最终 PPTX 渲染为逐页图片和 PDF，报告缺失字体；需安装可选官方引擎（0.2.3，或 0.1.5），渲染成功仍需检查画面。',
      parameters: compileParameters({
        pptxPath: { type: 'string', required: true, description: 'Final .pptx path, absolute or relative to session cwd.' },
        format: { type: 'string', enum: ['png', 'pdf', 'both'], description: 'png (default), pdf, or both.' },
        width: { type: 'integer', description: 'PNG target width 320–3840, default 1440; scales from actual page dimensions.' },
        timeoutMs: { type: 'integer', description: 'Whole rendering deadline in milliseconds, 1000–300000, default 120000.' },
      }),
      output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => renderPreview(value as PptRenderResult) },
      execute: executors.render,
    },
  ]
}
