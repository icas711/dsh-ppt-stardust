/**
 * The web login behind one workbench request, resolved the way the harness
 * authenticates privileged methods: the route handler sees the HTTP request's
 * Cookie header and asks the optional webAuth service. Returns undefined
 * outside a web bundle (tests, older hosts) — callers keep the shared plane.
 */
export declare function workbenchOwner(ctx: unknown, request: Request): string | undefined;
