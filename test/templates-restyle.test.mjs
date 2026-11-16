// Редизайн и фоны слайдов: editDeck theme/style, undo, PPTX-фоны, стабильность.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const advanced = await import('../skills/dsh-ppt/scripts/deck-advanced.mjs')
const templates = await import('../skills/dsh-ppt/scripts/deck-templates.mjs')

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
const withTmp = (fn) => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-ppt-restyle-'))
  try { return fn(dir) } finally { rmSync(dir, { recursive: true, force: true }) }
}
const readJson = path => JSON.parse(readFileSync(path, 'utf8'))

test('restyle: theme + brand + backgrounds in one undoable revision', () => withTmp(async dir => {
  const bg = templates.normalizeTemplateAssets({ 'bg.png': PNG })['bg.png']
  const created = await advanced.buildDeckAsync({
    title: 'Старый стиль', lang: 'ru', outputDir: dir,
    slides: [
      { layout: 'cover', title: 'Старый стиль' },
      { layout: 'section', title: 'Часть 1' },
      { layout: 'bullets', title: 'Детали', bullets: ['Пункт'] },
      { layout: 'closing', title: 'Спасибо' },
    ],
  })
  const before = readJson(created.jsonPath)
  const slideIds = before.slides.map(s => s.id)
  const restyled = await advanced.editDeck({
    deckPath: created.jsonPath, theme: 'velvet',
    brand: { primaryColor: '#AA0000', backgroundColor: '#FFF5F5', textColor: '#200808', footer: 'Новый футер' },
    style: { backgrounds: [{ layoutType: 'cover', src: bg.data, fit: 'cover' }, { layoutType: 'content', src: bg.data }] },
  })
  assert.equal(restyled.changed, true)
  assert.equal(restyled.revision, before.revision + 1)
  const after = readJson(created.jsonPath)
  assert.equal(after.theme, 'velvet')
  assert.equal(after.brand.primaryColor, '#AA0000')
  assert.equal(after.brand.footer, 'Новый футер')
  assert.deepEqual(after.style.backgrounds.map(b => b.layoutType), ['cover', 'content'])
  // Контент не тронут: ID и порядок страниц сохранены
  assert.deepEqual(after.slides.map(s => s.id), slideIds)
  assert.deepEqual(after.slides.map(s => s.title), before.slides.map(s => s.title))
  // HTML содержит фон обложки и контентных страниц
  const html = readFileSync(created.htmlPath, 'utf8')
  assert.ok(html.includes('data-bgt="cover"'))
  assert.ok(html.includes('data-bgt="content"'))
  // PPTX: фон присутствует
  const lib = await import('@office-kit/pptx')
  const pres = await lib.loadPresentation(new Uint8Array(readFileSync(created.pptxPath)))
  const slides = lib.getSlides(pres)
  assert.ok(lib.getSlideBackgroundImageBytes(slides[0]))
  assert.ok(lib.getSlideBackgroundImageBytes(slides[2]))
  assert.equal(lib.getSlideBackgroundImageBytes(slides[3]), null) // closing без фона
  // Происхождение шаблона не пишется, если не передавалось
  assert.equal(after.template, before.template) // undefined === undefined
  // Undo возвращает исходное оформление целиком
  const undone = await advanced.undoDeck({ deckPath: created.jsonPath })
  assert.equal(undone.revision, restyled.revision + 1)
  const restored = readJson(created.jsonPath)
  assert.equal(restored.theme, before.theme)
  assert.equal(restored.style, undefined)
  assert.equal(restored.brand, undefined)
  assert.deepEqual(restored.slides.map(s => s.id), slideIds)
}))

test('restyle: records template lineage and re-restyling replaces it', () => withTmp(async dir => {
  const created = await advanced.buildDeckAsync({
    title: 'Проект', lang: 'ru', outputDir: dir,
    slides: [{ layout: 'cover', title: 'Проект' }, { layout: 'bullets', title: 'Часть', bullets: ['П'] }],
  })
  const restyled = await advanced.editDeck({
    deckPath: created.jsonPath, theme: 'soft',
    templateLineage: { id: 'corp-blue', revision: 3 },
  })
  assert.equal(restyled.changed, true)
  const manifest = readJson(created.jsonPath)
  assert.deepEqual(manifest.template, { id: 'corp-blue', revision: 3 })
  const again = await advanced.editDeck({
    deckPath: created.jsonPath, theme: 'bold',
    templateLineage: { id: 'other', revision: 1 },
  })
  const updated = readJson(again.jsonPath)
  assert.deepEqual(updated.template, { id: 'other', revision: 1 })
  assert.equal(updated.theme, 'bold')
  const check = advanced.checkDeck({ deckPath: created.jsonPath })
  assert.equal(check.ok, true)
}))

test('restyle: invalid theme and duplicate background types are rejected', () => withTmp(async dir => {
  const created = await advanced.buildDeckAsync({
    title: 'Валидация', lang: 'ru', outputDir: dir,
    slides: [{ layout: 'cover', title: 'Валидация' }],
  })
  await assert.rejects(() => advanced.editDeck({ deckPath: created.jsonPath, theme: 'nope' }), /未知主题|тема|theme/)
  const bg = templates.normalizeTemplateAssets({ 'bg.png': PNG })['bg.png']
  await assert.rejects(() => advanced.editDeck({
    deckPath: created.jsonPath,
    style: { backgrounds: [{ layoutType: 'cover', src: bg.data }, { layoutType: 'cover', src: bg.data }] },
  }), /重复|layoutType/)
  await assert.rejects(() => advanced.editDeck({
    deckPath: created.jsonPath,
    style: { backgrounds: [{ layoutType: 'chess', src: bg.data }] },
  }), /layoutType/)
  // expectedRevision защищает от гонок
  await assert.rejects(() => advanced.editDeck({ deckPath: created.jsonPath, theme: 'soft', expectedRevision: 99 }), /修订号|revision/)
  // Ничего не поменялось
  const manifest = readJson(created.jsonPath)
  assert.equal(manifest.theme, 'data')
  assert.equal(manifest.style, undefined)
}))

test('backgrounds: creation-time backgrounds survive table pagination and re-validation', () => withTmp(async dir => {
  const bg = templates.normalizeTemplateAssets({ 'bg.png': PNG })['bg.png']
  const created = await advanced.buildDeckAsync({
    title: 'Таблицы', lang: 'ru', outputDir: dir,
    style: { backgrounds: [{ layoutType: 'content', src: bg.data }] },
    slides: [
      { layout: 'cover', title: 'Таблицы' },
      { layout: 'table', title: 'Данные', rows: [['Год', 'Выручка'], ['2024', '100'], ['2025', '140']] },
    ],
  })
  const manifest = readJson(created.jsonPath)
  assert.equal(manifest.style.backgrounds.length, 1)
  const check = advanced.checkDeck({ deckPath: created.jsonPath })
  assert.equal(check.ok, true)
  // Повторная правка не теряет фон и не падает на повторной валидации assetId-формы
  const edited = await advanced.editDeck({ deckPath: created.jsonPath, edits: [{ slide: 1, patch: { title: 'Таблицы и графики' } }] })
  const after = readJson(edited.jsonPath)
  assert.equal(after.style.backgrounds.length, 1)
}))
