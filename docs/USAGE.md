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

## Check and deliver

1. Run `ppt_check {deckPath}` for revision, slide IDs and all warnings. Add `slide:5` to read a complete `selectedSlide` before editing.
2. When available, run `ppt_render {pptxPath, format:"both"}` for actual PPTX pages/PDF and font diagnostics. Pass its `receiptPath` as `renderReceipt` to `ppt_check` to verify the current files. Edits invalidate old receipts.
3. Inspect rendered pages where image viewing is available. If viewing is unavailable or fails with a provider/adapter error, immediately disclose that visual inspection was not completed and ask the user to inspect the delivered pages. Do not automatically delegate to a subagent or configure another review model. Deliver available files with the limitation stated.

Generation, structural checks, rendering and visual inspection are separate results. Static warnings do not prove clipping or explain its cause. A check without a receipt does not mean no render exists. Check embedded template/library fonts and actual `missingFonts`; never guarantee a font exists on an unknown recipient's machine or silently replace the requested template font.

Quality reports follow the deck language; some legacy diagnostics remain in Chinese.

## Edit safely

Read the current revision and target slide, then update existing scene objects by ID:

```js
ppt_check({deckPath, slide:5})
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
