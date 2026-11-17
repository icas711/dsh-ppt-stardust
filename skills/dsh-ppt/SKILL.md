---
name: dsh-ppt
description: "Turn one sentence or a Markdown document into a complete, presentation-ready deck: a standalone HTML web slideshow plus an editable PPTX export, with 5 built-in visual themes (Swiss Pulse / Velvet Standard / Data Drift / Soft Signal / Maximalist Type), slide transitions + bullet entrance animations (motion, on by default), and Chinese/English/Russian UI support. Use when the user asks for a PPT, slides, deck, keynote, presentation, pitch deck, report, proposal, roadshow, training materials, or wants to turn a document into a presentation."
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
- Write the content in the language you author; `lang` only controls the UI text.
- Choose a theme before building; if unsure, use the default `data` theme.
- Go through the "Quality Gate" checklist at the end of this document item by item before delivery.
- Aim for a production-ready deliverable: organize real content first before calling the generator; any unfilled templates must be explicitly marked as drafts—never fabricate missing facts.
- If the render report flags missing fonts, substitute them with fonts available in both the local environment and the recipient's machine, regenerate, and inspect slide by slide; any unresolved font issues must be noted, and the deck cannot be claimed as visually verified.

## Core Pipeline

1. **Probe Requirements**: Read the user's sentence or document to determine the audience, objective, and tone. Do not ask clarifying questions for single-sentence inputs—infer the context directly from the presentation scenario.
2. **Outline**: Produce a 5–12 slide outline (Cover → Problem/Context → Solution/Arguments [3–6 slides] → Evidence → Call to Action → Closing Slide).
   → Read `references/copywriting.md` before writing the outline and body copy.
3. **Theme**: Call `ppt_themes` (in DSH) or run `node scripts/build-deck.mjs --list-themes` (cross-harness).
   → If unsure which theme to pick, consult the mood decision tree in `references/themes.md`.
4. **Build**:
   - Inside DSH: Call `ppt_create`, passing the outline as Markdown via `content` (recommended) or passing structured `slides`.
   - Cross-harness: Run `node <skill-dir>/scripts/build-deck.mjs --title "Title" --content deck.md --theme data --lang en --out dist`.
   - Motion is enabled by default (slide transitions + sequential bullet entrance); pass `motion: 'off'` for formal or print scenarios.
   → Read `references/syntax.md` before using tables, pull quotes, speaker notes, or structured slides.
5. **Verify & Refine**: Call `ppt_check` to inspect specific slides; test slideshow playback, overview mode, and speaker notes in a browser, and verify images/charts. If the optional official engine is available, call `ppt_render` to read the final PPTX and generate per-slide PNGs/PDFs for visual slide-by-slide review. Apply fixes via `ppt_edit` using `expectedRevision` to prevent conflicts; use `ppt_undo` if needed. Re-render after edits and re-verify the current file against its receipt. Passing file header or structural checks does not equal visual sign-off—report static estimates, rendering results, and visual inspection separately.
6. **Deliver**: Provide the user with all three absolute file paths. Explain that the HTML file plays directly in a browser (`←` `→` navigate · `F` fullscreen · `G` overview · `S` speaker notes · `P` print), and the PPTX opens in PowerPoint / WPS / Keynote (speaker notes are visible in Presenter View, and `bullets` slides reveal points on click during playback). DSH users can also edit text, replace PNG/JPEG images, reorder/duplicate/delete slides, undo changes, and download the latest files under "Settings → Presentation"; existing JSON projects must run `ppt_check` first to appear in the project list. `ppt_edit.order` must reference each stable slide ID exactly once; `duplicate` and `remove` use pre-edit slide numbers or stable IDs, preserve images/charts/notes when duplicating, and must leave 1–120 slides total. Structural and text edits can be grouped into a single undo step.

## On-Demand Loading Index

| When to Read | File | Contents |
| --- | --- | --- |
| Before writing outline / body copy | `references/copywriting.md` | Narrative structure, single-slide rules, bilingual rules |
| Unsure which theme to choose | `references/themes.md` | 5 theme color palettes + mood decision tree |
| Using tables / pull quotes / speaker notes / structured slides | `references/syntax.md` | Markdown parsing, advanced syntax, slides JSON, motion toggle |
| Images / charts / templates / branding / editing / rendering | `references/advanced.md` | Parameters, limits, drafts vs. finals, receipt semantics |
| Numerical traceability & live simulation | `references/data.md` | Source bindings, formulas, update previews, offline parameter write-back |
| Delivery issues | `references/troubleshooting.md` | Symptom → resolution lookup table |

## Quality Gate (Verify Item-by-Item Before Delivery)

- [ ] Slide count is 3–60, starting with a cover slide and ending with a closing slide.
- [ ] Every slide has a clear title; `bullets` slides have 1–8 items, with ≤ 20 characters per item in Chinese or ≤ 12 words in English.
- [ ] HTML and PPTX use the same theme with consistent color palettes.
- [ ] Theme colors have sufficient contrast (light text on dark background, or dark text on light background).
- [ ] Chinese copy is free of typos; English titles use Title Case.
- [ ] The final slide includes an actionable Call to Action (CTA), not just a generic "Thank You".
- [ ] Files are written to the user's workspace using absolute paths.
- [ ] No unfilled templates remain; real data sources are preserved, and every slide is visually inspected rather than merely checking build success.
- [ ] Images are embedded properly and charts match the raw data; the render receipt matches the final PPTX, and any unverified aspects are explicitly noted.

