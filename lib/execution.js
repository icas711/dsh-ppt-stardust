import { resolve } from 'node:path';
import { resolveToolIdentity } from './identity.js';
let enginePromise = null;
export function getEngine() {
    if (enginePromise === null) {
        const engineUrl = new URL('../skills/dsh-ppt/scripts/deck-advanced.mjs', import.meta.url);
        enginePromise = import(engineUrl.href).then((module) => module)
            .catch((error) => {
            enginePromise = null;
            throw error;
        });
    }
    return enginePromise;
}
function asRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
/** Admins may pass scope: 'public'; everyone else lands in their own space. */
function publicScope(args, identity) {
    return args.scope === 'public' ? 'public' : 'user';
}
function assetInput(value) {
    if (value === undefined || value === null)
        return undefined;
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('dsh-ppt：assets 需为对象（имя → путь / data URI / base64）');
    return value;
}
let templatesModulePromise = null;
/** Shared template implementation from the skill scripts. */
export function loadTemplatesModule() {
    if (templatesModulePromise === null) {
        const url = new URL('../skills/dsh-ppt/scripts/deck-templates.mjs', import.meta.url);
        templatesModulePromise = import(url.href).then(module => module)
            .catch(error => { templatesModulePromise = null; throw error; });
    }
    return templatesModulePromise;
}
/** Build executors with a shared engine loader; resolve paths separately for each call. */
export function createPptExecutors(config, loadEngine = getEngine, options = {}) {
    const identityOf = (exec) => resolveToolIdentity(exec, { admins: config.admins, webAuth: options.webAuth });
    return {
        async themes(rawArgs, exec) {
            exec?.signal?.throwIfAborted();
            const args = asRecord(rawArgs);
            const lang = typeof args.lang === 'string' && args.lang.trim() !== '' ? args.lang.trim() : 'zh';
            const engine = await loadEngine();
            exec?.signal?.throwIfAborted();
            const themes = engine.listThemes(lang);
            if (args.preview === true) {
                const cwd = exec?.agent?.session.header.cwd ?? process.cwd();
                const requested = typeof args.outputDir === 'string' && args.outputDir.trim() !== '' ? args.outputDir.trim() : config.outputDir || '.';
                const preview = engine.buildThemePreview({
                    outputDir: resolve(cwd, requested),
                    lang,
                    overwrite: args.overwrite === true,
                });
                return { ok: true, themes, preview };
            }
            return { ok: true, themes };
        },
        async create(rawArgs, exec) {
            exec?.signal?.throwIfAborted();
            const args = asRecord(rawArgs);
            if (typeof args.title !== 'string' || args.title.trim() === '')
                throw new Error('dsh-ppt：title 不能为空');
            const hasContent = typeof args.content === 'string' && args.content.trim() !== '';
            const hasSlides = Array.isArray(args.slides) && args.slides.length > 0;
            if (!hasContent && !hasSlides && !args.template && !args.templateId)
                throw new Error('dsh-ppt：content 不能为空（或用 slides / template / templateId 传结构化幻灯片）');
            const engine = await loadEngine();
            // Check cancellation after loading and before artifact commit inside the async engine.
            exec?.signal?.throwIfAborted();
            const cwd = exec?.agent?.session.header.cwd ?? process.cwd();
            const outputDir = typeof args.outputDir === 'string' && args.outputDir.trim() !== '' ? args.outputDir.trim() : config.outputDir;
            // Library template: style + outline skeleton (+ optional samples) under the given title.
            let templateApply = {};
            if (typeof args.templateId === 'string' && args.templateId.trim() !== '') {
                const store = options.templateStore;
                if (!store)
                    throw new Error('dsh-ppt：библиотека шаблонов недоступна в этой установке; используйте файл шаблона через CLI');
                const { create, lineage } = await store.createOptions(args.templateId.trim(), identityOf(exec), {
                    title: args.title.trim(),
                    includeSamples: args.templateSamples !== false,
                    lang: typeof args.lang === 'string' && args.lang.trim() !== '' ? args.lang.trim() : (config.defaultLang || 'zh'),
                });
                templateApply = {
                    slides: create.slides,
                    theme: create.theme,
                    brand: create.brand,
                    style: create.style,
                    templateLineage: lineage,
                };
            }
            const explicitSlides = hasSlides ? args.slides : undefined;
            const explicitContent = hasContent ? (typeof args.content === 'string' ? args.content : '') : '';
            return (engine.buildDeckAsync ?? engine.buildDeck)({
                title: args.title.trim(),
                content: explicitContent,
                // Шаблонные страницы (каркас + образцы) приоритетнее пользовательских slides
                slides: templateApply.slides ?? explicitSlides,
                theme: templateApply.theme ?? (typeof args.theme === 'string' && args.theme.trim() !== '' ? args.theme.trim() : (config.defaultTheme || undefined)),
                lang: typeof args.lang === 'string' && args.lang.trim() !== '' ? args.lang.trim() : (config.defaultLang || undefined),
                motion: args.motion,
                outputDir: resolve(cwd, outputDir || '.'),
                fileName: typeof args.fileName === 'string' && args.fileName.trim() !== '' ? args.fileName.trim() : undefined,
                overwrite: args.overwrite === true,
                internalProject: true,
                maxSlides: config.maxSlides,
                template: args.template,
                brand: templateApply.brand ?? args.brand,
                style: templateApply.style,
                templateLineage: templateApply.templateLineage,
                dataModel: args.dataModel,
                cwd,
                signal: exec?.signal,
            });
        },
        async templates(rawArgs, exec) {
            exec?.signal?.throwIfAborted();
            const args = asRecord(rawArgs);
            const engine = await loadEngine();
            exec?.signal?.throwIfAborted();
            return { ok: true, templates: engine.listTemplates(typeof args.lang === 'string' ? args.lang : config.defaultLang || 'zh') };
        },
        /** ppt_template: библиотека шаблонов — список, импорт/экспорт, создание из pptx/проекта, редизайн. */
        async template(rawArgs, exec) {
            exec?.signal?.throwIfAborted();
            const args = asRecord(rawArgs);
            const engine = await loadEngine();
            const mod = await loadTemplatesModule();
            exec?.signal?.throwIfAborted();
            const cwd = exec?.agent?.session.header.cwd ?? process.cwd();
            const identity = identityOf(exec);
            const store = options.templateStore;
            const lang = typeof args.lang === 'string' && args.lang.trim() !== '' ? args.lang.trim() : (config.defaultLang || 'zh');
            const needStore = () => {
                if (!store)
                    throw new Error('dsh-ppt：библиотека шаблонов недоступна в этой установке; используйте файлы шаблонов через CLI');
                return store;
            };
            const key = typeof args.templateId === 'string' ? args.templateId.trim() : '';
            const summarize = (record) => ({ ...mod.summarizeTemplate(record.manifest), key: record.key, readonly: record.readonly });
            switch (args.operation) {
                case 'list': {
                    const list = store ? await store.list(identity) : [];
                    const scenarios = engine.listTemplates(lang);
                    return { ok: true, templates: list, scenarios };
                }
                case 'get': {
                    if (!key)
                        throw new Error('dsh-ppt：нужен templateId');
                    const record = await needStore().get(key, identity);
                    return { ok: true, template: summarize(record), manifest: record.manifest };
                }
                case 'create-from-pptx': {
                    const pptxPath = typeof args.pptxPath === 'string' ? args.pptxPath.trim() : '';
                    if (!pptxPath)
                        throw new Error('dsh-ppt：нужен pptxPath');
                    const extracted = await mod.templateFromPptx(resolve(cwd, pptxPath), {
                        templateId: typeof args.newTemplateId === 'string' ? args.newTemplateId.trim() : '',
                        name: typeof args.name === 'string' ? args.name.trim() : '',
                        description: typeof args.description === 'string' ? args.description : undefined,
                        lang,
                    });
                    const saved = await needStore().save({ manifest: extracted.manifest, assets: extracted.assets, scope: publicScope(args, identity), identity });
                    return { ok: true, key: saved.key, template: summarize(saved), report: extracted.report };
                }
                case 'create-from-project': {
                    const deckPath = typeof args.deckPath === 'string' ? args.deckPath.trim() : '';
                    if (!deckPath)
                        throw new Error('dsh-ppt：нужен deckPath');
                    const { manifest } = engine.readDeckProject({ deckPath: resolve(cwd, deckPath), cwd, signal: exec?.signal });
                    const extracted = mod.templateFromDeckManifest(manifest, {
                        templateId: typeof args.newTemplateId === 'string' ? args.newTemplateId.trim() : '',
                        name: typeof args.name === 'string' ? args.name.trim() : '',
                        description: typeof args.description === 'string' ? args.description : undefined,
                        author: identity.login ?? 'local',
                        includeSamples: args.samples !== false,
                        lang: typeof manifest.language === 'string' ? manifest.language : lang,
                    });
                    const saved = await needStore().save({ manifest: extracted.manifest, assets: extracted.assets, scope: publicScope(args, identity), identity });
                    return { ok: true, key: saved.key, template: summarize(saved) };
                }
                case 'save': {
                    const manifest = args.manifest;
                    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest))
                        throw new Error('dsh-ppt：нужен manifest шаблона');
                    const saved = await needStore().save({ manifest: manifest, assets: assetInput(args.assets), scope: publicScope(args, identity), identity });
                    return { ok: true, key: saved.key, template: summarize(saved) };
                }
                case 'delete': {
                    if (!key)
                        throw new Error('dsh-ppt：нужен templateId');
                    await needStore().delete(key, identity);
                    return { ok: true, deleted: key };
                }
                case 'export': {
                    if (!key)
                        throw new Error('dsh-ppt：нужен templateId');
                    const outDir = typeof args.outputDir === 'string' && args.outputDir.trim() !== '' ? args.outputDir.trim() : '.';
                    const written = await needStore().export(key, resolve(cwd, outDir), identity);
                    return { ok: true, path: written.path, bytes: written.bytes };
                }
                case 'import': {
                    const path = typeof args.path === 'string' ? args.path.trim() : '';
                    const data = typeof args.data === 'string' ? args.data : '';
                    if (!path && !data)
                        throw new Error('dsh-ppt：нужен path к файлу шаблона или data (base64 zip/json)');
                    const bytes = data ? Buffer.from(data, 'base64') : undefined;
                    const saved = await needStore().import({ source: path ? resolve(cwd, path) : undefined, bytes, scope: publicScope(args, identity), identity });
                    return { ok: true, key: saved.key, template: summarize(saved) };
                }
                case 'publish': {
                    if (!key)
                        throw new Error('dsh-ppt：нужен templateId');
                    const owner = typeof args.owner === 'string' && args.owner.trim() !== '' ? args.owner.trim() : undefined;
                    const saved = await needStore().publish({ key, identity, owner });
                    return { ok: true, key: saved.key, template: summarize(saved) };
                }
                case 'apply-to-project': {
                    const deckPath = typeof args.deckPath === 'string' ? args.deckPath.trim() : '';
                    if (!deckPath)
                        throw new Error('dsh-ppt：нужен deckPath');
                    if (!key && typeof args.bundlePath !== 'string')
                        throw new Error('dsh-ppt：нужен templateId или bundlePath');
                    let restyle, lineage;
                    if (key) {
                        ;
                        ({ restyle, lineage } = await needStore().restyleOptions(key, identity));
                    }
                    else {
                        const bundle = mod.readTemplateBundle(resolve(cwd, String(args.bundlePath)));
                        ({ restyle, lineage } = mod.templateRestyleOptions(bundle.manifest, bundle.assets));
                    }
                    const result = await engine.editDeck({
                        deckPath: resolve(cwd, deckPath), cwd, signal: exec?.signal,
                        expectedRevision: args.expectedRevision,
                        saveAs: args.saveAs === true,
                        theme: restyle.theme,
                        brand: restyle.brand,
                        style: restyle.style,
                        templateLineage: lineage,
                    });
                    return { ok: true, template: lineage, changed: result.changed, revision: result.revision, files: result.files };
                }
                default:
                    throw new Error('dsh-ppt：неизвестная операция ppt_template; доступно: list/get/create-from-pptx/create-from-project/save/delete/export/import/publish/apply-to-project');
            }
        },
        async edit(rawArgs, exec) {
            exec?.signal?.throwIfAborted();
            const engine = await loadEngine();
            exec?.signal?.throwIfAborted();
            return engine.editDeck({ ...asRecord(rawArgs), cwd: exec?.agent?.session.header.cwd ?? process.cwd(), signal: exec?.signal });
        },
        async undo(rawArgs, exec) {
            exec?.signal?.throwIfAborted();
            const engine = await loadEngine();
            exec?.signal?.throwIfAborted();
            return engine.undoDeck({ ...asRecord(rawArgs), cwd: exec?.agent?.session.header.cwd ?? process.cwd(), signal: exec?.signal });
        },
        async check(rawArgs, exec) {
            exec?.signal?.throwIfAborted();
            const engine = await loadEngine();
            exec?.signal?.throwIfAborted();
            return (engine.checkDeckAsync ?? engine.checkDeck)({ ...asRecord(rawArgs), cwd: exec?.agent?.session.header.cwd ?? process.cwd(), signal: exec?.signal });
        },
        async render(rawArgs, exec) {
            exec?.signal?.throwIfAborted();
            const engine = await loadEngine();
            exec?.signal?.throwIfAborted();
            return engine.renderDeck({ ...asRecord(rawArgs), outputDir: undefined, cwd: exec?.agent?.session.header.cwd ?? process.cwd(), signal: exec?.signal });
        },
        async data(rawArgs, exec) {
            exec?.signal?.throwIfAborted();
            const engine = await loadEngine(), args = asRecord(rawArgs);
            const options = { ...args, cwd: exec?.agent?.session.header.cwd ?? process.cwd(), signal: exec?.signal, allowFiles: true };
            if (args.action === 'preview')
                return engine.previewDeckData(options);
            if (args.action === 'apply')
                return engine.updateDeckData(options);
            throw new Error('dsh-ppt：action 需为 preview 或 apply / Use preview or apply');
        },
    };
}
