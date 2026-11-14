/** Catalog problems are loud: the cascade shows the message plus a retry. */
export class ModelCatalogError extends Error {
    detail;
    constructor(message, detail = '') {
        super(message);
        this.name = 'ModelCatalogError';
        this.detail = detail;
    }
}
function rpcId() {
    const source = globalThis.crypto;
    return typeof source?.randomUUID === 'function' ? source.randomUUID() : 'rpc-' + Math.random().toString(36).slice(2);
}
function endpointOf(explicit) {
    if (explicit)
        return explicit;
    const base = globalThis.document?.baseURI;
    if (!base)
        throw new ModelCatalogError('catalog-unavailable', 'The model catalog needs a browser document or an explicit endpoint');
    return new URL('api', base);
}
function detailOf(error) {
    if (typeof error === 'string')
        return error;
    const value = error;
    return typeof value?.message === 'string' ? value.message : '';
}
function normalize(value) {
    const source = value;
    if (!source || !Array.isArray(source.groups))
        throw new ModelCatalogError('catalog-shape', 'The model catalog answer carries no provider groups');
    const groups = [];
    for (const raw of source.groups) {
        const group = raw;
        if (!group || typeof group.id !== 'string' || !group.id)
            continue;
        const models = Array.isArray(group.models) ? group.models : [];
        groups.push({
            id: group.id,
            ...(typeof group.name === 'string' && group.name ? { name: group.name } : {}),
            models: models.filter((model) => {
                const candidate = model;
                return !!candidate && typeof candidate.id === 'string' && !!candidate.id;
            }),
        });
    }
    return { groups, failures: Array.isArray(source.failures) ? source.failures : [] };
}
export async function fetchModelCatalog(request = {}) {
    let envelope;
    try {
        const response = await fetch(endpointOf(request.endpoint), {
            method: 'POST', credentials: 'same-origin', signal: request.signal,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ type: 'client-request', rpcId: rpcId(), method: 'llm.models', payload: {} }),
        });
        envelope = await response.json();
    }
    catch (error) {
        if (error instanceof ModelCatalogError)
            throw error;
        throw new ModelCatalogError('catalog-unreachable', detailOf(error) || 'The model catalog request failed before an answer arrived');
    }
    const data = envelope;
    if (!data || data.type !== 'server-response' || !data.result || typeof data.result !== 'object')
        throw new ModelCatalogError('catalog-protocol', 'The host answered the model catalog with an unexpected envelope');
    const result = data.result;
    if (result.ok !== true)
        throw new ModelCatalogError('catalog-refused', detailOf(result.error) || 'The model catalog request was rejected');
    return normalize(result.value);
}
/** Text-capable models; modalities that the catalog does not declare stay selectable. */
export function acceptsText(model) {
    return !Array.isArray(model.inputModalities) || model.inputModalities.includes('text');
}
/** Image+text models keep the strict rule whenever the catalog declares modalities. */
export function acceptsVision(model) {
    return !Array.isArray(model.inputModalities) || model.inputModalities.includes('image') && model.inputModalities.includes('text');
}
/** Flatten provider groups into workbench route rows in the established label shape. */
export function catalogRoutes(groups, accept) {
    const routes = [];
    for (const group of groups) {
        for (const model of group.models) {
            if (!accept(model))
                continue;
            routes.push({ provider: group.id, model: model.id, label: (group.name || group.id) + ' / ' + (model.name || model.id) });
        }
    }
    return routes;
}
