export function ownerListing(llm, owner) {
    if (!owner || typeof llm?.listModelsForOwner !== 'function')
        return undefined;
    return {
        providers: () => typeof llm.listProvidersForOwner === 'function' ? llm.listProvidersForOwner(owner) : llm.listProviders(),
        models: (provider) => Promise.resolve(llm.listModelsForOwner(owner, provider)),
    };
}
