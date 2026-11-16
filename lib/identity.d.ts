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
import type { PptExecution } from './execution.js';
export interface CallerIdentity {
    /** Login of the web user; undefined for local/CLI sessions. */
    login?: string;
    /** Local/CLI session (no owner). */
    local: boolean;
    /** Admin verdict for template management. Fail-closed. */
    admin: boolean;
}
export interface WebAuthLike {
    identityFromCookie?(cookie: string | undefined): {
        login?: unknown;
        admin?: unknown;
    } | undefined;
    isAdmin?(login: string): boolean | undefined;
    resolveAdmin?(login: string): boolean | undefined;
    adminResolver?(login: string): boolean | undefined;
}
/**
 * Resolve the caller of a tool execution. Delegated sessions are never admin;
 * sessions without an owner are local and admin; named owners go through the
 * host webAuth first and the configured `admins` list second.
 */
export declare function resolveToolIdentity(exec: PptExecution | undefined, options?: {
    admins?: string[];
    webAuth?: WebAuthLike;
}): CallerIdentity;
/**
 * Resolve the caller of a workbench request from the auth cookie. The `admin`
 * flag on the identity is authoritative; without it the user is not an admin
 * (fail-closed), regardless of the configured list — the panel is the
 * multi-user plane where the host is the only truth.
 */
export declare function resolvePanelIdentity(auth: WebAuthLike | undefined, cookie: string | undefined): CallerIdentity;
