#! /usr/bin/env node
import { resolveLanguage } from './deck-language.mjs'
import { clampInt, escapeXml, escapeHtml, stripInlineMarkdown } from './deck-text.mjs'
import { parseMarkdownDeck, normalizeSlides, checkSlideLimit } from './deck-legacy.mjs'
export { LANGUAGES, resolveLanguage } from './deck-language.mjs'
export { clampInt, escapeXml, escapeHtml, stripInlineMarkdown, splitSentences, truncate } from './deck-text.mjs'
export { parseMarkdownDeck, normalizeSlides } from './deck-legacy.mjs'
/**
 * deck-core.mjs —— dsh-ppt 的零依赖演示文稿引擎。
 *
 * 插件工具与裸 SKILL.md 共用的兼容入口；输入与输出由独立模块实现：
 *   - DSH 内：ppt_create 工具动态加载本文件
 *   - 其他 harness：直接运行同目录的 build-deck.mjs
 *
 * 能力：Markdown / 结构化 slides → 三件套
 *   deck.html  独立网页放映（键盘/触屏/打印，无外链）
 *   deck.pptx  可编辑 PPTX（保留页面尺寸；deck-pptx.mjs + node:zlib）
 *   deck.json  结构化 deck manifest
 *
 * 零外部运行时依赖，仅使用 Node 内置模块。
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { resolve as resolvePath, join as joinPath } from 'node:path'
import { THEMES, THEME_IDS, DEFAULT_THEME, resolveTheme, hexToRgba } from './deck-theme.mjs'
import { MEDIA_LAYOUTS } from './deck-media.mjs'
import { renderHtml } from './deck-html.mjs'
import { buildPptx } from './deck-pptx.mjs'
export { THEMES, THEME_IDS, DEFAULT_THEME, resolveTheme, listThemes } from './deck-theme.mjs'
export { TEMPLATE_BACKGROUND_TYPES, backgroundTypeOfLayout } from './deck-page.mjs'
export { renderHtml } from './deck-html.mjs'
export { buildPptx, pptxFontName, pptxEastAsianFont } from './deck-pptx.mjs'

/**
 * manifest 版本跟随发布包 package.json；把 skills/dsh-ppt 独立复制到其他
 * harness（没有 package.json）时回退为 0.0.0，避免版本号悄悄漂移。
 */
function readDeckVersion() {
  for (const file of ['../../../package.json', '../package.json']) {
    try {
      const pkg = JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'))
      if (!['dsh-ppt', 'dsh-ppt-skill'].includes(pkg.name)) continue
      const version = String(pkg.version ?? '').trim()
      if (version) return version
    } catch { /* Copied skill may have no parent manifest. */ }
  }
  return '0.0.0'
}

export const DECK_VERSION = readDeckVersion()

// ---------------------------------------------------------------------------
// 主题
// ---------------------------------------------------------------------------

function themePages(lang) {
  return lang === 'en' || lang === 'ru'
    ? { title: 'dsh-ppt theme gallery', hint: 'Pick a theme id for ppt_create', usage: 'theme', dark: 'dark', light: 'light', palette: 'Palette' }
    : { title: 'dsh-ppt 主题预览', hint: '把 id 填给 ppt_create 的 theme 参数', usage: 'theme', dark: '深色', light: '浅色', palette: '色板' }
}

/** 单套主题的 960x540 SVG 色板卡：可直接放进 README / npm 首屏。 */
export function renderThemeSvg(input, lang = 'zh') {
  const theme = typeof input === 'string' ? resolveTheme(input) : input
  const pick = (pair) => (lang === 'en' || lang === 'ru' ? pair.en : pair.zh)
  const p = theme.palette
  const L = themePages(lang === 'en' || lang === 'ru' ? 'en' : 'zh')
  const font = theme.fonts.heading.replace(/"/g, "'")
  const bodyFont = theme.fonts.body.replace(/"/g, "'")
  const out = []
  out.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" width="960" height="540" role="img" aria-label="' + escapeXml(theme.id + ' ' + pick(theme.name)) + '">')
  out.push('<rect width="960" height="540" fill="' + p.bg + '"/>')
  out.push('<rect x="0" y="0" width="960" height="6" fill="' + p.accent + '"/><rect x="0" y="534" width="960" height="6" fill="' + p.accent2 + '"/>')
  out.push('<rect x="36" y="40" width="560" height="360" rx="16" fill="' + p.panel + '" stroke="' + hexToRgba(p.muted, 0.45) + '"/>')
  out.push('<text x="64" y="92" fill="' + p.accent + '" font-family="' + escapeXml(bodyFont) + '" font-size="14" font-weight="700" letter-spacing="3">' + escapeXml(pick(theme.mood).toUpperCase()) + '</text>')
  out.push('<text x="64" y="158" fill="' + p.fg + '" font-family="' + escapeXml(font) + '" font-size="42" font-weight="800">' + escapeXml('Aa ' + pick(theme.name)) + '</text>')
  out.push('<circle cx="72" cy="206" r="5" fill="' + p.accent + '"/><rect x="92" y="199" width="360" height="12" rx="6" fill="' + hexToRgba(p.fg, 0.75) + '"/>')
  out.push('<circle cx="72" cy="240" r="5" fill="' + p.accent + '"/><rect x="92" y="233" width="300" height="12" rx="6" fill="' + hexToRgba(p.fg, 0.55) + '"/>')
  out.push('<circle cx="72" cy="274" r="5" fill="' + p.accent + '"/><rect x="92" y="267" width="330" height="12" rx="6" fill="' + hexToRgba(p.fg, 0.55) + '"/>')
  out.push('<rect x="64" y="312" width="500" height="34" rx="6" fill="' + p.accent + '"/>')
  out.push('<text x="78" y="334" fill="' + p.bg + '" font-family="' + escapeXml(bodyFont) + '" font-size="14" font-weight="700">dsh-ppt</text>')
  out.push('<text x="470" y="334" fill="' + p.bg + '" font-family="' + escapeXml(bodyFont) + '" font-size="14" font-weight="700" text-anchor="end">1,234</text>')
  out.push('<rect x="64" y="346" width="500" height="2" fill="' + hexToRgba(p.muted, 0.5) + '"/>')
  out.push('<text x="64" y="378" fill="' + p.muted + '" font-family="' + escapeXml(bodyFont) + '" font-size="13">' + escapeXml(theme.id + ' · ' + (theme.dark ? L.dark : L.light) + ' · v' + DECK_VERSION) + '</text>')
  const swatches = ['bg', 'panel', 'fg', 'muted', 'accent', 'accent2']
  const labels = ['bg', 'panel', 'fg', 'muted', 'accent', 'accent2']
  out.push('<text x="632" y="76" fill="' + p.muted + '" font-family="' + escapeXml(bodyFont) + '" font-size="13" font-weight="700" letter-spacing="2">' + escapeXml(L.palette.toUpperCase()) + '</text>')
  swatches.forEach((key, i) => {
    const y = 96 + i * 62
    out.push('<rect x="632" y="' + y + '" width="44" height="44" rx="10" fill="' + p[key] + '" stroke="' + hexToRgba(p.muted, 0.45) + '"/>')
    out.push('<text x="692" y="' + (y + 20) + '" fill="' + p.fg + '" font-family="' + escapeXml(bodyFont) + '" font-size="14" font-weight="600">' + escapeXml(labels[i]) + '</text>')
    out.push('<text x="692" y="' + (y + 38) + '" fill="' + p.muted + '" font-family="' + escapeXml(bodyFont) + '" font-size="13">' + escapeXml(String(p[key]).toUpperCase()) + '</text>')
  })
  out.push('<text x="632" y="508" fill="' + p.muted + '" font-family="' + escapeXml(bodyFont) + '" font-size="12">' + escapeXml(pick(theme.bestFor)).slice(0, 44) + '</text>')
  out.push('</svg>')
  return out.join('')
}

/** 自包含主题对比页：5 套主题并排，含色板与用法。 */
export function renderThemePreviewHtml(lang = 'zh') {
  const L = themePages(lang === 'en' || lang === 'ru' ? 'en' : 'zh')
  const cards = THEME_IDS.map((id) => {
    const theme = THEMES[id]
    const pick = (pair) => (lang === 'en' || lang === 'ru' ? pair.en : pair.zh)
    const chips = Object.keys(theme.palette).map((key) =>
      '<span class="chip"><i style="background:' + theme.palette[key] + '"></i>' + escapeHtml(String(theme.palette[key]).toUpperCase()) + '</span>').join('')
    return '<figure class="card" id="theme-' + escapeHtml(id) + '">' +
      renderThemeSvg(theme, lang === 'en' || lang === 'ru' ? 'en' : 'zh') +
      '<figcaption><div class="row"><strong>' + escapeHtml(id) + '</strong><span class="badge">' + escapeHtml(pick(theme.name)) + '</span></div>' +
      '<p class="muted">' + escapeHtml(pick(theme.mood)) + ' · ' + escapeHtml(pick(theme.bestFor)) + '</p>' +
      '<p class="chips">' + chips + '</p>' +
      '<p class="usage">' + escapeHtml(L.usage) + ': <code>' + escapeHtml(id) + '</code></p></figcaption></figure>'
  }).join('')
  return '<!DOCTYPE html>' + eolSafe('<html lang="zh-CN">') +
    '<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + escapeHtml(L.title) + '</title><style>' +
    'body{margin:0;background:#0b0f17;color:#e8f1ff;font-family:"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;padding:28px}' +
    'h1{font-size:26px;margin:0 0 6px}p.sub{color:#8b98ad;margin:0 0 24px;font-size:14px}' +
    '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(430px,1fr));gap:22px}' +
    '.card{margin:0;background:#111827;border:1px solid #263043;border-radius:16px;overflow:hidden}' +
    '.card svg{display:block;width:100%;height:auto}' +
    'figcaption{padding:14px 16px 16px}.row{display:flex;align-items:center;gap:10px;font-size:16px}' +
    '.badge{color:#8b98ad;font-size:13px}.muted{color:#8b98ad;font-size:13px;margin:6px 0 10px;line-height:1.5}' +
    '.chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}.chip{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#aab6c9;background:#0b0f17;border:1px solid #263043;border-radius:99px;padding:3px 9px}' +
    '.chip i{width:10px;height:10px;border-radius:3px;display:inline-block}' +
    '.usage{margin:0;font-size:13px;color:#aab6c9}code{background:#0b0f17;border:1px solid #263043;border-radius:6px;padding:1px 6px}' +
    '@media (prefers-reduced-motion: reduce){*{transition:none!important;animation:none!important}}' +
    '</style></head><body><h1>' + escapeHtml(L.title) + '</h1><p class="sub">' + escapeHtml(L.hint) + ' · dsh-ppt v' + escapeHtml(DECK_VERSION) + '</p>' +
    '<div class="grid">' + cards + '</div></body></html>'
}

function eolSafe(text) { return text }

/** 写主题对比页 + 每套主题 SVG 色板卡；默认不覆盖同名文件。 */
export function buildThemePreview(options = {}) {
  const langInput = typeof options.lang === 'string' && options.lang.trim() !== '' ? options.lang.trim() : 'zh'
  const language = resolveLanguage(langInput)
  const outputDir = resolvePath(String(options.outputDir ?? '.'))
  mkdirSync(outputDir, { recursive: true })
  const overwrite = options.overwrite === true
  const pickPath = (base, ext) => {
    const first = resolvePath(joinPath(outputDir, base + ext))
    if (overwrite || !existsSync(first)) return first
    for (let i = 1; i < 1000; i += 1) {
      const candidate = resolvePath(joinPath(outputDir, base + '-' + i + ext))
      if (!existsSync(candidate)) return candidate
    }
    throw new Error('dsh-ppt：找不到可用的预览文件名（同名前缀超过 999 个），请允许 overwrite。')
  }
  const htmlPath = pickPath('themes-preview', '.html')
  writeFileSync(htmlPath, renderThemePreviewHtml(language.id), 'utf8')
  const svgs = THEME_IDS.map((id) => {
    const svgPath = pickPath('theme-' + id, '.svg')
    writeFileSync(svgPath, renderThemeSvg(id, language.id), 'utf8')
    return { id, path: svgPath }
  })
  return { ok: true, outputDir, htmlPath, svgs, themeCount: THEME_IDS.length, language: language.id }
}


export function resolveMotion(input) {
  if (input === undefined || input === null || input === '') return true
  if (input === true || input === 'on') return true
  if (input === false || input === 'off') return false
  throw new Error('dsh-ppt：未知 motion 值 "' + String(input) + '"，可选：on / off（默认 on）')
}

// ---------------------------------------------------------------------------
// 文本工具
// ---------------------------------------------------------------------------

// Windows 保留设备名：首个点之前的主名命中即不可用（NUL、com1、aux.report.html 都算）。
const WINDOWS_RESERVED_FILE_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i

export function sanitizeFileName(input) {
  const base = String(input ?? 'deck').toWellFormed().trim().replace(/[\uFFFE\uFFFF]/g, '-').replace(/\.(html?|pptx|json)$/i, '')
  let cleaned = base
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (WINDOWS_RESERVED_FILE_NAME.test(cleaned)) cleaned = 'deck-' + cleaned
  return cleaned.slice(0, 120) || 'deck'
}

const DECK_ARTIFACT_EXTENSIONS = ['.html', '.pptx', '.json', '.pdf']

/**
 * 为三件套选择同一个可用文件名前缀。默认不覆盖：任一产物已存在时，
 * 整组改用 -1/-2… 后缀，避免新旧 deck 被静默混写。
 */
export function resolveDeckFileName(outputDir, requestedFileName, overwrite) {
  // 一次 readdir 建集，替代逐个候选 existsSync 探测（最坏 ~3000 次 stat）；
  // 统一小写比较，避免 Windows 大小写不敏感文件系统把已占用的名字判成可用。
  const existing = new Set(readdirSync(outputDir).map((name) => name.toLowerCase()))
  const isAvailable = (candidate) => DECK_ARTIFACT_EXTENSIONS.every((ext) => !existing.has((candidate + ext).toLowerCase()))
  if (overwrite || isAvailable(requestedFileName)) return requestedFileName
  for (let index = 1; index < 1000; index += 1) {
    const candidate = requestedFileName + '-' + index
    if (isAvailable(candidate)) return candidate
  }
  throw new Error('dsh-ppt：找不到可用的输出文件名（同名前缀超过 999 个），请更换 fileName 或显式允许 overwrite。')
}

// ---------------------------------------------------------------------------
// 构建入口
// ---------------------------------------------------------------------------

export function normalizeBuildOptions(options = {}) {
  const title = String(options.title ?? '').trim()
  if (title === '') throw new Error('dsh-ppt：title 不能为空')
  const theme = resolveTheme(options.theme)
  const language = resolveLanguage(options.lang)
  const motion = resolveMotion(options.motion)
  const maxSlides = clampInt(options.maxSlides, 60, 3, 120)
  let deck
  if (Array.isArray(options.slides) && options.slides.length > 0) {
    deck = {
      title,
      subtitle: stripInlineMarkdown(options.subtitle ?? ''),
      slides: normalizeSlides(options.slides, maxSlides, language.id),
    }
  } else {
    const content = String(options.content ?? '').trim()
    if (content === '') throw new Error('dsh-ppt：content 不能为空（或用 slides 传结构化幻灯片）')
    deck = parseMarkdownDeck(title, content, language.id)
    checkSlideLimit(deck.slides, maxSlides)
  }
  if (deck.slides.length < 1) throw new Error('dsh-ppt：没有可生成的幻灯片')
  const outputDir = resolvePath(String(options.outputDir ?? '.').trim() || '.')
  const fileName = sanitizeFileName(options.fileName ?? title)
  const overwrite = options.overwrite === true
  return { title, theme, language, motion, deck, outputDir, fileName, overwrite }
}

/**
 * 三件套落盘：三份内容全部先写同目录临时文件，再逐个 rename 提交。
 * 任一步失败都清理临时文件，并把已提交的目标恢复为调用前的内容，
 * 避免出现「json/html 已更新、pptx 还是旧的」这类混版状态。
 */
export function commitDeckArtifacts(artifacts) {
  const stamp = process.pid.toString(36) + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
  const items = artifacts.map((item, index) => ({ ...item, tempPath: item.path + '.' + stamp + '-' + index + '.tmp' }))
  const removeTemp = (item) => {
    try {
      rmSync(item.tempPath, { force: true })
    } catch {}
  }

  // 阶段 0：记下已有产物内容用于回滚；读不出来（如被同名目录占用）先报错，不碰任何文件。
  const previous = new Map()
  for (const item of items) {
    if (!existsSync(item.path)) continue
    try {
      previous.set(item.path, readFileSync(item.path))
    } catch (error) {
      throw new Error('dsh-ppt：三件套写入失败（' + item.path + ' 已存在但无法读取），原文件未改动：' + error.message)
    }
  }

  // 阶段 1：全部写临时文件；这一步失败时目标文件尚未被改动。
  let written = 0
  try {
    for (const item of items) {
      writeFileSync(item.tempPath, item.data, item.encoding)
      written += 1
    }
  } catch (error) {
    for (const item of items.slice(0, written + 1)) removeTemp(item)
    throw new Error('dsh-ppt：写入临时文件失败（' + items[written].path + '），原三件套未改动：' + error.message)
  }

  // 阶段 2：逐个 rename 提交；中途失败则把已提交的目标回滚成旧内容。
  const committed = []
  try {
    for (const item of items) {
      renameSync(item.tempPath, item.path)
      committed.push(item)
    }
  } catch (error) {
    const failedPath = items[committed.length].path
    for (const item of items) removeTemp(item)
    for (const item of committed) {
      try {
        const previousData = previous.get(item.path)
        if (previousData === undefined) rmSync(item.path, { force: true })
        else writeFileSync(item.path, previousData)
      } catch {}
    }
    throw new Error('dsh-ppt：提交三件套失败（' + failedPath + '），已回滚为原文件：' + error.message)
  }
}

export function buildDeck(options = {}) {
  if(options.dataModel!==undefined)throw new Error('dsh-ppt：数据绑定请使用 deck-advanced.mjs 的 buildDeckAsync / Data models require buildDeckAsync from deck-advanced.mjs')
  if (options.brand || options.template || options.slides?.some(slide => MEDIA_LAYOUTS.has(slide.layout) || slide.image || slide.chart)) {
    throw new Error('dsh-ppt：图片、图表、模板与品牌请使用异步 buildDeckAsync 或 ppt_create / CLI')
  }
  const normalized = normalizeBuildOptions(options)
  const { title, theme, language, motion, deck, outputDir, overwrite } = normalized
  mkdirSync(outputDir, { recursive: true })
  const fileName = resolveDeckFileName(outputDir, normalized.fileName, overwrite)

  const manifest = {
    version: DECK_VERSION,
    title,
    theme: theme.id,
    language: language.id,
    motion,
    slideCount: deck.slides.length,
    slides: deck.slides,
  }
  const jsonPath = resolvePath(outputDir, fileName + '.json')
  const htmlPath = resolvePath(outputDir, fileName + '.html')
  const pptxPath = resolvePath(outputDir, fileName + '.pptx')

  // 先生成三份内容再统一提交：生成阶段抛错时也不会留下半套文件。
  commitDeckArtifacts([
    { path: jsonPath, data: JSON.stringify(manifest, null, 2) + '\n', encoding: 'utf8' },
    { path: htmlPath, data: renderHtml(manifest, theme, language, { pptx: pptxPath, json: jsonPath }), encoding: 'utf8' },
    { path: pptxPath, data: buildPptx(manifest, theme, language) },
  ])

  return {
    ok: true,
    title,
    theme: theme.id,
    language: language.id,
    slideCount: deck.slides.length,
    outputDir,
    files: {
      html: htmlPath,
      pptx: pptxPath,
      json: jsonPath,
    },
    htmlPath,
    pptxPath,
    jsonPath,
  }
}
