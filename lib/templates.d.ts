import type { CallerIdentity } from './identity.js';
import type { PptTemplateSummary } from './types.js';
export interface TemplateRecord {
    manifest: Record<string, any>;
    assets: Record<string, {
        bytes: Buffer;
        mime: string;
        width: number;
        height: number;
        data: string;
    }>;
    key: string;
    dir: string;
    readonly: boolean;
}
export interface TemplateStoreOptions {
    /** Directory that holds templates/ (defaults to <catalogDir>/templates). */
    root: string;
    /** Directory of plugin-shipped builtin bundles (assets/templates). */
    builtinDir?: string;
    /** Lazy loader of the shared skill-script implementation. */
    templatesModuleLoader: () => Promise<Record<string, any>>;
    /** Plugin config admin fallback list. */
    admins?: string[];
}
export declare class PptTemplateStore {
    readonly root: string;
    readonly builtinDir?: string;
    private readonly loader;
    private readonly admins?;
    private cache;
    constructor(options: TemplateStoreOptions);
    private mod;
    isAdmin(identity: CallerIdentity): boolean;
    private usersRoot;
    private publicRoot;
    private userDir;
    private dirOf;
    private builtinIds;
    private scopeIds;
    private load;
    /** List templates visible to the caller: builtin + public + own. */
    list(identity: CallerIdentity): Promise<PptTemplateSummary[]>;
    /** Resolve a template with assets for apply/restyle. */
    get(key: string, identity: CallerIdentity): Promise<TemplateRecord>;
    /** What the caller may do with a template and where an edit is stored. */
    access(record: TemplateRecord, identity: CallerIdentity): {
        canEdit: boolean;
        saveScope: 'public' | 'user';
        overridesBuiltin: boolean;
    };
    /** Create or update a template in the caller's own space (or public for admins). */
    save(input: {
        manifest: Record<string, any>;
        assets?: Record<string, any>;
        scope?: string;
        expectedRevision?: number;
        identity: CallerIdentity;
    }): Promise<TemplateRecord>;
    /** Assets named by the manifest: unchanged ones come from the stored base template, new ones from uploads. */
    private draftAssets;
    /** Save an editor draft: the manifest plus only the assets that are new or changed. */
    saveDraft(input: {
        manifest: Record<string, any>;
        uploads?: Record<string, any>;
        baseKey?: string;
        scope?: string;
        expectedRevision?: number;
        identity: CallerIdentity;
    }): Promise<TemplateRecord>;
    /** Copy any visible template into the caller's own library under a new id. */
    duplicate(input: {
        key: string;
        newId: string;
        name: string;
        identity: CallerIdentity;
    }): Promise<TemplateRecord>;
    /** Arguments for the engine's HTML-only preview of an unsaved draft. */
    previewOptions(input: {
        manifest: Record<string, any>;
        uploads?: Record<string, any>;
        baseKey?: string;
        lang?: string;
        identity: CallerIdentity;
    }): Promise<Record<string, any>>;
    /** Import a bundle (.zip or template.json) into user space, or public for admins. */
    import(input: {
        source?: string;
        bytes?: Buffer;
        scope?: string;
        identity: CallerIdentity;
    }): Promise<TemplateRecord>;
    /**
     * Publish a copy of a visible template into public. Admin only. An admin may
     * name another user's template with `owner` (their login); non-admins can
     * only ever see their own user scope, so `owner` is rejected for them.
     */
    publish(input: {
        key: string;
        identity: CallerIdentity;
        owner?: string;
    }): Promise<TemplateRecord>;
    delete(key: string, identity: CallerIdentity): Promise<{
        ok: true;
    }>;
    /** Write a template bundle into a session workspace directory. */
    export(key: string, outDir: string, identity: CallerIdentity): Promise<{
        path: string;
        bytes: number;
    }>;
    /** Style options for editDeck restyle + lineage. */
    restyleOptions(key: string, identity: CallerIdentity): Promise<{
        restyle: Record<string, any>;
        lineage: {
            id: string;
            revision: number;
        };
    }>;
    /** Create options for buildDeckAsync + lineage. */
    createOptions(key: string, identity: CallerIdentity, options: {
        title: string;
        includeSamples?: boolean;
        lang?: string;
    }): Promise<{
        create: Record<string, any>;
        lineage: {
            id: string;
            revision: number;
        };
    }>;
    invalidate(): void;
}
