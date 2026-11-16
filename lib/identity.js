const truthy = (value) => value === true || value === 'true';
/** Delegated children (fork / fleet) inherit no admin rights, fail-closed. */
function isDelegated(header) {
    return truthy(header.sharedReadOnly) || truthy(header.delegated) || truthy(header.fork)
        || header.kind === 'fork' || header.kind === 'fleet' || header.kind === 'delegate';
}
function askHostAdmin(auth, login) {
    if (!auth)
        return undefined;
    for (const method of [auth.isAdmin, auth.resolveAdmin, auth.adminResolver]) {
        if (typeof method !== 'function')
            continue;
        try {
            const verdict = method.call(auth, login);
            if (typeof verdict === 'boolean')
                return verdict;
        }
        catch { /* The host service may be down; fall through to the config list. */ }
    }
    return undefined;
}
function matchesConfigList(admins, login) {
    return Array.isArray(admins) && admins.some(entry => typeof entry === 'string' && entry.trim() === login);
}
/**
 * Resolve the caller of a tool execution. Delegated sessions are never admin;
 * sessions without an owner are local and admin; named owners go through the
 * host webAuth first and the configured `admins` list second.
 */
export function resolveToolIdentity(exec, options = {}) {
    const header = (exec?.agent?.session?.header ?? {});
    if (isDelegated(header))
        return { login: typeof header.owner === 'string' ? header.owner : undefined, local: false, admin: false };
    const owner = typeof header.owner === 'string' && header.owner.trim() !== '' ? header.owner : undefined;
    if (owner === undefined)
        return { local: true, admin: true };
    const fromHost = askHostAdmin(options.webAuth, owner);
    if (fromHost !== undefined)
        return { login: owner, local: false, admin: fromHost };
    return { login: owner, local: false, admin: matchesConfigList(options.admins, owner) };
}
/**
 * Resolve the caller of a workbench request from the auth cookie. The `admin`
 * flag on the identity is authoritative; without it the user is not an admin
 * (fail-closed), regardless of the configured list — the panel is the
 * multi-user plane where the host is the only truth.
 */
export function resolvePanelIdentity(auth, cookie) {
    const identity = typeof auth?.identityFromCookie === 'function' ? auth.identityFromCookie(cookie) : undefined;
    const login = typeof identity?.login === 'string' && identity.login ? identity.login : undefined;
    if (login === undefined)
        return { local: false, admin: false };
    return { login, local: false, admin: identity?.admin === true };
}
