/** Operator-only workbench. Paths come from successful tools, never browser input. */
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { getEngine } from './execution.js';
import { bilingualQuality, englishWorkbenchMessage } from './workbench-language.js';
import { zipSync, strToU8 } from 'fflate';
import { PptCoaching } from './coaching.js';
import { PptVisual } from './visual.js';
import { workbenchIdentity } from './web-owner.js';
import { loadTemplatesModule } from './execution.js';
export const PPT_WORKBENCH_ROUTE = '/api/dsh-ppt/workbench';
export const PPT_DOWNLOAD_ROUTE = '/api/dsh-ppt/download';
export const PPT_TEMPLATE_UPLOAD_ROUTE = '/api/dsh-ppt/template-upload';
const PPTX_UPLOAD_LIMIT = 64 * 1024 * 1024;
const REQUEST_LIMIT = 12 * 1024 * 1024;
const FILE_LIMIT = 64 * 1024 * 1024;
const BUNDLE_LIMIT = 128 * 1024 * 1024;
/** Sharing keeps the offline deck, but omits the control for a project not in the ZIP. */
function shareHtml(bytes) {
    const html = bytes.toString('utf8'), marker = '<a id="download-project"';
    const start = html.indexOf(marker);
    if (start < 0)
        return bytes;
    const end = html.indexOf('</a>', start + marker.length);
    if (end < 0 || end - start > 4096 || html.indexOf(marker, end + 4) >= 0)
        throw new Error('HTML 工程下载入口异常，请保存副本后重试');
    return strToU8(html.slice(0, start) + html.slice(end + 4));
}
const digest = (value) => createHash('sha256').update(value).digest('hex');
function ordinaryFile(path) {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > FILE_LIMIT)
        throw new Error('文件不是普通文件或超过 64 MiB');
    return readFileSync(path);
}
function pathsFor(path) { const base = path.slice(0, -5); return { json: path, html: base + '.html', pptx: base + '.pptx' }; }
function speakerNotes(manifest) {
    const label = (zh, en, ru) => manifest.language === 'en' ? en : manifest.language === 'ru' ? (ru ?? en) : manifest.language === 'bilingual' ? zh + ' / ' + en : zh;
    const heading = (value) => String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
    const sections = manifest.slides.map((slide, index) => {
        const title = heading(slide.title) || label('第 ' + (index + 1) + ' 页', 'Slide ' + (index + 1), 'Слайд ' + (index + 1));
        const notes = typeof slide.notes === 'string' && slide.notes.trim() ? slide.notes : label('（本页未填写演讲备注。）', '(No speaker notes for this slide.)', '(На этом слайде нет заметок докладчика.)');
        return '## ' + (index + 1) + '. ' + title + '\n\n' + notes;
    });
    return '# ' + heading(manifest.title) + '\n\n' + sections.join('\n\n---\n\n') + '\n';
}
function json(status, value) {
    return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
function requireTemplateKey(key) {
    if (!key)
        throw new Error('Не выбран шаблон');
    return key;
}
function fail(status, message) {
    const display = /[\u3400-\u9fff]/.test(message) && message.includes(' / ') ? message.slice(0, message.indexOf(' / ')) : message;
    return json(status, { ok: false, message: display, messageEn: englishWorkbenchMessage(message) });
}
function originVerdict(request) {
    const site = request.headers.get('sec-fetch-site'), origin = request.headers.get('origin');
    if (site && !['same-origin', 'none'].includes(site))
        return fail(403, '拒绝跨站操作');
    if (origin && /^https?:/i.test(origin)) {
        try {
            if (new URL(origin).host !== (request.headers.get('host') || new URL(request.url).host))
                return fail(403, '拒绝跨源操作');
        }
        catch {
            return fail(403, '无效来源');
        }
    }
}
export class PptWorkbench {
    catalogPath;
    coaching;
    visual;
    loadEngine;
    renders = new Map();
    templates;
    constructor(options = {}) {
        this.catalogPath = options.catalogPath ?? join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'plugins', 'dsh-ppt', 'projects.jsonl');
        this.loadEngine = options.loadEngine ?? getEngine;
        this.coaching = new PptCoaching(join(dirname(this.catalogPath), 'rehearsals'), options.coachingModel);
        this.visual = new PptVisual(join(dirname(this.catalogPath), 'visual-reviews'), options.visualModel);
    }
    /** Attach the template library (index.ts); identity comes from the auth cookie. */
    attachTemplateStore(store) { this.templates = store; }
    templatesModule() { return loadTemplatesModule(); }
    needTemplates() {
        if (!this.templates)
            throw new Error('Библиотека шаблонов недоступна в этой установке');
        return this.templates;
    }
    catalog() {
        if (!existsSync(this.catalogPath))
            return [];
        if (lstatSync(this.catalogPath).size > 8 * 1024 * 1024)
            throw new Error('项目索引超过 8 MiB，请备份后整理 projects.jsonl');
        const rows = new Map();
        for (const line of readFileSync(this.catalogPath, 'utf8').split('\n')) {
            try {
                const row = JSON.parse(line);
                if (typeof row.path === 'string' && row.path.endsWith('.json') && row.id === digest(row.path) && typeof row.title === 'string' && typeof row.updatedAt === 'string') {
                    rows.delete(row.id);
                    rows.set(row.id, row);
                }
            }
            catch { /* A crash may leave an incomplete last append; keep older rows. */ }
        }
        return [...rows.values()].reverse().slice(0, 100);
    }
    /** Recording a completed tool never turns a successful generation into an error. */
    async remember(result, args, exec) {
        const file = result?.jsonPath ?? result?.deckPath;
        if (typeof file !== 'string')
            return;
        exec?.signal?.throwIfAborted();
        const path = realpathSync(resolve(exec?.agent?.session.header.cwd ?? process.cwd(), file));
        ordinaryFile(path);
        const engine = await this.loadEngine();
        const { manifest } = engine.readDeckProject({ deckPath: path });
        // Versioned generator projects only; arbitrary JSON and externally edited PPTX cannot enter.
        if (manifest.schemaVersion !== 1 || typeof manifest.deckId !== 'string' || manifest.slides.some((s) => typeof s.id !== 'string'))
            return;
        let route = exec?.agent?.session.requestContext?.();
        if (!route?.provider || !route?.model)
            route = exec?.agent?.session.requestHeader?.()?.config;
        const modelRoute = typeof route?.provider === 'string' && typeof route?.model === 'string' ? { provider: route.provider, model: route.model } : this.catalog().find(p => p.path === path)?.modelRoute;
        const row = { id: digest(path), path, title: manifest.title, updatedAt: new Date().toISOString(), ...(modelRoute ? { modelRoute } : {}) };
        mkdirSync(dirname(this.catalogPath), { recursive: true });
        if (existsSync(this.catalogPath) && lstatSync(this.catalogPath).size >= 8 * 1024 * 1024)
            throw new Error('项目索引已满，请备份后整理 projects.jsonl');
        appendFileSync(this.catalogPath, JSON.stringify(row) + '\n');
    }
    async project(id) {
        if (typeof id !== 'string' || !/^[0-9a-f]{64}$/.test(id))
            throw new Error('请选择已有项目');
        const entry = this.catalog().find(row => row.id === id);
        if (!entry)
            throw new Error('项目不在本机索引中，请先在对话中创建或检查演示文稿');
        if (realpathSync(entry.path) !== entry.path)
            throw new Error('项目位置已改变，请在对话中重新检查');
        ordinaryFile(entry.path);
        const engine = await this.loadEngine();
        const { manifest } = engine.readDeckProject({ deckPath: entry.path });
        return { entry, engine, manifest, files: pathsFor(entry.path) };
    }
    async view(id) {
        const { entry, engine, manifest, files } = await this.project(id);
        const check = bilingualQuality(engine.checkDeck({ deckPath: entry.path }));
        let html = '';
        try {
            html = ordinaryFile(files.html).toString('utf8');
        }
        catch { /* A check can register an older JSON-only project. */ }
        const render = this.renders.get(entry.id);
        const currentRender = render && render.revision === manifest.revision && digest(ordinaryFile(files.pptx)) === render.sourceSha256 ? render : undefined;
        return { ok: true, project: { ...entry, deckId: manifest.deckId, revision: manifest.revision, slides: manifest.slides,
                undoAvailable: manifest.history.length, quality: check, html, dataModel: manifest.dataModel ?? null,
                assets: Object.fromEntries(Object.entries(manifest.assets ?? {}).map(([key, value]) => [key, { data: value.data, mime: value.mime }])),
                render: currentRender ? { pageCount: currentRender.pngPaths.length, missingFonts: currentRender.missingFonts ?? [] } : null } };
    }
    revision(body, manifest) {
        if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision !== manifest.revision)
            throw new Error('项目已被修改，请重新打开后再编辑；当前输入保留');
    }
    patch(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value))
            throw new Error('修改内容无效');
        const result = {};
        for (const [key, item] of Object.entries(value)) {
            if (['title', 'subtitle', 'kicker', 'text', 'notes'].includes(key)) {
                if (typeof item !== 'string' || item.length > 8000)
                    throw new Error('文字字段过长或无效');
            }
            else if (key === 'bullets') {
                if (!Array.isArray(item) || item.length > 50 || item.some(v => typeof v !== 'string' || v.length > 2000))
                    throw new Error('要点内容无效');
            }
            else if (key === 'image') {
                if (!item || typeof item !== 'object' || Array.isArray(item))
                    throw new Error('请选择 PNG 或 JPEG 图片');
                const image = item;
                if (Object.keys(image).some(k => !['src', 'alt', 'fit', 'caption'].includes(k)) || typeof image.src !== 'string' || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(image.src))
                    throw new Error('图片必须从面板上传，不能读取其他本地文件');
                if (['alt', 'caption'].some(k => image[k] !== undefined && (typeof image[k] !== 'string' || image[k].length > 2000)) || (image.fit !== undefined && !['contain', 'cover'].includes(String(image.fit))))
                    throw new Error('图片说明或适应方式无效');
            }
            else
                throw new Error('面板不支持修改此字段：' + key);
            result[key] = item;
        }
        return result;
    }
    async action(body, signal, identity = { admin: false, local: true }) {
        signal?.throwIfAborted();
        if (body.operation === 'list')
            return { ok: true, projects: this.catalog() };
        // ---- Template library (identity from the auth cookie; admin flag authoritative) ----
        if (String(body.operation).startsWith('template-')) {
            const store = this.needTemplates();
            const key = typeof body.templateId === 'string' ? body.templateId.trim() : '';
            switch (body.operation) {
                case 'template-list': {
                    const engine = await this.loadEngine();
                    return { ok: true, templates: await store.list(identity), admin: identity.admin, themes: engine.listThemes(typeof body.lang === 'string' ? body.lang : 'ru') };
                }
                case 'template-get': {
                    const record = await store.get(requireTemplateKey(key), identity);
                    const access = store.access(record, identity);
                    return {
                        ok: true,
                        template: {
                            ...record.manifest, key: record.key, readonly: record.readonly, ...access,
                            assets: Object.keys(record.assets),
                            assetData: Object.fromEntries(Object.entries(record.assets).map(([name, asset]) => [name, asset.data])),
                        },
                    };
                }
                case 'template-import': {
                    const data = typeof body.data === 'string' ? body.data : '';
                    if (!data)
                        throw new Error('Загрузите файл шаблона (.zip или template.json)');
                    const saved = await store.import({ bytes: Buffer.from(data, 'base64'), scope: body.scope === 'public' ? 'public' : 'user', identity });
                    return { ok: true, key: saved.key, template: saved.manifest };
                }
                case 'template-save': {
                    if (!body.manifest || typeof body.manifest !== 'object' || Array.isArray(body.manifest))
                        throw new Error('Нужен манифест шаблона');
                    const saved = await store.saveDraft({
                        manifest: body.manifest,
                        uploads: body.uploads && typeof body.uploads === 'object' && !Array.isArray(body.uploads) ? body.uploads : undefined,
                        baseKey: typeof body.baseKey === 'string' && body.baseKey ? body.baseKey : undefined,
                        scope: body.scope === 'public' ? 'public' : 'user',
                        expectedRevision: Number.isInteger(body.expectedRevision) ? Number(body.expectedRevision) : undefined,
                        identity,
                    });
                    return { ok: true, key: saved.key, template: saved.manifest };
                }
                case 'template-create-from-project': {
                    // The project comes from the catalog by id; the browser never supplies a file path.
                    const { manifest } = await this.project(body.id);
                    const mod = await this.templatesModule();
                    const extracted = mod.templateFromDeckManifest(manifest, {
                        templateId: String(body.newTemplateId ?? '').trim(),
                        name: String(body.name ?? '').trim(),
                        author: identity.login ?? 'local',
                        includeSamples: body.samples !== false,
                        lang: typeof manifest.language === 'string' ? manifest.language : body.lang,
                    });
                    const saved = await store.save({ manifest: extracted.manifest, assets: extracted.assets, scope: body.scope === 'public' ? 'public' : 'user', identity });
                    return { ok: true, key: saved.key, template: saved.manifest };
                }
                case 'template-duplicate': {
                    const saved = await store.duplicate({ key: requireTemplateKey(key), newId: String(body.newTemplateId ?? '').trim(), name: String(body.name ?? '').trim(), identity });
                    return { ok: true, key: saved.key, template: saved.manifest };
                }
                case 'template-preview': {
                    if (!body.manifest || typeof body.manifest !== 'object' || Array.isArray(body.manifest))
                        throw new Error('Нужен манифест шаблона');
                    const engine = await this.loadEngine();
                    if (!engine.previewDeckHtml)
                        throw new Error('Предпросмотр шаблона недоступен: обновите движок dsh-ppt');
                    const options = await store.previewOptions({
                        manifest: body.manifest,
                        uploads: body.uploads && typeof body.uploads === 'object' && !Array.isArray(body.uploads) ? body.uploads : undefined,
                        baseKey: typeof body.baseKey === 'string' && body.baseKey ? body.baseKey : undefined,
                        lang: typeof body.lang === 'string' ? body.lang : 'ru',
                        identity,
                    });
                    return engine.previewDeckHtml(options);
                }
                case 'template-delete':
                    return await store.delete(requireTemplateKey(key), identity);
                case 'template-publish': {
                    const saved = await store.publish({ key: requireTemplateKey(key), identity });
                    return { ok: true, key: saved.key, template: saved.manifest };
                }
                case 'template-restyle': {
                    const { entry, manifest, engine } = await this.project(body.id ?? body.deckPath);
                    const options = await store.restyleOptions(requireTemplateKey(key), identity);
                    const result = await engine.editDeck({
                        deckPath: entry.path, cwd: dirname(entry.path), signal,
                        expectedRevision: body.expectedRevision,
                        saveAs: body.saveAs === true,
                        theme: options.restyle.theme,
                        brand: options.restyle.brand,
                        style: options.restyle.style,
                        templateLineage: options.lineage,
                    });
                    await this.remember(result, {}, undefined);
                    return { ...await this.view(entry.id), restyle: { template: options.lineage, changed: result.changed, revision: result.revision, title: manifest.title } };
                }
                case 'template-apply': {
                    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : '';
                    if (!title)
                        throw new Error('Укажите название новой презентации');
                    const engine = await this.loadEngine();
                    const options = await store.createOptions(requireTemplateKey(key), identity, { title });
                    const outputDir = join(dirname(this.catalogPath), 'created');
                    const created = await engine.buildDeckAsync({
                        ...options.create, title, outputDir, lang: body.lang, overwrite: false, signal,
                        templateLineage: options.lineage,
                    });
                    await this.remember(created, {}, undefined);
                    return { ...await this.view(digest(created.jsonPath)), createdFrom: options.lineage };
                }
                default:
                    throw new Error('Неизвестная операция шаблонов');
            }
        }
        if (body.operation === 'open')
            return this.view(body.id);
        const { entry, engine, manifest, files } = await this.project(body.id);
        signal?.throwIfAborted();
        const context = { id: entry.id, manifest, ...(manifest.dataModel ? { dataNotes: Object.fromEntries(manifest.slides.map((s) => [s.id, engine.dataNotes(manifest, s)])) } : {}) };
        const visualContext = { id: entry.id, path: entry.path, manifest, engine };
        if (body.operation === 'visual-options')
            return { ok: true, ...await this.visual.options(signal, identity.login) };
        if (body.operation === 'visual-list')
            return { ok: true, runs: this.visual.list(visualContext) };
        if (body.operation === 'visual-get')
            return { ok: true, run: this.visual.get(visualContext, body.runId) };
        if (body.operation === 'visual-stop')
            return { ok: true, run: this.visual.stop(visualContext, body.runId) };
        if (body.operation === 'visual-delete')
            return { ok: true, ...this.visual.remove(visualContext, body.runId) };
        if (body.operation === 'visual-page')
            return this.visual.page(visualContext, body.runId, body.round, body.slideId);
        if (body.operation === 'coach-options')
            return { ok: true, ...await this.coaching.options(signal, identity.login) };
        if (body.operation === 'coach-list')
            return { ok: true, runs: this.coaching.list(context) };
        if (body.operation === 'coach-get')
            return { ok: true, run: this.coaching.get(context, body.runId) };
        if (body.operation === 'coach-stop')
            return { ok: true, run: this.coaching.stop(context, body.runId) };
        if (body.operation === 'coach-finish')
            return { ok: true, run: this.coaching.finish(context, body.runId) };
        if (body.operation === 'coach-delete')
            return { ok: true, ...this.coaching.remove(context, body.runId) };
        if (body.operation === 'download') {
            if (!['html', 'pptx', 'json'].includes(String(body.kind)))
                throw new Error('不支持此文件类型');
            const path = files[body.kind];
            return { ok: true, name: basename(path), data: ordinaryFile(path).toString('base64') };
        }
        if (body.operation === 'page') {
            const render = this.renders.get(entry.id);
            if (!render || render.revision !== manifest.revision || digest(ordinaryFile(files.pptx)) !== render.sourceSha256)
                throw new Error('请先渲染当前版本的 PPTX');
            if (!Number.isSafeInteger(body.page) || Number(body.page) < 1 || Number(body.page) > render.pngPaths.length)
                throw new Error('页码无效');
            const bytes = ordinaryFile(render.pngPaths[Number(body.page) - 1]);
            if (digest(bytes) !== render.pngHashes[Number(body.page) - 1])
                throw new Error('渲染图片已变化，请重新渲染当前 PPTX');
            return { ok: true, data: 'data:image/png;base64,' + bytes.toString('base64') };
        }
        this.revision(body, manifest);
        if (body.operation === 'visual-create')
            return { ok: true, run: await this.visual.create(visualContext, body, signal, identity.login) };
        if (body.operation === 'visual-step')
            return { ok: true, run: await this.visual.step(visualContext, body.runId, body, signal, identity.login) };
        if (body.operation === 'visual-adopt') {
            if (body.confirmed !== true)
                throw new Error('请确认采用修复副本 / Confirm adopting the repaired copy');
            const { path, render } = this.visual.adoption(visualContext, body.runId);
            await this.remember({ jsonPath: path }, {}, undefined);
            const copy = await this.project(digest(path));
            this.renders.set(copy.entry.id, { revision: copy.manifest.revision, sourceSha256: render.sourceSha256, pngPaths: render.pngPaths, pngHashes: render.pngPaths.map(p => digest(ordinaryFile(p))), missingFonts: render.missingFonts });
            return { ...await this.view(digest(path)), originalId: entry.id };
        }
        if (body.operation === 'data-preview' || body.operation === 'data-apply') {
            // Always force file reads off, including nested source updates and scenario packets.
            const args = { deckPath: entry.path, expectedRevision: body.expectedRevision, parameters: body.parameters, sourceUpdates: body.sourceUpdates,
                scenario: body.scenario, previewToken: body.previewToken, confirmed: body.confirmed, saveAs: body.saveAs !== false, allowFiles: false, signal };
            if (body.operation === 'data-preview')
                return engine.previewDeckData(args);
            const result = await engine.updateDeckData(args);
            await this.remember(result, args);
            return { ...await this.view(digest(result.jsonPath)), originalId: entry.id };
        }
        if (body.operation === 'coach-create')
            return { ok: true, run: await this.coaching.create(context, body, signal, identity.login) };
        if (body.operation === 'coach-step') {
            await this.coaching.step(context, body.runId, body, signal, identity.login);
            const current = await this.project(entry.id);
            return { ok: true, run: this.coaching.get({ id: entry.id, manifest: current.manifest }, body.runId) };
        }
        if (body.operation === 'coach-apply') {
            if (body.confirmed !== true)
                throw new Error('请确认采纳所选建议 / Confirm selected suggestions');
            const { edits, append } = this.coaching.application(context, body.runId, body.selected, body.backup);
            const args = { deckPath: entry.path, expectedRevision: manifest.revision, signal, saveAs: true, preserveUndo: true,
                ...(edits.length ? { edits } : {}), ...(append.length ? { append } : {}) };
            const result = await engine.editDeck(args);
            await this.remember(result, args);
            return { ...await this.view(digest(result.jsonPath)), originalId: entry.id };
        }
        if (body.operation === 'render') {
            const result = await engine.renderDeck({ pptxPath: files.pptx, format: 'png', signal });
            if (result.ok)
                this.renders.set(entry.id, { revision: manifest.revision, pngPaths: result.pngPaths ?? [], pngHashes: (result.pngPaths ?? []).map(path => digest(ordinaryFile(path))), missingFonts: result.missingFonts, sourceSha256: result.sourceSha256 });
            const view = await this.view(entry.id);
            if (result.ok && !view.project.render)
                throw new Error('项目已被修改，请重新渲染');
            return { ...result, ...(result.ok ? {} : {
                    messageEn: englishWorkbenchMessage(result.message || 'PPTX rendering failed.'),
                    installationHintEn: 'Optional renderer: @deepseek-ai/libreoffice-kit@0.2.3 (bundled by DSH 0.2.2+), or 0.1.5. Install it in this DSH profile and restart DSH.',
                }), project: view.project };
        }
        if (body.operation === 'edit') {
            if (body.slide !== undefined && (typeof body.slide !== 'string' || !manifest.slides.some((s) => s.id === body.slide)))
                throw new Error('页面不存在');
            const args = { deckPath: entry.path, expectedRevision: body.expectedRevision, signal,
                saveAs: body.saveAs === true,
                ...(body.slide === undefined ? {} : { edits: [{ slide: body.slide, patch: this.patch(body.patch) }] }),
                ...(body.order === undefined ? {} : { order: body.order }) };
            const result = await engine.editDeck(args);
            await this.remember(result, args);
            return { ...await this.view(digest(result.jsonPath)), changed: result.changed };
        }
        if (body.operation === 'duplicate' || body.operation === 'remove') {
            if (typeof body.slide !== 'string' || !manifest.slides.some((s) => s.id === body.slide))
                throw new Error('页面不存在');
            const args = { deckPath: entry.path, expectedRevision: body.expectedRevision, signal, [body.operation]: [body.slide] };
            const result = await engine.editDeck(args);
            await this.remember(result, args);
            const view = await this.view(entry.id);
            const originalIndex = manifest.slides.findIndex((s) => s.id === body.slide);
            const selected = view.project.slides[Math.min(originalIndex + (body.operation === 'duplicate' ? 1 : 0), view.project.slides.length - 1)].id;
            return { ...view, selected };
        }
        if (body.operation === 'undo') {
            await engine.undoDeck({ deckPath: entry.path, expectedRevision: body.expectedRevision, signal });
            return this.view(entry.id);
        }
        throw new Error('不支持此操作');
    }
    async fetchDownload(request, identity = { admin: false, local: true }) {
        if (request.method !== 'GET')
            return fail(405, '请使用 GET');
        const denied = originVerdict(request);
        if (denied)
            return denied;
        try {
            const params = new URL(request.url).searchParams, kind = params.get('kind');
            if (kind === 'template') {
                // Template bundle download: visible templates only; store enforces scope.
                const record = await this.needTemplates().get(requireTemplateKey(String(params.get('id') ?? '')), identity);
                const mod = await this.templatesModule();
                const bytes = mod.buildTemplateBundle(record.manifest, record.assets);
                return new Response(new Uint8Array(bytes), { headers: {
                        'content-type': 'application/zip', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
                        'content-disposition': `attachment; filename="${record.manifest.id}-template-v${record.manifest.revision}.zip"; filename*=UTF-8''${encodeURIComponent(record.manifest.id + '-template-v' + record.manifest.revision + '.zip')}`,
                    } });
            }
            if (!['html', 'pptx', 'json', 'bundle', 'share', 'notes', 'coaching', 'data', 'visual'].includes(String(kind)))
                return fail(400, '不支持此文件类型');
            const { entry, manifest, files, engine } = await this.project(params.get('id'));
            if (String(manifest.revision) !== params.get('revision'))
                return fail(409, '项目已被修改，请重新打开后下载');
            request.signal.throwIfAborted();
            let name, bytes;
            if (kind === 'visual') {
                bytes = strToU8(this.visual.markdown({ id: entry.id, path: entry.path, manifest, engine }, params.get('run')));
                name = basename(entry.path, '.json') + '-visual-review.md';
            }
            else if (kind === 'data') {
                bytes = strToU8(engine.dataReport(manifest));
                name = basename(entry.path, '.json') + '-data-lineage.md';
            }
            else if (kind === 'coaching') {
                bytes = strToU8(this.coaching.markdown({ id: entry.id, manifest }, params.get('run')));
                name = basename(entry.path, '.json') + '-rehearsal.md';
            }
            else if (kind === 'notes') {
                bytes = strToU8(speakerNotes({ ...manifest, slides: manifest.slides.map((slide) => ({ ...slide, notes: engine.dataNotes(manifest, slide) })) }));
                name = basename(entry.path, '.json') + '-speaker-notes.md';
            }
            else if (kind === 'bundle' || kind === 'share') {
                const entries = {};
                let total = 0;
                const selected = kind === 'share' ? [files.html, files.pptx] : Object.values(files);
                const add = (name, content) => { total += content.byteLength; if (total > BUNDLE_LIMIT)
                    return false; entries[name] = content; return true; };
                for (const path of selected) {
                    if (!existsSync(path))
                        return fail(400, '成品文件不完整，请先保存一次再下载成品包');
                    const content = ordinaryFile(path), exported = kind === 'share' && path === files.html ? shareHtml(content) : content;
                    if (!add(basename(path), exported))
                        return fail(413, '成品包超过 128 MiB，请分别下载文件');
                }
                // An allowlist of registered sibling files; never walk project directories.
                if (kind === 'share') {
                    const notes = speakerNotes({ ...manifest, slides: manifest.slides.map((slide) => ({ ...slide, notes: engine.dataNotes(manifest, slide) })) });
                    if (!add(basename(entry.path, '.json') + '-speaker-notes.md', strToU8(notes)))
                        return fail(413, '成品包超过 128 MiB，请分别下载文件');
                }
                const details = kind === 'share'
                    ? '演示文稿分享包 / Presentation share bundle\n\nPPTX: 在 PowerPoint / WPS 中打开。 / Open in PowerPoint or WPS.\nHTML: 解压后用浏览器离线放映。 / Extract and open in a browser for offline playback.\nMarkdown: 当前修订的逐页讲稿。 / Speaker notes for this revision.\n\n此包不含 JSON 工程或完整导入材料。HTML、PPTX 备注和讲稿保留已绑定的来源摘录及用户填写内容。\nThe project JSON and complete imported materials are not included. HTML, PPTX notes and speaker notes retain bound source excerpts and authored content.\n'
                    : '演示文稿工程包 / Presentation project bundle\n\nPPTX: 在 PowerPoint / WPS 中编辑。 / Edit in PowerPoint or WPS.\nHTML: 解压后用浏览器打开，支持离线放映。 / Extract and open in a browser for offline playback.\nJSON: 保留以便继续在 DSH 中编辑；其中可能包含完整导入材料。 / Keep for future DSH edits; this project may contain complete imported materials.\n';
                if (!add('README.txt', strToU8(details + '\n修订 / Revision: ' + manifest.revision + '\n')))
                    return fail(413, '成品包超过 128 MiB，请分别下载文件');
                // PPTX and embedded images are already compressed; store to avoid a large
                // synchronous recompression on the host's event loop.
                bytes = zipSync(entries, { level: 0 });
                name = basename(entry.path, '.json') + (kind === 'share' ? '-share.zip' : '-delivery.zip');
            }
            else {
                const path = files[kind];
                bytes = ordinaryFile(path);
                name = basename(path);
            }
            request.signal.throwIfAborted();
            if ((await this.project(entry.id)).manifest.revision !== manifest.revision)
                return fail(409, '项目已被修改，请重新打开后下载');
            const archive = kind === 'bundle' || kind === 'share';
            const type = ['notes', 'coaching', 'data', 'visual'].includes(String(kind)) ? 'text/markdown; charset=utf-8' : archive ? 'application/zip' : kind === 'pptx' ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' : kind === 'html' ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8';
            return new Response(new Uint8Array(bytes), { headers: {
                    'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
                    'content-disposition': `attachment; filename="presentation.${archive ? 'zip' : ['notes', 'coaching', 'data', 'visual'].includes(String(kind)) ? 'md' : kind}"; filename*=UTF-8''${encodeURIComponent(name)}`,
                } });
        }
        catch (error) {
            return fail(400, error instanceof Error ? error.message : String(error));
        }
    }
    /** Загрузка PPTX с диска пользователя: сырое тело (не base64), параметры в query. Результат — шаблон + отчёт импорта. */
    async fetchTemplateUpload(request, identity = { admin: false, local: true }) {
        if (request.method !== 'POST')
            return fail(405, 'Используйте POST');
        if (request.headers.get('x-dsh-ppt-action') !== '1')
            return fail(403, 'Действие доступно только из панели презентаций');
        const denied = originVerdict(request);
        if (denied)
            return denied;
        try {
            const declared = Number(request.headers.get('content-length') ?? 0);
            if (declared > PPTX_UPLOAD_LIMIT)
                return fail(413, 'PPTX больше 64 МиБ');
            const reader = request.body?.getReader();
            if (!reader)
                return fail(400, 'Файл не передан');
            let size = 0;
            const chunks = [];
            try {
                for (;;) {
                    const { value, done } = await reader.read();
                    if (done)
                        break;
                    size += value.byteLength;
                    if (size > PPTX_UPLOAD_LIMIT) {
                        await reader.cancel();
                        return fail(413, 'PPTX больше 64 МиБ');
                    }
                    chunks.push(value);
                }
            }
            finally {
                reader.releaseLock();
            }
            const bytes = Buffer.concat(chunks);
            if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b)
                return fail(400, 'Это не файл PPTX (ожидается ZIP-контейнер Office)');
            const query = new URL(request.url).searchParams;
            const store = this.needTemplates();
            const mod = await this.templatesModule();
            const extracted = await mod.templateFromPptx(bytes, {
                templateId: String(query.get('templateId') ?? '').trim(),
                name: String(query.get('name') ?? '').trim(),
                description: query.get('description') ?? undefined,
                lang: query.get('lang') ?? 'ru',
                author: identity.login ?? 'local',
            });
            request.signal.throwIfAborted();
            const saved = await store.save({ manifest: extracted.manifest, assets: extracted.assets, scope: query.get('scope') === 'public' ? 'public' : 'user', identity });
            return json(200, { ok: true, key: saved.key, template: saved.manifest, report: extracted.report });
        }
        catch (error) {
            return fail(400, error instanceof Error ? error.message : String(error));
        }
    }
    async fetch(request, identity = { admin: false, local: true }) {
        if (request.method !== 'POST')
            return fail(405, '请使用 POST');
        if (request.headers.get('x-dsh-ppt-action') !== '1' || request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json')
            return fail(403, '请从演示文稿面板操作');
        const denied = originVerdict(request);
        if (denied)
            return denied;
        try {
            const reader = request.body?.getReader();
            if (!reader)
                return fail(400, '缺少请求内容');
            let size = 0;
            const chunks = [];
            try {
                for (;;) {
                    const { value, done } = await reader.read();
                    if (done)
                        break;
                    size += value.byteLength;
                    if (size > REQUEST_LIMIT) {
                        await reader.cancel();
                        return fail(413, '图片或请求超过 12 MiB，请压缩后重试');
                    }
                    chunks.push(value);
                }
            }
            finally {
                reader.releaseLock();
            }
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            if (!body || typeof body !== 'object' || Array.isArray(body))
                return fail(400, '请求必须是对象');
            return json(200, await this.action(body, request.signal, identity));
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return fail(/修订号冲突|已被修改|工程已被修改|正在被另一次|其他操作修改/.test(message) ? 409 : 400, message);
        }
    }
}
export function installPptWorkbench(ctx, workbench) {
    ctx.inject?.(['connection'], (host) => {
        host.connection?.fetch?.register({ path: PPT_WORKBENCH_ROUTE, methods: ['POST'], requestBody: 'buffered', fetch: (request) => workbench.fetch(request, workbenchIdentity(ctx, request)) });
        host.connection?.fetch?.register({ path: PPT_TEMPLATE_UPLOAD_ROUTE, methods: ['POST'], requestBody: 'buffered', fetch: (request) => workbench.fetchTemplateUpload(request, workbenchIdentity(ctx, request)) });
        host.connection?.fetch?.register({ path: PPT_DOWNLOAD_ROUTE, methods: ['GET'], requestBody: 'buffered', fetch: (request) => workbench.fetchDownload(request, workbenchIdentity(ctx, request)) });
    });
}
