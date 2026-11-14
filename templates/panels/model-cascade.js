// Общий каскад выбора модели (репетиция и визуальная проверка): кнопка с именем текущего
// выбора → флааут с группами активных провайдеров (заголовок = провайдер, под ним модели)
// → клик по модели записывает маршрут тем же ключом JSON.stringify([provider, model]).
// Каталог приходит RPC-вызовом llm.models (src/model-catalog.ts): хост сам резолвит личные
// группы по cookie веб-сессии. Перезапрос — при открытии флааута и по кнопке «Обновить
// модели». Серверный листинг coach-options/visual-options остаётся для совместимости,
// UI читает каталог отсюда; недоступный RPC — явная ошибка и повтор, не немой пустой список.
function ModelCascade({ label, placeholder, emptyHint, accept, value, selectedLabel, disabled, onRoutes, onPick }) {
    const L = (zh, en) => pptText(zh, en);
    const [open, setOpen] = useState(false), [catalog, setCatalog] = useState(null), [loading, setLoading] = useState(false), [failure, setFailure] = useState(null);
    const box = useRef(null), alive = useRef(true), ticket = useRef(0);
    useEffect(() => () => { alive.current = false; }, []);
    async function load() {
        const mine = ++ticket.current;
        setLoading(true);
        setFailure(null);
        try {
            const result = await fetchModelCatalog();
            if (!alive.current || mine !== ticket.current)
                return;
            setCatalog(result);
            onRoutes(catalogRoutes(result.groups, accept));
        }
        catch (problem) {
            if (!alive.current || mine !== ticket.current)
                return;
            setCatalog(null);
            setFailure(problem);
        }
        finally {
            if (alive.current && mine === ticket.current)
                setLoading(false);
        }
    }
    function toggle() {
        if (disabled)
            return;
        if (!open)
            void load();
        setOpen(!open);
    }
    function retry() { void load(); }
    useEffect(() => {
        if (!open)
            return;
        const outside = event => { if (box.current && event.target instanceof Node && !box.current.contains(event.target))
            setOpen(false); };
        const escape = event => { if (event.key === 'Escape') {
            event.stopPropagation();
            setOpen(false);
        } };
        document.addEventListener('pointerdown', outside);
        document.addEventListener('keydown', escape, true);
        return () => {
            document.removeEventListener('pointerdown', outside);
            document.removeEventListener('keydown', escape, true);
        };
    }, [open]);
    const groups = catalog ? catalog.groups : [];
    const failures = (catalog ? catalog.failures : []).map(item => {
        if (typeof item === 'string')
            return item;
        const source = item && typeof item === 'object' ? item : {};
        const name = source.provider || source.name || source.id || '';
        const detail = typeof source.message === 'string' ? source.message : '';
        return [String(name), detail].filter(Boolean).join(' — ');
    }).filter(Boolean);
    const state = failure
        ? h(React.Fragment, null, h('p', { role: 'alert', className: 'notice error' }, L('无法加载模型列表', 'Could not load the model list') + (failure.detail ? ' · ' + failure.detail : '')), h('p', { className: 'muted' }, emptyHint), h('button', { type: 'button', onClick: retry }, L('重试', 'Retry')))
        : !catalog
            ? h('p', { className: 'muted', role: 'status' }, L('正在加载模型列表…', 'Loading the model list…'))
            : !groups.length
                ? h(React.Fragment, null, h('p', { className: 'notice' }, emptyHint), h('button', { type: 'button', onClick: retry }, L('重试', 'Retry')))
                : h(React.Fragment, null, h('div', { className: 'cascade-groups' }, groups.map(group => h('div', { key: group.id, className: 'cascade-group' }, h('div', { className: 'cascade-provider' }, group.name || group.id), group.models.length ? group.models.map(model => {
                    const key = JSON.stringify([group.id, model.id]);
                    return h('button', { key, type: 'button', className: 'cascade-model', 'aria-pressed': key === value, disabled, onClick: () => {
                            onPick({ provider: group.id, model: model.id });
                            setOpen(false);
                        } }, model.name || model.id);
                }) : h('p', { className: 'muted' }, L('此服务没有可用模型。', 'This provider has no models.'))))), failures.length ? h('p', { className: 'notice', role: 'status' }, L('部分模型服务不可用：', 'Some providers are unavailable: ') + failures.join('; ')) : null);
    return h('div', { className: 'cascade', ref: box }, h('button', { type: 'button', className: 'cascade-toggle', 'aria-haspopup': 'true', 'aria-expanded': open, 'aria-label': label, disabled, onClick: toggle }, h('span', { className: 'cascade-value' }, selectedLabel ? h('span', null, selectedLabel) : h('span', { className: 'muted' }, placeholder)), h('span', { className: 'cascade-caret', 'aria-hidden': true }, '▾')), open && h('div', { className: 'cascade-flyout', 'aria-label': label }, h('div', { className: 'cascade-head' }, h('button', { type: 'button', disabled: loading, onClick: retry }, L('刷新模型', 'Refresh models')), loading ? h('span', { className: 'muted', role: 'status' }, L('正在加载模型列表…', 'Loading the model list…')) : null), state));
}
