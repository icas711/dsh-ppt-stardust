/**
 * Template library storage on the DSH host.
 *
 * Layout (next to projects.jsonl, rehearsals/ and visual-reviews/):
 *   templates/public/<id>/template.json + assets/*
 *   templates/users/<login>/<id>/template.json + assets/*
 * Built-in templates ship inside the plugin package (assets/templates) and are
 * listed read-only.
 *
 * Keys: `builtin:<id>`, `public:<id>`, `user:<id>` — a `user:` key always
 * resolves against the calling user's own directory; users never see or touch
 * other users' private templates. All methods are async: the shared template
 * implementation lives in the skill scripts and loads lazily.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { PptFontLibrary, fontKey, templateFontFamilies } from './font-library.js';
const SCOPE_PUBLIC = 'public';
const SCOPE_USER = 'user';
const SCOPE_BUILTIN = 'builtin';
function ordinaryDir(path) {
    try {
        return statSync(path).isDirectory();
    }
    catch {
        return false;
    }
}
export class PptTemplateStore {
    root;
    builtinDir;
    loader;
    admins;
    cache = new Map();
    fontLibrary;
    fontQueue = Promise.resolve();
    constructor(options) {
        this.root = resolve(options.root);
        this.builtinDir = options.builtinDir ? resolve(options.builtinDir) : undefined;
        this.loader = options.templatesModuleLoader;
        this.admins = options.admins;
        this.fontLibrary = new PptFontLibrary(join(this.root, 'font-library'));
    }
    mod() { return this.loader(); }
    /** A template keeps its own portable copy; library lookup only fills missing faces. */
    async withLibraryFonts(manifest, assets, identity, replace) {
        const m = await this.mod(), result = structuredClone(manifest), merged = { ...assets };
        const families = templateFontFamilies(result), faces = [...(result.style?.fonts ?? [])];
        let added = 0;
        const library = replace ?? (identity.login ? this.fontLibrary.list(identity) : []);
        for (const entry of library) {
            if (!families.has(entry.family.toLowerCase()))
                continue;
            const index = faces.findIndex(face => fontKey(face) === fontKey(entry));
            if (!replace && index >= 0 && merged[faces[index].file])
                continue;
            const face = { family: entry.family, variant: entry.variant, file: entry.file };
            if (index >= 0)
                faces[index] = face;
            else
                faces.push(face);
            Object.assign(merged, m.normalizeTemplateAssets({ [entry.file]: entry.data }));
            added++;
        }
        if (added)
            result.style = { ...result.style, fonts: faces };
        const wanted = referencedAssets(result);
        return { manifest: result, assets: Object.fromEntries(Object.entries(merged).filter(([name]) => wanted.has(name))), added };
    }
    /** Validate every affected template before replacing any stored copy. Uploads are serialized. */
    uploadFont(input, identity) {
        const work = this.fontQueue.then(async () => {
            const font = this.fontLibrary.prepare(input, identity), m = await this.mod();
            const plans = [];
            for (const scope of [SCOPE_USER, SCOPE_PUBLIC]) {
                for (const id of this.scopeIds(scope, identity)) {
                    const record = await this.load(`${scope}:${id}`, identity);
                    if (scope === SCOPE_PUBLIC && record.manifest.author !== identity.login)
                        continue;
                    const bound = await this.withLibraryFonts(record.manifest, record.assets, identity, [font]);
                    if (!bound.added)
                        continue;
                    const assets = m.normalizeTemplateAssets(bound.assets);
                    m.validateTemplateManifest(bound.manifest, { templateAssets: assets });
                    plans.push({ record, ...bound, assets, scope });
                }
            }
            // Library ownership authorizes updating the owner's public templates as well as private copies.
            const updated = [];
            for (const plan of plans) {
                const saved = await this.save({ manifest: plan.manifest, assets: plan.assets, scope: plan.scope,
                    expectedRevision: plan.record.manifest.revision, identity: { ...identity, admin: true } });
                updated.push({ key: saved.key, previousRevision: plan.record.manifest.revision, revision: saved.manifest.revision });
            }
            this.fontLibrary.put(font);
            return { font, updated };
        });
        this.fontQueue = work.catch(() => { });
        return work;
    }
    async deleteLibraryFont(owner, id, identity) {
        const work = this.fontQueue.then(() => this.fontLibrary.delete(owner, id, identity));
        this.fontQueue = work.catch(() => { });
        return work;
    }
    isAdmin(identity) { return identity?.admin === true; }
    usersRoot() { return join(this.root, 'users'); }
    publicRoot() { return join(this.root, SCOPE_PUBLIC); }
    userDir(login) { return join(this.usersRoot(), sanitizeLogin(login)); }
    dirOf(scope, id, identity) {
        if (scope === SCOPE_BUILTIN) {
            if (!this.builtinDir)
                throw new Error('dsh-ppt：встроенные шаблоны недоступны');
            return join(this.builtinDir, id);
        }
        if (scope === SCOPE_PUBLIC)
            return join(this.publicRoot(), id);
        if (scope === SCOPE_USER) {
            if (!identity?.login)
                throw new Error('dsh-ppt：личные шаблоны доступны только вошедшим пользователям');
            return join(this.userDir(identity.login), id);
        }
        throw new Error(`dsh-ppt：неизвестный scope шаблона：${scope}`);
    }
    builtinIds() {
        if (!this.builtinDir || !ordinaryDir(this.builtinDir))
            return [];
        return readdirSync(this.builtinDir).filter(name => {
            if (!/^[a-z0-9][a-z0-9-]{1,48}$/.test(name))
                return false;
            return existsSync(join(this.builtinDir, name, 'template.json'));
        });
    }
    scopeIds(scope, identity) {
        if (scope === SCOPE_BUILTIN)
            return this.builtinIds();
        const dir = scope === SCOPE_PUBLIC ? this.publicRoot() : identity?.login ? this.userDir(identity.login) : undefined;
        if (!dir || !ordinaryDir(dir))
            return [];
        return readdirSync(dir).filter(name => /^[a-z0-9][a-z0-9-]{1,48}$/.test(name) && existsSync(join(dir, name, 'template.json')));
    }
    async load(key, identity) {
        const cached = this.cache.get(cacheKey(key, identity?.login));
        if (cached)
            return cached;
        const promise = (async () => {
            const m = await this.mod();
            const [scope, id] = parseKey(key);
            const dir = this.dirOf(scope, id, identity);
            if (scope !== SCOPE_BUILTIN && !ordinaryDir(dir))
                throw new Error(`dsh-ppt：шаблон не найден：${key}`);
            const { manifest, assets } = await m.readTemplateDir(dir);
            if (manifest.id !== id)
                throw new Error(`dsh-ppt：манифест шаблона не совпадает с каталогом：${key}`);
            return { manifest, assets, key: `${scope}:${id}`, dir, readonly: scope === SCOPE_BUILTIN };
        })();
        promise.catch(() => this.cache.delete(cacheKey(key, identity?.login)));
        this.cache.set(cacheKey(key, identity?.login), promise);
        return promise;
    }
    /** List templates visible to the caller: builtin + public + own. */
    async list(identity) {
        const m = await this.mod();
        const items = [];
        const builtinIds = new Set(this.builtinIds());
        const publicIds = new Set(this.scopeIds(SCOPE_PUBLIC, identity));
        for (const scope of [SCOPE_BUILTIN, SCOPE_PUBLIC, SCOPE_USER]) {
            for (const id of this.scopeIds(scope, identity)) {
                // A public copy with the same id overrides the built-in one: only the override is listed.
                if (scope === SCOPE_BUILTIN && publicIds.has(id))
                    continue;
                try {
                    const record = await this.load(`${scope}:${id}`, identity);
                    items.push({
                        ...m.summarizeTemplate(record.manifest), scope, key: `${scope}:${id}`, readonly: record.readonly,
                        ...(scope === SCOPE_PUBLIC && builtinIds.has(id) ? { overridesBuiltin: true } : {}),
                    });
                }
                catch { /* A broken template must not break the whole list. */ }
            }
        }
        return items;
    }
    /** Resolve a template with assets for apply/restyle. */
    async get(key, identity) {
        const [scope, id] = parseKey(key);
        if (scope === SCOPE_USER && identity?.login === undefined)
            throw new Error('dsh-ppt：личные шаблоны доступны только вошедшим пользователям');
        // An admin's public copy overrides the built-in template of the same id everywhere (list, apply, restyle).
        if (scope === SCOPE_BUILTIN && ordinaryDir(this.dirOf(SCOPE_PUBLIC, id, identity)))
            return this.load(`${SCOPE_PUBLIC}:${id}`, identity);
        return this.load(key, identity);
    }
    /** What the caller may do with a template and where an edit is stored. */
    access(record, identity) {
        const [scope, id] = parseKey(record.key);
        if (scope === SCOPE_USER)
            return { canEdit: identity?.login !== undefined, saveScope: 'user', overridesBuiltin: false };
        const overrides = scope === SCOPE_BUILTIN || (scope === SCOPE_PUBLIC && this.builtinIds().includes(id));
        return { canEdit: this.isAdmin(identity), saveScope: 'public', overridesBuiltin: overrides };
    }
    /** Create or update a template in the caller's own space (or public for admins). */
    async save(input) {
        const m = await this.mod();
        const identity = input.identity;
        const scope = input.scope ?? SCOPE_USER;
        if (scope === SCOPE_PUBLIC && !this.isAdmin(identity))
            throw new Error('dsh-ppt：публиковать шаблоны в общие может только администратор');
        if (scope !== SCOPE_PUBLIC && scope !== SCOPE_USER)
            throw new Error('dsh-ppt：save поддерживает scope user / public');
        if (scope === SCOPE_USER && identity?.login === undefined)
            throw new Error('dsh-ppt：локальные сессии сохраняют шаблоны только файлами (CLI), без личной библиотеки');
        const assets = m.normalizeTemplateAssets(input.assets ?? {});
        const manifest = m.validateTemplateManifest(input.manifest, { templateAssets: assets });
        const dir = this.dirOf(scope, manifest.id, identity);
        if (existsSync(dir) && !ordinaryDir(dir))
            throw new Error(`dsh-ppt：путь занят не-каталогом：${dir}`);
        mkdirSync(dir, { recursive: true });
        // Overwrite means bumping the revision; keep createdAt stable, drop stale assets.
        if (existsSync(join(dir, 'template.json'))) {
            const previous = JSON.parse(readFileSync(join(dir, 'template.json'), 'utf8'));
            if (input.expectedRevision !== undefined && Number(previous.revision) !== input.expectedRevision) {
                throw new Error(`dsh-ppt：шаблон уже изменён (ревизия ${previous.revision}); откройте его заново и повторите правку`);
            }
            manifest.createdAt = typeof previous.createdAt === 'string' ? previous.createdAt : manifest.createdAt;
            manifest.revision = Math.max(manifest.revision, (Number(previous.revision) || 0) + 1);
            const stale = join(dir, 'assets');
            if (ordinaryDir(stale))
                rmSync(stale, { recursive: true, force: true });
        }
        else if (scope === SCOPE_PUBLIC && this.builtinIds().includes(manifest.id)) {
            // First save over a built-in template: the override continues its revision history.
            try {
                const builtin = JSON.parse(readFileSync(join(this.builtinDir, manifest.id, 'template.json'), 'utf8'));
                manifest.revision = Math.max(manifest.revision, (Number(builtin.revision) || 0) + 1);
            }
            catch { /* The built-in manifest is validated on load; fall through with the given revision. */ }
        }
        manifest.updatedAt = new Date().toISOString();
        m.writeTemplateDir(dir, manifest, assets);
        this.cache.delete(cacheKey(`${scope}:${manifest.id}`, identity?.login));
        return this.load(`${scope}:${manifest.id}`, identity);
    }
    /** Assets named by the manifest: unchanged ones come from the stored base template, new ones from uploads. */
    async draftAssets(manifest, uploads, base) {
        const m = await this.mod();
        const uploaded = m.normalizeTemplateAssets(uploads ?? {});
        const merged = { ...(base?.assets ?? {}), ...uploaded };
        const wanted = referencedAssets(manifest);
        return Object.fromEntries(Object.entries(merged).filter(([name]) => wanted.has(name)));
    }
    /** Save an editor draft: the manifest plus only the assets that are new or changed. */
    async saveDraft(input) {
        const base = input.baseKey ? await this.get(input.baseKey, input.identity) : undefined;
        const assets = await this.draftAssets(input.manifest, input.uploads, base);
        const manifest = { ...input.manifest };
        if (!manifest.author && input.identity?.login)
            manifest.author = input.identity.login;
        const bound = await this.withLibraryFonts(manifest, assets, input.identity);
        return this.save({ manifest: bound.manifest, assets: bound.assets, scope: input.scope, expectedRevision: input.expectedRevision, identity: input.identity });
    }
    /** Copy any visible template into the caller's own library under a new id. */
    async duplicate(input) {
        const identity = input.identity;
        if (identity?.login === undefined)
            throw new Error('dsh-ppt：локальные сессии сохраняют шаблоны только файлами (CLI), без личной библиотеки');
        const record = await this.get(input.key, identity);
        if (existsSync(this.dirOf(SCOPE_USER, input.newId, identity)))
            throw new Error(`dsh-ppt：личный шаблон с id «${input.newId}» уже есть`);
        const now = new Date().toISOString();
        const manifest = { ...record.manifest, id: input.newId, name: input.name, author: identity.login, revision: 1, createdAt: now, updatedAt: now };
        return this.save({ manifest, assets: record.assets, scope: SCOPE_USER, identity });
    }
    /** Arguments for the engine's HTML-only preview of an unsaved draft. */
    async previewOptions(input) {
        const m = await this.mod();
        let base;
        if (input.baseKey) {
            try {
                base = await this.get(input.baseKey, input.identity);
            }
            catch { /* a new template has no stored base */ }
        }
        const assets = await this.draftAssets(input.manifest, input.uploads, base);
        const draft = input.manifest ?? {};
        // The preview tolerates a half-typed id or an empty name; saving validates them strictly.
        const manifest = {
            ...draft, schemaVersion: draft.schemaVersion === 3 ? 3 : Array.isArray(draft?.style?.layouts) && draft.style.layouts.length ? 2 : 1,
            id: typeof draft.id === 'string' && /^[a-z0-9][a-z0-9-]{1,48}$/.test(draft.id) ? draft.id : 'preview-template',
            name: typeof draft.name === 'string' && draft.name.trim() ? draft.name : 'Шаблон',
        };
        return m.templatePreviewOptions(manifest, assets, { lang: input.lang, sampleLength: input.sampleLength });
    }
    /** Import a bundle (.zip or template.json) into user space, or public for admins. */
    async import(input) {
        const m = await this.mod();
        const identity = input.identity;
        const scope = input.scope ?? SCOPE_USER;
        if (scope === SCOPE_PUBLIC && !this.isAdmin(identity))
            throw new Error('dsh-ppt：импортировать общие шаблоны может только администратор');
        if (scope !== SCOPE_PUBLIC && scope !== SCOPE_USER)
            throw new Error('dsh-ppt：import поддерживает scope user / public');
        if (scope === SCOPE_USER && identity?.login === undefined)
            throw new Error('dsh-ppt：локальные сессии импортируют шаблоны только файлами (CLI), без личной библиотеки');
        const read = input.bytes
            ? m.readTemplateZip(input.bytes)
            : m.readTemplateBundle(String(input.source));
        const manifest = { ...read.manifest, author: identity?.login ?? read.manifest.author ?? 'local' };
        return this.save({ manifest, assets: read.assets, scope, identity });
    }
    /**
     * Publish a copy of a visible template into public. Admin only. An admin may
     * name another user's template with `owner` (their login); non-admins can
     * only ever see their own user scope, so `owner` is rejected for them.
     */
    async publish(input) {
        if (!this.isAdmin(input.identity))
            throw new Error('dsh-ppt：публиковать шаблоны в общие может только администратор');
        const [scope] = parseKey(input.key);
        let identity = input.identity;
        if (scope === SCOPE_USER && input.owner !== undefined) {
            if (!identity.login)
                throw new Error('dsh-ppt：указывать владельца шаблона может только вошедший администратор');
            identity = { ...identity, login: input.owner };
        }
        const record = await this.get(input.key, identity);
        const manifest = { ...record.manifest, author: input.owner ?? input.identity.login ?? record.manifest.author };
        return this.save({ manifest, assets: record.assets, scope: SCOPE_PUBLIC, identity: input.identity });
    }
    async delete(key, identity) {
        const [scope, id] = parseKey(key);
        if (scope === SCOPE_BUILTIN)
            throw new Error('dsh-ppt：встроенные шаблоны удалить нельзя');
        if (scope === SCOPE_PUBLIC && !this.isAdmin(identity))
            throw new Error('dsh-ppt：удалять общие шаблоны может только администратор');
        if (scope === SCOPE_USER && identity?.login === undefined)
            throw new Error('dsh-ppt：личный шаблон не найден');
        const dir = this.dirOf(scope, id, identity);
        if (!ordinaryDir(dir))
            throw new Error(`dsh-ppt：шаблон не найден：${key}`);
        rmSync(dir, { recursive: true, force: true });
        this.cache.delete(cacheKey(key, identity?.login));
        return { ok: true };
    }
    /** Write a template bundle into a session workspace directory. */
    async export(key, outDir, identity) {
        const m = await this.mod();
        const record = await this.get(key, identity);
        return m.writeTemplateBundle(outDir, record.manifest, record.assets);
    }
    /** Style options for editDeck restyle + lineage. */
    async restyleOptions(key, identity) {
        const m = await this.mod();
        const record = await this.get(key, identity);
        return m.templateRestyleOptions(record.manifest, record.assets);
    }
    /** Create options for buildDeckAsync + lineage. */
    async createOptions(key, identity, options) {
        const m = await this.mod();
        const record = await this.get(key, identity);
        return m.templateCreateOptions(record.manifest, record.assets, options);
    }
    invalidate() { this.cache.clear(); }
}
/** Names of the image assets a manifest refers to (logo, backgrounds, slide images). */
function referencedAssets(manifest) {
    const names = new Set();
    for (const face of Array.isArray(manifest?.style?.fonts) ? manifest.style.fonts : [])
        if (typeof face?.file === 'string')
            names.add(face.file);
    const logo = manifest?.style?.brand?.logo;
    if (typeof logo === 'string')
        names.add(logo);
    for (const bg of Array.isArray(manifest?.style?.backgrounds) ? manifest.style.backgrounds : [])
        if (typeof bg?.image === 'string')
            names.add(bg.image);
    for (const layout of Array.isArray(manifest?.style?.layouts) ? manifest.style.layouts : []) {
        if (typeof layout?.background?.image === 'string')
            names.add(layout.background.image);
        for (const image of Array.isArray(layout?.images) ? layout.images : []) {
            if (typeof image?.image === 'string')
                names.add(image.image);
            if (typeof image?.svg === 'string')
                names.add(image.svg);
        }
    }
    for (const list of [manifest?.outline, manifest?.samples]) {
        for (const slide of Array.isArray(list) ? list : [])
            if (typeof slide?.image?.src === 'string')
                names.add(slide.image.src);
    }
    return names;
}
function parseKey(key) {
    const text = String(key ?? '');
    const colon = text.indexOf(':');
    const scope = colon === -1 ? SCOPE_PUBLIC : text.slice(0, colon);
    const id = colon === -1 ? text : text.slice(colon + 1);
    if (!['builtin', SCOPE_PUBLIC, SCOPE_USER].includes(scope))
        throw new Error(`dsh-ppt：неизвестный scope шаблона：${key}`);
    if (!/^[a-z0-9][a-z0-9-]{1,48}$/.test(id))
        throw new Error(`dsh-ppt：недопустимый id шаблона：${key}`);
    return [scope, id];
}
function cacheKey(key, login) { return key + '@' + (login ?? ''); }
function sanitizeLogin(login) {
    const clean = String(login ?? '').trim();
    if (!clean || clean.length > 120 || clean.includes('/') || clean.includes('\\') || clean.includes('\0') || clean.startsWith('.')) {
        throw new Error('dsh-ppt：недопустимый логин пользователя для личных шаблонов');
    }
    if (/^[A-Za-z0-9._@-]{1,120}$/.test(clean))
        return clean;
    // Логины вне ASCII-набора хэшируются, чтобы каталог был безопасным и стабильным.
    return 'u-' + createHash('sha256').update(clean).digest('hex').slice(0, 24);
}
