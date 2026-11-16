// Панель «Шаблоны»: библиотека (builtin/public/user), импорт файлов,
// создание деки из шаблона, публикация/удаление для админа, экспорт bundle.
// Данные — операции template-* сервера (src/workbench.ts) и download?kind=template.
function pptTextT(zh, en) {
    try { return pptText(zh, en); } catch { return en ?? zh; }
}
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
    const [isAdmin, setIsAdmin] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [message, setMessage] = React.useState('');
    const [error, setError] = React.useState('');
    const [applyId, setApplyId] = React.useState(null);
    const [applyTitle, setApplyTitle] = React.useState('');
    const [restyle, setRestyle] = React.useState(null);
    const [importOpen, setImportOpen] = React.useState(false);
    const [importScope, setImportScope] = React.useState('user');
    const [fromProject, setFromProject] = React.useState(null); // {path, title}
    const [projects, setProjects] = React.useState(null);
    const [newId, setNewId] = React.useState('');
    const [newName, setNewName] = React.useState('');
    React.useEffect(() => { void refresh(); }, []);
    React.useEffect(() => {
        if (fromProject !== 'open' || projects !== null) return;
        action({ operation: 'list' }).then(v => { setProjects(v.projects ?? []); setFromProject(null); }).catch(e => setError(e instanceof Error ? e.message : String(e)));
    }, [fromProject, projects]);
    async function refresh() {
        try {
            setError('');
            const value = await action({ operation: 'template-list' });
            setTemplates(value.templates ?? []);
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
            setMessage(doneText ?? pptTextT('操作完成', 'Done'));
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
        setMessage(pptTextT('已请求下载，请查看浏览器的下载列表。', 'Download requested. Check your browser’s downloads.'));
    }
    function importFile(file) {
        if (!file) return;
        if (file.size > 16 * 1024 * 1024) { setError(pptTextT('Файл больше 16 MiB', 'File exceeds 16 MiB')); return; }
        const reader = new FileReader();
        reader.onload = async () => {
            const data = String(reader.result ?? '').split(',')[1] ?? '';
            setImportOpen(false);
            const saved = await run({ operation: 'template-import', data, scope: importScope });
            if (saved) setMessage((pptTextT('Шаблон импортирован: ', 'Template imported: ')) + saved.key);
        };
        reader.readAsDataURL(file);
    }
    const scopeLabel = scope => scope === 'builtin' ? pptTextT('Встроенный', 'Built-in') : scope === 'public' ? pptTextT('Общий', 'Public') : pptTextT('Личный', 'Private');
    const cards = (templates ?? []).map(tpl => {
        const swatches = [tpl.brand?.primaryColor, tpl.brand?.backgroundColor, tpl.brand?.textColor].filter(Boolean);
        const canDelete = tpl.scope !== 'builtin' && (tpl.scope === 'user' || isAdmin);
        const key = tpl.key ?? (tpl.scope + ':' + tpl.id);
        return h('div', { className: 'ppt-template-card', key },
            h('div', { className: 'tpl-swatch' }, swatches.map((color, i) => h('i', { key: i, style: { background: color } }))),
            h('h3', null, tpl.name),
            h('div', { className: 'tpl-meta' },
                h('span', { className: 'w-tag' }, scopeLabel(tpl.scope)),
                tpl.theme ? h('span', null, pptTextT('тема ', 'theme ') + tpl.theme) : null,
                tpl.outlineCount ? h('span', null, pptTextT('каркас ', 'outline ') + tpl.outlineCount) : null,
                tpl.author ? h('span', null, tpl.author) : null),
            tpl.description ? h('p', { className: 'tpl-outline' }, tpl.description) :
                (tpl.outlineTitles?.length ? h('p', { className: 'tpl-outline' }, tpl.outlineTitles.join(' → ')) : null),
            h('div', { className: 'tpl-actions' },
                h(W.Button, { variant: 'primary', disabled: busy, onClick: () => { setApplyId(key); setApplyTitle(''); } }, pptTextT('Создать дек', 'New deck')),
                h(W.Button, { disabled: busy, onClick: () => downloadBundle(tpl) }, pptTextT('Экспорт', 'Export')),
                !tpl.readonly && tpl.scope === 'user' && isAdmin ? h(W.Button, { disabled: busy, onClick: () => run({ operation: 'template-publish', templateId: key, owner: tpl.author }) }, pptTextT('Опубликовать', 'Publish')) : null,
                canDelete ? h(W.Button, { variant: 'danger', disabled: busy, onClick: async () => { const done = await run({ operation: 'template-delete', templateId: key }); if (done) setMessage(pptTextT('Шаблон удалён', 'Template deleted')); } }, pptTextT('Удалить', 'Delete')) : null));
    });
    return h('div', { className: 'ppt-templates' },
        h('style', null, TEMPLATES_CSS),
        h(W.Status, { tone: 'success' }, message),
        error ? h(W.Status, { tone: 'error' }, error) : null,
        h('div', { className: 'w-toolbar' },
            h(W.Button, { icon: 'refresh', disabled: busy, onClick: () => void refresh() }, pptTextT('Обновить', 'Refresh')),
            h(W.Button, { icon: 'upload', disabled: busy, onClick: () => { setImportScope(isAdmin ? 'public' : 'user'); setImportOpen(true); } }, pptTextT('Импорт шаблона', 'Import template')),
            h(W.Button, { disabled: busy, onClick: () => { setProjects(null); setFromProject('open'); setNewId(''); setNewName(''); } }, pptTextT('Шаблон из проекта', 'Template from project')),
            h('span', { className: 'w-muted' }, isAdmin ? pptTextT('Вы администратор: импорт и удаление общих шаблонов доступны.', 'You are an admin: importing and deleting public templates is available.') : pptTextT('Общие шаблоны доступны для чтения; свои — в разделе «Личный».', 'Public templates are read-only; your own are under “Private”.'))),
        templates === null ? h(W.Status, null, pptTextT('Загрузка…', 'Loading…'))
            : cards.length ? h('div', { className: 'ppt-templates-grid' }, cards)
                : h(W.Empty, { icon: 'slides', title: pptTextT('Шаблонов пока нет', 'No templates yet') }, pptTextT('Создайте шаблон из примера PPTX (ppt_template create-from-pptx) или из существующего проекта.', 'Create a template from a PPTX example (ppt_template create-from-pptx) or from an existing project.')),
        fromProject ? h(W.Dialog, { title: pptTextT('Шаблон из проекта', 'Template from project'), closeLabel: pptTextT('Отмена', 'Cancel'), busy, onClose: () => setFromProject(null) },
            h('div', { className: 'ppt-tpl-import' },
                h('p', { className: 'w-muted' }, pptTextT('Стиль, каркас страниц и до 3 слайдов-образцов станут шаблоном. Тексты страниц превратятся в места для заполнения.', 'The style, page skeleton and up to 3 sample slides become a template. Slide texts turn into placeholders.')),
                h('label', null, pptTextT('Проект', 'Project'),
                    projects === null ? h('p', { className: 'w-muted' }, pptTextT('Загрузка…', 'Loading…'))
                        : h('select', { value: fromProject && fromProject !== 'open' ? fromProject : '', onChange: e => setFromProject(e.target.value) },
                            h('option', { value: '' }, pptTextT('— выберите проект —', '— pick a project —')),
                            projects.map(row => h('option', { key: row.id, value: row.path }, row.title + ' · ' + row.path)))),
                h('label', null, pptTextT('id шаблона (латиница, цифры, дефис)', 'Template id (latin, digits, hyphen)'),
                    h('input', { value: newId, maxLength: 49, onChange: e => setNewId(e.target.value), placeholder: 'my-corp-template' })),
                h('label', null, pptTextT('Название', 'Name'),
                    h('input', { value: newName, maxLength: 81, onChange: e => setNewName(e.target.value), placeholder: pptTextT('Мой корпоративный шаблон', 'My corporate template') }))),
            h(W.Button, { variant: 'primary', disabled: busy || !fromProject || fromProject === 'open' || !newId.trim() || !newName.trim(), onClick: async () => {
                const value = await run({ operation: 'create-from-project', deckPath: fromProject, newTemplateId: newId.trim(), name: newName.trim() }, pptTextT('Шаблон создан из проекта', 'Template created from project'));
                if (value) setFromProject(null);
            } }, pptTextT('Создать шаблон', 'Create template'))) : null,
        applyId !== null ? h(W.Dialog, { title: pptTextT('Создать дек из шаблона', 'New deck from template'), closeLabel: pptTextT('Отмена', 'Cancel'), busy, onClose: () => setApplyId(null) },
            h('div', { className: 'ppt-tpl-import' },
                h('label', null, pptTextT('Название презентации', 'Deck title'),
                    h('input', { value: applyTitle, maxLength: 200, onChange: e => setApplyTitle(e.target.value), placeholder: pptTextT('Например: Квартальный отчёт', 'e.g. Quarterly report') })),
                h('p', { className: 'w-muted' }, pptTextT('Будет создан черновик: каркас страниц с местами для заполнения, стиль и бренд шаблона. Черновик появится в списке проектов.', 'A draft is created: page skeleton with placeholders, in the template’s style and brand. It appears in the projects list.'))),
            h(W.Button, { variant: 'primary', disabled: busy || !applyTitle.trim(), onClick: async () => {
                const value = await action({ operation: 'template-apply', templateId: applyId, title: applyTitle.trim() });
                setApplyId(null);
                if (value?.project) { setMessage(pptTextT('Черновик создан: ', 'Draft created: ') + value.project.title); if (onCreated) onCreated(value.project.id); }
            } }, pptTextT('Создать', 'Create'))) : null,
        importOpen ? h(W.Dialog, { title: pptTextT('Импорт шаблона', 'Import template'), closeLabel: pptTextT('Отмена', 'Cancel'), busy, onClose: () => setImportOpen(false) },
            h('div', { className: 'ppt-tpl-import' },
                h('p', { className: 'w-muted' }, pptTextT('Файл .zip или template.json (до 16 MiB).', 'A .zip or template.json file (up to 16 MiB).')),
                isAdmin ? h('label', null, pptTextT('Куда импортировать', 'Import into'),
                    h('select', { value: importScope, onChange: e => setImportScope(e.target.value) },
                        h('option', { value: 'user' }, pptTextT('Себе (личный)', 'My own (private)')),
                        h('option', { value: 'public' }, pptTextT('В общие (админ)', 'To public (admin)')))) : null,
                h('input', { type: 'file', accept: '.zip,.json', onChange: e => importFile(e.target.files?.[0]) }))) : null,
        null);
}
