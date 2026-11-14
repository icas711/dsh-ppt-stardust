/**
 * The web login behind one workbench request, resolved the way the harness
 * authenticates privileged methods: the route handler sees the HTTP request's
 * Cookie header and asks the optional webAuth service. Returns undefined
 * outside a web bundle (tests, older hosts) — callers keep the shared plane.
 */
export function workbenchOwner(ctx: unknown, request: Request): string | undefined {
  const get = (ctx as { get?: (name: string) => unknown } | undefined)?.get
  const auth = typeof get === 'function' ? get.call(ctx, 'webAuth') : undefined
  if (!auth || typeof (auth as { identityFromCookie?: unknown }).identityFromCookie !== 'function') return undefined
  const identity = (auth as { identityFromCookie(cookie: string | undefined): unknown }).identityFromCookie(request.headers.get('cookie') ?? undefined)
  const login = (identity as { login?: unknown } | undefined)?.login
  return typeof login === 'string' && login ? login : undefined
}
