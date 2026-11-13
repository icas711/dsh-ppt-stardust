import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

test('workbench UI follows a ru host locale and falls back ru → en → zh', () => {
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  assert.match(source, /const RU = Object\.freeze\(/)
  const apply = active => {
    let plugin
    runInNewContext(source, {
      window: { __ModuleLoader__: { load(entry) { plugin = entry.factory(() => ({ createElement() {} })) } } }
    })
    let definition
    const locale = { getSnapshot() { return { active } } }
    plugin.apply({ locale, slots: { inject(_name, callback) { callback() }, register(meta) { if (meta.name === 'settings.section') definition = meta } } })
    return { definition, internals: plugin.__internals }
  }

  // Readiness criterion: with a ru host locale the settings section is «Презентации».
  const ru = apply('ru')
  assert.equal(ru.definition.label(), 'Презентации')

  // languageOf: ru and regional tags resolve to 'ru'; en/zh behavior is unchanged.
  const { languageOf, t, pptText } = ru.internals
  assert.equal(languageOf(), 'ru')
  assert.equal(apply('ru-RU').internals.languageOf(), 'ru')
  const en = apply('en')
  const zh = apply('zh')
  assert.equal(en.internals.languageOf(), 'en')
  assert.equal(zh.internals.languageOf(), 'zh')

  // t(zh): ru → RU dict → EN dict → Chinese original.
  assert.equal(t('标题'), 'Заголовок')
  assert.equal(en.internals.t('标题'), 'Title')
  assert.equal(zh.internals.t('标题'), '标题')
  assert.equal(t('没有任何字典条目的键'), '没有任何字典条目的键')

  // pptText(zh, en): ru → RU dict → English argument → Chinese original.
  assert.equal(pptText('保存修改', 'Save changes'), 'Сохранить изменения')
  assert.equal(pptText('没有字典条目', 'English fallback'), 'English fallback')
  assert.equal(en.internals.pptText('保存修改', 'Save changes'), 'Save changes')
  assert.equal(zh.internals.pptText('保存修改', 'Save changes'), '保存修改')
})
