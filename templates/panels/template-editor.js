// Редактор шаблона: основное, тема, палитра, шрифт, логотип, футер, фоны по типам страниц,
// каркас страниц (outline) и слайды-образцы, живое HTML-превью (операция template-preview).
// Данные — операции template-get / template-save / template-preview сервера (src/workbench.ts).
// Общие имена с client.js избегаем: всё здесь с префиксом tpl / TPE.
const tplTr = (ru, en) => languageOf() === 'ru' ? ru : en;
const TPL_LAYOUTS = ['cover', 'section', 'bullets', 'statement', 'quote', 'closing'];
const TPL_BG_TYPES = ['cover', 'section', 'content', 'closing'];
const TPL_FONTS = ['Arial', 'Calibri', 'Cambria', 'Georgia', 'Helvetica', 'Open Sans', 'Roboto', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'];
const TPL_MAX_ASSET = 5 * 1024 * 1024;
const TPL_MAX_ASSETS = 8 * 1024 * 1024;
const TPL_HEX = /^#[0-9a-f]{6}$/i;
const TPL_ID = /^[a-z0-9][a-z0-9-]{1,48}$/;
const tplLayoutLabel = layout => ({
    cover: tplTr('Обложка', 'Cover'), section: tplTr('Раздел', 'Section'), bullets: tplTr('Список', 'Bullets'),
    statement: tplTr('Тезис', 'Statement'), quote: tplTr('Цитата', 'Quote'), closing: tplTr('Финал', 'Closing'),
    content: tplTr('Контент', 'Content'),
})[layout] ?? layout;

const TPE_CSS = `
.tpe{display:flex;flex-direction:column;gap:12px;min-width:0}
.tpe-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,44%);gap:20px;align-items:start}
.tpe-form{min-width:0}.tpe-preview{position:sticky;top:12px;min-width:0}
.tpe-preview .preview{margin:0 0 8px}
.tpe-nav{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.tpe-nav [aria-pressed=true]{border-color:var(--w-accent);color:var(--w-accent);background:var(--w-selected)}
.tpe-grow{flex:1}
.tpe-color,.tpe-image{margin:10px 0}.tpe-color>span,.tpe-image>span{display:block;margin-bottom:4px}
.tpe-color-row{display:flex;gap:8px;align-items:center}
.tpe .tpe-color-row input[type=color]{width:44px;height:36px;padding:2px;flex:none}
.tpe .tpe-color-row input[type=text]{flex:1;min-width:0}
.tpe-thumb{display:block;max-width:100%;max-height:110px;object-fit:contain;border:1px solid var(--w-border);border-radius:8px;background:var(--w-soft);margin:4px 0}
.tpe-bg{border:1px solid var(--w-border);border-radius:10px;padding:10px 12px;margin:10px 0}
.tpe-bg h4{margin:0 0 4px;font-size:14px}
.tpe-slide{padding:10px 12px}.tpe-slide-head{display:flex;gap:6px;align-items:center;margin-bottom:6px}
.tpe-slide-head select{width:auto;flex:none}
.tpe-slide-head button{padding:4px 9px;min-height:30px}
.tpe .tpe-hint{font-size:12px;color:var(--w-muted)}
@media(max-width:900px){.tpe-grid{grid-template-columns:minmax(0,1fr)}.tpe-preview{position:static;order:-1}}
`;

// Манифест — чистый JSON: копируем без structuredClone (его может не быть в окружении панели).
const tplClone = value => JSON.parse(JSON.stringify(value));

function tplNewDraft() {
    return tplDraftFrom({
        id: '', name: '', description: '', style: { theme: 'data' },
        outline: [
            { layout: 'cover', title: '{{deck.title}}', subtitle: 'Заполнить: докладчик и дата' },
            { layout: 'bullets', title: 'Заполнить: раздел 1', bullets: ['Заполнить: конкретные факты, доказательства и следующий шаг'] },
            { layout: 'closing', title: 'Спасибо', subtitle: 'Заполнить: контакты' },
        ],
    });
}

function tplDraftFrom(manifest) {
    const style = manifest?.style ?? {}, brand = style.brand ?? {}, backgrounds = {};
    for (const item of style.backgrounds ?? []) backgrounds[item.layoutType] = { image: item.image, fit: item.fit || 'cover' };
    return {
        id: manifest?.id ?? '', name: manifest?.name ?? '', description: manifest?.description ?? '', theme: style.theme ?? '',
        primaryColor: brand.primaryColor ?? '', backgroundColor: brand.backgroundColor ?? '', textColor: brand.textColor ?? '',
        fontFamily: brand.fontFamily ?? '', brandName: brand.name ?? '', footer: brand.footer ?? '', logo: brand.logo ?? '',
        backgrounds,
        outline: tplClone(manifest?.outline ?? []), samples: tplClone(manifest?.samples ?? []),
    };
}

function tplCleanSlide(slide) {
    const out = {};
    for (const [key, value] of Object.entries(slide)) {
        if (typeof value === 'string') { if (key === 'layout' || value.trim() !== '') out[key] = value; }
        else if (Array.isArray(value)) {
            const list = key === 'bullets' ? value.map(String).filter(item => item.trim() !== '') : value;
            if (list.length) out[key] = list;
        }
        else if (value && typeof value === 'object') out[key] = value;
    }
    return out;
}

// Черновик формы → манифест schemaVersion 1 (пустые поля не попадают в файл).
function tplBuild(draft, base) {
    const brand = {};
    for (const key of ['primaryColor', 'backgroundColor', 'textColor']) if (draft[key]) brand[key] = draft[key];
    if (draft.fontFamily.trim()) brand.fontFamily = draft.fontFamily.trim();
    if (draft.brandName.trim()) brand.name = draft.brandName.trim();
    if (draft.footer.trim()) brand.footer = draft.footer;
    if (draft.logo) brand.logo = draft.logo;
    const style = {};
    if (draft.theme) style.theme = draft.theme;
    if (Object.keys(brand).length) style.brand = brand;
    const backgrounds = TPL_BG_TYPES.filter(type => draft.backgrounds[type]?.image)
        .map(type => ({ layoutType: type, image: draft.backgrounds[type].image, fit: draft.backgrounds[type].fit || 'cover' }));
    if (backgrounds.length) style.backgrounds = backgrounds;
    const outline = draft.outline.map(tplCleanSlide), samples = draft.samples.map(tplCleanSlide);
    return {
        schemaVersion: 1, id: draft.id, name: draft.name.trim(),
        ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
        ...(base?.author ? { author: base.author } : {}),
        ...(base?.revision ? { revision: base.revision } : {}),
        ...(base?.createdAt ? { createdAt: base.createdAt } : {}),
        ...(Object.keys(style).length ? { style } : {}),
        ...(outline.length ? { outline } : {}),
        ...(samples.length ? { samples } : {}),
    };
}

// Поля, без которых превью не строится (id и название сервер для превью подставит сам).
function tplStyleProblem(draft) {
    for (const [key, label] of [['primaryColor', tplTr('Основной цвет', 'Primary colour')], ['backgroundColor', tplTr('Цвет фона', 'Background colour')], ['textColor', tplTr('Цвет текста', 'Text colour')]]) {
        if (draft[key] && !TPL_HEX.test(draft[key])) return label + tplTr(': нужен формат #RRGGBB', ': use the #RRGGBB format');
    }
    const font = draft.fontFamily.trim();
    if (font && (font.length > 80 || !/^[\p{L}\p{N} _-]+$/u.test(font))) return tplTr('Шрифт: одно название (буквы, цифры, пробел, дефис)', 'Font: a single family name (letters, digits, space, hyphen)');
    if (draft.footer.length > 100) return tplTr('Футер: не больше 100 символов', 'Footer: at most 100 characters');
    return '';
}
function tplSaveProblem(draft, existing) {
    if (!existing && !TPL_ID.test(draft.id)) return tplTr('Id шаблона: 2–49 символов, латиница в нижнем регистре, цифры и дефис', 'Template id: 2–49 characters, lowercase latin letters, digits and hyphen');
    if (!draft.name.trim() || draft.name.trim().length > 81) return tplTr('Название: от 1 до 81 символа', 'Name: 1 to 81 characters');
    return tplStyleProblem(draft);
}
function tplReferenced(draft) {
    const names = new Set();
    if (draft.logo) names.add(draft.logo);
    for (const type of TPL_BG_TYPES) if (draft.backgrounds[type]?.image) names.add(draft.backgrounds[type].image);
    return names;
}
function tplAssetBytes(draft, images) {
    let total = 0;
    for (const name of tplReferenced(draft)) total += Math.floor((images[name]?.length ?? 0) * 0.75);
    return total;
}

function TplColorField({ label, value, fallback, disabled, onChange }) {
    const shown = TPL_HEX.test(value) ? value : TPL_HEX.test(fallback ?? '') ? fallback : '#000000';
    return h('div', { className: 'tpe-color' }, h('span', null, label),
        h('div', { className: 'tpe-color-row' },
            h('input', { type: 'color', value: shown.toLowerCase(), disabled, 'aria-label': label, onChange: e => onChange(e.target.value.toUpperCase()) }),
            h('input', { type: 'text', value, maxLength: 7, disabled, placeholder: fallback || '#RRGGBB', 'aria-label': label + ' (hex)', onChange: e => onChange(e.target.value.trim()) }),
            value ? h(W.IconButton, { icon: 'close', label: tplTr('Вернуть цвет темы', 'Reset to the theme colour'), disabled, onClick: () => onChange('') }) : null));
}

function TplImageField({ label, name, images, disabled, onPick, onClear, children }) {
    return h('div', { className: 'tpe-image' }, h('span', null, label),
        name && images[name] ? h('img', { className: 'tpe-thumb', src: images[name], alt: label })
            : h('p', { className: 'tpe-hint' }, tplTr('Изображение не задано', 'No image set')),
        h('div', { className: 'w-toolbar' },
            h('input', { type: 'file', accept: 'image/png,image/jpeg', disabled, 'aria-label': label, onChange: e => { onPick(e.target.files?.[0]); e.target.value = ''; } }),
            name ? h(W.Button, { icon: 'trash', disabled, onClick: onClear }, tplTr('Убрать', 'Remove')) : null),
        children);
}

function TplSlideList({ slides, limit, hint, disabled, onChange }) {
    const update = (index, patch) => onChange(slides.map((slide, i) => i === index ? { ...slide, ...patch } : slide));
    const move = (index, delta) => {
        const target = index + delta;
        if (target < 0 || target >= slides.length) return;
        const next = slides.slice();
        [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
    };
    return h('div', { className: 'tpe-slides' },
        h('p', { className: 'tpe-hint' }, hint),
        slides.map((slide, index) => {
            const layouts = TPL_LAYOUTS.includes(slide.layout) ? TPL_LAYOUTS : [...TPL_LAYOUTS, slide.layout];
            const withKicker = ['cover', 'section', 'statement', 'closing'].includes(slide.layout);
            return h('div', { className: 'card tpe-slide', key: index },
                h('div', { className: 'tpe-slide-head' },
                    h('strong', null, String(index + 1) + '.'),
                    h('select', { value: slide.layout, disabled, 'aria-label': tplTr('Тип страницы', 'Slide type'), onChange: e => update(index, { layout: e.target.value }) },
                        layouts.map(layout => h('option', { key: layout, value: layout }, tplLayoutLabel(layout)))),
                    h('span', { className: 'tpe-grow' }),
                    h('button', { type: 'button', disabled: disabled || index === 0, 'aria-label': tplTr('Выше', 'Move up'), onClick: () => move(index, -1) }, '↑'),
                    h('button', { type: 'button', disabled: disabled || index === slides.length - 1, 'aria-label': tplTr('Ниже', 'Move down'), onClick: () => move(index, 1) }, '↓'),
                    h('button', { type: 'button', disabled: disabled || slides.length >= limit, 'aria-label': tplTr('Дублировать страницу', 'Duplicate slide'), onClick: () => onChange([...slides.slice(0, index + 1), tplClone(slide), ...slides.slice(index + 1)]) }, '⧉'),
                    h('button', { type: 'button', disabled, 'aria-label': tplTr('Удалить страницу', 'Delete slide'), onClick: () => onChange(slides.filter((_, i) => i !== index)) }, '✕')),
                withKicker ? h('label', null, tplTr('Надзаголовок', 'Kicker'), h('input', { value: slide.kicker ?? '', disabled, maxLength: 200, onChange: e => update(index, { kicker: e.target.value }) })) : null,
                h('label', null, tplTr('Заголовок', 'Title'), h('input', { value: slide.title ?? '', disabled, maxLength: 300, onChange: e => update(index, { title: e.target.value }) })),
                slide.layout !== 'bullets' ? h('label', null, tplTr('Подзаголовок', 'Subtitle'), h('input', { value: slide.subtitle ?? '', disabled, maxLength: 500, onChange: e => update(index, { subtitle: e.target.value }) })) : null,
                slide.layout === 'bullets' ? h('label', null, tplTr('Пункты (по одному в строке)', 'Bullets (one per line)'), h('textarea', { rows: 3, value: (slide.bullets ?? []).join('\n'), disabled, onChange: e => update(index, { bullets: e.target.value.split('\n') }) })) : null,
                h('label', null, tplTr('Заметки докладчика', 'Speaker notes'), h('textarea', { rows: 2, value: slide.notes ?? '', disabled, maxLength: 2000, onChange: e => update(index, { notes: e.target.value }) })));
        }),
        h(W.Button, { icon: 'plus', disabled: disabled || slides.length >= limit, onClick: () => onChange([...slides, { layout: 'bullets', title: '', bullets: [''] }]) },
            tplTr('Добавить страницу', 'Add slide') + ' (' + slides.length + '/' + limit + ')'));
}

function TemplateEditor({ templateKey, themes, isAdmin, onClose, onSaved }) {
    const [base, setBase] = React.useState(null);
    const [draft, setDraft] = React.useState(templateKey ? null : tplNewDraft());
    const [images, setImages] = React.useState({});
    const [uploads, setUploads] = React.useState({});
    const [section, setSection] = React.useState('main');
    const [newScope, setNewScope] = React.useState('user');
    const [dirty, setDirty] = React.useState(!templateKey);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState('');
    const [loadError, setLoadError] = React.useState('');
    const [preview, setPreview] = React.useState('');
    const [previewError, setPreviewError] = React.useState('');
    const [copy, setCopy] = React.useState(null); // { id, name } — диалог «Сохранить как копию»
    const previewSeq = React.useRef(0);

    React.useEffect(() => {
        if (!templateKey) return;
        let live = true;
        action({ operation: 'template-get', templateId: templateKey }).then(value => {
            if (!live) return;
            setBase(value.template); setDraft(tplDraftFrom(value.template)); setImages(value.template.assetData ?? {});
        }).catch(e => { if (live) setLoadError(e instanceof Error ? e.message : String(e)); });
        return () => { live = false; };
    }, [templateKey]);

    const existing = Boolean(templateKey);
    const canEdit = base ? base.canEdit : true;
    const saveScope = base ? base.saveScope : newScope;
    const styleProblem = draft ? tplStyleProblem(draft) : '';

    React.useEffect(() => {
        if (!draft) return;
        if (styleProblem) { setPreviewError(styleProblem); return; }
        const seq = ++previewSeq.current;
        const timer = setTimeout(async () => {
            try {
                const value = await action({ operation: 'template-preview', manifest: tplBuild(draft, base), uploads, baseKey: templateKey || undefined, lang: languageOf() });
                if (seq !== previewSeq.current) return;
                setPreview(value.html); setPreviewError('');
            } catch (e) { if (seq === previewSeq.current) setPreviewError(e instanceof Error ? e.message : String(e)); }
        }, 500);
        return () => clearTimeout(timer);
    }, [draft, uploads, styleProblem]);

    if (loadError) return h('div', { className: 'tpe' }, h(W.Status, { tone: 'error' }, loadError), h('div', { className: 'w-toolbar' }, h(W.Button, { icon: 'left', onClick: onClose }, tplTr('К списку шаблонов', 'Back to templates'))));
    if (!draft) return h(W.Status, null, tplTr('Загрузка…', 'Loading…'));

    const set = patch => { setDraft(d => ({ ...d, ...patch })); setDirty(true); setError(''); };
    const setBackground = (type, patch) => set({ backgrounds: { ...draft.backgrounds, [type]: { fit: 'cover', ...draft.backgrounds[type], ...patch } } });
    const palette = themes.find(item => item.id === draft.theme)?.palette ?? {};

    function pickImage(file, prefix, assign) {
        if (!file) return;
        if (!['image/png', 'image/jpeg'].includes(file.type)) { setError(tplTr('Нужен PNG или JPEG', 'Choose a PNG or JPEG image')); return; }
        if (file.size > TPL_MAX_ASSET) { setError(tplTr('Изображение больше 5 MiB', 'The image is larger than 5 MiB')); return; }
        const reader = new FileReader();
        reader.onload = () => {
            const data = String(reader.result ?? ''), name = prefix + (file.type === 'image/png' ? '.png' : '.jpg');
            setUploads(u => ({ ...u, [name]: data })); setImages(i => ({ ...i, [name]: data })); assign(name);
        };
        reader.onerror = () => setError(tplTr('Не удалось прочитать файл', 'Could not read the file'));
        reader.readAsDataURL(file);
    }

    async function save(asCopy) {
        const next = asCopy ? { ...draft, id: asCopy.id, name: asCopy.name } : draft;
        const problem = tplSaveProblem(next, existing && !asCopy);
        if (problem) { setError(problem); return; }
        if (tplAssetBytes(next, images) > TPL_MAX_ASSETS) { setError(tplTr('Изображения шаблона больше 8 MiB в сумме', 'Template images exceed 8 MiB in total')); return; }
        setBusy(true); setError('');
        try {
            const manifest = tplBuild(next, asCopy ? { ...base, author: undefined, revision: undefined, createdAt: undefined } : base);
            const scope = asCopy ? 'user' : saveScope;
            const sameScope = !asCopy && base && base.key.startsWith(scope + ':');
            const value = await action({ operation: 'template-save', manifest, uploads, baseKey: templateKey || undefined, scope, expectedRevision: sameScope ? base.revision : undefined });
            setDirty(false); setCopy(null);
            onSaved(value.key, asCopy ? tplTr('Копия сохранена: ', 'Copy saved: ') + value.key : tplTr('Шаблон сохранён: ', 'Template saved: ') + value.key);
        } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
        finally { setBusy(false); }
    }
    function close() {
        if (dirty && !window.confirm(tplTr('Есть несохранённые изменения. Закрыть редактор?', 'You have unsaved changes. Close the editor?'))) return;
        onClose();
    }
    function download() {
        const url = new URL('api/dsh-ppt/download', document.baseURI);
        url.searchParams.set('kind', 'template'); url.searchParams.set('id', base.key);
        const link = document.createElement('a'); link.href = url.href; link.download = ''; link.hidden = true;
        document.body.append(link); link.click(); link.remove();
    }

    const disabled = busy || !canEdit;
    const sections = [['main', tplTr('Основное', 'General')], ['style', tplTr('Стиль', 'Style')], ['outline', tplTr('Каркас', 'Outline') + ' (' + draft.outline.length + ')'], ['samples', tplTr('Образцы', 'Samples') + ' (' + draft.samples.length + ')']];
    const baseScope = base?.key?.split(':')[0];
    const scopeText = !existing ? '' : baseScope === 'builtin' ? tplTr('Встроенный', 'Built-in') : baseScope === 'public' ? tplTr('Общий', 'Public') : tplTr('Личный', 'Private');

    const main = h('div', null,
        h('label', null, tplTr('Id шаблона (латиница, цифры, дефис)', 'Template id (latin, digits, hyphen)'),
            h('input', { value: draft.id, disabled: existing || busy, maxLength: 49, placeholder: 'my-corp-template', onChange: e => set({ id: e.target.value.trim().toLowerCase() }) })),
        h('label', null, tplTr('Название', 'Name'), h('input', { value: draft.name, disabled, maxLength: 81, onChange: e => set({ name: e.target.value }) })),
        h('label', null, tplTr('Описание', 'Description'), h('textarea', { rows: 3, value: draft.description, disabled, maxLength: 500, onChange: e => set({ description: e.target.value }) })),
        !existing && isAdmin ? h('label', null, tplTr('Где сохранить', 'Save to'),
            h('select', { value: newScope, disabled: busy, onChange: e => setNewScope(e.target.value) },
                h('option', { value: 'user' }, tplTr('Личные', 'My own (private)')), h('option', { value: 'public' }, tplTr('Общие (для всех)', 'Public (for everyone)')))) : null,
        existing && base ? h('p', { className: 'tpe-hint' }, [scopeText, tplTr('ревизия ', 'revision ') + base.revision, base.author, base.updatedAt ? new Date(base.updatedAt).toLocaleString() : ''].filter(Boolean).join(' · ')) : null);

    const style = h('div', null,
        h('label', null, tplTr('Базовая тема', 'Base theme'),
            h('select', { value: draft.theme, disabled, onChange: e => set({ theme: e.target.value }) },
                h('option', { value: '' }, tplTr('— по умолчанию —', '— default —')),
                themes.map(item => h('option', { key: item.id, value: item.id }, item.name + (item.mood ? ' — ' + item.mood : ''))))),
        h(TplColorField, { label: tplTr('Основной цвет (акцент)', 'Primary colour (accent)'), value: draft.primaryColor, fallback: palette.accent, disabled, onChange: value => set({ primaryColor: value }) }),
        h(TplColorField, { label: tplTr('Цвет фона', 'Background colour'), value: draft.backgroundColor, fallback: palette.bg, disabled, onChange: value => set({ backgroundColor: value }) }),
        h(TplColorField, { label: tplTr('Цвет текста', 'Text colour'), value: draft.textColor, fallback: palette.fg, disabled, onChange: value => set({ textColor: value }) }),
        h('label', null, tplTr('Шрифт', 'Font family'),
            h('input', { value: draft.fontFamily, list: 'tpe-fonts', disabled, maxLength: 80, placeholder: tplTr('как в теме', 'theme default'), onChange: e => set({ fontFamily: e.target.value }) }),
            h('datalist', { id: 'tpe-fonts' }, TPL_FONTS.map(font => h('option', { key: font, value: font })))),
        h('label', null, tplTr('Название бренда', 'Brand name'), h('input', { value: draft.brandName, disabled, maxLength: 100, onChange: e => set({ brandName: e.target.value }) })),
        h('label', null, tplTr('Футер', 'Footer'), h('input', { value: draft.footer, disabled, maxLength: 100, onChange: e => set({ footer: e.target.value }) })),
        h(TplImageField, { label: tplTr('Логотип (PNG / JPEG)', 'Logo (PNG / JPEG)'), name: draft.logo, images, disabled, onPick: file => pickImage(file, 'logo', name => set({ logo: name })), onClear: () => set({ logo: '' }) }),
        h('h3', null, tplTr('Фоны по типам страниц', 'Backgrounds by slide type')),
        TPL_BG_TYPES.map(type => h('div', { className: 'tpe-bg', key: type },
            h('h4', null, tplLayoutLabel(type)),
            h(TplImageField, {
                label: tplTr('Изображение фона', 'Background image'), name: draft.backgrounds[type]?.image, images, disabled,
                onPick: file => pickImage(file, 'bg-' + type, name => setBackground(type, { image: name })),
                onClear: () => { const rest = { ...draft.backgrounds }; delete rest[type]; set({ backgrounds: rest }); },
            }, draft.backgrounds[type]?.image ? h('label', null, tplTr('Вписывание', 'Fit'),
                h('select', { value: draft.backgrounds[type].fit || 'cover', disabled, onChange: e => setBackground(type, { fit: e.target.value }) },
                    h('option', { value: 'cover' }, tplTr('Заполнить и обрезать', 'Fill and crop')), h('option', { value: 'contain' }, tplTr('Показать целиком', 'Show whole image')))) : null))));

    return h('div', { className: 'tpe' },
        h('style', null, TPE_CSS),
        h('div', { className: 'w-toolbar' },
            h(W.Button, { icon: 'left', disabled: busy, onClick: close }, tplTr('К списку шаблонов', 'Back to templates')),
            h('strong', null, draft.name || tplTr('Новый шаблон', 'New template')),
            scopeText ? h('span', { className: 'w-tag' }, scopeText) : null,
            dirty ? h('span', { className: 'w-tag' }, tplTr('Не сохранено', 'Unsaved')) : null,
            h('span', { className: 'tpe-grow' }),
            canEdit ? h(W.Button, { variant: 'primary', icon: 'check', disabled: busy || !dirty, onClick: () => save() }, tplTr('Сохранить', 'Save')) : null,
            h(W.Button, { icon: 'copy', disabled: busy, onClick: () => setCopy({ id: '', name: draft.name ? draft.name + (languageOf() === 'ru' ? ' (копия)' : ' (copy)') : '' }) }, tplTr('Сохранить как копию…', 'Save as a copy…')),
            existing && !dirty ? h(W.Button, { icon: 'download', disabled: busy, onClick: download }, tplTr('Экспорт', 'Export')) : null),
        existing && !canEdit ? h(W.Status, null, tplTr('Этот шаблон общий: править его может только администратор. Сохраните копию в личные шаблоны и правьте её.', 'This is a shared template: only an admin can change it. Save a copy into your own templates and edit that.')) : null,
        existing && canEdit && base.overridesBuiltin ? h(W.Status, null, baseScope === 'builtin'
            ? tplTr('Это встроенный шаблон. При сохранении появится общая копия с тем же id, которая заменит встроенный для всех пользователей.', 'This is a built-in template. Saving creates a public copy with the same id that replaces the built-in one for everyone.')
            : tplTr('Общая копия заменяет встроенный шаблон. Чтобы вернуть исходный, удалите её в списке («Сбросить к встроенному»).', 'This public copy replaces the built-in template. Delete it in the list (“Reset to built-in”) to restore the original.')) : null,
        error ? h(W.Status, { tone: 'error' }, error) : null,
        h('div', { className: 'tpe-grid' },
            h('div', { className: 'tpe-form' },
                h('div', { className: 'tpe-nav', role: 'group', 'aria-label': tplTr('Разделы шаблона', 'Template sections') },
                    sections.map(([id, label]) => h(W.Button, { key: id, 'aria-pressed': section === id, onClick: () => setSection(id) }, label))),
                section === 'main' ? main : section === 'style' ? style
                    : section === 'outline' ? h(TplSlideList, { slides: draft.outline, limit: 120, disabled, hint: tplTr('Каркас — страницы-заготовки нового дека. {{deck.title}} подставит название презентации; строки «Заполнить: …» помечают места для ввода, дек остаётся черновиком, пока они не заполнены.', 'The outline is the skeleton of a new deck. {{deck.title}} is replaced with the deck title; “To fill: …” lines mark spots to complete and keep the deck a draft until they are replaced.'), onChange: outline => set({ outline }) })
                        : h(TplSlideList, { slides: draft.samples, limit: 5, disabled, hint: tplTr('Образцы — до 5 готовых страниц с реальным содержанием: показывают, как должен выглядеть заполненный дек.', 'Samples are up to 5 finished slides with real content that show what a completed deck should look like.'), onChange: samples => set({ samples }) })),
            h('div', { className: 'tpe-preview' },
                h('div', { className: 'preview' }, preview
                    ? h('iframe', { title: tplTr('Предпросмотр шаблона', 'Template preview'), sandbox: 'allow-scripts', srcDoc: preview })
                    : h('p', { className: 'tpe-hint', style: { padding: '12px' } }, tplTr('Готовлю предпросмотр…', 'Preparing the preview…'))),
                previewError ? h(W.Status, { tone: 'error' }, previewError) : null,
                h('p', { className: 'tpe-hint' }, tplTr('Предпросмотр показывает тему, цвета, шрифт, логотип, футер и фоны на типовых страницах. Он обновляется при каждой правке и ничего не сохраняет.', 'The preview shows the theme, colours, font, logo, footer and backgrounds on typical slides. It updates as you edit and saves nothing.')))),
        copy ? h(W.Dialog, { title: tplTr('Сохранить как копию', 'Save as a copy'), closeLabel: tplTr('Отмена', 'Cancel'), busy, onClose: () => setCopy(null) },
            h('div', { className: 'ppt-tpl-import' },
                h('p', { className: 'w-muted' }, tplTr('Копия сохранится в ваши личные шаблоны вместе с текущими правками.', 'The copy is saved into your private templates together with the current edits.')),
                h('label', null, tplTr('Id копии (латиница, цифры, дефис)', 'Copy id (latin, digits, hyphen)'), h('input', { value: copy.id, maxLength: 49, placeholder: 'my-corp-template-2', onChange: e => setCopy({ ...copy, id: e.target.value.trim().toLowerCase() }) })),
                h('label', null, tplTr('Название', 'Name'), h('input', { value: copy.name, maxLength: 81, onChange: e => setCopy({ ...copy, name: e.target.value }) })),
                error ? h(W.Status, { tone: 'error' }, error) : null),
            h(W.Button, { variant: 'primary', disabled: busy || !TPL_ID.test(copy.id) || !copy.name.trim(), onClick: () => save(copy) }, tplTr('Сохранить копию', 'Save copy'))) : null);
}
