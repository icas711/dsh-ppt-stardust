// Existing Markdown and structured-slide input, preserved independently of scene migration.
import { resolveLanguage } from './deck-language.mjs'
import { clampInt, stripInlineMarkdown, splitSentences, truncate, chunk } from './deck-text.mjs'
import { MEDIA_LAYOUTS, normalizeMediaSlide } from './deck-media.mjs'
import { normalizeVisual } from './deck-visual.mjs'
import { assertLegacySlideInput } from './deck-model.mjs'

// ---------------------------------------------------------------------------
// Markdown → deck
// ---------------------------------------------------------------------------

function createSection(heading = '', level = 0, coverOnly = false) {
  return { heading, level, coverOnly, bullets: [], paragraphs: [], quote: [], table: null, notes: [] }
}

function splitTableRow(line) {
  const trimmed = line.trim()
  const match = /^\|(.+)\|$/.exec(trimmed)
  if (match === null) return null
  return match[1].split('|').map((cell) => cell.trim())
}

function isTableSeparator(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(cell) || /^:?-+:?$/.test(cell))
}

const NOTES_COMMENT = /^<!--\s*(?:notes?|备注)\s*[:：]\s*([\s\S]*?)\s*-->$/

function quoteSlideFrom(section, ui) {
  const lines = [...section.quote]
  let attribution = ''
  const attrMatch = /^(?:——|—|--|-)\s*(.+)$/.exec(lines[lines.length - 1] ?? '')
  if (attrMatch !== null && lines.length > 1) {
    attribution = attrMatch[1]
    lines.pop()
  }
  return { layout: 'quote', kicker: ui.quoteKicker, title: truncate(lines.join(' '), 220), subtitle: attribution }
}

function paginateTable(slide, continuation = '（续）') {
  const rows = slide.rows
  const columns = Math.max(...rows.map(row => row.length))
  if (columns > 8) throw new Error('dsh-ppt：表格最多 8 列，请拆成多个表格后重试 / tables support up to 8 columns')
  if (rows.some(row => row.some(cell => [...cell].length > 60))) {
    throw new Error('dsh-ppt：表格单元格最多 60 个字符，请精简或拆分内容后重试 / cells support up to 60 characters')
  }
  const padded = rows.map(row => Array.from({ length: columns }, (_, i) => row[i] ?? ''))
  const pages = chunk(padded.slice(1), 8)
  if (pages.length === 0) pages.push([])
  return pages.map((body, index) => {
    const { notes, ...rest } = slide
    const title = slide.title + (index === 0 ? '' : continuation)
    // 同名 kicker/title 共用紧凑标题；续页不能凭空多出一行大标题挤压表格。
    return { ...rest, title, kicker: slide.kicker === slide.title ? title : slide.kicker, rows: [padded[0], ...body],
      ...(index === 0 && notes ? { notes } : {}) }
  })
}

function tableSlidesFrom(section, ui) {
  const table = section.table
  const rows = [table.header, ...table.rows]
  const heading = section.heading || ui.tableKicker
  return paginateTable({ layout: 'table', kicker: heading, title: heading, rows }, ui.continuation)
}

/** 把一个 section 里的金句/表格拆成独立页；备注附着到第一张产出页。 */
function specialSlidesFor(section, ui) {
  const out = []
  if (section.quote.length > 0) out.push(quoteSlideFrom(section, ui))
  if (section.table !== null) out.push(...tableSlidesFrom(section, ui))
  if (out.length > 0 && section.notes.length > 0) out[0].notes = section.notes.join('\n')
  return out
}

export function parseMarkdownDeck(titleInput, content, lang = 'zh') {
  const language = resolveLanguage(lang)
  const ui = language.ui
  const title = String(titleInput ?? '').trim()
  let coverTitle = title
  let coverSubtitle = ''
  let coverSubtitleConsumed = false

  let body = String(content ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
  // 去除文档级 YAML frontmatter（如果有）
  body = body.replace(/^---[ \t]*\n[\s\S]*?\n---[ \t]*\n?/, '')

  const sections = []
  let current = null
  let firstH1Seen = false

  const flush = () => {
    if (current !== null && (current.heading !== '' || current.bullets.length > 0 || current.paragraphs.length > 0
      || current.table !== null || current.quote.length > 0)) {
      sections.push(current)
    }
    current = null
  }

  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim()
    if (line === '') {
      // 无标题分组按空行分段，保证「文档无标题」时按段落生成幻灯片
      if (current !== null && current.heading === '') flush()
      continue
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line)
    if (headingMatch !== null) {
      const level = headingMatch[1].length
      const heading = stripInlineMarkdown(headingMatch[2])
      if (level === 1 && !firstH1Seen) {
        firstH1Seen = true
        if (coverTitle === '') coverTitle = heading
        flush()
        current = createSection(heading, level, true)
        continue
      }
      flush()
      current = createSection(heading, level, false)
      continue
    }

    const bulletMatch = /^\s*(?:[-*+]|\d+[.)])\s+(.+)$/.exec(line)
    if (bulletMatch !== null) {
      const bullet = stripInlineMarkdown(bulletMatch[1])
      if (bullet !== '') {
        if (current === null) current = createSection()
        current.bullets.push(bullet)
      }
      continue
    }

    // 演讲者备注：`<!-- 备注: ... -->` / `<!-- note: ... -->` 附到当前页
    const notesMatch = NOTES_COMMENT.exec(line)
    if (notesMatch !== null && notesMatch[1].trim() !== '') {
      if (current === null) current = createSection()
      current.notes.push(notesMatch[1].trim())
      continue
    }

    // Markdown 表格：连续的 | ... | 行，第二行是分隔线
    const tableCells = splitTableRow(line)
    if (tableCells !== null) {
      if (current === null) current = createSection()
      if (isTableSeparator(tableCells)) continue
      if (current.table === null) {
        current.table = { header: tableCells.map((cell) => stripInlineMarkdown(cell)), rows: [] }
      } else {
        current.table.rows.push(tableCells.map((cell) => stripInlineMarkdown(cell)))
      }
      continue
    }

    // 金句：`>` 引用块（最后一行 `—— 出处` 识别为署名）
    const quoteMatch = /^>\s?(.*)$/.exec(line)
    if (quoteMatch !== null) {
      const quoted = stripInlineMarkdown(quoteMatch[1])
      if (quoted !== '') {
        if (current === null) current = createSection()
        current.quote.push(quoted)
      }
      continue
    }

    const paragraph = stripInlineMarkdown(line)
    if (paragraph === '') continue
    if (current === null) current = createSection()
    current.paragraphs.push(paragraph)
  }
  flush()

  const slides = []
  const coverSource = sections.find((section) => section.coverOnly === true)
  if (coverSource !== null && coverSource !== undefined) {
    const coverText = coverSource.paragraphs[0] ?? coverSource.bullets[0] ?? ''
    if (coverSubtitle === '') {
        coverSubtitle = truncate(coverText, 180)
        coverSubtitleConsumed = true
      }
  }

  let bodySections = sections.filter((section) => section.coverOnly !== true)
  // 首个 H1 既是封面又把所有要点收在封面节里时，把封面副标题之外的剩余要点
  // 提升为一个无标题节，走下面的要点页生成逻辑，避免丢掉内容。
  if (bodySections.length === 0 && coverSource !== null && coverSource !== undefined) {
    const usedParagraph = coverSource.paragraphs.length > 0
    const extras = [
      ...(usedParagraph ? coverSource.bullets : coverSource.bullets.slice(1)),
      ...coverSource.paragraphs.slice(usedParagraph ? 1 : 0),
    ]
    if (extras.length > 0) {
      const synthetic = createSection()
      synthetic.bullets = extras
      bodySections = [synthetic]
    }
  }

  // 表格和引用不能只挂在封面节上，否则首个 H1 后没有 H2 时会丢失。
  if (coverSource && (coverSource.table !== null || coverSource.quote.length > 0)) {
    const special = createSection()
    special.table = coverSource.table
    special.quote = coverSource.quote
    special.notes = coverSource.notes
    bodySections.unshift(special)
  }

  if (bodySections.length === 0) {
    // 一句话 / 无结构输入：封面 + 核心观点 + 结束页（仍是完整的三页演示文稿）
    const allText = coverSource !== null && coverSource !== undefined
      ? [...coverSource.bullets, ...coverSource.paragraphs].join(' ')
      : String(content ?? '').trim()
    if (coverSubtitle === '') coverSubtitle = truncate(splitSentences(allText)[0] ?? '', 180)
    slides.push({ layout: 'cover', kicker: ui.coverKicker, title: coverTitle || 'Untitled', subtitle: coverSubtitle })
    if (coverSubtitle !== '') {
      slides.push({ layout: 'statement', kicker: ui.statementKicker, title: coverSubtitle, subtitle: coverTitle })
    }
    slides.push({ layout: 'closing', title: ui.closingTitle, subtitle: coverTitle || 'Untitled' })
    return { title: coverTitle || 'Untitled', subtitle: coverSubtitle, slides }
  }

  const hadHeadings = bodySections.some((section) => section.heading !== '')

  if (!hadHeadings) {
    // 无标题文档：第一段摘要作封面副标题，后续段落拆成要点页
    const ordered = bodySections.map((section) => ({
      section,
      sentences: [...section.bullets, ...section.paragraphs].flatMap((part) => splitSentences(part)),
    }))
    const firstSentence = ordered[0]?.sentences[0] ?? ''
    if (coverSubtitle === '') coverSubtitle = truncate(firstSentence, 180)
    const bodySlides = []
    let pointIndex = 0
    ordered.forEach((group, groupIndex) => {
      const specials = specialSlidesFor(group.section, ui)
      bodySlides.push(...specials)
      const sentences = (groupIndex === 0 && !coverSubtitleConsumed) ? group.sentences.slice(1) : group.sentences
      for (const points of chunk(sentences, 5)) {
        pointIndex += 1
        const slide = {
          layout: 'bullets',
          kicker: ui.pointKicker + ' ' + pointIndex,
          title: truncate(points[0], 40) || ui.pointKicker + ' ' + pointIndex,
          bullets: points,
        }
        if (specials.length === 0 && group.section.notes.length > 0) slide.notes = group.section.notes.join('\n')
        bodySlides.push(slide)
      }
    })
    slides.push({ layout: 'cover', kicker: ui.coverKicker, title: coverTitle || 'Untitled', subtitle: coverSubtitle })
    if (bodySlides.length === 0) {
      if (coverSubtitle !== '') {
        slides.push({ layout: 'statement', kicker: ui.statementKicker, title: coverSubtitle, subtitle: coverTitle || 'Untitled' })
      }
    } else {
      slides.push(...bodySlides)
    }
    slides.push({ layout: 'closing', title: ui.closingTitle, subtitle: coverTitle || 'Untitled' })
    return { title: coverTitle || 'Untitled', subtitle: coverSubtitle, slides }
  }

  slides.push({ layout: 'cover', kicker: ui.coverKicker, title: coverTitle || 'Untitled', subtitle: coverSubtitle })
  let pointIndex = 0
  for (const section of bodySections) {
    const notes = section.notes.join('\n')
    const specials = specialSlidesFor(section, ui)
    slides.push(...specials)
    if (section.heading === '') {
      const points = [...section.bullets, ...section.paragraphs]
        .flatMap((part) => splitSentences(part))
      // 超过 8 条自动续页，不再静默丢弃；备注只挂在第一页
      for (const [pageIndex, pagePoints] of chunk(points, 8).entries()) {
        pointIndex += 1
        const slide = {
          layout: 'bullets',
          kicker: ui.pointKicker + ' ' + pointIndex,
          title: truncate(pagePoints[0], 40) || ui.pointKicker + ' ' + pointIndex,
          bullets: pagePoints,
        }
        if (pageIndex === 0 && specials.length === 0 && notes !== '') slide.notes = notes
        slides.push(slide)
      }
      continue
    }
    const points = [
      ...section.bullets,
      ...section.paragraphs.flatMap((part) => splitSentences(part)),
    ]
    const pages = chunk(points, 8)
    if (pages.length > 0) {
      // 超过 8 条自动续页，不再静默丢弃；备注只挂在第一页
      pages.forEach((pagePoints, pageIndex) => {
        const label = pageIndex === 0 ? section.heading : section.heading + ui.continuation
        const slide = { layout: 'bullets', kicker: label, title: label, bullets: pagePoints }
        if (pageIndex === 0 && specials.length === 0 && notes !== '') slide.notes = notes
        slides.push(slide)
      })
    } else if (specials.length === 0) {
      const slide = { layout: 'section', kicker: section.heading, title: section.heading }
      if (notes !== '') slide.notes = notes
      slides.push(slide)
    }
  }
  slides.push({ layout: 'closing', title: ui.closingTitle, subtitle: coverTitle || 'Untitled' })
  return { title: coverTitle || 'Untitled', subtitle: coverSubtitle, slides }
}

const SLIDE_LAYOUTS = new Set(['cover', 'section', 'bullets', 'statement', 'closing', 'quote', 'table', ...MEDIA_LAYOUTS])

function normalizeSlide(raw, index) {
  const result = normalizeSlideContent(raw, index), visual = normalizeVisual(raw?.visual)
  // designLayout — ссылка на макет шаблона (style.layouts[].id); неизвестный id при отрисовке игнорируется.
  const designLayout = typeof raw?.designLayout === 'string' && /^[a-z0-9][a-z0-9-]{0,40}$/.test(raw.designLayout) ? raw.designLayout : undefined
  return { ...result, ...(visual ? { visual } : {}), ...(designLayout ? { designLayout } : {}) }
}
function normalizeSlideContent(raw, index) {
  const source = (raw !== null && typeof raw === 'object') ? raw : {}
  const layout = SLIDE_LAYOUTS.has(source.layout) ? source.layout : source.chart ? 'chart' : source.image ? 'image-right' : 'bullets'
  const title = stripInlineMarkdown(source.title ?? '')
  const subtitle = stripInlineMarkdown(source.subtitle ?? '')
  const kicker = stripInlineMarkdown(source.kicker ?? '')
  const text = stripInlineMarkdown(source.text ?? '')
  // 备注保留换行（放映面板与备注页都按原文显示），只做转义，不做 Markdown 清洗
  const notes = String(source.notes ?? '').trim()
  let bullets = []
  if (Array.isArray(source.bullets)) {
    bullets = source.bullets.map((item) => stripInlineMarkdown(String(item))).filter(Boolean)
  } else if (typeof source.bullets === 'string' && source.bullets.trim() !== '') {
    bullets = splitSentences(source.bullets)
  }
  if (MEDIA_LAYOUTS.has(layout)) return normalizeMediaSlide(source, { layout, kicker, title, subtitle, text, bullets, ...(notes !== '' ? { notes } : {}) }, index)
  if (layout === 'statement' && title === '' && text !== '') {
    return { layout, kicker, title: text, subtitle: subtitle || '', bullets, ...(notes !== '' ? { notes } : {}) }
  }
  if (layout === 'quote') {
    const quoteText = title !== '' ? title : text
    if (quoteText === '') return { layout: 'statement', kicker, title: subtitle, subtitle: '', bullets, ...(notes !== '' ? { notes } : {}) }
    return { layout, kicker, title: truncate(quoteText, 220), subtitle, ...(notes !== '' ? { notes } : {}) }
  }
  if (layout === 'table') {
    let rows = []
    if (Array.isArray(source.rows)) {
      rows = source.rows
        .map((row) => (Array.isArray(row) ? row : [row]).map((cell) => stripInlineMarkdown(String(cell))))
        .filter((row) => row.some((cell) => cell !== ''))
    }
    if (rows.length === 0) {
      // 没有表格数据的 table 页退化成要点页，避免产出空白版式
      return { layout: 'bullets', kicker, title, subtitle, bullets, ...(notes !== '' ? { notes } : {}) }
    }
    return { layout, kicker: kicker || title, title, rows, ...(notes !== '' ? { notes } : {}) }
  }
  return { layout, kicker, title, subtitle, text, bullets, ...(notes !== '' ? { notes } : {}) }
}

export function checkSlideLimit(slides, limit) {
  if (slides.length > limit) {
    throw new Error('dsh-ppt：生成后共 ' + slides.length + ' 页，超过 maxSlides=' + limit
      + '，请提高 maxSlides（最多 120）或拆分内容 / generated ' + slides.length + ' slides; raise maxSlides or split the deck')
  }
}

export function normalizeSlides(rawSlides, maxSlides = 60, lang = 'zh') {
  if (!Array.isArray(rawSlides) || rawSlides.length === 0) {
    throw new Error('dsh-ppt：slides 必须是非空数组（每个元素是 { layout, title, subtitle, kicker, bullets } 对象）')
  }
  rawSlides.forEach((slide, index) => assertLegacySlideInput(slide, `slides[${index}]`))
  const limit = clampInt(maxSlides, 60, 1, 120)
  const ui = resolveLanguage(lang).ui
  const slides = rawSlides.map(normalizeSlide).flatMap(slide => slide.layout === 'table'
    ? paginateTable(slide, ui.continuation) : [slide])
  checkSlideLimit(slides, limit)
  if (slides.length === 0) throw new Error('dsh-ppt：slides 规范化后为空')
  return slides
}
