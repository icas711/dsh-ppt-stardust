// Admin view of user-owned font libraries. Deletion leaves template copies intact.
function TemplateFontLibrary({ onClose }) {
    const [fonts, setFonts] = React.useState(null);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState('');
    const [message, setMessage] = React.useState('');
    async function refresh() {
        setBusy(true); setError('');
        try { const value = await action({ operation: 'template-font-list' }); setFonts(value.fonts ?? []); }
        catch (e) { setError(e instanceof Error ? e.message : String(e)); }
        finally { setBusy(false); }
    }
    React.useEffect(() => { void refresh(); }, []);
    async function remove(font) {
        if (!window.confirm(tplTr('Удалить из библиотеки пользователя ', 'Delete from the library of ') + font.owner + ': ' + font.family + ' — ' + tplFontVariantLabel(font.variant) + '? ' + tplTr('Файлы в сохранённых шаблонах останутся.', 'Files in saved templates will remain.'))) return;
        setBusy(true); setError(''); setMessage('');
        try {
            await action({ operation: 'template-font-delete', owner: font.owner, fontId: font.id });
            setFonts(previous => previous.filter(item => item.owner !== font.owner || item.id !== font.id));
            setMessage(tplTr('Шрифт удалён из библиотеки. Сохранённые шаблоны не изменены.', 'Font removed from the library. Saved templates are unchanged.'));
        } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
        finally { setBusy(false); }
    }
    return h('div', { className: 'ppt-templates tpe-busywrap' },
        h('style', null, TEMPLATES_CSS + TPL_BUSY_CSS),
        busy ? h(TplBusy, { label: tplTr('Обновляю библиотеки шрифтов…', 'Updating font libraries…') }) : null,
        h('div', { className: 'w-toolbar' },
            h(W.Button, { icon: 'left', disabled: busy, onClick: onClose }, tplTr('К шаблонам', 'Back to templates')),
            h('strong', null, tplTr('Библиотеки шрифтов пользователей', 'User font libraries')),
            h(W.Button, { icon: 'refresh', disabled: busy, onClick: () => void refresh() }, tplTr('Обновить', 'Refresh'))),
        h('p', { className: 'w-muted' }, tplTr('Доступно только администратору. Удаление убирает файл из личной библиотеки владельца; встроенные копии в шаблонах сохраняются.', 'Admins only. Deleting a file removes it from its owner’s library; embedded template copies are retained.')),
        error ? h(W.Status, { tone: 'error' }, error) : null,
        message ? h(W.Status, { role: 'status' }, message) : null,
        fonts?.length ? h('div', { className: 'ppt-templates-grid' }, fonts.map(font =>
            h('div', { className: 'ppt-template-card', key: font.owner + ':' + font.id },
                h('h3', null, font.family),
                h('p', null, tplFontVariantLabel(font.variant)),
                h('p', { className: 'tpl-meta' }, tplTr('Владелец: ', 'Owner: ') + font.owner + ' · ' + (font.size / 1024 / 1024).toFixed(2) + ' MiB'),
                (font.warnings ?? []).map((warning, index) => h('p', { className: 'w-muted', key: index }, warning)),
                h(W.Button, { icon: 'trash', disabled: busy, onClick: () => void remove(font) }, tplTr('Удалить из библиотеки', 'Delete from library')))))
            : fonts ? h('p', null, tplTr('Загруженных шрифтов пока нет.', 'No fonts uploaded yet.')) : null);
}
