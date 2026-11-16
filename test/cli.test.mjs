import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { main, parseArgv } from '../skills/dsh-ppt/scripts/build-deck.mjs'

test('parseArgv 解析长选项、@file 内容与显式覆写开关', () => {
  const args = parseArgv(['--title=测试', '--content', '@deck.md', '--theme', 'data', '--lang=bilingual', '--out', 'dist', '--file', 'pitch', '--overwrite'])
  assert.equal(args.title, '测试')
  assert.equal(args.content, '@deck.md')
  assert.equal(args.theme, 'data')
  assert.equal(args.lang, 'bilingual')
  assert.equal(args.out, 'dist')
  assert.equal(args.file, 'pitch')
  assert.equal(args.overwrite, true)
})

test('parseArgv 缺失参数时抛中文错误', () => {
  assert.throws(() => parseArgv(['--title']), /需要一个值/)
})

test('CLI 主流程生成三件套并打印路径', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-ppt-cli-'))
  try {
    const source = join(dir, 'source.md')
    writeFileSync(source, '# CLI 冒烟\n\n- HTML 放映\n- PPTX 导出\n', 'utf8')
    const logs = []
    const code = await main([
      '--title', 'CLI 冒烟',
      '--content', '@' + source,
      '--theme', 'soft',
      '--lang', 'zh',
      '--out', dir,
      '--file', 'smoke-deck',
    ], { log: (line) => logs.push(line), error: () => {} })
    assert.equal(code, 0)
    assert.match(logs.join('\n'), /HTML 放映/)
    assert.match(readFileSync(join(dir, 'smoke-deck.html'), 'utf8'), /CLI 冒烟/)
    assert.equal(readFileSync(join(dir, 'smoke-deck.pptx')).subarray(0, 2).toString('ascii'), 'PK')
    assert.ok(readFileSync(join(dir, 'smoke-deck.json'), 'utf8').includes('"title": "CLI 冒烟"'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CLI --list-themes 不写文件', async () => {
  const logs = []
  const code = await main(['--list-themes'], { log: (line) => logs.push(line), error: () => {} })
  assert.equal(code, 0)
  assert.equal(logs.length, 5)
  assert.match(logs.join('\n'), /data/)
})

test('CLI --motion off 产出纯静态放映页', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-ppt-cli-motion-'))
  try {
    const logs = []
    const code = await main([
      '--title', '静态',
      '--content', '# 静态\n- 一\n- 二',
      '--motion', 'off',
      '--out', dir,
      '--file', 'static-deck',
    ], { log: (line) => logs.push(line), error: () => {} })
    assert.equal(code, 0)
    const html = readFileSync(join(dir, 'static-deck.html'), 'utf8')
    assert.match(html, /<body class="no-motion">/)
    assert.ok(!html.includes('bullet-in'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ---- Шаблоны: --template-file, --restyle, --create-template-from-* ----

test('CLI: create-template-from-deck → bundle → создание из шаблона → restyle', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-ppt-cli-tpl-'))
  try {
    const log = () => {}
    // 1) базовый дек с брендом
    await main(['--title', 'База', '--lang', 'ru', '--out', dir, '--file', 'base-deck',
      '--slides', JSON.stringify([
        { layout: 'cover', title: 'База' },
        { layout: 'bullets', title: 'Итоги', bullets: ['Пункт один'] },
        { layout: 'closing', title: 'Спасибо' },
      ]), '--brand', JSON.stringify({ primaryColor: '#102030', footer: 'ACME' })], { log, error: log })
    // 2) шаблон из проекта
    const logs = []
    const code = await main(['--create-template-from-deck', join(dir, 'base-deck.json'), '--template-id', 'cli-tpl', '--template-name', 'Из CLI', '--save-template', dir], { log: l => logs.push(l), error: log })
    assert.equal(code, 0)
    assert.match(logs.join('\n'), /cli-tpl-template-v1\.zip/)
    // 3) создание из шаблона: каркас + плейсхолдеры + draft
    const created = []
    const createCode = await main(['--title', 'Новая по шаблону', '--lang', 'ru', '--out', dir, '--file', 'from-tpl', '--template-file', join(dir, 'cli-tpl-template-v1.zip')], { log: l => created.push(l), error: log })
    assert.equal(createCode, 0)
    assert.match(created.join('\n'), /草稿|draft|待填写/)
    const manifest = JSON.parse(readFileSync(join(dir, 'from-tpl.json'), 'utf8'))
    assert.deepEqual(manifest.template, { id: 'cli-tpl', revision: 1 })
    assert.equal(manifest.brand.primaryColor, '#102030')
    assert.equal(manifest.slides[0].title, 'Новая по шаблону')
    // 4) restyle того же файла другим шаблоном (из pptx-примера)
    const fromPptx = []
    await main(['--create-template-from-pptx', join(dir, 'base-deck.pptx'), '--template-id', 'cli-pptx', '--template-name', 'Из PPTX', '--save-template', dir], { log: () => {}, error: log })
    const restyled = []
    const restyleCode = await main(['--restyle', join(dir, 'from-tpl.json'), '--template-file', join(dir, 'cli-pptx-template-v1.zip')], { log: l => restyled.push(l), error: log })
    assert.equal(restyleCode, 0)
    assert.match(restyled.join('\n'), /"template":\s*{\s*"id": "cli-pptx"/)
    const after = JSON.parse(readFileSync(join(dir, 'from-tpl.json'), 'utf8'))
    assert.deepEqual(after.template, { id: 'cli-pptx', revision: 1 })
    // контент цел
    assert.equal(after.slides.length, manifest.slides.length)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CLI: --restyle требует источник шаблона; экспорт bundle работает', async () => {
  await assert.rejects(() => main(['--restyle', 'x.json']), /--template-file \/ --template-key/)
  const dir = mkdtempSync(join(tmpdir(), 'dsh-ppt-cli-exp-'))
  try {
    const bundle = join(dir, 'in.zip')
    const mod = await import('../skills/dsh-ppt/scripts/deck-templates.mjs')
    mod.writeTemplateBundle(dir, {
      schemaVersion: 1, id: 'exp-tpl', name: 'Экспорт',
      outline: [{ layout: 'cover', title: '{{deck.title}}' }],
    }, {})
    const logs = []
    const code = await main(['--export-template', join(dir, 'exp-tpl-template-v1.zip'), '--to', join(dir, 'out')], { log: l => logs.push(l), error: () => {} })
    assert.equal(code, 0)
    assert.match(logs.join('\n'), /bundle/)
    assert.ok(readFileSync(join(dir, 'out', 'exp-tpl-template-v1.zip')).length > 100)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
