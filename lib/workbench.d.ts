import { type PptExecution } from './execution.js';
import type { DeckEngine } from './types.js';
import { PptCoaching } from './coaching.js';
import type { CoachingModel } from './coaching-model.js';
import { PptVisual } from './visual.js';
import type { VisualModel } from './visual-model.js';
import type { PptTemplateStore } from './templates.js';
import type { WorkbenchIdentity } from './web-owner.js';
export declare const PPT_WORKBENCH_ROUTE = "/api/dsh-ppt/workbench";
export declare const PPT_DOWNLOAD_ROUTE = "/api/dsh-ppt/download";
export declare const PPT_TEMPLATE_UPLOAD_ROUTE = "/api/dsh-ppt/template-upload";
type WorkbenchEngine = DeckEngine & {
    readDeckProject(options: Record<string, unknown>): {
        manifest: any;
        path: string;
    };
};
type Options = {
    catalogPath?: string;
    loadEngine?: () => Promise<WorkbenchEngine>;
    coachingModel?: CoachingModel;
    visualModel?: VisualModel;
};
export declare class PptWorkbench {
    readonly catalogPath: string;
    readonly coaching: PptCoaching;
    readonly visual: PptVisual;
    private readonly loadEngine;
    private readonly renders;
    private templates?;
    constructor(options?: Options);
    /** Attach the template library (index.ts); identity comes from the auth cookie. */
    attachTemplateStore(store: PptTemplateStore): void;
    private templatesModule;
    private needTemplates;
    private catalog;
    private visibleProjects;
    /** Recording a completed tool never turns a successful generation into an error. */
    remember(result: any, args: unknown, exec?: PptExecution, identity?: WorkbenchIdentity): Promise<void>;
    private project;
    private view;
    private revision;
    private patch;
    action(body: Record<string, unknown>, signal?: AbortSignal, identity?: WorkbenchIdentity): Promise<unknown>;
    fetchDownload(request: Request, identity?: WorkbenchIdentity): Promise<Response>;
    /** Загрузка PPTX с диска пользователя: сырое тело (не base64), параметры в query. Результат — шаблон + отчёт импорта. */
    fetchTemplateUpload(request: Request, identity?: WorkbenchIdentity): Promise<Response>;
    fetch(request: Request, identity?: WorkbenchIdentity): Promise<Response>;
}
export declare function installPptWorkbench(ctx: any, workbench: PptWorkbench): void;
export {};
