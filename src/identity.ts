/**
 * Template-library identity and admin resolution.
 *
 * Follows the DSH auto-memory plugin model:
 *   1. Identity is the session header owner — nothing else is consulted.
 *   2. A session without an owner is a local/CLI session and counts as admin,
 *      unless it is a delegated child (fork / fleet), which is never an admin.
 *   3. With an owner set, the host webAuth service is the source of truth when
 *      it answers; otherwise the plugin-config `admins` list is the fallback
 *      (trim-exact, case-sensitive match).
 *   4. Everything inconclusive fails closed: not an admin.
 *
 * For the web panel the identity comes from the auth cookie instead; an
 * explicit `admin` flag on the resolved identity is authoritative.
 */
import type { PptExecution } from './execution.js'

export interface CallerIdentity {
  /** Login of the web user; undefined for local/CLI sessions. */
  login?: string
  /** Local/CLI session (no owner). */
  local: boolean
  /** Admin verdict for template management. Fail-closed. */
  admin: boolean
}

interface SessionHeaderLike {
  owner?: unknown
  sharedReadOnly?: unknown
  delegated?: unknown
  fork?: unknown
  kind?: unknown
}

export interface WebAuthLike {
  identityFromCookie?(cookie: string | undefined): { login?: unknown; admin?: unknown } | undefined
  isAdmin?(login: string): boolean | undefined
  resolveAdmin?(login: string): boolean | undefined
  adminResolver?(login: string): boolean | undefined
}

const truthy = (value: unknown): boolean => value === true || value === 'true'

/** Delegated children (fork / fleet) inherit no admin rights, fail-closed. */
function isDelegated(header: SessionHeaderLike): boolean {
  return truthy(header.sharedReadOnly) || truthy(header.delegated) || truthy(header.fork)
    || header.kind === 'fork' || header.kind === 'fleet' || header.kind === 'delegate'
}

function askHostAdmin(auth: WebAuthLike | undefined, login: string): boolean | undefined {
  if (!auth) return undefined
  for (const method of [auth.isAdmin, auth.resolveAdmin, auth.adminResolver]) {
    if (typeof method !== 'function') continue
    try {
      const verdict = method.call(auth, login)
      if (typeof verdict === 'boolean') return verdict
    } catch { /* The host service may be down; fall through to the config list. */ }
  }
  return undefined
}

function matchesConfigList(admins: string[] | undefined, login: string): boolean {
  return Array.isArray(admins) && admins.some(entry => typeof entry === 'string' && entry.trim() === login)
}

/**
 * Resolve the caller of a tool execution. Delegated sessions are never admin;
 * sessions without an owner are local and admin; named owners go through the
 * host webAuth first and the configured `admins` list second.
 */
export function resolveToolIdentity(exec: PptExecution | undefined, options: { admins?: string[]; webAuth?: WebAuthLike } = {}): CallerIdentity {
  const header: SessionHeaderLike = (exec?.agent?.session?.header ?? {}) as SessionHeaderLike
  if (isDelegated(header)) return { login: typeof header.owner === 'string' ? header.owner : undefined, local: false, admin: false }
  const owner = typeof header.owner === 'string' && header.owner.trim() !== '' ? header.owner : undefined
  if (owner === undefined) return { local: true, admin: true }
  const fromHost = askHostAdmin(options.webAuth, owner)
  if (fromHost !== undefined) return { login: owner, local: false, admin: fromHost }
  return { login: owner, local: false, admin: matchesConfigList(options.admins, owner) }
}

/**
 * Resolve the caller of a workbench request from the auth cookie. The `admin`
 * flag on the identity is authoritative; without it the user is not an admin
 * (fail-closed), regardless of the configured list — the panel is the
 * multi-user plane where the host is the only truth.
 */
export function resolvePanelIdentity(auth: WebAuthLike | undefined, cookie: string | undefined): CallerIdentity {
  const identity = typeof auth?.identityFromCookie === 'function' ? auth.identityFromCookie(cookie) : undefined
  const login = typeof identity?.login === 'string' && identity.login ? identity.login : undefined
  if (login === undefined) return { local: false, admin: false }
  return { login, local: false, admin: identity?.admin === true }
}
