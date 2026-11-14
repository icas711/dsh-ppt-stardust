/**
 * Browser RPC to the host model catalog: the same `llm.models` call the DSH
 * Models page and the prompt selector use. The host resolves the caller's
 * personal provider plane from the session cookie, so no owner value travels
 * through plugin code here. The workbench server listing
 * (`coach-options` / `visual-options`) stays for compatibility; the cascade
 * UI reads this catalog and surfaces failures instead of swallowing them.
 */
export interface CatalogModel {
    id: string;
    name?: string;
    inputModalities?: string[];
}
export interface CatalogGroup {
    id: string;
    name?: string;
    models: CatalogModel[];
}
export interface ModelCatalog {
    groups: CatalogGroup[];
    failures: unknown[];
}
export interface RouteOption {
    provider: string;
    model: string;
    label: string;
}
export interface CatalogRequest {
    endpoint?: URL | string;
    signal?: AbortSignal;
}
/** Catalog problems are loud: the cascade shows the message plus a retry. */
export declare class ModelCatalogError extends Error {
    readonly detail: string;
    constructor(message: string, detail?: string);
}
export declare function fetchModelCatalog(request?: CatalogRequest): Promise<ModelCatalog>;
/** Text-capable models; modalities that the catalog does not declare stay selectable. */
export declare function acceptsText(model: CatalogModel): boolean;
/** Image+text models keep the strict rule whenever the catalog declares modalities. */
export declare function acceptsVision(model: CatalogModel): boolean;
/** Flatten provider groups into workbench route rows in the established label shape. */
export declare function catalogRoutes(groups: CatalogGroup[], accept: (model: CatalogModel) => boolean): RouteOption[];
