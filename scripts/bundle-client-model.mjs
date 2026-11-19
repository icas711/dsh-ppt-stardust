import { readFileSync } from 'node:fs'
import { dirname, resolve, relative, isAbsolute } from 'node:path'
import ts from 'typescript'

// Bundle the pure model's explicit ES module graph. No runtime eval, arbitrary
// import stripping, Node shims or external dependencies in the browser bundle.
export function bundleClientModel(root, entry = 'deck-model.mjs') {
  root = resolve(root)
  const modules = new Map(), visiting = new Set()
  const key = file => './' + relative(root, file).replaceAll('\\', '/')
  function visit(file) {
    const id = key(file), location = relative(root, file)
    if (isAbsolute(location) || location.startsWith('..') || !file.endsWith('.mjs')) throw new Error('Shared model import escapes its module directory: ' + id)
    if (visiting.has(id)) throw new Error('Shared model import cycle: ' + id)
    if (modules.has(id)) return
    visiting.add(id)
    const source = readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS)
    if (parsed.parseDiagnostics.length) throw new Error('Invalid shared model syntax: ' + ts.flattenDiagnosticMessageText(parsed.parseDiagnostics[0].messageText, '\n'))
    const dependencies = new Map()
    function inspect(node) {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        if (node.moduleSpecifier) {
          const name = node.moduleSpecifier.text
          if (typeof name !== 'string' || !name.startsWith('./') || !name.endsWith('.mjs')) throw new Error('Shared model imports must be local .mjs modules: ' + name)
          const dependency = resolve(dirname(file), name)
          visit(dependency)
          dependencies.set(name, key(dependency))
        }
      }
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require')) throw new Error('Shared model must use static ES module imports: ' + id)
      ts.forEachChild(node, inspect)
    }
    inspect(parsed)
    const compiled = ts.transpileModule(source, { fileName: file.replace(/\.mjs$/, '.js'), compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    modules.set(id, { compiled, dependencies })
    visiting.delete(id)
  }
  const entryFile = resolve(root, entry)
  visit(entryFile)
  const factories = [...modules].map(([id, {compiled, dependencies}]) => `${JSON.stringify(id)}: function(module, exports, load) {\nconst dependencies = ${JSON.stringify(Object.fromEntries(dependencies))};\nconst require = name => { if (!Object.hasOwn(dependencies, name)) throw new Error('Unknown model dependency'); return load(dependencies[name]); };\n${compiled}\n}`).join(',\n')
  return '// BEGIN DSH_DECK_MODEL\nconst DshDeckModel = (() => {\nconst modules = {\n' + factories + '\n};\nconst cache = Object.create(null);\nfunction load(id) { if (!Object.hasOwn(modules, id)) throw new Error("Unknown model module"); if (!cache[id]) { const module = { exports: {} }; cache[id] = module; modules[id](module, module.exports, load); } return cache[id].exports; }\nreturn Object.freeze(load(' + JSON.stringify(key(entryFile)) + '));\n})();\n// END DSH_DECK_MODEL\n'
}
