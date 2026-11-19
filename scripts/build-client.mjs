import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const normalize = value => value.replace(/\r\n/g, '\n')
const kit = normalize(readFileSync(join(root, 'templates/workbench-ui.js'), 'utf8'))
// Russian workbench UI dictionary (keys are the Chinese originals; see templates/client-ru.js).
const ru = normalize(readFileSync(join(root, 'templates/client-ru.js'), 'utf8'))
// Compiled model catalog RPC (src/model-catalog.ts, no imports): inlined into the
// client scope with its export keywords stripped.
const catalog = normalize(readFileSync(join(root, 'lib/model-catalog.js'), 'utf8')).replace(/^export (?=(?:async )?(?:function|class|const|let|var))/gm, '')
// One self-contained ES module supplies the same validators to Node and panels.
const modelSource = normalize(readFileSync(join(root, 'skills/dsh-ppt/scripts/deck-model.mjs'), 'utf8'))
if (/^\s*import\b|^\s*export\s*(?:\{|\*|default\b)/m.test(modelSource)) throw new Error('deck-model must stay self-contained; imports/re-exports need an explicit module bundler')
const modelExports = [...modelSource.matchAll(/^export (?:function|const) (\w+)/gm)].map(match => match[1])
if (!modelExports.length) throw new Error('Shared model has no declared exports')
const modelBody = modelSource.replace(/^export (?=(?:function|const)\b)/gm, '')
if (/^\s*export\b/m.test(modelBody)) throw new Error('Unsupported shared model export declaration')
const model = '// BEGIN DSH_DECK_MODEL\nconst DshDeckModel = (() => {\n' + modelBody + '\nreturn Object.freeze({ ' + modelExports.join(', ') + ' });\n})();\n// END DSH_DECK_MODEL\n'
let client = normalize(readFileSync(join(root, 'templates/client.js'), 'utf8'))
if (client.includes('__ENGINE__')) {
  const name = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).name
  if (!['dsh-hyperframes', 'dsh-remotion'].includes(name)) throw new Error('Unknown media engine package')
  client = client.replaceAll('__ENGINE__', name.slice(4))
}
const directory = join(root, 'templates/panels')
const parts = existsSync(directory) ? readdirSync(directory).filter(name => name.endsWith('.js')).sort().map(name => normalize(readFileSync(join(directory, name), 'utf8'))).join('\n') : ''
const marker = 'const W = createWorkbenchUI(React);'
if (!client.includes(marker)) throw new Error('Workbench source marker missing')
client = client.replace(marker, marker + '\n' + parts)
mkdirSync(join(root, 'lib'), { recursive: true })
writeFileSync(join(root, 'lib/client.js'), '// Generated from templates/, lib/model-catalog.js and skills/dsh-ppt/scripts/deck-model.mjs. Edit the sources.\n(function () {\n' + kit + '\n' + ru + '\n' + catalog + '\n' + model + '\n' + client + '\n})();\n')
