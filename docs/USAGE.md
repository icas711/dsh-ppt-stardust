# dsh-ppt usage

[Overview](../README.en.md) · [Tool reference](../skills/dsh-ppt/references/advanced.md)

## Create

Before each new deck, use `ask_user_question` to confirm the template/style and content requirements; wait for answers. Use supplied facts and actual chart data only.

For a library template, read `ppt_template {operation:"get", templateId}` first. Use its page size, typography and existing layout IDs. A slide's `purpose` is its semantic role; `designLayout` explicitly selects an existing reference. Without an explicit ID, cover needs a cover reference; other roles may fall back to content. Do not guess IDs or change the semantic role just to bypass a missing reference.

Create with Markdown or structured `slides`:

```js
ppt_create({
  title: "Project results",
  content: "# Project results\n\n## Outcome\n- Monitoring is automated",
  theme: "data",
  lang: "en"
})
```

Use `templateId` with freely composed `layout:"scene"` slides for template-based decks. The template supplies fixed decor and typography; new content need not match sample slots. `ppt_themes` lists built-in themes; `ppt_templates` supplies outline references, not the library template catalog.

DSH delivers HTML, editable PPTX and PDF when export succeeds. Project JSON stays inside the plugin; retain the returned `jsonPath` for editing, but do not attach it or render-cache files by default. Standalone CLI builds retain the portable HTML/PPTX/JSON bundle.

## Deliver by default; review on request

On successful creation/editing, deliver the returned HTML/PPTX/PDF and relevant warnings. Input, save and revision validation already run inside the plugin. Use the exact returned revision and project path; no separate `ppt_check`, render, pixel/metric script or repair cycle is required. Automatic PDF export is not a request for visual review.

Warnings alone do not authorize shortening text, replacing fonts or changing geometry. Fix a concrete blocking error or the defect the user asked to fix. Use `ppt_check {deckPath, slide:5}` only for missing/stale state, unknown target objects or a targeted diagnosis; never guess a revision or discover it through an intentional failure.

Extended review is opt-in. Render only when requested or needed to assess a specific requested fix; validate a render receipt only within that scope. If image viewing is unavailable or fails with a provider/adapter error, immediately disclose that visual inspection was not completed and ask the user to inspect the delivered pages. Do not automatically delegate to subagents or configure another review model; delivery must not wait for that setup.

Structural estimates, rendering and visual inspection are separate results. Static warnings do not prove clipping or its cause, and a check without a receipt does not mean no render exists. Report available font evidence without guaranteeing fonts on an unknown recipient's machine. Never claim visual sign-off without an actual inspection.

Quality reports follow the deck language; some legacy diagnostics remain in Chinese.

## Edit safely

Use the latest returned revision and known target objects. Read the target slide only if that data is missing or stale, then update existing objects by ID:

```js
ppt_check({deckPath, slide:5}) // Only if current target data is missing/stale
ppt_edit({
  deckPath,
  expectedRevision: revision,
  edits: [{slide:5, patch:{elementUpdates:[{
    id:"existing-text-id",
    changes:{paragraphs:[{runs:[{text:"Updated text", style:{color:"#FFFFFF"}}]}]}
  }]}}]
})
```

`elementUpdates` preserves other objects, frames, IDs and drawing order. Supplied fields replace those fields; `textStyle` merges. Preserve unchanged paragraphs/runs when editing part of a text object. IDs must exist and be unique; this mode cannot add/delete objects or change their ID/type.

**`patch.elements` replaces the entire array, including decor.** Supply all complete objects and frames; omitted objects are deleted. `designLayout` does not restore decor during edits. Do not combine `elements` with `elementUpdates`.

Geometry, table dimensions and text-frame margins use integer EMU (914400/inch). Stroke and table-border widths use points, 0–100, default 1; 9525 EMU = 0.75 pt. Font size and paragraph spacing use pt; `lineSpacing` kind `pct` uses a ratio (1 = 100%). Explicit `color` overrides inherited `colorSpec`; when both are explicitly supplied, `colorSpec` wins.

For slide order/duplication/removal and legacy fields, see the [tool reference](../skills/dsh-ppt/references/advanced.md).

## Recover

After an output/transport error, inspect the known project path, revision and content before retrying: the operation may already be saved. Never bypass a stale revision or select a project just because its directory is newest.

Use `ppt_undo {deckPath, expectedRevision}` for unwanted saved edits; inspect each restored version. History retains up to 20 steps. Use `saveAs:true` to rebuild a separate copy from JSON when delivery files changed externally; Office edits are not imported.

`ppt_create overwrite:true` overwrites same-name delivery files but creates a **new project**, ID, revision 0 and empty history. It does not repair the old JSON. Continue with the new `jsonPath`; the old project may report an artifact conflict.

## Setup and details

Install through the DSH Plugin Manager or `dsh plugin --profile web add dsh-ppt`, then restart the host after updates. For standalone use, follow [SKILL.md](../skills/dsh-ppt/SKILL.md).

<a id="可选-png--pdf-渲染"></a>

Optional PNG/PDF rendering uses `@deepseek-ai/libreoffice-kit` (0.2.3 or 0.1.5); generation/editing work without it. Unavailable or failed PDF export must not hide the available HTML/PPTX.

- [Templates](TEMPLATES.md), [fonts](FONTS.md), [editor and downloads](WORKBENCH.md).
- [Images, charts and rendering](../skills/dsh-ppt/references/advanced.md).
- [Source data and simulations](DATA.md), [optional AI visual review](VISUAL.md).
- Installation, configuration, development and licensing: [README](../README.en.md).
