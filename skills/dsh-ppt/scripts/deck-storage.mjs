import { lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, relative, isAbsolute, sep } from 'node:path'
import { randomUUID } from 'node:crypto'

export const RENDER_RETENTION_MS = 90 * 24 * 60 * 60 * 1000
export function pluginStorageDir() {
  return resolve(process.env.DSH_HOME || join(homedir(), '.dsh'), 'plugins', 'dsh-ppt')
}
export function renderCacheDir() { return join(pluginStorageDir(), 'tmp') }

// Only directories reserved by this module belong to the cache. Never follow
// junctions/symlinks, or sweep legacy output directories and permanent projects.
function ownedRoot(path) {
  const cache = renderCacheDir(), rel = relative(cache, resolve(path))
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return
  const name = rel.split(sep)[0]
  if (!/^render-[0-9a-f-]{36}$/.test(name)) return
  const root = join(cache, name)
  try {
    if (realpathSync(cache) !== cache || realpathSync(root) !== root || !lstatSync(root).isDirectory()) return
    return root
  } catch { return }
}

export function isRenderCachePath(path) { return !!ownedRoot(path) }

export function cleanupRenderCache(now = Date.now()) {
  const cache = renderCacheDir()
  let entries
  try { if (realpathSync(cache) !== cache) return; entries = readdirSync(cache) } catch (error) { if (error.code === 'ENOENT') return; throw error }
  for (const name of entries) {
    const root = ownedRoot(join(cache, name))
    if (!root) continue
    try {
      const marker = join(root, '.last-used'), info = lstatSync(marker)
      if (!info.isFile() || info.isSymbolicLink() || now - info.mtimeMs <= RENDER_RETENTION_MS) continue
      // Recheck the resolved absolute target immediately before recursive removal.
      if (ownedRoot(root) === root) rmSync(root, { recursive: true, force: true })
    } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
}

export function reserveRenderCache() {
  cleanupRenderCache()
  const root = join(renderCacheDir(), 'render-' + randomUUID())
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
