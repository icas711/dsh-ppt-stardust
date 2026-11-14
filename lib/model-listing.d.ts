/**
 * Owner-scoped model listing for workbench calls. When the harness resolves
 * personal provider planes (`listModelsForOwner(owner, provider)`), routes and
 * provider checks target that owner's configured models; every other case —
 * no owner, an older harness, a missing method — falls back to the shared
 * server-side listing, exactly as before.
 */
export interface OwnerListing {
    providers(): any[];
    models(provider: string): Promise<any[]>;
}
export declare function ownerListing(llm: any, owner?: string): OwnerListing | undefined;
