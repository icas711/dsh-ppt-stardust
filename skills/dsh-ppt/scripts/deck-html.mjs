// Offline HTML serializer. No dependency on deck-core orchestration.
import { escapeHtml } from './deck-text.mjs'
import { hexToRgba } from './deck-theme.mjs'
import { pageSize, backgroundTypeOfLayout } from './deck-page.mjs'
import { zoneContents } from './deck-zones.mjs'
import { MEDIA_CSS, renderMediaHtml } from './deck-media.mjs'
import { renderDelivery } from './deck-delivery.mjs'
import { renderDataView } from './deck-data-view.mjs'
import { visualHtmlStyle, VISUAL_CSS } from './deck-visual.mjs'
import { LAYOUT_CSS, pickDesignLayout, renderLayoutLayer, zoneInnerStyle } from './deck-layouts.mjs'
import { typographyCss } from './deck-fonts.mjs'
import { renderSceneHtml } from './deck-scene-html.mjs'

// ---------------------------------------------------------------------------
// HTML 网页放映
// ---------------------------------------------------------------------------

export function renderHtml(manifest, theme, language, files = {}) {
  const t = theme
  const lang = language
  const ui = lang.ui
  const size = pageSize(manifest)
  const motion = manifest.motion !== false
  // 模板页面背景（按页面类型 cover/section/content/closing），z-index 与 ::before 装饰层同为 -1，
  // ::after 声明在后因此绘制在其上、正文之下。
  const backgrounds = Array.isArray(manifest.style?.backgrounds) ? manifest.style.backgrounds : []
  const backgroundCss = backgrounds.map(bg => {
    const asset = manifest.assets?.[bg.assetId]
    if (!asset?.data) return ''
    const size = bg.fit === 'contain' ? 'contain' : 'cover'
    const repeat = bg.fit === 'contain' ? 'no-repeat' : 'no-repeat'
    return `.slide[data-bgt="${bg.layoutType}"]::after{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:var(--bg) url("${asset.data}") center/${size} ${repeat}}`
  }).join('\n')
  const motionCss = motion
    ? `body.motion .slide.is-active{animation:slide-in .45s cubic-bezier(.22,.8,.36,1)}
@keyframes slide-in{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
body.motion .bullets li{
  opacity:0;animation:bullet-in .55s cubic-bezier(.22,.8,.36,1) forwards;
  animation-delay:calc(var(--i, 0)*90ms + .12s);
}
@keyframes bullet-in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}`
    : ''
  const slides = manifest.slides.map((slide, index) => {
    const label = slide.title || slide.kicker || slide.label || (ui.slide + ' ' + (index + 1))
    return '<div class="slide-frame" data-frame="' + (index + 1) + '" tabindex="-1" role="button" aria-label="' + escapeHtml(String(label)) + '">' +
      renderHtmlSlide(slide, index, ui, lang.id, manifest, theme) + '</div>'
  }).join('\n')
  const themeLabel = t.name[lang.id] ?? t.name.en
  const total = manifest.slides.length
  const delivery = renderDelivery(manifest, files, lang.id)
  const dataView = renderDataView(manifest, t)

  return `<!DOCTYPE html>
<html lang="${lang.attr}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" href="data:,">
<title>${escapeHtml(manifest.title)}</title>
<style>
:root{
  --bg:${t.palette.bg};
  --panel:${t.palette.panel};
  --fg:${t.palette.fg};
  --muted:${t.palette.muted};
  --accent:${t.palette.accent};
  --accent2:${t.palette.accent2};
  --font-heading:${t.fonts.heading};
  --font-body:${t.fonts.body};
}
*{box-sizing:border-box}
html,body{height:100%}
body{
  margin:0;background:var(--bg);color:var(--fg);
  font-family:var(--font-body);overflow:hidden;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
}
#stage{position:fixed;inset:0}
.slide-frame{position:fixed;inset:0;margin:auto;width:min(100vw,${100 * size.width / size.height}vh);height:min(100vh,${100 * size.height / size.width}vw);pointer-events:none}
.slide-frame.is-current,body.overview .slide-frame{pointer-events:auto}
.slide{
  position:absolute;inset:0;display:none;flex-direction:column;justify-content:center;
  padding:clamp(34px,7vw,110px);overflow:hidden;container-type:inline-size;
}
.slide::before{
  content:"";position:absolute;inset:-20%;pointer-events:none;z-index:-1;
  background:
    radial-gradient(42% 34% at 82% 18%, ${hexToRgba(t.palette.accent, t.dark ? 0.22 : 0.12)}, transparent 70%),
    radial-gradient(36% 30% at 12% 86%, ${hexToRgba(t.palette.accent2, t.dark ? 0.16 : 0.12)}, transparent 70%),
    radial-gradient(70% 60% at 50% 50%, ${hexToRgba(t.palette.panel, 0.55)}, transparent 100%);
}
.slide.is-active{display:flex}
${backgroundCss}
${LAYOUT_CSS}
${motionCss}
${MEDIA_CSS}
${VISUAL_CSS}
.kicker{
  color:var(--accent);font-weight:700;letter-spacing:.18em;text-transform:uppercase;
  font-size:clamp(12px,1.3vw,18px);margin-bottom:22px;
}
h1,h2,.statement-title{font-family:var(--font-heading);line-height:1.06;letter-spacing:-.015em;margin:0}
h1{font-size:clamp(44px,7.4vw,118px);max-width:20ch}
h2{font-size:clamp(34px,5vw,82px);max-width:20ch}
.subtitle{
  color:var(--muted);font-size:clamp(18px,2.3vw,34px);line-height:1.5;
  max-width:46em;margin-top:28px;
}
.meta{
  color:var(--muted);font-size:clamp(12px,1.2vw,16px);margin-top:48px;
  letter-spacing:.06em;
}
.bullets ul{margin:30px 0 0;padding:0;list-style:none;display:grid;gap:clamp(12px,1.6vw,24px)}
.bullets li{
  position:relative;padding-left:clamp(28px,2.6vw,44px);
  font-size:clamp(20px,2.6vw,40px);line-height:1.35;max-width:24em;
}
.bullets li::before{
  content:"";position:absolute;left:0;top:.58em;width:.5em;height:.5em;
  background:var(--accent);border-radius:2px;box-shadow:.28em .28em 0 color-mix(in srgb, var(--accent2) 78%, transparent);
}
.section .kicker{margin-bottom:10px}
.section .accent-line{width:min(180px,18vw);height:6px;background:var(--accent);margin:28px 0}
.statement-title{
  font-size:clamp(34px,5.4vw,88px);max-width:22ch;font-weight:800;
  border-left:6px solid var(--accent);padding-left:clamp(22px,3vw,48px);
}
.closing{text-align:center;align-items:center}
.closing h1,.closing .statement-title{font-size:clamp(52px,9vw,148px)}
.closing .subtitle{color:var(--accent);font-weight:700}
.cover h1{font-weight:900}
.quote-mark{
  font-family:var(--font-heading);font-size:clamp(90px,13vw,210px);line-height:.62;
  color:var(--accent);margin-bottom:clamp(14px,2vw,30px);
}
.quote-text{
  font-family:var(--font-heading);font-size:clamp(26px,4.2vw,62px);line-height:1.28;
  font-weight:700;max-width:22ch;margin:0;
}
.quote-attr{color:var(--muted);margin-top:clamp(18px,2.6vw,34px);font-size:clamp(15px,1.8vw,26px);letter-spacing:.04em}
table.deck-table{
  border-collapse:collapse;margin-top:clamp(20px,3vw,42px);width:100%;max-width:100%;
  font-size:clamp(14px,1.55vw,23px);
}
.deck-table th{
  background:color-mix(in srgb, var(--accent) 26%, var(--bg));color:var(--fg);
  text-align:left;font-weight:700;padding:.6em .9em;letter-spacing:.02em;
  border-bottom:2px solid var(--accent);
}
.deck-table td{
  padding:.55em .9em;border-bottom:1px solid color-mix(in srgb, var(--muted) 55%, transparent);
  color:var(--fg);
}
.deck-table .num{text-align:right;font-variant-numeric:tabular-nums}
.deck-table tbody tr:nth-child(even){background:color-mix(in srgb, var(--panel) 62%, transparent)}
#progress{position:fixed;top:0;left:0;height:3px;width:0;background:var(--accent);z-index:30;transition:width .25s}
#hud{
  position:fixed;left:22px;right:22px;bottom:18px;z-index:50;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:10px;align-items:center;
  color:var(--muted);font-size:13px;letter-spacing:.08em;font-variant-numeric:tabular-nums;
}
#hud button{
  background:color-mix(in srgb, var(--panel) 88%, transparent);color:var(--fg);
  border:1px solid color-mix(in srgb, var(--muted) 45%, transparent);border-radius:99px;
  padding:8px 14px;min-height:34px;font:inherit;cursor:pointer;
}
#hud button:hover{border-color:var(--accent);color:var(--accent)}
#notes-panel{
  position:fixed;left:0;right:0;bottom:64px;z-index:40;display:none;
  background:color-mix(in srgb, var(--panel) 96%, black 4%);
  border-top:2px solid var(--accent);
  padding:14px clamp(22px,4vw,64px) 18px;max-height:38vh;overflow:auto;
}
body.notes-open #notes-panel{display:block}
#notes-panel .notes-head{display:flex;align-items:center;justify-content:space-between;gap:16px}
#notes-close{
  background:transparent;color:var(--muted);border:1px solid color-mix(in srgb, var(--muted) 45%, transparent);
  border-radius:99px;padding:4px 12px;font:inherit;cursor:pointer;min-height:30px;
}
#notes-close:hover{color:var(--accent);border-color:var(--accent)}
#notes-panel .notes-label{
  color:var(--accent);font-weight:700;letter-spacing:.14em;text-transform:uppercase;
  font-size:12px;margin-bottom:8px;
}
#notes-text{white-space:pre-wrap;line-height:1.65;font-size:clamp(15px,1.5vw,18px);color:var(--fg)}
#notes-text.is-empty{color:var(--muted);font-style:italic}
#help-panel{
  position:fixed;right:22px;bottom:64px;z-index:60;max-width:390px;
  background:color-mix(in srgb, var(--panel) 96%, black 4%);color:var(--fg);
  border:1px solid color-mix(in srgb, var(--accent) 55%, transparent);border-radius:14px;
  padding:16px 20px;box-shadow:0 18px 50px rgba(0,0,0,.45);font-size:14px;line-height:1.8;
}
#help-panel[hidden]{display:none}
#help-panel kbd{
  background:color-mix(in srgb, var(--accent) 22%, transparent);border-radius:5px;
  padding:1px 6px;font-family:inherit;font-size:12px;
}
#toast{
  position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:70;
  background:color-mix(in srgb, var(--panel) 96%, black 4%);color:var(--fg);
  border:1px solid color-mix(in srgb, var(--accent) 55%, transparent);border-radius:99px;
  padding:9px 18px;font-size:13px;
}
#toast[hidden]{display:none}
#blank{position:fixed;inset:0;z-index:80;display:none;pointer-events:none}
body.blank-black #blank{display:block;background:#000}
body.blank-white #blank{display:block;background:#fff}
body.blank-black #hud,body.blank-white #hud{visibility:hidden;pointer-events:none}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
body.overview #stage{
  display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px;
  grid-auto-rows:var(--deck-thumb-height,180px);
  padding:18px 18px 92px;position:fixed;inset:0;overflow:auto;align-content:start;
}
body.overview .slide-frame{
  position:relative;inset:auto;width:100%;aspect-ratio:${size.width}/${size.height};overflow:hidden;
  border:1px solid color-mix(in srgb, var(--muted) 35%, transparent);border-radius:12px;
  cursor:pointer;background:var(--bg);outline:none;
}
body.overview .slide-frame:hover{border-color:var(--accent)}
body.overview .slide-frame.is-current{outline:2px solid var(--accent);outline-offset:2px}
body.overview .slide-frame:focus-visible{outline:2px solid var(--accent);outline-offset:-3px}
body.overview .slide-frame::after{
  content:attr(data-frame);position:absolute;right:8px;bottom:6px;z-index:2;
  font-size:12px;color:var(--muted);background:color-mix(in srgb, var(--bg) 84%, transparent);
  border:1px solid color-mix(in srgb, var(--muted) 40%, transparent);border-radius:6px;
  padding:1px 7px;font-variant-numeric:tabular-nums;
}
body.overview .slide{
  display:flex !important;position:absolute;inset:0;width:1280px;height:${1280 * size.height / size.width}px;
  transform:scale(var(--deck-thumb-scale,.25));transform-origin:top left;pointer-events:none;
  animation:none !important;
}
body.overview .bullets li{opacity:1 !important;animation:none !important}
body.overview .media-canvas{width:1280px;height:${1280 * size.height / size.width}px}
body.overview #notes-panel,body.presenting #notes-panel{display:none !important}
body.presenting #notes-toggle{opacity:.55}
body.presenting #hud{opacity:0;pointer-events:none;transition:opacity .25s}
body.presenting #hud:hover{opacity:1;pointer-events:auto}
@media (max-width:900px){
  .slide{padding:clamp(22px,5vw,44px)}
  h1{font-size:clamp(34px,8.5vw,64px)}
  h2{font-size:clamp(26px,6.5vw,48px)}
  .statement-title{font-size:clamp(26px,7vw,54px)}
  .subtitle{font-size:clamp(16px,3.4vw,24px)}
  .bullets li{font-size:clamp(16px,3.4vw,24px)}
  .kicker{font-size:13px}
  .deck-table{font-size:14px}
  .deck-table th,.deck-table td{padding:.55em .6em}
  #hud{left:10px;right:10px;bottom:10px;gap:6px;font-size:12px}
  #hud button{padding:10px 16px;min-height:44px}
  #notes-panel{bottom:68px;max-height:45vh}
  #help-panel{right:10px;bottom:68px;left:10px;max-width:none}
}
@media (max-width:640px){
  #theme-label{display:none}
}
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{animation:none !important;transition:none !important}
}
@media print{
  @page{size:${size.width / 36000}mm ${size.height / 36000}mm;margin:0}
  html,body{height:auto;overflow:visible;background:#fff}
  .slide-frame{position:relative;display:block !important;width:${size.width / 36000}mm;height:${size.height / 36000}mm;margin:0}
  .slide{position:relative;display:block !important;height:100%;page-break-after:always;padding:48px}
  ${motion ? 'body.motion .bullets li{opacity:1 !important;animation:none !important}' : ''}
  #progress,#hud,#notes-panel,#help-panel,#toast{display:none !important}
}
${delivery.css}
${dataView.css}
${typographyCss(manifest)}
</style>
</head>
<body class="${motion ? 'motion' : 'no-motion'}">
<div id="progress" aria-hidden="true"></div>
${delivery.body}
${dataView.body}
<div id="stage">
${slides}
</div>
<div id="hud" aria-live="polite">
  <span id="counter">${ui.slide} 1 ${ui.of} ${total}</span>
  ${delivery.navigation}
  <span id="theme-label">${ui.theme} · ${escapeHtml(themeLabel)}</span>
  <button id="notes-toggle" type="button" title="S · ${escapeHtml(ui.notesToggle)}" aria-controls="notes-panel" aria-expanded="false">${escapeHtml(ui.notesToggle)}</button>
  <button id="presenter-toggle" type="button" title="V · ${escapeHtml(ui.presenterToggle)}">${escapeHtml(ui.presenterToggle)}</button>
  <button id="overview-toggle" type="button" title="G · ${escapeHtml(ui.overviewToggle)}" aria-pressed="false">${escapeHtml(ui.overviewToggle)}</button>
  <button id="help-toggle" type="button" title="?" aria-label="${escapeHtml(ui.helpTitle)}">?</button>
  <button id="fullscreen" type="button" title="F · ${escapeHtml(ui.fullscreenToggle)}" aria-label="${escapeHtml(ui.fullscreenToggle)}">⛶</button>
</div>
<div id="notes-panel" role="region" aria-label="${escapeHtml(ui.notesLabel)}">
  <div class="notes-head">
    <span class="notes-label">${escapeHtml(ui.notesLabel)}</span>
    <button id="notes-close" type="button" aria-label="${escapeHtml(ui.notesCloseLabel)}">×</button>
  </div>
  <div id="notes-text"></div>
</div>
<div id="help-panel" hidden>
  <div class="notes-label">${escapeHtml(ui.helpTitle)}</div>
  <p><kbd>←</kbd> <kbd>→</kbd> / <kbd>Space</kbd> ${escapeHtml(ui.helpNav)} · <kbd>Home</kbd> / <kbd>End</kbd> ${escapeHtml(ui.helpFirstLast)} · <kbd>S</kbd> ${escapeHtml(ui.notesToggle)} · <kbd>V</kbd> ${escapeHtml(ui.presenterToggle)} · <kbd>G</kbd> ${escapeHtml(ui.overviewToggle)} · <kbd>F</kbd> ${escapeHtml(ui.helpFullscreen)} · <kbd>P</kbd> ${escapeHtml(ui.helpPrint)} · <kbd>B</kbd> ${escapeHtml(ui.helpBlank)} · <kbd>W</kbd> ${escapeHtml(ui.helpWhite)} · <kbd>Esc</kbd> ${escapeHtml(ui.closeLabel)} · <kbd>?</kbd> ${escapeHtml(ui.helpTitle)}</p>
  <p>${escapeHtml(ui.presenterHint)}</p>
  <p>${escapeHtml(ui.overviewHint)}</p>
</div>
<div id="toast" role="status" hidden></div>
<div id="blank" aria-hidden="true"></div>
<script>
(() => {
  const frames = Array.from(document.querySelectorAll('.slide-frame'));
  const slides = Array.from(document.querySelectorAll('.slide'));
  const counter = document.getElementById('counter');
  const progress = document.getElementById('progress');
  const fullscreenBtn = document.getElementById('fullscreen');
  const notesPanel = document.getElementById('notes-panel');
  const notesText = document.getElementById('notes-text');
  const notesBtn = document.getElementById('notes-toggle');
  const notesClose = document.getElementById('notes-close');
  const presenterBtn = document.getElementById('presenter-toggle');
  const overviewBtn = document.getElementById('overview-toggle');
  const helpBtn = document.getElementById('help-toggle');
  const helpPanel = document.getElementById('help-panel');
  const toastEl = document.getElementById('toast');
  let index = 0;
  let syncDelivery = () => {};
  let presenterWin = null;
  let presenterInitSent = false;
  let toastTimer = 0;
  const total = slides.length;
  const ui = ${JSON.stringify(ui).replace(/</g, '\\u003c')};

  function notesOf(i) { return slides[i] && slides[i].dataset ? (slides[i].dataset.notes || '') : ''; }
  function titleOf(i) {
    const el = slides[i] ? slides[i].querySelector('h1,h2,.statement-title,.quote-text') : null;
    return el ? el.textContent.trim() : '';
  }
  function state() {
    const next = (index + 1) % total;
    return { index: index, total: total, title: titleOf(index), notes: notesOf(index), nextTitle: titleOf(next), nextNotes: notesOf(next) };
  }
  window.__dshPpt = { go: function (delta) { go(index + delta); }, jump: function (i) { go(i); }, state: state };

  function toast(message) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2600);
  }

  function syncNotes() {
    const notes = notesOf(index);
    notesText.textContent = notes || ui.noNotes;
    notesText.classList.toggle('is-empty', notes === '');
    notesBtn.setAttribute('aria-expanded', document.body.classList.contains('notes-open') ? 'true' : 'false');
    updatePresenter();
  }

  function sendInit() {
    if (!presenterOpen()) return;
    try {
      presenterWin.postMessage({
        __dshPpt: 'init',
        title: (document.title.split(' · ')[1] || document.title),
        css: document.querySelector('style') ? document.querySelector('style').textContent : '',
        total: total,
        slides: slides.map(function (slide) { return slide.outerHTML; }),
      }, '*');
    } catch (_) { /* popup closing */ }
  }

  function sendState() {
    if (!presenterOpen()) return;
    const next = (index + 1) % total;
    try {
      presenterWin.postMessage({
        __dshPpt: 'state',
        index: index,
        total: total,
        title: titleOf(index),
        nextTitle: titleOf(next),
        notes: notesOf(index),
        nextNotes: notesOf(next),
        blank: document.body.classList.contains('blank-black') ? 'black' : (document.body.classList.contains('blank-white') ? 'white' : null),
      }, '*');
    } catch (_) { /* popup closing */ }
  }

  function updatePresenter() { sendState(); }

  function go(next) {
    if (document.body.classList.contains('blank-black') || document.body.classList.contains('blank-white')) setBlank(null);
    const wrapped = next < 0 || next >= total;
    index = (next + total) % total;
    slides.forEach(function (slide, i) {
      slide.classList.toggle('is-active', i === index);
      if (frames[i]) frames[i].classList.toggle('is-current', i === index);
    });
    counter.textContent = ui.slide + ' ' + (index + 1) + ' ' + ui.of + ' ' + total;
    syncDelivery(index);
    progress.style.width = ((index + 1) / total * 100) + '%';
    document.title = (index + 1) + ' / ' + total + ' · ' + ${JSON.stringify(manifest.title).replace(/</g, '\\u003c')};
    try { history.replaceState?.(null, '', '#slide-' + (index + 1)); } catch (_) { /* file:// 下个别浏览器可能拒绝 */ }
    if (wrapped) toast(ui.wrapHint + ' ' + (index + 1) + ' / ' + total);
    syncNotes();
  }

  function notesOpen() { return document.body.classList.contains('notes-open'); }
  function presenterOpen() { try { return !!(presenterWin && !presenterWin.closed); } catch (_) { return false; } }

  function setNotes(on) {
    document.body.classList.toggle('notes-open', on);
    if (on) setOverview(false);
    syncNotes();
  }

  function updateThumbScale() {
    if (!document.body.classList.contains('overview')) return;
    requestAnimationFrame(function () {
      const width = frames[0] ? frames[0].getBoundingClientRect().width : 0;
      if (width > 0) {
        document.documentElement.style.setProperty('--deck-thumb-scale', String(width / 1280));
        document.documentElement.style.setProperty('--deck-thumb-height', String(width * ${size.height} / ${size.width}) + 'px');
      }
    });
  }

  function setOverview(on) {
    document.body.classList.toggle('overview', on);
    overviewBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    frames.forEach(function (frame) { frame.tabIndex = on ? 0 : -1; });
    if (on) {
      document.body.classList.remove('notes-open');
      helpPanel.hidden = true;
      syncNotes();
      updateThumbScale();
    }
  }

  function presenterHtml() {
    const labelCurrent = ${JSON.stringify(ui.currentLabel)};
    const labelNext = ${JSON.stringify(ui.nextLabel)};
    const labelNotes = ${JSON.stringify(ui.notesLabel)};
    const noNotes = ${JSON.stringify(ui.noNotes)};
    const hintText = ${JSON.stringify(ui.presenterShortHint)};
    const deckTitle = ${JSON.stringify(manifest.title).replace(/</g, '\\u003c')};
    const langAttr = ${JSON.stringify(lang.attr)};
    const cs = getComputedStyle(document.documentElement);
    const val = function (name, fallback) { const v = cs.getPropertyValue(name).trim(); return v || fallback; };
    const css = [
      ':root{--bg:' + val('--bg', '#070B14') + ';--panel:' + val('--panel', '#0D1424') + ';--fg:' + val('--fg', '#E8F1FF') + ';--muted:' + val('--muted', '#7E8BA8') + ';--accent:' + val('--accent', '#7C3AED') + ';--accent2:' + val('--accent2', '#06B6D4') + ';--font-heading:' + val('--font-heading', 'sans-serif') + ';--font-body:' + val('--font-body', 'sans-serif') + '}',
      '*{box-sizing:border-box}',
      'body{margin:0;background:var(--bg);color:var(--fg);font-family:var(--font-body);height:100vh;display:flex;flex-direction:column;overflow:hidden}',
      'header{display:flex;align-items:center;gap:14px;padding:9px 16px;border-bottom:1px solid color-mix(in srgb, var(--muted) 40%, transparent);font-size:13px;color:var(--muted)}',
      'header #ptitle{color:var(--fg);font-weight:700;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      'header #pclock{font-variant-numeric:tabular-nums}',
      'main{flex:1;display:grid;grid-template-columns:1.12fr .88fr;gap:12px;padding:12px 16px;min-height:0}',
      '.col{display:flex;flex-direction:column;gap:10px;min-height:0}',
      '.card{background:var(--panel);border:1px solid color-mix(in srgb, var(--muted) 30%, transparent);border-radius:12px;padding:10px 12px;min-height:0;display:flex;flex-direction:column;gap:6px}',
      '.card-notes{flex:1}',
      '.lbl{color:var(--accent);font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}',
      '.pv{position:relative;width:100%;aspect-ratio:${size.width}/${size.height};overflow:hidden;border-radius:8px;background:var(--bg);border:1px solid color-mix(in srgb, var(--muted) 25%, transparent);--pv-scale:.3}',
      '.pv-slide{position:absolute;left:0;top:0;transform:translate(var(--pv-x,0px),var(--pv-y,0px)) scale(var(--pv-scale,.25));transform-origin:top left}',
      '.pv-slide .slide{display:flex !important;position:absolute;left:0;top:0;width:100vw;height:100vh;animation:none !important}',
      '.pv-slide .bullets li{opacity:1 !important;animation:none !important}',
      '#thumbs{display:flex;gap:8px;overflow-x:auto;padding-bottom:2px}',
      '#thumbs .thumb{position:relative;flex:0 0 128px;aspect-ratio:${size.width}/${size.height};border-radius:8px;overflow:hidden;border:1px solid color-mix(in srgb, var(--muted) 35%, transparent);cursor:pointer;background:var(--bg);--pv-scale:.09}',
      '#thumbs .thumb.is-current{outline:2px solid var(--accent);outline-offset:1px}',
      '#pnotes{font-size:var(--notes-size,19px);line-height:1.6;white-space:pre-wrap;overflow:auto;flex:1}',
      'footer{display:flex;align-items:center;gap:8px;padding:9px 16px;border-top:1px solid color-mix(in srgb, var(--muted) 40%, transparent);flex-wrap:wrap}',
      'button{background:color-mix(in srgb, var(--panel) 90%, transparent);color:var(--fg);border:1px solid color-mix(in srgb, var(--muted) 45%, transparent);border-radius:99px;padding:6px 12px;min-height:34px;font:inherit;font-size:13px;cursor:pointer}',
      'button:hover{border-color:var(--accent);color:var(--accent)}',
      'button[aria-pressed="true"]{background:var(--accent);color:var(--bg);border-color:var(--accent)}',
      '#ptimer{font-variant-numeric:tabular-nums;font-size:20px;font-weight:700;color:var(--accent);margin-left:6px}',
      '.bar{flex:1;min-width:100px;height:8px;background:color-mix(in srgb, var(--muted) 28%, transparent);border-radius:99px;overflow:hidden}',
      '#pprog{height:100%;width:0;background:var(--accent);transition:width .2s}',
      '.hint{color:var(--muted);font-size:11px;width:100%}',
    ].join('');
    const js = [
      'var total=0,index=0,elapsed=0,started=Date.now(),paused=false,notesSize=19,slides=[],cssText="",curBlank=null,initialized=false,readyTries=0;',
      'function q(id){return document.getElementById(id)}',
      'function post(m){try{if(window.opener)window.opener.postMessage(m,"*")}catch(e){}}',
      'function fmt(ms){var s=Math.max(0,Math.floor(ms/1000)),m=Math.floor(s/60);s=s%60;var h=Math.floor(m/60);m=m%60;return (h>0?(h<10?"0":"")+h+":":"")+(m<10?"0":"")+m+":"+(s<10?"0":"")+s}',
      'function clock(){var d=new Date();return ("0"+d.getHours()).slice(-2)+":"+("0"+d.getMinutes()).slice(-2)+":"+("0"+d.getSeconds()).slice(-2)}',
      'function tick(){if(!paused)elapsed=Date.now()-started;q("ptimer").textContent=fmt(elapsed);q("pclock").textContent=clock();if(window.requestAnimationFrame)requestAnimationFrame(tick);else setTimeout(tick,250)}',
      'function fitBox(box){var rw=box.clientWidth||320,rh=box.clientHeight||180;var s=Math.min(rw/window.innerWidth,rh/window.innerHeight);var ox=(rw-window.innerWidth*s)/2,oy=(rh-window.innerHeight*s)/2;box.style.setProperty("--pv-scale",String(s));box.style.setProperty("--pv-x",ox+"px");box.style.setProperty("--pv-y",oy+"px")}',
      'function fit(){fitBox(q("pv-cur"));fitBox(q("pv-next"));var th=q("thumbs").children;for(var i=0;i<th.length;i++){fitBox(th[i])}}',
      'function setSlide(box,html){box.innerHTML="";var f=document.createElement("div");f.className="pv-slide";f.innerHTML=html;box.appendChild(f)}',
      'function buildThumbs(){var box=q("thumbs");box.innerHTML="";slides.forEach(function(html,i){var t=document.createElement("div");t.className="thumb";var f=document.createElement("div");f.className="pv-slide";f.innerHTML=html;t.appendChild(f);t.addEventListener("click",function(){post({__dshPpt:"cmd",kind:"go",index:i})});box.appendChild(t)});fit()}',
      'function renderState(st){index=st.index;total=st.total||total;q("pcounter").textContent=(index+1)+" / "+total;setSlide(q("pv-cur"),slides[index]||"");setSlide(q("pv-next"),slides[(index+1)%total]||"");q("pnotes").textContent=st.notes||' + JSON.stringify(ui.noNotes) + ';q("pprog").style.width=((index+1)/total*100)+"%";curBlank=st.blank||null;q("pv-black").setAttribute("aria-pressed",curBlank==="black"?"true":"false");q("pv-white").setAttribute("aria-pressed",curBlank==="white"?"true":"false");q("pv-black").textContent=curBlank==="black"?${JSON.stringify(ui.blankBlackOff)}:${JSON.stringify(ui.blankBlack)};q("pv-white").textContent=curBlank==="white"?${JSON.stringify(ui.blankWhiteOff)}:${JSON.stringify(ui.blankWhite)};var th=q("thumbs").children;for(var i=0;i<th.length;i++){th[i].classList.toggle("is-current",i===index)}fit()}',
      'function togglePause(){paused=!paused;if(!paused)started=Date.now()-elapsed;var b=q("pause");b.setAttribute("aria-pressed",paused?"true":"false");b.textContent=paused?${JSON.stringify(ui.pauseResume)}:${JSON.stringify(ui.pausePause)}}',
      'function resetTimer(){started=Date.now();elapsed=0}',
      'function applyNotesSize(){document.documentElement.style.setProperty("--notes-size",notesSize+"px")}',
      'window.addEventListener("message",function(e){var d=e.data||{};if(d.__dshPpt==="init"&&!initialized){initialized=true;slides=d.slides||[];total=d.total||slides.length;cssText=d.css||"";var st=document.createElement("style");st.textContent=cssText;document.head.appendChild(st);q("ptitle").textContent=d.title||"";buildThumbs()}else if(d.__dshPpt==="state"){renderState(d)}else if(d.__dshPpt==="close"){window.close()}});',
      'window.addEventListener("resize",fit);',
      'window.addEventListener("beforeunload",function(){post({__dshPpt:"cmd",kind:"closed"})});',
      'document.addEventListener("keydown",function(e){var k=e.key;if(k==="ArrowRight"||k===" "){e.preventDefault();post({__dshPpt:"cmd",kind:"go",delta:1})}else if(k==="ArrowLeft"){e.preventDefault();post({__dshPpt:"cmd",kind:"go",delta:-1})}else if(k==="Escape"){post({__dshPpt:"cmd",kind:"end"});window.close()}else if(k.toLowerCase()==="p"){togglePause()}else if(k.toLowerCase()==="t"){resetTimer()}else if(k==="+"||k==="="){notesSize=Math.min(34,notesSize+2);applyNotesSize()}else if(k==="-"){notesSize=Math.max(12,notesSize-2);applyNotesSize()}else if(k.toLowerCase()==="b"){post({__dshPpt:"cmd",kind:"blank",color:curBlank==="black"?null:"black"})}else if(k.toLowerCase()==="w"){post({__dshPpt:"cmd",kind:"blank",color:curBlank==="white"?null:"white"})}});',
      'q("prev").addEventListener("click",function(){post({__dshPpt:"cmd",kind:"go",delta:-1})});',
      'q("next").addEventListener("click",function(){post({__dshPpt:"cmd",kind:"go",delta:1})});',
      'q("pause").addEventListener("click",togglePause);',
      'q("reset").addEventListener("click",resetTimer);',
      'q("font-plus").addEventListener("click",function(){notesSize=Math.min(34,notesSize+2);applyNotesSize()});',
      'q("font-minus").addEventListener("click",function(){notesSize=Math.max(12,notesSize-2);applyNotesSize()});',
      'q("pv-black").addEventListener("click",function(){post({__dshPpt:"cmd",kind:"blank",color:curBlank==="black"?null:"black"})});',
      'q("pv-white").addEventListener("click",function(){post({__dshPpt:"cmd",kind:"blank",color:curBlank==="white"?null:"white"})});',
      'q("end").addEventListener("click",function(){post({__dshPpt:"cmd",kind:"end"});window.close()});',
      'applyNotesSize();tick();function ready(){if(initialized)return;post({__dshPpt:"ready"});readyTries++;if(readyTries<5)setTimeout(ready,700)}setTimeout(ready,250);',
    ].join('');
    return '<!DOCTYPE html><html lang="' + langAttr + '"><head><meta charset="UTF-8"><title>' + deckTitle + ' · ${ui.presenterTitle}</title><style>' + css + '</style></head><body>'
      + '<header><div id="ptitle"></div><div id="pcounter"></div><div id="pclock" title="${ui.presenterClockTitle}"></div></header>'
      + '<main><div class="col">'
      + '<div class="card"><div class="lbl">' + labelCurrent + '</div><div class="pv" id="pv-cur"></div></div>'
      + '<div class="card"><div class="lbl">' + labelNext + '</div><div class="pv" id="pv-next"></div></div>'
      + '<div class="card"><div class="lbl">SLIDES</div><div id="thumbs"></div></div>'
      + '</div><div class="col"><div class="card card-notes"><div class="lbl">' + labelNotes + '</div><div id="pnotes"></div></div></div></main>'
      + '<footer><button id="prev" title="${ui.prevTitle} (←)">◀</button><button id="next" title="${ui.nextTitle} (→)">▶</button><button id="pause" title="${ui.pauseTitle} (P)" aria-pressed="false">${ui.pausePause}</button><button id="reset" title="${ui.resetTimerTitle} (T)">${ui.resetTimerTitle}</button><button id="font-minus" title="${ui.notesFontDown} (-)">A−</button><button id="font-plus" title="${ui.notesFontUp} (+)">A+</button><button id="pv-black" title="${ui.blankBlack} (B)">${ui.blankBlack}</button><button id="pv-white" title="${ui.blankWhite} (W)">${ui.blankWhite}</button><button id="end" title="${ui.endShowTitle} (Esc)">${ui.endShowLabel}</button><div id="ptimer">00:00</div><div class="bar"><div id="pprog"></div></div><div class="hint">' + hintText + '</div></footer>'
      + '<scr' + 'ipt>' + js + '</scr' + 'ipt></body></html>';
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) { await document.exitFullscreen?.(); return; }
      if (!document.documentElement.requestFullscreen || document.fullscreenEnabled === false) {
        toast(ui.fullscreenUnavailable);
        return;
      }
      await document.documentElement.requestFullscreen();
      if (!document.fullscreenElement) toast(ui.fullscreenUnavailable);
    } catch (_) { toast(ui.fullscreenUnavailable); }
  }

  function openPresenter() {
    if (presenterOpen()) { try { presenterWin.focus(); } catch (_) { /* gone */ } return; }
    let url = '';
    try {
      url = URL.createObjectURL(new Blob([presenterHtml()], { type: 'text/html' }));
    } catch (_) { toast(ui.popupBlocked); return; }
    presenterInitSent = false;
    presenterWin = window.open(url, 'dsh-ppt-presenter', 'width=1180,height=760');
    if (!presenterWin) {
      try { URL.revokeObjectURL(url); } catch (_) { /* ignore */ }
      toast(ui.popupBlocked);
      return;
    }
    document.body.classList.add('presenting');
    if (document.activeElement && typeof document.activeElement.blur === 'function') document.activeElement.blur();
    setTimeout(function () { try { URL.revokeObjectURL(url); } catch (_) { /* ignore */ } }, 5000);
  }

  function closePresenter() {
    if (presenterOpen()) {
      try { presenterWin.postMessage({ __dshPpt: 'close' }, '*'); presenterWin.close(); } catch (_) { /* gone */ }
    }
    document.body.classList.remove('presenting');
    presenterInitSent = false;
    if (document.fullscreenElement) { try { document.exitFullscreen?.(); } catch (_) { /* ignore */ } }
    setBlank(null);
  }

  function setBlank(color) {
    document.body.classList.remove('blank-black', 'blank-white');
    if (color === 'black') document.body.classList.add('blank-black');
    else if (color === 'white') document.body.classList.add('blank-white');
    sendState();
  }

  setInterval(function () {
    if (!presenterOpen() && document.body.classList.contains('presenting')) {
      document.body.classList.remove('presenting');
      if (document.fullscreenElement) { try { document.exitFullscreen?.(); } catch (_) { /* ignore */ } }
      setBlank(null);
    }
  }, 800);

  window.addEventListener('message', function (event) {
    if (event.source !== presenterWin) return;
    const data = event.data || {};
    if (data.__dshPpt === 'cmd' && (data.kind === 'end' || data.kind === 'closed')) { closePresenter(); return; }
    if (!presenterOpen()) return;
    if (data.__dshPpt === 'ready') {
      if (!presenterInitSent) { presenterInitSent = true; sendInit(); }
      sendState();
      return;
    }
    if (data.__dshPpt !== 'cmd') return;
    if (data.kind === 'go') {
      setBlank(null);
      if (typeof data.index === 'number') go(data.index);
      else go(index + (data.delta || 0));
      sendState();
    } else if (data.kind === 'blank') {
      setBlank(data.color || null);
    } else if (data.kind === 'end') {
      closePresenter();
    } else if (data.kind === 'closed') {
      document.body.classList.remove('presenting');
      setBlank(null);
    }
  });

  document.addEventListener('keydown', (event) => {
    const key = event.key;
    const lower = key.toLowerCase();
    const targetEl = event.target;
    if (document.getElementById('review-panel').open || event.ctrlKey || event.metaKey || event.altKey) return;
    if (key !== 'Escape' && targetEl && (['INPUT', 'SELECT', 'TEXTAREA'].includes(targetEl.tagName) || targetEl.isContentEditable === true)) return;
    const interactive = targetEl && (targetEl.tagName === 'BUTTON' || targetEl.tagName === 'INPUT' || targetEl.tagName === 'SELECT' || targetEl.tagName === 'TEXTAREA' || targetEl.isContentEditable === true);
    if (key === ' ' && interactive) return;
    if (key === 'Escape') {
      if (!helpPanel.hidden) { helpPanel.hidden = true; return; }
      if (document.body.classList.contains('overview')) { setOverview(false); return; }
      if (notesOpen()) { setNotes(false); return; }
      if (document.body.classList.contains('presenting') || document.body.classList.contains('blank-black') || document.body.classList.contains('blank-white')) { closePresenter(); return; }
      if (document.fullscreenElement) { document.exitFullscreen?.(); return; }
      return;
    }
    const inOverview = document.body.classList.contains('overview');
    if (key === 'ArrowRight' || key === 'PageDown' || key === ' ' || (key === 'ArrowDown' && !inOverview)) {
      event.preventDefault(); go(index + 1);
    } else if (key === 'ArrowLeft' || key === 'PageUp' || (key === 'ArrowUp' && !inOverview)) {
      event.preventDefault(); go(index - 1);
    } else if (/^[1-9]$/.test(key) && !inOverview) {
      const jumped = Number(key);
      if (jumped <= total) { event.preventDefault(); go(jumped - 1); }
    } else if (key === 'Home') {
      event.preventDefault(); go(0);
    } else if (key === 'End') {
      event.preventDefault(); go(total - 1);
    } else if (key === 'Enter' && inOverview) {
      event.preventDefault(); setOverview(false);
    } else if (lower === 'f') {
      void toggleFullscreen();
    } else if (lower === 'g') {
      setOverview(!inOverview);
    } else if (lower === 's') {
      if (document.body.classList.contains('presenting')) { toast(ui.presenterHint); }
      else { document.body.classList.toggle('notes-open'); syncNotes(); }
    } else if (lower === 'v') {
      if (presenterOpen()) closePresenter();
      else openPresenter();
    } else if (lower === 'b') {
      setBlank(document.body.classList.contains('blank-black') ? null : 'black');
    } else if (lower === 'w') {
      setBlank(document.body.classList.contains('blank-white') ? null : 'white');
    } else if (lower === 'p') {
      window.print();
    } else if (key === '?') {
      helpPanel.hidden = !helpPanel.hidden;
    }
  });

  let wheelLock = 0;
  document.addEventListener('wheel', (event) => {
    if (document.getElementById('review-panel').open || event.target.closest?.('#hud,#delivery-bar,#notes-panel,#help-panel')) return;
    const now = Date.now();
    if (now - wheelLock < 550 || document.body.classList.contains('overview') || notesOpen()) return;
    wheelLock = now;
    if (Math.abs(event.deltaY) > 12) go(index + (event.deltaY > 0 ? 1 : -1));
  }, { passive: true });

  let touchStartY = 0;
  let touchOnStage = false;
  document.addEventListener('touchstart', (event) => { touchOnStage = !document.getElementById('review-panel').open && !!event.target.closest?.('#stage'); touchStartY = event.touches[0].clientY; }, { passive: true });
  document.addEventListener('touchend', (event) => {
    const delta = event.changedTouches[0].clientY - touchStartY;
    if (touchOnStage && Math.abs(delta) > 48 && !document.body.classList.contains('overview')) go(index + (delta < 0 ? 1 : -1));
  }, { passive: true });

  fullscreenBtn.addEventListener('click', () => { void toggleFullscreen(); });
  notesBtn.addEventListener('click', () => {
    if (document.body.classList.contains('presenting')) { toast(ui.presenterHint); return; }
    setNotes(!notesOpen());
  });
  notesClose.addEventListener('click', () => setNotes(false));
  presenterBtn.addEventListener('click', () => { if (presenterOpen()) closePresenter(); else openPresenter(); });
  overviewBtn.addEventListener('click', () => setOverview(!document.body.classList.contains('overview')));
  helpBtn.addEventListener('click', () => { helpPanel.hidden = !helpPanel.hidden; });
  frames.forEach((frame, i) => {
    frame.addEventListener('click', () => {
      if (document.body.classList.contains('overview')) { go(i); setOverview(false); }
    });
    frame.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && document.body.classList.contains('overview')) { go(i); setOverview(false); }
    });
  });
  window.addEventListener('resize', updateThumbScale);
  window.addEventListener('beforeunload', closePresenter);

  ${delivery.script}
  window.addEventListener('dsh-data-change', () => { syncNotes(); if (presenterOpen()) sendInit(); updatePresenter(); });
  const start = Number.parseInt(location.hash?.replace('#slide-', ''), 10);
  go(Number.isInteger(start) ? start - 1 : 0);
})();
</script>
${dataView.script}
</body>
</html>`
}
function renderHtmlSlide(slide, index, ui, langId, manifest = {}, theme) {
  if (slide.layout === 'scene') return '<section class="slide slide--scene" data-index="' + String(index+1).padStart(2,'0') + '" data-notes="' + escapeHtml(slide.notes ?? '') + '">' + renderSceneHtml(slide,manifest,theme,'scene-'+index) + '</section>'
  const kicker = slide.kicker || (slide.layout === 'cover' ? ui.coverKicker : '')
  const title = slide.title || ''
  const subtitle = slide.subtitle || ''
  const bullets = Array.isArray(slide.bullets) ? slide.bullets : []
  const number = String(index + 1).padStart(2, '0')
  const designLayout = pickDesignLayout(manifest.style?.layouts, slide, backgroundTypeOfLayout(slide.layout))
  const layerHtml = designLayout ? renderLayoutLayer(designLayout, manifest.assets) : ''
  const hasBackground = !designLayout && Boolean(manifest.style?.backgrounds?.length)
  let inner = ''
  switch (slide.layout) {
    case 'image':
    case 'image-left':
    case 'image-right':
    case 'chart':
      inner = renderMediaHtml(slide, manifest, theme)
      break
    case 'cover':
      inner = '<div class="kicker">' + escapeHtml(kicker) + '</div>' +
        '<h1>' + escapeHtml(title) + '</h1>' +
        (subtitle !== '' ? '<div class="subtitle">' + escapeHtml(subtitle) + '</div>' : '') +
        '<div class="meta">' + escapeHtml(ui.generatedBy) + '</div>'
      break
    case 'section':
      inner = '<div class="kicker">' + escapeHtml(kicker) + '</div>' +
        '<h2>' + escapeHtml(title) + '</h2>' +
        '<div class="accent-line"></div>' +
        (subtitle !== '' ? '<div class="subtitle">' + escapeHtml(subtitle) + '</div>' : '')
      break
    case 'statement':
      inner = '<div class="kicker">' + escapeHtml(kicker) + '</div>' +
        '<div class="statement-title">' + escapeHtml(title || slide.text || '') + '</div>' +
        (subtitle !== '' ? '<div class="subtitle">' + escapeHtml(subtitle) + '</div>' : '')
      break
    case 'quote':
      inner = '<div class="kicker">' + escapeHtml(kicker || ui.quoteKicker) + '</div>' +
        '<div class="quote-mark" aria-hidden="true">\u201C</div>' +
        '<blockquote class="quote-text">' + escapeHtml(title || slide.text || '') + '</blockquote>' +
        (subtitle !== '' ? '<div class="quote-attr">\u2014\u2014 ' + escapeHtml(subtitle) + '</div>' : '')
      break
    case 'table': {
      const rows = Array.isArray(slide.rows) ? slide.rows : []
      const head = rows[0] ?? []
      const body = rows.slice(1)
      const isNum = (cell) => /^\s*[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*(?:%|％|次|页|个|人|元|天|小时|分钟)?\s*$/.test(String(cell ?? ''))
      const headingText = title !== '' ? title : (kicker || ui.tableKicker)
      const showKicker = kicker !== '' && kicker !== headingText
      inner = (showKicker ? '<div class="kicker">' + escapeHtml(kicker) + '</div>' : '') +
        '<h2>' + escapeHtml(headingText) + '</h2>' +
        '<table class="deck-table"><thead><tr>' +
        head.map((cell) => '<th' + (isNum(cell) ? ' class="num"' : '') + '>' + escapeHtml(cell) + '</th>').join('') +
        '</tr></thead><tbody>' +
        body.map((row) => '<tr>' + row.map((cell) => '<td' + (isNum(cell) ? ' class="num"' : '') + '>' + escapeHtml(cell) + '</td>').join('') + '</tr>').join('') +
        '</tbody></table>'
      break
    }
    case 'closing':
      inner = '<h1>' + escapeHtml(title || ui.closingTitle) + '</h1>' +
        (subtitle !== '' ? '<div class="subtitle">' + escapeHtml(subtitle) + '</div>' : '') +
        '<div class="meta">' + escapeHtml(ui.generatedBy) + '</div>'
      break
    case 'bullets':
    default:
      inner = '<div class="kicker">' + escapeHtml(kicker) + '</div>' +
        '<h2>' + escapeHtml(title) + '</h2>' +
        '<ul>' + bullets.map((bullet, bulletIndex) => '<li style="--i:' + bulletIndex + '">' + escapeHtml(bullet) + '</li>').join('') + '</ul>'
      break
  }
  const notesAttr = typeof slide.notes === 'string' && slide.notes.trim() !== ''
    ? ' data-notes="' + escapeHtml(slide.notes) + '"'
    : ''
  const slots = zoneContents(slide, designLayout)
  if (slots && !['table', 'chart'].includes(slide.layout)) {
    inner = slots.map(({ zone, role, lines, filled }) => {
      const pos = `position:absolute;left:${zone.x}%;top:${zone.y}%;width:${zone.w}%;height:${zone.h}%;overflow:hidden;margin:0;max-width:none;box-sizing:border-box`
      if (role === 'image' && filled) {
        const src = manifest.assets?.[slide.image.assetId]?.data ?? ''
        return '<img alt="' + escapeHtml(slide.image.alt || '') + '" src="' + escapeHtml(src) + '" style="' + pos + ';object-fit:' + (slide.image.fit === 'fill' ? 'fill' : slide.image.fit === 'cover' ? 'cover' : 'contain') + '"/>'
      }
      const slotStyle = { ...manifest.style?.textStyles?.[role], ...designLayout.textStyles?.[role], ...zone.textStyle }
      const frame = zone.textFrame, physicalSize = pageSize(manifest)
      const unit = emu => `${emu / physicalSize.width * 100}cqw`
      const fontCss = (slotStyle.fontFamily ? `font-family:${JSON.stringify(slotStyle.fontFamily)}!important;` : '') +
        (slotStyle.size !== undefined ? `font-size:${unit(slotStyle.size * 12700)}!important;` : '') +
        (slotStyle.bold !== undefined ? `font-weight:${slotStyle.bold ? 700 : 400}!important;` : '') +
        (slotStyle.italic !== undefined ? `font-style:${slotStyle.italic ? 'italic' : 'normal'}!important;` : '') +
        (slotStyle.color ? `color:${slotStyle.color}!important;` : '')
      const frameCss = frame ? `;display:flex;flex-direction:column;justify-content:${({ top: 'flex-start', center: 'center', bottom: 'flex-end' })[frame.anchor ?? 'top']};text-align:${frame.align ?? 'left'};padding:${unit(frame.margins?.top ?? 45720)} ${unit(frame.margins?.right ?? 91440)} ${unit(frame.margins?.bottom ?? 45720)} ${unit(frame.margins?.left ?? 91440)};line-height:${frame.lineSpacing?.kind === 'pct' ? frame.lineSpacing.value : frame.lineSpacing ? unit(frame.lineSpacing.value * 12700) : 'normal'};letter-spacing:normal` : ''
      const tag = role === 'title' ? (slide.layout === 'cover' ? 'h1' : 'h2') : 'div'
      return '<' + tag + ' class="tpl-slot ' + (role === 'body' ? 'media-caption' : role) + '" style="' + escapeHtml(pos + frameCss + ';' + fontCss) + '"><span style="display:block;width:100%">' + lines.map(escapeHtml).join('<br>') + '</span></' + tag + '>'
    }).join('')
  }
  const visualStyle = visualHtmlStyle(slide.visual)
  const bgAttr = hasBackground ? ' data-bgt="' + backgroundTypeOfLayout(slide.layout) + '"' : ''
  return '<section class="slide slide--' + escapeHtml(slide.layout || 'bullets') + '" data-index="' + number + '"' + (designLayout ? ' data-design="' + escapeHtml(designLayout.id) + '"' : '') + notesAttr + bgAttr + (visualStyle ? ' style="' + escapeHtml(visualStyle) + '"' : '') + '>' +
    layerHtml + '<div class="slide-inner"' + (slots && !['table', 'chart'].includes(slide.layout) ? ' style="position:absolute;inset:0;max-width:none;padding:0"' : designLayout && zoneInnerStyle(designLayout) ? ' style="' + zoneInnerStyle(designLayout) + '"' : '') + '>' + inner + '</div>' +
    (manifest.brand?.logoAssetId ? '<img class="brand-logo" src="' + escapeHtml(manifest.assets?.[manifest.brand.logoAssetId]?.data ?? '') + '" alt="' + escapeHtml(manifest.brand.name || 'Logo') + '"/>' : '') +
    (manifest.brand?.footer ? '<div class="brand-footer">' + escapeHtml(manifest.brand.footer) + '</div>' : '') + '</section>'
}
