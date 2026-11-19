import { lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, relative, isAbsolute, sep } from 'node:path'
import { randomUUID } from 'node:crypto'

export const RENDER_RETENTION_MS = 90 * 24 * 60 * 60 * 1000
export function pluginStorageDir() {
  return resolve(process.env.DSH_HOME || join(homedir(), '.dsh'), 'plugins', 'dsh-ppt')
}
export function cacheScope(value) {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) throw new Error('Invalid render cache scope')
  return value
}
export function renderCacheDir(scope) {
  const base = join(pluginStorageDir(), 'tmp'), key = cacheScope(scope)
  return key ? join(base, 'session-' + key) : base
}

// Only directories reserved by this module belong to the cache. Never follow
// junctions/symlinks, or sweep legacy output directories and permanent projects.
function ownedRoot(path) {
  const cache = renderCacheDir(), rel = relative(cache, resolve(path))
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return
  const parts = rel.split(sep)
  const scoped = /^session-[0-9a-f]{64}$/.test(parts[0])
  const name = parts[scoped ? 1 : 0]
  if (!/^render-[0-9a-f-]{36}$/.test(name ?? '')) return
  const parent = scoped ? join(cache, parts[0]) : cache
  const root = join(parent, name)
  try {
    if (realpathSync(cache) !== cache || realpathSync(parent) !== parent || realpathSync(root) !== root || !lstatSync(root).isDirectory()) return
    return root
  } catch { return }
}

export function isRenderCachePath(path) { return !!ownedRoot(path) }

export function cleanupRenderCache(now = Date.now()) {
  const cache = renderCacheDir()
  let entries
  try { if (realpathSync(cache) !== cache) return; entries = readdirSync(cache) } catch (error) { if (error.code === 'ENOENT') return; throw error }
  const candidates = entries.flatMap(name => {
    const directory = join(cache, name)
    if (!/^session-[0-9a-f]{64}$/.test(name)) return [directory]
    try {
      if (realpathSync(directory) !== directory || !lstatSync(directory).isDirectory()) return []
      return readdirSync(directory).map(child => join(directory, child))
    } catch { return [] }
  })
  for (const candidate of candidates) {
    const root = ownedRoot(candidate)
    if (!root) continue
    try {
      const marker = join(root, '.last-used'), info = lstatSync(marker)
      if (!info.isFile() || info.isSymbolicLink() || now - info.mtimeMs <= RENDER_RETENTION_MS) continue
      // Recheck the resolved absolute target immediately before recursive removal.
      if (ownedRoot(root) === root) rmSync(root, { recursive: true, force: true })
    } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
}

export function reserveRenderCache(scope) {
  cacheScope(scope)
  cleanupRenderCache()
  const root = join(renderCacheDir(scope), 'render-' + randomUUID())
  mkdirSync(root, { recursive: true, mode: 0o700 })
  writeFileSync(join(root, '.last-used'), '', { flag: 'wx', mode: 0o600 })
  // The renderer reserves its own fresh child and owns its failure cleanup.
  return join(root, 'render')
}

export function touchRenderCache(path, now = new Date()) {
  const root = ownedRoot(path)
  if (root) utimesSync(join(root, '.last-used'), now, now)
}

/** Legacy projects use siblings; new plugin projects keep JSON permanently here. */
export function projectPaths(jsonPath, manifest) {
  const base = manifest?.delivery?.base ?? jsonPath.slice(0, -5)
  return { html: base + '.html', pptx: base + '.pptx', json: jsonPath }
}

export function storedProjectPaths(jsonPath) {
  return projectPaths(jsonPath, JSON.parse(readFileSync(jsonPath, 'utf8')))
}
