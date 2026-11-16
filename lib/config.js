export const PPT_OUTPUT_DIR_ENV = 'DSH_PPT_OUTPUT_DIR';
export const DEFAULT_MAX_SLIDES = 60;
/** 解析并校验插件行配置。本插件无必填项，空配置永远可用。 */
export function resolvePptConfig(config) {
    if (config !== undefined && config !== null && (typeof config !== 'object' || Array.isArray(config))) {
        throw new Error('dsh-ppt 配置必须是对象。');
    }
    const raw = config ?? {};
    if (raw.outputDir !== undefined && typeof raw.outputDir !== 'string') {
        throw new Error('outputDir 必须是字符串。');
    }
    if (raw.defaultTheme !== undefined && typeof raw.defaultTheme !== 'string') {
        throw new Error('defaultTheme 必须是字符串。');
    }
    if (raw.defaultLang !== undefined && typeof raw.defaultLang !== 'string') {
        throw new Error('defaultLang 必须是字符串。');
    }
    const outputDir = (typeof raw.outputDir === 'string' ? raw.outputDir : '').trim()
        || (process.env[PPT_OUTPUT_DIR_ENV] ?? '').trim();
    const defaultTheme = (typeof raw.defaultTheme === 'string' ? raw.defaultTheme : '').trim();
    const defaultLang = (typeof raw.defaultLang === 'string' ? raw.defaultLang : '').trim();
    if (defaultTheme !== '' && !['swiss', 'velvet', 'data', 'soft', 'bold'].includes(defaultTheme)) {
        throw new Error('defaultTheme 只支持 swiss / velvet / data / soft / bold。');
    }
    if (defaultLang !== '' && defaultLang !== 'zh' && defaultLang !== 'en' && defaultLang !== 'bilingual' && defaultLang !== 'ru') {
        throw new Error('defaultLang 只支持 zh / en / bilingual / ru。');
    }
    let maxSlides = DEFAULT_MAX_SLIDES;
    if (raw.maxSlides !== undefined) {
        if (typeof raw.maxSlides !== 'number' || !Number.isInteger(raw.maxSlides) || raw.maxSlides < 3 || raw.maxSlides > 120) {
            throw new Error('maxSlides 必须是 3–120 的整数。');
        }
        maxSlides = raw.maxSlides;
    }
    let admins = [];
    if (raw.admins !== undefined) {
        if (!Array.isArray(raw.admins) || raw.admins.some(item => typeof item !== 'string')) {
            throw new Error('admins 必须是字符串数组。');
        }
        admins = [...new Set(raw.admins.map(item => item.trim()).filter(item => item !== ''))];
    }
    return {
        outputDir,
        maxSlides,
        defaultTheme,
        defaultLang,
        admins,
    };
}
export function clampInt(value, fallback, min, max) {
    const n = typeof value === 'number' ? Math.trunc(value) : fallback;
    if (!Number.isFinite(n))
        return fallback;
    return Math.min(max, Math.max(min, n));
}
