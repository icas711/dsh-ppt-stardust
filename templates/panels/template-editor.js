// Редактор шаблона: основное, тема, палитра, шрифт, логотип, футер, фоны по типам страниц,
// каркас страниц (outline) и слайды-образцы, живое HTML-превью (операция template-preview).
// Данные — операции template-get / template-save / template-preview сервера (src/workbench.ts).
// Общие имена с client.js избегаем: всё здесь с префиксом tpl / TPE.
const tplTr = (ru, en) => languageOf() === 'ru' ? ru : en;
const TPL_LAYOUTS = ['cover', 'section', 'bullets', 'statement', 'quote', 'closing'];
const TPL_BG_TYPES = ['cover', 'section', 'content', 'closing'];
const TPL_FONTS = ['Arial', 'Calibri', 'Cambria', 'Georgia', 'Helvetica', 'Open Sans', 'Roboto', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'];
const TPL_FONT_VARIANTS = ['regular', 'bold', 'italic', 'boldItalic'];
const tplFontVariantLabel = variant => ({ regular: tplTr('Обычное', 'Regular'), bold: tplTr('Полужирное', 'Bold'), italic: tplTr('Курсив', 'Italic'), boldItalic: tplTr('Полужирный курсив', 'Bold italic') })[variant] ?? variant;
function tplFontFamilies(draft) {
    const families = new Map();
    const add = value => { if (typeof value === 'string' && value.trim()) families.set(value.trim().toLowerCase(), value.trim()); };
    add(draft.fontFamily);
    for (const face of draft.fonts ?? []) add(face.family);
    for (const styles of [draft.textStyles, ...(draft.layouts ?? []).map(layout => layout.textStyles)])
        for (const style of Object.values(styles ?? {})) add(style.fontFamily);
    return [...families.values()];
}
function tplAttachFont(draft, face) {
    return { ...draft, fonts: [...(draft.fonts ?? []).filter(item => item.family.toLowerCase() !== face.family.toLowerCase() || (item.variant ?? 'regular') !== face.variant), { family: face.family, variant: face.variant, file: face.file }] };
}
function TplFontUploads({ draft, disabled, onPick }) {
    const families = tplFontFamilies(draft);
    return h('div', null,
        h('h3', null, tplTr('Файлы шрифтов', 'Font files')),
        h('p', { className: 'tpe-hint' }, tplTr('Загрузите TTF или OTF для нужного семейства и начертания (до 12 MiB на файл, до 32 MiB в библиотеке). Загрузка сразу сохраняет файл в личную библиотеку и обновляет ваши личные и созданные вами общие шаблоны. Презентации, созданные ранее, сохраняют свои шрифты.', 'Upload a TTF or OTF for the family and face (12 MiB per file, 32 MiB per library). Uploading immediately saves it to your library and updates your private templates and public templates authored by you. Previously created presentations retain their fonts.')),
        families.length ? families.map(family => h('div', { className: 'tpe-bg', key: family },
            h('h4', null, family),
            TPL_FONT_VARIANTS.map(variant => {
                const face = (draft.fonts ?? []).find(item => item.family.toLowerCase() === family.toLowerCase() && (item.variant ?? 'regular') === variant);
                const label = family + ' — ' + tplFontVariantLabel(variant);
                return h('label', { key: variant }, tplFontVariantLabel(variant) + ' · ' + (face ? tplTr('Файл добавлен', 'File included') : tplTr('Файл не добавлен', 'No file included')),
                    h('input', { type: 'file', accept: '.ttf,.otf,font/ttf,font/otf', disabled, 'aria-label': label, onChange: e => { const file = e.target.files?.[0]; e.target.value = ''; onPick(file, family, variant); } }));
            }))) : h('p', { className: 'tpe-hint' }, tplTr('Укажите название общего шрифта выше, чтобы загрузить его файл.', 'Enter the default font family above to upload its file.')));
}
// Индикатор занятости: оверлей поверх контейнера с классом tpe-busywrap блокирует клики и показывает спиннер.
const TPL_BUSY_CSS = `.tpe-busywrap{position:relative}
.tpe-busy{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;gap:10px;min-height:56px;background:color-mix(in srgb,var(--w-bg,#fff) 72%,transparent);cursor:progress;border-radius:inherit;font-size:13px}
.tpe-spin{width:18px;height:18px;border-radius:50%;border:2px solid var(--w-border,#ccc);border-top-color:var(--w-accent,#2563eb);animation:tpe-rot .8s linear infinite;flex:none}
@keyframes tpe-rot{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.tpe-spin{animation-duration:2.4s}}`;
function TplBusy({ label }) {
    return h('div', { className: 'tpe-busy', role: 'status', 'aria-live': 'polite' }, h('span', { className: 'tpe-spin', 'aria-hidden': 'true' }), h('span', null, label || tplTr('Выполняется…', 'Working…')));
}
function TplDialog({ busy, busyLabel, children, ...rest }) {
    return h(W.Dialog, { ...rest, busy }, h('div', { className: 'tpe-busywrap' }, h('style', null, TPL_BUSY_CSS), busy ? h(TplBusy, { label: busyLabel }) : null, ...[].concat(children ?? [])));
}
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
.tpe-nums{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:6px 0}
.tpe-num input{width:100%}
.tpe-thumb-sm{max-height:40px;max-width:96px}
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
        schemaVersion:manifest?.schemaVersion,assetMap:tplClone(manifest?.assetMap??{}),
        id: manifest?.id ?? '', name: manifest?.name ?? '', description: manifest?.description ?? '', theme: style.theme ?? '',
        primaryColor: brand.primaryColor ?? '', backgroundColor: brand.backgroundColor ?? '', textColor: brand.textColor ?? '',
        fontFamily: brand.fontFamily ?? '', brandName: brand.name ?? '', footer: brand.footer ?? '', logo: brand.logo ?? '',
        backgrounds, themeFonts: style.themeFonts ? tplClone(style.themeFonts) : undefined, pageSize: style.pageSize ? tplClone(style.pageSize) : undefined, layouts: tplClone(style.layouts ?? []),
        fonts: tplClone(style.fonts ?? []), textStyles: tplClone(style.textStyles ?? {}),
        outline: tplClone(manifest?.outline ?? []), samples: tplClone(manifest?.samples ?? []),
    };
}

const TPL_ROLES = ['logo', 'header', 'decor', 'background', 'photo'];
const tplRoleLabel = role => ({ logo: tplTr('Логотип', 'Logo'), header: tplTr('Шапка / линия', 'Header / rule'), decor: tplTr('Декор', 'Decor'), background: tplTr('Фон-картинка', 'Background picture'), photo: tplTr('Фото', 'Photo') })[role] ?? role;
const tplNum = value => { const n = Number(value); return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 0; };
function tplCleanLayout(layout, index = 0) {
    const out = { id: layout.id, layoutType: layout.layoutType, images: (layout.images ?? []).map((image, index) => {
        const item = { image: image.image, x: tplNum(image.x), y: tplNum(image.y), w: Math.max(0.1, tplNum(image.w)), h: Math.max(0.1, tplNum(image.h)), z: index, fit: image.fit || 'contain' };
        if (image.role) item.role = image.role;
        if (image.svg) item.svg = image.svg;
        return item;
    }) };
    if (layout.familyId) out.familyId = layout.familyId;
    if (layout.name && layout.name.trim()) out.name = layout.name.trim();
    if (layout.textStyles) out.textStyles = tplClone(layout.textStyles);
    if (layout.background?.image) out.background = { image: layout.background.image, fit: layout.background.fit || 'cover' };
    if (layout.backgroundColor) out.backgroundColor = layout.backgroundColor;
    if (layout.textZones !== undefined) out.textZones = DshDeckModel.normalizeTextZones(layout.textZones, `style.layouts[${index}].textZones`);
    return out;
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
    if (draft.schemaVersion === 3) return DshDeckModel.normalizeSceneTemplate({schemaVersion:3,id:draft.id,name:draft.name.trim(),description:draft.description,revision:base?.revision??1,...(base?.author?{author:base.author}:{}),...(base?.createdAt?{createdAt:base.createdAt}:{}),assetMap:draft.assetMap,style:{theme:draft.theme,pageSize:draft.pageSize,...(draft.themeFonts?{themeFonts:tplClone(draft.themeFonts)}:{}),...(draft.fonts?.length?{fonts:tplClone(draft.fonts)}:{}),...(Object.keys(draft.textStyles??{}).length?{textStyles:tplClone(draft.textStyles)}:{}),...(base?.style?.brand?{brand:tplClone(base.style.brand)}:{}),layouts:tplClone(draft.layouts)}});
    const brand = {};
    for (const key of ['primaryColor', 'backgroundColor', 'textColor']) if (draft[key]) brand[key] = draft[key];
    if (draft.fontFamily.trim()) brand.fontFamily = draft.fontFamily.trim();
    if (draft.brandName.trim()) brand.name = draft.brandName.trim();
    if (draft.footer.trim()) brand.footer = draft.footer;
    if (draft.logo) brand.logo = draft.logo;
    const style = {};
    if (draft.themeFonts) style.themeFonts = tplClone(draft.themeFonts);
    if (draft.pageSize) style.pageSize = tplClone(draft.pageSize);
    if (draft.fonts?.length) style.fonts = tplClone(draft.fonts);
    if (Object.keys(draft.textStyles ?? {}).length) style.textStyles = tplClone(draft.textStyles);
    if (draft.theme) style.theme = draft.theme;
    if (Object.keys(brand).length) style.brand = brand;
    const backgrounds = TPL_BG_TYPES.filter(type => draft.backgrounds[type]?.image)
        .map(type => ({ layoutType: type, image: draft.backgrounds[type].image, fit: draft.backgrounds[type].fit || 'cover' }));
    if (backgrounds.length) style.backgrounds = backgrounds;
    if (draft.layouts.length) style.layouts = draft.layouts.map(tplCleanLayout);
    const outline = draft.outline.map(tplCleanSlide), samples = draft.samples.map(tplCleanSlide);
    return {
        schemaVersion: draft.layouts.length ? 2 : 1, id: draft.id, name: draft.name.trim(),
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
    try {
        if (draft.schemaVersion === 3) {tplBuild(draft);return '';}
        for (const [index, layout] of (draft.layouts ?? []).entries()) {
            if (layout.textZones !== undefined) DshDeckModel.normalizeTextZones(layout.textZones, `style.layouts[${index}].textZones`);
        }
    } catch (error) { return error instanceof Error ? error.message : String(error); }
    for (const [key, label] of [['primaryColor', tplTr('Основной цвет', 'Primary colour')], ['backgroundColor', tplTr('Цвет фона', 'Background colour')], ['textColor', tplTr('Цвет текста', 'Text colour')]]) {
        if (draft[key] && !TPL_HEX.test(draft[key])) return label + tplTr(': нужен формат #RRGGBB', ': use the #RRGGBB format');
    }
    const font = draft.fontFamily.trim();
    if (font && (font.length > 128 || !/^[\p{L}\p{N} _().&+\-]+$/u.test(font))) return tplTr('Шрифт: одно название, до 128 символов', 'Font: a single family name, up to 128 characters');
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
    for (const layout of draft.layouts) {
        if (layout.background?.image) names.add(layout.background.image);
        for (const image of layout.images ?? []) { names.add(image.image); if (image.svg) names.add(image.svg); }
    }
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

function TplSlideList({ slides, limit, hint, disabled, onChange, designLayouts = [] }) {
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
                designLayouts.length ? h('label', null, tplTr('Макет оформления', 'Design layout'),
                    h('select', { value: slide.layoutId ?? '', disabled, onChange: e => update(index, { layoutId: e.target.value }) },
                        h('option', { value: '' }, tplTr('— по типу страницы —', '— by slide type —')),
                        designLayouts.map(item => h('option', { key: item.id, value: item.id }, (item.name || item.id))))) : null,
                withKicker ? h('label', null, tplTr('Надзаголовок', 'Kicker'), h('input', { value: slide.kicker ?? '', disabled, maxLength: 200, onChange: e => update(index, { kicker: e.target.value }) })) : null,
                h('label', null, tplTr('Заголовок', 'Title'), h('input', { value: slide.title ?? '', disabled, maxLength: 300, onChange: e => update(index, { title: e.target.value }) })),
                slide.layout !== 'bullets' ? h('label', null, tplTr('Подзаголовок', 'Subtitle'), h('input', { value: slide.subtitle ?? '', disabled, maxLength: 500, onChange: e => update(index, { subtitle: e.target.value }) })) : null,
                slide.layout === 'bullets' ? h('label', null, tplTr('Пункты (по одному в строке)', 'Bullets (one per line)'), h('textarea', { rows: 3, value: (slide.bullets ?? []).join('\n'), disabled, onChange: e => update(index, { bullets: e.target.value.split('\n') }) })) : null,
                h('label', null, tplTr('Заметки докладчика', 'Speaker notes'), h('textarea', { rows: 2, value: slide.notes ?? '', disabled, maxLength: 2000, onChange: e => update(index, { notes: e.target.value }) })));
        }),
        h(W.Button, { icon: 'plus', disabled: disabled || slides.length >= limit, onClick: () => onChange([...slides, { layout: 'bullets', title: '', bullets: [''] }]) },
            tplTr('Добавить страницу', 'Add slide') + ' (' + slides.length + '/' + limit + ')'));
}

function tplFitPreview(html,token) {
    const script='<script>document.fonts.ready.then(()=>{let count=0,checked=0;for(const slide of document.querySelectorAll(".slide")){const before=slide.getAttribute("style");slide.style.setProperty("display","block","important");slide.style.visibility="hidden";for(const frame of slide.querySelectorAll("foreignObject > div")){if(!frame.clientWidth||!frame.clientHeight)continue;checked++;const body=frame.firstElementChild;if(frame.scrollHeight>frame.clientHeight+1||frame.scrollWidth>frame.clientWidth+1||(body&&(body.scrollHeight>frame.clientHeight+1||body.scrollWidth>frame.clientWidth+1)))count++;}if(before===null)slide.removeAttribute("style");else slide.setAttribute("style",before);}parent.postMessage({type:"dsh-template-fit",token:'+token+',count,checked},"*");});</script>';
    return html.replace('</body>',script+'</body>');
}
function TplLayoutsEditor({ draft, images, disabled, set, pickImage, error, sampleLength, onSampleLength,onSceneAsset,onImagePending }) {
    const [index, setIndex] = React.useState(0);
    const [undo, setUndo] = React.useState([]);
    const [editError, setEditError] = React.useState('');
    const [columns,setColumns]=React.useState(2);
    const layouts = draft.layouts, current = layouts[Math.min(index, layouts.length - 1)];
    const at = Math.min(index, Math.max(0, layouts.length - 1));
    const patch = (change) => set({ layouts: layouts.map((layout, i) => i === at ? { ...layout, ...change } : layout) });
    if (draft.schemaVersion === 3) {
      const page=draft.pageSize,description=current?DshDeckModel.reconcileVariantDescription(current,page):null;
      const apply=next=>{setUndo(previous=>[...previous,tplClone(layouts)].slice(-20));set({layouts:next});setEditError('');};
      const change=values=>{const next={...current,...values};next.description=DshDeckModel.reconcileVariantDescription(next,page);apply(layouts.map((l,i)=>i===at?next:l));};
      const describe=values=>change({description:{...description,...values,origin:'user'}});
      const make=mode=>{try{let n=layouts.length+1;while(layouts.some(l=>l.id==='variant-'+n))n++;const next=DshDeckModel.createSceneVariant(current,{id:'variant-'+n,mode,pageSize:page,columns});apply([...layouts,next]);if(next.elements.some(e=>e.assetId===DshDeckModel.VARIANT_PLACEHOLDER.id))onSceneAsset?.(DshDeckModel.VARIANT_PLACEHOLDER.id,DshDeckModel.VARIANT_PLACEHOLDER);setIndex(layouts.length);}catch(e){setEditError(e.message);}};
      const duplicates=DshDeckModel.duplicateVariantIds(layouts,page);
      return h('div',null,
      h('select',{value:at,disabled,onChange:e=>setIndex(Number(e.target.value))},layouts.map((layout,i)=>h('option',{key:layout.id,value:i},(layout.familyId??'')+' / '+layout.name))),
      h('label',null,tplTr('Число колонок для нового варианта','Columns for the new variant'),h('select',{value:columns,disabled,onChange:e=>setColumns(Number(e.target.value))},...[1,2,3,4].map(n=>h('option',{key:n,value:n},n)))),
      h('div',{className:'w-toolbar'},...['duplicate','mirror','columns','image-left','image-right','no-image'].map((mode,i)=>h(W.Button,{key:mode,disabled:disabled||layouts.length>=120||!current,onClick:()=>make(mode)},[tplTr('Копия','Duplicate'),tplTr('Зеркальная перестановка','Mirror areas'),tplTr('Колонки: ','Columns: ')+columns,tplTr('Изображение слева','Image left'),tplTr('Изображение справа','Image right'),tplTr('Без изображения','No image')][i])),h(W.Button,{disabled:disabled||!undo.length,onClick:()=>{set({layouts:undo[undo.length-1]});setUndo(undo.slice(0,-1));setIndex(0);}},tplTr('Отменить изменение варианта','Undo variant edit'))),
      editError?h(W.Status,{tone:'error'},editError):null,
      ...duplicates.map(d=>h('p',{key:d.variantId,role:'status'},tplTr('Одинаковая структура: ','Same structure: ')+d.variantId+' / '+d.duplicateOf)),
      current?h('div',null,
        h('label',null,tplTr('Название варианта','Variant name'),h('input',{value:current.name,disabled,onChange:e=>change({name:e.target.value})})),
        h('label',null,tplTr('Назначение для модели','Purpose for generation'),h('textarea',{value:description.intent,disabled,maxLength:1024,onChange:e=>describe({intent:e.target.value})})),
        ...[['suitableFor',tplTr('Подходящее содержимое — по строке','Suitable content — one per line')],['constraints',tplTr('Ограничения — по строке','Constraints — one per line')]].map(([key,label])=>h('label',{key},label,h('textarea',{value:description[key].join('\n'),disabled,onChange:e=>describe({[key]:e.target.value.split('\n').filter(v=>v.trim())})}))),
        h('label',null,tplTr('Частота','Frequency'),h('select',{value:description.frequency,disabled,onChange:e=>describe({frequency:e.target.value})},...['main','support','accent'].map(v=>h('option',{key:v,value:v},v)))),
        h('p',null,tplTr('Выберите представления, которым соответствует структура областей.','Choose representations supported by the actual slot arrangement.')),
        h('div',null,...DshDeckModel.VISUAL_STRUCTURES.map(v=>h('label',{key:v},h('input',{type:'checkbox',checked:description.structures.includes(v),disabled,onChange:e=>describe({structures:e.target.checked?[...description.structures,v]:description.structures.filter(s=>s!==v)})}),v))),
        ...description.slots.map(s=>h('fieldset',{key:s.slotId},h('legend',null,(current.slots.find(v=>v.id===s.slotId)?.name??s.slotId)+' · '+s.types[0]),
          h('label',null,tplTr('Тип области (образец заменяется, доступно undo)','Slot type (replaces sample; undo available)'),h('select',{value:s.types[0],disabled,onChange:event=>{try{const next=DshDeckModel.changeSceneSlotType(current,s.slotId,event.target.value,page);apply(layouts.map((l,i)=>i===at?next:l));if(event.target.value==='image')onSceneAsset?.(DshDeckModel.VARIANT_PLACEHOLDER.id,DshDeckModel.VARIANT_PLACEHOLDER);}catch(e){setEditError(e.message);}}},...['text','image','chart','table'].map(type=>h('option',{key:type,value:type},type)))),
          h('label',null,tplTr('Смысловая роль','Semantic role'),h('input',{value:s.role,disabled,onChange:e=>describe({slots:description.slots.map(v=>v.slotId===s.slotId?{...v,role:e.target.value,origin:'user'}:v)})})),
          h('label',null,h('input',{type:'checkbox',checked:s.required,disabled,onChange:e=>change({slots:current.slots.map(v=>v.id===s.slotId?{...v,required:e.target.checked}:v)})}),tplTr('Обязательная область','Required slot')),
          ...({text:['characters','items'],chart:['categories','series'],table:['rows','columns'],image:[]}[s.types[0]]).map(key=>h('label',{key},tplTr('Лимит: ','Limit: ')+key,h('input',{type:'number',min:1,max:262144,disabled,value:s.capacity?.[key]??'',onChange:e=>{const capacity={...s.capacity};if(e.target.value==='')delete capacity[key];else capacity[key]=Number(e.target.value);describe({slots:description.slots.map(v=>v.slotId===s.slotId?{...v,capacity,origin:'user'}:v)});}}))),
          s.estimate?.characters?h('p',null,tplTr('Оценка символов (не гарантия вписывания): ','Estimated characters (not a fit guarantee): ')+s.estimate.characters):null)),
        h('label',null,tplTr('Образец предпросмотра','Preview sample'),h('select',{value:sampleLength??'short',onChange:e=>onSampleLength?.(e.target.value)},h('option',{value:'short'},tplTr('Короткий заголовок, 2 пункта','Short title, 2 items')),h('option',{value:'long'},tplTr('Длинный заголовок, 6 пунктов','Long title, 6 items'))))):null,
      current?h(PptSceneObjects,{key:current.id,elements:current.elements,assets:Object.fromEntries(Object.entries(draft.assetMap??{}).map(([id,a])=>[id,{...a,data:images?.[a.file]}])),disabled,onPending:onImagePending,onError:setEditError,onAsset:onSceneAsset?((elementId,assetId,asset)=>{change({elements:current.elements.map(e=>e.id===elementId?{...e,assetId,alt:''}:e)});onSceneAsset(assetId,asset);}):undefined,onChange:elements=>{
        const slots=elements.filter(e=>e.role!=='decor'&&['text','image','chart','table'].includes(e.type)).map(e=>current.slots.find(s=>s.elementId===e.id)??{id:'slot-'+e.id,elementId:e.id,type:e.type,name:e.name??e.id,required:true});
        elements=elements.map(e=>{const copy={...e},slot=slots.find(s=>s.elementId===e.id);if(slot)copy.slotId=slot.id;else delete copy.slotId;return copy});
        change({elements,slots});
      }}):null);
    }
    const patchImage = (i, change) => patch({ images: current.images.map((image, k) => k === i ? { ...image, ...change } : image) });
    const uid = () => Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
    const add = () => {
        let n = layouts.length + 1; while (layouts.some(item => item.id === 'layout-' + n)) n++;
        set({ layouts: [...layouts, { id: 'layout-' + n, name: tplTr('Новый макет', 'New layout') + ' ' + n, layoutType: 'content', images: [] }] });
        setIndex(layouts.length);
    };
    const numberField = (image, i, key, label) => h('label', { key, className: 'tpe-num' }, label,
        h('input', { type: 'number', step: 0.1, value: image[key], disabled, onChange: e => patchImage(i, { [key]: e.target.value === '' ? '' : Number(e.target.value) }) }));
    return h('div', null,
        h('p', { className: 'tpe-hint' }, tplTr('Макет — фон и картинки с положением в процентах слайда (x, y — левый верхний угол; w, h — размер). Слайды каркаса выбирают макет, иначе берётся первый макет нужного типа страницы.', 'A layout is a background plus images positioned in percent of the slide (x, y = top-left corner; w, h = size). Outline slides pick a layout, otherwise the first layout of the matching slide type is used.')),
        h('div', { className: 'w-toolbar' },
            layouts.length ? h('select', { value: at, onChange: e => setIndex(Number(e.target.value)), 'aria-label': tplTr('Макет', 'Layout') },
                layouts.map((layout, i) => h('option', { key: layout.id, value: i }, (layout.familyId ? tplTr('Группа ', 'Group ') + layout.familyId.replace(/^family-/, '') + ' / ' : '') + (layout.name || layout.id) + ' · ' + tplLayoutLabel(layout.layoutType)))) : null,
            h(W.Button, { icon: 'plus', disabled: disabled || layouts.length >= 120, onClick: add }, tplTr('Макет', 'Layout')),
            current ? h(W.Button, { icon: 'trash', variant: 'danger', disabled, onClick: () => { set({ layouts: layouts.filter((_, i) => i !== at), outline: draft.outline.map(slide => slide.layoutId === current.id ? { ...slide, layoutId: '' } : slide), samples: draft.samples.map(slide => slide.layoutId === current.id ? { ...slide, layoutId: '' } : slide) }); setIndex(0); } }, tplTr('Удалить', 'Delete')) : null),
        !current ? h('p', { className: 'tpe-hint' }, tplTr('Макетов нет: действуют фоны по типам страниц и логотип. Добавьте макет или создайте шаблон из PPTX.', 'No layouts: per-type backgrounds and the logo apply. Add a layout or create the template from a PPTX.'))
            : h('div', { key: current.id },
                h('label', null, tplTr('Название макета', 'Layout name'), h('input', { value: current.name ?? '', disabled, maxLength: 80, onChange: e => patch({ name: e.target.value }) })),
                h('label', null, tplTr('Тип страницы', 'Slide type'),
                    h('select', { value: current.layoutType, disabled, onChange: e => patch({ layoutType: e.target.value }) }, TPL_BG_TYPES.map(type => h('option', { key: type, value: type }, tplLayoutLabel(type))))),
                h(TplColorField, { label: tplTr('Цвет фона макета', 'Layout background colour'), value: current.backgroundColor ?? '', fallback: '#ffffff', disabled, onChange: value => patch({ backgroundColor: value }) }),
                h(TplImageField, { label: tplTr('Фон-картинка', 'Background image'), name: current.background?.image, images, disabled,
                    onPick: file => pickImage(file, 'lay-' + current.id + '-bg-' + uid(), name => patch({ background: { image: name, fit: current.background?.fit || 'cover' } })),
                    onClear: () => patch({ background: undefined }) },
                    current.background?.image ? h('label', null, tplTr('Вписывание', 'Fit'), h('select', { value: current.background.fit || 'cover', disabled, onChange: e => patch({ background: { ...current.background, fit: e.target.value } }) },
                        h('option', { value: 'cover' }, tplTr('Заполнить и обрезать', 'Fill and crop')), h('option', { value: 'contain' }, tplTr('Показать целиком', 'Show whole image')))) : null),
                h('h3', null, tplTr('Области контента', 'Content areas')),
                h('p', { className: 'tpe-hint' }, tplTr('Каждая область сохраняет своё положение. Варианты с несколькими колонками можно редактировать по отдельным областям.', 'Each area keeps its position. Edit each column separately in multi-column variants.')),
                current.textZones?.length ? h('div', null,
                    ...current.textZones.map((zone, zi) => h('div', { key: zi },
                        h('label', null, tplTr('Область ', 'Area ') + (zi + 1), h('select', { value: zone.kind, disabled, onChange: e => patch({ textZones: current.textZones.map((z, k) => k === zi ? { ...z, kind: e.target.value } : z) }) },
                            ['title', 'body', 'image'].map(kind => h('option', { key: kind, value: kind }, ({ title: tplTr('Заголовок', 'Title'), body: tplTr('Текст', 'Text'), image: tplTr('Изображение', 'Image') })[kind])))),
                        h('div', { className: 'tpe-nums' }, ['x', 'y', 'w', 'h'].map(key => h('label', { key, className: 'tpe-num' }, key + ' %',
                            h('input', { type: 'number', step: 0.5, disabled, value: zone[key], onChange: e => patch({ textZones: current.textZones.map((z, k) => k === zi ? { ...z, [key]: e.target.value === '' ? '' : Number(e.target.value) } : z) }) })))))),
                    h(W.Button, { disabled, onClick: () => patch({ textZones: undefined }) }, tplTr('Типовая вёрстка', 'Default layout')))
                    : h(W.Button, { disabled, onClick: () => patch({ textZones: [{ kind: 'body', x: 6, y: 25, w: 88, h: 68 }] }) }, tplTr('Задать область текста', 'Set text area')),
                h('h3', null, tplTr('Картинки макета', 'Layout images') + ' (' + (current.images?.length ?? 0) + '/12)'),
                (current.images ?? []).map((image, i) => h('div', { className: 'tpe-bg tpe-limg', key: i + ':' + image.image },
                    h('div', { className: 'tpe-slide-head' },
                        images[image.svg] || images[image.image] ? h('img', { className: 'tpe-thumb tpe-thumb-sm', src: images[image.svg] || images[image.image], alt: '' }) : null,
                        h('select', { value: image.role ?? 'decor', disabled, 'aria-label': tplTr('Роль', 'Role'), onChange: e => patchImage(i, { role: e.target.value }) }, TPL_ROLES.map(role => h('option', { key: role, value: role }, tplRoleLabel(role)))),
                        h('span', { className: 'tpe-grow' }),
                        h('button', { type: 'button', disabled: disabled || i === 0, 'aria-label': tplTr('Ниже по слоям', 'Send backward'), title: tplTr('Ниже по слоям', 'Send backward'), onClick: () => { const next = current.images.slice(); [next[i - 1], next[i]] = [next[i], next[i - 1]]; patch({ images: next }); } }, '↓'),
                        h('button', { type: 'button', disabled: disabled || i === current.images.length - 1, 'aria-label': tplTr('Выше по слоям', 'Bring forward'), title: tplTr('Выше по слоям', 'Bring forward'), onClick: () => { const next = current.images.slice(); [next[i + 1], next[i]] = [next[i], next[i + 1]]; patch({ images: next }); } }, '↑'),
                        h('button', { type: 'button', disabled, 'aria-label': tplTr('Удалить картинку', 'Delete image'), onClick: () => patch({ images: current.images.filter((_, k) => k !== i) }) }, '✕')),
                    h('div', { className: 'tpe-nums' }, numberField(image, i, 'x', 'x %'), numberField(image, i, 'y', 'y %'), numberField(image, i, 'w', tplTr('шир. %', 'w %')), numberField(image, i, 'h', tplTr('выс. %', 'h %'))),
                    h('label', null, tplTr('Вписывание', 'Fit'), h('select', { value: image.fit || 'contain', disabled, onChange: e => patchImage(i, { fit: e.target.value }) },
                        h('option', { value: 'contain' }, tplTr('Целиком, сохранить пропорции', 'Whole, keep ratio')), h('option', { value: 'cover' }, tplTr('Заполнить и обрезать', 'Fill and crop')), h('option', { value: 'fill' }, tplTr('Растянуть по рамке', 'Stretch to the box')))),
                    h('label', null, tplTr('Заменить файл (PNG / JPEG)', 'Replace file (PNG / JPEG)'),
                        h('input', { type: 'file', accept: 'image/png,image/jpeg', disabled, onChange: e => { const file = e.target.files?.[0]; e.target.value = ''; pickImage(file, 'lay-' + current.id + '-' + uid(), name => patchImage(i, { image: name, svg: undefined })); } })),
                    image.svg ? h('p', { className: 'tpe-hint' }, tplTr('Есть векторная версия (SVG): в HTML показывается она, в PPTX — PNG.', 'A vector (SVG) version exists: used in HTML; PPTX gets the PNG.')) : null)),
                h('label', null, tplTr('Добавить картинку (PNG / JPEG)', 'Add image (PNG / JPEG)'),
                    h('input', { type: 'file', accept: 'image/png,image/jpeg', disabled: disabled || (current.images?.length ?? 0) >= 12, onChange: e => { const file = e.target.files?.[0]; e.target.value = ''; pickImage(file, 'lay-' + current.id + '-' + uid(), name => patch({ images: [...(current.images ?? []), { image: name, x: 5, y: 5, w: 20, h: 12, z: current.images?.length ?? 0, fit: 'contain', role: 'decor' }] })); } }))));
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
    const [fontMessage, setFontMessage] = React.useState('');
    const [loadError, setLoadError] = React.useState('');
    const [preview, setPreview] = React.useState('');
    const [previewError, setPreviewError] = React.useState('');
    const [sampleLength,setSampleLength]=React.useState('short');
    const [previewWarnings,setPreviewWarnings]=React.useState([]);
    const [measuredFit,setMeasuredFit]=React.useState(null);
    const previewFrame=React.useRef(null);
    const [previewBusy, setPreviewBusy] = React.useState(false);
    const [copy, setCopy] = React.useState(null); // { id, name } — диалог «Сохранить как копию»
    const previewSeq = React.useRef(0);
    React.useEffect(()=>{const listener=event=>{const data=event.data;if(event.source!==previewFrame.current?.contentWindow||data?.type!=='dsh-template-fit'||data.token!==previewSeq.current||!Number.isInteger(data.count)||!Number.isInteger(data.checked)||data.count<0||data.count>data.checked||data.checked>32768)return;setMeasuredFit({count:data.count,checked:data.checked});};window.addEventListener('message',listener);return()=>window.removeEventListener('message',listener);},[]);

    React.useEffect(() => {
        if (!templateKey) return;
        let live = true;
        action({ operation: 'template-get', templateId: templateKey }).then(value => {
            if (!live) return;
            setBase(value.template); setDraft(tplDraftFrom(value.template)); setImages(Object.fromEntries(Object.entries(value.template.assetData ?? {}).filter(([, data]) => data.startsWith('data:image/'))));
            setUploads(value.template.libraryUploads ?? {});
            if (value.template.libraryFontsAdded && value.template.canEdit) {
                setDirty(true);
                setFontMessage(tplTr('Недостающие шрифты добавлены из личной библиотеки. Сохраните шаблон.', 'Missing fonts were added from your library. Save the template.'));
            }
        }).catch(e => { if (live) setLoadError(e instanceof Error ? e.message : String(e)); });
        return () => { live = false; };
    }, [templateKey]);

    const existing = Boolean(templateKey);
    const canEdit = base ? base.canEdit : true;
    const saveScope = base ? base.saveScope : newScope;
    const styleProblem = draft ? tplStyleProblem(draft) : '';

    React.useEffect(() => {
        if (!draft) return;
        if (styleProblem) { setPreviewError(styleProblem); setPreviewBusy(false); return; }
        const seq = ++previewSeq.current;
        setMeasuredFit(null);
        setPreviewBusy(true);
        const timer = setTimeout(async () => {
            try {
                const value = await action({ operation: 'template-preview', manifest: tplBuild(draft, base), uploads, baseKey: templateKey || undefined, lang: languageOf(),sampleLength });
                if (seq !== previewSeq.current) return;
                setPreview(tplFitPreview(value.html,seq)); setPreviewError('');setPreviewWarnings(value.quality?.issues??[]);
            } catch (e) { if (seq === previewSeq.current) setPreviewError(e instanceof Error ? e.message : String(e)); }
            finally { if (seq === previewSeq.current) setPreviewBusy(false); }
        }, 500);
        return () => clearTimeout(timer);
    }, [draft, uploads, styleProblem,sampleLength]);

    if (loadError) return h('div', { className: 'tpe' }, h(W.Status, { tone: 'error' }, loadError), h('div', { className: 'w-toolbar' }, h(W.Button, { icon: 'left', onClick: onClose }, tplTr('К списку шаблонов', 'Back to templates'))));
    if (!draft) return h('div', { className: 'tpe-busywrap', style: { minHeight: '140px' } }, h('style', null, TPL_BUSY_CSS), h(TplBusy, { label: tplTr('Загружаю шаблон…', 'Loading the template…') }));

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
    function attachSceneAsset(id,asset){const file=id+(asset.mime==='image/png'?'.png':'.jpg');setUploads(previous=>({...previous,[file]:asset.data}));setImages(previous=>({...previous,[file]:asset.data}));setDraft(previous=>({...previous,assetMap:{...previous.assetMap,[id]:{file,mime:asset.mime,width:asset.width,height:asset.height}}}));setDirty(true);}

    async function pickFont(file, family, variant) {
        if (!file) return;
        if (!/\.(ttf|otf)$/i.test(file.name)) { setError(tplTr('Нужен файл TTF или OTF', 'Choose a TTF or OTF file')); return; }
        if (!file.size || file.size > 12 * 1024 * 1024) { setError(tplTr('Файл шрифта пуст или больше 12 MiB', 'The font file is empty or larger than 12 MiB')); return; }
        setBusy(true); setError(''); setFontMessage('');
        try {
            const bytes = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result ?? '').split(',')[1]);
                reader.onerror = () => reject(new Error(tplTr('Не удалось прочитать файл', 'Could not read the file')));
                reader.readAsDataURL(file);
            });
            const mime = /\.otf$/i.test(file.name) ? 'font/otf' : 'font/ttf';
            const value = await action({ operation: 'template-font-upload', family, variant, data: 'data:' + mime + ';base64,' + bytes });
            const face = value.font;
            setUploads(previous => {
                const next = { ...previous, [face.file]: face.data };
                const wanted = new Set(tplAttachFont(draft, face).fonts.map(item => item.file));
                for (const name of Object.keys(next)) if (/\.(ttf|otf|fntdata)$/i.test(name) && !wanted.has(name)) delete next[name];
                return next;
            });
            setDraft(previous => tplAttachFont(previous, face)); setDirty(true);
            const updated = (value.updated ?? []).find(item => item.key === base?.key);
            if (updated) setBase(previous => previous?.revision === updated.previousRevision ? { ...previous, revision: updated.revision } : previous);
            setFontMessage([tplTr('Шрифт сохранён. Обновлено шаблонов: ', 'Font saved. Templates updated: ') + (value.updated?.length ?? 0), ...(face.warnings ?? [])].join(' '));
        } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
        finally { setBusy(false); }
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
    const sections = [['main', tplTr('Основное', 'General')], ['style', draft.schemaVersion===3?tplTr('Шрифты','Fonts'):tplTr('Стиль', 'Style')], ['layouts', tplTr('Макеты', 'Layouts') + ' (' + draft.layouts.length + ')'], ['outline', tplTr('Каркас', 'Outline') + ' (' + draft.outline.length + ')'], ['samples', tplTr('Образцы', 'Samples') + ' (' + draft.samples.length + ')']].filter(([id])=>draft.schemaVersion!==3||!['outline','samples'].includes(id));
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
        h('label', null, tplTr('Общий шрифт (для ролей без своего шрифта)', 'Default font (for roles without their own font)'),
            h('input', { value: draft.fontFamily, list: 'tpe-fonts', disabled, maxLength: 128, placeholder: tplTr('как в теме', 'theme default'), onChange: e => set({ fontFamily: e.target.value }) }),
            h('datalist', { id: 'tpe-fonts' }, TPL_FONTS.map(font => h('option', { key: font, value: font })))),
        draft.fonts?.length ? h('p', { className: 'tpe-hint' }, tplTr('Встроенных начертаний: ', 'Embedded font faces: ') + draft.fonts.length) : null,
        h(TplFontUploads, { draft, disabled, onPick: pickFont }),
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

    return h('div', { className: 'tpe tpe-busywrap' },
        h('style', null, TPE_CSS),
        h('style', null, TPL_BUSY_CSS),
        busy ? h(TplBusy, { label: tplTr('Сохраняю…', 'Saving…') }) : null,
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
        fontMessage ? h(W.Status, { role: 'status' }, fontMessage) : null,
        h('div', { className: 'tpe-grid' },
            h('div', { className: 'tpe-form' },
                h('div', { className: 'tpe-nav', role: 'group', 'aria-label': tplTr('Разделы шаблона', 'Template sections') },
                    sections.map(([id, label]) => h(W.Button, { key: id, 'aria-pressed': section === id, onClick: () => setSection(id) }, label))),
                section === 'main' ? main : section === 'style' ? (draft.schemaVersion===3?h('div',null,h('p',null,tplTr('Оформление объектов изменяйте в разделе «Макеты».','Edit object formatting under Layouts.')),h(TplFontUploads,{draft,disabled,onPick:pickFont})):style)
                    : section === 'layouts' ? h(TplLayoutsEditor, { draft, images, disabled, set, pickImage,sampleLength,onSampleLength:setSampleLength,onSceneAsset:attachSceneAsset,onImagePending:setBusy })
                    : section === 'outline' ? h(TplSlideList, { designLayouts: draft.layouts, slides: draft.outline, limit: 120, disabled, hint: tplTr('Каркас — страницы-заготовки нового дека. {{deck.title}} подставит название презентации; строки «Заполнить: …» помечают места для ввода, дек остаётся черновиком, пока они не заполнены.', 'The outline is the skeleton of a new deck. {{deck.title}} is replaced with the deck title; “To fill: …” lines mark spots to complete and keep the deck a draft until they are replaced.'), onChange: outline => set({ outline }) })
                        : h(TplSlideList, { designLayouts: draft.layouts, slides: draft.samples, limit: 5, disabled, hint: tplTr('Образцы — до 5 готовых страниц с реальным содержанием: показывают, как должен выглядеть заполненный дек.', 'Samples are up to 5 finished slides with real content that show what a completed deck should look like.'), onChange: samples => set({ samples }) })),
            h('div', { className: 'tpe-preview' },
                h('div', { className: 'preview tpe-busywrap' }, previewBusy ? h(TplBusy, { label: tplTr('Обновляю предпросмотр…', 'Refreshing the preview…') }) : null, preview
                    ? h('iframe', { ref:previewFrame,title: tplTr('Предпросмотр шаблона', 'Template preview'), sandbox: 'allow-scripts', srcDoc: preview })
                    : previewError ? null : h('p', { className: 'tpe-hint', style: { padding: '12px', minHeight: '80px' } }, tplTr('Готовлю предпросмотр…', 'Preparing the preview…'))),
                previewError ? h(W.Status, { tone: 'error' }, previewError) : null,
                ...previewWarnings.map((issue,i)=>h('p',{key:'fit-'+i,role:'status'},tplTr('Проверка образца (оценка): ','Sample check (estimate): ')+(issue.message??issue.code))),
                measuredFit?h('p',{role:'status'},tplTr('Измерено в HTML: областей ','Measured in HTML: areas ')+measuredFit.checked+tplTr(', с переполнением ', ', overflowing ')+measuredFit.count+tplTr('. Финальный PPTX проверяется отдельно.','. Review the final PPTX separately.')):null,
                h('p', { className: 'tpe-hint' }, tplTr('Предпросмотр показывает тему, цвета, шрифт, логотип, футер и фоны на типовых страницах. Он обновляется при каждой правке и ничего не сохраняет.', 'The preview shows the theme, colours, font, logo, footer and backgrounds on typical slides. It updates as you edit and saves nothing.')))),
        copy ? h(TplDialog, { busyLabel: tplTr('Сохраняю копию…', 'Saving the copy…'), title: tplTr('Сохранить как копию', 'Save as a copy'), closeLabel: tplTr('Отмена', 'Cancel'), busy, onClose: () => setCopy(null) },
            h('div', { className: 'ppt-tpl-import' },
                h('p', { className: 'w-muted' }, tplTr('Копия сохранится в ваши личные шаблоны вместе с текущими правками.', 'The copy is saved into your private templates together with the current edits.')),
                h('label', null, tplTr('Id копии (латиница, цифры, дефис)', 'Copy id (latin, digits, hyphen)'), h('input', { value: copy.id, maxLength: 49, placeholder: 'my-corp-template-2', onChange: e => setCopy({ ...copy, id: e.target.value.trim().toLowerCase() }) })),
                h('label', null, tplTr('Название', 'Name'), h('input', { value: copy.name, maxLength: 81, onChange: e => setCopy({ ...copy, name: e.target.value }) })),
                error ? h(W.Status, { tone: 'error' }, error) : null),
            h(W.Button, { variant: 'primary', disabled: busy || !TPL_ID.test(copy.id) || !copy.name.trim(), onClick: () => save(copy) }, tplTr('Сохранить копию', 'Save copy'))) : null);
}
