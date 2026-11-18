/**
 * The web login behind one workbench request, resolved the way the harness
 * authenticates privileged methods: the route handler sees the HTTP request's
 * Cookie header and asks the optional webAuth service. Returns undefined
 * outside a web bundle (tests, older hosts) — callers keep local access.
 * With webAuth present, unauthenticated requests never receive project access.
 *
 * The template library additionally reads the authoritative `admin` flag from
 * the same identity (host webAuth is the single source of truth); without it
 * the caller is treated as a non-admin (fail-closed).
 */
export interface WorkbenchIdentity {
    login?: string;
    admin: boolean;
    local: boolean;
}
export declare function workbenchOwner(ctx: unknown, request: Request): string | undefined;
export declare function workbenchIdentity(ctx: unknown, request: Request): WorkbenchIdentity;
