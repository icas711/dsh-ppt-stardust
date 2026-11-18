// Библиотека шаблонов внутри «Презентаций» (переключатель «Проекты | Шаблоны»):
// карточки builtin/public/user, импорт и экспорт bundle, создание деки из шаблона,
// шаблон из проекта, дублирование, публикация/удаление и редактор (template-editor.js).
// Данные — операции template-* сервера (src/workbench.ts) и download?kind=template.
const TEMPLATES_CSS = `
.ppt-templates{display:flex;flex-direction:column;gap:14px;min-width:0}
.ppt-templates-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.ppt-template-card{display:flex;flex-direction:column;gap:8px;border:1px solid var(--w-border);border-radius:10px;padding:14px;min-width:0;background:var(--w-bg)}
.ppt-template-card .tpl-swatch{display:flex;gap:6px;align-items:center}
.ppt-template-card .tpl-swatch i{width:22px;height:22px;border-radius:6px;border:1px solid var(--w-border);display:inline-block}
.ppt-template-card h3{margin:0;font-size:15px}
.ppt-template-card .tpl-meta{font-size:12px;color:var(--w-muted);display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.ppt-template-card .tpl-outline{font-size:12px;color:var(--w-muted);margin:0}
.ppt-template-card .tpl-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}
.ppt-tpl-import{display:flex;flex-direction:column;gap:10px}
.ppt-restyle-summary{display:flex;flex-direction:column;gap:10px}
.ppt-restyle-summary .swatch{display:flex;gap:6px}
.ppt-restyle-summary .swatch i{width:20px;height:20px;border-radius:5px;border:1px solid var(--w-border)}
`;
function TemplatesPanel({ onCreated }) {
    const [templates, setTemplates] = React.useState(null);
    const [themes, setThemes] = React.useState([]);
    const [isAdmin, setIsAdmin] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [message, setMessage] = React.useState('');
    const [error, setError] = React.useState('');
    const [editing, setEditing] = React.useState(null); // { key: string | null, nonce: number }
    const [applyId, setApplyId] = React.useState(null);
    const [applyTitle, setApplyTitle] = React.useState('');
    const [importOpen, setImportOpen] = React.useState(false);
    const [importScope, setImportScope] = React.useState('user');
    const [fromOpen, setFromOpen] = React.useState(false);
    const [fromProject, setFromProject] = React.useState('');
    const [projects, setProjects] = React.useState(null);
    const [pptxOpen, setPptxOpen] = React.useState(false);
    const [pptxFile, setPptxFile] = React.useState(null);
    const [pptxId, setPptxId] = React.useState('');
    const [pptxName, setPptxName] = React.useState('');
    const [pptxScope, setPptxScope] = React.useState('user');
    const [pptxResult, setPptxResult] = React.useState(null); // { key, report }
    const [copyOf, setCopyOf] = React.useState(null); // ключ шаблона для «Дублировать»
    const [copyId, setCopyId] = React.useState('');
    const [copyName, setCopyName] = React.useState('');
    const [newId, setNewId] = React.useState('');
    const [newName, setNewName] = React.useState('');
    React.useEffect(() => { void refresh(); }, []);
    React.useEffect(() => {
        if (!fromOpen || projects !== null) return;
        action({ operation: 'list' }).then(v => setProjects(v.projects ?? [])).catch(e => setError(e instanceof Error ? e.message : String(e)));
    }, [fromOpen, projects]);
    async function refresh() {
        try {
            setError('');
            const value = await action({ operation: 'template-list', lang: languageOf() });
            setTemplates(value.templates ?? []);
            setThemes(value.themes ?? []);
            setIsAdmin(value.admin === true);
        }
        catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    }
    async function run(body, doneText) {
        setBusy(true);
        setMessage('');
        setError('');
        try {
            const value = await action(body);
            setMessage(doneText ?? tplTr('Готово', 'Done'));
            await refresh();
            return value;
        }
        catch (e) { setError(e instanceof Error ? e.message : String(e)); return null; }
        finally { setBusy(false); }
    }
    function downloadBundle(tpl) {
        const url = new URL('api/dsh-ppt/download', document.baseURI);
        url.searchParams.set('kind', 'template');
        url.searchParams.set('id', tpl.key ?? (tpl.scope + ':' + tpl.id));
        const link = document.createElement('a');
        link.href = url.href;
        link.download = '';
        link.hidden = true;
        document.body.append(link);
        link.click();
        link.remove();
        setMessage(tplTr('Скачивание запрошено, проверьте загрузки браузера.', 'Download requested. Check your browser’s downloads.'));
    }
    async function uploadPptx() {
        if (!pptxFile) return;
        setBusy(true); setError(''); setMessage('');
        try {
            const url = new URL('api/dsh-ppt/template-upload', document.baseURI);
            url.searchParams.set('templateId', pptxId);
            url.searchParams.set('name', pptxName.trim());
            url.searchParams.set('scope', pptxScope);
            url.searchParams.set('lang', languageOf());
            const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/octet-stream', 'x-dsh-ppt-action': '1' }, body: pptxFile });
            let value;
            try { value = await response.json(); } catch { throw new Error(tplTr('Не удалось прочитать ответ сервера', 'Could not read the server response')); }
            if (!response.ok || value.ok === false) throw new Error(value.messageEn && languageOf() !== 'ru' ? value.messageEn : (value.message || 'HTTP ' + response.status));
            setPptxResult({ key: value.key, report: value.report ?? {} });
            await refresh();
        }
        catch (e) { setError(e instanceof Error ? e.message : String(e)); }
        finally { setBusy(false); }
    }
    function importFile(file) {
        if (!file) return;
        if (file.size > 9 * 1024 * 1024) { setError(tplTr('Файл больше 9 MiB', 'File exceeds 9 MiB')); return; }
        const reader = new FileReader();
        reader.onload = async () => {
            const data = String(reader.result ?? '').split(',')[1] ?? '';
            setImportOpen(false);
            const saved = await run({ operation: 'template-import', data, scope: importScope });
            if (saved) setMessage(tplTr('Шаблон импортирован: ', 'Template imported: ') + saved.key);
        };
        reader.readAsDataURL(file);
    }
    const scopeLabel = scope => scope === 'builtin' ? tplTr('Встроенный', 'Built-in') : scope === 'public' ? tplTr('Общий', 'Public') : tplTr('Личный', 'Private');

    if (editing) {
        return h('div', { className: 'ppt-templates' },
            h(W.Status, { tone: 'success' }, message),
            h(TemplateEditor, {
                key: (editing.key ?? 'new') + ':' + editing.nonce, templateKey: editing.key, themes, isAdmin,
                onClose: () => { setEditing(null); void refresh(); },
                onSaved: (key, text) => { setMessage(text); setEditing({ key, nonce: editing.nonce + 1 }); void refresh(); },
            }));
    }

    const cards = (templates ?? []).map(tpl => {
        const swatches = [tpl.brand?.primaryColor, tpl.brand?.backgroundColor, tpl.brand?.textColor].filter(Boolean);
        const key = tpl.key ?? (tpl.scope + ':' + tpl.id);
        const canEdit = tpl.scope === 'user' || isAdmin;
        const canDelete = tpl.scope === 'user' || (tpl.scope === 'public' && isAdmin);
        return h('div', { className: 'ppt-template-card', key },
            h('div', { className: 'tpl-swatch' }, swatches.map((color, i) => h('i', { key: i, style: { background: color } }))),
            h('h3', null, tpl.name),
            h('div', { className: 'tpl-meta' },
                h('span', { className: 'w-tag' }, scopeLabel(tpl.scope)),
                tpl.overridesBuiltin ? h('span', { className: 'w-tag' }, tplTr('заменяет встроенный', 'overrides built-in')) : null,
                tpl.theme ? h('span', null, tplTr('тема ', 'theme ') + tpl.theme) : null,
                tpl.outlineCount ? h('span', null, tplTr('каркас ', 'outline ') + tpl.outlineCount) : null,
                tpl.author ? h('span', null, tpl.author) : null),
            tpl.description ? h('p', { className: 'tpl-outline' }, tpl.description) :
                (tpl.outlineTitles?.length ? h('p', { className: 'tpl-outline' }, tpl.outlineTitles.join(' → ')) : null),
            h('div', { className: 'tpl-actions' },
                h(W.Button, { variant: 'primary', disabled: busy, onClick: () => { setApplyId(key); setApplyTitle(''); } }, tplTr('Создать дек', 'New deck')),
                h(W.Button, { icon: 'edit', disabled: busy, onClick: () => setEditing({ key, nonce: 0 }) }, canEdit ? tplTr('Править', 'Edit') : tplTr('Открыть', 'Open')),
                h(W.Button, { icon: 'copy', disabled: busy, onClick: () => { setCopyOf(key); setCopyId(''); setCopyName(tpl.name + (languageOf() === 'ru' ? ' (копия)' : ' (copy)')); } }, tplTr('Дублировать', 'Duplicate')),
                h(W.Button, { icon: 'download', disabled: busy, onClick: () => downloadBundle(tpl) }, tplTr('Экспорт', 'Export')),
                tpl.scope === 'user' && isAdmin ? h(W.Button, { disabled: busy, onClick: () => run({ operation: 'template-publish', templateId: key, owner: tpl.author }, tplTr('Шаблон опубликован в общие', 'Template published')) }, tplTr('Опубликовать', 'Publish')) : null,
                tpl.overridesBuiltin && isAdmin ? h(W.Button, { disabled: busy, onClick: async () => {
                    if (!window.confirm(tplTr('Удалить общую копию и вернуть встроенный шаблон?', 'Delete the public copy and restore the built-in template?'))) return;
                    await run({ operation: 'template-delete', templateId: key }, tplTr('Встроенный шаблон восстановлен', 'Built-in template restored'));
                } }, tplTr('Сбросить к встроенному', 'Reset to built-in')) : null,
                canDelete && !tpl.overridesBuiltin ? h(W.Button, { icon: 'trash', variant: 'danger', disabled: busy, onClick: async () => {
                    if (!window.confirm(tplTr('Удалить шаблон «', 'Delete template “') + tpl.name + tplTr('»?', '”?'))) return;
                    await run({ operation: 'template-delete', templateId: key }, tplTr('Шаблон удалён', 'Template deleted'));
                } }, tplTr('Удалить', 'Delete')) : null));
    });
    const dialogOpen = fromOpen || Boolean(copyOf) || applyId !== null || pptxOpen || importOpen;
    return h('div', { className: 'ppt-templates tpe-busywrap' },
        h('style', null, TEMPLATES_CSS),
        h('style', null, TPL_BUSY_CSS),
        busy && !dialogOpen ? h(TplBusy, null) : null,
        h(W.Status, { tone: 'success' }, message),
        error ? h(W.Status, { tone: 'error' }, error) : null,
        h('div', { className: 'w-toolbar' },
            h(W.Button, { variant: 'primary', icon: 'plus', disabled: busy, onClick: () => setEditing({ key: null, nonce: 0 }) }, tplTr('Новый шаблон', 'New template')),
            h(W.Button, { icon: 'upload', disabled: busy, onClick: () => { setImportScope(isAdmin ? 'public' : 'user'); setImportOpen(true); } }, tplTr('Импорт шаблона', 'Import template')),
            h(W.Button, { icon: 'upload', disabled: busy, onClick: () => { setPptxFile(null); setPptxId(''); setPptxName(''); setPptxScope(isAdmin ? 'public' : 'user'); setPptxResult(null); setPptxOpen(true); } }, tplTr('Шаблон из PPTX', 'Template from PPTX')),
            h(W.Button, { disabled: busy, onClick: () => { setProjects(null); setFromProject(''); setNewId(''); setNewName(''); setFromOpen(true); } }, tplTr('Шаблон из проекта', 'Template from project')),
            h(W.IconButton, { icon: 'refresh', label: tplTr('Обновить', 'Refresh'), disabled: busy, onClick: () => void refresh() }),
            h('span', { className: 'w-muted' }, isAdmin ? tplTr('Вы администратор: можно править общие и встроенные шаблоны.', 'You are an admin: public and built-in templates are editable.') : tplTr('Общие шаблоны доступны для чтения; сохраните копию, чтобы править.', 'Public templates are read-only; save a copy to edit.'))),
        templates === null ? h('div', { className: 'tpe-busywrap', style: { minHeight: '120px' } }, h(TplBusy, { label: tplTr('Загружаю шаблоны…', 'Loading templates…') }))
            : cards.length ? h('div', { className: 'ppt-templates-grid' }, cards)
                : h(W.Empty, { icon: 'slides', title: tplTr('Шаблонов пока нет', 'No templates yet') }, tplTr('Создайте шаблон кнопкой «Новый шаблон», импортируйте файл или сделайте шаблон из существующего проекта.', 'Create a template with “New template”, import a file, or make one from an existing project.')),
        fromOpen ? h(TplDialog, { busyLabel: tplTr('Создаю шаблон из проекта…', 'Creating the template from the project…'), title: tplTr('Шаблон из проекта', 'Template from project'), closeLabel: tplTr('Отмена', 'Cancel'), busy, onClose: () => setFromOpen(false) },
            h('div', { className: 'ppt-tpl-import' },
                h('p', { className: 'w-muted' }, tplTr('Стиль, каркас страниц и до 3 слайдов-образцов станут шаблоном. Тексты страниц превратятся в места для заполнения.', 'The style, page skeleton and up to 3 sample slides become a template. Slide texts turn into placeholders.')),
                h('label', null, tplTr('Проект', 'Project'),
                    projects === null ? h('p', { className: 'w-muted' }, tplTr('Загрузка…', 'Loading…'))
                        : h('select', { value: fromProject, onChange: e => setFromProject(e.target.value) },
                            h('option', { value: '' }, tplTr('— выберите проект —', '— pick a project —')),
                            projects.map(row => h('option', { key: row.id, value: row.id }, row.title)))),
                h('label', null, tplTr('id шаблона (латиница, цифры, дефис)', 'Template id (latin, digits, hyphen)'),
                    h('input', { value: newId, maxLength: 49, onChange: e => setNewId(e.target.value.trim().toLowerCase()), placeholder: 'my-corp-template' })),
                h('label', null, tplTr('Название', 'Name'),
                    h('input', { value: newName, maxLength: 81, onChange: e => setNewName(e.target.value), placeholder: tplTr('Мой корпоративный шаблон', 'My corporate template') }))),
            h(W.Button, { variant: 'primary', disabled: busy || !fromProject || !newId || !newName.trim(), onClick: async () => {
                const value = await run({ operation: 'template-create-from-project', id: fromProject, newTemplateId: newId, name: newName.trim() }, tplTr('Шаблон создан из проекта', 'Template created from project'));
                if (value) { setFromOpen(false); setEditing({ key: value.key, nonce: 0 }); }
            } }, tplTr('Создать шаблон', 'Create template'))) : null,
        copyOf ? h(TplDialog, { busyLabel: tplTr('Дублирую шаблон…', 'Duplicating the template…'), title: tplTr('Дублировать шаблон', 'Duplicate template'), closeLabel: tplTr('Отмена', 'Cancel'), busy, onClose: () => setCopyOf(null) },
            h('div', { className: 'ppt-tpl-import' },
                h('p', { className: 'w-muted' }, tplTr('Копия появится в ваших личных шаблонах, её можно править.', 'The copy appears in your private templates and can be edited.')),
                h('label', null, tplTr('id копии (латиница, цифры, дефис)', 'Copy id (latin, digits, hyphen)'),
                    h('input', { value: copyId, maxLength: 49, onChange: e => setCopyId(e.target.value.trim().toLowerCase()), placeholder: 'my-corp-template-2' })),
                h('label', null, tplTr('Название', 'Name'),
                    h('input', { value: copyName, maxLength: 81, onChange: e => setCopyName(e.target.value) }))),
            h(W.Button, { variant: 'primary', disabled: busy || !/^[a-z0-9][a-z0-9-]{1,48}$/.test(copyId) || !copyName.trim(), onClick: async () => {
                const value = await run({ operation: 'template-duplicate', templateId: copyOf, newTemplateId: copyId, name: copyName.trim() }, tplTr('Копия создана', 'Copy created'));
                if (value) setCopyOf(null);
            } }, tplTr('Создать копию', 'Create copy'))) : null,
        applyId !== null ? h(TplDialog, { busyLabel: tplTr('Создаю презентацию из шаблона…', 'Creating the deck from the template…'), title: tplTr('Создать дек из шаблона', 'New deck from template'), closeLabel: tplTr('Отмена', 'Cancel'), busy, onClose: () => setApplyId(null) },
            h('div', { className: 'ppt-tpl-import' },
                h('label', null, tplTr('Название презентации', 'Deck title'),
                    h('input', { value: applyTitle, maxLength: 200, onChange: e => setApplyTitle(e.target.value), placeholder: tplTr('Например: Квартальный отчёт', 'e.g. Quarterly report') })),
                h('p', { className: 'w-muted' }, tplTr('Будет создан черновик: каркас страниц с местами для заполнения, стиль и бренд шаблона. Черновик появится в списке проектов.', 'A draft is created: page skeleton with placeholders, in the template’s style and brand. It appears in the projects list.'))),
            h(W.Button, { variant: 'primary', disabled: busy || !applyTitle.trim(), onClick: async () => {
                setBusy(true); setError('');
                try {
                    const value = await action({ operation: 'template-apply', templateId: applyId, title: applyTitle.trim(), lang: languageOf() });
                    setApplyId(null);
                    if (value?.project) { setMessage(tplTr('Черновик создан: ', 'Draft created: ') + value.project.title); if (onCreated) onCreated(value.project.id); }
                } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
                finally { setBusy(false); }
            } }, tplTr('Создать', 'Create'))) : null,
        pptxOpen ? h(TplDialog, { busyLabel: tplTr('Обработка PPTX: извлекаю макеты и картинки, сжимаю крупные файлы. Это может занять до минуты…', 'Processing the PPTX: extracting layouts and images, compressing large files. This can take up to a minute…'), title: tplTr('Шаблон из PPTX', 'Template from PPTX'), closeLabel: tplTr('Закрыть', 'Close'), busy, onClose: () => setPptxOpen(false) },
            pptxResult ? h('div', { className: 'ppt-tpl-import' },
                h(W.Status, { tone: 'success' }, tplTr('Шаблон создан: ', 'Template created: ') + pptxResult.key),
                h('ul', { className: 'w-muted' },
                    h('li', null, tplTr('Макетов: ', 'Layouts: ') + (pptxResult.report.layouts ?? 0)),
                    pptxResult.report.fonts ? h('li', null, tplTr('Шрифты: заголовки — ', 'Fonts: headings — ') + (pptxResult.report.fonts.major || '—') + tplTr(', текст — ', ', body — ') + (pptxResult.report.fonts.minor || '—') + tplTr('; встроенных начертаний: ', '; embedded faces: ') + (pptxResult.report.fonts.embedded ?? 0)) : null,
                    h('li', null, tplTr('Картинок на макетах: ', 'Layout images: ') + (pptxResult.report.layoutStats?.images ?? 0) + tplTr(' (из них векторных SVG: ', ' (vector SVG: ') + (pptxResult.report.layoutStats?.svg ?? 0) + ')'),
                    h('li', null, tplTr('Фонов: ', 'Backgrounds: ') + (pptxResult.report.layoutStats?.backgrounds ?? 0) + tplTr(', цветных плашек: ', ', colour plates: ') + (pptxResult.report.layoutStats?.plates ?? 0)),
                    pptxResult.report.layoutStats?.shrunk ? h('li', null, tplTr('Сжато крупных изображений: ', 'Large images compressed: ') + pptxResult.report.layoutStats.shrunk) : null,
                    pptxResult.report.slide?.adapted ? h('li', null, tplTr('Формат слайда исходника ', 'Source slide ratio ') + pptxResult.report.slide.ratio + tplTr(' пересчитан под 16:9.', ' was adapted to 16:9.')) : null,
                    Object.keys(pptxResult.report.skippedShapes ?? {}).length ? h('li', null, tplTr('Пропущено: ', 'Skipped: ') + Object.entries(pptxResult.report.skippedShapes).map(([k, v]) => k + ' ×' + v).join(', ')) : null,
                    (pptxResult.report.warnings ?? []).map((w, i) => h('li', { key: i }, w))),
                h(W.Button, { variant: 'primary', onClick: () => { setPptxOpen(false); setEditing({ key: pptxResult.key, nonce: 0 }); } }, tplTr('Открыть в редакторе', 'Open in editor')))
            : h('div', { className: 'ppt-tpl-import' },
                h('p', { className: 'w-muted' }, tplTr('Фон, логотипы, декор и их положение берутся из макетов PPTX. Файл до 64 MiB; крупные картинки сжимаются на сервере.', 'Backgrounds, logos, decor and their positions come from the PPTX layouts. Up to 64 MiB; large images are compressed on the server.')),
                h('input', { type: 'file', accept: '.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation', onChange: e => {
                    const file = e.target.files?.[0] ?? null; setPptxFile(file);
                    if (file && !pptxName) setPptxName(file.name.replace(/\.pptx$/i, '').slice(0, 80));
                } }),
                pptxFile && pptxFile.size > 64 * 1024 * 1024 ? h(W.Status, { tone: 'error' }, tplTr('Файл больше 64 MiB', 'File exceeds 64 MiB')) : null,
                h('label', null, tplTr('id шаблона (латиница, цифры, дефис)', 'Template id (latin, digits, hyphen)'),
                    h('input', { value: pptxId, maxLength: 49, onChange: e => setPptxId(e.target.value.trim().toLowerCase()), placeholder: 'my-corp-template' })),
                h('label', null, tplTr('Название', 'Name'), h('input', { value: pptxName, maxLength: 81, onChange: e => setPptxName(e.target.value) })),
                isAdmin ? h('label', null, tplTr('Куда сохранить', 'Save to'),
                    h('select', { value: pptxScope, onChange: e => setPptxScope(e.target.value) },
                        h('option', { value: 'user' }, tplTr('Себе (личный)', 'My own (private)')),
                        h('option', { value: 'public' }, tplTr('В общие (админ)', 'To public (admin)')))) : null,
                h(W.Button, { variant: 'primary', disabled: busy || !pptxFile || pptxFile.size > 64 * 1024 * 1024 || !/^[a-z0-9][a-z0-9-]{1,48}$/.test(pptxId) || !pptxName.trim(), onClick: () => void uploadPptx() }, busy ? tplTr('Обработка…', 'Processing…') : tplTr('Создать шаблон', 'Create template')))) : null,
        importOpen ? h(TplDialog, { busyLabel: tplTr('Импортирую шаблон…', 'Importing the template…'), title: tplTr('Импорт шаблона', 'Import template'), closeLabel: tplTr('Отмена', 'Cancel'), busy, onClose: () => setImportOpen(false) },
            h('div', { className: 'ppt-tpl-import' },
                h('p', { className: 'w-muted' }, tplTr('Файл .zip (bundle шаблона) или template.json, до 9 MiB.', 'A .zip bundle or template.json file, up to 9 MiB.')),
                isAdmin ? h('label', null, tplTr('Куда импортировать', 'Import into'),
                    h('select', { value: importScope, onChange: e => setImportScope(e.target.value) },
                        h('option', { value: 'user' }, tplTr('Себе (личный)', 'My own (private)')),
                        h('option', { value: 'public' }, tplTr('В общие (админ)', 'To public (admin)')))) : null,
                h('input', { type: 'file', accept: '.zip,.json', onChange: e => importFile(e.target.files?.[0]) }))) : null,
        null);
}
