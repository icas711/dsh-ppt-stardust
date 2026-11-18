// Generated: shared optional update controls; edit the original client templates.
(function(){
/* DSH workbench UI v1. MIT. Canonical source: dsh-suite/ui/workbench-ui.js.
 * Vendored into each plugin: no Suite or extra runtime dependency is required.
 * Styles are scoped to .dshw and never replace the host chrome or theme.
 */
function createWorkbenchUI(React) {
  const h = React.createElement;
  const { useEffect, useId, useRef } = React;
  const cx = (...values) => values.filter(Boolean).join(' ');
  const paths = {
    book: ['M4 4h6a3 3 0 0 1 2 2v15a4 4 0 0 0-4-2H4z', 'M20 4h-6a3 3 0 0 0-2 2v15a4 4 0 0 1 4-2h4z'],
    calendar: ['M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2Z', 'M7 3v4M17 3v4M3 10h18'],
    mail: ['M3 5h18v14H3z', 'm3 6 9 7 9-7'],
    rss: ['M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16', 'M4 19h.01'],
    slides: ['M3 4h18v13H3z', 'M12 17v4M8 21h8'],
    shield: ['m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6z', 'm8 12 3 3 5-6'],
    layers: ['M5 3h16v16H5z', 'M2 7v15h15'],
    play: ['m9 6 9 6-9 6Z'],
    video: ['M3 5h12v14H3z', 'm15 10 6-4v12l-6-4'],
    search: ['M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z', 'm16 16 5 5'],
    plus: ['M12 5v14M5 12h14'],
    refresh: ['M20 7a9 9 0 1 0 1 8', 'M20 2v5h-5'],
    settings: ['m9 3-.7 2.4-2 .9L4 5.8 2.5 8.4l1.7 1.8v2.3L2.5 14 4 17l2.5-.4 1.9 1L9 20h3l.8-2.4 2-1 2.5.4 1.5-2.7-1.7-1.9v-2.2l1.7-1.8-1.5-2.6-2.5.4-2-1L12 3Z', 'M14 11.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z'],
    close: ['m6 6 12 12M18 6 6 18'],
    left: ['m14 5-7 7 7 7'],
    right: ['m10 5 7 7-7 7'],
    down: ['m5 9 7 7 7-7'],
    filter: ['M4 5h16M7 12h10M10 19h4'],
    download: ['M12 3v12m-5-5 5 5 5-5', 'M4 16v5h16v-5'],
    upload: ['M12 16V4m-5 5 5-5 5 5', 'M4 16v5h16v-5'],
    copy: ['M8 8h13v13H8z', 'M16 8V3H3v13h5'],
    external: ['M14 3h7v7m0-7L10 14', 'M10 3H3v18h18v-7'],
    file: ['M4 3h10l6 6v12H4z', 'M14 3v6h6M8 13h8M8 17h6'],
    folder: ['M3 5h7l2 3h9v12H3z'],
    edit: ['m15 4 5 5-10 10-6 1 1-6Z', 'm13 6 5 5'],
    trash: ['M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7'],
    more: ['M5 12h.01M12 12h.01M19 12h.01'],
    info: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M12 11v6M12 7h.01'],
    check: ['m5 12 4 4L19 6'],
    quote: ['M4 12h6v7H3v-7c0-4 2-6 5-7M15 12h6v7h-7v-7c0-4 2-6 5-7'],
    star: ['m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z'],
    reply: ['m9 5-7 7 7 7v-5h6c3 0 5 2 6 5 0-8-4-11-12-11Z'],
    link: ['m10 13 4-4M8 16l-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0', 'm14 8 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0'],
  };
  function Icon({ name = 'file', size = 20, ...props }) {
    return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false, ...props },
      (paths[name] || paths.file).map((d, index) => h('path', { key: index, d })));
  }
  function Button({ children, icon, variant, className, ...props }) {
    return h('button', { type: 'button', ...props, className: cx('w-button', variant && 'w-' + variant, className) }, icon ? h(Icon, { name: icon, size: 18 }) : null, children);
  }
  function IconButton({ label, icon, ...props }) {
    return h(Button, { ...props, icon, className: cx('w-icon-button', props.className), 'aria-label': label, title: label });
  }
  function Page({ title, subtitle, actions, children, workbench = false, className, rootRef, ...props }) {
    return h('section', { ...props, ref: rootRef, className: cx('dshw', 'w-page', className), 'data-main': workbench ? 'true' : 'false' },
      h(Styles, { key: 'styles' }),
      h('header', { className: 'w-page-header' }, h('div', { className: 'w-heading' }, h('h1', null, title), subtitle ? h('p', { className: 'w-subtitle' }, subtitle) : null), actions ? h('div', { className: 'w-header-actions' }, actions) : null),
      h('div', { className: 'w-body' }, children));
  }
  function Tabs({ items, value, onChange, label, children }) {
    const id = useId();
    const active = items.some(item => item.id === value) ? value : items[0]?.id;
    function keys(event, index) {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
      const node = event.currentTarget.parentElement?.querySelectorAll('[role=tab]')[next];
      if (node) { onChange(items[next].id); node.focus(); }
    }
    return h('div', { className: 'w-tabs-layout' },
      h('div', { className: 'w-tabs', role: 'tablist', 'aria-label': label }, items.map((item, index) => h('button', {
        type: 'button', role: 'tab', key: item.id, id: id + '-' + item.id, 'aria-controls': id + '-panel', 'aria-selected': active === item.id, tabIndex: active === item.id ? 0 : -1,
        onClick: () => onChange(item.id), onKeyDown: event => keys(event, index),
      }, item.label, item.count !== undefined ? h('span', { className: 'w-count' }, item.count) : null))),
      h('div', { className: 'w-tab-panel', id: id + '-panel', role: 'tabpanel', 'aria-labelledby': id + '-' + active }, children));
  }
  function Status({ children, tone = 'info', className }) {
    if (!children) return null;
    return h('div', { className: cx('dshw', 'w-status', 'w-status-' + tone, className), role: tone === 'error' ? 'alert' : 'status', 'aria-live': tone === 'error' ? 'assertive' : 'polite' }, h(Icon, { name: tone === 'success' ? 'check' : 'info', size: 18 }), h('div', null, children));
  }
  function Empty({ title, children, action, icon = 'file' }) {
    return h('div', { className: 'dshw w-empty' }, h(Styles, { key: 'styles' }), h(Icon, { name: icon, size: 32 }), h('h2', null, title), children ? h('div', { className: 'w-muted' }, children) : null, action ? h('div', { className: 'w-toolbar' }, action) : null);
  }
  function Split({ list, detail, selected, onBack, backLabel, className, listWidth = 360 }) {
    const ref = useRef(null);
    useEffect(() => {
      if (!selected || !ref.current || ref.current.clientWidth > 760) return;
      const heading = ref.current.querySelector('.w-detail h2');
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    }, [selected]);
    return h('div', { ref, className: cx('w-split', className), 'data-selected': selected ? 'true' : 'false', style: { '--w-list-width': listWidth + 'px' } },
      h('div', { className: 'w-master' }, list),
      h('div', { className: 'w-detail' }, selected ? h(Button, { className: 'w-back', icon: 'left', variant: 'ghost', onClick: onBack }, backLabel) : null, detail));
  }
  function Row({ title, meta, description, active, onClick, children, status, className, disabled }) {
    return h('div', { className: cx('w-row', active && 'w-selected', className) },
      children ? h('div', { className: 'w-row-select' }, children) : null,
      h('button', { type: 'button', className: 'w-row-button', onClick, disabled, 'aria-pressed': !!active },
        h('span', { className: 'w-row-head' }, h('strong', null, title), status ? h('span', { className: 'w-tag' }, status) : null),
        meta ? h('span', { className: 'w-row-meta' }, meta) : null,
        description ? h('span', { className: 'w-row-description' }, description) : null));
  }
  function Search({ label, value, onChange, ...props }) {
    const id = useId();
    return h('div', { className: 'w-search' }, h(Icon, { name: 'search', size: 18 }), h('input', { type: 'search', id, 'aria-label': label, placeholder: label, value, onChange, ...props }));
  }
  function Switch({ label, checked, onChange, disabled }) {
    return h('label', { className: 'w-switch-label' }, h('span', null, label), h('input', { type: 'checkbox', role: 'switch', checked, disabled, onChange, 'aria-label': label }), h('span', { className: 'w-switch-track', 'aria-hidden': true }));
  }
  function Dialog({ title, children, onClose, closeLabel, className, busy = false }) {
    const id = useId(), panel = useRef(null);
    useEffect(() => {
      const previous = document.activeElement;
      panel.current?.querySelector('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')?.focus();
      return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
    }, []);
    function keydown(event) {
      if (event.key === 'Escape' && !event.isComposing) { event.preventDefault(); event.stopPropagation(); if (!busy) onClose(); return; }
      if (event.key !== 'Tab') return;
      const controls = [...panel.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')].filter(node => node.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (!controls.length) { event.preventDefault(); panel.current.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    return h('div', { className: 'dshw w-overlay', onClick: event => { if (!busy && event.target === event.currentTarget) onClose(); } },
      h(Styles, { key: 'styles' }),
      h('section', { ref: panel, className: cx('w-dialog', className), role: 'dialog', 'aria-modal': true, 'aria-labelledby': id, tabIndex: -1, onKeyDown: keydown },
        h('header', { className: 'w-dialog-header' }, h('h2', { id }, title), h(IconButton, { icon: 'close', label: closeLabel, disabled: busy, onClick: onClose })), h('div', { className: 'w-dialog-body' }, children)));
  }
  function register(ctx, { id, label, icon, component, inject, order = 50 }) {
    // The two slots are optional. Existing settings and manual tools still load
    // in hosts without a workbench, while RC.3 owns navigation/pinning itself.
    ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: id, inject: () => ({ ...(inject?.() || {}), workbench: true }) }, component));
    ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id, order, label }, function WorkbenchIcon({ size }) { return h(Icon, { name: icon, size }); }));
  }
  const styles = `
.dshw{--w-bg:var(--dsw-alias-bg-layer-1,#fff);--w-soft:var(--dsw-alias-bg-layer-2,#f7f8fa);--w-text:var(--dsw-alias-label-primary,#18202c);--w-muted:var(--dsw-alias-label-secondary,#667085);--w-border:var(--dsw-alias-border-l3,#e7e9ef);--w-accent:var(--dsh-plugin-workbench-accent,#4f6bdb);--w-selected:color-mix(in srgb,var(--w-accent) 10%,var(--w-bg));--w-primary:var(--w-text);--w-on-primary:var(--w-bg);container-type:inline-size;container-name:dsh-workbench;color:var(--w-text);font:14px/1.65 var(--dsh-font-family-content,system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif);min-width:0;max-width:100%;box-sizing:border-box;text-align:start;color-scheme:inherit}
.dshw *,.dshw *:before,.dshw *:after{box-sizing:border-box}.dshw h1,.dshw h2,.dshw h3,.dshw h4,.dshw p{margin:0}.dshw h1{font-size:30px;line-height:1.25;letter-spacing:-.025em;font-weight:650}.dshw h2{font-size:24px;line-height:1.35;font-weight:650;letter-spacing:-.015em;overflow-wrap:anywhere}.dshw h3,.dshw h4{font-size:16px;line-height:1.4;font-weight:600}.dshw a{color:var(--w-accent);text-underline-offset:3px;overflow-wrap:anywhere}.dshw button,.dshw input,.dshw select,.dshw textarea{font:inherit;color:inherit;max-width:100%}.dshw input:not([type=checkbox]):not([type=radio]):not([type=file]),.dshw select,.dshw textarea{background:var(--dsw-specific-input-major,var(--w-bg));border:1px solid var(--w-border);border-radius:8px;padding:8px 11px;min-width:0;line-height:1.5}.dshw input:not([type=checkbox]):not([type=radio]):not([type=file]),.dshw select{min-height:38px}.dshw textarea{resize:vertical}.dshw input[type=checkbox],.dshw input[type=radio]{width:16px;height:16px;flex-shrink:0;accent-color:var(--w-accent)}.dshw :focus-visible{outline:2px solid var(--w-accent);outline-offset:3px}.dshw button:disabled,.dshw input:disabled,.dshw select:disabled,.dshw textarea:disabled{opacity:.5;cursor:not-allowed}.dshw label{font-size:13px}.dshw fieldset{min-width:0;border:1px solid var(--w-border);border-radius:8px}.dshw summary{cursor:pointer;font-weight:550;list-style:none;display:flex;align-items:center;gap:8px}.dshw summary::-webkit-details-marker{display:none}.dshw summary:after{content:'';display:block;margin-inline-start:auto;width:7px;height:7px;border-inline-end:1.75px solid currentColor;border-bottom:1.75px solid currentColor;transform:rotate(45deg);flex-shrink:0}.dshw details[open]>summary:after{transform:rotate(225deg)}.dshw details>summary+*{margin-top:12px}.dshw pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.7 ui-monospace,SFMono-Regular,Consolas,monospace;max-width:100%;background:var(--w-soft);border-radius:6px;padding:14px}.dshw img,.dshw video,.dshw iframe{max-width:100%}
.w-page{display:flex;flex-direction:column;position:relative;padding:0;min-height:540px;gap:0}.w-page[data-main=true]{height:100%;min-height:0;padding:calc(24px + var(--dsh-frame-top-clearance,0px)) 28px 0 max(28px,var(--dsh-frame-leading-clearance,0px));overflow:auto}.dshw[data-main=true]{background:var(--w-bg)}.dshw.w-page,.dshw .w-body,.dshw .w-tab-panel{overflow-x:clip}.w-page-header{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;padding-bottom:22px;flex-shrink:0}.w-heading{min-width:0}.w-subtitle{margin-top:8px!important;font-size:14px;color:var(--w-muted);line-height:1.6}.w-header-actions,.w-toolbar,.w-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-width:0}.w-header-actions{justify-content:flex-end}.w-body,.w-tabs-layout{display:flex;flex-direction:column;flex:1;min-height:0;min-width:0}.w-body{overflow:auto}.w-tab-panel{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;overflow:auto}.w-tabs{display:flex;align-items:stretch;gap:20px;border-bottom:1px solid var(--w-border);flex-shrink:0;overflow-x:auto;scrollbar-width:thin}.dshw .w-tabs>button{border:0;border-bottom:2px solid transparent;background:transparent;padding:11px 8px 13px;white-space:nowrap;font-size:14px;font-weight:550;cursor:pointer;color:var(--w-muted);display:flex;align-items:center;gap:7px}.dshw .w-tabs>button[aria-selected=true]{border-bottom-color:var(--w-accent);color:var(--w-accent)}.w-count,.w-tag{font-size:12px;line-height:1.5;display:inline-flex;align-items:center;flex-shrink:0;background:var(--w-soft);border-radius:5px;padding:1px 6px;color:var(--w-muted)}.w-tabs [aria-selected=true] .w-count,.w-selected .w-tag{color:var(--w-accent);background:var(--w-selected)}
.dshw .w-button{display:inline-flex;justify-content:center;align-items:center;gap:7px;background:var(--w-bg);border:1px solid var(--w-border);border-radius:8px;padding:8px 12px;min-height:36px;line-height:1.4;font-size:14px;font-weight:500;cursor:pointer;text-decoration:none;white-space:normal}.dshw .w-button:not(:disabled):hover{background:var(--w-soft)}.dshw .w-primary{background:var(--w-primary);border-color:var(--w-primary);color:var(--w-on-primary)}.dshw .w-primary:not(:disabled):hover{background:var(--w-primary);opacity:.9}.dshw .w-ghost{background:transparent;border-color:transparent}.dshw .w-danger{color:var(--dsw-alias-state-error-primary,#b43c3c)}.dshw .w-icon-button{width:36px;min-width:36px;padding:8px}.dshw .w-button svg{flex-shrink:0}.w-muted{color:var(--w-muted);font-size:12px;line-height:1.6}.w-section{padding:24px 0;border-bottom:1px solid var(--w-border);min-width:0}.w-section>h3{margin-bottom:12px}.w-section>p+p{margin-top:8px}.w-fields{display:grid;gap:16px;min-width:0}.w-field{display:grid;gap:6px;min-width:0}.w-field>input,.w-field>select,.w-field>textarea{width:100%}.w-status{display:flex;align-items:flex-start;gap:8px;padding:11px 13px;margin:12px 0;border:1px solid var(--w-border);border-radius:8px;background:var(--w-soft);font-size:13px;overflow-wrap:anywhere;flex-shrink:0}.w-status>svg{flex-shrink:0;margin-top:2px}.w-status-error{color:var(--dsw-alias-state-error-primary,#ad3636)}.w-status-success{color:var(--dsw-alias-state-success-primary,#24794a)}.w-status-warn{color:var(--dsw-alias-state-warning-primary,#8a5a00)}.w-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:14px;width:100%;max-width:580px;padding:48px 24px;margin:auto;min-height:280px;overflow-wrap:anywhere}.w-empty>svg{color:var(--w-muted)}.w-empty h2{font-size:20px}.w-empty .w-muted{font-size:14px}.w-empty .w-toolbar{justify-content:center}
.w-split{display:grid;grid-template-columns:minmax(240px,var(--w-list-width)) minmax(0,1fr);min-height:460px;flex:1;min-width:0}.w-master{min-width:0;border-inline-end:1px solid var(--w-border);overflow:auto;padding-bottom:24px}.w-detail{min-width:0;padding:26px 28px;overflow:auto;overflow-wrap:anywhere;display:flex;flex-direction:column}.w-master-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:20px 16px}.w-search{display:flex;align-items:center;gap:8px;border:1px solid var(--w-border);border-radius:8px;padding:0 10px;min-width:0;flex:1;background:var(--w-bg)}.w-search>svg{color:var(--w-muted);flex-shrink:0}.dshw .w-search>input{border:0!important;background:transparent!important;padding:8px 0!important;width:100%;outline-offset:0}.w-row{display:flex;gap:0;min-width:0;position:relative;border-bottom:1px solid var(--w-border);border-inline-start:3px solid transparent}.w-row-select{display:flex;align-items:flex-start;padding:21px 0 0 14px}.dshw .w-row-button{display:flex;flex-direction:column;align-items:stretch;gap:7px;text-align:start;width:100%;padding:18px 18px 18px 16px;border:0;background:transparent;color:inherit;min-width:0;cursor:pointer;line-height:1.5}.dshw .w-row-button:hover{background:var(--w-soft)}.w-row-head{display:flex;align-items:flex-start;gap:10px;justify-content:space-between;min-width:0}.w-row-head>strong{font-size:14px;line-height:1.5;font-weight:600;overflow-wrap:anywhere}.w-row-meta,.w-row-description{color:var(--w-muted);font-size:12px;line-height:1.6;overflow-wrap:anywhere}.w-row-description{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.w-selected{background:var(--w-selected);border-inline-start-color:var(--w-accent)}.w-back{display:none!important}.w-detail-title{margin-bottom:12px!important}.w-detail-meta{color:var(--w-muted);font-size:13px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.w-detail-footer{padding:24px 0;display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:auto;border-top:1px solid var(--w-border)}.w-detail-footer .w-muted{flex:1;min-width:160px}.w-definition{display:grid;grid-template-columns:minmax(80px,120px) minmax(0,1fr);gap:8px 16px;font-size:14px;margin:20px 0}.w-definition dt{color:var(--w-muted)}.w-definition dd{margin:0;min-width:0;overflow-wrap:anywhere}
.w-switch-label{display:inline-flex;align-items:center;gap:8px;font-size:13px;position:relative;cursor:pointer}.w-switch-label>input{position:absolute;opacity:0;inset-inline-end:0;width:36px!important;height:22px!important;margin:0;cursor:pointer}.w-switch-track{width:36px;height:22px;border-radius:12px;display:block;background:var(--w-border);border:1px solid var(--w-border);pointer-events:none;padding:2px;transition:background .15s}.w-switch-track:before{content:'';display:block;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px #0002;transition:transform .15s}.w-switch-label>input:checked+.w-switch-track{background:var(--w-accent);border-color:var(--w-accent)}.w-switch-label>input:checked+.w-switch-track:before{transform:translateX(14px)}.w-switch-label>input:focus-visible+.w-switch-track{outline:2px solid var(--w-accent);outline-offset:3px}.w-switch-label:has(>input:disabled){opacity:.5;cursor:not-allowed}
.w-overlay{position:fixed;inset:0;background:#0005;display:flex;justify-content:flex-end;z-index:1000;padding:12px;overflow:auto}.w-dialog{width:min(620px,100%);max-height:100%;display:flex;flex-direction:column;min-height:0;background:var(--w-bg);color:var(--w-text);border:1px solid var(--w-border);border-radius:12px;box-shadow:0 18px 70px #0003}.w-dialog-header{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 24px;border-bottom:1px solid var(--w-border);flex-shrink:0}.w-dialog-header>h2{font-size:20px}.w-dialog-body{overflow:auto;padding:20px 24px;min-height:0}.w-editor-grid{display:grid;grid-template-columns:210px minmax(0,1fr) 300px;min-height:500px;flex:1}.w-editor-list{padding:20px 12px;border-inline-end:1px solid var(--w-border);min-width:0}.w-editor-canvas{background:var(--w-soft);padding:20px;min-width:0;display:flex;flex-direction:column;gap:14px}.w-editor-inspector{padding:24px;border-inline-start:1px solid var(--w-border);min-width:0;overflow:auto}.w-editor-inspector h3{margin-bottom:18px}.w-preview-empty{display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:12px;aspect-ratio:16/9;min-height:180px;background:var(--w-soft);border:1px solid var(--w-border);border-radius:8px;padding:24px;color:var(--w-muted)}.w-content-pad{padding:24px 0}.w-stack{display:flex;flex-direction:column;gap:16px;min-width:0}.w-scroll-x{overflow:auto;max-width:100%}
@container dsh-workbench (max-width:1000px){.w-editor-grid{grid-template-columns:160px minmax(0,1fr)}.w-editor-inspector{grid-column:1/-1;border-inline-start:0;border-top:1px solid var(--w-border)}.w-header-actions{max-width:60%}.w-split{grid-template-columns:minmax(240px,32%) minmax(0,1fr)}}
@container dsh-workbench (max-width:760px){.w-page-header{gap:14px;flex-wrap:wrap;padding-bottom:18px}.w-heading{flex:1;min-width:170px}.dshw h1{font-size:24px}.w-header-actions{max-width:100%;justify-content:flex-start}.w-subtitle{font-size:13px}.w-tabs{gap:12px}.dshw .w-tabs>button{padding:10px 4px 12px}.w-split{display:block;min-height:360px}.w-split[data-selected=false]>.w-detail{display:none}.w-split[data-selected=true]>.w-master{display:none}.w-master{border-inline-end:0}.w-detail{padding:20px 0}.w-back{display:inline-flex!important;align-self:flex-start;margin:0 0 16px!important}.w-detail h2{font-size:22px}.w-master-toolbar{padding:16px 0}.dshw .w-row-button{padding:16px 10px}.w-detail-footer{position:static}.w-detail-footer .w-muted{flex-basis:100%}.w-editor-grid{display:flex;flex-direction:column}.w-editor-list{border-inline-end:0;border-bottom:1px solid var(--w-border);padding:16px 0}.w-editor-canvas{padding:16px 0;background:var(--w-bg)}.w-editor-inspector{padding:20px 0}.w-dialog-header,.w-dialog-body{padding:16px}.w-button{min-height:40px}.w-definition{grid-template-columns:80px minmax(0,1fr)}}
@media(max-width:700px){.w-page[data-main=true]{padding:calc(16px + var(--dsh-frame-top-clearance,0px)) 16px 0 max(16px,var(--dsh-frame-leading-clearance,0px))}.w-overlay{padding:8px}.w-dialog{width:100%}}
@media(prefers-reduced-motion:reduce){.dshw *,.dshw *:before{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
`;
  function Styles() { return h('style', null, styles); }
  return { Icon, Button, IconButton, Page, Tabs, Status, Empty, Split, Row, Search, Switch, Dialog, Styles, register, styles };
}

/* One update control per plugin. Only transport, idle guards and installation
 * coordination are shared; no global update page or update-all action exists. */
function __stardustUpdatesGuards() {
  const key = Symbol.for('stardustlc.plugin-updates.guards.v1');
  return globalThis[key] ||= { values: new Map(), listeners: new Set(), viewListeners: new Set(), clients: new Set() };
}
function __stardustUpdatesGuard(React, name, { dirty = false, busy = false, retainOnClose = false } = {}) {
  const token = React.useRef(null);
  if (!token.current) token.current = {};
  React.useLayoutEffect(() => {
    const pool = __stardustUpdatesGuards();
    if (!dirty && !busy) for (const [key, value] of pool.values) if (value.name === name && value.orphan) pool.values.delete(key);
    pool.values.set(token.current, { name, dirty: !!dirty, busy: !!busy, retainOnClose, orphan: false });
    for (const listener of pool.listeners) listener();
  }, [name, !!dirty, !!busy, retainOnClose]);
  React.useEffect(() => () => {
    const pool = __stardustUpdatesGuards(), value = pool.values.get(token.current);
    if (value?.retainOnClose && (value.dirty || value.busy)) value.orphan = true;
    else pool.values.delete(token.current);
    for (const listener of pool.listeners) listener();
  }, []);
}
function __StardustPluginUpdatesFooter({ React, name }) {
  const [, render] = React.useState(0), pool = __stardustUpdatesGuards();
  React.useEffect(() => { const fn = () => render(value => value + 1); pool.viewListeners.add(fn); return () => pool.viewListeners.delete(fn); }, []);
  const client = [...pool.clients].find(client => typeof client.Footer === 'function' && client.has(name));
  if (!client) return null;
  return React.createElement(client.Footer, { name });
}
function __stardustUpdatesInlinePage(React, element, name) {
  return React.cloneElement(element, null, element.props.children, React.createElement(__StardustPluginUpdatesFooter, { key: 'plugin-updates', React, name }));
}
function __stardustUpdatesDetailName(subject, rows) {
  if (!subject || !['bundle', 'row'].includes(subject.kind)) return null;
  if (subject.kind === 'row' && subject.pkg?.name === '@stardustlc/dsh-suite') {
    const component = rows.find(row => row.bundledBy === subject.pkg.name && (subject.row?.moduleName === row.name || subject.row?.moduleName?.startsWith(row.name + '/')));
    if (component) return component.name;
  }
  return rows.some(row => row.name === subject.pkg?.name) ? subject.pkg.name : null;
}
function __stardustUpdatesNativeFormState(document) {
  let dirty = false, busy = false;
  for (const scope of document.querySelectorAll('[data-plugin-detail],[data-plugin-row-detail]')) for (const button of scope.querySelectorAll('button')) {
    if (!button.getClientRects().length || button.closest('.plugin-updates-footer')) continue;
    const label = (button.getAttribute('aria-label') || button.textContent || '').trim();
    if (/^(?:正在保存|保存中|Saving)(?:[.…\s]|$)/i.test(label) || button.getAttribute('aria-busy') === 'true') busy = true;
    if (!button.disabled && button.getAttribute('aria-disabled') !== 'true' && /^(?:保存(?:更改|设置|配置)?|Save(?: changes| settings| configuration)?)(?:\s+(?:Ctrl|⌘|Enter|↵).*)?$/i.test(label)) dirty = true;
  }
  return { dirty, busy };
}
function __stardustUpdatesDisplayRows(next, known) {
  for (const row of next.rows) known.set(row.name, row);
  if (!['verifying', 'installing', 'cancelling', 'unknown', 'restore-failed'].includes(next.job?.state)) return next;
  const rows = [...next.rows];
  for (const row of known.values()) if ((row.name === next.job.name || row.bundledBy === next.job.name) && !rows.some(item => item.name === row.name)) rows.push({ ...row, updating: true });
  return { ...next, rows };
}
function __stardustUpdatesSuiteRows(next, participants) {
  // The official manager lists top-level dependencies, not Suite's transitive
  // components. Project active, build-identified clients for display only.
  // Installation and preferences still use the real Suite row from the host.
  const suite = next.rows.find(row => row.name === '@stardustlc/dsh-suite' && row.enabled);
  if (!suite) return next;
  const rows = [...next.rows], names = new Set(rows.map(row => row.name));
  for (const item of participants) if (item.suiteComponent && item.packageVersion && item.label && !names.has(item.name)) {
    names.add(item.name);
    rows.push({ name: item.name, version: item.packageVersion, enabled: true, sourceKind: 'suite', loadError: false, label: item.label, labelEn: item.labelEn, bundledBy: suite.name });
  }
  return { ...next, rows };
}
function __stardustUpdatesWrap(definition, participant) {
  return { ...definition, factory(require) {
    const original = definition.factory(require);
    if (!original || typeof original !== 'object') return original;
    const React = require('react');
    return { ...original, apply(ctx, ...args) {
      const result = original.apply?.call(this, ctx, ...args);
      // The optional alpha.3 slot stays dormant in older hosts; its scoped
      // injection unregisters naturally when the plugin is unloaded.
      if (participant.iconData && participant.sectionIds?.length && typeof ctx.inject === 'function') ctx.inject(['slots'], host => {
        for (const id of new Set(participant.sectionIds)) host.slots.inject('settings.section.icon', () => host.slots.register({ name: 'settings.section.icon', id }, function PluginSettingsIcon({ size = 20 }) {
          return React.createElement('img', { src: participant.iconData, alt: '', 'aria-hidden': true, width: size, height: size, style: { objectFit: 'contain', display: 'block', flexShrink: 0 } });
        }));
      });
      if (typeof ctx.inject === 'function') ctx.inject(['slots', 'locale', 'remote', 'remote.pluginManager'], host => __stardustUpdatesJoin(host, React, require, participant));
      return result;
    } };
  } };
}
function __stardustUpdatesJoin(host, React, require, participant) {
  const key = Symbol.for('stardustlc.plugin-updates.client.v1'), pools = globalThis[key] ||= new WeakMap(), root = host.root || host;
  if (typeof root.plugin !== 'function') return;
  let record = pools.get(root);
  if (!record) {
    record = { refs: new Map(), timer: null, version: participant.version, alive: true, hold: false, uiRevision: 2 };
    pools.set(root, record);
    __stardustUpdatesActivate(record, pools, root, React, require);
  } else if (record.uiRevision !== 2 && !record.migration) {
    // The first loaded participant may still own a pre-footer client. Keep
    // its references and draft guards, wait for any admitted install, then
    // replace that one client fiber instead of running two window heartbeats.
    const shared = record;
    record.migration = Promise.resolve().then(async () => {
      while (shared.alive && shared.hold) await new Promise(resolve => setTimeout(resolve, 500));
      if (!shared.alive || !shared.refs.size) return;
      await shared.fiber?.dispose?.();
      if (!shared.refs.size) return;
      shared.alive = true; shared.uiRevision = 2; pools.set(root, shared);
      __stardustUpdatesActivate(shared, pools, root, React, require);
    }).catch(() => { /* The original page remains usable if host disposal fails. */ });
  }
  clearTimeout(record.timer);
  const ref = {}; record.refs.set(ref, participant);
  host.effect(() => () => {
    record.refs.delete(ref);
    const stop = () => {
      if (record.refs.size || !record.alive) return;
      if (record.hold) { record.timer = setTimeout(stop, 1000); return; }
      record.alive = false; Promise.resolve(record.fiber?.dispose?.()).catch(() => {});
    };
    if (!record.refs.size) record.timer = setTimeout(stop, 1000);
  });
}
function __stardustUpdatesActivate(shared, pools, root, React, require) {
  shared.fiber = root.plugin({ name: 'stardustlc-plugin-updates-client', inject: ['slots', 'locale', 'remote', 'remote.pluginManager'], apply(ctx) {
    const client = __stardustUpdatesClient(ctx, React, require, shared);
    ctx.effect(() => () => { shared.alive = false; client.dispose(); if (pools.get(root) === shared) pools.delete(root); });
  } });
  Promise.resolve(shared.fiber).catch(() => { shared.alive = false; if (pools.get(root) === shared) pools.delete(root); });
}
function __stardustUpdatesClient(ctx, React, require, shared) {
  const h = React.createElement, W = createWorkbenchUI(React), route = new URL('api/stardustlc/plugin-updates', document.baseURI);
  const { useState, useEffect } = React, id = crypto.randomUUID(), listeners = new Set(), pool = __stardustUpdatesGuards(), requests = new Set(), notified = new Set(), knownRows = new Map();
  let alive = true, registered = false, state = null, lastInteraction = Date.now(), inPoll = false, manualOperation = false, legacyHint = null;
  const language = () => String(ctx.locale?.getSnapshot?.().active || '').startsWith('en') ? 'en' : 'zh';
  const t = (zh, en) => language() === 'en' ? en : zh;
  const preferences = name => state?.preferences.packages[name] || { checkEnabled: true, autoInstall: false, deferredUntil: 0, ignoredVersion: null };
  const originalRow = name => state?.rows.find(row => row.name === name);
  const rowFor = name => { const row = originalRow(name); return row?.bundledBy ? originalRow(row.bundledBy) : row; };
  const activeJob = () => ['verifying', 'installing', 'cancelling'].includes(state?.job?.state);
  function notify() { shared.hold = manualOperation || activeJob(); for (const listener of listeners) listener(); for (const listener of pool.viewListeners) listener(); }
  async function api(body = { action: 'state' }) {
    const controller = new AbortController(); requests.add(controller);
    const timeout = setTimeout(() => controller.abort(), body.action === 'check' ? 95000 : 45000);
    try {
      const response = await fetch(route, { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal, headers: { 'content-type': 'application/json', 'x-stardustlc-updates': '1' }, body: JSON.stringify(body) });
      let data; try { data = await response.json(); } catch { throw new Error('service-unavailable'); }
      if (!response.ok || !data.ok) throw new Error(response.status === 403 ? 'owner-required' : data.code || 'service-unavailable');
      return data.value;
    } catch (error) { if (error?.name === 'AbortError') throw new Error('service-unavailable'); throw error; }
    finally { clearTimeout(timeout); requests.delete(controller); }
  }
  function pageState(manual = manualOperation) {
    const values = [...pool.values.values()], nativeForm = __stardustUpdatesNativeFormState(document);
    const dialog = [...document.querySelectorAll('[role="dialog"],dialog[open]')].some(node => node.getClientRects().length && !(manual && (node.closest('.plugin-updates-footer') || node.querySelector('.plugin-updates-footer'))));
    return { action: 'heartbeat', id, dirty: nativeForm.dirty || values.some(value => value.dirty), busy: nativeForm.busy || values.some(value => value.busy) || dialog, idleForMs: Math.min(86400000, Math.max(0, Date.now() - lastInteraction)) };
  }
  const heartbeat = () => api(pageState());
  function interaction() { lastInteraction = Date.now(); if (registered && alive) void heartbeat().catch(() => {}); }
  const guardChanged = () => { if (registered && alive) void heartbeat().catch(() => {}); };
  for (const event of ['pointerdown', 'keydown', 'input']) document.addEventListener(event, interaction, { capture: true, passive: true });
  pool.listeners.add(guardChanged);
  const close = () => { void fetch(route, { method: 'POST', credentials: 'same-origin', keepalive: true, headers: { 'content-type': 'application/json', 'x-stardustlc-updates': '1' }, body: JSON.stringify({ action: 'client-close', id }) }).catch(() => {}); };
  window.addEventListener('pagehide', close);
  async function refresh() { const next = await api(); if (alive) { state = __stardustUpdatesDisplayRows(__stardustUpdatesSuiteRows(next, shared.refs.values()), knownRows); notify(); } return next; }
  function useSnapshot() {
    const [, render] = useState(0);
    useEffect(() => { const fn = () => render(value => value + 1); listeners.add(fn); const stop = ctx.locale?.subscribe?.(fn); return () => { listeners.delete(fn); stop?.(); }; }, []);
    return state;
  }
  function message(code) {
    return ({
      'page-dirty': t('有未保存的修改。请先保存或放弃修改，再更新。', 'Save or discard unsaved changes before updating.'),
      'page-busy': t('有页面操作或对话框尚未结束，请完成后再试。', 'Finish the active page operation or close its dialog, then retry.'),
      'page-not-ready': t('还有窗口状态未确认，或旧版插件尚未提供状态保护。请刷新相关窗口，必要时先手动更新旧版插件。', 'A window state is unknown or an older plugin lacks state protection. Refresh the affected windows and manually update legacy plugins if needed.'),
      busy: t('DSH 正在执行任务或安装，请等操作结束。', 'DSH is running a task or installation. Wait for it to finish.'),
      'activity-unknown': t('无法确认任务是否空闲，已暂停安装。', 'Installation paused because task activity is unknown.'),
      'restart-required': t('更新服务需要重启后继续。请在方便时手动重启 DSH。', 'The updater needs a restart. Restart DSH manually when convenient.'),
      'operation-unconfirmed': t('上次安装未确认或恢复失败。请在官方插件管理中检查并修复，之后手动重启 DSH。', 'The last installation is unconfirmed or recovery failed. Check and repair it in native plugin management, then restart DSH manually.'),
      'check-first': t('检查结果已过期，请重新检查。', 'This check expired. Check again.'),
      'release-changed': t('发布信息已变化，本次未安装。请重新检查。', 'Release metadata changed. Nothing was installed; check again.'),
      'preferences-conflict': t('另一个窗口修改了偏好，已刷新，请重试。', 'Preferences changed in another window. They have been refreshed; retry.'),
      'preferences-unreadable': t('更新偏好文件无法读取，自动安装已关闭。请检查当前 profile 的 stardustlc-plugin-updates.json。', 'Preferences could not be read. Automatic installation is off. Check stardustlc-plugin-updates.json in this profile.'),
      'no-update': t('版本已变化或暂不兼容，请重新检查。', 'The version changed or is incompatible. Check again.'),
      'source-not-registry': t('本地源码、Git 等安装，请通过原安装方式更新。', 'Update local, Git and other external sources through their original installation method.'),
      'managed-by-suite': t('这个插件随 Suite 安装，通过 Suite 更新。', 'This plugin was installed through Suite and is updated through Suite.'),
      'owner-required': t('只有 profile 拥有者能管理更新。', 'Only the profile owner can manage updates.'),
    })[code] || t('操作未完成，请刷新后重试。DSH 不会因此自动重启。', 'The operation could not be completed. Refresh and retry. DSH will not restart automatically.');
  }
  // releaseOf() keeps the failing engine/peer range check as a stable code; say which
  // environment has to change instead of only reporting that the release is incompatible.
  function requirement(release) {
    return ({
      'dsh-version': t('需要换成与该版本匹配的 DSH 本体', 'it needs a different DSH version'),
      'node-version': t('需要换成与该版本匹配的 Node.js', 'it needs a different Node.js version'),
      deprecated: t('作者已把这个版本标记为弃用', 'the author marked this release as deprecated'),
      'not-bundle': t('这个版本不是可加载的 DSH 插件包', 'this release is not a loadable DSH plugin bundle'),
    })[release?.reason] || t('发布元数据的兼容范围与当前环境不符', 'its published compatibility range does not match this environment');
  }
  function jobLabel(job) {
    return ({ verifying: t('正在核对版本', 'Verifying release'), installing: t('正在安装', 'Installing'), cancelling: t('正在请求取消', 'Requesting cancellation'), complete: t('已更新', 'Updated'), 'restart-required': t('已安装，等待你手动重启', 'Installed; manual restart needed'), restored: t('更新未成功，已恢复原版本', 'Update failed; previous version restored'), 'restore-failed': t('恢复未成功，请检查官方插件管理', 'Recovery failed; check native plugin management'), unknown: t('结果未确认，请检查官方插件管理', 'Result unconfirmed; check native plugin management'), cancelled: t('已取消', 'Cancelled'), failed: t('更新未成功', 'Update failed') })[job.state] || job.state;
  }
  function FooterFrame({ name, label, subtitle, actions, children }) {
    return h('section', { className: 'dshw plugin-updates-footer', 'data-plugin-update-footer': name, 'aria-label': label + t(' · 版本与更新', ' · Version and updates') },
      h('style', null, W.styles),
      h('style', null, '.plugin-updates-footer{box-sizing:border-box;flex-shrink:0;margin-top:28px;padding-top:18px;border-top:1px solid var(--dsw-alias-border-l3,#e5e7eb);min-width:0;max-width:100%;color:var(--dsw-alias-label-primary,#202124)}.plugin-updates-footer .updates-head{display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px}.plugin-updates-footer h2{font-size:14px;line-height:22px;margin:0;font-weight:600}.plugin-updates-footer .updates-subtitle,.plugin-updates-footer .updates-version{font:12px/1.6 ui-monospace,monospace;overflow-wrap:anywhere;margin:4px 0}.plugin-updates-footer .updates-options{margin-top:12px}.plugin-updates-footer .updates-options>summary{cursor:pointer;font-size:12px;line-height:22px;color:var(--dsw-alias-label-secondary,#657080)}.plugin-updates-footer .updates-options>summary:focus-visible{outline:2px solid var(--dsw-focus-ring-color,#6b79df);outline-offset:4px}.plugin-updates-footer .updates-settings{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:16px;padding:14px 0 0}.plugin-updates-footer .updates-note{margin:5px 0 0;font-size:12px;line-height:1.6}.plugin-updates-footer>.w-section{margin:10px 0 0;padding:0;border:0}.plugin-updates-footer .w-toolbar{margin-top:10px!important}.plugin-updates-footer .w-switch-label{max-width:100%;gap:12px;align-items:flex-start}.plugin-updates-footer .w-switch-track{flex-shrink:0}.plugin-updates-footer .updates-notes{margin-top:12px;padding:12px;border:1px solid var(--dsw-alias-border-l3,#e5e7eb);border-radius:10px}.plugin-updates-footer .updates-notes pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;overflow:auto;font:12px/1.7 ui-monospace,monospace}.plugin-updates-footer .w-overlay{z-index:1002}@media(max-width:600px){.plugin-updates-footer .updates-head{gap:8px}.plugin-updates-footer .w-toolbar{gap:6px;flex-wrap:wrap}.plugin-updates-footer .w-button{max-width:100%}}'),
      h('div', { className: 'updates-head' }, h('div', null, h('h2', null, t('版本与更新', 'Version and updates')), h('p', { className: 'updates-subtitle w-muted' }, subtitle)), actions), children);
  }
  function Panel({ name }) {
    const snapshot = useSnapshot(), [error, setError] = useState(''), [working, setWorking] = useState(false), [checking, setChecking] = useState(false), [dialog, setDialog] = useState(null), [notes, setNotes] = useState(null), [notesOpen, setNotesOpen] = useState(false), [loadingNotes, setLoadingNotes] = useState(false);
    const row = rowFor(name), original = originalRow(name), target = row?.name || name, prefs = preferences(target), job = snapshot?.job?.name === target ? snapshot.job : null;
    async function perform(callback) { setError(''); setWorking(true); try { await callback(); await refresh(); } catch (error) { setError(error.message); await refresh().catch(() => {}); } finally { setWorking(false); } }
    async function save(changes, consent) { await api({ action: 'preferences', name: target, revision: state.preferences.revision, changes, consent }); }
    async function check() { setError(''); setChecking(true); try { await api({ action: 'check', name: target }); await refresh(); } catch (error) { setError(error.message); } finally { setChecking(false); } }
    async function install() {
      setDialog(null); manualOperation = true; notify();
      await perform(async () => {
        try {
          await heartbeat();
          const started = await api({ action: 'install', name: row.name, version: row.release.version, confirmation: 'update-installed-plugin' });
          while (alive) {
            await new Promise(resolve => setTimeout(resolve, 800)); await heartbeat(); await refresh();
            if (state.job?.id !== started.id) throw new Error('operation-unconfirmed');
            if (!activeJob()) break;
          }
        } finally { manualOperation = false; notify(); }
      });
    }
    async function showNotes() {
      if (notesOpen) { setNotesOpen(false); return; }
      setNotesOpen(true); setNotes(null); setLoadingNotes(true); setError('');
      try { setNotes(await api({ action: 'notes', name: target, version: row.release.version })); } catch (error) { setError(error.message); } finally { setLoadingNotes(false); }
    }
    if (!snapshot || !row) return h(W.Status, null, t('此插件尚未安装或已从当前 profile 移除。', 'This plugin is not installed in the current profile.'));
    const title = language() === 'en' ? original.labelEn : original.label;
    const ownPage = pageState(true), unconfirmed = ['unknown', 'restore-failed'].includes(snapshot.job?.state), pageBusy = ownPage.busy || (snapshot.pages.clients || []).some(client => client.id !== id && client.busy), installLocked = working || activeJob() || unconfirmed || snapshot.updaterRestart || snapshot.preferenceError || !snapshot.activity.known || snapshot.activity.busy || snapshot.pages.dirty || ownPage.dirty || pageBusy || !snapshot.pages.known;
    const checkingThis = checking || snapshot.checkingNames?.includes(target);
    const status = row.sourceKind !== 'registry' ? t('本地 / 外部来源，保留原安装方式', 'Local / external source; keep original install method') : row.loadError ? t('加载异常，请先检查官方插件管理', 'Loading error; check native plugin management') : row.error ? t('检查失败，可以重试', 'Check failed; retry available') : row.release && !row.release.compatible ? t('新版本暂不兼容当前环境：', 'Latest release is incompatible with this environment: ') + requirement(row.release) : row.available ? (prefs.ignoredVersion === row.release.version ? t('已忽略提醒，仍可手动更新', 'Reminder ignored; manual update available') : t('有新版本', 'Update available')) : row.checkedAt ? t('当前已是最新稳定版', 'Latest stable version') : t('尚未检查', 'Not checked yet');
    return h(FooterFrame, { name, label: title, subtitle: original.name + ' · ' + original.version, actions: h(W.Button, { icon: 'refresh', disabled: checkingThis || row.sourceKind !== 'registry', onClick: check }, checkingThis ? t('正在检查…', 'Checking…') : target === '@stardustlc/dsh-suite' ? t('检查整包更新', 'Check Suite updates') : t('检查更新', 'Check for updates')) },
      original.bundledBy && h(W.Status, null, t('此插件随 Suite 安装。以下设置与安装作用于 Suite 整包，以保持组件版本一致。单独安装的插件可以独立更新。', 'This plugin was installed through Suite. These controls update Suite as a package so its components stay consistent. Independently installed plugins update individually.')),
      h('section', { className: 'w-section' }, (original.bundledBy || row.available) && h('p', { className: 'updates-version' }, target + ' · ' + row.version, row.release?.version && row.release.version !== row.version ? ' → ' + row.release.version : ''), h('p', { className: 'w-muted updates-note' }, status), !row.enabled && h('p', { className: 'w-muted' }, t('当前已停用，更新后仍保持停用。', 'Currently disabled; it will remain disabled after updating.')), row.checkedAt && h('p', { className: 'w-muted updates-note' }, t('上次检查：', 'Last checked: ') + new Date(row.checkedAt).toLocaleString(language() === 'en' ? 'en-US' : 'zh-CN')),
        h('div', { className: 'w-toolbar' }, row.available && row.sourceKind === 'registry' && h(W.Button, { variant: 'primary', icon: 'download', disabled: installLocked || row.loadError, onClick: () => setDialog('install') }, target === '@stardustlc/dsh-suite' ? t('更新 Suite 整包', 'Update whole Suite') : t('更新此插件', 'Update this plugin')), row.release && h(W.Button, { variant: 'ghost', onClick: showNotes, 'aria-expanded': notesOpen }, t('更新记录', 'Release notes')), row.available && h(W.Button, { variant: 'ghost', disabled: working, onClick: () => perform(() => api({ action: 'later', name: target, revision: state.preferences.revision })) }, t('明天再提醒', 'Remind me tomorrow')), row.available && prefs.ignoredVersion !== row.release.version && h(W.Button, { variant: 'ghost', disabled: working, onClick: () => perform(() => api({ action: 'ignore', name: target, revision: state.preferences.revision, version: row.release.version })) }, t('忽略此版本提醒', 'Ignore this reminder')))),
      notesOpen && h('section', { className: 'updates-notes', 'aria-label': t('更新记录', 'Release notes') }, h('strong', null, target + ' · ' + (notes?.version || row.release?.version || '')), loadingNotes ? h('p', null, t('正在读取…', 'Loading…')) : notes?.text ? h('pre', null, notes.text) : h('p', null, t('未找到此版本的独立更新记录。', 'No separate notes were found for this version.')), notes?.url && h('a', { href: notes.url, target: '_blank', rel: 'noreferrer noopener' }, t('查看仓库更新记录', 'View repository changelog'))),
      h('details', { className: 'updates-options' }, h('summary', null, t('更新选项', 'Update options'), ' · ', prefs.checkEnabled ? t('自动检查：开', 'Checks: on') : t('自动检查：关', 'Checks: off'), ' · ', prefs.autoInstall ? t('自动安装：开', 'Install: on') : t('自动安装：关', 'Install: off')), h('section', { className: 'updates-settings', 'aria-label': t('这个插件的更新偏好', 'Update preferences for this plugin') },
        h('div', null, h(W.Switch, { label: t('自动检查这个插件的更新', 'Automatically check this plugin'), checked: prefs.checkEnabled, disabled: working || !!snapshot.preferenceError || row.sourceKind !== 'registry', onChange: event => perform(() => save({ checkEnabled: event.target.checked })) }), h('p', { className: 'w-muted updates-note' }, t('默认开启，每天最多一次。只影响这个插件，关闭后仍可手动检查。', 'On by default, at most once daily. This affects only this plugin; manual checks remain available.'))),
        h('div', null, h(W.Switch, { label: t('空闲时自动安装这个插件的补丁', 'Install patches for this plugin while idle'), checked: prefs.autoInstall, disabled: working || !!snapshot.preferenceError || row.sourceKind !== 'registry', onChange: event => event.target.checked ? setDialog('automatic') : perform(() => save({ autoInstall: false })) }), h('p', { className: 'w-muted updates-note' }, t('默认关闭。明确开启后，仅空闲且没有未保存修改时安装兼容补丁。其他插件的开关不变。', 'Off by default. Explicitly enable compatible patches while idle with no unsaved changes. Other plugins’ settings stay unchanged.'))))),
      error && h(W.Status, { tone: 'error' }, message(error)), snapshot.preferenceError && h(W.Status, { tone: 'error' }, message('preferences-unreadable')),
      snapshot.pendingRestart && h(W.Status, null, snapshot.updaterRestart ? message('restart-required') : t('已有更新等待手动重启后生效。你可以继续工作，自动安装已暂停。', 'Some updates need a manual restart. Continue your work; automatic installation is paused.')),
      prefs.autoInstall && snapshot.autoReady === false && h(W.Status, null, message('page-not-ready')),
      snapshot.pages.clients.some(client => !client.fresh) && h(W.Status, null, h('p', null, t('有窗口已断开，无法确认是否还有未保存修改。仍在使用的窗口请先保存并刷新；已关闭的窗口可以手动重新确认。', 'A disconnected window may contain unsaved changes. Save and refresh windows still in use. If they are closed, you can confirm that manually.')), h(W.Button, { onClick: () => setDialog('windows') }, t('重新确认已关闭的窗口', 'Confirm closed windows'))),
      (snapshot.pages.dirty || ownPage.dirty) && h(W.Status, null, message('page-dirty')), (snapshot.activity.busy || pageBusy) && h(W.Status, null, message(snapshot.activity.busy ? 'busy' : 'page-busy')),
      prefs.deferredUntil > Date.now() && h(W.Status, null, t('此插件已推迟提醒和自动安装 24 小时，仍可手动更新。', 'Reminders and automatic installation for this plugin are deferred for 24 hours. Manual updates remain available.')),
      unconfirmed && h(W.Status, { tone: 'error' }, message('operation-unconfirmed')),
      job && h('section', { className: 'w-section', 'aria-label': t('这个插件的更新进度', 'Update progress for this plugin') }, h('h3', null, jobLabel(job)), h('p', { className: 'w-muted' }, job.from + ' → ' + job.to + (job.mode === 'automatic' ? t(' · 自动补丁更新', ' · Automatic patch') : '')), (job.reason || job.outcome?.result?.error?.code) && h(W.Status, { tone: 'error' }, message(job.reason || job.outcome.result.error.code)), activeJob() && h(W.Button, { disabled: job.state === 'cancelling', onClick: () => perform(() => api({ action: 'cancel', id: job.id })) }, t('取消更新', 'Cancel update')), h('p', { className: 'w-muted updates-note' }, t('安装开始后，取消由官方包管理器处理；已落盘的写入以实际结果或恢复状态为准。', 'After installation starts, the native package manager handles cancellation. Completed writes and recovery are reported as they occur.'))),
      dialog && h(W.Dialog, { title: dialog === 'windows' ? t('断开的窗口都已关闭？', 'Are the disconnected windows closed?') : dialog === 'automatic' ? t('允许这个插件自动安装补丁？', 'Allow automatic patches for this plugin?') : t('确认更新此插件', 'Confirm this plugin update'), closeLabel: t('关闭', 'Close'), onClose: () => setDialog(null) },
        target === '@stardustlc/dsh-suite' && h('p', null, t('此处操作的是 Suite 整包，包含 18 个组件。独立安装的其他插件不受影响。', 'This action applies to the whole Suite, including its 18 components. Other independently installed plugins are unaffected.')),
        dialog === 'windows' ? h('div', { className: 'w-stack' }, h('p', null, t('只清除超过 45 秒未回应的其他窗口记录。请先确认它们已经关闭；仍在使用的窗口请保存修改并刷新。当前或仍在回应的窗口保护会保留。', 'Only other windows silent for over 45 seconds are cleared. Confirm that they are closed; save and refresh windows still in use. Current and responsive windows remain protected.')), h('div', { className: 'w-toolbar' }, h(W.Button, { onClick: () => setDialog(null) }, t('取消', 'Cancel')), h(W.Button, { onClick: () => { setDialog(null); void perform(() => api({ ...pageState(true), action: 'reconfirm-windows', confirmation: 'other-stale-windows-are-closed' })); } }, t('已关闭，重新确认状态', 'They are closed; reconfirm')))) :
        dialog === 'automatic' ? h('div', { className: 'w-stack' }, h('p', null, (language() === 'en' ? row.labelEn : row.label) + ' · ' + target), h('p', null, t('你正在主动启用这个插件的自动安装。只处理兼容的稳定补丁；有任务、未保存修改、未知窗口或等待重启时暂停。', 'You are explicitly enabling automatic installation for this plugin. Only compatible stable patches qualify; running tasks, unsaved changes, unknown windows or a pending restart pause it.')), h('p', null, t('不会自动重启 DSH，其他插件不会跟着开启。可随时关闭。', 'DSH will not restart automatically, and other plugins will not be enabled for automatic updates. Turn it off anytime.')), h('div', { className: 'w-toolbar' }, h(W.Button, { onClick: () => setDialog(null) }, t('保持关闭', 'Keep off')), h(W.Button, { variant: 'primary', onClick: () => { setDialog(null); void perform(() => save({ checkEnabled: true, autoInstall: true }, 'enable-idle-patch-updates')); } }, t('允许此插件自动安装补丁', 'Allow patches for this plugin')))) :
        h('div', { className: 'w-stack' }, h('p', { className: 'updates-version' }, target + ': ' + row.version + ' → ' + row.release.version), h('p', null, t('通过 DSH 官方插件管理器安装。需要重启时，由你手动决定时间；停用状态会保留。', 'Install through DSH’s native plugin manager. Choose when to restart if needed; disabled status is preserved.')), h('p', { className: 'w-muted' }, t('来源：npm 官方 registry，网络不可达时回退 npmmirror。安装前再次核对版本与完整性。', 'Source: official npm registry, with npmmirror fallback if unreachable. Version and integrity are checked again before installation.')), (ownPage.dirty || snapshot.pages.dirty) && h(W.Status, null, message('page-dirty')), h('div', { className: 'w-toolbar' }, h(W.Button, { onClick: () => setDialog(null) }, t('取消', 'Cancel')), h(W.Button, { variant: 'primary', disabled: installLocked || row.loadError, onClick: install }, t('确认安装此版本', 'Install this version')))))
    );
  }
  function NativeFooter({ subject }) {
    const snapshot = useSnapshot(), name = __stardustUpdatesDetailName(subject, snapshot?.rows || []);
    return name ? h(Panel, { name }) : null;
  }
  function Reminder() {
    useSnapshot();
    const row = state?.rows.find(row => { const prefs = preferences(row.name); return row.available && !row.updating && !row.bundledBy && prefs.checkEnabled && prefs.deferredUntil <= Date.now() && prefs.ignoredVersion !== row.release.version && !notified.has(row.name + '@' + row.release.version); });
    if (!row && !legacyHint) return null;
    let Toast; try { Toast = require('@deepseek-ai/dsh-client-ui-primitives').Toast; } catch { return null; }
    if (!Toast) return null;
    const hint = legacyHint, key = hint ? 'legacy-' + hint : row.name + '@' + row.release.version;
    return h(Toast, { key, text: hint ? hint + t('：请打开「插件」中的此插件详情页，在底部管理更新。', ': open its details in Plugins to manage updates at the bottom.') : (language() === 'en' ? row.labelEn : row.label) + t('有新版本，可在页面底部查看。', ' has an update. Review it at the bottom of its page.'), icon: h(W.Icon, { name: 'refresh', size: 18 }), holdMs: 7000, onDone: () => { if (hint) legacyHint = null; else notified.add(key); notify(); } });
  }
  function register() {
    if (!alive) return;
    if (!registered) {
      registered = true; pool.clients.add(client);
      ctx.slots.inject('plugins.detail.section', () => ctx.slots.register({ name: 'plugins.detail.section', id: 'stardustlc.plugin-update-footer', order: 1000 }, NativeFooter));
      ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'stardustlc.plugin-update-reminder' }, Reminder));
      notify();
    }
  }
  async function poll() {
    if (inPoll || !alive || !shared.refs.size) return;
    inPoll = true;
    try { await refresh(); register(); await heartbeat(); }
    catch { /* Owner-only controls stay absent for guests and unsupported hosts. */ }
    finally { inPoll = false; }
  }
  const timer = setInterval(() => { void poll(); }, 15000), first = setTimeout(() => { void poll(); }, 100);
  const client = { t, Footer: Panel, Button: W.Button, open(name) { const footer = [...document.querySelectorAll('[data-plugin-update-footer]')].find(node => node.getAttribute('data-plugin-update-footer') === name); if (footer) footer.scrollIntoView({ block: 'end', behavior: 'smooth' }); else { legacyHint = name; notify(); } }, has: name => registered && !!originalRow(name), row: rowFor, dispose() {
    close(); alive = false; clearTimeout(first); clearInterval(timer); pool.clients.delete(client);
    pool.listeners.delete(guardChanged); listeners.clear();
    for (const event of ['pointerdown', 'keydown', 'input']) document.removeEventListener(event, interaction, true);
    window.removeEventListener('pagehide', close);
    for (const controller of requests) controller.abort();
    for (const listener of pool.viewListeners) listener();
  } };
  return client;
}

/* STARDUSTLC_UPDATE_CLIENT_BODY_START */
// Generated from templates/client.js, templates/panels/, templates/client-ru.js, lib/model-catalog.js and templates/workbench-ui.js. Edit the sources.
(function () {
/* DSH workbench UI v1. MIT. Canonical source: dsh-suite/ui/workbench-ui.js.
 * Vendored into each plugin: no Suite or extra runtime dependency is required.
 * Styles are scoped to .dshw and never replace the host chrome or theme.
 */
function createWorkbenchUI(React) {
  const h = React.createElement;
  const { useEffect, useId, useRef } = React;
  const cx = (...values) => values.filter(Boolean).join(' ');
  const paths = {
    book: ['M4 4h6a3 3 0 0 1 2 2v15a4 4 0 0 0-4-2H4z', 'M20 4h-6a3 3 0 0 0-2 2v15a4 4 0 0 1 4-2h4z'],
    calendar: ['M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2Z', 'M7 3v4M17 3v4M3 10h18'],
    mail: ['M3 5h18v14H3z', 'm3 6 9 7 9-7'],
    rss: ['M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16', 'M4 19h.01'],
    slides: ['M3 4h18v13H3z', 'M12 17v4M8 21h8'],
    shield: ['m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6z', 'm8 12 3 3 5-6'],
    layers: ['M5 3h16v16H5z', 'M2 7v15h15'],
    play: ['m9 6 9 6-9 6Z'],
    video: ['M3 5h12v14H3z', 'm15 10 6-4v12l-6-4'],
    search: ['M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z', 'm16 16 5 5'],
    plus: ['M12 5v14M5 12h14'],
    refresh: ['M20 7a9 9 0 1 0 1 8', 'M20 2v5h-5'],
    settings: ['m9 3-.7 2.4-2 .9L4 5.8 2.5 8.4l1.7 1.8v2.3L2.5 14 4 17l2.5-.4 1.9 1L9 20h3l.8-2.4 2-1 2.5.4 1.5-2.7-1.7-1.9v-2.2l1.7-1.8-1.5-2.6-2.5.4-2-1L12 3Z', 'M14 11.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z'],
    close: ['m6 6 12 12M18 6 6 18'],
    left: ['m14 5-7 7 7 7'],
    right: ['m10 5 7 7-7 7'],
    down: ['m5 9 7 7 7-7'],
    filter: ['M4 5h16M7 12h10M10 19h4'],
    download: ['M12 3v12m-5-5 5 5 5-5', 'M4 16v5h16v-5'],
    upload: ['M12 16V4m-5 5 5-5 5 5', 'M4 16v5h16v-5'],
    copy: ['M8 8h13v13H8z', 'M16 8V3H3v13h5'],
    external: ['M14 3h7v7m0-7L10 14', 'M10 3H3v18h18v-7'],
    file: ['M4 3h10l6 6v12H4z', 'M14 3v6h6M8 13h8M8 17h6'],
    folder: ['M3 5h7l2 3h9v12H3z'],
    edit: ['m15 4 5 5-10 10-6 1 1-6Z', 'm13 6 5 5'],
    trash: ['M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7'],
    more: ['M5 12h.01M12 12h.01M19 12h.01'],
    info: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M12 11v6M12 7h.01'],
    check: ['m5 12 4 4L19 6'],
    quote: ['M4 12h6v7H3v-7c0-4 2-6 5-7M15 12h6v7h-7v-7c0-4 2-6 5-7'],
    star: ['m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z'],
    reply: ['m9 5-7 7 7 7v-5h6c3 0 5 2 6 5 0-8-4-11-12-11Z'],
    link: ['m10 13 4-4M8 16l-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0', 'm14 8 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0'],
  };
  function Icon({ name = 'file', size = 20, ...props }) {
    return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false, ...props },
      (paths[name] || paths.file).map((d, index) => h('path', { key: index, d })));
  }
  function Button({ children, icon, variant, className, ...props }) {
    return h('button', { type: 'button', ...props, className: cx('w-button', variant && 'w-' + variant, className) }, icon ? h(Icon, { name: icon, size: 18 }) : null, children);
  }
  function IconButton({ label, icon, ...props }) {
    return h(Button, { ...props, icon, className: cx('w-icon-button', props.className), 'aria-label': label, title: label });
  }
  function Page({ title, subtitle, actions, children, workbench = false, className, rootRef, ...props }) {
    return h('section', { ...props, ref: rootRef, className: cx('dshw', 'w-page', className), 'data-main': workbench ? 'true' : 'false' },
      h(Styles, { key: 'styles' }),
      h('header', { className: 'w-page-header' }, h('div', { className: 'w-heading' }, h('h1', null, title), subtitle ? h('p', { className: 'w-subtitle' }, subtitle) : null), actions ? h('div', { className: 'w-header-actions' }, actions) : null),
      h('div', { className: 'w-body' }, children));
  }
  function Tabs({ items, value, onChange, label, children }) {
    const id = useId();
    const active = items.some(item => item.id === value) ? value : items[0]?.id;
    function keys(event, index) {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
      const node = event.currentTarget.parentElement?.querySelectorAll('[role=tab]')[next];
      if (node) { onChange(items[next].id); node.focus(); }
    }
    return h('div', { className: 'w-tabs-layout' },
      h('div', { className: 'w-tabs', role: 'tablist', 'aria-label': label }, items.map((item, index) => h('button', {
        type: 'button', role: 'tab', key: item.id, id: id + '-' + item.id, 'aria-controls': id + '-panel', 'aria-selected': active === item.id, tabIndex: active === item.id ? 0 : -1,
        onClick: () => onChange(item.id), onKeyDown: event => keys(event, index),
      }, item.label, item.count !== undefined ? h('span', { className: 'w-count' }, item.count) : null))),
      h('div', { className: 'w-tab-panel', id: id + '-panel', role: 'tabpanel', 'aria-labelledby': id + '-' + active }, children));
  }
  function Status({ children, tone = 'info', className }) {
    if (!children) return null;
    return h('div', { className: cx('dshw', 'w-status', 'w-status-' + tone, className), role: tone === 'error' ? 'alert' : 'status', 'aria-live': tone === 'error' ? 'assertive' : 'polite' }, h(Icon, { name: tone === 'success' ? 'check' : 'info', size: 18 }), h('div', null, children));
  }
  function Empty({ title, children, action, icon = 'file' }) {
    return h('div', { className: 'dshw w-empty' }, h(Styles, { key: 'styles' }), h(Icon, { name: icon, size: 32 }), h('h2', null, title), children ? h('div', { className: 'w-muted' }, children) : null, action ? h('div', { className: 'w-toolbar' }, action) : null);
  }
  function Split({ list, detail, selected, onBack, backLabel, className, listWidth = 360 }) {
    const ref = useRef(null);
    useEffect(() => {
      if (!selected || !ref.current || ref.current.clientWidth > 760) return;
      const heading = ref.current.querySelector('.w-detail h2');
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    }, [selected]);
    return h('div', { ref, className: cx('w-split', className), 'data-selected': selected ? 'true' : 'false', style: { '--w-list-width': listWidth + 'px' } },
      h('div', { className: 'w-master' }, list),
      h('div', { className: 'w-detail' }, selected ? h(Button, { className: 'w-back', icon: 'left', variant: 'ghost', onClick: onBack }, backLabel) : null, detail));
  }
  function Row({ title, meta, description, active, onClick, children, status, className, disabled }) {
    return h('div', { className: cx('w-row', active && 'w-selected', className) },
      children ? h('div', { className: 'w-row-select' }, children) : null,
      h('button', { type: 'button', className: 'w-row-button', onClick, disabled, 'aria-pressed': !!active },
        h('span', { className: 'w-row-head' }, h('strong', null, title), status ? h('span', { className: 'w-tag' }, status) : null),
        meta ? h('span', { className: 'w-row-meta' }, meta) : null,
        description ? h('span', { className: 'w-row-description' }, description) : null));
  }
  function Search({ label, value, onChange, ...props }) {
    const id = useId();
    return h('div', { className: 'w-search' }, h(Icon, { name: 'search', size: 18 }), h('input', { type: 'search', id, 'aria-label': label, placeholder: label, value, onChange, ...props }));
  }
  function Switch({ label, checked, onChange, disabled }) {
    return h('label', { className: 'w-switch-label' }, h('span', null, label), h('input', { type: 'checkbox', role: 'switch', checked, disabled, onChange, 'aria-label': label }), h('span', { className: 'w-switch-track', 'aria-hidden': true }));
  }
  function Dialog({ title, children, onClose, closeLabel, className, busy = false }) {
    const id = useId(), panel = useRef(null);
    useEffect(() => {
      const previous = document.activeElement;
      panel.current?.querySelector('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')?.focus();
      return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
    }, []);
    function keydown(event) {
      if (event.key === 'Escape' && !event.isComposing) { event.preventDefault(); event.stopPropagation(); if (!busy) onClose(); return; }
      if (event.key !== 'Tab') return;
      const controls = [...panel.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')].filter(node => node.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (!controls.length) { event.preventDefault(); panel.current.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    return h('div', { className: 'dshw w-overlay', onClick: event => { if (!busy && event.target === event.currentTarget) onClose(); } },
      h(Styles, { key: 'styles' }),
      h('section', { ref: panel, className: cx('w-dialog', className), role: 'dialog', 'aria-modal': true, 'aria-labelledby': id, tabIndex: -1, onKeyDown: keydown },
        h('header', { className: 'w-dialog-header' }, h('h2', { id }, title), h(IconButton, { icon: 'close', label: closeLabel, disabled: busy, onClick: onClose })), h('div', { className: 'w-dialog-body' }, children)));
  }
  function register(ctx, { id, label, icon, component, inject, order = 50 }) {
    // The two slots are optional. Existing settings and manual tools still load
    // in hosts without a workbench, while RC.3 owns navigation/pinning itself.
    ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: id, inject: () => ({ ...(inject?.() || {}), workbench: true }) }, component));
    ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id, order, label }, function WorkbenchIcon({ size }) { return h(Icon, { name: icon, size }); }));
  }
  const styles = `
.dshw{--w-bg:var(--dsw-alias-bg-layer-1,#fff);--w-soft:var(--dsw-alias-bg-layer-2,#f7f8fa);--w-text:var(--dsw-alias-label-primary,#18202c);--w-muted:var(--dsw-alias-label-secondary,#667085);--w-border:var(--dsw-alias-border-l3,#e7e9ef);--w-accent:var(--dsh-plugin-workbench-accent,#4f6bdb);--w-selected:color-mix(in srgb,var(--w-accent) 10%,var(--w-bg));--w-primary:var(--w-text);--w-on-primary:var(--w-bg);container-type:inline-size;container-name:dsh-workbench;color:var(--w-text);font:14px/1.65 var(--dsh-font-family-content,system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif);min-width:0;max-width:100%;box-sizing:border-box;text-align:start;color-scheme:inherit}
.dshw *,.dshw *:before,.dshw *:after{box-sizing:border-box}.dshw h1,.dshw h2,.dshw h3,.dshw h4,.dshw p{margin:0}.dshw h1{font-size:30px;line-height:1.25;letter-spacing:-.025em;font-weight:650}.dshw h2{font-size:24px;line-height:1.35;font-weight:650;letter-spacing:-.015em;overflow-wrap:anywhere}.dshw h3,.dshw h4{font-size:16px;line-height:1.4;font-weight:600}.dshw a{color:var(--w-accent);text-underline-offset:3px;overflow-wrap:anywhere}.dshw button,.dshw input,.dshw select,.dshw textarea{font:inherit;color:inherit;max-width:100%}.dshw input:not([type=checkbox]):not([type=radio]):not([type=file]),.dshw select,.dshw textarea{background:var(--dsw-specific-input-major,var(--w-bg));border:1px solid var(--w-border);border-radius:8px;padding:8px 11px;min-width:0;line-height:1.5}.dshw input:not([type=checkbox]):not([type=radio]):not([type=file]),.dshw select{min-height:38px}.dshw textarea{resize:vertical}.dshw input[type=checkbox],.dshw input[type=radio]{width:16px;height:16px;flex-shrink:0;accent-color:var(--w-accent)}.dshw :focus-visible{outline:2px solid var(--w-accent);outline-offset:3px}.dshw button:disabled,.dshw input:disabled,.dshw select:disabled,.dshw textarea:disabled{opacity:.5;cursor:not-allowed}.dshw label{font-size:13px}.dshw fieldset{min-width:0;border:1px solid var(--w-border);border-radius:8px}.dshw summary{cursor:pointer;font-weight:550;list-style:none;display:flex;align-items:center;gap:8px}.dshw summary::-webkit-details-marker{display:none}.dshw summary:after{content:'';display:block;margin-inline-start:auto;width:7px;height:7px;border-inline-end:1.75px solid currentColor;border-bottom:1.75px solid currentColor;transform:rotate(45deg);flex-shrink:0}.dshw details[open]>summary:after{transform:rotate(225deg)}.dshw details>summary+*{margin-top:12px}.dshw pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.7 ui-monospace,SFMono-Regular,Consolas,monospace;max-width:100%;background:var(--w-soft);border-radius:6px;padding:14px}.dshw img,.dshw video,.dshw iframe{max-width:100%}
.w-page{display:flex;flex-direction:column;position:relative;padding:0;min-height:540px;gap:0}.w-page[data-main=true]{height:100%;min-height:0;padding:calc(24px + var(--dsh-frame-top-clearance,0px)) 28px 0 max(28px,var(--dsh-frame-leading-clearance,0px));overflow:auto}.dshw[data-main=true]{background:var(--w-bg)}.dshw.w-page,.dshw .w-body,.dshw .w-tab-panel{overflow-x:clip}.w-page-header{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;padding-bottom:22px;flex-shrink:0}.w-heading{min-width:0}.w-subtitle{margin-top:8px!important;font-size:14px;color:var(--w-muted);line-height:1.6}.w-header-actions,.w-toolbar,.w-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-width:0}.w-header-actions{justify-content:flex-end}.w-body,.w-tabs-layout{display:flex;flex-direction:column;flex:1;min-height:0;min-width:0}.w-body{overflow:auto}.w-tab-panel{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;overflow:auto}.w-tabs{display:flex;align-items:stretch;gap:20px;border-bottom:1px solid var(--w-border);flex-shrink:0;overflow-x:auto;scrollbar-width:thin}.dshw .w-tabs>button{border:0;border-bottom:2px solid transparent;background:transparent;padding:11px 8px 13px;white-space:nowrap;font-size:14px;font-weight:550;cursor:pointer;color:var(--w-muted);display:flex;align-items:center;gap:7px}.dshw .w-tabs>button[aria-selected=true]{border-bottom-color:var(--w-accent);color:var(--w-accent)}.w-count,.w-tag{font-size:12px;line-height:1.5;display:inline-flex;align-items:center;flex-shrink:0;background:var(--w-soft);border-radius:5px;padding:1px 6px;color:var(--w-muted)}.w-tabs [aria-selected=true] .w-count,.w-selected .w-tag{color:var(--w-accent);background:var(--w-selected)}
.dshw .w-button{display:inline-flex;justify-content:center;align-items:center;gap:7px;background:var(--w-bg);border:1px solid var(--w-border);border-radius:8px;padding:8px 12px;min-height:36px;line-height:1.4;font-size:14px;font-weight:500;cursor:pointer;text-decoration:none;white-space:normal}.dshw .w-button:not(:disabled):hover{background:var(--w-soft)}.dshw .w-primary{background:var(--w-primary);border-color:var(--w-primary);color:var(--w-on-primary)}.dshw .w-primary:not(:disabled):hover{background:var(--w-primary);opacity:.9}.dshw .w-ghost{background:transparent;border-color:transparent}.dshw .w-danger{color:var(--dsw-alias-state-error-primary,#b43c3c)}.dshw .w-icon-button{width:36px;min-width:36px;padding:8px}.dshw .w-button svg{flex-shrink:0}.w-muted{color:var(--w-muted);font-size:12px;line-height:1.6}.w-section{padding:24px 0;border-bottom:1px solid var(--w-border);min-width:0}.w-section>h3{margin-bottom:12px}.w-section>p+p{margin-top:8px}.w-fields{display:grid;gap:16px;min-width:0}.w-field{display:grid;gap:6px;min-width:0}.w-field>input,.w-field>select,.w-field>textarea{width:100%}.w-status{display:flex;align-items:flex-start;gap:8px;padding:11px 13px;margin:12px 0;border:1px solid var(--w-border);border-radius:8px;background:var(--w-soft);font-size:13px;overflow-wrap:anywhere;flex-shrink:0}.w-status>svg{flex-shrink:0;margin-top:2px}.w-status-error{color:var(--dsw-alias-state-error-primary,#ad3636)}.w-status-success{color:var(--dsw-alias-state-success-primary,#24794a)}.w-status-warn{color:var(--dsw-alias-state-warning-primary,#8a5a00)}.w-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:14px;width:100%;max-width:580px;padding:48px 24px;margin:auto;min-height:280px;overflow-wrap:anywhere}.w-empty>svg{color:var(--w-muted)}.w-empty h2{font-size:20px}.w-empty .w-muted{font-size:14px}.w-empty .w-toolbar{justify-content:center}
.w-split{display:grid;grid-template-columns:minmax(240px,var(--w-list-width)) minmax(0,1fr);min-height:460px;flex:1;min-width:0}.w-master{min-width:0;border-inline-end:1px solid var(--w-border);overflow:auto;padding-bottom:24px}.w-detail{min-width:0;padding:26px 28px;overflow:auto;overflow-wrap:anywhere;display:flex;flex-direction:column}.w-master-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:20px 16px}.w-search{display:flex;align-items:center;gap:8px;border:1px solid var(--w-border);border-radius:8px;padding:0 10px;min-width:0;flex:1;background:var(--w-bg)}.w-search>svg{color:var(--w-muted);flex-shrink:0}.dshw .w-search>input{border:0!important;background:transparent!important;padding:8px 0!important;width:100%;outline-offset:0}.w-row{display:flex;gap:0;min-width:0;position:relative;border-bottom:1px solid var(--w-border);border-inline-start:3px solid transparent}.w-row-select{display:flex;align-items:flex-start;padding:21px 0 0 14px}.dshw .w-row-button{display:flex;flex-direction:column;align-items:stretch;gap:7px;text-align:start;width:100%;padding:18px 18px 18px 16px;border:0;background:transparent;color:inherit;min-width:0;cursor:pointer;line-height:1.5}.dshw .w-row-button:hover{background:var(--w-soft)}.w-row-head{display:flex;align-items:flex-start;gap:10px;justify-content:space-between;min-width:0}.w-row-head>strong{font-size:14px;line-height:1.5;font-weight:600;overflow-wrap:anywhere}.w-row-meta,.w-row-description{color:var(--w-muted);font-size:12px;line-height:1.6;overflow-wrap:anywhere}.w-row-description{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.w-selected{background:var(--w-selected);border-inline-start-color:var(--w-accent)}.w-back{display:none!important}.w-detail-title{margin-bottom:12px!important}.w-detail-meta{color:var(--w-muted);font-size:13px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.w-detail-footer{padding:24px 0;display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:auto;border-top:1px solid var(--w-border)}.w-detail-footer .w-muted{flex:1;min-width:160px}.w-definition{display:grid;grid-template-columns:minmax(80px,120px) minmax(0,1fr);gap:8px 16px;font-size:14px;margin:20px 0}.w-definition dt{color:var(--w-muted)}.w-definition dd{margin:0;min-width:0;overflow-wrap:anywhere}
.w-switch-label{display:inline-flex;align-items:center;gap:8px;font-size:13px;position:relative;cursor:pointer}.w-switch-label>input{position:absolute;opacity:0;inset-inline-end:0;width:36px!important;height:22px!important;margin:0;cursor:pointer}.w-switch-track{width:36px;height:22px;border-radius:12px;display:block;background:var(--w-border);border:1px solid var(--w-border);pointer-events:none;padding:2px;transition:background .15s}.w-switch-track:before{content:'';display:block;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px #0002;transition:transform .15s}.w-switch-label>input:checked+.w-switch-track{background:var(--w-accent);border-color:var(--w-accent)}.w-switch-label>input:checked+.w-switch-track:before{transform:translateX(14px)}.w-switch-label>input:focus-visible+.w-switch-track{outline:2px solid var(--w-accent);outline-offset:3px}.w-switch-label:has(>input:disabled){opacity:.5;cursor:not-allowed}
.w-overlay{position:fixed;inset:0;background:#0005;display:flex;justify-content:flex-end;z-index:1000;padding:12px;overflow:auto}.w-dialog{width:min(620px,100%);max-height:100%;display:flex;flex-direction:column;min-height:0;background:var(--w-bg);color:var(--w-text);border:1px solid var(--w-border);border-radius:12px;box-shadow:0 18px 70px #0003}.w-dialog-header{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 24px;border-bottom:1px solid var(--w-border);flex-shrink:0}.w-dialog-header>h2{font-size:20px}.w-dialog-body{overflow:auto;padding:20px 24px;min-height:0}.w-editor-grid{display:grid;grid-template-columns:210px minmax(0,1fr) 300px;min-height:500px;flex:1}.w-editor-list{padding:20px 12px;border-inline-end:1px solid var(--w-border);min-width:0}.w-editor-canvas{background:var(--w-soft);padding:20px;min-width:0;display:flex;flex-direction:column;gap:14px}.w-editor-inspector{padding:24px;border-inline-start:1px solid var(--w-border);min-width:0;overflow:auto}.w-editor-inspector h3{margin-bottom:18px}.w-preview-empty{display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:12px;aspect-ratio:16/9;min-height:180px;background:var(--w-soft);border:1px solid var(--w-border);border-radius:8px;padding:24px;color:var(--w-muted)}.w-content-pad{padding:24px 0}.w-stack{display:flex;flex-direction:column;gap:16px;min-width:0}.w-scroll-x{overflow:auto;max-width:100%}
@container dsh-workbench (max-width:1000px){.w-editor-grid{grid-template-columns:160px minmax(0,1fr)}.w-editor-inspector{grid-column:1/-1;border-inline-start:0;border-top:1px solid var(--w-border)}.w-header-actions{max-width:60%}.w-split{grid-template-columns:minmax(240px,32%) minmax(0,1fr)}}
@container dsh-workbench (max-width:760px){.w-page-header{gap:14px;flex-wrap:wrap;padding-bottom:18px}.w-heading{flex:1;min-width:170px}.dshw h1{font-size:24px}.w-header-actions{max-width:100%;justify-content:flex-start}.w-subtitle{font-size:13px}.w-tabs{gap:12px}.dshw .w-tabs>button{padding:10px 4px 12px}.w-split{display:block;min-height:360px}.w-split[data-selected=false]>.w-detail{display:none}.w-split[data-selected=true]>.w-master{display:none}.w-master{border-inline-end:0}.w-detail{padding:20px 0}.w-back{display:inline-flex!important;align-self:flex-start;margin:0 0 16px!important}.w-detail h2{font-size:22px}.w-master-toolbar{padding:16px 0}.dshw .w-row-button{padding:16px 10px}.w-detail-footer{position:static}.w-detail-footer .w-muted{flex-basis:100%}.w-editor-grid{display:flex;flex-direction:column}.w-editor-list{border-inline-end:0;border-bottom:1px solid var(--w-border);padding:16px 0}.w-editor-canvas{padding:16px 0;background:var(--w-bg)}.w-editor-inspector{padding:20px 0}.w-dialog-header,.w-dialog-body{padding:16px}.w-button{min-height:40px}.w-definition{grid-template-columns:80px minmax(0,1fr)}}
@media(max-width:700px){.w-page[data-main=true]{padding:calc(16px + var(--dsh-frame-top-clearance,0px)) 16px 0 max(16px,var(--dsh-frame-leading-clearance,0px))}.w-overlay{padding:8px}.w-dialog{width:100%}}
@media(prefers-reduced-motion:reduce){.dshw *,.dshw *:before{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
`;
  function Styles() { return h('style', null, styles); }
  return { Icon, Button, IconButton, Page, Tabs, Status, Empty, Split, Row, Search, Switch, Dialog, Styles, register, styles };
}

// Русская локаль интерфейса dsh-ppt (рабочий стол в настройках DSH; содержимое слайдов не переводится).
// Ключ — китайский оригинал, как в EN-словаре (templates/client.js). Цепочка при локали хоста ru:
// RU[zh] → английский аргумент/EN-словарь → китайский оригинал. Новые строки апстрима до перевода
// показываются по-английски.
// Единая терминология (все строки файла):
//   演示文稿 → презентация (раздел настроек — «Презентации»)
//   页 / 页面 → слайд
//   工程 → проект
//   成品 → готовые файлы (成品包 → пакет готовых файлов, 分享包 → пакет для публикации)
//   演讲备注 → заметки докладчика (讲稿 → текст выступления)
//   更新 → обновление
//   撤销 → отмена правки · 修订 → ревизия · 渲染 → рендеринг · 演练 → репетиция
//   视觉检查 → визуальная проверка · 数据与推演 → данные и сценарии · 假设 → допущение
// Фрагменты-конкатенации (页 · 修订, 显示 N 个工程 и т.п.) используют форму множественного числа по умолчанию.
const RU = Object.freeze({
    // Поля и статусы редактора (EN-словарь)
    "标题": "Заголовок",
    "副标题": "Подзаголовок",
    "眉题": "Надзаголовок",
    "正文": "Текст",
    "要点（每行一条）": "Тезисы (по одному в строке)",
    "演讲备注": "Заметки докладчика",
    "无法读取服务响应，请检查插件是否加载": "Не удалось прочитать ответ сервера. Проверьте, что плагин загружен.",
    "操作未完成": "Операция не завершена.",
    "正在处理，请稍候…": "Идёт обработка, пожалуйста, подождите…",
    "操作失败": "Не удалось выполнить операцию.",
    "已定位到": "Выбрано поле ",
    "，在字段中修改后保存。": ". Измените его и сохраните.",
    "点击预览里的文字，或在下方修改字段。": "Нажмите на текст в предпросмотре или отредактируйте поля ниже.",
    "当前页已被删除，输入仍保留，请复制需要的内容后取消修改。": "Этот слайд был удалён. Ваш ввод сохранён; скопируйте нужное, затем отмените правки.",
    "已载入最新版本并保留你的修改，请核对后再保存。": "Загружена последняя версия с сохранением ваших правок. Проверьте их перед сохранением.",
    "内容没有变化。": "Содержимое не изменилось.",
    "已保存，HTML、PPTX 和工程文件已同步更新。": "Сохранено. HTML, PPTX и файлы проекта обновлены вместе.",
    "页面顺序已更新，可撤销。": "Порядок слайдов обновлён. Можно отменить.",
    "复制本页": "Дублировать слайд",
    "删除本页": "Удалить слайд",
    "页面已复制，图片、图表和备注一并保留，可撤销。": "Слайд продублирован вместе с изображениями, диаграммами и заметками. Можно отменить.",
    "页面已删除，可撤销。": "Слайд удалён. Можно отменить.",
    "已撤销上次修改。": "Последняя правка отменена.",
    "当前 PPTX 已生成逐页图片，请查看画面。": "Для текущего PPTX созданы изображения слайдов. Просмотрите их.",
    "正在渲染最终 PPTX，较大文件可能需要几分钟…": "Идёт рендеринг итогового PPTX; для больших файлов это может занять несколько минут…",
    "已请求下载，请查看浏览器的下载列表。": "Загрузка запрошена. Проверьте список загрузок браузера.",
    "请选择 5 MiB 以内的 PNG 或 JPEG 图片。": "Выберите изображение PNG или JPEG размером до 5 МиБ.",
    "无法读取图片，请重试。": "Не удалось прочитать изображение. Попробуйте снова.",
    "正在读取图片，切换页面会取消本次读取。": "Изображение читается; переход к другому слайду отменит чтение.",
    "图片已载入，保存后生效。": "Изображение загружено и применится после сохранения.",
    "下载讲稿 Markdown": "Скачать текст выступления (Markdown)",
    "另存副本": "Сохранить копию",
    "副本已保存，原文件保留。副本从工程生成，不包含 Office 手工修改。": "Копия сохранена, исходные файлы не тронуты. Копия создаётся из проекта и не включает правки, сделанные в Office вручную.",
    "演示文稿编辑": "Редактор презентаций",
    "修改本插件生成的成品，保存时同步更新 HTML、可编辑 PPTX 和工程文件。": "Редактируйте готовые файлы, созданные этим плагином: при сохранении обновляются HTML, редактируемый PPTX и файлы проекта.",
    "载入最新版本，保留我的输入": "Загрузить последнюю версию, сохранив мой ввод",
    "刷新项目": "Обновить проекты",
    "还没有可以编辑的项目": "Пока нет проектов для редактирования",
    "先在对话中让助手生成演示文稿。已有项目可以让助手调用 ppt_check 检查一次，它会出现在这里。": "Попросите ассистента создать презентацию в чате. Для существующего проекта попросите его один раз запустить ppt_check — проект появится здесь.",
    "示例：请把这份材料制作成可直接交付的演示文稿，生成 HTML、PPTX 和工程文件。": "Пример: «Сделай из этих материалов презентацию, готовую к сдаче: HTML, PPTX и файлы проекта».",
    "返回项目": "К проектам",
    " 页 · 修订 ": " слайдов · ревизия ",
    "页面": "Слайды",
    "未命名页": "Слайд без названия",
    "上移": "Выше",
    "下移": "Ниже",
    "HTML 预览": "Предпросмотр HTML",
    "最终 PPTX 预览": "Предпросмотр итогового PPTX",
    "渲染当前 PPTX": "Отрендерить текущий PPTX",
    "演示文稿 HTML 预览": "Предпросмотр HTML презентации",
    "此项目尚无 HTML，请保存一次生成预览。": "У проекта пока нет HTML. Сохраните его один раз, чтобы создать предпросмотр.",
    "最终 PPTX 第 ": "Итоговый PPTX, слайд ",
    " 页渲染结果": " — изображение рендера",
    "正在载入当前页渲染…": "Загружается рендер текущего слайда…",
    "这是 HTML 放映预览。最终 PPTX 的字体和排版请用上方渲染检查。点击文字可定位编辑字段。": "Это предпросмотр HTML-показа. Шрифты и вёрстку итогового PPTX проверяйте через рендеринг выше. Нажатие на текст перемещает к полю редактирования.",
    "这是当前 PPTX 文件的实际渲染图片，仍需检查每页画面；PowerPoint / WPS 可能因字体环境而不同。": "Это изображение, отрендеренное из текущего PPTX. Проверьте каждый слайд; PowerPoint / WPS может показать его иначе в зависимости от установленных шрифтов.",
    "渲染引擎报告缺失字体：": "Рендерер сообщил о недостающих шрифтах: ",
    "。请替换为目标电脑可用字体后重新渲染。": ". Замените их шрифтами, доступными на целевом компьютере, и отрендерите снова.",
    "编辑第 ": "Редактирование слайда ",
    " 页": "",
    "有未保存修改，请先保存或取消，再切换页面。": "Есть несохранённые правки. Сохраните или отмените их перед переходом к другому слайду.",
    "这些字段也被修改过，请比较后决定是否保存：": "Эти поля тоже были изменены. Сравните их и решите, сохранять ли:",
    "最新版本：": "Последняя версия: ",
    "你的修改：": "Ваши правки: ",
    "替换图片（PNG / JPEG）": "Заменить изображение (PNG / JPEG)",
    "添加图片（会改为图文布局）": "Добавить изображение (макет станет «текст + изображение»)",
    "当前图片": "Текущее изображение",
    "已选择：": "Выбрано: ",
    "图片说明": "Описание изображения",
    "图片适应方式": "Заполнение изображения",
    "完整显示": "Показать целиком",
    "填满并裁切": "Заполнить и обрезать",
    "保存此页": "Сохранить слайд",
    "取消修改": "Отменить правки",
    "撤销上次修改": "Отменить последнюю правку",
    "质量提醒（": "Замечания по качеству (",
    "第 ": "Слайд ",
    " 页：": ": ",
    "下载最新 PPTX": "Скачать последний PPTX",
    "下载成品包 ZIP": "Скачать ZIP с готовыми файлами",
    "成品包包含 PPTX、HTML 和工程文件。请先保存修改，再下载最新版本。": "Пакет готовых файлов включает PPTX, HTML и файлы проекта. Сначала сохраните правки, затем скачивайте последнюю версию.",
    "下载 PDF": "Скачать PDF",
    "成品包含 HTML、PDF（如可用）和 PPTX；JSON 工程保存在插件中。": "Готовые файлы: HTML, PDF (если создан) и PPTX. JSON проекта хранится внутри плагина.",
    "下载 HTML": "Скачать HTML",
    "备份工程": "Резервная копия проекта",
    "快捷键：Ctrl/⌘+S 保存 · Esc 取消或返回 · Alt+←/→ 切换页面": "Горячие клавиши: Ctrl/⌘+S — сохранить · Esc — отмена или назад · Alt+←/→ — переключение слайдов",
    "未保存": "Не сохранено",
    "有未保存修改，确定取消吗？": "Отменить несохранённые правки?",
    "已取消未保存的修改。": "Несохранённые правки отменены.",
    "有未保存修改，离开页面会丢失。": "Есть несохранённые правки — при уходе со страницы они будут потеряны.",
    "重试": "Повторить",
    "复制示例": "Скопировать пример",
    "已复制示例": "Пример скопирован",
    "演示文稿": "Презентации",
    // Репетиция (AI-проверка и имитация защиты)
    "AI 预审": "ИИ-проверка",
    "模拟答辩": "Имитация защиты",
    "等待下一步": "Ожидание",
    "正在调用模型": "Вызов модели",
    "已暂停": "Приостановлено",
    "已结束": "Завершено",
    "表达建议": "Формулировки",
    "逻辑问题": "Логика",
    "证据缺口": "Не хватает доказательств",
    "先在 DSH 的模型设置中配置可用模型，再点“刷新模型”。成品仍可直接下载。": "Сначала настройте доступные модели в настройках моделей DSH, затем нажмите «Обновить модели». Готовые файлы по-прежнему можно скачать напрямую.",
    "当前回答尚未提交，离开会丢失。继续吗？": "Ответ ещё не отправлен и будет потерян при уходе. Продолжить?",
    "请选择模型": "Выберите модель",
    "已请求停止。已完成的结果保留，本次调用仍可能计费。": "Запрошена остановка. Завершённые результаты сохранены; за текущий вызов поставщик может взять плату.",
    "删除这次本地演练记录？幻灯片成品不受影响。": "Удалить эту локальную запись репетиции? Готовые файлы презентации не пострадают.",
    "请选择 100 KB 以内的 TXT / Markdown 文件。": "Выберите файл TXT или Markdown до 100 КБ.",
    "补充材料最多 20000 字符。": "Дополнительные материалы: до 20 000 символов.",
    "查看第 ": "Перейти к слайду ",
    "补充材料中的原文": "Цитата из дополнительных материалов",
    "幻灯片中的原文": "Цитата со слайдов",
    "未匹配到材料原文，请核对或补充依据。": "Цитата из материалов не найдена. Проверьте её или добавьте доказательство.",
    "可选演练": "Необязательная репетиция",
    "想再准备充分一点？": "Хотите подготовиться ещё лучше?",
    "成品已可下载。以下两项按需开启，不影响直接交付。": "Готовые файлы уже можно скачать. Обе функции ниже включаются по желанию и для сдачи не требуются.",
    "收起": "Свернуть",
    "正在处理…可以继续预览或下载成品。": "Идёт обработка… Предпросмотр и скачивание готовых файлов остаются доступны.",
    "停止": "Остановить",
    "AI 根据材料模拟质疑与回答，最多保留 5 个值得改进的问题。": "ИИ моделирует каверзные вопросы и ответы по вашим материалам, оставляя до пяти полезных замечаний.",
    "AI 一次问一题，你来回答；可随时结束并整理已完成的问答。": "ИИ задаёт по одному вопросу за раз, вы отвечаете; завершить и собрать готовые вопросы-ответы можно в любой момент.",
    "模型": "Модель",
    "演练模型": "Модель репетиции",
    "暂无可用模型": "Доступных моделей нет",
    "听众": "Аудитория",
    "一般听众": "Широкая аудитория",
    "管理层 / 客户": "Руководство / клиенты",
    "答辩评委": "Комиссия на защите",
    "提问强度": "Сложность вопросов",
    "温和": "Мягкая",
    "普通": "Обычная",
    "严格": "Строгая",
    "预审轮数": "Раунды проверки",
    "答辩题数": "Количество вопросов",
    "检查范围": "Область проверки",
    "整个工程": "Весь проект",
    "当前页": "Текущий слайд",
    "补充材料（可选）": "Дополнительные материалы (необязательно)",
    "或导入 TXT / Markdown": "или импортируйте TXT / Markdown",
    "将所选页面的文字、图表数据、备注及补充材料发送给所选 DSH 模型，不发送图片文件。最多 ": "В выбранную модель отправляются тексты выбранных слайдов, данные диаграмм, заметки и дополнительные материалы; файлы изображений не отправляются. Максимум ",
    " 次插件调用；模型服务自身的重试与计费规则仍适用。": " вызовов плагина; правила повтора и оплаты остаются за поставщиком модели.",
    "开始 AI 预审": "Запустить ИИ-проверку",
    "开始模拟答辩": "Запустить имитацию защиты",
    "刷新模型": "Обновить модели",
    "请先保存或取消幻灯片修改。": "Сначала сохраните или отмените правки слайда.",
    "修订 ": "Ревизия ",
    "调用 ": "Вызовов: ",
    "AI 意见不等于事实核验，也不代表真实听众的评价。请先看原文与改动，再决定是否采纳。": "Мнения ИИ — не проверка фактов и не оценка реальной аудитории. Сначала сравните оригинал и правки, затем решайте, принимать ли их.",
    "工程已经修改。旧报告仍可导出，但不能继续调用或采纳；请重新开始。": "Проект изменился. Старый отчёт можно экспортировать, но продолжать или принимать его нельзя; начните заново.",
    "比较原文和建议": "Сравнить «до» и «после»",
    "原文": "До",
    "建议": "После",
    "采纳这项表达修改": "Принять эту правку формулировки",
    "选为备用问答页": "Добавить как резервный слайд «вопрос-ответ»",
    "本次未提出明显问题。仍建议检查事实、字体和最终 PPTX。": "Явных замечаний нет. Всё же проверьте факты, шрифты и итоговый PPTX.",
    "你的回答：": "Ваш ответ: ",
    "待补充依据": "Нужны доказательства",
    "你的回答": "Ваш ответ",
    "提交回答，继续": "Отправить ответ и продолжить",
    "下载问答与材料清单": "Скачать вопросы-ответы и список материалов",
    "将所选内容保存为副本": "Сохранить выбранное как копию",
    "结束并整理已有结果": "Завершить с имеющимися результатами",
    "重新开始": "Начать заново",
    "删除本次记录": "Удалить эту запись",
    "采纳后会生成新副本，原稿保留；副本中可“撤销上次修改”。备用页包含 AI 演练标记，请核对后再对外展示。": "После принятия создаётся новая копия, оригинал сохраняется; в копии работает «Отменить последнюю правку». Резервные слайды помечены как материал ИИ-репетиции — проверьте их перед показом.",
    "本机历史记录（": "Локальная история (",
    "）": ")",
    // Визуальная проверка и исправление
    "正在渲染实际 PPTX": "Рендеринг фактического PPTX",
    "正在看图检查": "Проверка изображений слайдов",
    "正在生成排版副本": "Создание копии с исправленной вёрсткой",
    "检查已结束": "Проверка завершена",
    "标题字号": "Размер заголовка",
    "正文字号": "Размер текста",
    "图表字号": "Размер подписей диаграмм",
    "改为横向条形图": "Перевести в горизонтальные бары",
    "完整显示图片": "Показать изображение целиком",
    "拆分要点页": "Разделить слайд с тезисами",
    "拆分表格页": "Разделить слайд с таблицей",
    "视觉检查失败": "Не удалось выполнить визуальную проверку",
    "请选择支持图片输入的模型": "Выберите модель с поддержкой изображений",
    "删除这次检查记录和预览图片？生成的 PPT 副本会保留。": "Удалить эту запись проверки и изображения предпросмотра? Созданные копии PPT сохранятся.",
    "此页由拆分生成，没有对应的原页画面。": "Этот слайд получен разделением, изображения исходного слайда для него нет.",
    "画面尚未载入，请重新选择页面。": "Изображение ещё не загружено. Выберите слайд снова.",
    "视觉检查与修复": "Визуальная проверка и исправление",
    "让 AI 看完成品，再修排版": "ИИ рассматривает готовые слайды и правит вёрстку",
    "可选功能。检查实际 PPTX 画面，另存修复副本，再渲染复查。原稿保留。": "Необязательная функция: проверка фактических изображений PPTX, сохранение исправленной копии и повторный рендеринг для контроля. Оригинал сохраняется.",
    "视觉模型": "Визуальная модель",
    "请选择": "Выберите модель",
    "视觉检查范围": "Область визуальной проверки",
    "全部页面（最多 12 页）": "Все слайды (до 12)",
    "自动修复上限": "Лимит автоисправлений",
    "仅看图检查": "Только просмотр изображений",
    "最多修复 1 轮（推荐）": "До 1 раунда исправлений (рекомендуется)",
    "最多修复 2 轮": "До 2 раундов исправлений",
    "未找到声明支持图片输入的模型。请在 DSH 模型设置中检查图片输入配置；普通生成和下载仍可使用。": "Модели с заявленной поддержкой изображений не найдены. Проверьте настройку ввода изображений в настройках моделей DSH; обычное создание и скачивание остаются доступны.",
    // Каскад выбора модели (RPC llm.models): флааут с провайдерами и моделями.
    "无法加载模型列表": "Не удалось загрузить список моделей",
    "正在加载模型列表…": "Загружаю список моделей…",
    "此服务没有可用模型。": "У этого провайдера нет доступных моделей.",
    "部分模型服务不可用：": "Некоторые провайдеры недоступны: ",
    "会向所选模型发送 ": "В выбранную модель отправляются ",
    " 页的渲染图片和页面文字；拆页后会重新检查新增页面，最多 ": " — рендеры слайдов и их тексты; после разделения новые слайды проверяются снова, максимум ",
    " 次模型调用。": " вызовов модели.",
    "只调整字号、拆页、图表方向和图片裁切，不改写原文、数字或公式。可随时停止；服务商仍可能收取已发起调用的费用。": "Меняются только размеры шрифтов, разбивка на слайды, ориентация диаграмм и кадрирование изображений; исходный текст, числа и формулы не переписываются. Остановить можно в любой момент; за уже отправленные вызовы поставщик может взять плату.",
    "开始看图检查": "Запустить проверку изображений",
    "刷新视觉模型": "Обновить визуальные модели",
    "检查已停止": "Проверка остановлена",
    "等待检查": "Проверка готова к запуску",
    "已调用 ": "Вызовов: ",
    "本轮已检查 ": "Проверено в этом проходе: ",
    "停止视觉检查": "Остановить визуальную проверку",
    "工程或成品已变化，旧记录可查看，但不能继续或采纳。": "Проект или готовые файлы изменились: старая запись доступна для просмотра, но продолжить или принять её нельзя.",
    "复查仍有 ": "После повторной проверки осталось проблем: ",
    " 个问题，请查看标记和说明。": ". Смотрите отметки и пояснения.",
    "AI 在本次范围内未发现明显视觉问题；这是一份模型检查记录。": "ИИ не нашёл явных визуальных проблем в этой области; это запись проверки моделью.",
    "检查轮次 ": "Раунд проверки ",
    "原第 ": "Исходный слайд ",
    "拆分页": "Разделённый слайд",
    "需要人工判断": "Требуется решение человека",
    "已应用：": "Применено: ",
    "查看前后画面（橙框为 AI 定位区域）": "Сравнить изображения (оранжевые рамки — найденные ИИ области)",
    "对比页面": "Слайд для сравнения",
    "正在载入画面…": "Загрузка изображений…",
    "原稿 · 实际 PPTX": "Оригинал · фактический PPTX",
    "修复后 · 实际 PPTX": "После исправления · фактический PPTX",
    "本次检查画面": "Проверенное изображение",
    "打开修复副本（仍有待处理问题）": "Открыть исправленную копию (есть нерешённые проблемы)",
    "采用修复副本": "Принять исправленную копию",
    "下载视觉检查记录": "Скачать запись визуальной проверки",
    "删除检查记录": "Удалить запись проверки",
    "新建视觉检查": "Новая визуальная проверка",
    "本机视觉检查历史": "Локальная история визуальных проверок",
    "收起视觉检查": "Свернуть визуальную проверку",
    // Данные и сценарии
    "请选择 1 MiB 内的 CSV、TSV、TXT 或 Markdown。": "Выберите файл CSV, TSV, TXT или Markdown до 1 МиБ.",
    "无法读取材料，请重试。": "Не удалось прочитать материалы. Попробуйте снова.",
    "推演参数文件过大。": "Файл параметров сценария слишком велик.",
    "参数来自其他工程、旧版本或格式无效，请重新导出。": "Параметры из другого проекта, устаревшей версии или в неверном формате. Экспортируйте их заново.",
    "数据溯源与现场推演": "Происхождение данных и сценарии",
    "点预览中的数字可追问来源。只有明确声明的假设可调；来源不等于事实已核验。": "Нажимайте на числа в предпросмотре, чтобы увидеть их происхождение. Меняются только явно заявленные допущения; указание источника — не проверка факта.",
    "数字来自哪里": "Откуда берутся числа",
    "指标": "Показатель",
    "来源快照校验值": "Контрольная сумма снимка источника",
    "用户假设": "Пользовательское допущение",
    "下载溯源与假设报告": "Скачать отчёт о происхождении и допущениях",
    "现场推演参数": "Параметры сценария",
    "假设": "Допущение",
    "滑杆": "ползунок",
    "导入离线 HTML 保存的推演参数": "Импортировать параметры сценария, сохранённые в автономном HTML",
    "更新来源材料": "Обновить исходные материалы",
    "先导入或粘贴新材料，预览影响后再确认；不会自动监视或修改原文件。表格可从 Excel 导出 CSV。": "Импортируйте или вставьте новые материалы, просмотрите влияние и только потом подтверждайте; исходные файлы не отслеживаются и не изменяются. Таблицы можно экспортировать из Excel в CSV.",
    "替换来源": "Заменить источник",
    "导入替换材料": "Импортировать материалы для замены",
    "分隔格式": "Разделитель",
    "或粘贴内容": "или вставьте содержимое",
    "取消此来源更新": "Отменить это обновление источника",
    "推演或材料尚未保存，当前 PPTX 仍是已保存版本。先预览差异并确认，或恢复参数后下载。": "Сценарий или материалы не сохранены; текущий PPTX — сохранённая версия. Сначала просмотрите различия и подтвердите, либо сбросьте параметры и скачивайте.",
    "参数无法计算，请检查范围、步长或除零，再恢复或修改。": "Параметры не вычисляются. Проверьте диапазоны, шаги или деление на ноль; сбросьте или исправьте их.",
    "预览差异": "Просмотреть различия",
    "恢复已保存数据": "Вернуть сохранённые данные",
    "确认前核对": "Проверка перед подтверждением",
    "来源已更新": "Источник обновлён",
    "受影响页面": "Затронутые слайды",
    "指标尚未绑定到页面，只更新数据模型。": "Показатели не привязаны к слайдам; обновляется только модель данных.",
    "查看页面": "Открыть слайд",
    "关联的来源快照有变化。": "Связанный снимок источника изменился.",
    "之前：": "До: ",
    "之后：": "После: ",
    "保存为新副本，保留原稿（推荐）": "Сохранить как новую копию, оставив оригинал (рекомендуется)",
    "PPTX 保存确认后的静态结果，并附公式、来源和假设；HTML 保留交互。JSON 工程包含导入的完整材料，分享前请检查。": "PPTX сохраняет подтверждённый статический результат с формулами, источниками и допущениями; HTML сохраняет интерактивность. JSON-проект включает все импортированные материалы — проверьте его перед публикацией.",
    "确认并保存推演副本": "Подтвердить и сохранить копию сценария",
    "确认并更新当前工程": "Подтвердить и обновить текущий проект",
    // Рабочий стол: заголовки, вкладки, загрузки
    "请先确认或恢复数据推演。": "Сначала подтвердите или сбросьте сценарий данных.",
    "已保存": "Сохранено",
    "管理、预览和编辑已生成的演示文稿。": "Управление, предпросмотр и редактирование созданных презентаций.",
    "保存修改": "Сохранить изменения",
    "先保存当前修改": "Сначала сохраните изменения",
    "下载成品": "Скачать готовые файлы",
    "数据推演或材料尚未保存，成品仍是已保存版本。": "Сценарий или материалы не сохранены; готовые файлы — в сохранённой версии.",
    "前往数据与推演": "Перейти к данным и сценариям",
    "搜索标题或工程路径": "Поиск по названиям и путям проектов",
    "演示文稿工作台视图": "Режимы рабочего стола презентаций",
    "内容编辑": "Редактирование",
    "视觉检查": "Визуальная проверка",
    "演练": "Репетиция",
    "数据与推演": "Данные и сценарии",
    "成品预览": "Предпросмотр готовых файлов",
    "查看全屏": "Во весь экран",
    "当前宿主无法进入全屏，可以继续使用页面预览。": "Текущий хост не поддерживает полноэкранный режим; предпросмотр на странице остаётся доступным.",
    "退出全屏": "Выйти из полного экрана",
    "页面与辅助工具": "Свойства слайда и инструменты",
    "页面内容": "Содержимое слайда",
    "图片": "Изображение",
    "正在检查和复查实际 PPTX 画面…": "Проверка и повторная проверка фактических изображений PPTX…",
    "已打开修复副本，原稿保留，可撤销排版修改。": "Открыта исправленная копия; оригинал сохранён, правки вёрстки можно отменить.",
    "已保存为新副本，原稿保留；可在当前副本中撤销采纳的修改。": "Сохранено как новая копия, оригинал сохранён; принятые правки можно отменить в текущей копии.",
    "正在核对并更新数据…": "Сверка и обновление данных…",
    "已保存确认后的数据，HTML、PPTX 和工程已同步，可撤销。": "Сохранены подтверждённые данные; HTML, PPTX и проект синхронизированы. Можно отменить.",
    "此工程没有绑定数据模型": "У этого проекта нет модели данных",
    "生成时提供来源、指标和可调假设后，可在这里核对来源并预览推演影响。普通演示文稿仍可正常编辑和下载。": "Если при создании указать источники, показатели и настраиваемые допущения, здесь можно проверить происхождение и заранее увидеть влияние сценариев. Обычные презентации по-прежнему редактируются и скачиваются как обычно.",
    "关闭": "Закрыть",
    "分享包包含 PPTX、HTML 和讲稿，不含工程 JSON；工程包保留完整编辑资料。请先保存修改，再下载最新版本。": "Пакет для публикации включает PPTX, HTML и текст выступления без JSON проекта; пакет проекта сохраняет полные данные для редактирования. Сначала сохраните правки, затем скачивайте последнюю версию.",
    "HTML、PPTX 备注和讲稿保留已绑定的来源摘录与用户填写内容。": "HTML, заметки PPTX и текст выступления сохраняют привязанные выдержки из источников и заполненный вами текст.",
    "下载分享成品包 ZIP": "Скачать ZIP для публикации",
    "下载完整工程包 ZIP": "Скачать полный ZIP проекта",
    "有未保存的修改": "Есть несохранённые правки",
    "继续编辑": "Продолжить редактирование",
    "请选择如何处理当前页的修改。": "Выберите, что сделать с правками текущего слайда.",
    "保存后继续": "Сохранить и продолжить",
    "放弃修改并继续": "Отменить правки и продолжить",
    "取消": "Отмена",
    "将删除当前页面，之后可以撤销。": "Текущий слайд будет удалён; позже это можно отменить.",
    "确认删除本页": "Подтвердить удаление слайда",
    "幻灯片目录": "Оглавление слайдов",
    "幻灯片": "Слайды",
    // Библиотека проектов
    "工程查找": "Поиск проектов",
    "搜索工程": "Поиск проектов",
    "排序": "Сортировка",
    "最近更新": "Недавно обновлённые",
    "最早更新": "Сначала старые",
    "清空搜索": "Очистить поиск",
    "显示 ": "Показано ",
    " 个工程": " проектов",
    "没有匹配的工程": "Подходящих проектов нет",
    "换个关键词，或清空搜索查看全部工程。": "Измените запрос или очистите поиск, чтобы показать все проекты."
});

// Русские тексты ошибок сервера (coaching/visual). Ключ — китайская часть сообщения
// (value.message после workbench fail()); при отсутствии ключа показывается английский
// вариант (value.messageEn), затем общий englishError().
const RU_ERRORS = Object.freeze({
    // Coaching: ИИ-проверка и имитация защиты
    "请选择有效的演练记录": "Выберите корректную запись репетиции",
    "演练记录无效，请保留文件后检查": "Файл записи репетиции некорректен; сохраните его и проверьте",
    "演练记录损坏，未覆盖原文件": "Запись репетиции повреждена; оригинал не перезаписан",
    "另一操作正在更新记录，请稍后重试": "Запись обновляется другой операцией; повторите позже",
    "演练记录过大": "Запись репетиции слишком велика",
    "演练不属于当前工程": "Репетиция относится к другому проекту",
    "工程已被修改，请重新检查；旧报告保留": "Проект изменился; запустите проверку заново. Старый отчёт сохранён.",
    "请主动选择 AI 预审或模拟答辩": "Явно выберите «ИИ-проверка» или «Имитация защиты»",
    "DSH 模型服务不可用，请先配置模型": "Сервис моделей DSH недоступен. Сначала настройте модель.",
    "请选择提问强度": "Выберите строгость вопросов",
    "请选择 DSH 中已有的模型": "Выберите модель, существующую в DSH",
    "模型列表已变化，请重新选择": "Список моделей изменился; выберите заново",
    "预审最多 3 轮，答辩最多 5 题": "Проверка — максимум 3 раунда, защита — максимум 5 вопросов",
    "补充材料最多 20000 字符": "Дополнительные материалы — максимум 20 000 символов",
    "检查范围没有页面": "В выбранном диапазоне нет слайдов",
    "材料超过 60000 字符，请选择当前页检查": "Материалы превышают 60 000 символов; проверяйте текущий слайд",
    "请删除旧记录后再开始（每个工程 20 次，本机共 200 次）": "Сначала удалите старые записи (20 на проект, 200 на машину)",
    "当前演练正在处理": "Эта репетиция сейчас обрабатывается",
    "本次演练已结束或达到调用上限": "Репетиция завершена или достигнут лимит вызовов",
    "请填写最多 4000 字符的回答": "Введите ответ до 4000 символов",
    "模型输出过长": "Ответ модели слишком длинный",
    "无效模型结构": "Некорректная структура ответа модели",
    "预审结果必须为最多 5 个问题": "Результат проверки — максимум 5 пунктов",
    "预审结果缺少页面或问题说明": "В результате проверки нет слайда или описания проблемы",
    "模型改稿包含不支持的字段": "Правка модели содержит неподдерживаемое поле",
    "模型问题未关联有效页面": "Вопрос модели не привязан к существующему слайду",
    "请确认本次模型调用": "Подтвердите этот вызов модели",
    "模型没有返回回答反馈": "Модель не вернула отзыв на ответ",
    "调用已停止；已完成结果保留，本次调用仍可能计费": "Вызов остановлен; готовые результаты сохранены, вызов мог быть тарифицирован",
    "模型调用或结果解析失败，未自动重试；请检查模型或重新开始": "Вызов модели или разбор результата не удались; автоматического повтора нет. Проверьте модель или начните заново.",
    "模型调用已停止": "Вызов модели остановлен",
    "预审或答辩未完成，请查看已保存记录": "Проверка или защита не завершены; смотрите сохранённую запись",
    "演练失败": "Репетиция не удалась",
    "请先停止当前调用": "Сначала остановите активный вызов",
    "另一窗口正在处理": "Обработку ведёт другое окно",
    "请选择建议或备用问答": "Выберите рекомендации или резервные «вопрос-ответ»",
    "建议选择无效或重复": "Выбор некорректен или содержит дубли",
    "此项没有可采纳的表达修改": "У этого пункта нет принимаемой правки формулировки",
    "同一字段有多项建议，请分次选择": "Для одного поля несколько предложений; выбирайте по очереди",
    "备用问答不存在": "Такого резервного «вопрос-ответ» нет",
    "上次调用未完成，不会自动重试": "Прошлый вызов не завершился; автоматического повтора нет",
    // Visual review: визуальная проверка и исправление
    "视觉检查文件无效或过大": "Файл визуальной проверки некорректен или слишком велик",
    "视觉记录 ID 无效": "Неверный ID записи визуальной проверки",
    "视觉记录损坏，保留原文件": "Запись визуальной проверки повреждена; оригинал сохранён",
    "视觉记录正在被另一个操作更新": "Запись обновляется другой операцией",
    "视觉记录过大": "Запись визуальной проверки слишком велика",
    "视觉记录不属于当前工程": "Визуальная проверка относится к другому проекту",
    "工程或 PPTX 已变化，请重新检查；旧结果保留": "Проект или PPTX изменились; запустите проверку заново. Старые результаты сохранены.",
    "检查副本已变化，请重新检查": "Проверяемая копия изменилась; запустите проверку заново",
    "视觉记录与页面不匹配": "Запись проверки не соответствует слайдам",
    "请先渲染本轮 PPTX": "Сначала выполните рендеринг PPTX этого раунда",
    "渲染输出已变化，请重新开始检查": "Вывод рендеринга изменился; начните проверку заново",
    "请确认视觉检查会发送所选页面图片": "Подтвердите отправку изображений выбранных слайдов",
    "请配置 DSH 视觉模型和图片附件服务": "Настройте визуальную модель DSH и сервис изображений",
    "请选择支持图片输入的模型": "Выберите модель с поддержкой изображений",
    "最多自动修复两轮": "Автоисправление — максимум два раунда",
    "每次检查 1–12 页，较长演示请选择当前页": "За раз проверяются 1–12 слайдов; для длинных презентаций выберите текущий слайд",
    "PPTX 在 Office 中改过或缺少校验记录，请先保存工程副本": "PPTX менялся в Office или нет записи целостности; сначала сохраните копию проекта",
    "请先删除旧视觉记录（工程 20 次、本机 200 次）": "Сначала удалите старые записи проверки (20 на проект, 200 на машину)",
    "视觉结果没有逐页返回": "Результат проверки вернулся не по каждому слайду",
    "视觉结果页面或问题数无效": "Некорректные слайды или число проблем в результате",
    "视觉问题缺少有效区域或说明": "У проблемы нет корректной области или описания",
    "请确认本轮视觉检查": "Подтвердите этот раунд визуальной проверки",
    "视觉检查正在进行": "Визуальная проверка выполняется",
    "检查已结束或中断，请新建检查": "Проверка завершена или прервана; создайте новую",
    "视觉记录正在处理": "Запись проверки обрабатывается",
    "渲染引擎不可用，请安装官方 LibreOffice Kit 后重试": "Движок рендеринга недоступен; установите официальный LibreOffice Kit и повторите",
    "渲染页数与工程不符": "Число отрендеренных страниц не совпадает с проектом",
    "视觉模型已停用": "Визуальная модель отключена",
    "所选页面内容过长": "Содержимое выбранных слайдов слишком длинное",
    "视觉结果过长": "Результат проверки слишком длинный",
    "视觉结果格式无效，未自动重试": "Некорректный формат результата; автоматического повтора нет",
    "视觉结果超出本轮检查范围": "Результат вне диапазона этого раунда проверки",
    "视觉检查阶段无效": "Некорректная фаза визуальной проверки",
    "已停止；完成的副本保留，未复查部分不算通过": "Остановлено; готовые копии сохранены, непроверенное не считается пройденным",
    "视觉检查失败，未自动重试": "Визуальная проверка не удалась; автоматического повтора нет",
    "请选择有效检查轮次": "Выберите корректный раунд проверки",
    "页面不在本次检查范围": "Слайд вне диапазона этой проверки",
    "副本尚未完成复查，不能采纳": "Копия ещё не прошла повторную проверку; принять нельзя",
    "请先停止检查": "Сначала остановите проверку",
    "检查目录位置已变化": "Расположение каталога проверки изменилось",
    "上次检查中断，不会自动重试": "Прошлая проверка прервана; автоматического повтора нет",
    // ---- Библиотека шаблонов ----
    "模板": "Шаблоны",
    "模板库": "Библиотека шаблонов",
    "操作完成": "Готово",
    "已请求下载，请查看浏览器的下载列表。": "Загрузка запрошена; проверьте список загрузок браузера.",
    "Файл больше 16 MiB": "Файл больше 16 MiB",
    "Шаблон импортирован: ": "Шаблон импортирован: ",
    "Шаблон удалён": "Шаблон удалён",
    "Черновик создан: ": "Черновик создан: ",
    "Редизайн применён. Обновлённый проект открыт.": "Редизайн применён; обновлённый проект открыт.",
    "Редизайн применён, можно отменить.": "Редизайн применён; можно отменить.",
    "Редизайн сохранён копией.": "Редизайн сохранён как копия.",
    "Создать дек из шаблона": "Создать дек из шаблона",
    "Название презентации": "Название презентации",
    "Будет создан черновик: каркас страниц с местами для заполнения, стиль и бренд шаблона. Черновик появится в списке проектов.": "Будет создан черновик: каркас страниц с местами для заполнения в стиле и с брендом шаблона. Черновик появится в списке проектов.",
    "Например: Квартальный отчёт": "Например: Квартальный отчёт",
    "Создать": "Создать",
    "Импорт шаблона": "Импорт шаблона",
    "Файл .zip или template.json (до 16 MiB).": "Файл .zip или template.json (до 16 MiB).",
    "Куда импортировать": "Куда импортировать",
    "Себе (личный)": "Себе (личный)",
    "В общие (админ)": "В общие (админ)",
    "Шаблонов пока нет": "Шаблонов пока нет",
    "Создайте шаблон из примера PPTX (ppt_template create-from-pptx) или из существующего проекта.": "Создайте шаблон из примера PPTX (ppt_template create-from-pptx) или из существующего проекта.",
    "Обновить": "Обновить",
    "Вы администратор: импорт и удаление общих шаблонов доступны.": "Вы администратор: импорт и удаление общих шаблонов доступны.",
    "Общие шаблоны доступны для чтения; свои — в разделе «Личный».": "Общие шаблоны доступны для чтения; личные — в разделе «Личный».",
    "Встроенный": "встроенный",
    "Общий": "общий",
    "Личный": "личный",
    "тема ": "тема ",
    "каркас ": "каркас ",
    "Создать дек": "Создать дек",
    "Экспорт": "Экспорт",
    "Опубликовать": "Опубликовать",
    "Удалить": "Удалить",
    "Редизайн проекта шаблоном": "Редизайн проекта шаблоном",
    "Будет изменено только оформление: тема, палитра, шрифты, логотип, футер и фоны страниц. Текст и порядок страниц не изменятся; отменить можно кнопкой «撤销上次修改 / Undo».": "Изменится только оформление: тема, палитра, шрифты, логотип, футер и фоны страниц. Текст и порядок страниц не изменятся; отменить можно кнопкой «Отменить последнюю правку».",
    "Будет изменено только оформление: тема, палитра, шрифты, логотип, футер и фоны. Текст и порядок страниц останутся прежними; изменение можно отменить.": "Изменится только оформление: тема, палитра, шрифты, логотип, футер и фоны. Текст и порядок страниц останутся прежними; изменение можно отменить.",
    "Сохранить как копию (оригинал не изменится)": "Сохранить как копию (оригинал не изменится)",
    "Применить": "Применить",
    "Шаблонов нет: создайте их на вкладке «Шаблоны» или через ppt_template.": "Шаблонов нет: создайте их на вкладке «Шаблоны» или через ppt_template.",
    "Редизайн с шаблоном доступен из карточки шаблона или из открытого проекта.": "Редизайн шаблоном доступен из карточки шаблона или из открытого проекта.",
    "Загрузка…": "Загрузка…",
    "Шаблон из проекта": "Шаблон из проекта",
    "Стиль, каркас страниц и до 3 слайдов-образцов станут шаблоном. Тексты страниц превратятся в места для заполнения.": "Стиль, каркас страниц и до трёх слайдов-образцов станут шаблоном. Тексты страниц превратятся в места для заполнения.",
    "Проект": "Проект",
    "— выберите проект —": "— выберите проект —",
    "id шаблона (латиница, цифры, дефис)": "id шаблона (латиница, цифры, дефис)",
    "Название": "Название",
    "Мой корпоративный шаблон": "Мой корпоративный шаблон",
    "Создать шаблон": "Создать шаблон",
    "Шаблон создан из проекта": "Шаблон создан из проекта",
});

/** Catalog problems are loud: the cascade shows the message plus a retry. */
class ModelCatalogError extends Error {
    detail;
    constructor(message, detail = '') {
        super(message);
        this.name = 'ModelCatalogError';
        this.detail = detail;
    }
}
function rpcId() {
    const source = globalThis.crypto;
    return typeof source?.randomUUID === 'function' ? source.randomUUID() : 'rpc-' + Math.random().toString(36).slice(2);
}
function endpointOf(explicit) {
    if (explicit)
        return explicit;
    const base = globalThis.document?.baseURI;
    if (!base)
        throw new ModelCatalogError('catalog-unavailable', 'The model catalog needs a browser document or an explicit endpoint');
    return new URL('/api/llm.models', base);
}
function detailOf(error) {
    if (typeof error === 'string')
        return error;
    const value = error;
    return typeof value?.message === 'string' ? value.message : '';
}
function normalize(value) {
    const source = value;
    if (!source || !Array.isArray(source.groups))
        throw new ModelCatalogError('catalog-shape', 'The model catalog answer carries no provider groups');
    const groups = [];
    for (const raw of source.groups) {
        const group = raw;
        if (!group || typeof group.id !== 'string' || !group.id)
            continue;
        const models = Array.isArray(group.models) ? group.models : [];
        groups.push({
            id: group.id,
            ...(typeof group.name === 'string' && group.name ? { name: group.name } : {}),
            models: models.filter((model) => {
                const candidate = model;
                return !!candidate && typeof candidate.id === 'string' && !!candidate.id;
            }),
        });
    }
    return { groups, failures: Array.isArray(source.failures) ? source.failures : [] };
}
async function fetchModelCatalog(request = {}) {
    let envelope;
    try {
        const response = await fetch(endpointOf(request.endpoint), {
            method: 'POST', credentials: 'same-origin', signal: request.signal,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ type: 'client-request', rpcId: rpcId(), method: 'llm.models', payload: {} }),
        });
        // A non-JSON gateway answer (login page, plain-text 404/401 body) must name
        // its HTTP status instead of crashing inside response.json().
        if (!response.ok)
            throw new ModelCatalogError('catalog-http', 'HTTP ' + response.status);
        envelope = await response.json();
    }
    catch (error) {
        if (error instanceof ModelCatalogError)
            throw error;
        throw new ModelCatalogError('catalog-unreachable', detailOf(error) || 'The model catalog request failed before an answer arrived');
    }
    const data = envelope;
    if (!data || data.type !== 'server-response' || !data.result || typeof data.result !== 'object')
        throw new ModelCatalogError('catalog-protocol', 'The host answered the model catalog with an unexpected envelope');
    const result = data.result;
    if (result.ok !== true)
        throw new ModelCatalogError('catalog-refused', detailOf(result.error) || 'The model catalog request was rejected');
    return normalize(result.value);
}
/** Text-capable models; modalities that the catalog does not declare stay selectable. */
function acceptsText(model) {
    return !Array.isArray(model.inputModalities) || model.inputModalities.includes('text');
}
/** Image+text models keep the strict rule whenever the catalog declares modalities. */
function acceptsVision(model) {
    return !Array.isArray(model.inputModalities) || model.inputModalities.includes('image') && model.inputModalities.includes('text');
}
/** Flatten provider groups into workbench route rows in the established label shape. */
function catalogRoutes(groups, accept) {
    const routes = [];
    for (const group of groups) {
        for (const model of group.models) {
            if (!accept(model))
                continue;
            routes.push({ provider: group.id, model: model.id, label: (group.name || group.id) + ' / ' + (model.name || model.id) });
        }
    }
    return routes;
}

// Editable browser entry. Build with node scripts/build-client.mjs.
// Browser source, distributed directly. tsc deliberately does not rewrite this file.
window.__ModuleLoader__.load(__stardustUpdatesWrap({ id: 'dsh-ppt', factory: require => {
        const React = require('react');
        const W = createWorkbenchUI(React);
function pptText(zh, en) {
  const language = languageOf();
  return language === 'ru' ? (RU[zh] ?? en ?? zh) : language === 'en' ? en : zh;
}

function PptPages({ project, selected, busy, imagePending, onChoose, onDuplicate, dirty, dataDirty }) {
  return h('aside', { className: 'ppt-page-rail', 'aria-label': pptText('幻灯片目录', 'Slide outline') },
    h('h3', null, pptText('幻灯片', 'Slides')),
    h('div', { className: 'ppt-page-buttons' }, project.slides.map((row, index) => h('button', {
      type: 'button', key: row.id, 'aria-current': row.id === selected ? 'true' : undefined, disabled: busy || imagePending, onClick: () => onChoose(row),
    }, h('span', { className: 'ppt-page-number' }, String(index + 1).padStart(2, '0')), h('span', null, row.title || t('未命名页'))))),
    h(W.Button, { icon: 'copy', className: 'ppt-duplicate', disabled: busy || dirty || imagePending || dataDirty || project.slides.length >= 120, onClick: onDuplicate }, t('复制本页')));
}

const PPT_WORKBENCH_CSS = `
.ppt-workbench.pptw{--fg:var(--w-text);--fg-muted:var(--w-muted);--bg:var(--w-bg);--bg-surface:var(--w-bg);--border:var(--w-border);max-width:none;margin:0;padding:0}.ppt-workbench.pptw[data-main=true]{padding:calc(24px + var(--dsh-frame-top-clearance,0px)) 28px 0 max(28px,var(--dsh-frame-leading-clearance,0px))}.ppt-workbench .ppt-editor{--ppt-inspector:320px;display:grid;grid-template-columns:190px minmax(0,1fr) var(--ppt-inspector);flex:1;min-height:520px}.ppt-workbench .ppt-editor[data-view=visual],.ppt-workbench .ppt-editor[data-view=rehearsal],.ppt-workbench .ppt-editor[data-view=data]{--ppt-inspector:400px}.ppt-workbench .ppt-page-rail{padding:24px 14px 24px 0;border-inline-end:1px solid var(--w-border);min-width:0;display:flex;flex-direction:column;gap:18px}.ppt-workbench .ppt-page-rail h3{margin:0;font-size:16px}.ppt-workbench .ppt-page-buttons{display:flex;flex-direction:column;gap:4px;max-height:calc(100dvh - 340px);overflow:auto;min-width:0}.ppt-workbench .ppt-page-buttons>button{border:0;border-inline-start:3px solid transparent;border-radius:6px;padding:12px 8px;display:flex;align-items:flex-start;gap:10px;background:transparent;min-width:0;font-size:13px;line-height:1.6;text-align:start;overflow-wrap:anywhere}.ppt-workbench .ppt-page-buttons>button[aria-current=true]{border-inline-start-color:var(--w-accent);background:var(--w-selected);color:var(--w-text)}.ppt-workbench .ppt-page-number{font-variant-numeric:tabular-nums;color:var(--w-muted);font-size:12px;flex-shrink:0}.ppt-workbench .ppt-duplicate{margin-top:auto;font-size:13px}.ppt-workbench .ppt-canvas-region{display:flex;flex-direction:column;gap:14px;padding:24px;background:var(--w-soft);min-width:0}.ppt-workbench .ppt-preview-tools{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.ppt-workbench .ppt-preview-tools .w-button{font-size:12px;min-height:32px;padding:7px 9px}.ppt-workbench .ppt-preview-tools [aria-pressed=true]{background:var(--w-bg);border-color:var(--w-accent);color:var(--w-accent)}.ppt-workbench .ppt-preview-tools .w-icon-button{margin-inline-start:auto}.ppt-workbench .preview{width:100%;aspect-ratio:16/9;border:1px solid var(--w-border);border-radius:4px;background:var(--w-bg);box-shadow:0 6px 20px #0001;overflow:hidden;min-height:0;margin:auto 0}.ppt-workbench .preview{position:relative}.ppt-workbench .preview>.ppt-fullscreen-exit{display:none}.ppt-workbench .preview:fullscreen>.ppt-fullscreen-exit{display:inline-flex;position:absolute;inset:16px 16px auto auto;z-index:10;background:#14171c;color:#fff;border:1px solid #ffffff66}.ppt-workbench .preview:fullscreen{width:100vw;height:100vh;aspect-ratio:auto;border:0;border-radius:0;margin:0;background:#14171c;box-shadow:none}.ppt-workbench .preview:fullscreen iframe{background:#14171c}.ppt-workbench .preview .render-page{width:100%;height:100%;object-fit:contain}.ppt-workbench .ppt-preview-help{font-size:12px;color:var(--w-muted);line-height:1.7}.ppt-workbench .ppt-preview-help+details{background:transparent;border:0;border-top:1px solid var(--w-border);border-radius:0;padding:14px 0}.ppt-workbench .ppt-preview-help+details summary{font-size:12px}.ppt-workbench .ppt-inspector{padding:24px 0 24px 22px;border-inline-start:1px solid var(--w-border);min-width:0;overflow-wrap:anywhere}.ppt-workbench .ppt-inspector-panel[hidden]{display:none!important}.ppt-workbench .ppt-inspector .card{border:0;border-bottom:1px solid var(--w-border);border-radius:0;padding:0 0 20px;margin:0 0 20px;background:transparent;box-shadow:none}.ppt-workbench .ppt-inspector h3{font-size:17px;margin:0 0 18px}.ppt-workbench .ppt-inspector .card>div>label,.ppt-workbench .ppt-inspector .card>label{font-size:13px;margin:16px 0 6px;color:var(--w-muted)}.ppt-workbench .ppt-inspector input,.ppt-workbench .ppt-inspector textarea,.ppt-workbench .ppt-inspector select{font-size:14px}.ppt-workbench .ppt-inspector textarea{min-height:72px}.ppt-workbench .ppt-inspector .tools{gap:8px;margin-top:18px}.ppt-workbench .ppt-inspector .tools button{font-size:13px;min-height:34px;padding:7px 9px}.ppt-workbench .ppt-inspector .coaching-grid{grid-template-columns:1fr}.ppt-workbench .ppt-inspector .before-after,.ppt-workbench .ppt-inspector .data-before-after{grid-template-columns:1fr}.ppt-workbench .ppt-inspector .coaching{margin-top:0}.ppt-workbench .ppt-inspector .coaching p,.ppt-workbench .ppt-inspector .data-workbench p{font-size:13px;line-height:1.7}.ppt-workbench .ppt-inspector .coaching blockquote{margin:12px 0;padding-inline-start:12px}.ppt-workbench .ppt-inspector .muted{font-size:12px;color:var(--w-muted)}.ppt-workbench .ppt-inspector .data-workbench .data-controls{grid-template-columns:1fr}.ppt-workbench .ppt-structure{border-top:1px solid var(--w-border);padding-top:16px;margin-top:16px}.ppt-workbench .ppt-structure .w-button{font-size:12px}.ppt-workbench.pptw button.primary{background:var(--w-primary);color:var(--w-on-primary);border-color:var(--w-primary)}.ppt-workbench .ppt-library{max-width:1000px;padding:12px 0 24px}.ppt-workbench .ppt-library .w-row-button{padding:20px 16px;border:0;border-radius:0;background:transparent}.ppt-workbench .notice{border:1px solid var(--w-border);border-radius:8px;background:var(--w-soft);color:var(--w-text)}.ppt-workbench .notice.error{color:var(--dsw-alias-state-error-primary,#ad3636)}.ppt-workbench .ppt-data-warning{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.ppt-workbench .ppt-downloads{display:flex;flex-direction:column;gap:16px}.ppt-workbench .ppt-downloads .tools{display:flex;flex-direction:column;align-items:stretch}.ppt-workbench .ppt-downloads button{font-size:14px;min-height:38px}.ppt-workbench .ppt-image-section{border-block:1px solid var(--w-border);margin:20px 0;padding:16px 0}.ppt-workbench .ppt-image-section>summary{font-size:14px}.ppt-workbench .ppt-image-section input,.ppt-workbench .ppt-image-section select{width:100%;margin-bottom:14px}.ppt-workbench .ppt-image-section input[type=file]{font-size:12px}.ppt-workbench :focus-visible{outline:2px solid var(--w-accent);outline-offset:3px}.ppt-workbench .w-dialog{max-width:700px}.ppt-workbench .ppt-inspector .image-preview{max-height:180px;object-fit:contain;background:var(--w-soft)}
@container dsh-workbench (max-width:1100px){.ppt-workbench .ppt-editor{grid-template-columns:160px minmax(0,1fr)}.ppt-workbench .ppt-inspector{grid-column:1/-1;border-inline-start:0;border-top:1px solid var(--w-border);padding:24px 0}.ppt-workbench .ppt-inspector .coaching-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.ppt-workbench .ppt-canvas-region{padding-inline-end:0}.ppt-workbench .ppt-page-buttons{max-height:400px}}
@container dsh-workbench (max-width:760px){.ppt-workbench .ppt-editor{display:flex;flex-direction:column;min-height:0}.ppt-workbench .ppt-page-rail{border-inline-end:0;border-bottom:1px solid var(--w-border);padding:16px 0}.ppt-workbench .ppt-page-buttons{display:flex;flex-direction:row;max-height:150px;overflow:auto;gap:8px}.ppt-workbench .ppt-page-buttons>button{min-width:150px;max-width:200px;flex-shrink:0}.ppt-workbench .ppt-duplicate{align-self:flex-start}.ppt-workbench .ppt-canvas-region{padding:18px 0;background:var(--w-bg)}.ppt-workbench .preview{margin:0;min-height:0}.ppt-workbench .ppt-preview-tools .w-icon-button{margin-inline-start:0}.ppt-workbench .ppt-inspector .coaching-grid{grid-template-columns:1fr}.ppt-workbench .ppt-preview-tools .w-button{font-size:12px}.ppt-workbench .ppt-inspector{padding:20px 0}}
@media(max-width:700px){.ppt-workbench.pptw[data-main=true]{padding:calc(16px + var(--dsh-frame-top-clearance,0px)) 16px 0 max(16px,var(--dsh-frame-leading-clearance,0px))}}
`;

// Per-view preferences stay in this plugin instance; user files are never changed.
const projectLibraryPreferences = new Map();
function ProjectLibrary({ items, scope = 'projects', language = 'zh', searchText, updatedAt, renderItem, t, searchHint, groupByOwner = false }) {
  const saved = projectLibraryPreferences.get(scope);
  const [query, setQuery] = React.useState(saved?.query || '');
  const [order, setOrder] = React.useState(saved?.order || 'updated');
  const controlId = React.useId();
  const normalize = text => String(text ?? '').normalize('NFKC').toLocaleLowerCase(language);
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  const collator = new Intl.Collator(language, { numeric: true, sensitivity: 'base' });
  const timestamp = row => { const value = Date.parse(updatedAt(row)); return Number.isFinite(value) ? value : 0; };
  const visible = items.filter(row => words.every(word => normalize(searchText(row)).includes(word))).sort((a, b) => {
    const tie = collator.compare(String(a.title || ''), String(b.title || '')) || String(a.id).localeCompare(String(b.id));
    return order === 'title' ? tie : (order === 'oldest' ? timestamp(a) - timestamp(b) : timestamp(b) - timestamp(a)) || tie;
  });
  function change(nextQuery, nextOrder) {
    projectLibraryPreferences.set(scope, { query: nextQuery, order: nextOrder });
    setQuery(nextQuery); setOrder(nextOrder);
  }
  const groups = new Map();
  if (groupByOwner) for (const row of visible) {
    const owner = row.owner || '';
    if (!groups.has(owner)) groups.set(owner, []);
    groups.get(owner).push(row);
  }
  const content = groupByOwner ? [...groups].sort(([a], [b]) => collator.compare(a, b)).map(([owner, rows]) =>
    h('details', { key: owner, className: 'project-library-owner' },
      h('summary', null, owner || tplTr('Без владельца', 'No owner'), h('span', { className: 'w-muted' }, ' (' + rows.length + ')')),
      h('div', { className: 'project-library-owner-items' }, rows.map(renderItem)))) : visible.map(renderItem);
  return h('section', { className: 'project-library', 'aria-label': t('工程查找', 'Find projects') },
    h('style', null, PROJECT_LIBRARY_CSS),
    h('div', { className: 'project-library-controls' },
      h('label', { htmlFor: controlId + '-query' }, t('搜索工程', 'Search projects'),
        h('input', { id: controlId + '-query', type: 'search', value: query, placeholder: searchHint, maxLength: 200,
          onChange: e => change(e.target.value, order), onKeyDown: e => { if (e.key === 'Escape' && query) { e.preventDefault(); e.stopPropagation(); change('', order); } } })),
      h('label', { htmlFor: controlId + '-order' }, t('排序', 'Sort by'),
        h('select', { id: controlId + '-order', value: order, onChange: e => change(query, e.target.value) },
          h('option', { value: 'updated' }, t('最近更新', 'Recently updated')),
          h('option', { value: 'oldest' }, t('最早更新', 'Oldest updated')),
          h('option', { value: 'title' }, t('标题', 'Title')))),
      query ? h(W.Button, { variant: 'ghost', onClick: () => change('', order) }, t('清空搜索', 'Clear search')) : null),
    h('p', { className: 'w-muted project-library-count', role: 'status', 'aria-live': 'polite' },
      t('显示 ', 'Showing ') + visible.length + ' / ' + items.length + t(' 个工程', ' projects')),
    visible.length ? content : h(W.Empty, { title: t('没有匹配的工程', 'No matching projects'), icon: 'folder' },
      t('换个关键词，或清空搜索查看全部工程。', 'Try another keyword or clear the search to show all projects.')));
}
const PROJECT_LIBRARY_CSS = `.project-library{min-width:0}.project-library-owner{border:1px solid var(--w-border);border-radius:8px;margin:8px 0}.project-library-owner>summary{cursor:pointer;padding:12px;font-weight:600;overflow-wrap:anywhere}.project-library-owner>summary:focus-visible{outline:2px solid var(--w-accent);outline-offset:2px}.project-library-owner-items{padding:0 12px 12px 24px}.project-library-controls{display:flex;gap:12px;align-items:end;flex-wrap:wrap;padding:12px 0}.project-library-controls>label{display:grid;gap:6px;margin:0!important;min-width:0;color:var(--w-muted);font-size:13px}.project-library-controls>label:first-child{flex:1 1 240px}.project-library-controls>label:nth-child(2){flex:0 1 180px}.project-library-controls input,.project-library-controls select{width:100%;min-width:0;min-height:38px;font:inherit;color:var(--w-text);background:var(--w-bg);border:1px solid var(--w-border);border-radius:8px;padding:8px 10px}.project-library-count{margin:4px 0 12px;font-size:12px}.project-library-controls :focus-visible{outline:2px solid var(--w-accent);outline-offset:3px}@media(max-width:520px){.project-library-controls>label:first-child{flex-basis:100%}.project-library-controls>label:nth-child(2){flex:1 1 160px}}`;

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

// Редактор шаблона: основное, тема, палитра, шрифт, логотип, футер, фоны по типам страниц,
// каркас страниц (outline) и слайды-образцы, живое HTML-превью (операция template-preview).
// Данные — операции template-get / template-save / template-preview сервера (src/workbench.ts).
// Общие имена с client.js избегаем: всё здесь с префиксом tpl / TPE.
const tplTr = (ru, en) => languageOf() === 'ru' ? ru : en;
const TPL_LAYOUTS = ['cover', 'section', 'bullets', 'statement', 'quote', 'closing'];
const TPL_BG_TYPES = ['cover', 'section', 'content', 'closing'];
const TPL_FONTS = ['Arial', 'Calibri', 'Cambria', 'Georgia', 'Helvetica', 'Open Sans', 'Roboto', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'];
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
        id: manifest?.id ?? '', name: manifest?.name ?? '', description: manifest?.description ?? '', theme: style.theme ?? '',
        primaryColor: brand.primaryColor ?? '', backgroundColor: brand.backgroundColor ?? '', textColor: brand.textColor ?? '',
        fontFamily: brand.fontFamily ?? '', brandName: brand.name ?? '', footer: brand.footer ?? '', logo: brand.logo ?? '',
        backgrounds, layouts: tplClone(style.layouts ?? []),
        fonts: tplClone(style.fonts ?? []), textStyles: tplClone(style.textStyles ?? {}),
        outline: tplClone(manifest?.outline ?? []), samples: tplClone(manifest?.samples ?? []),
    };
}

const TPL_ROLES = ['logo', 'header', 'decor', 'background', 'photo'];
const tplRoleLabel = role => ({ logo: tplTr('Логотип', 'Logo'), header: tplTr('Шапка / линия', 'Header / rule'), decor: tplTr('Декор', 'Decor'), background: tplTr('Фон-картинка', 'Background picture'), photo: tplTr('Фото', 'Photo') })[role] ?? role;
const tplNum = value => { const n = Number(value); return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 0; };
function tplCleanLayout(layout) {
    const out = { id: layout.id, layoutType: layout.layoutType, images: (layout.images ?? []).map((image, index) => {
        const item = { image: image.image, x: tplNum(image.x), y: tplNum(image.y), w: Math.max(0.1, tplNum(image.w)), h: Math.max(0.1, tplNum(image.h)), z: index, fit: image.fit || 'contain' };
        if (image.role) item.role = image.role;
        if (image.svg) item.svg = image.svg;
        return item;
    }) };
    if (layout.name && layout.name.trim()) out.name = layout.name.trim();
    if (layout.textStyles) out.textStyles = tplClone(layout.textStyles);
    if (layout.background?.image) out.background = { image: layout.background.image, fit: layout.background.fit || 'cover' };
    if (layout.backgroundColor) out.backgroundColor = layout.backgroundColor;
    if (layout.textZones?.length) out.textZones = layout.textZones.map(zone => ({ kind: zone.kind === 'title' ? 'title' : 'body', x: Math.min(100, Math.max(0, tplNum(zone.x))), y: Math.min(100, Math.max(0, tplNum(zone.y))), w: Math.min(100, Math.max(1, tplNum(zone.w))), h: Math.min(100, Math.max(1, tplNum(zone.h))) }));
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
    const brand = {};
    for (const key of ['primaryColor', 'backgroundColor', 'textColor']) if (draft[key]) brand[key] = draft[key];
    if (draft.fontFamily.trim()) brand.fontFamily = draft.fontFamily.trim();
    if (draft.brandName.trim()) brand.name = draft.brandName.trim();
    if (draft.footer.trim()) brand.footer = draft.footer;
    if (draft.logo) brand.logo = draft.logo;
    const style = {};
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

function TplLayoutsEditor({ draft, images, disabled, set, pickImage, error }) {
    const [index, setIndex] = React.useState(0);
    const layouts = draft.layouts, current = layouts[Math.min(index, layouts.length - 1)];
    const at = Math.min(index, Math.max(0, layouts.length - 1));
    const patch = (change) => set({ layouts: layouts.map((layout, i) => i === at ? { ...layout, ...change } : layout) });
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
                layouts.map((layout, i) => h('option', { key: layout.id, value: i }, (layout.name || layout.id) + ' · ' + tplLayoutLabel(layout.layoutType)))) : null,
            h(W.Button, { icon: 'plus', disabled: disabled || layouts.length >= 16, onClick: add }, tplTr('Макет', 'Layout')),
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
                h('h3', null, tplTr('Область текста', 'Text area')),
                h('p', { className: 'tpe-hint' }, tplTr('Заголовок и текст страницы размещаются внутри этой области, чтобы не налезать на логотипы и графику макета.', 'Slide title and text are laid out inside this area so they do not run into the layout logos and artwork.')),
                current.textZones?.length ? h('div', null,
                    h('div', { className: 'tpe-nums' }, ['x', 'y', 'w', 'h'].map(key => h('label', { key, className: 'tpe-num' }, key + ' %',
                        h('input', { type: 'number', step: 0.5, disabled, value: current.textZones[0][key], onChange: e => patch({ textZones: [{ ...current.textZones[0], kind: 'body', [key]: e.target.value === '' ? '' : Number(e.target.value) }] }) })))),
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
    const [loadError, setLoadError] = React.useState('');
    const [preview, setPreview] = React.useState('');
    const [previewError, setPreviewError] = React.useState('');
    const [previewBusy, setPreviewBusy] = React.useState(false);
    const [copy, setCopy] = React.useState(null); // { id, name } — диалог «Сохранить как копию»
    const previewSeq = React.useRef(0);

    React.useEffect(() => {
        if (!templateKey) return;
        let live = true;
        action({ operation: 'template-get', templateId: templateKey }).then(value => {
            if (!live) return;
            setBase(value.template); setDraft(tplDraftFrom(value.template)); setImages(Object.fromEntries(Object.entries(value.template.assetData ?? {}).filter(([, data]) => data.startsWith('data:image/'))));
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
        setPreviewBusy(true);
        const timer = setTimeout(async () => {
            try {
                const value = await action({ operation: 'template-preview', manifest: tplBuild(draft, base), uploads, baseKey: templateKey || undefined, lang: languageOf() });
                if (seq !== previewSeq.current) return;
                setPreview(value.html); setPreviewError('');
            } catch (e) { if (seq === previewSeq.current) setPreviewError(e instanceof Error ? e.message : String(e)); }
            finally { if (seq === previewSeq.current) setPreviewBusy(false); }
        }, 500);
        return () => clearTimeout(timer);
    }, [draft, uploads, styleProblem]);

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
    const sections = [['main', tplTr('Основное', 'General')], ['style', tplTr('Стиль', 'Style')], ['layouts', tplTr('Макеты', 'Layouts') + ' (' + draft.layouts.length + ')'], ['outline', tplTr('Каркас', 'Outline') + ' (' + draft.outline.length + ')'], ['samples', tplTr('Образцы', 'Samples') + ' (' + draft.samples.length + ')']];
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
        h('div', { className: 'tpe-grid' },
            h('div', { className: 'tpe-form' },
                h('div', { className: 'tpe-nav', role: 'group', 'aria-label': tplTr('Разделы шаблона', 'Template sections') },
                    sections.map(([id, label]) => h(W.Button, { key: id, 'aria-pressed': section === id, onClick: () => setSection(id) }, label))),
                section === 'main' ? main : section === 'style' ? style
                    : section === 'layouts' ? h(TplLayoutsEditor, { draft, images, disabled, set, pickImage })
                    : section === 'outline' ? h(TplSlideList, { designLayouts: draft.layouts, slides: draft.outline, limit: 120, disabled, hint: tplTr('Каркас — страницы-заготовки нового дека. {{deck.title}} подставит название презентации; строки «Заполнить: …» помечают места для ввода, дек остаётся черновиком, пока они не заполнены.', 'The outline is the skeleton of a new deck. {{deck.title}} is replaced with the deck title; “To fill: …” lines mark spots to complete and keep the deck a draft until they are replaced.'), onChange: outline => set({ outline }) })
                        : h(TplSlideList, { designLayouts: draft.layouts, slides: draft.samples, limit: 5, disabled, hint: tplTr('Образцы — до 5 готовых страниц с реальным содержанием: показывают, как должен выглядеть заполненный дек.', 'Samples are up to 5 finished slides with real content that show what a completed deck should look like.'), onChange: samples => set({ samples }) })),
            h('div', { className: 'tpe-preview' },
                h('div', { className: 'preview tpe-busywrap' }, previewBusy ? h(TplBusy, { label: tplTr('Обновляю предпросмотр…', 'Refreshing the preview…') }) : null, preview
                    ? h('iframe', { title: tplTr('Предпросмотр шаблона', 'Template preview'), sandbox: 'allow-scripts', srcDoc: preview })
                    : previewError ? null : h('p', { className: 'tpe-hint', style: { padding: '12px', minHeight: '80px' } }, tplTr('Готовлю предпросмотр…', 'Preparing the preview…'))),
                previewError ? h(W.Status, { tone: 'error' }, previewError) : null,
                h('p', { className: 'tpe-hint' }, tplTr('Предпросмотр показывает тему, цвета, шрифт, логотип, футер и фоны на типовых страницах. Он обновляется при каждой правке и ничего не сохраняет.', 'The preview shows the theme, colours, font, logo, footer and backgrounds on typical slides. It updates as you edit and saves nothing.')))),
        copy ? h(TplDialog, { busyLabel: tplTr('Сохраняю копию…', 'Saving the copy…'), title: tplTr('Сохранить как копию', 'Save as a copy'), closeLabel: tplTr('Отмена', 'Cancel'), busy, onClose: () => setCopy(null) },
            h('div', { className: 'ppt-tpl-import' },
                h('p', { className: 'w-muted' }, tplTr('Копия сохранится в ваши личные шаблоны вместе с текущими правками.', 'The copy is saved into your private templates together with the current edits.')),
                h('label', null, tplTr('Id копии (латиница, цифры, дефис)', 'Copy id (latin, digits, hyphen)'), h('input', { value: copy.id, maxLength: 49, placeholder: 'my-corp-template-2', onChange: e => setCopy({ ...copy, id: e.target.value.trim().toLowerCase() }) })),
                h('label', null, tplTr('Название', 'Name'), h('input', { value: copy.name, maxLength: 81, onChange: e => setCopy({ ...copy, name: e.target.value }) })),
                error ? h(W.Status, { tone: 'error' }, error) : null),
            h(W.Button, { variant: 'primary', disabled: busy || !TPL_ID.test(copy.id) || !copy.name.trim(), onClick: () => save(copy) }, tplTr('Сохранить копию', 'Save copy'))) : null);
}

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

        const { useState, useEffect, useRef, useMemo } = React;
        const h = React.createElement;
        // Interface language follows DSH; user content and stored records keep their original text.
        let localeService;
        const EN = Object.freeze({
            "标题": "Title",
            "副标题": "Subtitle",
            "眉题": "Kicker",
            "正文": "Body text",
            "要点（每行一条）": "Bullets (one per line)",
            "演讲备注": "Speaker notes",
            "无法读取服务响应，请检查插件是否加载": "Could not read the server response. Check that the plugin is loaded.",
            "操作未完成": "The operation did not complete.",
            "正在处理，请稍候…": "Working, please wait…",
            "操作失败": "Operation failed.",
            "已定位到": "Focused ",
            "，在字段中修改后保存。": ". Edit this field, then save.",
            "点击预览里的文字，或在下方修改字段。": "Click text in the preview, or edit the fields below.",
            "当前页已被删除，输入仍保留，请复制需要的内容后取消修改。": "This slide was deleted. Your input is preserved; copy anything you need before cancelling your edits.",
            "已载入最新版本并保留你的修改，请核对后再保存。": "Latest version loaded with your edits preserved. Review before saving.",
            "内容没有变化。": "No changes to save.",
            "已保存，HTML、PPTX 和工程文件已同步更新。": "Saved. HTML, PPTX and project files were updated together.",
            "页面顺序已更新，可撤销。": "Slides reordered. You can undo this change.",
            "复制本页": "Duplicate slide",
            "删除本页": "Delete slide",
            "页面已复制，图片、图表和备注一并保留，可撤销。": "Slide duplicated with its images, charts and notes. You can undo this change.",
            "页面已删除，可撤销。": "Slide deleted. You can undo this change.",
            "已撤销上次修改。": "Last change undone.",
            "当前 PPTX 已生成逐页图片，请查看画面。": "Slide images were rendered from the current PPTX. Review each slide.",
            "正在渲染最终 PPTX，较大文件可能需要几分钟…": "Rendering the final PPTX. Large files may take a few minutes…",
            "已请求下载，请查看浏览器的下载列表。": "Download requested. Check your browser’s downloads.",
            "请选择 5 MiB 以内的 PNG 或 JPEG 图片。": "Choose a PNG or JPEG image up to 5 MiB.",
            "无法读取图片，请重试。": "Could not read the image. Try again.",
            "正在读取图片，切换页面会取消本次读取。": "Reading the image. Switching slides cancels this upload.",
            "图片已载入，保存后生效。": "Image loaded. Save this slide to apply it.",
            "下载讲稿 Markdown": "Download speaker notes",
            "另存副本": "Save a copy",
            "副本已保存，原文件保留。副本从工程生成，不包含 Office 手工修改。": "Copy saved. Original files are preserved. The copy is rebuilt from the project and does not include external Office edits.",
            "演示文稿编辑": "Presentation editor",
            "修改本插件生成的成品，保存时同步更新 HTML、可编辑 PPTX 和工程文件。": "Edit presentations generated by this plugin. Saving updates the HTML, editable PPTX and project file together.",
            "载入最新版本，保留我的输入": "Load latest and keep my input",
            "刷新项目": "Refresh projects",
            "还没有可以编辑的项目": "No editable projects yet",
            "先在对话中让助手生成演示文稿。已有项目可以让助手调用 ppt_check 检查一次，它会出现在这里。": "Ask the assistant to generate a presentation in chat. For an existing project, ask it to run ppt_check; the project will appear here.",
            "示例：请把这份材料制作成可直接交付的演示文稿，生成 HTML、PPTX 和工程文件。": "Example: Turn this material into a presentation ready to deliver, including HTML, PPTX and project files.",
            "返回项目": "Back to projects",
            " 页 · 修订 ": " slides · Revision ",
            "页面": "Slides",
            "未命名页": "Untitled slide",
            "上移": "Move up",
            "下移": "Move down",
            "HTML 预览": "HTML preview",
            "最终 PPTX 预览": "Final PPTX preview",
            "渲染当前 PPTX": "Render current PPTX",
            "演示文稿 HTML 预览": "Presentation HTML preview",
            "此项目尚无 HTML，请保存一次生成预览。": "This project has no HTML yet. Save to generate a preview.",
            "最终 PPTX 第 ": "Final PPTX slide ",
            " 页渲染结果": " rendered image",
            "正在载入当前页渲染…": "Loading the rendered slide…",
            "这是 HTML 放映预览。最终 PPTX 的字体和排版请用上方渲染检查。点击文字可定位编辑字段。": "This is the HTML playback preview. Use the render controls above to check fonts and layout in the final PPTX. Click text to focus its editing field.",
            "这是当前 PPTX 文件的实际渲染图片，仍需检查每页画面；PowerPoint / WPS 可能因字体环境而不同。": "This image is rendered from the current PPTX. Review every slide; PowerPoint / WPS may display it differently depending on installed fonts.",
            "渲染引擎报告缺失字体：": "The renderer reported missing fonts: ",
            "。请替换为目标电脑可用字体后重新渲染。": ". Choose fonts available on the target computer and render again.",
            "编辑第 ": "Edit slide ",
            " 页": "",
            "有未保存修改，请先保存或取消，再切换页面。": "You have unsaved edits. Save or cancel before switching slides.",
            "这些字段也被修改过，请比较后决定是否保存：": "These fields were changed elsewhere. Compare them before saving:",
            "最新版本：": "Latest version: ",
            "你的修改：": "Your edits: ",
            "替换图片（PNG / JPEG）": "Replace image (PNG / JPEG)",
            "添加图片（会改为图文布局）": "Add image (changes to an image-and-text layout)",
            "当前图片": "Current image",
            "已选择：": "Selected: ",
            "图片说明": "Image description",
            "图片适应方式": "Image fit",
            "完整显示": "Show complete image",
            "填满并裁切": "Fill and crop",
            "保存此页": "Save slide",
            "取消修改": "Cancel edits",
            "撤销上次修改": "Undo last change",
            "质量提醒（": "Quality findings (",
            "第 ": "Slide ",
            " 页：": ": ",
            "下载最新 PPTX": "Download latest PPTX",
            "下载成品包 ZIP": "Download delivery ZIP",
            "成品包包含 PPTX、HTML 和工程文件。请先保存修改，再下载最新版本。": "The bundle includes the PPTX, HTML and project file. Save your edits before downloading the latest version.",
            "下载 HTML": "Download HTML",
            "备份工程": "Back up project",
            "快捷键：Ctrl/⌘+S 保存 · Esc 取消或返回 · Alt+←/→ 切换页面": "Shortcuts: Ctrl/⌘+S save · Esc cancel or go back · Alt+←/→ switch slides",
            "未保存": "Unsaved",
            "有未保存修改，确定取消吗？": "Discard unsaved changes?",
            "已取消未保存的修改。": "Unsaved changes discarded.",
            "有未保存修改，离开页面会丢失。": "You have unsaved changes that will be lost.",
            "重试": "Retry",
            "复制示例": "Copy example",
            "已复制示例": "Example copied",
            "演示文稿": "Presentations"
        });
        function languageOf(locale = localeService) {
            try {
                const value = String(locale?.getSnapshot?.().active || '');
                return value.startsWith('en') ? 'en' : value.startsWith('ru') ? 'ru' : 'zh';
            }
            catch {
                return 'zh';
            }
        }
        // Russian workbench UI: RU dict first, then the English argument / EN dict, then the Chinese original.
        function t(zh, en) {
            const language = languageOf();
            return language === 'ru' ? (RU[zh] ?? en ?? EN[zh] ?? zh) : language === 'en' ? (en ?? EN[zh] ?? zh) : zh;
        }
        function englishError(message, status) {
            if (status === 401)
                return 'Your session has expired. Reopen DSH and try again.';
            if (status === 404)
                return 'The presentation workbench is unavailable. Check that the plugin is loaded and restart DSH.';
            if (status === 409)
                return 'The project changed. Load the latest version and review your edits before saving.';
            return /[\u3400-\u9fff]/.test(message || '') ? 'The operation failed. Check the project files and DSH logs, then retry. Details: ' + String(message).replace(/^dsh-ppt：/, '') : message;
        }
        function useLanguage(locale) {
            const [, rerender] = useState(0);
            useEffect(() => { const update = () => rerender(n => n + 1); update(); return locale?.subscribe?.(update); }, [locale]);
        }
        const ROUTE = 'api/dsh-ppt/workbench';
        const fields = [['title', '标题'], ['subtitle', '副标题'], ['kicker', '眉题'], ['text', '正文'], ['bullets', '要点（每行一条）'], ['notes', '演讲备注']];
        const css = `
  .pptw {--fg:var(--dsw-alias-label-primary,#27354b);--fg-muted:var(--dsw-alias-label-tertiary,#66768a);--bg:var(--dsw-alias-bg-layer-1,#fff);--bg-surface:var(--dsw-alias-bg-layer-2,#fff);--border:var(--dsw-alias-border-l3,#ccd8e5);color:var(--fg);font:14px/1.6 system-ui,sans-serif;min-width:0;max-width:1140px;margin:0 auto;padding:8px}
  .pptw *{box-sizing:border-box}.pptw h2{font-size:22px;margin:0}.pptw h3{font-size:16px;margin:12px 0 6px}
  .pptw .muted{color:var(--w-muted,#66768a);font-size:13px}.pptw .tools{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0;align-items:center}
  .pptw button{font:inherit;border:1px solid var(--w-border,#ccd8e5);border-radius:9px;background:var(--w-bg,#fff);color:inherit;padding:7px 12px;cursor:pointer;text-align:left;white-space:normal}
  .pptw button.primary{background:var(--w-primary,#245ee9);border-color:var(--w-primary,#245ee9);color:var(--w-on-primary,#fff)}.pptw button:disabled{opacity:.45;cursor:default}
  .pptw input:not([type=file]),.pptw textarea,.pptw select{font:inherit;color:inherit;width:100%;background:var(--w-bg,#fff);border:1px solid var(--w-border,#c9d5e4);border-radius:8px;padding:8px 10px}
  .pptw textarea{resize:vertical}.pptw label{display:block;margin:8px 0 3px}.pptw .layout{display:grid;grid-template-columns:minmax(130px,190px) minmax(0,1fr);gap:14px}
  .pptw .pages{display:flex;flex-direction:column;gap:5px;max-height:480px;overflow:auto}.pptw .pages button[aria-current=true]{background:var(--w-selected,#e9eefc);color:var(--w-accent,#245ee9);border-color:var(--w-accent,#245ee9)}
  .pptw .preview{border:1px solid var(--w-border,#ced8e6);border-radius:12px;overflow:hidden;background:var(--w-soft,#f0f4fa);aspect-ratio:16/9;position:relative}
  .pptw iframe{position:absolute;inset:0;width:100%;height:100%;border:0}.pptw .render-page{width:100%;display:block}.pptw .preview .ppt-fullscreen-exit{display:none}.pptw .preview:fullscreen .ppt-fullscreen-exit{display:inline-flex;position:absolute;top:10px;inset-inline-end:10px;z-index:2}
  .pptw .notice{border-radius:9px;padding:10px 12px;margin:10px 0;background:color-mix(in srgb,var(--w-accent,#5686fe) 12%,var(--w-bg,#fff));color:var(--w-text);overflow-wrap:anywhere}.pptw .error{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f25a5a) 14%,var(--w-bg,#fff))}
  .pptw .card{border:1px solid var(--w-border,#d5dfeb);border-radius:12px;padding:12px;margin:10px 0;background:var(--w-bg,#fff)}
  .pptw .coaching{margin-top:24px}.pptw .coaching-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 14px}
  .pptw .coaching label.choice{display:flex;gap:8px;align-items:flex-start}.pptw .coaching input[type=checkbox]{width:auto;flex:none;margin-top:5px}
  .pptw .coaching pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;margin:6px 0}.pptw .coaching blockquote{margin:8px 0;padding-left:12px;border-left:3px solid var(--w-border,#ccd8e5);overflow-wrap:anywhere}
  .pptw .coaching .card{overflow-wrap:anywhere}.pptw .coaching .before-after{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .pptw .cascade{position:relative}
  .pptw .cascade-toggle{width:100%;display:flex;justify-content:space-between;align-items:center;gap:8px}
  .pptw .cascade-flyout{position:absolute;z-index:30;top:calc(100% + 4px);inset-inline-start:0;width:min(460px,100%);max-height:300px;overflow:auto;background:var(--w-bg,#fff);border:1px solid var(--w-border,#ccd8e5);border-radius:10px;box-shadow:0 12px 32px rgba(15,35,70,.18);padding:8px}
  .pptw .cascade-head{display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-bottom:4px}
  .pptw .cascade-provider{font-size:12px;font-weight:600;color:var(--w-muted,#66768a);margin:10px 0 4px}
  .pptw .cascade-model{display:block;width:100%}
  .pptw .cascade-model[aria-pressed=true]{background:var(--w-selected,#e9eefc);color:var(--w-accent,#245ee9);border-color:var(--w-accent,#245ee9)}
  .pptw .project-list{display:flex;flex-direction:column;gap:8px}.pptw .project-list button{display:block;width:100%}
  .pptw .file{font-size:12px;overflow-wrap:anywhere}.pptw .image-preview{width:100%;max-height:160px;object-fit:contain;background:var(--w-soft,#edf2f8);border-radius:8px}
  .pptw :focus-visible{outline:3px solid var(--w-accent,#78a8ff);outline-offset:2px}.pptw .dirty{color:var(--dsw-alias-state-warn-primary,#986114);font-size:13px}
.pptw .badge-dirty{color:var(--dsw-alias-state-warn-primary,#986114);font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;background:rgba(245,158,11,.14);border:1px solid rgba(245,158,11,.35);margin-left:4px}
.pptw .notice button{margin-left:8px;padding:2px 9px;border-radius:6px;border:1px solid currentColor;background:transparent;color:inherit;font-size:12px;cursor:pointer}
  .pptw .ppt-restyle-dialog .w-toolbar[role=list]{flex-wrap:wrap;gap:8px}
  .pptw .ppt-restyle-dialog .w-toolbar[role=list] button{display:inline-flex;align-items:center;border:1px solid var(--w-border,#ccd8e5);border-radius:8px;padding:6px 10px;cursor:pointer}
  .pptw .ppt-restyle-dialog .w-toolbar[role=list] button[aria-pressed=true]{border-color:var(--w-accent,#245ee9);color:var(--w-accent,#245ee9)}
  [role=dialog]:has(.pptw){width:min(1200px,calc(100vw - 48px))!important;max-width:1200px!important}
  @media(max-width:700px){.pptw .layout{grid-template-columns:1fr}.pptw .pages{max-height:180px}.pptw .preview{min-height:190px}.pptw{padding:3px}
    .pptw .coaching-grid,.pptw .coaching .before-after{grid-template-columns:1fr}
    [role=dialog]:has(.pptw){width:100%!important;max-width:100%!important;flex-direction:column!important}
    [role=dialog]:has(.pptw)>nav+div{min-width:0;width:100%}
    [role=dialog]:has(.pptw)>nav+div>div:has(.pptw){padding:12px!important;min-width:0}
    [role=dialog]:has(.pptw) nav{width:100%!important;flex-basis:auto!important;border-right:0;max-height:170px;overflow:auto}
    [role=dialog]:has(.pptw) nav>div:has(>button){display:flex;flex-direction:row!important;flex-wrap:wrap;flex-shrink:0;gap:4px}
  }`;
        async function action(body, signal) {
            const response = await fetch(new URL(ROUTE, document.baseURI), { method: 'POST', credentials: 'same-origin', signal,
                headers: { 'content-type': 'application/json', 'x-dsh-ppt-action': '1' }, body: JSON.stringify(body) });
            let value;
            try {
                value = await response.json();
            }
            catch {
                throw new Error(t("无法读取服务响应，请检查插件是否加载"));
            }
            if (!response.ok || value.ok === false) {
                const language = languageOf();
                const localized = language === 'ru'
                    ? (typeof RU_ERRORS === 'object' && RU_ERRORS[value.message]) || value.messageEn || englishError(value.message, response.status)
                    : language !== 'zh' ? value.messageEn || englishError(value.message, response.status) : value.message;
                const hint = language !== 'zh' ? value.installationHintEn : value.installationHint;
                const error = new Error((localized || t("操作未完成")) + (hint ? '\n' + hint : ''));
                error.status = response.status;
                throw error;
            }
            return value;
        }
        function draftFor(slide) {
            const source = { ...slide, ...slide.dataTemplate };
            return { title: source.title || '', subtitle: source.subtitle || '', kicker: source.kicker || '', text: source.text || '',
                bullets: (source.bullets || []).join('\n'), notes: source.notes || '' };
        }
        function editorHtml(html, nonce) {
            const bridge = `<style>#hud,#delivery-bar,#review-panel,#progress,#notes-panel,#help-panel,#toast,#blank{display:none!important}.slide-frame{pointer-events:none!important}.slide-frame .slide{pointer-events:auto!important}</style><script>(function(){const nonce=${JSON.stringify(nonce)};
      function tell(field){parent.postMessage({type:'dsh-ppt-select',nonce:nonce,field:field},'*')}
      document.addEventListener('keydown',function(e){
        if(e.target.closest('#data-panel'))return;
        var mod=e.ctrlKey||e.metaKey;
        if(mod&&(e.key==='s'||e.key==='S')){e.preventDefault();e.stopImmediatePropagation();parent.postMessage({type:'dsh-ppt-shortcut',nonce:nonce,key:'save'},'*');return}
        if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();parent.postMessage({type:'dsh-ppt-shortcut',nonce:nonce,key:'escape'},'*');return}
        if(e.altKey&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();e.stopImmediatePropagation();parent.postMessage({type:'dsh-ppt-shortcut',nonce:nonce,key:e.key==='ArrowLeft'?'prev':'next'},'*');return}
        e.stopImmediatePropagation();if(e.key!=='Tab')e.preventDefault()
      },true);
      document.addEventListener('touchstart',function(e){e.stopImmediatePropagation()},true);
      document.addEventListener('touchend',function(e){e.stopImmediatePropagation()},true);
      document.addEventListener('wheel',function(e){e.stopImmediatePropagation()},{capture:true,passive:true});
      document.addEventListener('click',function(e){if(e.target.closest('#data-panel,.data-number,.data-chart-trace'))return;const n=e.target.closest('h1,h2,.subtitle,.kicker,.statement-title,.quote-text,.quote-attr,li');if(!n)return;
        e.preventDefault();e.stopImmediatePropagation();let field=n.matches('li')?'bullets':n.matches('.subtitle,.quote-attr')?'subtitle':n.matches('.kicker')?'kicker':'title';tell(field)},true);
      window.addEventListener('message',function(e){if(e.source!==parent||e.data?.nonce!==nonce)return;if(e.data.type==='dsh-ppt-jump')window.__dshPpt?.jump(e.data.page);if(e.data.type==='dsh-ppt-data-set'&&window.__dshData){window.__dshData.setParameters(e.data.parameters);const state=window.__dshData.getState();parent.postMessage({type:'dsh-ppt-data',nonce,parameters:e.data.parameters,valid:state.valid,command:e.data.command},'*')}});
      if(window.__dshData)window.__dshData.onChange=function(parameters,dirty,valid){parent.postMessage({type:'dsh-ppt-data',nonce,parameters,dirty,valid},'*')};
    })();<\/script>`;
            const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:; connect-src 'none'; form-action 'none'">`;
            // Presenter code contains a quoted </body>; only append at the document end.
            return html.replace(/<head>/i, '<head>' + policy).replace(/<\/body>(\s*<\/html>\s*)$/i, bridge + '</body>$1');
        }
        function createImageLoader() {
            let current = null;
            function cancel() {
                const reader = current;
                current = null;
                if (reader?.readyState === 1)
                    reader.abort();
            }
            return {
                cancel,
                get pending() { return current !== null; },
                read(file, success, failure) {
                    cancel();
                    const reader = new FileReader();
                    current = reader;
                    const settle = callback => { if (current !== reader)
                        return; current = null; callback(); };
                    reader.onload = () => settle(() => success(String(reader.result)));
                    reader.onerror = () => settle(failure);
                    reader.onabort = () => { if (current === reader)
                        current = null; };
                    try {
                        reader.readAsDataURL(file);
                    }
                    catch {
                        settle(failure);
                    }
                },
            };
        }
        function modelRouteKey(model) { return JSON.stringify([model.provider, model.model]); }
        function findModelRoute(models, key) { return key ? models.find(model => modelRouteKey(model) === key) : undefined; }
        function reconcileModelRoute(models, selected, preferred) {
            if (selected)
                return findModelRoute(models, selected) ? selected : '';
            const key = preferred ? modelRouteKey(preferred) : '';
            return findModelRoute(models, key) ? key : '';
        }
        function CoachingPanel({ project, selected, blocked, onAdopt, onChoose }) {
const fieldId=React.useId();
            const L = (zh, en) => pptText(zh, en);
            const [mode, setMode] = useState(''), [routes, setRoutes] = useState([]), [route, setRoute] = useState('');
            const [difficulty, setDifficulty] = useState('normal'), [audience, setAudience] = useState('general'), [limit, setLimit] = useState(1);
            const [scope, setScope] = useState('all'), [material, setMaterial] = useState(''), [run, setRun] = useState(null), [history, setHistory] = useState([]);
            const [answer, setAnswer] = useState(''), [patches, setPatches] = useState([]), [backups, setBackups] = useState([]);
            const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
            const active = useRef(null), alive = useRef(true), current = useRef(null), runRef = useRef(null), reading = useRef(0), routeInitialized = useRef(false);
            current.current = { project, selected, blocked };
            runRef.current = run;
            const stale = !!run && (run.stale || run.revision !== project.revision);
            const maxCalls = mode === 'review' ? limit : limit + 1;
            const modeName = value => value === 'review' ? L('AI 预审', 'AI review') : L('模拟答辩', 'Rehearsal');
            const statusName = value => ({ ready: L('等待下一步', 'Ready'), busy: L('正在调用模型', 'Calling model'), paused: L('已暂停', 'Paused'), complete: L('已结束', 'Finished') })[value] || value;
            const kindName = value => ({ expression: L('表达建议', 'Expression'), logic: L('逻辑问题', 'Logic'), evidence: L('证据缺口', 'Missing evidence') })[value];
            const modelHint = L('先在 DSH 的模型设置中配置可用模型，再点“刷新模型”。成品仍可直接下载。', 'Configure a model in DSH, then refresh models. Your finished files remain available.');
            function accept(value) { if (alive.current) {
                runRef.current = value;
                setRun(value);
            } }
            const request = (operation, data = {}, signal) => action({ operation: 'coach-' + operation, id: current.current.project.id, expectedRevision: current.current.project.revision, ...data }, signal);
            async function refresh(signal) { const value = await request('list', {}, signal); if (alive.current)
                setHistory(value.runs); }
            useEffect(() => {
                alive.current = true;
                return () => {
                    alive.current = false;
                    reading.current++;
                    if (active.current) {
                        active.current.abort();
                        const item = runRef.current;
                        if (item)
                            void request('stop', { runId: item.id }).catch(() => { });
                    }
                };
            }, []);
            useEffect(() => {
                if (!run || run.status !== 'busy' || busy)
                    return;
                const controller = new AbortController();
                const timer = setInterval(() => { void request('get', { runId: run.id }, controller.signal).then(value => { if (!controller.signal.aborted)
                    accept(value.run); }).catch(() => { }); }, 750);
                return () => { clearInterval(timer); controller.abort(); };
            }, [run?.id, run?.status, busy]);
            async function task(work) {
                if (active.current)
                    return;
                const controller = new AbortController();
                active.current = controller;
                setBusy(true);
                setError('');
                setNotice('');
                try {
                    await work(controller.signal);
                }
                catch (e) {
                    if (!alive.current)
                        return;
                    if (!controller.signal.aborted)
                        setError(e.message || L('操作失败', 'Operation failed'));
                    const item = runRef.current;
                    if (item) {
                        try {
                            accept((await request('get', { runId: item.id })).run);
                        }
                        catch { /* Keep visible results. */ }
                    }
                }
                finally {
                    if (active.current === controller)
                        active.current = null;
                    if (alive.current)
                        setBusy(false);
                }
            }
            // Catalog or server listing rows land here: routes state feeds the start
            // validation, the selection key keeps its JSON.stringify([provider, model]) shape.
            function adoptRoutes(models) {
                const preferred = routeInitialized.current ? undefined : project.modelRoute;
                routeInitialized.current = true;
                setRoutes(models);
                setRoute(value => reconcileModelRoute(models, value, preferred));
            }
            function configure(value) {
                if (active.current || !canLeave())
                    return;
                setMode(value);
                setLimit(value === 'review' ? 1 : 3);
                accept(null);
                setPatches([]);
                setBackups([]);
                setAnswer('');
                return task(async (signal) => {
                    const results = await Promise.allSettled([request('options', {}, signal), refresh(signal)]);
                    if (signal.aborted || !alive.current)
                        return;
                    const available = results[0];
                    if (available.status === 'rejected')
                        throw available.reason;
                    const models = available.value.routes;
                    adoptRoutes(models);
                    if (!models.length)
                        setNotice(modelHint);
                    if (results[1].status === 'rejected')
                        throw results[1].reason;
                });
            }
            function canLeave() {
                const item = runRef.current, question = item?.questions.at(-1);
                return !(item?.mode === 'practice' && question && !question.feedback && answer.trim() && answer.trim() !== (question.answer || '')) || window.confirm(L('当前回答尚未提交，离开会丢失。继续吗？', 'Your answer has not been submitted and will be lost. Continue?'));
            }
            async function advance(item, signal, response) {
                let next = (await request('step', { runId: item.id, confirmed: true, ...(response === undefined ? {} : { answer: response }) }, signal)).run;
                accept(next);
                // Only this explicit Start click authorizes the configured review rounds.
                while (next.mode === 'review' && next.status === 'ready' && !next.stale && !signal.aborted && current.current.project.revision === next.revision) {
                    next = (await request('step', { runId: next.id, confirmed: true }, signal)).run;
                    accept(next);
                }
                await refresh(signal);
                if (alive.current && response !== undefined)
                    setAnswer('');
            }
            function start() {
                if (current.current.blocked)
                    return;
                return task(async (signal) => {
                    const model = findModelRoute(routes, route);
                    if (!model)
                        throw new Error(L('请选择模型', 'Choose a model'));
                    reading.current++;
                    const item = (await request('create', { confirmed: true, mode, ...model, difficulty, audience, limit, material,
                        language: languageOf(), ...(scope === 'current' ? { slideId: current.current.selected } : {}) }, signal)).run;
                    accept(item);
                    await advance(item, signal);
                });
            }
            function stop() {
                active.current?.abort();
                if (runRef.current)
                    void request('stop', { runId: runRef.current.id }).then(value => accept(value.run)).catch(e => { if (alive.current)
                        setError(e.message); });
                setNotice(L('已请求停止。已完成的结果保留，本次调用仍可能计费。', 'Stop requested. Completed results are kept; the current call may still be billed.'));
            }
            function finish() { return task(async (signal) => { accept((await request('finish', { runId: run.id }, signal)).run); await refresh(signal); }); }
            function openReport(id) { if (!canLeave())
                return; return task(async (signal) => { const value = (await request('get', { runId: id }, signal)).run; accept(value); setMode(value.mode); setAnswer(value.questions.at(-1)?.answer || ''); setPatches([]); setBackups([]); }); }
            function removeReport() {
                if (!window.confirm(L('删除这次本地演练记录？幻灯片成品不受影响。', 'Delete this local rehearsal record? Presentation files are kept.')))
                    return;
                return task(async (signal) => { await request('delete', { runId: run.id }, signal); accept(null); await refresh(signal); });
            }
            function exportReport() {
                const url = new URL('api/dsh-ppt/download', document.baseURI);
                for (const [key, value] of Object.entries({ id: project.id, kind: 'coaching', revision: project.revision, run: run.id }))
                    url.searchParams.set(key, String(value));
                const link = document.createElement('a');
                link.href = url.href;
                link.download = '';
                link.hidden = true;
                document.body.append(link);
                link.click();
                link.remove();
            }
            function applySelected() {
                if (current.current.blocked || stale)
                    return;
                return task(async (signal) => {
                    const value = await request('apply', { runId: run.id, confirmed: true, selected: patches, backup: backups }, signal);
                    if (alive.current)
                        onAdopt(value.project);
                });
            }
            async function uploadMaterial(event) {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file)
                    return;
                const ticket = ++reading.current;
                if (!/\.(txt|md)$/i.test(file.name) || file.size > 100000) {
                    setError(L('请选择 100 KB 以内的 TXT / Markdown 文件。', 'Choose a TXT / Markdown file up to 100 KB.'));
                    return;
                }
                try {
                    const value = await file.text();
                    if (!alive.current || ticket !== reading.current)
                        return;
                    if (value.length > 20000)
                        throw new Error(L('补充材料最多 20000 字符。', 'Supporting material: up to 20,000 characters.'));
                    setMaterial(value);
                    setError('');
                }
                catch (e) {
                    if (alive.current && ticket === reading.current)
                        setError(e.message);
                }
            }
            function toggle(set, values, id) { set(values.includes(id) ? values.filter(v => v !== id) : [...values, id]); }
            function pageButton(id) {
                const index = project.slides.findIndex(s => s.id === id);
                return h('button', { disabled: blocked || index < 0, onClick: () => onChoose(id) }, L('查看第 ', 'View slide ') + (index + 1) + L(' 页', ''));
            }
            function source(card) { return card.reference ? h('blockquote', null, h('small', { className: 'muted' }, card.reference === 'material' ? L('补充材料中的原文', 'Quote from supporting material') : L('幻灯片中的原文', 'Quote from slides')), h('pre', null, card.quote)) : h('p', { className: 'muted' }, L('未匹配到材料原文，请核对或补充依据。', 'No matching source quote. Verify or add supporting evidence.')); }
            const last = run?.questions.at(-1);
// Update protection: dsh-ppt.coaching
__stardustUpdatesGuard(React, "dsh-ppt.coaching", { dirty: !!last && !last.feedback && !!answer.trim() && answer.trim() !== (last.answer || ''), busy });

            useEffect(() => {
                if (!last || last.feedback || !answer.trim() || answer.trim() === (last.answer || ''))
                    return;
                const warn = event => { event.preventDefault(); event.returnValue = ''; };
                window.addEventListener('beforeunload', warn);
                return () => window.removeEventListener('beforeunload', warn);
            }, [run?.id, last?.id, last?.feedback, last?.answer, answer]);
            return h('section', { className: 'card coaching', 'aria-label': L('可选演练', 'Optional rehearsal'), onKeyDown: e => { if (e.key === 'Escape' || (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                    e.stopPropagation();
                    if (e.key.toLowerCase() === 's')
                        e.preventDefault();
                } } }, h('h3', null, L('想再准备充分一点？', 'Want to prepare further?')), h('p', { className: 'muted' }, L('成品已可下载。以下两项按需开启，不影响直接交付。', 'Your files are ready to download. Both options below are optional.')), h('div', { className: 'tools' }, h('button', { disabled: busy, 'aria-pressed': mode === 'review', onClick: () => configure('review') }, L('AI 预审', 'AI review')), h('button', { disabled: busy, 'aria-pressed': mode === 'practice', onClick: () => configure('practice') }, L('模拟答辩', 'Rehearsal')), mode && h('button', { disabled: busy, onClick: () => { if (canLeave()) {
                    setMode('');
                    accept(null);
                    setAnswer('');
                } } }, L('收起', 'Collapse'))), mode && h(React.Fragment, null, error && h('div', { role: 'alert', className: 'notice error' }, error), notice && h('div', { role: 'status', className: 'notice' }, notice), busy && h('div', { role: 'status', className: 'tools' }, L('正在处理…可以继续预览或下载成品。', 'Working… You can still preview or download your presentation.'), h('button', { onClick: stop }, L('停止', 'Stop'))), !run && h(React.Fragment, null, h('p', null, mode === 'review' ? L('AI 根据材料模拟质疑与回答，最多保留 5 个值得改进的问题。', 'AI simulates questions and answers based on your material, keeping up to five useful findings.') : L('AI 一次问一题，你来回答；可随时结束并整理已完成的问答。', 'AI asks one question at a time. You answer and can finish at any point.')), h('div', { className: 'coaching-grid' }, h('label', null, L('模型', 'Model'), h(ModelCascade, { label: L('演练模型', 'Rehearsal model'), placeholder: L('请选择模型', 'Choose a model'), emptyHint: modelHint, accept: acceptsText, value: route, selectedLabel: findModelRoute(routes, route)?.label || '', disabled: busy, onRoutes: models => { adoptRoutes(models); setNotice(models.length ? '' : modelHint); }, onPick: model => setRoute(modelRouteKey(model)) })), h('label', null, L('听众', 'Audience'), h('select', { 'aria-label': L('听众', 'Audience'), value: audience, disabled: busy, onChange: e => setAudience(e.target.value) }, [['general', L('一般听众', 'General audience')], ['management', L('管理层 / 客户', 'Management / clients')], ['academic', L('答辩评委', 'Academic panel')]].map(([v, label]) => h('option', { key: v, value: v }, label)))), h('label', null, L('提问强度', 'Difficulty'), h('select', { 'aria-label': L('提问强度', 'Difficulty'), value: difficulty, disabled: busy, onChange: e => setDifficulty(e.target.value) }, [['gentle', L('温和', 'Gentle')], ['normal', L('普通', 'Normal')], ['strict', L('严格', 'Strict')]].map(([v, label]) => h('option', { key: v, value: v }, label)))), h('label', null, mode === 'review' ? L('预审轮数', 'Review rounds') : L('答辩题数', 'Questions'), h('select', { 'aria-label': mode === 'review' ? L('预审轮数', 'Review rounds') : L('答辩题数', 'Questions'), value: limit, disabled: busy, onChange: e => setLimit(Number(e.target.value)) }, Array.from({ length: mode === 'review' ? 3 : 5 }, (_, i) => h('option', { key: i, value: i + 1 }, String(i + 1))))), h('label', null, L('检查范围', 'Scope'), h('select', { 'aria-label': L('检查范围', 'Scope'), value: scope, disabled: busy, onChange: e => setScope(e.target.value) }, h('option', { value: 'all' }, L('整个工程', 'Whole presentation')), h('option', { value: 'current' }, L('当前页', 'Current slide'))))), h('label', { htmlFor: fieldId + '-ppt-coach-material' }, L('补充材料（可选）', 'Supporting material (optional)')), h('textarea', { id: fieldId + '-ppt-coach-material', rows: 3, maxLength: 20000, value: material, disabled: busy, onChange: e => { reading.current++; setMaterial(e.target.value); } }), h('label', null, L('或导入 TXT / Markdown', 'Or import TXT / Markdown'), h('input', { type: 'file', accept: '.txt,.md,text/plain,text/markdown', disabled: busy, onChange: uploadMaterial })), h('p', { className: 'muted' }, L('将所选页面的文字、图表数据、备注及补充材料发送给所选 DSH 模型，不发送图片文件。最多 ' + maxCalls + ' 次插件调用；模型服务自身的重试与计费规则仍适用。', 'Sends selected slide text, chart data, notes and supporting material to the chosen DSH model. Image files are excluded. Up to ' + maxCalls + ' plugin calls; provider retry and billing rules still apply.')), h('div', { className: 'tools' }, h('button', { disabled: busy || blocked || !findModelRoute(routes, route), onClick: start }, mode === 'review' ? L('开始 AI 预审', 'Start AI review') : L('开始模拟答辩', 'Start rehearsal')), h('button', { disabled: busy, onClick: () => configure(mode) }, L('刷新模型', 'Refresh models'))), blocked && h('p', { className: 'muted' }, L('请先保存或取消幻灯片修改。', 'Save or cancel slide edits first.'))), run && h(React.Fragment, null, h('h3', null, modeName(run.mode) + ' · ' + statusName(run.status)), h('p', { className: 'muted' }, L('修订 ', 'Revision ') + run.revision + ' · ' + run.route.provider + ' / ' + run.route.model + ' · ' + L('调用 ', 'Calls ') + run.usedCalls + '/' + run.maxCalls), h('p', { className: 'muted' }, L('AI 意见不等于事实核验，也不代表真实听众的评价。请先看原文与改动，再决定是否采纳。', 'AI suggestions are not fact checks or predictions of audience feedback. Compare sources and edits before adopting them.')), stale && h('div', { role: 'alert', className: 'notice' }, L('工程已经修改。旧报告仍可导出，但不能继续调用或采纳；请重新开始。', 'The presentation changed. You can export this report, but cannot continue or apply it. Start a new rehearsal.')), run.error && h('p', { className: 'muted' }, languageOf() !== 'zh' ? run.error.split(' / ').at(-1) : run.error.split(' / ')[0]), run.findings.map(f => {
                const slide = project.slides.find(s => s.id === f.slideId);
                return h('article', { key: f.id, className: 'card' }, h('strong', null, kindName(f.kind) + ' · ' + f.issue), h('div', { className: 'tools' }, pageButton(f.slideId)), h('p', null, f.question), h('p', null, f.answer), h('p', null, f.suggestion), source(f), f.patch && h(React.Fragment, null, h('details', null, h('summary', null, L('比较原文和建议', 'Compare before and after')), Object.entries(f.patch).map(([key, value]) => h('div', { key }, h('strong', null, t(fields.find(([name]) => name === key)?.[1] || key)), h('div', { className: 'before-after' }, h('div', null, h('small', null, L('原文', 'Before')), h('pre', null, Array.isArray(slide?.[key]) ? slide[key].join('\n') : slide?.[key] || '')), h('div', null, h('small', null, L('建议', 'After')), h('pre', null, Array.isArray(value) ? value.join('\n') : value)))))), h('label', { className: 'choice' }, h('input', { type: 'checkbox', disabled: busy || stale, checked: patches.includes(f.id), onChange: () => toggle(setPatches, patches, f.id) }), L('采纳这项表达修改', 'Adopt this expression edit'))), h('label', { className: 'choice' }, h('input', { type: 'checkbox', disabled: busy || stale, checked: backups.includes(f.id), onChange: () => toggle(setBackups, backups, f.id) }), L('选为备用问答页', 'Add as a backup Q&A slide')));
            }), run.mode === 'review' && run.status === 'complete' && !run.findings.length && h('p', null, L('本次未提出明显问题。仍建议检查事实、字体和最终 PPTX。', 'No findings this time. Still check facts, fonts and the final PPTX.')), run.questions.map((q, i) => h('article', { key: q.id, className: 'card' }, h('strong', null, (i + 1) + '. ' + q.question), h('div', { className: 'tools' }, pageButton(q.slideId)), q.answer && h('p', null, L('你的回答：', 'Your answer: ') + q.answer), q.feedback && h('p', null, q.feedback), q.needsEvidence && h('p', { className: 'muted' }, L('待补充依据', 'Evidence needed')), source(q), q.answer && h('label', { className: 'choice' }, h('input', { type: 'checkbox', disabled: busy || stale, checked: backups.includes(q.id), onChange: () => toggle(setBackups, backups, q.id) }), L('选为备用问答页', 'Add as a backup Q&A slide')))), run.mode === 'practice' && last && !last.feedback && run.status !== 'complete' && !stale && h(React.Fragment, null, h('label', { htmlFor: 'ppt-coach-answer' }, L('你的回答', 'Your answer')), h('textarea', { id: 'ppt-coach-answer', maxLength: 4000, rows: 4, value: answer, disabled: busy, onChange: e => setAnswer(e.target.value) }), h('button', { disabled: busy || blocked || !answer.trim() || run.usedCalls >= run.maxCalls, onClick: () => task(signal => advance(run, signal, answer)) }, L('提交回答，继续', 'Submit answer and continue'))), h('div', { className: 'tools' }, h('button', { disabled: busy, onClick: exportReport }, L('下载问答与材料清单', 'Download Q&A and evidence checklist')), h('button', { disabled: busy || blocked || stale || !(patches.length + backups.length), onClick: applySelected }, L('将所选内容保存为副本', 'Save selected changes as a copy')), run.status !== 'complete' && h('button', { disabled: busy || run.status === 'busy', onClick: finish }, L('结束并整理已有结果', 'Finish with current results')), h('button', { disabled: busy, onClick: () => configure(run.mode) }, L('重新开始', 'Start again')), h('button', { disabled: busy || run.status === 'busy', onClick: removeReport }, L('删除本次记录', 'Delete this record'))), h('p', { className: 'muted' }, L('采纳后会生成新副本，原稿保留；副本中可“撤销上次修改”。备用页包含 AI 演练标记，请核对后再对外展示。', 'Adoption creates a copy and keeps the original. Undo last change also works in the copy. Backup slides identify AI rehearsal content; verify before presenting.'))), history.length > 0 && h('details', null, h('summary', null, L('本机历史记录（', 'Local history (') + history.length + L('）', ')')), h('div', { className: 'project-list' }, history.map(item => h('button', { key: item.id, disabled: busy, onClick: () => openReport(item.id) }, modeName(item.mode) + ' · ' + L('修订 ', 'Revision ') + item.revision + ' · ' + new Date(item.createdAt).toLocaleString(languageOf() === 'ru' ? 'ru-RU' : languageOf() === 'en' ? 'en-US' : 'zh-CN')))))));
        }
        const dataCss = `.pptw .data-workbench{margin-top:18px}.pptw .data-workbench details{margin:12px 0}.pptw .data-workbench summary{cursor:pointer;font-weight:600}.pptw .data-workbench pre,.pptw .data-workbench code{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;max-height:220px;overflow:auto}.pptw .data-input-row{margin:15px 0}.pptw .data-input-controls{display:grid;grid-template-columns:minmax(0,1fr) 115px;gap:12px;align-items:center}.pptw .data-input-controls input[type=range]{accent-color:var(--dsw-alias-brand-primary,#2563eb)}.pptw .data-before-after{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}.pptw .data-before-after pre{padding:10px;border:1px solid var(--dsw-alias-divider-default,#b8c0cc);border-radius:8px}.pptw .data-copy{display:flex;gap:8px;align-items:center}.pptw .data-copy input{width:auto}@media(max-width:640px){.pptw .data-before-after{grid-template-columns:minmax(0,1fr)}.pptw .data-input-controls{grid-template-columns:minmax(0,1fr) 100px}}`;
        function VisualPanel({ project, selected, blocked, onBusy, onAdopt }) {
            const L = (zh, en) => pptText(zh, en);
            const [expanded, setExpanded] = useState(false), [routes, setRoutes] = useState([]), [route, setRoute] = useState('');
            const [scope, setScope] = useState(project.slides.length > 12 ? 'current' : 'all'), [repairs, setRepairs] = useState(1);
            const [run, setRun] = useState(null), [history, setHistory] = useState([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
            const [compare, setCompare] = useState(''), [pictures, setPictures] = useState({}), [loading, setLoading] = useState(false);
// Update protection: dsh-ppt.visual
__stardustUpdatesGuard(React, "dsh-ppt.visual", { busy: busy || loading });

            const active = useRef(null), alive = useRef(true), current = useRef(null), runRef = useRef(null), progressVersion = useRef(0), routeInitialized = useRef(false);
            current.current = { project, selected, blocked };
            runRef.current = run;
            const request = (op, data = {}, signal) => action({ operation: 'visual-' + op, id: current.current.project.id, expectedRevision: current.current.project.revision, ...data }, signal);
            const accept = value => { if (alive.current) {
                progressVersion.current++;
                runRef.current = value;
                setRun(value);
            } };
            const phaseName = value => ({ render: L('正在渲染实际 PPTX', 'Rendering the actual PPTX'), inspect: L('正在看图检查', 'Inspecting rendered slides'), repair: L('正在生成排版副本', 'Creating a formatting copy'), done: L('检查已结束', 'Review finished') })[value] || value;
            const failureText = value => { const split = value.lastIndexOf(' / '); return split < 0 ? value : L(value.slice(0, split), value.slice(split + 3)); };
            const actionName = a => ({ 'title-size': L('标题字号', 'Title size'), 'body-size': L('正文字号', 'Body size'), 'chart-label-size': L('图表字号', 'Chart label size'), 'chart-horizontal': L('改为横向条形图', 'Use horizontal bars'), 'image-contain': L('完整显示图片', 'Show the complete image'), 'split-bullets': L('拆分要点页', 'Split bullet slide'), 'split-table': L('拆分表格页', 'Split table slide') })[a.type] + (a.value !== undefined ? ' · ' + a.value : '');
            useEffect(() => { alive.current = true; return () => { alive.current = false; active.current?.abort(); if (runRef.current && active.current)
                void request('stop', { runId: runRef.current.id }).catch(() => { }); }; }, []);
            useEffect(() => { if (!run || ['complete', 'paused'].includes(run.status) || !busy && run.status !== 'busy')
                return; const abort = new AbortController(), timer = setInterval(() => { const version = progressVersion.current; void request('get', { runId: run.id }, abort.signal).then(v => { if (!abort.signal.aborted && version === progressVersion.current)
                accept(v.run); }).catch(() => { }); }, 1000); return () => { clearInterval(timer); abort.abort(); }; }, [run?.id, run?.status, busy]);
            async function refresh(signal) { const value = await request('list', {}, signal); if (alive.current)
                setHistory(value.runs); }
            async function task(work, lock = false) {
                if (active.current)
                    return;
                const controller = new AbortController();
                active.current = controller;
                setBusy(true);
                setError('');
                if (lock)
                    onBusy(true);
                try {
                    await work(controller.signal);
                }
                catch (e) {
                    if (alive.current) {
                        if (!controller.signal.aborted)
                            setError(e.message || L('视觉检查失败', 'Visual review failed'));
                        if (runRef.current)
                            try {
                                accept((await request('get', { runId: runRef.current.id })).run);
                            }
                            catch { /* Keep the last checkpoint. */ }
                    }
                }
                finally {
                    if (active.current === controller)
                        active.current = null;
                    if (alive.current)
                        setBusy(false);
                    if (lock)
                        onBusy(false);
                }
            }
            // Catalog or server listing rows land here; see CoachingPanel.adoptRoutes.
            function adoptRoutes(models) {
                const preferred = routeInitialized.current ? undefined : project.modelRoute;
                routeInitialized.current = true;
                setRoutes(models);
                setRoute(value => reconcileModelRoute(models, value, preferred));
            }
            function configure() {
                setExpanded(true);
                return task(async (signal) => {
                    const results = await Promise.allSettled([request('options', {}, signal), refresh(signal)]);
                    if (results[0].status === 'rejected')
                        throw results[0].reason;
                    if (signal.aborted || !alive.current)
                        return;
                    adoptRoutes(results[0].value.routes);
                    if (results[1].status === 'rejected')
                        throw results[1].reason;
                });
            }
            function start() {
                if (current.current.blocked)
                    return;
                return task(async (signal) => {
                    const model = findModelRoute(routes, route);
                    if (!model)
                        throw new Error(L('请选择支持图片输入的模型', 'Choose an image-capable model'));
                    let value = (await request('create', { confirmed: true, ...model, repairs, language: languageOf(), ...(scope === 'current' ? { slideId: current.current.selected } : {}) }, signal)).run;
                    accept(value);
                    setPictures({});
                    setCompare('');
                    while (value.status === 'ready' && !signal.aborted) {
                        value = (await request('step', { runId: value.id, confirmed: true }, signal)).run;
                        accept(value);
                    }
                    await refresh(signal);
                    const last = value.rounds.at(-1);
                    if (alive.current && last?.rendered)
                        setCompare(last.ids[0]);
                }, true);
            }
            function stop() { active.current?.abort(); if (runRef.current)
                void request('stop', { runId: runRef.current.id }).then(value => accept(value.run)).catch(e => { if (alive.current)
                    setError(e.message); }); }
            function open(id) { return task(async (signal) => { const value = (await request('get', { runId: id }, signal)).run; accept(value); setCompare(value.rounds.at(-1)?.rendered ? value.rounds.at(-1).ids[0] : ''); }); }
            function adopt() { if (blocked || !run?.canAdopt)
                return; return task(async (signal) => { const value = await request('adopt', { runId: run.id, confirmed: true }, signal); if (alive.current)
                onAdopt(value.project); }, true); }
            function remove() { if (!window.confirm(L('删除这次检查记录和预览图片？生成的 PPT 副本会保留。', 'Delete this review and its preview images? Presentation copies are kept.')))
                return; return task(async (signal) => { await request('delete', { runId: run.id }, signal); accept(null); setPictures({}); setCompare(''); await refresh(signal); }); }
            function download() { const url = new URL('api/dsh-ppt/download', document.baseURI); for (const [k, v] of Object.entries({ id: project.id, kind: 'visual', revision: project.revision, run: run.id }))
                url.searchParams.set(k, String(v)); const a = document.createElement('a'); a.href = url.href; a.download = ''; document.body.append(a); a.click(); a.remove(); }
            useEffect(() => {
                if (!compare || !run)
                    return;
                const abort = new AbortController(), last = run.rounds.length - 1;
                setPictures({});
                setLoading(true);
                const initial = run.rounds[0].ids.includes(compare);
                Promise.allSettled([initial ? request('page', { runId: run.id, round: 0, slideId: compare }, abort.signal) : Promise.resolve(null), request('page', { runId: run.id, round: last, slideId: compare }, abort.signal)]).then(values => {
                    if (abort.signal.aborted || !alive.current)
                        return;
                    setPictures({ before: values[0].status === 'fulfilled' ? values[0].value?.data : null, after: values[1].status === 'fulfilled' ? values[1].value?.data : null });
                    const failed = values.find(v => v.status === 'rejected');
                    if (failed)
                        setError(failed.reason.message);
                    setLoading(false);
                });
                return () => abort.abort();
            }, [run?.id, run?.rounds.length, compare]);
            useEffect(() => { const last = run?.rounds.at(-1); if (!busy && !compare && last?.rendered)
                setCompare(last.ids[0]); }, [run?.id, run?.rounds.length, run?.rounds.at(-1)?.rendered, busy, compare]);
            const first = run?.rounds[0], last = run?.rounds.at(-1), stale = run && (run.stale || run.revision !== project.revision), count = scope === 'all' ? project.slides.length : 1;
            const callCap = Array.from({ length: repairs + 1 }, (_, i) => Math.ceil(count * 2 ** i / 2)).reduce((a, b) => a + b, 0);
            function image(src, round, label) { return h('figure', { style: { margin: 0, minWidth: 0 } }, h('figcaption', null, label), src ? h('div', { style: { position: 'relative', lineHeight: 0 } }, h('img', { src, alt: label, style: { width: '100%', height: 'auto', display: 'block' } }), (round?.findings || []).filter(f => f.slideId === compare).map((f, i) => h('span', { key: i, title: f.issue, style: { position: 'absolute', pointerEvents: 'none', border: '2px solid #f97316', boxSizing: 'border-box', left: f.box[0] * 100 + '%', top: f.box[1] * 100 + '%', width: f.box[2] * 100 + '%', height: f.box[3] * 100 + '%' } }))) : h('p', { className: 'muted' }, round === first && !first.ids.includes(compare) ? L('此页由拆分生成，没有对应的原页画面。', 'This page was created by a split and has no original counterpart.') : L('画面尚未载入，请重新选择页面。', 'Image not loaded; select the slide again.'))); }
            return h('section', { className: 'card coaching', 'aria-label': L('视觉检查与修复', 'Visual review and repair') }, h('h3', null, L('让 AI 看完成品，再修排版', 'Let AI inspect the finished slides and repair formatting')), h('p', { className: 'muted' }, L('可选功能。检查实际 PPTX 画面，另存修复副本，再渲染复查。原稿保留。', 'Optional. Inspect actual PPTX images, save a repaired copy, and render it again for rechecking. The original is kept.')), !expanded ? h('button', { disabled: busy || blocked, onClick: configure }, L('视觉检查与修复', 'Visual review and repair')) : h(React.Fragment, null, error && h('div', { role: 'alert', className: 'notice error' }, error), !run && h(React.Fragment, null, h('div', { className: 'coaching-grid' }, h('label', null, L('视觉模型', 'Vision model'), h(ModelCascade, { label: L('视觉模型', 'Vision model'), placeholder: L('请选择', 'Choose a model'), emptyHint: L('未找到声明支持图片输入的模型。请在 DSH 模型设置中检查图片输入配置；普通生成和下载仍可使用。', 'No model declares image input. Check the image-input configuration in DSH model settings; normal creation and downloads remain available.'), accept: acceptsVision, value: route, selectedLabel: findModelRoute(routes, route)?.label || '', disabled: busy, onRoutes: adoptRoutes, onPick: model => setRoute(modelRouteKey(model)) })), h('label', null, L('检查范围', 'Review scope'), h('select', { 'aria-label': L('视觉检查范围', 'Visual review scope'), value: scope, disabled: busy, onChange: e => setScope(e.target.value) }, h('option', { value: 'all', disabled: project.slides.length > 12 }, L('全部页面（最多 12 页）', 'All slides (up to 12)')), h('option', { value: 'current' }, L('当前页', 'Current slide')))), h('label', null, L('自动修复上限', 'Repair limit'), h('select', { 'aria-label': L('自动修复上限', 'Repair limit'), value: repairs, disabled: busy, onChange: e => setRepairs(Number(e.target.value)) }, h('option', { value: 0 }, L('仅看图检查', 'Inspect only')), h('option', { value: 1 }, L('最多修复 1 轮（推荐）', 'Up to 1 repair round (recommended)')), h('option', { value: 2 }, L('最多修复 2 轮', 'Up to 2 repair rounds'))))), !routes.length && h('p', { className: 'notice' }, L('未找到声明支持图片输入的模型。请在 DSH 模型设置中检查图片输入配置；普通生成和下载仍可使用。', 'No model declares image input. Check the image-input configuration in DSH model settings; normal creation and downloads remain available.')), h('p', null, L('会向所选模型发送 ' + count + ' 页的渲染图片和页面文字；拆页后会重新检查新增页面，最多 ' + callCap + ' 次模型调用。', 'Sends rendered images and text from ' + count + ' slides to the selected model. New split pages are rechecked, with up to ' + callCap + ' model calls.')), h('p', { className: 'muted' }, L('只调整字号、拆页、图表方向和图片裁切，不改写原文、数字或公式。可随时停止；服务商仍可能收取已发起调用的费用。', 'Changes font sizes, pagination, chart orientation and image cropping. Original text, numbers and formulas are preserved. You can stop at any time; calls already sent may still be billed.')), h('div', { className: 'tools' }, h('button', { className: 'primary', disabled: busy || blocked || !findModelRoute(routes, route) || count > 12, onClick: start }, L('开始看图检查', 'Start visual review')), h('button', { disabled: busy, onClick: configure }, L('刷新视觉模型', 'Refresh vision models')))), run && h(React.Fragment, null, h('p', { role: 'status' }, (run.status === 'paused' ? L('检查已停止', 'Review stopped') : run.status === 'ready' && !busy ? L('等待检查', 'Review ready') : phaseName(run.phase)) + ' · ' + L('已调用 ', 'Calls ') + run.usedCalls + '/' + run.maxCalls + ' · ' + L('本轮已检查 ', 'Slides checked this pass ') + (last?.cursor || 0) + '/' + (last?.ids.length || 0)), busy && h('button', { onClick: stop }, L('停止视觉检查', 'Stop visual review')), run.error && h('p', { role: 'alert', className: 'notice error' }, failureText(run.error)), stale && h('p', { className: 'notice' }, L('工程或成品已变化，旧记录可查看，但不能继续或采纳。', 'The project or output changed. This old record is readable, but cannot be continued or adopted.')), run.status === 'complete' && h('p', { className: 'notice' }, last.findings.length ? L('复查仍有 ' + last.findings.length + ' 个问题，请查看标记和说明。', 'Recheck still found ' + last.findings.length + ' issues. Review the highlighted regions and notes.') : L('AI 在本次范围内未发现明显视觉问题；这是一份模型检查记录。', 'AI found no obvious visual issues in this scope. This is a model review record.')), (last?.missingFonts || []).length > 0 && h('p', { className: 'notice error' }, L('渲染引擎报告缺失字体：', 'Renderer reported missing fonts: ') + last.missingFonts.join(', ')), run.rounds.map((r, i) => h('details', { key: i, open: i === run.rounds.length - 1 }, h('summary', null, L('检查轮次 ', 'Inspection pass ') + i + ' · ' + r.cursor + '/' + r.ids.length), r.findings.map((f, j) => h('p', { key: j }, h('strong', null, (project.slides.findIndex(s => s.id === f.slideId) >= 0 ? L('原第 ', 'Original slide ') + (project.slides.findIndex(s => s.id === f.slideId) + 1) + L(' 页', '') : L('拆分页', 'Split page')) + ' · '), f.issue, h('br'), h('small', { className: 'muted' }, f.action ? actionName(f.action) : L('需要人工判断', 'Needs manual review')))), r.applied.length > 0 && h('ul', null, r.applied.map((a, j) => h('li', { key: j }, L('已应用：', 'Applied: ') + actionName(a)))))), !busy && last?.rendered && h(React.Fragment, null, h('label', null, L('查看前后画面（橙框为 AI 定位区域）', 'Compare images (orange boxes mark AI findings)'), h('select', { 'aria-label': L('对比页面', 'Comparison slide'), value: compare, onChange: e => setCompare(e.target.value) }, last.ids.map((id, i) => h('option', { value: id, key: id }, String(i + 1) + '. ' + (project.slides.find(s => s.id === id)?.title || L('拆分页', 'Split page')))))), loading ? h('p', { role: 'status' }, L('正在载入画面…', 'Loading images…')) : h('div', { className: 'before-after' }, image(pictures.before, first, L('原稿 · 实际 PPTX', 'Original · actual PPTX')), image(pictures.after, last, run.rounds.length > 1 ? L('修复后 · 实际 PPTX', 'Repaired · actual PPTX') : L('本次检查画面', 'Reviewed image')))), h('div', { className: 'tools' }, h('button', { className: 'primary', disabled: busy || blocked || !run.canAdopt || stale, onClick: adopt }, last?.findings.length ? L('打开修复副本（仍有待处理问题）', 'Open repaired copy (issues remain)') : L('采用修复副本', 'Use repaired copy')), h('button', { disabled: busy, onClick: download }, L('下载视觉检查记录', 'Download visual review')), h('button', { disabled: busy || run.status === 'busy', onClick: remove }, L('删除检查记录', 'Delete review')), h('button', { disabled: busy, onClick: () => { accept(null); setCompare(''); setPictures({}); configure(); } }, L('新建视觉检查', 'New visual review')))), !busy && history.length > 0 && h('details', null, h('summary', null, L('本机视觉检查历史', 'Local visual review history')), h('div', { className: 'project-list' }, history.map(item => h('button', { key: item.id, onClick: () => open(item.id) }, L('修订 ', 'Revision ') + item.revision + ' · ' + new Date(item.createdAt).toLocaleString(languageOf() === 'ru' ? 'ru-RU' : languageOf() === 'en' ? 'en-US' : 'zh-CN'))))), h('button', { disabled: busy, onClick: () => setExpanded(false) }, L('收起视觉检查', 'Collapse visual review'))));
        }
        function DataPanel({ project, blocked, incoming, onParameters, onDirty, onBusy, onAdopt, onChoose, onDownload }) {
const fieldId=React.useId();
            const L = (zh, en) => pptText(zh, en), model = project.dataModel;
            const baseline = Object.fromEntries(model.metrics.filter(m => m.kind === 'input').map(m => [m.id, String(m.value)]));
            const [parameters, setParameters] = useState(baseline), [updates, setUpdates] = useState({}), [sourceId, setSourceId] = useState(model.sources[0]?.id || '');
            const [metricId, setMetricId] = useState(model.metrics[0]?.id || ''), [preview, setPreview] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [valid, setValid] = useState(true), [saveAs, setSaveAs] = useState(true), [readingFile, setReadingFile] = useState(false);
// Update protection: dsh-ppt.data
__stardustUpdatesGuard(React, "dsh-ppt.data", { busy: busy || readingFile });

            const pending = useRef(null), alive = useRef(true), reading = useRef(0), latest = useRef(''), guard = useRef(false);
            const numeric = Object.fromEntries(Object.entries(parameters).map(([id, value]) => [id, value.trim() === '' ? null : Number(value)]));
            const inputsValid = model.metrics.filter(m => m.kind === 'input').every(m => typeof numeric[m.id] === 'number' && Number.isFinite(numeric[m.id]) && numeric[m.id] >= m.min && numeric[m.id] <= m.max && Math.abs((numeric[m.id] - m.min) / m.step - Math.round((numeric[m.id] - m.min) / m.step)) <= 1e-6);
            const body = { parameters: numeric, sourceUpdates: Object.values(updates) }, signature = JSON.stringify(body);
            latest.current = signature;
            const changed = readingFile || !valid || Object.entries(baseline).some(([id, value]) => Number(parameters[id]) !== Number(value) || parameters[id].trim() === '') || Object.keys(updates).length > 0;
            useEffect(() => { onDirty(changed); return () => onDirty(false); }, [changed]);
            useEffect(() => { setPreview(null); }, [signature]);
            useEffect(() => { if (incoming) {
                setParameters(Object.fromEntries(Object.entries(incoming.parameters).map(([id, value]) => [id, Number.isFinite(value) ? String(value) : ''])));
                setValid(incoming.valid !== false);
            } }, [incoming]);
            useEffect(() => { alive.current = true; return () => { alive.current = false; reading.current++; pending.current?.abort(); onBusy(false); }; }, []);
            function changeParameter(id, value) { const next = { ...parameters, [id]: value }; setParameters(next); setValid(true); setPreview(null); setError(''); onParameters(Object.fromEntries(Object.entries(next).map(([key, raw]) => [key, raw.trim() === '' ? NaN : Number(raw)]))); }
            function reset() { reading.current++; setParameters(baseline); setUpdates({}); setPreview(null); setError(''); setValid(true); onParameters(Object.fromEntries(Object.entries(baseline).map(([id, value]) => [id, Number(value)]))); }
            async function task(work) {
                if (guard.current || blocked || readingFile)
                    return;
                guard.current = true;
                setBusy(true);
                onBusy(true);
                setError('');
                const controller = new AbortController();
                pending.current = controller;
                try {
                    await work(controller.signal);
                }
                catch (reason) {
                    if (alive.current && !controller.signal.aborted)
                        setError(reason.message || L('操作失败', 'Operation failed'));
                }
                finally {
                    pending.current = null;
                    guard.current = false;
                    if (alive.current) {
                        setBusy(false);
                        onBusy(false);
                    }
                }
            }
            function inspect() { const sent = signature; return task(async (signal) => { const value = await action({ operation: 'data-preview', id: project.id, expectedRevision: project.revision, ...body }, signal); if (alive.current && latest.current === sent)
                setPreview({ ...value, signature: sent }); }); }
            function apply() { if (!preview || preview.signature !== signature)
                return; const sent = signature; return task(async (signal) => { const value = await action({ operation: 'data-apply', id: project.id, expectedRevision: project.revision, ...body, confirmed: true, previewToken: preview.token, saveAs }, signal); if (alive.current && latest.current === sent) {
                onDirty(false);
                onAdopt(value.project);
            } }); }
            async function importSource(event) {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file)
                    return;
                const stamp = ++reading.current, target = sourceId;
                if (file.size > 1024 * 1024 || !['csv', 'tsv', 'txt', 'md'].includes(file.name.split('.').at(-1)?.toLowerCase())) {
                    setError(L('请选择 1 MiB 内的 CSV、TSV、TXT 或 Markdown。', 'Choose CSV, TSV, TXT or Markdown up to 1 MiB.'));
                    return;
                }
                setReadingFile(true);
                try {
                    const content = await file.text();
                    if (!alive.current || stamp !== reading.current)
                        return;
                    const ext = file.name.split('.').at(-1).toLowerCase();
                    setUpdates(old => ({ ...old, [target]: { id: target, format: ext === 'csv' || ext === 'tsv' ? ext : 'text', content } }));
                    setPreview(null);
                    setError('');
                }
                catch {
                    if (alive.current)
                        setError(L('无法读取材料，请重试。', 'Could not read source. Try again.'));
                }
                finally {
                    if (alive.current)
                        setReadingFile(false);
                }
            }
            async function importScenario(event) {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file)
                    return;
                const stamp = ++reading.current;
                setReadingFile(true);
                try {
                    if (file.size > 32000)
                        throw new Error(L('推演参数文件过大。', 'Scenario parameter file is too large.'));
                    const packet = JSON.parse(await file.text());
                    if (!alive.current || stamp !== reading.current)
                        return;
                    if (packet.schemaVersion !== 1 || packet.deckId !== project.deckId || packet.revision !== project.revision || packet.fingerprint !== model.fingerprint || !packet.parameters || typeof packet.parameters !== 'object' || Array.isArray(packet.parameters) || Object.keys(packet.parameters).some(id => !Object.hasOwn(baseline, id)) || Object.values(packet.parameters).some(value => typeof value !== 'number' || !Number.isFinite(value)))
                        throw new Error(L('参数来自其他工程、旧版本或格式无效，请重新导出。', 'Scenario is stale, belongs to another project, or is invalid. Export it again.'));
                    const next = { ...baseline, ...Object.fromEntries(Object.entries(packet.parameters).map(([id, value]) => [id, String(value)])) };
                    setParameters(next);
                    setValid(true);
                    setPreview(null);
                    onParameters(Object.fromEntries(Object.entries(next).map(([id, value]) => [id, Number(value)])));
                    setError('');
                }
                catch (reason) {
                    if (alive.current)
                        setError(reason.message);
                }
                finally {
                    if (alive.current)
                        setReadingFile(false);
                }
            }
            const metric = model.metrics.find(m => m.id === metricId), source = model.sources.find(s => s.id === sourceId), replacement = updates[sourceId];
            const format = (value, m) => new Intl.NumberFormat(languageOf() === 'ru' ? 'ru-RU' : languageOf() === 'en' ? 'en-US' : 'zh-CN', { style: m.format.style === 'percent' ? 'percent' : 'decimal', minimumFractionDigits: m.format.digits, maximumFractionDigits: m.format.digits }).format(value) + (m.format.unit || '');
            const display = value => typeof value === 'string' ? value : JSON.stringify(value, null, 2), disabled = busy || blocked || readingFile;
            return h('section', { className: 'card data-workbench', 'aria-label': L('数据溯源与现场推演', 'Data lineage and what-if') }, h('style', null, dataCss), h('h3', null, L('数据溯源与现场推演', 'Data lineage and what-if')), h('p', { className: 'muted' }, L('点预览中的数字可追问来源。只有明确声明的假设可调；来源不等于事实已核验。', 'Click numbers in the preview to inspect their lineage. Only declared assumptions are adjustable. Lineage is not factual verification.')), h('details', null, h('summary', null, L('数字来自哪里', 'Where the numbers come from')), h('label', null, L('指标', 'Metric'), h('select', { value: metricId, disabled, onChange: event => setMetricId(event.target.value) }, model.metrics.map(m => h('option', { key: m.id, value: m.id }, m.label + ' [' + m.id + ']')))), metric && h('div', { className: 'data-evidence' }, h('strong', null, metric.label + ' = ' + format(model.values[metric.id], metric)), metric.kind === 'source' ? h(React.Fragment, null, h('p', null, metric.evidence.name + ' · ' + metric.evidence.locator), h('pre', null, metric.evidence.excerpt), h('details', null, h('summary', null, L('来源快照校验值', 'Source snapshot checksum')), h('code', null, metric.evidence.sha256))) : metric.kind === 'input' ? h('p', null, L('用户假设', 'User assumption') + (metric.note ? ' · ' + metric.note : '')) : h(React.Fragment, null, h('pre', null, '= ' + metric.formula), h('div', { className: 'tools' }, metric.dependencies.map(id => h('button', { key: id, disabled, onClick: () => setMetricId(id) }, model.metrics.find(m => m.id === id).label))))), h('button', { disabled: disabled || changed, onClick: () => onDownload('data') }, L('下载溯源与假设报告', 'Download lineage and assumptions'))), model.metrics.some(m => m.kind === 'input') && h('details', { open: true }, h('summary', null, L('现场推演参数', 'What-if assumptions')), model.metrics.filter(m => m.kind === 'input').map(m => h('div', { key: m.id, className: 'data-input-row' }, h('label', { htmlFor: fieldId + '-ppt-data-' + m.id }, m.label, h('small', { className: 'muted' }, ' · ' + L('假设', 'Assumption') + (m.note ? ' · ' + m.note : ''))), h('div', { className: 'data-input-controls' }, h('input', { type: 'range', min: m.min, max: m.max, step: m.step, value: Number(parameters[m.id]), disabled, 'aria-label': m.label + ' ' + L('滑杆', 'slider'), onChange: event => changeParameter(m.id, event.target.value) }), h('input', { id: fieldId + '-ppt-data-' + m.id, type: 'number', min: m.min, max: m.max, step: m.step, value: parameters[m.id], disabled, onChange: event => changeParameter(m.id, event.target.value) })))), h('label', null, L('导入离线 HTML 保存的推演参数', 'Import scenario parameters saved in offline HTML'), h('input', { type: 'file', accept: '.json,application/json', disabled, onChange: importScenario }))), model.sources.length > 0 && h('details', null, h('summary', null, L('更新来源材料', 'Update source material')), h('p', { className: 'muted' }, L('先导入或粘贴新材料，预览影响后再确认；不会自动监视或修改原文件。表格可从 Excel 导出 CSV。', 'Import or paste new material, then preview the impact before confirming. Original source files are not watched or modified. Export Excel tables as CSV.')), h('label', null, L('替换来源', 'Replace source'), h('select', { value: sourceId, disabled, onChange: event => setSourceId(event.target.value) }, model.sources.map(s => h('option', { key: s.id, value: s.id }, s.name)))), h('label', null, L('导入替换材料', 'Import replacement material'), h('input', { type: 'file', accept: source?.kind === 'table' ? '.csv,.tsv' : '.txt,.md', disabled, onChange: importSource })), source?.kind === 'table' && h('label', null, L('分隔格式', 'Delimiter format'), h('select', { value: replacement?.format || 'csv', disabled, onChange: event => { setUpdates(old => ({ ...old, [sourceId]: { id: sourceId, format: event.target.value, content: replacement?.content || '' } })); setPreview(null); } }, h('option', { value: 'csv' }, 'CSV'), h('option', { value: 'tsv' }, 'TSV'))), h('label', null, L('或粘贴内容', 'Or paste content'), h('textarea', { rows: 4, maxLength: 1048576, value: replacement?.content ?? '', disabled, onChange: event => { setUpdates(old => ({ ...old, [sourceId]: { id: sourceId, format: source.kind === 'table' ? replacement?.format || 'csv' : 'text', content: event.target.value } })); setPreview(null); setError(''); } })), replacement && h('button', { disabled, onClick: () => { setUpdates(old => { const next = { ...old }; delete next[sourceId]; return next; }); setPreview(null); } }, L('取消此来源更新', 'Cancel this source update'))), changed && h('p', { className: 'dirty', role: 'status' }, L('推演或材料尚未保存，当前 PPTX 仍是已保存版本。先预览差异并确认，或恢复参数后下载。', 'Unsaved scenario or source changes. The PPTX still contains saved values. Preview and confirm, or reset before downloading.')), (!valid || !inputsValid) && h('p', { className: 'notice error', role: 'alert' }, L('参数无法计算，请检查范围、步长或除零，再恢复或修改。', 'Cannot calculate these parameters. Check ranges, steps or division by zero; adjust or reset.')), error && h('p', { className: 'notice error', role: 'alert' }, error), h('div', { className: 'tools' }, h('button', { disabled: disabled || !changed || !valid || !inputsValid, onClick: inspect }, L('预览差异', 'Preview changes')), h('button', { disabled: disabled || !changed, onClick: reset }, L('恢复已保存数据', 'Reset to saved data'))), preview && preview.signature === signature && h('div', { className: 'data-diff' }, h('h4', null, L('确认前核对', 'Review before confirming')), !preview.changed ? h('p', null, L('内容没有变化。', 'No content changes.')) : h(React.Fragment, null, h('ul', null, preview.changes.map(change => h('li', { key: change.id }, h('strong', null, change.label + ': '), change.beforeText + ' → ' + change.afterText, change.before === change.after && ' · ' + L('来源已更新', 'Source updated')))), h('h4', null, L('受影响页面', 'Affected slides')), !preview.affectedSlides.length && h('p', { className: 'muted' }, L('指标尚未绑定到页面，只更新数据模型。', 'Metrics are not bound to slides; only the data model changes.')), preview.affectedSlides.map(slide => h('details', { key: slide.id }, h('summary', null, (slide.page) + '. ' + slide.title), h('button', { disabled, onClick: () => onChoose(slide.id) }, L('查看页面', 'View slide')), slide.evidenceChanged && h('p', null, L('关联的来源快照有变化。', 'A linked source snapshot changed.')), slide.fields.map(field => h('div', { key: field.field }, h('strong', null, t(fields.find(([key]) => key === field.field)?.[1] || field.field)), h('div', { className: 'data-before-after' }, h('pre', null, L('之前：', 'Before: ') + display(field.before)), h('pre', null, L('之后：', 'After: ') + display(field.after))))))), h('label', { className: 'data-copy' }, h('input', { type: 'checkbox', checked: saveAs, disabled, onChange: event => setSaveAs(event.target.checked) }), L('保存为新副本，保留原稿（推荐）', 'Save a new copy and keep the original (recommended)')), h('p', { className: 'muted' }, L('PPTX 保存确认后的静态结果，并附公式、来源和假设；HTML 保留交互。JSON 工程包含导入的完整材料，分享前请检查。', 'PPTX saves confirmed static results with formulas, sources and assumptions; HTML retains interaction. The JSON project contains full imported material; review it before sharing.')), h('button', { className: 'primary', disabled: disabled || !valid || !inputsValid, onClick: apply }, saveAs ? L('确认并保存推演副本', 'Confirm and save scenario copy') : L('确认并更新当前工程', 'Confirm and update this project')))));
        }
        function Workbench({locale,workbench=false}={}) {
const [activeTab,setActiveTab]=useState('content'),[listTab,setListTab]=useState('projects'),[downloadOpen,setDownloadOpen]=useState(false),[pendingNav,setPendingNav]=useState(null),[deleteOpen,setDeleteOpen]=useState(false),[restyleOpen,setRestyleOpen]=useState(false),[restyleList,setRestyleList]=useState(null),[restyleKey,setRestyleKey]=useState(''),[restyleCopy,setRestyleCopy]=useState(false);
const controlId=React.useId(),rootElement=useRef(null),fullscreenBoundary=useRef({was:false,exitedAt:0});
useEffect(()=>{const changed=()=>{const active=!!document.fullscreenElement;if(fullscreenBoundary.current.was && !active)fullscreenBoundary.current.exitedAt=Date.now();fullscreenBoundary.current.was=active;};document.addEventListener('fullscreenchange',changed);return()=>document.removeEventListener('fullscreenchange',changed);},[]);
function clearEdits(){imageLoader.current.cancel();setDraft(draftFor(slide));setImage(null);setDirty(false);setError('');setMessage('');setConflict(false);setOverlaps([]);}
function finishNavigation(target,saved){setPendingNav(null);if(target.kind==='back'){imageLoader.current.cancel();setImage(null);setDirty(false);setProject(null);refreshList();return;}if(target.kind==='slide'){if(saved)adopt(saved,target.id);else choose(project.slides.find(row=>row.id===target.id),true);return;}if(saved)adopt(saved,selected);else clearEdits();}
function requestNavigation(target){if(busy)return;if(dataDirty){setActiveTab('data');setMessage(pptText('请先确认或恢复数据推演。','Confirm or reset the scenario first.'));return;}if(dirty){setPendingNav(target);return;}finishNavigation(target);}
            useLanguage(locale);
            const [projectsAdmin, setProjectsAdmin] = useState(false);
            const [projects, setProjects] = useState([]), [project, setProject] = useState(null), [selected, setSelected] = useState('');
            const [draft, setDraft] = useState({}), [image, setImage] = useState(null), [dirty, setDirty] = useState(false);
            const [dataDirty, setDataDirty] = useState(false), [incomingData, setIncomingData] = useState(null);
            const [busy, setBusy] = useState(false), [job, setJob] = useState(''), [message, setMessage] = useState(''), [error, setError] = useState('');
            const [mode, setMode] = useState('html'), [raster, setRaster] = useState('');
            const [conflict, setConflict] = useState(false), [overlaps, setOverlaps] = useState([]);
            const frame = useRef(null), previewBox = useRef(null), fieldRefs = useRef({}), alive = useRef(true), operations = useRef(new Set());
            const imageLoader = useRef(null);
            if (!imageLoader.current)
                imageLoader.current = createImageLoader();
            const imagePending = imageLoader.current.pending;
// Update protection: dsh-ppt
__stardustUpdatesGuard(React, "dsh-ppt", { dirty: dirty || dataDirty, busy: busy || imagePending });

            const nonce = useRef(crypto.randomUUID());
            const dataCommand = useRef(0);
            const previewDocument = useMemo(() => project?.html ? editorHtml(project.html, nonce.current) : '', [project?.html]);
            const index = project ? Math.max(0, project.slides.findIndex(s => s.id === selected)) : 0;
            const slide = project?.slides[index];
            function adopt(next, preferred) {
                imageLoader.current.cancel();
                nonce.current = crypto.randomUUID();
                setDataDirty(false);
                setIncomingData(null);
                setProject(next);
                const row = next.slides.find(s => s.id === preferred) || next.slides[0];
                setSelected(row.id);
                setDraft(draftFor(row));
                setImage(null);
                setDirty(false);
                setRaster('');
                setOverlaps([]);
                if (!next.render)
                    setMode('html');
            }
            async function perform(work, success, label = t("正在处理，请稍候…")) {
                setBusy(true);
                setJob(label);
                setError('');
                setMessage('');
                setConflict(false);
                const controller = new AbortController();
                operations.current.add(controller);
                try {
                    const result = await work(controller.signal);
                    if (alive.current && success)
                        success(result);
return result;
                }
                catch (e) {
                    if (alive.current) {
                        setError(e.message || t("操作失败"));
                        setConflict(e.status === 409);
                    }
                }
                finally {
                    operations.current.delete(controller);
                    if (alive.current)
                        setBusy(false);
                }
            }
            function refreshList() { return perform(signal => action({ operation: 'list' }, signal), value => { setProjects(value.projects); setProjectsAdmin(value.admin === true); }); }
            useEffect(() => {
                alive.current = true;
                const abort = new AbortController();
                action({ operation: 'list' }, abort.signal).then(value => { if (alive.current) {
                    setProjects(value.projects); setProjectsAdmin(value.admin === true); } }).catch(e => { if (!abort.signal.aborted)
                    setError(e.message); });
                return () => { alive.current = false; abort.abort(); imageLoader.current.cancel(); for (const operation of operations.current)
                    operation.abort(); };
            }, []);
            useEffect(() => {
                function receive(event) {
                    if (event.source !== frame.current?.contentWindow || event.data?.nonce !== nonce.current || mode !== 'html')
                        return;
                    if (event.data.type === 'dsh-ppt-data') {
                        if (typeof event.data.command === 'number' && event.data.command !== dataCommand.current)
                            return;
                        setIncomingData({ parameters: event.data.parameters, valid: event.data.valid });
                        return;
                    }
                    if (event.data.type === 'dsh-ppt-shortcut') {
                        handleShortcut(event.data.key);
                        return;
                    }
                    if (event.data.type !== 'dsh-ppt-select')
                        return;
                    const key = event.data.field;
                    const field = fields.find(([field]) => field === key);
                    if (field) {
                        if(dataDirty){setActiveTab('data');return;}setActiveTab('content');requestAnimationFrame(()=>fieldRefs.current[key]?.focus());
                        fieldRefs.current[key]?.scrollIntoView({ block: 'nearest' });
                        setMessage(t("已定位到") + t(field[1]) + t("，在字段中修改后保存。"));
                    }
                }
                window.addEventListener('message', receive);
                return () => window.removeEventListener('message', receive);
            }, [mode, project, dirty, busy, imagePending, index, selected, draft, image, dataDirty]);
            useEffect(() => {
                if (mode !== 'html' || !project || !previewBox.current)
                    return;
                // Align iframe edges/dimensions when the host uses fractional text metrics.
                const box = previewBox.current;
                function align() {
                    const target = frame.current;
                    if (!target)
                        return;
                    const r = box.getBoundingClientRect(), x = r.x + box.clientLeft, y = r.y + box.clientTop;
                    target.style.width = box.clientWidth + 'px';
                    target.style.height = box.clientHeight + 'px';
                    target.style.transform = 'translate(' + (Math.ceil(x) - x) + 'px,' + (Math.ceil(y) - y) + 'px)';
                }
                align();
                const observer = new ResizeObserver(align);
                observer.observe(box);
                window.addEventListener('scroll', align, true);
                return () => { observer.disconnect(); window.removeEventListener('scroll', align, true); };
            }, [mode, !!project]);
            function jump() { frame.current?.contentWindow?.postMessage({ type: 'dsh-ppt-jump', nonce: nonce.current, page: index }, '*'); }
            useEffect(() => { jump(); }, [index, project?.revision, mode]);
            useEffect(() => {
                if (mode !== 'pptx' || !project?.render)
                    return;
                const abort = new AbortController();
                setRaster('');
                action({ operation: 'page', id: project.id, page: index + 1 }, abort.signal).then(value => setRaster(value.data)).catch(e => { if (!abort.signal.aborted)
                    setError(e.message); });
                return () => abort.abort();
            }, [mode, index, project?.revision]);
            function handleShortcut(key) {
 if(key==='escape' && (document.fullscreenElement || Date.now()-fullscreenBoundary.current.exitedAt<300)){if(document.fullscreenElement)void document.exitFullscreen();return;}
 if(dataDirty){if(key==='escape')setActiveTab('data');return;}
 if(key==='save'){if(project && dirty && !busy && !imagePending)save();return;}
 if(key==='escape'){if(!project || busy)return;requestNavigation({kind:dirty || imagePending?'cancel':'back'});return;}
 if(key==='prev' || key==='next'){if(!project || busy || imagePending)return;const next=index+(key==='next'?1:-1);if(next>=0 && next<project.slides.length)choose(project.slides[next]);}
}
            useEffect(() => {
                function onKey(event) {
if(!rootElement.current?.contains(event.target) || event.target?.closest?.('[role=dialog]'))return;
                    if (event.isComposing || event.defaultPrevented)
                        return;
                    if (event.key === 'Escape' && event.target && event.target.tagName === 'SELECT')
                        return;
                    const mod = event.ctrlKey || event.metaKey;
                    if (mod && (event.key === 's' || event.key === 'S')) {
                        if (!project)
                            return;
                        event.preventDefault();
                        handleShortcut('save');
                        return;
                    }
                    if (event.key === 'Escape') {
                        if (!project || busy || imagePending)
                            return;
                        event.preventDefault();
                        handleShortcut('escape');
                        return;
                    }
                    if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
                        if (!project || busy || imagePending)
                            return;
                        event.preventDefault();
                        handleShortcut(event.key === 'ArrowRight' ? 'next' : 'prev');
                    }
                }
                document.addEventListener('keydown', onKey);
                return () => document.removeEventListener('keydown', onKey);
            }, [project, dirty, busy, imagePending, index, selected, draft, image, dataDirty]);
            useEffect(() => {
                if (!dirty && !dataDirty)
                    return;
                function warn(event) { event.preventDefault(); event.returnValue = t("有未保存修改，离开页面会丢失。"); }
                window.addEventListener('beforeunload', warn);
                return () => window.removeEventListener('beforeunload', warn);
            }, [dirty, dataDirty]);
            function open(id) { return perform(signal => action({ operation: 'open', id }, signal), value => { adopt(value.project); setMessage(t("点击预览里的文字，或在下方修改字段。")); }); }
            function keepInputsAndReload() {
                const original = draftFor(slide), keys = fields.filter(([key]) => draft[key] !== original[key]).map(([key]) => key), pending = { ...draft }, pendingImage = image;
                return perform(signal => action({ operation: 'open', id: project.id }, signal), value => {
                    const row = value.project.slides.find(s => s.id === selected);
                    if (!row) {
                        setError(t("当前页已被删除，输入仍保留，请复制需要的内容后取消修改。"));
                        return;
                    }
                    const latest = draftFor(row), merged = { ...latest }, shared = [];
                    for (const key of keys) {
                        merged[key] = pending[key];
                        if (latest[key] !== original[key] && latest[key] !== pending[key])
                            shared.push({ key, latest: latest[key], yours: pending[key] });
                    }
                    adopt(value.project, selected);
                    setDraft(merged);
                    setImage(pendingImage);
                    setDirty(keys.length > 0 || !!pendingImage);
                    setOverlaps(shared);
                    setMessage(t("已载入最新版本并保留你的修改，请核对后再保存。"));
                });
            }
            function choose(row,discard=false) { if(!row || busy)return; if(dirty && !discard){setPendingNav({kind:'slide',id:row.id});return;} imageLoader.current.cancel(); setSelected(row.id); setDraft(draftFor(row)); setImage(null); setMessage(''); }
            function save(saveAs = false) {
                if (dataDirty)
                    return;
                const original = draftFor(slide), patch = {};
                for (const [key] of fields)
                    if (draft[key] !== original[key])
                        patch[key] = key === 'bullets' ? draft[key].split('\n').map(v => v.trim()).filter(Boolean) : draft[key];
                if (image)
                    patch.image = { src: image.src, alt: image.alt, fit: image.fit, caption: image.caption };
                return perform(signal => action({ operation: 'edit', id: project.id, expectedRevision: project.revision, slide: slide.id, patch, saveAs }, signal), value => {
                    adopt(value.project, slide.id);
                    setMessage(saveAs ? t("副本已保存，原文件保留。副本从工程生成，不包含 Office 手工修改。") : value.changed === false ? t("内容没有变化。") : t("已保存，HTML、PPTX 和工程文件已同步更新。"));
                });
            }
            function move(delta) {
                if (dataDirty)
                    return;
                const order = project.slides.map(s => s.id);
                [order[index], order[index + delta]] = [order[index + delta], order[index]];
                return perform(signal => action({ operation: 'edit', id: project.id, expectedRevision: project.revision, order }, signal), value => { adopt(value.project, slide.id); setMessage(t("页面顺序已更新，可撤销。")); });
            }
            function structure(operation) {
                if (dataDirty)
                    return;
                return perform(signal => action({ operation, id: project.id, expectedRevision: project.revision, slide: slide.id }, signal), value => {
                    adopt(value.project, value.selected);
                    setMessage(operation === 'duplicate' ? t("页面已复制，图片、图表和备注一并保留，可撤销。") : t("页面已删除，可撤销。"));
                });
            }
            function undo() { if (dataDirty)
                return; return perform(signal => action({ operation: 'undo', id: project.id, expectedRevision: project.revision }, signal), value => { adopt(value.project, selected); setMessage(t("已撤销上次修改。")); }); }
            function render() {
                if (dataDirty)
                    return;
                return perform(signal => action({ operation: 'render', id: project.id, expectedRevision: project.revision }, signal), value => { adopt(value.project, selected); setMode('pptx'); setMessage(t("当前 PPTX 已生成逐页图片，请查看画面。")); }, t("正在渲染最终 PPTX，较大文件可能需要几分钟…"));
            }
            function download(kind) {
                if (dataDirty)
                    return;
                const url = new URL('api/dsh-ppt/download', document.baseURI);
                url.searchParams.set('id', project.id);
                url.searchParams.set('kind', kind);
                url.searchParams.set('revision', String(project.revision));
                // An authenticated attachment response keeps the click's user gesture and
                // works in WebViews whose native download handler cannot read blob URLs.
                const link = document.createElement('a');
                link.href = url.href;
                link.download = '';
                link.hidden = true;
                document.body.append(link);
                link.click();
                link.remove();
                setMessage(t("已请求下载，请查看浏览器的下载列表。"));
            }
            function copyExample() {
                const text = t("示例：请把这份材料制作成可直接交付的演示文稿，生成 HTML、PPTX 和工程文件。");
                try {
                    navigator.clipboard?.writeText(text).then(() => setMessage(t("已复制示例"))).catch(() => { });
                }
                catch (_) { /* ignore */ }
            }
            function upload(event) {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file)
                    return;
                imageLoader.current.cancel();
                setMessage('');
                setError('');
                if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 5 * 1024 * 1024) {
                    setError(t("请选择 5 MiB 以内的 PNG 或 JPEG 图片。"));
                    return;
                }
                imageLoader.current.read(file, data => {
                    if (!alive.current)
                        return;
                    setImage({ src: data, alt: slide.image?.alt || file.name.replace(/\.[^.]+$/, ''), caption: slide.image?.caption || '', fit: slide.image?.fit || 'contain', name: file.name });
                    setDirty(true);
                    setError('');
                    setMessage(t("图片已载入，保存后生效。"));
                }, () => { if (alive.current) {
                    setError(t("无法读取图片，请重试。"));
                    setMessage('');
                } });
                if (imageLoader.current.pending)
                    setMessage(t("正在读取图片，切换页面会取消本次读取。"));
            }
            const currentImage = image?.src || (slide?.image?.assetId && project.assets[slide.image.assetId]?.data);
            return __stardustUpdatesInlinePage(React,h(W.Page,{workbench,rootRef:rootElement,title:t('演示文稿'),subtitle:project?h(React.Fragment,null,project.title+' · '+project.slides.length+t(' 页 · 修订 ')+project.revision,(dirty || dataDirty)?h('span',{className:'w-tag'},t('未保存')):h('span',null,' · '+pptText('已保存','Saved'))):pptText('管理、预览和编辑已生成的演示文稿。','Manage, preview and edit generated presentations.'),className:'pptw ppt-workbench','aria-busy':busy?'true':undefined,actions:project?h(React.Fragment,null,
 h(W.Button,{icon:'left',disabled:busy || dataDirty,onClick:()=>requestNavigation({kind:'back'})},t('返回项目')),
 h(W.Button,{variant:'primary',disabled:busy || dataDirty || imagePending || !dirty,'aria-keyshortcuts':'Control+S Meta+S',onClick:()=>save()},pptText('保存修改','Save changes')),
 h(W.Button,{icon:'download',disabled:busy || dirty || dataDirty || imagePending,title:dirty || dataDirty?pptText('先保存当前修改','Save changes first'):undefined,onClick:()=>setDownloadOpen(true)},pptText('下载成品','Download output'))) : h(W.IconButton,{icon:'refresh',label:t('刷新项目'),disabled:busy,onClick:refreshList})},
 h('style',null,css),h('style',null,PPT_WORKBENCH_CSS),error && h(W.Status,{tone:'error',className:'ppt-recovery'},[h('p',{key:'text'},error),h('div',{key:'actions',className:'w-toolbar'},[h(W.Button,{key:'retry',icon:'refresh',disabled:busy || dataDirty,onClick:() => project ? open(project.id) : refreshList()},t("重试")),conflict && project ? h(W.Button,{key:'reload',disabled:busy || dataDirty,onClick:keepInputsAndReload},t("载入最新版本，保留我的输入")) : null])]),h(W.Status,{tone:'success'},message),busy?h(W.Status,null,job):null,
 dataDirty ? h(W.Status,null,h('div',{className:'ppt-data-warning'},pptText('数据推演或材料尚未保存，成品仍是已保存版本。','Scenario or source changes are unsaved. Output still uses saved values.'),h(W.Button,{variant:'ghost',onClick:()=>setActiveTab('data')},pptText('前往数据与推演','Open data and what-if')))) : null,
 !project ? h(W.Tabs,{label:tplTr('Раздел презентаций','Presentations section'),value:listTab,onChange:setListTab,items:[{id:'projects',label:tplTr('Проекты','Projects'),count:projects.length},{id:'templates',label:tplTr('Шаблоны','Templates')}]},listTab==='templates' ? h('div',{className:'ppt-templates-view'},h(TemplatesPanel,{onCreated:id=>{if(id){setActiveTab('content');open(id);}}})) : projects.length ? h('div',{className:'ppt-library'},h(ProjectLibrary,{items:projects,groupByOwner:projectsAdmin,language:languageOf(),t:pptText,searchHint:pptText('搜索标题或工程路径','Search titles or project paths'),searchText:row=>row.title+' '+row.path+' '+(row.owner || ''),updatedAt:row=>row.updatedAt,renderItem:row=>h(W.Row,{key:row.id,title:row.title,description:row.path,disabled:busy,onClick:()=>{setActiveTab('content');open(row.id);}})})) : h(W.Empty,{icon:'slides',title:t("还没有可以编辑的项目"),action:h(React.Fragment,null,[h(W.Button,{key:'copy',onClick:copyExample},t("复制示例")),h(W.Button,{key:'refresh',icon:'refresh',disabled:busy,onClick:refreshList},t("刷新项目"))])},[h('p',{key:'how'},t("先在对话中让助手生成演示文稿。已有项目可以让助手调用 ppt_check 检查一次，它会出现在这里。")),h('p',{key:'example'},t("示例：请把这份材料制作成可直接交付的演示文稿，生成 HTML、PPTX 和工程文件。"))])) :
 h(W.Tabs,{label:pptText('演示文稿工作台视图','Presentation workbench views'),value:activeTab,onChange:value=>{setActiveTab(value);if(value==='data' && project.dataModel)setMode('html');},items:[{id:'content',label:pptText('内容编辑','Edit content')},{id:'visual',label:pptText('视觉检查','Visual review')},{id:'rehearsal',label:pptText('演练','Rehearsal')},{id:'data',label:pptText('数据与推演','Data and what-if')}]},
 h('div',{className:'ppt-editor','data-view':activeTab},
 h(PptPages,{project,selected,busy,imagePending,dirty,dataDirty,onChoose:choose,onDuplicate:()=>structure('duplicate')}),
 h('section',{className:'ppt-canvas-region','aria-label':pptText('成品预览','Presentation preview')},
 h('div',{className:'ppt-preview-tools'},h(W.Button,{'aria-pressed':mode==='html',disabled:busy || dataDirty,onClick:()=>setMode('html')},t('HTML 预览')),h(W.Button,{'aria-pressed':mode==='pptx',disabled:busy || dataDirty || !project.render,onClick:()=>setMode('pptx')},t('最终 PPTX 预览')),h(W.Button,{disabled:busy || dirty || imagePending || dataDirty,onClick:render},t('渲染当前 PPTX')),h(W.IconButton,{icon:'external',label:pptText('查看全屏','View fullscreen'),onClick:async()=>{try{await previewBox.current?.requestFullscreen();previewBox.current?.querySelector('.ppt-fullscreen-exit')?.focus();}catch{setError(pptText('当前宿主无法进入全屏，可以继续使用页面预览。','Fullscreen is unavailable in this host. The page preview remains usable.'));}}})),
 h('div', { className: 'preview', ref: previewBox },h(W.Button,{className:'ppt-fullscreen-exit',onClick:()=>{if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{});}},pptText('退出全屏','Exit fullscreen')), mode === 'html' ? (project.html ? h('iframe', { ref: frame, title: t("演示文稿 HTML 预览"), sandbox: 'allow-scripts', srcDoc: previewDocument, onLoad: jump }) : h('p', null, t("此项目尚无 HTML，请保存一次生成预览。"))) : raster ? h('img', { className: 'render-page', src: raster, alt: t("最终 PPTX 第 ") + (index + 1) + t(" 页渲染结果") }) : h('p', null, t("正在载入当前页渲染…"))),h('div',{className:'ppt-preview-help'},h('p', { className: 'muted' }, mode === 'html' ? t("这是 HTML 放映预览。最终 PPTX 的字体和排版请用上方渲染检查。点击文字可定位编辑字段。") : t("这是当前 PPTX 文件的实际渲染图片，仍需检查每页画面；PowerPoint / WPS 可能因字体环境而不同。"))),project.render?.missingFonts?.length ? h('div', { role: 'alert', className: 'notice error' }, t("渲染引擎报告缺失字体：") + project.render.missingFonts.join('、') + t("。请替换为目标电脑可用字体后重新渲染。")) : null,h('details', { className: 'card' }, h('summary', null, t("质量提醒（") + (project.quality.warningCount + project.quality.errorCount) + (languageOf() === 'zh' ? '）' : ')')), (project.quality.issues || []).map((issue, i) => h('p', { key: i }, (issue.slide > 0 ? t("第 ") + issue.slide + t(" 页：") : "") + (languageOf() === 'ru' ? (issue.messageRu || issue.messageEn) : languageOf() !== 'zh' ? issue.messageEn : issue.message) + (languageOf() === 'zh' ? '；' : ' ') + (languageOf() === 'ru' ? (issue.suggestionRu || issue.suggestionEn) : languageOf() !== 'zh' ? issue.suggestionEn : issue.suggestion)))),h('p',{className:'w-muted'},t('快捷键：Ctrl/⌘+S 保存 · Esc 取消或返回 · Alt+←/→ 切换页面'))),
 h('aside',{className:'ppt-inspector','aria-label':pptText('页面与辅助工具','Slide properties and tools')},
 h('section',{className:'ppt-inspector-panel',hidden:activeTab!=='content'},h('div',{className:'card'},h('h3',null,pptText('页面内容','Slide content')),dirty && h('p', { className: 'dirty' }, t("有未保存修改，请先保存或取消，再切换页面。")),
overlaps.length ? h('div', { className: 'notice' }, h('strong', null, t("这些字段也被修改过，请比较后决定是否保存：")), overlaps.map(row => h('div', { key: row.key }, h('strong', null, t(fields.find(([key]) => key === row.key)[1])), h('p', null, t("最新版本：") + row.latest), h('p', null, t("你的修改：") + row.yours)))) : null,
fields.filter(([key]) => key === 'title' || key === 'notes' || key === 'bullets' && (slide.layout === 'bullets' || slide.bullets?.length > 0) || key !== 'bullets' && (slide[key] || key === 'subtitle' && ['cover', 'section', 'closing', 'quote'].includes(slide.layout) || key === 'kicker' && ['cover', 'section', 'closing'].includes(slide.layout))).map(([key, label]) => h('div', { key }, h('label', { htmlFor: controlId+'-'+key }, t(label)), h(key === 'title' || key === 'kicker' ? 'input' : 'textarea', { id: controlId+'-'+key, ref: el => { fieldRefs.current[key] = el; }, disabled: busy || dataDirty, value: draft[key] || '', rows: key === 'bullets' ? 4 : 2, maxLength: 8000, onChange: e => { setDraft({ ...draft, [key]: e.target.value }); setDirty(true); } }))),h('details',{className:'ppt-image-section',open:!!image},h('summary',null,pptText('图片','Image')),h('label', { htmlFor: controlId+'-image' }, slide.image ? t("替换图片（PNG / JPEG）") : t("添加图片（会改为图文布局）")),
h('input', { id: controlId+'-image', type: 'file', accept: 'image/png,image/jpeg', disabled: busy || dataDirty, onChange: upload }),
currentImage && h('img', { className: 'image-preview', src: currentImage, alt: image?.alt || slide.image?.alt || t("当前图片") }),
image && h(React.Fragment, null, h('p', { className: 'muted' }, t("已选择：") + image.name), h('label', { htmlFor: controlId+'-alt' }, t("图片说明")), h('input', { id: controlId+'-alt', value: image.alt, disabled: busy || dataDirty, onChange: e => setImage({ ...image, alt: e.target.value }) }), h('label', { htmlFor: controlId+'-fit' }, t("图片适应方式")), h('select', { id: controlId+'-fit', value: image.fit, disabled: busy || dataDirty, onChange: e => setImage({ ...image, fit: e.target.value }) }, h('option', { value: 'contain' }, t("完整显示")), h('option', { value: 'cover' }, t("填满并裁切"))))),h('div',{className:'tools'},h('button', { 'aria-keyshortcuts': 'Control+Shift+S Meta+Shift+S', disabled: busy || dataDirty || imagePending, onClick: () => save(true) }, t("另存副本")),
h('button', { 'aria-keyshortcuts': 'Escape', disabled: busy || (!dirty && !imagePending), onClick: () => { imageLoader.current.cancel(); setDraft(draftFor(slide)); setImage(null); setDirty(false); setError(''); setMessage(''); setConflict(false); setOverlaps([]); } }, t("取消修改")),
h('button', { disabled: busy || dirty || imagePending || dataDirty || !project.undoAvailable, onClick: undo }, t("撤销上次修改")),
h('button', { disabled: busy || dirty || imagePending || dataDirty, onClick: async () => { setRestyleOpen(true); setRestyleList(null); try { const v = await action({ operation: 'template-list' }); setRestyleList(v.templates ?? []); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } } }, pptText('Редизайн шаблоном','Restyle with template')))),h('div',{className:'w-toolbar ppt-structure'},h(W.Button,{disabled:busy || dirty || imagePending || dataDirty || index===0,onClick:()=>move(-1)},t('上移')),h(W.Button,{disabled:busy || dirty || imagePending || dataDirty || index===project.slides.length-1,onClick:()=>move(1)},t('下移')),h(W.Button,{icon:'trash',variant:'danger',disabled:busy || dirty || imagePending || dataDirty || project.slides.length<=1,onClick:()=>{setError('');setDeleteOpen(true);}},t('删除本页')))),
 h('section',{className:'ppt-inspector-panel',hidden:activeTab!=='visual'},h(VisualPanel, { key: 'visual:' + project.id, project, selected, blocked: busy || dirty || imagePending || dataDirty,
                onBusy: value => { setBusy(value); setJob(pptText('正在检查和复查实际 PPTX 画面…', 'Reviewing rendered slides…')); },
                onAdopt: next => { adopt(next, selected); setMode(next.render ? 'pptx' : 'html'); setMessage(pptText('已打开修复副本，原稿保留，可撤销排版修改。', 'Opened the repaired copy. The original is kept, and formatting changes can be undone.')); } })),
 h('section',{className:'ppt-inspector-panel',hidden:activeTab!=='rehearsal'},h(CoachingPanel, { key: project.id, project, selected, blocked: busy || dirty || imagePending || dataDirty,
                onChoose: id => { choose(project.slides.find(s => s.id === id)); previewBox.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); },
                onAdopt: next => { adopt(next, selected); setMessage(pptText('已保存为新副本，原稿保留；可在当前副本中撤销采纳的修改。', 'Saved to a new copy. The original is kept; you can undo the adopted changes in this copy.')); } })),
 h('section',{className:'ppt-inspector-panel',hidden:activeTab!=='data'},project.dataModel?project.dataModel && h(DataPanel, { key: project.id + ':' + project.revision, project, blocked: busy || dirty || imagePending || mode !== 'html', incoming: incomingData,
                onParameters: parameters => frame.current?.contentWindow?.postMessage({ type: 'dsh-ppt-data-set', nonce: nonce.current, parameters, command: ++dataCommand.current }, '*'), onDirty: setDataDirty, onBusy: value => { setBusy(value); setJob(pptText('正在核对并更新数据…', 'Updating presentation data…')); },
                onAdopt: next => { adopt(next, selected); setMessage(pptText('已保存确认后的数据，HTML、PPTX 和工程已同步，可撤销。', 'Saved confirmed data. HTML, PPTX and project are synchronized; undo is available.')); }, onChoose: id => choose(project.slides.find(s => s.id === id)), onDownload: download }):h(W.Empty,{title:pptText('此工程没有绑定数据模型','This project has no bound data model'),icon:'file'},pptText('生成时提供来源、指标和可调假设后，可在这里核对来源并预览推演影响。普通演示文稿仍可正常编辑和下载。','Provide sources, metrics and adjustable assumptions when generating the deck to inspect lineage and scenario changes here. Normal editing and downloads remain available.')))))),
 downloadOpen && project ? h(W.Dialog,{title:pptText('下载成品','Download output'),closeLabel:pptText('关闭','Close'),onClose:()=>setDownloadOpen(false)},h('div',{className:'ppt-downloads'},
 project.managedDelivery ? h('p',{className:'muted'},pptText('成品包含 HTML、PDF（如可用）和 PPTX；JSON 工程保存在插件中。','Output contains HTML, PDF (when available) and PPTX; the project JSON stays in the plugin.')) : h('p',{className:'muted'},pptText('分享包包含 PPTX、HTML 和讲稿，不含工程 JSON；工程包保留完整编辑资料。请先保存修改，再下载最新版本。','The share bundle contains PPTX, HTML and speaker notes, without the project JSON. The project bundle keeps full editing data. Save edits before downloading.')),
 h('p',{className:'muted'},pptText('HTML、PPTX 备注和讲稿保留已绑定的来源摘录与用户填写内容。','HTML, PPTX notes and speaker notes retain bound source excerpts and authored content.')),
 project.pdfWarning && h('p',{className:'muted'},project.pdfWarning),
 h('div', { className: 'tools' }, project.pdfAvailable && h('button', { disabled: busy || dirty || imagePending || dataDirty, onClick: () => download('pdf') }, pptText('下载 PDF','Download PDF')), h('button', { className: 'primary', disabled: busy || dirty || imagePending || dataDirty, onClick: () => download('share') }, pptText('下载分享成品包 ZIP','Download share bundle ZIP')),!project.managedDelivery && h('button',{disabled:busy || dirty || imagePending || dataDirty,onClick:()=>download('bundle')},pptText('下载完整工程包 ZIP','Download project bundle ZIP')), h('button', { disabled: busy || dirty || imagePending || dataDirty, onClick: () => download('pptx') }, t("下载最新 PPTX")), h('button', { disabled: busy || dirty || imagePending || dataDirty, onClick: () => download('html') }, t("下载 HTML")), h('button', { disabled: busy || dirty || imagePending || dataDirty, onClick: () => download('notes') }, t("下载讲稿 Markdown")), !project.managedDelivery && h('button', { disabled: busy || dirty || imagePending || dataDirty, onClick: () => download('json') }, t("备份工程"))))) : null,
 pendingNav ? h(W.Dialog,{title:pptText('有未保存的修改','Unsaved changes'),closeLabel:pptText('继续编辑','Keep editing'),busy,onClose:()=>setPendingNav(null)},h('p',null,pptText('请选择如何处理当前页的修改。','Choose what to do with the current slide edits.')),h(W.Status,{tone:'error'},error),h('div',{className:'w-toolbar'},h(W.Button,{variant:'primary',disabled:busy || imagePending || dataDirty,onClick:async()=>{const target=pendingNav;const result=await save();if(result?.project && alive.current)finishNavigation(target,result.project);}},pptText('保存后继续','Save and continue')),h(W.Button,{disabled:busy,onClick:()=>finishNavigation(pendingNav)},pptText('放弃修改并继续','Discard and continue')),h(W.Button,{disabled:busy,onClick:()=>setPendingNav(null)},pptText('继续编辑','Keep editing')))) : null,
 restyleOpen && project ? h(W.Dialog,{title:pptText('Редизайн проекта шаблоном','Restyle project with a template'),closeLabel:pptText('Отмена','Cancel'),busy,onClose:()=>setRestyleOpen(false)},
h('div',{className:'ppt-restyle-dialog'},
h('p',{className:'muted'},pptText('Будет изменено только оформление: тема, палитра, шрифты, логотип, футер и фоны страниц. Текст и порядок страниц не изменятся; отменить можно кнопкой «撤销上次修改 / Undo».','Only the design changes: theme, palette, fonts, logo, footer and slide backgrounds. Text and slide order stay the same; undo is available.')),
h('div',{className:'w-toolbar',role:'list'},(restyleList ?? []).map(tpl => h('button',{key:tpl.key ?? (tpl.scope+':'+tpl.id),role:'listitem','aria-pressed':restyleKey===(tpl.key ?? (tpl.scope+':'+tpl.id)),disabled:busy,style:{borderColor:restyleKey===(tpl.key ?? (tpl.scope+':'+tpl.id))?'var(--w-accent)':undefined},onClick:()=>setRestyleKey(tpl.key ?? (tpl.scope+':'+tpl.id)),title:tpl.name},
h('span',{style:{display:'inline-block',width:'14px',height:'14px',borderRadius:'4px',border:'1px solid var(--w-border)',background:tpl.brand?.primaryColor||'transparent',marginInlineEnd:'6px'}}),
tpl.name+' · '+(tpl.scope==='builtin'?pptText('встроенный','built-in'):tpl.scope==='public'?pptText('общий','public'):pptText('личный','private'))))),
restyleList !== null && !restyleList.length ? h('p',{className:'muted'},pptText('Шаблонов нет: создайте их на вкладке «Шаблоны» или через ppt_template.','No templates yet: create them on the Templates tab or via ppt_template.')) : null,
h('label',null,h('input',{type:'checkbox',checked:restyleCopy,onChange:e=>setRestyleCopy(e.target.checked)}),' ',pptText('Сохранить как копию (оригинал не изменится)','Save as a copy (original stays untouched)')),
h(W.Status,{tone:'error'},error)),
h('div',{className:'w-toolbar'},h(W.Button,{variant:'primary',disabled:busy || !restyleKey,onClick:async()=>{
try{const value=await action({operation:'template-restyle',templateId:restyleKey,id:project.id,expectedRevision:project.revision,saveAs:restyleCopy});setRestyleOpen(false);setRestyleKey('');if(value?.project){adopt(value.project,value.project.slides?.[0]?.id ?? selected);setMessage(restyleCopy?pptText('Редизайн сохранён копией.','Restyle saved as a copy.'):pptText('Редизайн применён, можно отменить.','Restyle applied; undo is available.'));}}
catch(e){setError(e instanceof Error ? e.message : String(e));}
}},pptText('Применить','Apply')),h(W.Button,{disabled:busy,onClick:()=>setRestyleOpen(false)},pptText('Отмена','Cancel')))) : null,
 deleteOpen && project ? h(W.Dialog,{title:t('删除本页'),closeLabel:pptText('取消','Cancel'),busy,onClose:()=>setDeleteOpen(false)},h('p',null,pptText('将删除当前页面，之后可以撤销。','Remove the current slide. You can undo this change.')),h(W.Status,{tone:'error'},error),h('div',{className:'w-toolbar'},h(W.Button,{variant:'danger',disabled:busy,onClick:async()=>{const result=await structure('remove');if(result)setDeleteOpen(false);}},pptText('确认删除本页','Confirm remove slide')),h(W.Button,{disabled:busy,onClick:()=>setDeleteOpen(false)},pptText('取消','Cancel')))) : null),"dsh-ppt");
        }
        function apply(ctx) {
W.register(ctx,{id:'dsh-ppt.workbench',label:()=>t('演示文稿'),icon:'slides',component:Workbench,inject:()=>({locale:localeService}),order:57});

            try {
                localeService = ctx.get?.('locale') || ctx.locale;
            }
            catch {
                localeService = ctx.locale;
            }
            ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'dsh-ppt', order: 58, label: () => t("演示文稿"), inject: () => ({ locale: localeService }) }, Workbench));
        }
        return { inject: ['slots', 'locale'], apply, __internals: { Workbench, TemplatesPanel, TemplateEditor, draftFor, editorHtml, createImageLoader, modelRouteKey, findModelRoute, reconcileModelRoute, languageOf, t, pptText, ModelCascade } };
    } },{"name":"dsh-ppt","version":"0.1.0","hasWorkbench":true,"packageVersion":"0.20.6-ru.13","label":"演示文稿","labelEn":"PPT","suiteComponent":true,"sectionIds":["dsh-ppt"],"iconData":"data:image/webp;base64,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"}));

})();

/* STARDUSTLC_UPDATE_CLIENT_BODY_END */
})();
