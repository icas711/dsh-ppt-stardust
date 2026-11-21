/** dsh-ppt 的公共类型。 */
export type PptThemeId = 'swiss' | 'velvet' | 'data' | 'soft' | 'bold';
export type PptLanguage = 'zh' | 'en' | 'bilingual' | 'ru';
export type PptSlideLayout = 'cover' | 'section' | 'bullets' | 'statement' | 'quote' | 'table' | 'closing' | 'image' | 'image-left' | 'image-right' | 'chart' | 'scene' | 'diagram';
export type PptTemplateId = 'weekly' | 'defense' | 'project' | 'pitch';
export interface PptImageSpec {
    src?: string;
    assetId?: string;
    alt?: string;
    fit?: 'contain' | 'cover';
    caption?: string;
}
export interface PptChartSpec {
    kind?: 'column' | 'bar' | 'line' | 'pie';
    categories?: Array<string | number>;
    series?: Array<{
        name: string;
        values: Array<string | number>;
    }>;
    rows?: Array<Array<string | number>>;
    unit?: string;
    caption?: string;
}
export interface PptBrand {
    name?: string;
    primaryColor?: string;
    backgroundColor?: string;
    textColor?: string;
    fontFamily?: string;
    logo?: string | null;
    footer?: string;
}
export interface PptQualityIssue {
    slide: number;
    slideId?: string;
    severity: 'warning' | 'error';
    code: string;
    message: string;
    suggestion: string;
    messageEn?: string;
    suggestionEn?: string;
    messageRu?: string;
    suggestionRu?: string;
}
export interface PptQualityResult {
    ok: boolean;
    slideCount: number;
    errorCount: number;
    warningCount: number;
    issues: PptQualityIssue[];
    note: string;
    noteEn?: string;
    noteRu?: string;
    language?: string;
}
export interface PptVerification {
    static: 'checked';
    pptxRender: 'not-verified' | 'rendered';
    visual: 'not-verified';
}
export interface PptRenderArgs {
    pptxPath: string;
    outputDir?: string;
    format?: 'png' | 'pdf' | 'both';
    width?: number;
    timeoutMs?: number;
}
export interface PptRenderResult {
    ok: boolean;
    status: 'unavailable' | 'not-verified' | 'rendered';
    backend?: string;
    rendererVersion?: string;
    sourceSha256?: string;
    outputDir?: string;
    reason?: string;
    slideCount?: number;
    pngPaths?: string[];
    pdfPath?: string;
    receiptPath?: string;
    missingFonts?: string[];
    message?: string;
    installationHint?: string;
    visual?: 'not-verified';
}
export interface PptGenerationReport {
    valid: boolean;
    stale?: boolean;
    diagnostics: Array<{
        severity: string;
        code: string;
        message: string;
        slideId?: string;
        slotId?: string;
        alternatives?: string[];
    }>;
    metrics?: Record<string, number>;
    usedVariants?: string[];
    usedStructures?: string[];
    unusedVariants?: string[];
}
export interface PptCheckResult extends PptQualityResult {
    verification: PptVerification;
    render?: PptRenderResult;
    generationReport?: PptGenerationReport;
    selectedSlide?: PptSlideSpec & {
        slide: number;
    };
    revision?: number;
    deckId?: string;
    deckPath?: string;
    slides?: Array<{
        slide: number;
        id: string;
        title: string;
        layout: string;
    }>;
}
export interface PptEditArgs {
    deckPath: string;
    edits?: Array<{
        slide: number | string;
        patch: Partial<Omit<PptSlideSpec, 'id'>> & {
            elementUpdates?: Array<{
                id: string;
                changes: Record<string, unknown>;
            }>;
        };
    }>;
    order?: string[];
    brand?: PptBrand | null;
    expectedRevision?: number;
    saveAs?: boolean;
}
export interface PptProjectArgs {
    deckPath: string;
    expectedRevision?: number;
}
export interface PptDataSource {
    id: string;
    name?: string;
    format?: 'csv' | 'tsv' | 'text';
    path?: string;
    content?: string;
    kind?: 'table' | 'text';
    rows?: Array<Array<string | number>>;
    text?: string;
}
export interface PptDataMetric {
    id: string;
    label?: string;
    kind: 'source' | 'input' | 'formula';
    source?: {
        sourceId: string;
        cell?: string;
        line?: number;
        numberIndex?: number;
    };
    value?: number;
    min?: number;
    max?: number;
    step?: number;
    note?: string;
    formula?: string;
    format?: {
        style?: 'number' | 'percent';
        digits?: number;
        unit?: string;
    };
}
export interface PptDataModel {
    schemaVersion?: 1;
    sources: PptDataSource[];
    metrics: PptDataMetric[];
}
export interface PptSlideSpec {
    id?: string;
    label?: string;
    purpose?: 'cover' | 'section' | 'content' | 'closing';
    backgroundColor?: string;
    diagram?: {
        kind: 'process' | 'timeline' | 'comparison' | 'hierarchy' | 'relationship' | 'chart';
        items?: Array<{
            id?: string;
            label: string;
            detail?: string;
            date?: string;
            parentId?: string;
        }>;
        links?: Array<{
            from: string;
            to: string;
        }>;
        chart?: Record<string, unknown>;
    };
    elements?: Array<{
        id: string;
        type: 'text' | 'image' | 'shape' | 'line' | 'group' | 'chart' | 'table' | 'unsupported';
        frame: {
            x: number;
            y: number;
            w: number;
            h: number;
        };
        [key: string]: unknown;
    }>;
    layout?: PptSlideLayout;
    title?: string;
    subtitle?: string;
    kicker?: string;
    text?: string;
    bullets?: string[];
    /** 表格页数据；第一行作为表头。 */
    rows?: Array<Array<string | number>>;
    /** 演讲者备注；写入 HTML 备注面板与 PPTX 原生备注页。 */
    notes?: string;
    image?: PptImageSpec | string | null;
    chart?: PptChartSpec | null;
    /** Optional bounded native font sizes, in points. */
    visual?: {
        titleSize?: number;
        bodySize?: number;
        chartLabelSize?: number;
    };
}
export interface PptConfig {
    /** 默认输出目录；调用 ppt_create 时可用 outputDir 覆盖。相对路径按会话工作目录解析。 */
    outputDir?: string;
    /** 单次生成幻灯片上限，默认 60（3–120）。 */
    maxSlides?: number;
    /** 默认视觉主题 id，调用 ppt_create 时可用 theme 覆盖。 */
    defaultTheme?: string;
    /** 默认播放器界面语言，调用 ppt_create 时可用 lang 覆盖。 */
    defaultLang?: string;
    /** 模板管理（公共模板导入/删除/发布）的备用管理员登录名列表；webAuth 可用时以宿主为准。 */
    admins?: string[];
}
export interface PptVisualCreateSpec {
    version: 1;
    mode: 'factual' | 'demo';
    allowMoreSlides?: boolean;
    contentHash?: string;
    assets?: Array<{
        id: string;
        mime: 'image/png' | 'image/jpeg';
        width: number;
        height: number;
        data: string;
    }>;
    sources: Array<{
        id: string;
        text: string;
        synthetic?: boolean;
    }>;
    slides: Array<{
        id: string;
        title: string;
        notes?: string;
        designLayout?: string;
        visual: {
            type: 'cards';
            sourceRefs: string[];
            caption?: string;
            items: Array<{
                id: string;
                label: string;
                detail?: string;
                sourceRefs?: string[];
                iconId?: 'check' | 'clock' | 'target' | 'trend';
            }>;
        } | {
            type: 'process';
            sourceRefs: string[];
            ordered: true;
            items: Array<{
                id: string;
                label: string;
                detail?: string;
                sourceRefs?: string[];
            }>;
        } | {
            type: 'timeline';
            sourceRefs: string[];
            ordered: true;
            items: Array<{
                id: string;
                label: string;
                date: string;
                detail?: string;
                sourceRefs?: string[];
            }>;
        } | {
            type: 'comparison';
            sourceRefs: string[];
            criteria: string[];
            items: Array<{
                id: string;
                label: string;
                values: Array<string | null>;
                detail?: string;
                sourceRefs?: string[];
            }>;
        } | {
            type: 'big_number';
            sourceRefs: string[];
            items: Array<{
                id: string;
                label: string;
                value: number;
                unit: string;
                detail?: string;
                sourceRefs?: string[];
            }>;
        } | {
            type: 'image';
            sourceRefs: string[];
            assetId: string;
            alt: string;
            caption?: string;
        } | {
            type: 'table';
            sourceRefs: string[];
            headers: string[];
            rows: Array<Array<string | null>>;
        } | {
            type: 'chart';
            sourceRefs: string[];
            kind: 'column' | 'bar' | 'line' | 'pie';
            unit: string;
            categories: string[];
            series: Array<{
                name: string;
                values: number[];
            }>;
            ordered?: boolean;
            whole?: boolean;
            showPercent?: boolean;
        };
    }>;
}
export interface PptCreateArgs {
    title: string;
    /** Read a prepared tableSpec/visualSpec request directly; no inline overrides except an exactly matching title. */
    requestFile?: string;
    /** SHA-256 of the original JSON file bytes; required with requestFile. */
    requestSha256?: string;
    /** Content-only native tables using an authorized schema 3 library template. */
    tableSpec?: {
        version: 1;
        mode: 'factual' | 'demo';
        allowMoreSlides?: boolean;
        contentHash?: string;
        sources: Array<{
            id: string;
            text: string;
            synthetic?: boolean;
        }>;
        tables: Array<{
            id: string;
            title: string;
            notes?: string;
            designLayout?: string;
            sourceRefs: string[];
            headers: string[];
            rows: Array<Array<string | null>>;
        }>;
    };
    /** Content-only native visuals (eight supported types) using an authorized schema 3 template. */
    visualSpec?: PptVisualCreateSpec;
    assets?: Record<string, {
        mime: string;
        width: number;
        height: number;
        data: string;
    }>;
    style?: {
        pageSize?: {
            width: number;
            height: number;
        };
    };
    /** Markdown 正文：一句话、一段文字或整篇文档（与 slides 二选一，推荐）。 */
    content?: string;
    /** 结构化幻灯片（高级用法，与 content 二选一）。 */
    slides?: PptSlideSpec[];
    theme?: string;
    lang?: string;
    /** 页间转场与要点入场动画：on（默认）/ off。 */
    motion?: 'on' | 'off';
    outputDir?: string;
    fileName?: string;
    /** 是否覆盖同名三件套；默认 false，同名时自动选择唯一后缀。 */
    overwrite?: boolean;
    template?: PptTemplateId;
    /** Library template key (builtin:<id> / public:<id> / user:<id>) applied on top of content/slides. */
    templateId?: string;
    /** Apply template sample slides in addition to the outline skeleton; default true. */
    templateSelections?: Array<{
        layoutId: string;
        values?: Record<string, unknown>;
    }>;
    /** Schema 3: explicit, validated generation plan with addressable content. */
    deckPlan?: Record<string, unknown>[];
    generationPolicy?: Record<string, number>;
    templateSamples?: boolean;
    brand?: PptBrand;
    /** Optional explicit source facts, assumptions and safe arithmetic; bind slides with {{metricId}}. */
    dataModel?: PptDataModel;
}
export interface PptThemeInfo {
    id: string;
    name: string;
    mood: string;
    bestFor: string;
    dark: boolean;
    palette: Record<string, string>;
    fonts: Record<string, string>;
}
export interface PptThemePreviewResult {
    ok: boolean;
    outputDir: string;
    htmlPath: string;
    svgs: Array<{
        id: string;
        path: string;
    }>;
    themeCount: number;
    language: string;
}
export interface PptThemesResult {
    ok: boolean;
    themes: PptThemeInfo[];
    /** 传 preview: true 时返回：主题对比页 + 每套主题的 SVG 色板卡。 */
    preview?: PptThemePreviewResult;
}
export interface PptCreateResult {
    ok: boolean;
    title: string;
    theme: string;
    language: string;
    slideCount: number;
    outputDir: string;
    files: {
        html: string;
        pptx: string;
        json: string;
        pdf?: string;
    };
    htmlPath: string;
    pptxPath: string;
    jsonPath: string;
    pdfPath?: string;
    pdfWarning?: string;
    pdfRender?: {
        sourceSha256: string;
        pdfSha256: string;
        backend?: string;
        rendererVersion?: string;
        missingFonts: string[];
        visual: 'not-verified';
    };
    internalProject?: boolean;
    deckId?: string;
    revision?: number;
    undoAvailable?: number;
    deliveryStatus?: 'draft' | 'ready-for-review';
    changed?: boolean;
    quality?: PptQualityResult;
    generationReport?: PptGenerationReport;
    tableComposition?: Record<string, unknown>;
    visualComposition?: Record<string, unknown>;
    requestInput?: {
        sha256: string;
        bytes: number;
    };
    verification?: PptVerification;
}
/** Library template manifest (schemaVersion 1) summary as shown in lists. */
export interface PptTemplateSummary {
    id: string;
    name: string;
    description?: string;
    author?: string;
    revision: number;
    createdAt?: string;
    updatedAt?: string;
    scope?: string;
    /** `<scope>:<id>` key used by every template operation. */
    key?: string;
    readonly?: boolean;
    /** Hidden shared templates are available only to administrators. */
    hidden?: boolean;
    /** A public template that overrides the built-in template of the same id. */
    overridesBuiltin?: boolean;
    theme?: string | null;
    brand?: Record<string, string> | null;
    hasLogo?: boolean;
    backgrounds?: Array<{
        layoutType: string;
        fit?: string;
    }>;
    outlineCount?: number;
    sampleCount?: number;
    outlineTitles?: string[];
    assetCount?: number;
}
export interface PptTemplateImportReport {
    colors?: unknown;
    fonts?: unknown;
    masterBackground?: boolean;
    layoutBackgrounds?: number;
    logo?: {
        bytes: number;
    } | null;
    warnings?: string[];
}
export interface PptTemplateApplyResult {
    ok: true;
    template: {
        id: string;
        revision: number;
    };
    changed: boolean;
    applied: {
        theme?: string;
        brand: string[];
        backgrounds: string[];
    };
    warnings: string[];
}
/** Shared generator and optional renderer exposed to the plugin. */
export interface DeckEngine {
    repairDeckVisual(options: Record<string, unknown>): Promise<PptCreateResult>;
    readRenderReceipt(pptxPath: string, receiptPath: string): PptRenderResult;
    previewDeckData(options: Record<string, unknown>): Record<string, any>;
    updateDeckData(options: Record<string, unknown>): Promise<PptCreateResult>;
    dataReport(manifest: any): string;
    dataNotes(manifest: any, slide: any): string;
    buildDeckAsync?(options: Record<string, unknown>): Promise<PptCreateResult>;
    previewDeckHtml?(options: Record<string, unknown>): {
        ok: true;
        html: string;
        slideCount: number;
    };
    readDeckProject(options: Record<string, unknown>): {
        manifest: any;
        path: string;
    };
    listTemplates(lang?: string): unknown[];
    editDeck(options: Record<string, unknown>): Promise<PptCreateResult>;
    undoDeck(options: Record<string, unknown>): Promise<PptCreateResult>;
    checkDeck(options: Record<string, unknown>): PptQualityResult;
    checkDeckAsync?(options: Record<string, unknown>): Promise<PptCheckResult>;
    renderDeck(options: Record<string, unknown>): Promise<PptRenderResult>;
    buildDeck(options: Record<string, unknown>): PptCreateResult;
    buildThemePreview(options: Record<string, unknown>): PptThemePreviewResult;
    listThemes(lang?: string): PptThemeInfo[];
    resolveTheme(input: unknown): Record<string, unknown>;
    resolveLanguage(input: unknown): Record<string, unknown>;
}
