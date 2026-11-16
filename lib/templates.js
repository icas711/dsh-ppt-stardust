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
    constructor(options) {
        this.root = resolve(options.root);
        this.builtinDir = options.builtinDir ? resolve(options.builtinDir) : undefined;
        this.loader = options.templatesModuleLoader;
        this.admins = options.admins;
    }
    mod() { return this.loader(); }
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
        for (const scope of [SCOPE_BUILTIN, SCOPE_PUBLIC, SCOPE_USER]) {
            for (const id of this.scopeIds(scope, identity)) {
                try {
                    const record = await this.load(`${scope}:${id}`, identity);
                    items.push({ ...m.summarizeTemplate(record.manifest), scope });
                }
                catch { /* A broken template must not break the whole list. */ }
            }
        }
        return items;
    }
    /** Resolve a template with assets for apply/restyle. */
    async get(key, identity) {
        const [scope] = parseKey(key);
        if (scope === SCOPE_USER && identity?.login === undefined)
            throw new Error('dsh-ppt：личные шаблоны доступны только вошедшим пользователям');
        return this.load(key, identity);
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
            manifest.createdAt = typeof previous.createdAt === 'string' ? previous.createdAt : manifest.createdAt;
            manifest.revision = Math.max(manifest.revision, (Number(previous.revision) || 0) + 1);
            const stale = join(dir, 'assets');
            if (ordinaryDir(stale))
                rmSync(stale, { recursive: true, force: true });
        }
        manifest.updatedAt = new Date().toISOString();
        m.writeTemplateDir(dir, manifest, assets);
        this.cache.delete(cacheKey(`${scope}:${manifest.id}`, identity?.login));
        return this.load(`${scope}:${manifest.id}`, identity);
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
