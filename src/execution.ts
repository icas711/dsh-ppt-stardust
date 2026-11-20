import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { PptGenerationService } from './generation.js'
import type { ResolvedPptConfig } from './config.js'
import type { DeckEngine, PptCreateArgs, PptThemesResult } from './types.js'
import { PptTemplateStore } from './templates.js'
import { resolveToolIdentity, type CallerIdentity, type WebAuthLike } from './identity.js'

/** The Harness execution fields used by this plugin; optional for direct callers. */
export interface PptExecution {
  readonly signal?: AbortSignal
  readonly agent?: { readonly session: { readonly header: { readonly cwd?: string; readonly id?: string; readonly owner?: string }; requestContext?(): any; requestHeader?(): any } }
}

export interface ExecutorOptions {
  /** Test override; production uses the plugin's session-scoped experiment storage. */
  generationRoot?: string
  /** Template library; when absent, library template features degrade gracefully. */
  templateStore?: PptTemplateStore
  /** Host webAuth bridge for admin verdicts (optional). */
  webAuth?: WebAuthLike
}

let enginePromise: Promise<DeckEngine> | null = null
export function getEngine(): Promise<DeckEngine> {
  if (enginePromise === null) {
    const engineUrl = new URL('../skills/dsh-ppt/scripts/deck-advanced.mjs', import.meta.url)
    enginePromise = import(engineUrl.href).then((module: Record<string, unknown>) => module as unknown as DeckEngine)
      .catch((error: unknown) => {
        enginePromise = null
        throw error
      })
  }
  return enginePromise
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

/** Trusted host metadata only; arguments cannot select another session's namespace. */
export function executionScope(exec?: PptExecution): string | undefined {
  const header = exec?.agent?.session.header
  if (typeof header?.id !== 'string' || !header.id.trim()) return undefined
  return createHash('sha256').update(JSON.stringify([header.owner ?? null, header.id])).digest('hex')
}

function deliveryDirectory(cwd: string, requested: string | undefined, exec?: PptExecution): string {
  const base = resolve(cwd, requested || '.')
  const scope = executionScope(exec)
  // An explicitly selected folder remains an intentional export destination.
  return scope && base === resolve(cwd) ? join(base, 'dsh-ppt', 'session-' + scope) : base
}

/** Admins may pass scope: 'public'; everyone else lands in their own space. */
function publicScope(args: Record<string, unknown>, identity: CallerIdentity): string {
  return args.scope === 'public' ? 'public' : 'user'
}

function assetInput(value: unknown): Record<string, any> | undefined {
  if (value === undefined || value === null) return undefined
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('dsh-ppt：assets 需为对象（имя → путь / data URI / base64）')
  return value as Record<string, any>
}

let templatesModulePromise: Promise<Record<string, any>> | null = null
/** Shared template implementation from the skill scripts. */
export function loadTemplatesModule(): Promise<Record<string, any>> {
  if (templatesModulePromise === null) {
    const url = new URL('../skills/dsh-ppt/scripts/deck-templates.mjs', import.meta.url)
    templatesModulePromise = import(url.href).then(module => module as unknown as Record<string, any>)
      .catch(error => { templatesModulePromise = null; throw error })
  }
  return templatesModulePromise
}

/** Build executors with a shared engine loader; resolve paths separately for each call. */
export function createPptExecutors(config: ResolvedPptConfig, loadEngine: () => Promise<DeckEngine> = getEngine, options: ExecutorOptions = {}) {
  const generation = new PptGenerationService({ root: options.generationRoot, loadEngine, maxSlides: config.maxSlides })
  const identityOf = (exec?: PptExecution): CallerIdentity =>
    resolveToolIdentity(exec, { admins: config.admins, webAuth: options.webAuth })
  return {
    async generation(rawArgs: unknown, exec?: PptExecution) {
      exec?.signal?.throwIfAborted()
      const scope = executionScope(exec)
      if (!scope) throw new Error('ppt_generation requires a trusted DSH chat/session ID')
      const cwd = exec?.agent?.session.header.cwd ?? process.cwd()
      let route = exec?.agent?.session.requestContext?.()
      if (!route?.provider || !route?.model) route = exec?.agent?.session.requestHeader?.()?.config
      return generation.execute(asRecord(rawArgs), { scope, outputDir: deliveryDirectory(cwd, config.outputDir, exec), signal: exec?.signal,
        route: typeof route?.provider === 'string' && typeof route?.model === 'string' ? { provider: route.provider, model: route.model } : null })
    },
    async themes(rawArgs: unknown, exec?: PptExecution): Promise<PptThemesResult> {
      exec?.signal?.throwIfAborted()
      const args = asRecord(rawArgs)
      const lang = typeof args.lang === 'string' && args.lang.trim() !== '' ? args.lang.trim() : 'zh'
      const engine = await loadEngine()
      exec?.signal?.throwIfAborted()
      const themes = engine.listThemes(lang)
      if (args.preview === true) {
        const cwd = exec?.agent?.session.header.cwd ?? process.cwd()
        const requested = typeof args.outputDir === 'string' && args.outputDir.trim() !== '' ? args.outputDir.trim() : config.outputDir || '.'
        const preview = engine.buildThemePreview({
          outputDir: deliveryDirectory(cwd, requested, exec),
          lang,
          overwrite: args.overwrite === true,
        })
        return { ok: true, themes, preview }
      }
      return { ok: true, themes }
    },
    async create(rawArgs: unknown, exec?: PptExecution) {
      exec?.signal?.throwIfAborted()
      const input = asRecord(rawArgs)
      const args = input as unknown as PptCreateArgs
      if (typeof args.title !== 'string' || args.title.trim() === '') throw new Error('dsh-ppt：title 不能为空')
      const hasTableSpec = Object.hasOwn(input, 'tableSpec')
      if (hasTableSpec) {
        const conflicts = ['content','slides','deckPlan','generationPolicy','templateSelections','templateSamples','template','dataModel','assets','style','brand','theme'].filter(key => Object.hasOwn(input,key))
        if (conflicts.length) throw new Error('dsh-ppt: tableSpec cannot be combined with ' + conflicts.join(', '))
        if (typeof args.templateId !== 'string' || !args.templateId.trim()) throw new Error('dsh-ppt: tableSpec requires a schema 3 library templateId')
      }
      const hasContent = typeof args.content === 'string' && args.content.trim() !== ''
      const hasSlides = Array.isArray(args.slides) && args.slides.length > 0
      // Never let malformed scene input disappear behind a template skeleton.
      if (hasSlides) for (const [index, slide] of args.slides!.entries()) {
        if (slide && 'elements' in slide && slide.layout !== 'scene') {
          throw new Error(`dsh-ppt: composition-layout at slides[${index}] (slide ${index + 1}): slides with elements require layout:"scene". Every element requires a complete frame:{x,y,w,h} in integer EMU (914400/inch). Supplied content was not replaced with template draft pages.`)
        }
      }
      if(args.generationPolicy&&!args.deckPlan)throw new Error('dsh-ppt: generationPolicy requires deckPlan')
      if(args.deckPlan&&(!args.templateId||hasContent||hasSlides||args.templateSelections||args.dataModel))throw new Error('dsh-ppt: deckPlan requires templateId and cannot be combined with content, slides, templateSelections or dataModel')
      if (!hasContent && !hasSlides && !args.template && !args.templateId) throw new Error('dsh-ppt：content 不能为空（或用 slides / template / templateId 传结构化幻灯片）')
      const engine = await loadEngine()
      // Check cancellation after loading and before artifact commit inside the async engine.
      exec?.signal?.throwIfAborted()
      const cwd = exec?.agent?.session.header.cwd ?? process.cwd()
      const outputDir = typeof args.outputDir === 'string' && args.outputDir.trim() !== '' ? args.outputDir.trim() : config.outputDir
      // Library template: style + outline skeleton (+ optional samples) under the given title.
      let templateApply: Record<string, unknown> = {}
      let tableComposition: Record<string, unknown> | undefined
      if (typeof args.templateId === 'string' && args.templateId.trim() !== '') {
        const store = options.templateStore
        if (!store) throw new Error('dsh-ppt：библиотека шаблонов недоступна в этой установке; используйте файл шаблона через CLI')
        const templateOptions = {
          title: args.title.trim(),
          includeSamples: args.templateSamples !== false,
          selections: args.templateSelections,
          deckPlan: args.deckPlan,
          generationPolicy:args.generationPolicy,
          assets:args.assets,
          slides:hasSlides&&args.slides!.every(s=>s.layout==='scene')?args.slides:undefined,
          lang: typeof args.lang === 'string' && args.lang.trim() !== '' ? args.lang.trim() : (config.defaultLang || 'zh'),
        }
        let applied
        if (hasTableSpec) {
          const record = await store.get(args.templateId.trim(), identityOf(exec))
          exec?.signal?.throwIfAborted()
          const module = await import(new URL('../skills/dsh-ppt/scripts/deck-table-create.mjs', import.meta.url).href)
          applied = module.composeTableCreate(args.tableSpec, { title: templateOptions.title, lang: templateOptions.lang,
            template: { manifest: record.manifest, assets: record.assets }, maxSlides: Math.min(config.maxSlides,120), signal: exec?.signal })
          tableComposition = applied.report
        } else applied = await store.createOptions(args.templateId.trim(), identityOf(exec), templateOptions)
        const { create, lineage } = applied
        templateApply = {
          slides: create.slides,
          theme: create.theme,
          brand: create.brand,
          style: create.style,
          assets: create.assets,
          templateLineage: lineage,
          generation:create.generation,
        }
      }
      const explicitSlides = hasSlides ? args.slides : undefined
      const sceneComposition = explicitSlides?.every(s => s.layout === 'scene')
      const suppliedVisuals = explicitSlides?.some(s => s.layout === 'scene' || s.layout === 'diagram')
      const resolvedSlides = sceneComposition
        ? (templateApply.slides as typeof args.slides) ?? explicitSlides
        : suppliedVisuals ? explicitSlides : (templateApply.slides as typeof args.slides) ?? explicitSlides
      const explicitContent = hasContent ? (typeof args.content === 'string' ? args.content : '') : ''
      const result = await (engine.buildDeckAsync ?? engine.buildDeck)({
        title: args.title.trim(),
        content: explicitContent,
        // Composed scene slides already include the selected template's fixed artwork.
        slides: resolvedSlides,
        theme: templateApply.theme ?? (typeof args.theme === 'string' && args.theme.trim() !== '' ? args.theme.trim() : (config.defaultTheme || undefined)),
        lang: typeof args.lang === 'string' && args.lang.trim() !== '' ? args.lang.trim() : (config.defaultLang || undefined),
        motion: args.motion,
        outputDir: deliveryDirectory(cwd, outputDir, exec),
        cacheScope: executionScope(exec),
        fileName: typeof args.fileName === 'string' && args.fileName.trim() !== '' ? args.fileName.trim() : undefined,
        overwrite: args.overwrite === true,
        internalProject: true,
        maxSlides: config.maxSlides,
        template: args.template,
        brand: templateApply.brand ?? args.brand,
        style: templateApply.style ?? args.style,
        assets: {...(templateApply.assets as object ?? {}),...args.assets},
        templateLineage: templateApply.templateLineage,
        generation:templateApply.generation,
        dataModel: args.dataModel,
        cwd,
        signal: exec?.signal,
      })
      return tableComposition ? { ...result, tableComposition } : result
    },
    async templates(rawArgs: unknown, exec?: PptExecution) {
      exec?.signal?.throwIfAborted()
      const args = asRecord(rawArgs)
      const engine = await loadEngine()
      exec?.signal?.throwIfAborted()
      return { ok: true, templates: engine.listTemplates(typeof args.lang === 'string' ? args.lang : config.defaultLang || 'zh') }
    },
    /** ppt_template: библиотека шаблонов — список, импорт/экспорт, создание из pptx/проекта, редизайн. */
    async template(rawArgs: unknown, exec?: PptExecution) {
      exec?.signal?.throwIfAborted()
      const args = asRecord(rawArgs)
      const engine = await loadEngine()
      const mod = await loadTemplatesModule()
      exec?.signal?.throwIfAborted()
      const cwd = exec?.agent?.session.header.cwd ?? process.cwd()
      const identity = identityOf(exec)
      const store = options.templateStore
      const lang = typeof args.lang === 'string' && args.lang.trim() !== '' ? args.lang.trim() : (config.defaultLang || 'zh')
      const needStore = (): PptTemplateStore => {
        if (!store) throw new Error('dsh-ppt：библиотека шаблонов недоступна в этой установке; используйте файлы шаблонов через CLI')
        return store
      }
      const key = typeof args.templateId === 'string' ? args.templateId.trim() : ''
      const summarize = (record: { manifest: Record<string, any>; key: string; readonly: boolean }) =>
        ({ ...mod.summarizeTemplate(record.manifest), key: record.key, readonly: record.readonly })
      switch (args.operation) {
        case 'validate-plan': {
          if(!key)throw new Error('dsh-ppt: templateId is required')
          const record=await needStore().get(key,identity)
          return {ok:true,generationReport:mod.templatePlanReport(record.manifest,args.deckPlan,args.generationPolicy)}
        }
        case 'list': {
          const list = store ? await store.list(identity) : []
          const scenarios = engine.listTemplates(lang)
          return { ok: true, templates: list, scenarios }
        }
        case 'get': {
          if (!key) throw new Error('dsh-ppt：нужен templateId')
          const record = await needStore().get(key, identity)
          return { ok: true, template: summarize(record), manifest: record.manifest }
        }
        case 'create-from-pptx': {
          const pptxPath = typeof args.pptxPath === 'string' ? args.pptxPath.trim() : ''
          if (!pptxPath) throw new Error('dsh-ppt：нужен pptxPath')
          const extracted = await mod.templateFromPptx(resolve(cwd, pptxPath), {
            templateId: typeof args.newTemplateId === 'string' ? args.newTemplateId.trim() : '',
            name: typeof args.name === 'string' ? args.name.trim() : '',
            description: typeof args.description === 'string' ? args.description : undefined,
            lang, model:'scene',
          })
          const saved = await needStore().save({ manifest: extracted.manifest, assets: extracted.assets, scope: publicScope(args, identity), identity })
          return { ok: true, key: saved.key, template: summarize(saved), report: extracted.report }
        }
        case 'create-from-project': {
          const deckPath = typeof args.deckPath === 'string' ? args.deckPath.trim() : ''
          if (!deckPath) throw new Error('dsh-ppt：нужен deckPath')
          const { manifest } = engine.readDeckProject({ deckPath: resolve(cwd, deckPath), cwd, signal: exec?.signal })
          const extracted = mod.templateFromDeckManifest(manifest, {
            templateId: typeof args.newTemplateId === 'string' ? args.newTemplateId.trim() : '',
            name: typeof args.name === 'string' ? args.name.trim() : '',
            description: typeof args.description === 'string' ? args.description : undefined,
            author: identity.login ?? 'local',
            includeSamples: args.samples !== false,
            lang: typeof manifest.language === 'string' ? manifest.language : lang,
          })
          const saved = await needStore().save({ manifest: extracted.manifest, assets: extracted.assets, scope: publicScope(args, identity), identity })
          return { ok: true, key: saved.key, template: summarize(saved), report: extracted.report }
        }
        case 'save': {
          const manifest = args.manifest
          if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('dsh-ppt：нужен manifest шаблона')
          const saved = await needStore().save({ manifest: manifest as Record<string, any>, assets: assetInput(args.assets), scope: publicScope(args, identity), identity })
          return { ok: true, key: saved.key, template: summarize(saved) }
        }
        case 'delete': {
          if (!key) throw new Error('dsh-ppt：нужен templateId')
          await needStore().delete(key, identity)
          return { ok: true, deleted: key }
        }
        case 'export': {
          if (!key) throw new Error('dsh-ppt：нужен templateId')
          const outDir = typeof args.outputDir === 'string' && args.outputDir.trim() !== '' ? args.outputDir.trim() : '.'
          const written = await needStore().export(key, deliveryDirectory(cwd, outDir, exec), identity)
          return { ok: true, path: written.path, bytes: written.bytes }
        }
        case 'import': {
          const path = typeof args.path === 'string' ? args.path.trim() : ''
          const data = typeof args.data === 'string' ? args.data : ''
          if (!path && !data) throw new Error('dsh-ppt：нужен path к файлу шаблона или data (base64 zip/json)')
          const bytes = data ? Buffer.from(data, 'base64') : undefined
          const saved = await needStore().import({ source: path ? resolve(cwd, path) : undefined, bytes, scope: publicScope(args, identity), identity })
          return { ok: true, key: saved.key, template: summarize(saved) }
        }
        case 'publish': {
          if (!key) throw new Error('dsh-ppt：нужен templateId')
          const owner = typeof args.owner === 'string' && args.owner.trim() !== '' ? args.owner.trim() : undefined
          const saved = await needStore().publish({ key, identity, owner })
          return { ok: true, key: saved.key, template: summarize(saved) }
        }
        case 'apply-to-project': {
          const deckPath = typeof args.deckPath === 'string' ? args.deckPath.trim() : ''
          if (!deckPath) throw new Error('dsh-ppt：нужен deckPath')
          if (!key && typeof args.bundlePath !== 'string') throw new Error('dsh-ppt：нужен templateId или bundlePath')
          let restyle: Record<string, any>, lineage: { id: string; revision: number }
          if (key) {
            ;({ restyle, lineage } = await needStore().restyleOptions(key, identity))
          } else {
            const bundle = mod.readTemplateBundle(resolve(cwd, String(args.bundlePath)))
            ;({ restyle, lineage } = mod.templateRestyleOptions(bundle.manifest, bundle.assets))
          }
          const result = await engine.editDeck({
            deckPath: resolve(cwd, deckPath), cwd, signal: exec?.signal,
            expectedRevision: args.expectedRevision,
            saveAs: args.saveAs === true,
            theme: restyle.theme,
            brand: restyle.brand,
            style: restyle.style,
            assets: restyle.assets,
            convertToScene: restyle.convertToScene,
            layoutMap: args.layoutMap,
            templateLineage: lineage,
          })
          return { ok: true, template: lineage, changed: result.changed, revision: result.revision, files: result.files }
        }
        default:
          throw new Error('dsh-ppt：неизвестная операция ppt_template; доступно: list/get/validate-plan/create-from-pptx/create-from-project/save/delete/export/import/publish/apply-to-project')
      }
    },
    async edit(rawArgs: unknown, exec?: PptExecution) {
      exec?.signal?.throwIfAborted()
      const engine = await loadEngine()
      exec?.signal?.throwIfAborted()
      return engine.editDeck({ ...asRecord(rawArgs), cwd: exec?.agent?.session.header.cwd ?? process.cwd(), signal: exec?.signal })
    },
    async undo(rawArgs: unknown, exec?: PptExecution) {
      exec?.signal?.throwIfAborted()
      const engine = await loadEngine()
      exec?.signal?.throwIfAborted()
      return engine.undoDeck({ ...asRecord(rawArgs), cwd: exec?.agent?.session.header.cwd ?? process.cwd(), signal: exec?.signal })
    },
    async check(rawArgs: unknown, exec?: PptExecution) {
      exec?.signal?.throwIfAborted()
      const engine = await loadEngine()
      exec?.signal?.throwIfAborted()
      return (engine.checkDeckAsync ?? engine.checkDeck)({ ...asRecord(rawArgs), cwd: exec?.agent?.session.header.cwd ?? process.cwd(), signal: exec?.signal })
    },
    async render(rawArgs: unknown, exec?: PptExecution) {
      exec?.signal?.throwIfAborted()
      const engine = await loadEngine()
      exec?.signal?.throwIfAborted()
      return engine.renderDeck({ ...asRecord(rawArgs), outputDir: undefined, cacheScope: executionScope(exec), cwd: exec?.agent?.session.header.cwd ?? process.cwd(), signal: exec?.signal })
    },
    async data(rawArgs: unknown, exec?: PptExecution) {
      exec?.signal?.throwIfAborted()
      const engine = await loadEngine(), args = asRecord(rawArgs)
      const options = { ...args, cwd:exec?.agent?.session.header.cwd ?? process.cwd(), signal:exec?.signal, allowFiles:true }
      if(args.action === 'preview') return engine.previewDeckData(options)
      if(args.action === 'apply') return engine.updateDeckData(options)
      throw new Error('dsh-ppt：action 需为 preview 或 apply / Use preview or apply')
    },
  }
}
