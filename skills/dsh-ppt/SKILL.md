---
name: dsh-ppt
description: "Turn one sentence or a Markdown document into a complete, presentation-ready deck: a standalone HTML web slideshow plus an editable PPTX export. Uses the template already selected by the user; otherwise lists installed templates and helps choose one; slide transitions + bullet entrance animations; Chinese/English/Russian UI. Use when the user asks for a PPT, slides, deck, presentation, pitch deck, report, proposal, training materials, or wants to turn a document into a presentation."
compatibility: "Node ^22.19.0 or >=24.0.0. Images/charts use @office-kit/pptx@0.21.0; optional data models use jsep@1.4.0 and csv-parse@6.1.0. Optional PNG/PDF renderer: @deepseek-ai/libreoffice-kit@0.2.3 (bundled by DSH 0.2.2+; 0.1.5 also supported). Cross-harness: copy the full directory and run npm install --ignore-scripts there."
allowed-tools: "Bash, Read, Write, Edit"
---

# dsh-ppt

Turn one sentence or a document into a complete presentation: **standalone HTML web slideshow + editable PPTX**. This file handles routing and rules only; read `references/` on demand for specific guidelines.

## Trigger Conditions

The user wants to create a PPT / slides / presentation / deck / report / proposal / pitch deck / roadshow / training materials, or wants to turn a single sentence, a snippet of text, or a Markdown file into a playable presentation.

## Execution Rules (Must Always Be Followed)

- Deliver the final output directly by default without automatically triggering AI pre-review or defense/rehearsal modes. Users can manually enable these two optional modes in the download section of the settings page, selecting the model, scope, and call limit before submitting materials. AI rehearsal does not substitute for fact-checking—never fabricate experiments, data, or citations; save adopted suggestions as a new copy while keeping the original intact.
- When the user needs AI visual inspection, they can manually enable it via DSH Settings → Presentation → Visual Inspection & Repair. This requires a vision-capable model and the official rendering engine; repairs only adjust layout, save as a new copy, and re-verify. The absence of AI-detected issues does not equal human sign-off; any model call failures, output truncations, interruptions, or uninspected slides must be explicitly reported—never claim visual inspection passed if it did not.
- Enable numerical traceability and live simulation on demand. Provide `dataModel` and structured `slides` with `{{metricId}}` bindings; read `references/data.md` first. Source facts must correspond to actual rows or cells in the source material; mark user assumptions with `kind:input`, and never fabricate sources. To modify data, run `ppt_data(action:preview)` first, display the metric and slide diffs, and save only after receiving confirmation along with the original preview token and revision number (saving as a new copy by default). Offline HTML parameters must be saved back and confirmed before delivering the corresponding static PPTX.

- Run `ppt_check` before modifying an existing project. Externally edited HTML/PPTX files or legacy projects lacking a build verification record must not be overwritten; inform the user that `saveAs:true` saves a new copy solely from the JSON source while keeping the original intact, and manual edits made in Office will not be imported. Never bypass verification or manually tamper with checksums.

- One idea per slide; titles must be declarative statements (assertions), not noun phrases.
- Write the content in the language you author; `lang` only controls the UI text. Always set `lang` explicitly to match the user's conversation language — `ru` is fully supported (player UI, presenter window, PPTX kickers, ru-RU number format), as are `zh`, `en`, and `bilingual`.
- Build on the template already specified by the user or established in this session. Do not ask them to choose it again. If no template is selected, list installed templates with `ppt_template { operation: "list" }` and ask via the ask-user tool (`ask_user_question` in DSH). If the user delegates the choice, or the tool is unavailable, choose a suitable template from that actual list and state the choice. Never invent a fallback template key. If no templates are available, explain that a reference/bundle must be imported first. Never offer or select the five built-in visual themes (swiss / velvet / data / soft / bold) and never pass `theme` to `ppt_create` — the visual style comes from the chosen template; bare themes are an engine fallback, not a choice.
- Go through the "Quality Gate" checklist at the end of this document item by item before delivery.
- Aim for a production-ready deliverable: organize real content first before calling the generator; any unfilled templates must be explicitly marked as drafts—never fabricate missing facts.
- If the render report flags missing fonts, substitute them with fonts available in both the local environment and the recipient's machine, regenerate, and inspect slide by slide; any unresolved font issues must be noted, and the deck cannot be claimed as visually verified.

## Core Pipeline

1. **Probe Requirements**: Read the user's sentence or document to determine the audience, objective, and tone. Do not ask clarifying questions for single-sentence inputs—infer the context directly from the presentation scenario.
2. **Outline**: Preserve the requested slide count and sequence. A one-slide task means one slide, with no extra cover or closing. When the count is unspecified, propose a concise outline suited to the material; add cover/closing only when useful.
   → Read `references/copywriting.md` before writing the outline and body copy.
3. **Select Template**: Use an already selected `templateId` directly and call `ppt_template get`. Otherwise list the installed templates and resolve the choice as above. Only actually listed builtin/public/user keys are available. An error loading the selected template requires resolving that error; do not silently switch templates.
   → Read `references/templates.md` for template keys, outline skeletons, and per-slide `layoutId`.
4. **Build**:
   - Inside DSH: Call `ppt_create` with the chosen `templateId`, for schema 3 use `get` descriptions → `validate-plan` → `deckPlan`; for legacy templates pass Markdown `content` or structured `slides`; do not pass `theme` and do not call `ppt_themes`.
   - Cross-harness: Run `node <skill-dir>/scripts/build-deck.mjs --title "Title" --content deck.md --template-file <bundle.zip> --lang en --out dist` (there is no template library — export a bundle first; `--theme` is a legacy fallback).
   - Motion is enabled by default (slide transitions + sequential bullet entrance); pass `motion: 'off'` for formal or print scenarios.
   → Read `references/syntax.md` before using tables, pull quotes, speaker notes, or structured slides.
5. **Verify & Refine**: Call `ppt_check` to inspect specific slides; test slideshow playback, overview mode, and speaker notes in a browser, and verify images/charts. If the optional official engine is available, call `ppt_render` to read the final PPTX and generate per-slide PNGs/PDFs for visual slide-by-slide review. Apply fixes via `ppt_edit` using `expectedRevision` to prevent conflicts; use `ppt_undo` if needed. Re-render after edits and re-verify the current file against its receipt. Passing file header or structural checks does not equal visual sign-off—report static estimates, rendering results, and visual inspection separately.
6. **Deliver**: Inside DSH, provide only the absolute `htmlPath`, `pptxPath` and `pdfPath` (when present). PDF is exported automatically from the final PPTX; when unavailable or failed, deliver HTML/PPTX and explain `pdfWarning`. Never attach the project JSON, page PNGs, manifests or render receipts by default. New project JSON files are kept permanently in `DSH_HOME/plugins/dsh-ppt/projects`; use the returned `jsonPath` internally for editing, checks and undo. Render files live in `DSH_HOME/plugins/dsh-ppt/tmp` and expire after 90 days without use; cleanup runs on plugin startup and before a new cached render. Old projects are not migrated. HTML plays offline in a browser and PPTX opens in PowerPoint / WPS / Keynote. In DSH, the latest deliverables are also available under Settings → Presentation. Cross-harness CLI builds retain the portable HTML/PPTX/JSON trio unless explicitly configured for internal project storage. Session isolation: use the exact paths returned by this invocation. Do not scan a shared workspace, plugin projects directory or global tmp to discover your outputs; those may contain other chats' files. With a host session ID, default deliveries use `<cwd>/dsh-ppt/session-<hash>` and render caches use `tmp/session-<hash>`. Put any requested evaluation records/logs in the returned `outputDir`, and attach only files created for the current request. Do not enumerate all files in cwd for delivery. Explicit separate output directories remain supported; avoid selecting a shared directory unless the user requested it.


## On-Demand Loading Index

| When to Read | File | Contents |
| --- | --- | --- |
| Before writing outline / body copy | `references/copywriting.md` | Narrative structure, single-slide rules, bilingual rules |
| Choosing or applying a template / its layouts | `references/templates.md` | Template keys, outline skeleton, `layoutId`, restyling, fallback rule |
| The user explicitly asks about the five visual themes | `references/themes.md` | 5 theme palettes + mood decision tree (legacy engine fallback) |
| Using tables / pull quotes / speaker notes / structured slides | `references/syntax.md` | Markdown parsing, advanced syntax, slides JSON, motion toggle |
| Images / charts / templates / branding / editing / rendering | `references/advanced.md` | Parameters, limits, drafts vs. finals, receipt semantics |
| Numerical traceability & live simulation | `references/data.md` | Source bindings, formulas, update previews, offline parameter write-back |
| Delivery issues | `references/troubleshooting.md` | Symptom → resolution lookup table |

## Quality Gate (Verify Item-by-Item Before Delivery)

- [ ] Slide count is 3–60, starting with a cover slide and ending with a closing slide.
- [ ] Every slide has a clear title; `bullets` slides have 1–8 items, with ≤ 20 characters per item in Chinese or ≤ 12 words in English.
- [ ] HTML and PPTX use the same theme with consistent color palettes.
- [ ] The deck was built with the user-selected template (`templateId`); no bare built-in theme was used.
- [ ] Theme colors have sufficient contrast (light text on dark background, or dark text on light background).
- [ ] Chinese copy is free of typos; English titles use Title Case.
- [ ] The final slide includes an actionable Call to Action (CTA), not just a generic "Thank You".
- [ ] Files are written to the user's workspace using absolute paths.
- [ ] No unfilled templates remain; real data sources are preserved, and every slide is visually inspected rather than merely checking build success.
- [ ] Images are embedded properly and charts match the raw data; the render receipt matches the final PPTX, and any unverified aspects are explicitly noted.



## Structured slides and semantic diagrams

Use `layout:scene` with `elements` when a slide needs several independent blocks, charts or tables. Geometry is integer EMU (914400 EMU/inch); preserve the original `style.pageSize` for print and screen decks. Do not force 16:9. The `elements` array is drawing order. Every object has a stable ID; edits replace `elements` while retaining IDs of unchanged objects. Text uses paragraphs, runs and explicit breaks; preserve bold, colour and alignment on the relevant runs/paragraphs.

For schema 3 library templates, inspect `ppt_template get` and fill `templateSelections:[{layoutId,values:{slotId:value}}]`. Select structure variants explicitly. Text accepts strings or paragraphs, images reference an embedded asset ID, charts and tables accept typed data. Do not distribute a long bullet list positionally across slots. Omitted required slots remain a draft. When switching layouts, preserve unmatched content and report the unmapped objects.

A list may become a diagram only when its semantics justify the choice:

- Ordered actions → `layout:diagram`, `diagram:{kind:process,items:[{id,label,detail}]}`.
- Explicit dates and milestones → `kind:timeline`, with `date` on each item in the supplied order.
- Alternatives with comparable attributes → `kind:comparison`.
- Explicit parent/child relationships → `kind:hierarchy`, with `parentId`.
- Explicit links between entities → `kind:relationship`, with `links:[{from,to}]`.
- Actual quantitative categories and series → `kind:chart`, with `chart:{kind,categories,series:[{name,values}]}`. No invented numbers, equal weights or fake proportions to make a diagram look quantitative.

For new semantic input always set `diagram.version:2`. Process requires `ordered:true`; timeline also requires valid ISO dates/months in supplied order; cycle requires `repeats:true`. Process, timeline, cycle and relationship support at most 6 nodes; split longer sources explicitly. Cards and hierarchy support up to 12 items. Comparison requires 2–4 alternatives, 1–8 shared `criteria` and matching `values` strings/nulls. KPI requires 1–6 finite values with units; deltas need explicit values and units. Quote and number require exactly one item and a `source`; number also requires a value and unit. Never invent attribution or data.

Keep every supplied label/detail/date. Diagrams are native editable shape/text/line objects, not screenshots or SmartArt. Native charts contain embedded Excel workbooks. Confirmed variants: column, bar, line, pie, doughnut, area, stacked-column, percent-stacked-bar; scatter is unsupported. Pie/doughnut need parts of one whole; line needs meaningful order; stacking needs additive comparable data. A regular list remains a list when relationships are unknown. Choosing a template must not replace explicitly supplied scene/diagram content with sample slides.

For multi-slide generation with a schema 3 template, prefer `deckPlan` over positional filling. Inspect `ppt_template get` descriptions, then call `ppt_template` with `operation:'validate-plan'`, the template ID and the proposed plan. Each row supplies `id`, `variantId`, `intent`, `structure`, and `values` keyed by slot ID; optional `sources`, `evidence` and `visual:{slotId,diagram}` supply explicit semantic grounds. Visual generation is allowed only inside a compatible independent text region. Fill native chart/table/image slots with typed values. Do not combine `deckPlan` with slides/content/templateSelections/dataModel. Optional `generationPolicy` configures warnings, not automatic changes. `minSlides` is the threshold for checking rhythm, not a minimum allowed deck length. A one-slide task works with the default policy; do not set `minSlides:1` merely because the request has one slide. Keep supplied material IDs in `sources`; do not invent IDs or provenance.

Fix validation errors before create. Review capacity and rhythm warnings without silently changing content, order, chart type or font size. Alternatives include explicit slot mappings; do not apply them invisibly. Report limited template variety instead of inventing content. Capacity estimates are heuristic; hard limits are enforced. The saved generation report becomes stale after edits. Use `ppt_edit restoreRepresentation:'list'` or `'visual'` only as an explicit rebuild; it has undo and preserves the semantic source. HTML overflow checks do not establish PowerPoint fit: render the exported PPTX before claiming visual acceptance.

`ppt_edit convertToScene:true` explicitly migrates a legacy project and all history snapshots. It aborts without writing when bindings or unsupported content cannot be preserved. Mixed legacy content fields and `elements` on one slide are errors, including empty legacy fields. Do not remove fields merely to bypass that error.

Treat import warnings as object-specific limitations, not success: report slide, object ID/name, preservation mode and reason. OLE attachments are never executed or copied into assets; only validated raster previews may be retained. HTML chart previews preserve data but do not guarantee Office chart typography/layout parity. Render the PPTX before claiming visual fidelity.
