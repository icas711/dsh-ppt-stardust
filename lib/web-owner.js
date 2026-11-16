export function workbenchOwner(ctx, request) {
    return workbenchIdentity(ctx, request).login;
}
export function workbenchIdentity(ctx, request) {
    const get = ctx?.get;
    const auth = typeof get === 'function' ? get.call(ctx, 'webAuth') : undefined;
    if (!auth || typeof auth.identityFromCookie !== 'function')
        return { admin: false, local: true };
    const identity = auth.identityFromCookie(request.headers.get('cookie') ?? undefined);
    const login = identity?.login;
    return {
        login: typeof login === 'string' && login ? login : undefined,
        admin: identity?.admin === true,
        local: false,
    };
}
