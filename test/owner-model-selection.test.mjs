import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { buildDeckAsync, readDeckProject } from '../skills/dsh-ppt/scripts/deck-advanced.mjs'
import { PptWorkbench, installPptWorkbench, PPT_WORKBENCH_ROUTE } from '../lib/workbench.js'
import { nativeCoachingModel } from '../lib/coaching-model.js'
import { nativeVisualModel } from '../lib/visual-model.js'

const work = resolve('.test-output'); mkdirSync(work, { recursive: true })
const textModel = { id: 'text-model', name: 'Text model', inputModalities: ['text'] }
const visionModel = { id: 'vision-model', name: 'Vision model', inputModalities: ['image', 'text'] }

/** Llm with both planes: shared server-side listing and the per-owner seam of the web user. */
function ownerLlm() {
  const calls = []
  const llm = {
    listProviders: () => { calls.push('shared:providers'); return [{ id: 'shared', name: 'Shared provider' }] },
    listModels: async provider => { calls.push('shared:models:' + provider); return [textModel] },
    listProvidersForOwner: owner => { calls.push('owner:providers:' + owner); return [{ id: 'personal', name: 'Personal provider' }] },
    listModelsForOwner: async (owner, provider) => { calls.push('owner:models:' + owner + ':' + provider); return [textModel, visionModel] },
  }
  return { calls, llm }
}

test('coaching routes resolve the web user personal plane through the owner seam', async () => {
  const { calls, llm } = ownerLlm()
  const routes = await nativeCoachingModel(llm).routes(undefined, 'alice')
  assert.deepEqual(calls, ['owner:providers:alice', 'owner:models:alice:personal'])
  assert.deepEqual(routes.map(r => [r.provider, r.model]), [['personal', 'text-model'], ['personal', 'vision-model']])
})

test('an old harness without the owner seam keeps the shared listing even with an owner', async () => {
  const { calls, llm } = ownerLlm(); delete llm.listModelsForOwner; delete llm.listProvidersForOwner
  const routes = await nativeCoachingModel(llm).routes(undefined, 'alice')
  assert.deepEqual(calls, ['shared:providers', 'shared:models:shared'])
  assert.deepEqual(routes.map(r => r.provider), ['shared'])
})

test('a request without an owner keeps the shared listing even when the seam exists', async () => {
  const { calls, llm } = ownerLlm()
  const routes = await nativeCoachingModel(llm).routes()
  assert.deepEqual(calls, ['shared:providers', 'shared:models:shared'])
  assert.deepEqual(routes.map(r => r.provider), ['shared'])
})

test('generate validates the selected provider against the owner plane', async () => {
  const { llm } = ownerLlm()
  llm.stream = () => ({ [Symbol.asyncIterator]: async function* () { yield { type: 'text-delta', index: 0, text: 'ok' }; yield { type: 'finish', reason: { kind: 'stop' } } } })
  const model = nativeCoachingModel(llm), signal = new AbortController().signal
  await assert.rejects(model.generate({ provider: 'shared', model: 'text-model' }, 's', 'i', signal, 'alice'), /已停用/)
  assert.equal(await model.generate({ provider: 'personal', model: 'text-model' }, 's', 'i', signal, 'alice'), 'ok')
})

test('visual routes resolve the owner plane and keep the image-input filter', async () => {
  const { calls, llm } = ownerLlm()
  const routes = await nativeVisualModel(llm, {}).routes(undefined, 'alice')
  assert.deepEqual(calls, ['owner:providers:alice', 'owner:models:alice:personal'])
  assert.deepEqual(routes, [{ provider: 'personal', model: 'vision-model', label: 'Personal provider / Vision model' }])
})

test('visual inspect rejects a provider outside the owner plane', async () => {
  const { llm } = ownerLlm()
  const images = [{ data: new TextEncoder().encode('png'), name: 'slide-1.png' }]
  await assert.rejects(nativeVisualModel(llm, {}).inspect({ provider: 'shared', model: 'vision-model' }, 's', 'i', images, new AbortController().signal, 'alice'), /已停用/)
})

test('workbench operations thread the request owner into options and creation', async () => {
  const directory = mkdtempSync(join(work, 'owner-'))
  try {
    const created = await buildDeckAsync({ title: '季度计划与交付', slides: [{ layout: 'bullets', title: '季度计划与交付', bullets: ['完成十二个项目'] }], outputDir: directory, fileName: 'plan' })
    const seen = []
    const wb = new PptWorkbench({ catalogPath: join(directory, 'projects.jsonl'),
      coachingModel: { routes: async (_signal, owner) => { seen.push(['coach', owner]); return [{ provider: owner === 'alice' ? 'personal' : 'shared', model: 'm', label: 'L' }] } },
      visualModel: { routes: async (_signal, owner) => { seen.push(['visual', owner]); return [] } } })
    await wb.remember(created, {}, { agent: { session: { header: {} } } })
    const id = (await wb.action({ operation: 'list' })).projects[0].id
    const revision = readDeckProject({ deckPath: created.jsonPath }).manifest.revision

    const coaching = await wb.action({ operation: 'coach-options', id }, undefined, 'alice')
    assert.equal(coaching.routes[0].provider, 'personal')
    const visual = await wb.action({ operation: 'visual-options', id }, undefined, 'bob')
    assert.deepEqual(visual.routes, [])
    const run = await wb.action({ operation: 'coach-create', id, expectedRevision: revision, confirmed: true, mode: 'review', provider: 'personal', model: 'm', difficulty: 'normal', limit: 1 }, undefined, 'alice')
    assert.equal(run.run.route.provider, 'personal')
    await assert.rejects(wb.action({ operation: 'coach-create', id, expectedRevision: revision, confirmed: true, mode: 'review', provider: 'personal', model: 'm', difficulty: 'normal', limit: 1 }, undefined, 'carol'), /模型列表已变化/)
    // Without an owner the same request keeps the shared plane.
    const anonymous = await wb.action({ operation: 'coach-options', id })
    assert.equal(anonymous.routes[0].provider, 'shared')
    assert.deepEqual(seen, [['coach', 'alice'], ['visual', 'bob'], ['coach', 'alice'], ['coach', 'carol'], ['coach', undefined]])
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('the registered workbench route resolves the owner from the request cookie', async () => {
  const directory = mkdtempSync(join(work, 'owner-route-'))
  try {
    const created = await buildDeckAsync({ title: '季度计划与交付', slides: [{ layout: 'bullets', title: '季度计划与交付', bullets: ['完成十二个项目'] }], outputDir: directory, fileName: 'plan' })
    const seen = [], cookies = []
    const wb = new PptWorkbench({ catalogPath: join(directory, 'projects.jsonl'),
      coachingModel: { routes: async (_signal, owner) => { seen.push(owner); return [{ provider: owner === 'alice' ? 'personal' : 'shared', model: 'm', label: 'L' }] } } })
    await wb.remember(created, {}, { agent: { session: { header: {} } } })
    const id = (await wb.action({ operation: 'list' })).projects[0].id
    let handler
    installPptWorkbench({
      get(name) { return name === 'webAuth' ? { identityFromCookie(cookie) { cookies.push(cookie); return cookie?.includes('sid=alice') ? { login: 'alice', admin: false, root: '/tmp/alice' } : undefined } } : undefined },
      inject(_deps, fn) { fn({ connection: { fetch: { register(route) { if (route.path === PPT_WORKBENCH_ROUTE) handler = route.fetch } } } }) },
    }, wb)
    const request = body => new Request('http://local' + PPT_WORKBENCH_ROUTE, { method: 'POST', headers: { 'content-type': 'application/json', 'x-dsh-ppt-action': '1', ...(body.cookie ? { cookie: body.cookie } : {}) }, body: JSON.stringify({ operation: 'coach-options', id }) })
    const signed = await handler(request({ cookie: 'other=v; sid=alice-session' }))
    assert.equal((await signed.json()).routes[0].provider, 'personal')
    const anonymous = await handler(request({}))
    assert.equal((await anonymous.json()).routes[0].provider, 'shared')
    assert.deepEqual(seen, ['alice', undefined])
    assert.deepEqual(cookies, ['other=v; sid=alice-session', undefined])
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
