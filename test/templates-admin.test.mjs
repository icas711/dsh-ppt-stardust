// Модель админа (identity), хранилище шаблонов и матрица прав.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const identity = await import('../src/identity.ts').catch(() => null) ?? await import('../lib/identity.js')
const templatesMod = await import('../lib/templates.js').catch(() => null) ?? await import('../src/templates.ts')
const engineModule = await import('../skills/dsh-ppt/scripts/deck-templates.mjs')
const { PptTemplateStore } = templatesMod

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
const withTmp = (fn) => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-ppt-admin-'))
  try { return fn(dir) } finally { rmSync(dir, { recursive: true, force: true }) }
}

// identity: resolveToolIdentity / resolvePanelIdentity
const localExec = { agent: { session: { header: {} } } }
const userExec = login => ({ agent: { session: { header: { owner: login } } } })
const delegateExec = { agent: { session: { header: { owner: 'alice', sharedReadOnly: true } } } }

test('tool identity: local session is admin, delegated never, host verdict wins, config list is fallback', () => {
  const { resolveToolIdentity } = identity
  // Локальная/CLI-сессия без owner → админ
  assert.equal(resolveToolIdentity(localExec).admin, true)
  // Делегированная сессия — никогда не админ, даже с owner
  assert.equal(resolveToolIdentity(delegateExec).admin, false)
  assert.equal(resolveToolIdentity({ agent: { session: { header: { sharedReadOnly: true } } } }).admin, false)
  // owner + авторитетный ответ хоста
  assert.equal(resolveToolIdentity(userExec('alice'), { webAuth: { isAdmin: () => true } }).admin, true)
  assert.equal(resolveToolIdentity(userExec('alice'), { webAuth: { isAdmin: () => false } }).admin, false)
  // Хост вернул undefined → запасной список admins (trim, регистрозависимо)
  assert.equal(resolveToolIdentity(userExec('alice'), { admins: ['alice'] }).admin, true)
  assert.equal(resolveToolIdentity(userExec('alice'), { admins: [' alice '] }).admin, true)
  assert.equal(resolveToolIdentity(userExec('alice'), { admins: ['Alice'] }).admin, false)
  assert.equal(resolveToolIdentity(userExec('alice'), { admins: [] }).admin, false)
  // Хост недоступен и списка нет → fail-closed
  assert.equal(resolveToolIdentity(userExec('alice'), {}).admin, false)
})

test('panel identity: cookie admin flag is authoritative, absent identity is not admin', () => {
  const { resolvePanelIdentity } = identity
  const auth = {
    identityFromCookie: cookie => cookie === 'sid=1' ? { login: 'alice', admin: true } : cookie === 'sid=2' ? { login: 'bob', admin: false } : undefined,
  }
  assert.deepEqual(resolvePanelIdentity(auth, 'sid=1'), { login: 'alice', admin: true, local: false })
  assert.equal(resolvePanelIdentity(auth, 'sid=2').admin, false)
  assert.equal(resolvePanelIdentity(auth, 'sid=x').login, undefined)
  assert.equal(resolvePanelIdentity(undefined, 'sid=1').admin, false)
})

// Хранилище: скоупы, публикация, изоляция
const manifest = (id, overrides = {}) => ({
  schemaVersion: 1, id, name: 'Шаблон ' + id, revision: 1,
  style: { theme: 'data', brand: { primaryColor: '#102030' } },
  outline: [{ layout: 'cover', title: '{{deck.title}}' }],
  ...overrides,
})
const makeStore = (root) => new PptTemplateStore({
  root: join(root, 'templates'),
  templatesModuleLoader: () => Promise.resolve(engineModule),
  admins: ['admin-bob'],
})

test('store: user saves to own scope, admin publish copies into public', () => withTmp(async dir => {
  const store = makeStore(dir)
  const alice = { login: 'alice', admin: false, local: false }
  const saved = await store.save({ manifest: manifest('corp-blue'), assets: {}, identity: alice })
  assert.equal(saved.key, 'user:corp-blue')
  assert.ok(existsSync(join(dir, 'templates', 'users', 'alice', 'corp-blue', 'template.json')))
  const list = await store.list(alice)
  assert.deepEqual(list.map(t => t.scope), ['user'])
  // Публикация обычным пользователем запрещена
  await assert.rejects(() => store.publish({ key: 'user:corp-blue', identity: alice }), /администратор/)
  // Админ публикует копию чужого шаблона (с указанием владельца)
  const admin = { login: 'admin-bob', admin: true, local: false }
  const published = await store.publish({ key: 'user:corp-blue', identity: admin, owner: 'alice' })
  assert.equal(published.key, 'public:corp-blue')
  // Автор оригинала сохраняется, публикатора знает лог аудита
  assert.equal(published.manifest.author, 'alice')
  // У alice видны builtin(0) + public + свой
  const afterList = await store.list(alice)
  assert.deepEqual(afterList.map(t => t.scope).sort(), ['public', 'user'])
  // Каролина не видит личный шаблон alice
  const carol = { login: 'carol', admin: false, local: false }
  assert.deepEqual((await store.list(carol)).map(t => t.scope), ['public'])
  await assert.rejects(() => store.get('user:corp-blue', carol), /не найден|личные/)
}))

test('store: revision bumps on overwrite and createdAt stays', () => withTmp(async dir => {
  const store = makeStore(dir)
  const alice = { login: 'alice', admin: false, local: false }
  const first = await store.save({ manifest: manifest('rev-tpl'), assets: {}, identity: alice })
  const createdAt = first.manifest.createdAt
  const second = await store.save({ manifest: manifest('rev-tpl'), assets: {}, identity: alice })
  assert.equal(second.manifest.revision, 2)
  assert.equal(second.manifest.createdAt, createdAt)
}))

test('store: admin-only public delete; builtin import blocked; builtin dir listed read-only', () => withTmp(async dir => {
  const store = makeStore(dir)
  const alice = { login: 'alice', admin: false, local: false }
  const admin = { login: 'admin-bob', admin: true, local: false }
  await store.save({ manifest: manifest('del-tpl'), assets: {}, identity: alice })
  // Пользователь удаляет свой — можно; общий — нельзя
  await store.delete('user:del-tpl', alice)
  assert.equal(existsSync(join(dir, 'templates', 'users', 'alice', 'del-tpl')), false)
  const saved2 = await store.save({ manifest: manifest('del-tpl-2'), assets: {}, identity: alice })
  await assert.rejects(() => store.publish({ key: saved2.key, identity: alice }), /администратор/)
  // Не-админ не может указывать владельца
  await assert.rejects(() => store.publish({ key: saved2.key, identity: { login: 'alice', admin: false, local: false }, owner: 'bob' }), /администратор/)
  await assert.rejects(() => store.delete('public:any-tpl', alice), /администратор/)
  // Встроенные: read-only
  const builtinDir = join(dir, 'builtin')
  mkdirSync(join(builtinDir, 'built-one'), { recursive: true })
  writeFileSync(join(builtinDir, 'built-one', 'template.json'), JSON.stringify(manifest('built-one')))
  const builtinStore = new PptTemplateStore({
    root: join(dir, 'templates'), builtinDir,
    templatesModuleLoader: () => Promise.resolve(engineModule),
  })
  const list = await builtinStore.list(alice)
  const builtin = list.find(t => t.scope === 'builtin')
  assert.equal(builtin.id, 'built-one')
  const record = await builtinStore.get('builtin:built-one', alice)
  assert.equal(record.readonly, true)
  await assert.rejects(() => builtinStore.delete('builtin:built-one', admin), /удалить нельзя/)
}))

test('store: import from bundle bytes; scope public requires admin', () => withTmp(async dir => {
  const store = makeStore(dir)
  const alice = { login: 'alice', admin: false, local: false }
  const admin = { login: 'admin-bob', admin: true, local: false }
  const zip = engineModule.buildTemplateBundle(manifest('imp-tpl'), {})
  await assert.rejects(() => store.import({ bytes: zip, scope: 'public', identity: alice }), /администратор/)
  const saved = await store.import({ bytes: zip, identity: alice })
  assert.equal(saved.key, 'user:imp-tpl')
  assert.equal(saved.manifest.author, 'alice')
  const asAdmin = await store.import({ bytes: zip, scope: 'public', identity: admin })
  assert.equal(asAdmin.key, 'public:imp-tpl')
  // Export записывает bundle в каталог сессии
  const written = await store.export('user:imp-tpl', dir, alice)
  assert.ok(written.bytes > 100)
  assert.ok(existsSync(written.path))
}))

test('store: restyle/create options resolve through the library', () => withTmp(async dir => {
  const store = makeStore(dir)
  const alice = { login: 'alice', admin: false, local: false }
  await store.save({
    manifest: manifest('style-tpl', { style: { theme: 'velvet', brand: { primaryColor: '#010203', footer: 'Ф' } } }),
    assets: {}, identity: alice,
  })
  const { restyle, lineage } = await store.restyleOptions('user:style-tpl', alice)
  assert.equal(restyle.theme, 'velvet')
  assert.equal(restyle.brand.footer, 'Ф')
  assert.deepEqual(lineage, { id: 'style-tpl', revision: 1 })
  const { create } = await store.createOptions('user:style-tpl', alice, { title: 'Новая' })
  assert.equal(create.theme, 'velvet')
  assert.equal(create.slides[0].title, 'Новая')
  // Локальная сессия не может использовать личные шаблоны (нет login)
  const local = { admin: true, local: true }
  await assert.rejects(() => store.createOptions('user:style-tpl', local, { title: 'X' }), /вошедшим/)
  // Но видит public и builtin
  const list = await store.list(local)
  assert.ok(list.every(t => t.scope !== 'user'))
}))
