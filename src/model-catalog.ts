/**
 * Browser RPC to the host model catalog: the same `llm.models` call the DSH
 * Models page and the prompt selector use. The host resolves the caller's
 * personal provider plane from the session cookie, so no owner value travels
 * through plugin code here. The workbench server listing
 * (`coach-options` / `visual-options`) stays for compatibility; the cascade
 * UI reads this catalog and surfaces failures instead of swallowing them.
 */
export interface CatalogModel { id: string; name?: string; inputModalities?: string[] }
export interface CatalogGroup { id: string; name?: string; models: CatalogModel[] }
export interface ModelCatalog { groups: CatalogGroup[]; failures: unknown[] }
export interface RouteOption { provider: string; model: string; label: string }
export interface CatalogRequest { endpoint?: URL | string; signal?: AbortSignal }

/** Catalog problems are loud: the cascade shows the message plus a retry. */
export class ModelCatalogError extends Error {
  readonly detail: string
  constructor(message: string, detail = '') {
    super(message)
    this.name = 'ModelCatalogError'
    this.detail = detail
  }
}

function rpcId(): string {
  const source = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  return typeof source?.randomUUID === 'function' ? source.randomUUID() : 'rpc-' + Math.random().toString(36).slice(2)
}

function endpointOf(explicit?: URL | string): URL | string {
  if (explicit) return explicit
  const base = (globalThis as { document?: { baseURI?: string } }).document?.baseURI
  if (!base) throw new ModelCatalogError('catalog-unavailable', 'The model catalog needs a browser document or an explicit endpoint')
  return new URL('api', base)
}

function detailOf(error: unknown): string {
  if (typeof error === 'string') return error
  const value = error as { message?: unknown } | null
  return typeof value?.message === 'string' ? value.message : ''
}

function normalize(value: unknown): ModelCatalog {
  const source = value as { groups?: unknown; failures?: unknown } | null
  if (!source || !Array.isArray(source.groups)) throw new ModelCatalogError('catalog-shape', 'The model catalog answer carries no provider groups')
  const groups: CatalogGroup[] = []
  for (const raw of source.groups) {
    const group = raw as { id?: unknown; name?: unknown; models?: unknown } | null
    if (!group || typeof group.id !== 'string' || !group.id) continue
    const models = Array.isArray(group.models) ? group.models : []
    groups.push({
      id: group.id,
      ...(typeof group.name === 'string' && group.name ? { name: group.name } : {}),
      models: models.filter((model): model is CatalogModel => {
        const candidate = model as { id?: unknown } | null
        return !!candidate && typeof candidate.id === 'string' && !!candidate.id
      }),
    })
  }
  return { groups, failures: Array.isArray(source.failures) ? source.failures : [] }
}

export async function fetchModelCatalog(request: CatalogRequest = {}): Promise<ModelCatalog> {
  let envelope: unknown
  try {
    const response = await fetch(endpointOf(request.endpoint), {
      method: 'POST', credentials: 'same-origin', signal: request.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId: rpcId(), method: 'llm.models', payload: {} }),
    })
    envelope = await response.json()
  } catch (error) {
    if (error instanceof ModelCatalogError) throw error
    throw new ModelCatalogError('catalog-unreachable', detailOf(error) || 'The model catalog request failed before an answer arrived')
  }
  const data = envelope as { type?: unknown; result?: unknown } | null
  if (!data || data.type !== 'server-response' || !data.result || typeof data.result !== 'object')
    throw new ModelCatalogError('catalog-protocol', 'The host answered the model catalog with an unexpected envelope')
  const result = data.result as { ok?: unknown; value?: unknown; error?: unknown }
  if (result.ok !== true) throw new ModelCatalogError('catalog-refused', detailOf(result.error) || 'The model catalog request was rejected')
  return normalize(result.value)
}

/** Text-capable models; modalities that the catalog does not declare stay selectable. */
export function acceptsText(model: CatalogModel): boolean {
  return !Array.isArray(model.inputModalities) || model.inputModalities.includes('text')
}

/** Image+text models keep the strict rule whenever the catalog declares modalities. */
export function acceptsVision(model: CatalogModel): boolean {
  return !Array.isArray(model.inputModalities) || model.inputModalities.includes('image') && model.inputModalities.includes('text')
}

/** Flatten provider groups into workbench route rows in the established label shape. */
export function catalogRoutes(groups: CatalogGroup[], accept: (model: CatalogModel) => boolean): RouteOption[] {
  const routes: RouteOption[] = []
  for (const group of groups) {
    for (const model of group.models) {
      if (!accept(model)) continue
      routes.push({ provider: group.id, model: model.id, label: (group.name || group.id) + ' / ' + (model.name || model.id) })
    }
  }
  return routes
}
