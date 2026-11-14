import { ownerListing } from './model-listing.js';
class VisualCallError extends Error {
}
async function abortable(work, signal) {
    signal.throwIfAborted();
    let stop;
    const aborted = new Promise((_, reject) => { stop = () => reject(new Error('视觉模型调用已停止 / Visual model call stopped')); signal.addEventListener('abort', stop, { once: true }); });
    try {
        return await Promise.race([work, aborted]);
    }
    finally {
        signal.removeEventListener('abort', stop);
    }
}
export function nativeVisualModel(llm, attachments) {
    return {
        async routes(signal, owner) {
            const active = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(15_000)]);
            const listing = ownerListing(llm, owner);
            // Owner-scoped listing: the personal provider plane arrives whole; no cap on providers.
            const groups = await Promise.all((listing ? listing.providers() : llm.listProviders()).map(async (provider) => {
                try {
                    const models = await abortable(listing ? listing.models(provider.id) : llm.listModels(provider.id), active);
                    return models.slice(0, 100).filter(m => m.inputModalities?.includes('image') && m.inputModalities?.includes('text'))
                        .map(m => ({ provider: provider.id, model: m.id, label: (provider.name || provider.id) + ' / ' + (m.name || m.id) }));
                }
                catch {
                    active.throwIfAborted();
                    return [];
                }
            }));
            return groups.flat();
        },
        async inspect(route, system, input, images, signal, owner) {
            if (!images.length || images.length > 2 || images.some(i => i.data.byteLength > 4 * 1024 * 1024))
                throw new Error('每次视觉检查需 1–2 张、每张不超过 4 MiB / Image request limit');
            const listing = ownerListing(llm, owner);
            if (!(listing ? listing.providers() : llm.listProviders()).some((p) => p.id === route.provider))
                throw new Error('模型服务已停用 / Model provider is unavailable');
            // Owner web logins stream on their own provider plane and key; prepareCall
            // cannot resolve personal routes, so that path streams directly and keeps
            // provider misses loud instead of falling back to the shared plane.
            const personal = !!owner && typeof llm.streamForOwner === 'function';
            const active = AbortSignal.any([signal, AbortSignal.timeout(120_000)]);
            let stream;
            const attach = async () => {
                const refs = await abortable(attachments.saveImages(images.map(i => ({ data: i.data, mediaType: 'image/png', name: i.name }))), active);
                if (!Array.isArray(refs) || refs.length !== images.length)
                    throw new VisualCallError('图片存储未完成 / Image admission failed');
                return refs;
            };
            const message = (refs) => [{ role: 'user', content: [{ type: 'text', text: input }, ...refs.map(attachment => ({ type: 'image', attachment }))] }];
            try {
                let reasoningEffort;
                if (typeof llm.resolveModelInfo === 'function') {
                    try {
                        const info = await abortable(llm.resolveModelInfo(route.provider, route.model, active), active);
                        if (info?.reasoning?.efforts?.some((v) => v.id === 'off'))
                            reasoningEffort = 'off';
                    }
                    catch {
                        active.throwIfAborted(); /* Personal routes can lack reasoning facts; that must not fail the call. */
                    }
                }
                const config = { ...route, maxTokens: 6000, ...(reasoningEffort ? { reasoningEffort: 'off' } : {}) };
                if (personal) {
                    const refs = await attach();
                    active.throwIfAborted();
                    stream = llm.streamForOwner(owner, { ...config, system, tools: [], signal: active, owner, messages: message(refs) })[Symbol.asyncIterator]();
                }
                else {
                    const prepared = await abortable(llm.prepareCall(config, active), active);
                    if (!prepared.inputModalities?.includes('image') || !prepared.inputModalities?.includes('text'))
                        throw new VisualCallError('所选模型不能读取图片，请选择视觉模型 / Choose a model with image input');
                    const refs = await attach();
                    active.throwIfAborted();
                    stream = prepared.stream({ ...prepared.config, system, tools: [], signal: active, messages: message(refs) })[Symbol.asyncIterator]();
                }
                const blocks = new Map();
                let complete = false;
                for (;;) {
                    const part = await abortable(stream.next(), active);
                    if (part.done)
                        break;
                    const chunk = part.value;
                    if (chunk.type === 'tool-call-delta' || chunk.type === 'block-end' && chunk.block?.type === 'tool-call')
                        throw new VisualCallError('视觉检查不允许工具调用 / Unexpected tool call');
                    if (chunk.type === 'text-delta')
                        blocks.set(chunk.index, (blocks.get(chunk.index) || '') + String(chunk.text || ''));
                    if (chunk.type === 'block-end' && chunk.block?.type === 'text')
                        blocks.set(chunk.index, String(chunk.block.text || ''));
                    if ([...blocks.values()].reduce((n, t) => n + t.length, 0) > 30_000)
                        throw new VisualCallError('视觉结果过长 / Visual output limit');
                    if (chunk.type === 'finish') {
                        if (chunk.reason?.kind === 'max-tokens')
                            throw new VisualCallError('视觉模型达到输出上限，未采纳截断结果；请缩小检查范围或选择更快的模型 / Vision output limit reached; truncated results were not adopted. Review fewer slides or choose a faster model');
                        if (chunk.reason?.failure?.code === 'AUTH')
                            throw new VisualCallError('视觉模型认证失败，请检查 DSH 中的凭据 / Vision model authentication failed; check the DSH credential');
                        if (chunk.reason?.failure?.code === 'RATE_LIMIT')
                            throw new VisualCallError('视觉模型服务限流，未自动重试 / Vision model rate limited; no automatic retry');
                        if (chunk.reason?.kind !== 'stop')
                            throw new VisualCallError('视觉模型未完整返回结果，未自动重试；请检查模型服务 / Vision model did not complete; no automatic retry. Check the model service');
                        complete = true;
                        break;
                    }
                }
                const output = [...blocks].sort(([a], [b]) => a - b).map(([, t]) => t).join('');
                if (!complete || !output.trim())
                    throw new VisualCallError('未收到完整视觉结果 / No complete visual result');
                return output;
            }
            catch (error) {
                if (active.aborted)
                    throw new VisualCallError('视觉模型调用已停止 / Visual model call stopped');
                if (error instanceof VisualCallError)
                    throw error;
                // Provider error bodies can echo credentials or request payloads. Keep
                // only stable failure categories in UI and persistent review records.
                const code = error?.failure?.code || error?.code;
                if (code === 'AUTH')
                    throw new VisualCallError('视觉模型认证失败，请检查 DSH 中的凭据 / Vision model authentication failed; check the DSH credential');
                if (code === 'RATE_LIMIT')
                    throw new VisualCallError('视觉模型服务限流，未自动重试 / Vision model rate limited; no automatic retry');
                // Personal-route misses are stable harness categories with a harness-authored
                // message; show that detail instead of the generic fallback.
                if (code === 'NO_ADAPTER' || code === 'MISSING_CREDENTIAL')
                    throw new VisualCallError(String(error?.message || code));
                throw new VisualCallError('视觉模型请求失败，请检查模型、凭据与图片输入配置；未自动重试 / Vision model request failed; check model, credential and image input settings; no automatic retry');
            }
            finally {
                if (stream?.return)
                    void Promise.resolve(stream.return()).catch(() => { });
            }
        },
    };
}
