import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const README_ZH = readFileSync(new URL('../README.md', import.meta.url), 'utf8') + readFileSync(new URL('../docs/USAGE.md', import.meta.url), 'utf8')
const README_EN = readFileSync(new URL('../README.en.md', import.meta.url), 'utf8') + readFileSync(new URL('../docs/USAGE.en.md', import.meta.url), 'utf8')

test('documentation describes localized quality reports without promising universally bilingual diagnostics', () => {
  assert.doesNotMatch(README_ZH, /错误提示[^。\n]*中英双语/, 'README.md 仍承诺错误提示中英双语')
  assert.doesNotMatch(README_ZH, /中英双语[^。\n]*错误提示/, 'README.md 仍把中英双语与错误提示绑在一起')
  assert.doesNotMatch(README_EN, /error messages are bilingual/i, 'README.en.md 仍承诺双语错误提示')
  for(const document of [README_ZH,README_EN])assert.match(document,/Quality reports follow the deck language; some legacy diagnostics remain in Chinese\./)
})
