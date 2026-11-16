/**
 * The web login behind one workbench request, resolved the way the harness
 * authenticates privileged methods: the route handler sees the HTTP request's
 * Cookie header and asks the optional webAuth service. Returns undefined
 * outside a web bundle (tests, older hosts) — callers keep the shared plane.
 *
 * The template library additionally reads the authoritative `admin` flag from
 * the same identity (host webAuth is the single source of truth); without it
 * the caller is treated as a non-admin (fail-closed).
 */
export interface WorkbenchIdentity {
  login?: string
  admin: boolean
  local: boolean
}

export function workbenchOwner(ctx: unknown, request: Request): string | undefined {
  return workbenchIdentity(ctx, request).login
}

export function workbenchIdentity(ctx: unknown, request: Request): WorkbenchIdentity {
  const get = (ctx as { get?: (name: string) => unknown } | undefined)?.get
  const auth = typeof get === 'function' ? get.call(ctx, 'webAuth') : undefined
  if (!auth || typeof (auth as { identityFromCookie?: unknown }).identityFromCookie !== 'function') return { admin: false, local: true }
  const identity = (auth as { identityFromCookie(cookie: string | undefined): { login?: unknown; admin?: unknown } | undefined }).identityFromCookie(request.headers.get('cookie') ?? undefined)
  const login = (identity as { login?: unknown } | undefined)?.login
  return {
    login: typeof login === 'string' && login ? login : undefined,
    admin: (identity as { admin?: unknown } | undefined)?.admin === true,
    local: false,
  }
}
