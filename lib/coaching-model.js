/** Bounded, tool-free calls through the official DSH llm service. */
import { ownerListing } from './model-listing.js';
async function bounded(work, signal) {
    signal.throwIfAborted();
    let stop;
    const cancelled = new Promise((_, reject) => { stop = () => reject(new Error('模型请求已停止 / Model request stopped')); signal.addEventListener('abort', stop, { once: true }); });
    try {
        return await Promise.race([work, cancelled]);
    }
    finally {
        signal.removeEventListener('abort', stop);
    }
}
export function nativeCoachingModel(llm) {
    return {
        async routes(signal, owner) {
            const result = [];
            const active = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(15_000)]);
            const listing = ownerListing(llm, owner);
            // Owner-scoped listing: the personal provider plane arrives whole; no cap on providers.
            const groups = await Promise.all((listing ? listing.providers() : llm.listProviders()).map(async (provider) => {
                active.throwIfAborted();
                try {
                    const models = await bounded(listing ? listing.models(provider.id) : llm.listModels(provider.id), active);
                    const group = [];
                    for (const model of models.slice(0, 100)) {
                        if (model.inputModalities && !model.inputModalities.includes('text'))
                            continue;
                        group.push({ provider: provider.id, model: model.id, label: (provider.name || provider.id) + ' / ' + (model.name || model.id) });
                    }
                    return group;
                }
                catch {
                    active.throwIfAborted();
                    return []; /* Other configured providers remain usable. */
                }
            }));
            for (const group of groups)
                result.push(...group);
            return result;
        },
        async generate(route, system, input, signal, owner) {
            const listing = ownerListing(llm, owner);
            if (!(listing ? listing.providers() : llm.listProviders()).some((p) => p.id === route.provider))
                throw new Error('所选模型服务已停用，请重新选择 / Model provider is unavailable');
            const active = AbortSignal.any([signal, AbortSignal.timeout(120_000)]);
            let rejectAbort;
            const aborted = new Promise((_, reject) => { rejectAbort = reject; });
            const onAbort = () => rejectAbort(new Error('模型调用已停止 / Model call stopped'));
            active.addEventListener('abort', onAbort, { once: true });
            let stream;
            try {
                active.throwIfAborted();
                let reasoningEffort;
                if (typeof llm.resolveModelInfo === 'function') {
                    try {
                        const info = await Promise.race([llm.resolveModelInfo(route.provider, route.model, active), aborted]);
                        if (info?.reasoning?.efforts?.some((value) => value.id === 'off'))
                            reasoningEffort = 'off';
                    }
                    catch {
                        active.throwIfAborted(); /* Personal routes can lack reasoning facts; that must not fail the call. */
                    }
                }
                const options = { ...route, system, tools: [], maxTokens: 6000, signal: active,
                    ...(reasoningEffort ? { reasoningEffort } : {}),
                    messages: [{ role: 'user', content: [{ type: 'text', text: input }] }] };
                // Owner web logins generate on their own provider plane and key; errors
                // (NO_ADAPTER / MISSING_CREDENTIAL) surface as-is, never a silent host-key
                // fallback. Without the seam the shared server stream stays, as before.
                stream = (owner && typeof llm.streamForOwner === 'function'
                    ? llm.streamForOwner(owner, { ...options, owner })
                    : llm.stream(options))[Symbol.asyncIterator]();
                const blocks = new Map();
                let stopped = false;
                for (;;) {
                    const part = await Promise.race([stream.next(), aborted]);
                    if (part.done)
                        break;
                    const chunk = part.value;
                    if (chunk.type === 'tool-call-delta' || chunk.type === 'block-end' && chunk.block?.type === 'tool-call')
                        throw new Error('模型尝试调用工具 / Unexpected tool call');
                    if (chunk.type === 'text-delta')
                        blocks.set(chunk.index, (blocks.get(chunk.index) || '') + String(chunk.text || ''));
                    if (chunk.type === 'block-end' && chunk.block?.type === 'text')
                        blocks.set(chunk.index, String(chunk.block.text || ''));
                    if ([...blocks.values()].reduce((sum, text) => sum + text.length, 0) > 30_000)
                        throw new Error('模型输出过长 / Model output limit');
                    if (chunk.type === 'finish') {
                        if (chunk.reason?.kind !== 'stop')
                            throw new Error('模型输出未完整结束 / Incomplete model output');
                        stopped = true;
                        break;
                    }
                }
                const output = [...blocks].sort(([a], [b]) => a - b).map(([, text]) => text).join('');
                if (!stopped || !output.trim())
                    throw new Error('模型未返回完整文本 / No complete model response');
                return output;
            }
            finally {
                active.removeEventListener('abort', onAbort);
                if (stream?.return)
                    void Promise.resolve(stream.return()).catch(() => { });
            }
        },
    };
}
