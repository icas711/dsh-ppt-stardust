import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { acceptsText, acceptsVision, catalogRoutes, fetchModelCatalog, ModelCatalogError } from '../lib/model-catalog.js'

const envelope = value => ({ type: 'server-response', result: { ok: true, value } })
const textModel = { id: 'glm-4.6', name: 'GLM-4.6', inputModalities: ['text'] }
const visionModel = { id: 'glm-vision', name: 'GLM Vision', inputModalities: ['image', 'text'] }

test('the catalog posts the llm.models RPC envelope and returns normalized groups', async () => {
  const seen = []
  const original = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    seen.push({ url: String(url), init })
    return { json: async () => envelope({ groups: [
      { id: 'zai-coding-cn', name: 'Zai Coding', models: [textModel, visionModel, { id: '', name: 'Broken' }, null] },
      { id: 'empty-provider', models: [] },
      { noId: true },
    ], failures: [{ provider: 'slow-provider', message: 'timeout' }] }) }
  }
  try {
    const catalog = await fetchModelCatalog({ endpoint: 'http://hub.test/api' })
    assert.equal(seen.length, 1)
    assert.equal(seen[0].init.method, 'POST')
    assert.equal(seen[0].init.credentials, 'same-origin')
    const body = JSON.parse(seen[0].init.body)
    assert.deepEqual({ type: body.type, method: body.method, payload: body.payload }, { type: 'client-request', method: 'llm.models', payload: {} })
    assert.equal(typeof body.rpcId, 'string')
    assert.ok(body.rpcId.length > 0)
    assert.deepEqual(catalog.groups.map(group => [group.id, group.name, group.models.length]),
      [['zai-coding-cn', 'Zai Coding', 2], ['empty-provider', undefined, 0]])
    assert.deepEqual(catalog.failures, [{ provider: 'slow-provider', message: 'timeout' }])
  } finally { globalThis.fetch = original }
})

test('provider names fill in when the catalog omits the display name', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => ({ json: async () => envelope({ groups: [{ id: 'zai-coding-cn', models: [{ id: 'glm-4.6' }] }] }) })
  try {
    assert.deepEqual(catalogRoutes((await fetchModelCatalog({ endpoint: 'http://hub.test/api' })).groups, acceptsText),
      [{ provider: 'zai-coding-cn', model: 'glm-4.6', label: 'zai-coding-cn / glm-4.6' }])
  } finally { globalThis.fetch = original }
})

test('a refused catalog call is loud and keeps the harness detail', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => ({ json: async () => ({ type: 'server-response', result: { ok: false, error: { message: 'NO_ADAPTER: provider missing on the personal plane' } } }) })
  try {
    await assert.rejects(fetchModelCatalog({ endpoint: 'http://hub.test/api' }), error => {
      assert.ok(error instanceof ModelCatalogError)
      assert.equal(error.message, 'catalog-refused')
      assert.equal(error.detail, 'NO_ADAPTER: provider missing on the personal plane')
      return true
    })
  } finally { globalThis.fetch = original }
})

test('a wrong envelope, an unreadable answer and a body without groups all fail loudly', async () => {
  const original = globalThis.fetch
  const cases = [
    { json: async () => ({ type: 'server-response', result: { ok: true } }), message: 'catalog-shape' },
    { json: async () => ({ hello: true }), message: 'catalog-protocol' },
    { json: async () => { throw new Error('unexpected end of JSON') }, message: 'catalog-unreachable' },
  ]
  try {
    for (const response of cases) {
      globalThis.fetch = async () => response
      await assert.rejects(fetchModelCatalog({ endpoint: 'http://hub.test/api' }), error => error instanceof ModelCatalogError && error.message === response.message)
    }
  } finally { globalThis.fetch = original }
})

test('route rows keep the provider/model identity and the established label shape', () => {
  const rows = catalogRoutes([
    { id: 'zai-coding-cn', name: 'Zai Coding', models: [textModel, visionModel] },
    { id: 'other', models: [{ id: 'text-only', inputModalities: ['text'] }, { id: 'image-only', inputModalities: ['image'] }] },
  ], acceptsText)
  assert.deepEqual(rows.map(row => [row.provider, row.model]), [
    ['zai-coding-cn', 'glm-4.6'], ['zai-coding-cn', 'glm-vision'], ['other', 'text-only'],
  ])
  assert.equal(rows[0].label, 'Zai Coding / GLM-4.6')
  const vision = catalogRoutes([{ id: 'zai-coding-cn', name: 'Zai Coding', models: [textModel, visionModel] }, { id: 'other', models: [{ id: 'unspecified' }] }], acceptsVision)
  assert.deepEqual(vision.map(row => [row.provider, row.model]), [['zai-coding-cn', 'glm-vision'], ['other', 'unspecified']])
})

test('undeclared modalities stay selectable; declared rules stay strict', () => {
  assert.equal(acceptsText({ id: 'a' }), true)
  assert.equal(acceptsVision({ id: 'a' }), true)
  assert.equal(acceptsText({ id: 'a', inputModalities: ['text'] }), true)
  assert.equal(acceptsText({ id: 'a', inputModalities: ['image'] }), false)
  assert.equal(acceptsVision({ id: 'a', inputModalities: ['image', 'text'] }), true)
  assert.equal(acceptsVision({ id: 'a', inputModalities: ['text'] }), false)
  assert.equal(acceptsVision({ id: 'a', inputModalities: [] }), false)
})

test('the built client bundle embeds the cascade and its catalog RPC', () => {
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  assert.match(source, /method: 'llm\.models'/)
  assert.match(source, /function ModelCascade\(/)
  assert.match(source, /function fetchModelCatalog\(/)
})

test('the cascade renders provider groups from the RPC and picks a route key', async () => {
  const { runInNewContext } = await import('node:vm')
  const state = new Map()
  let cursor = 0
  const calls = []
  const React = {
    Fragment: Symbol.for('react.fragment'),
    createElement(type, props, ...children) { return { type, props: props || {}, children: children.flat().filter(c => c !== null && c !== undefined && typeof c !== 'boolean') } },
    useState(initial) {
      const i = cursor++
      if (!state.has(i)) state.set(i, [typeof initial === 'function' ? initial() : initial])
      const pair = state.get(i)
      return [pair[0], value => { pair[0] = typeof value === 'function' ? value(pair[0]) : value }]
    },
    useEffect(fn) { try { fn(); return () => {} } catch { return () => {} } },
    useRef(value) { return { current: value } },
  }
  // The RPC fetch lives in the VM sandbox globals, not the Node ones.
  const rpcFetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) })
    return { json: async () => ({ type: 'server-response', result: { ok: true, value: { groups: [
      { id: 'zai-coding-cn', name: 'Zai Coding', models: [{ id: 'glm-4.6', name: 'GLM-4.6' }] },
      { id: 'empty', name: 'Empty', models: [] },
    ], failures: [{ provider: 'off', message: 'timeout' }] } } } ) }
  }
  const flatten = node => node === null || node === undefined || typeof node !== 'object' ? (node === null || node === undefined ? [] : [node]) : [node, ...(node.children || []).flatMap(flatten)]
  const text = node => flatten(node).filter(part => typeof part === 'string').join('')
  let cascade = null
  let picked = null
  const seenRoutes = []
  const render = () => cascade({
    label: 'Rehearsal model', placeholder: 'Choose a model', emptyHint: 'hint', accept: () => true,
    value: '', selectedLabel: '', disabled: false,
    onRoutes: routes => seenRoutes.push(routes),
    onPick: route => { picked = route },
  })
  try {
    // Reach ModelCascade through the loaded client's test internals.
    runInNewContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), {
      window: { __ModuleLoader__: { load(entry) { cascade = entry.factory(() => React).__internals.ModelCascade } } },
      document: { baseURI: 'http://hub.test/desktop/', addEventListener() {}, removeEventListener() {} },
      fetch: rpcFetch,
      URL,
    })
  } catch (problem) {
    assert.fail('the client bundle failed to load in the sandbox: ' + problem.message)
  }
  assert.ok(cascade, 'ModelCascade is exposed through the client internals')

  const closed = flatten(render())
  const toggle = closed.find(node => node.type === 'button')
  assert.ok(toggle, 'the closed cascade is a button')
  assert.ok(text(toggle).includes('Choose a model'), 'the button shows the placeholder when nothing is selected')

  toggle.props.onClick()
  await new Promise(resolve => setImmediate(resolve))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(calls.length, 1, 'opening the cascade fetched the catalog once')
  assert.equal(calls[0].url, 'http://hub.test/desktop/api')
  assert.equal(calls[0].body.type, 'client-request')
  assert.equal(calls[0].body.method, 'llm.models')
  assert.deepEqual(calls[0].body.payload, {})
  assert.equal(typeof calls[0].body.rpcId, 'string')
  // The routes were built inside the VM realm; JSON round-trip before deepStrictEqual.
  assert.deepEqual(JSON.parse(JSON.stringify(seenRoutes)), [[{ provider: 'zai-coding-cn', model: 'glm-4.6', label: 'Zai Coding / GLM-4.6' }]])

  cursor = 0 // re-render with the loaded catalog; open state lives in the hook map
  const open = render()
  assert.ok(text(open).includes('Zai Coding'), 'the provider group header is the provider name')
  assert.ok(text(open).includes('GLM-4.6'), 'the provider lists its models')
  assert.ok(text(open).includes('部分模型服务不可用：'), 'catalog failures surface as a notice')
  assert.ok(text(open).includes('此服务没有可用模型。'), 'a provider without models shows its own hint')
  const modelButton = flatten(open).find(node => node.type === 'button' && node.props['aria-pressed'] !== undefined)
  assert.equal(text(modelButton), 'GLM-4.6')
  modelButton.props.onClick()
  assert.deepEqual(JSON.parse(JSON.stringify(picked)), { provider: 'zai-coding-cn', model: 'glm-4.6' })
})
