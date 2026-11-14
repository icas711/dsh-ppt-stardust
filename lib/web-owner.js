/**
 * The web login behind one workbench request, resolved the way the harness
 * authenticates privileged methods: the route handler sees the HTTP request's
 * Cookie header and asks the optional webAuth service. Returns undefined
 * outside a web bundle (tests, older hosts) — callers keep the shared plane.
 */
export function workbenchOwner(ctx, request) {
    const get = ctx?.get;
    const auth = typeof get === 'function' ? get.call(ctx, 'webAuth') : undefined;
    if (!auth || typeof auth.identityFromCookie !== 'function')
        return undefined;
    const identity = auth.identityFromCookie(request.headers.get('cookie') ?? undefined);
    const login = identity?.login;
    return typeof login === 'string' && login ? login : undefined;
}
