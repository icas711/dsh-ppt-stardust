import type { ResolvedPptConfig } from './config.js';
import type { DeckEngine, PptThemesResult } from './types.js';
import { PptTemplateStore } from './templates.js';
import { type WebAuthLike } from './identity.js';
/** The Harness execution fields used by this plugin; optional for direct callers. */
export interface PptExecution {
    readonly signal?: AbortSignal;
    readonly agent?: {
        readonly session: {
            readonly header: {
                readonly cwd?: string;
            };
            requestContext?(): any;
            requestHeader?(): any;
        };
    };
}
export interface ExecutorOptions {
    /** Template library; when absent, library template features degrade gracefully. */
    templateStore?: PptTemplateStore;
    /** Host webAuth bridge for admin verdicts (optional). */
    webAuth?: WebAuthLike;
}
export declare function getEngine(): Promise<DeckEngine>;
/** Shared template implementation from the skill scripts. */
export declare function loadTemplatesModule(): Promise<Record<string, any>>;
/** Build executors with a shared engine loader; resolve paths separately for each call. */
export declare function createPptExecutors(config: ResolvedPptConfig, loadEngine?: () => Promise<DeckEngine>, options?: ExecutorOptions): {
    themes(rawArgs: unknown, exec?: PptExecution): Promise<PptThemesResult>;
    create(rawArgs: unknown, exec?: PptExecution): Promise<import("./types.js").PptCreateResult>;
    templates(rawArgs: unknown, exec?: PptExecution): Promise<{
        ok: boolean;
        templates: unknown[];
    }>;
    /** ppt_template: библиотека шаблонов — список, импорт/экспорт, создание из pptx/проекта, редизайн. */
    template(rawArgs: unknown, exec?: PptExecution): Promise<{
        ok: boolean;
        generationReport: any;
        templates?: undefined;
        scenarios?: undefined;
        template?: undefined;
        manifest?: undefined;
        key?: undefined;
        report?: undefined;
        deleted?: undefined;
        path?: undefined;
        bytes?: undefined;
        changed?: undefined;
        revision?: undefined;
        files?: undefined;
    } | {
        ok: boolean;
        templates: import("./types.js").PptTemplateSummary[];
        scenarios: unknown[];
        generationReport?: undefined;
        template?: undefined;
        manifest?: undefined;
        key?: undefined;
        report?: undefined;
        deleted?: undefined;
        path?: undefined;
        bytes?: undefined;
        changed?: undefined;
        revision?: undefined;
        files?: undefined;
    } | {
        ok: boolean;
        template: any;
        manifest: Record<string, any>;
        generationReport?: undefined;
        templates?: undefined;
        scenarios?: undefined;
        key?: undefined;
        report?: undefined;
        deleted?: undefined;
        path?: undefined;
        bytes?: undefined;
        changed?: undefined;
        revision?: undefined;
        files?: undefined;
    } | {
        ok: boolean;
        key: string;
        template: any;
        report: any;
        generationReport?: undefined;
        templates?: undefined;
        scenarios?: undefined;
        manifest?: undefined;
        deleted?: undefined;
        path?: undefined;
        bytes?: undefined;
        changed?: undefined;
        revision?: undefined;
        files?: undefined;
    } | {
        ok: boolean;
        key: string;
        template: any;
        generationReport?: undefined;
        templates?: undefined;
        scenarios?: undefined;
        manifest?: undefined;
        report?: undefined;
        deleted?: undefined;
        path?: undefined;
        bytes?: undefined;
        changed?: undefined;
        revision?: undefined;
        files?: undefined;
    } | {
        ok: boolean;
        deleted: string;
        generationReport?: undefined;
        templates?: undefined;
        scenarios?: undefined;
        template?: undefined;
        manifest?: undefined;
        key?: undefined;
        report?: undefined;
        path?: undefined;
        bytes?: undefined;
        changed?: undefined;
        revision?: undefined;
        files?: undefined;
    } | {
        ok: boolean;
        path: string;
        bytes: number;
        generationReport?: undefined;
        templates?: undefined;
        scenarios?: undefined;
        template?: undefined;
        manifest?: undefined;
        key?: undefined;
        report?: undefined;
        deleted?: undefined;
        changed?: undefined;
        revision?: undefined;
        files?: undefined;
    } | {
        ok: boolean;
        template: {
            id: string;
            revision: number;
        };
        changed: boolean | undefined;
        revision: number | undefined;
        files: {
            html: string;
            pptx: string;
            json: string;
            pdf?: string;
        };
        generationReport?: undefined;
        templates?: undefined;
        scenarios?: undefined;
        manifest?: undefined;
        key?: undefined;
        report?: undefined;
        deleted?: undefined;
        path?: undefined;
        bytes?: undefined;
    }>;
    edit(rawArgs: unknown, exec?: PptExecution): Promise<import("./types.js").PptCreateResult>;
    undo(rawArgs: unknown, exec?: PptExecution): Promise<import("./types.js").PptCreateResult>;
    check(rawArgs: unknown, exec?: PptExecution): Promise<import("./types.js").PptQualityResult | import("./types.js").PptCheckResult>;
    render(rawArgs: unknown, exec?: PptExecution): Promise<import("./types.js").PptRenderResult>;
    data(rawArgs: unknown, exec?: PptExecution): Promise<import("./types.js").PptCreateResult | Record<string, any>>;
};
