# Templates (Layouts)

Before every new deck, use `ask_user_question` and keep asking until the task is clear. Always confirm the template, even when supplied, and clarify content. With no installed templates, confirm visual style and use `brand` plus scene `slides`. If the question tool is unavailable or unanswered, stop before generation.

Before template choice, call `ppt_template list` and offer every returned template with its actual name and exact key, including all personal templates. Recommendations may reorder the complete list, never remove entries. Do not replace an installed template with a custom-style option. If option limits apply, split the list into questions or ask for a group followed by the complete list in that group. Ask only about style when the library is empty. Use current list results rather than remembered template availability.

## Template keys

| Prefix | Source | Notes |
| --- | --- | --- |
| `builtin:<id>` | Bundled templates returned by `list` | Availability depends on the installation; read-only unless an admin saves an override |
| `public:<id>` | Library, visible to everyone | Publish/delete is admin-only |
| `user:<id>` | The session owner's private library | Created via `ppt_template` or the panel |

## Scene templates (schema 3)

Inspect `get` for page size, artwork, palette and typography. Normally pass `templateId` + scene `slides` with freely composed text, shapes, tables and charts. Set `purpose` to select a matching reference, or explicitly set an existing `designLayout`. The engine preserves fixed decor/backgrounds and discards sample content. The first text element inherits title defaults, later elements body defaults; explicit styles override defaults. Content slides use a content reference, not a cover reference. Two reference pages are enough for a complete deck.

Slots and variant descriptions remain compatibility metadata. Use `deckPlan` → `validate-plan` or `templateSelections` only when the task explicitly requires fixed-slot filling. These are mutually exclusive with free scene slides. No additional variants or rhythm quotas are required for normal generation.

## Legacy templates (schema 1/2)

- **Style**: theme reference, brand palette (`primaryColor` / `backgroundColor` /
  `textColor`), font, logo, footer, per-page-type backgrounds
  (`cover / section / content / closing`), and optional layouts
  `style.layouts[]` (each: background image/color, positioned images with
  `z` order, `textZones`). Up to 120 layout variants, up to 12 images per layout;
  coordinates are percent of the slide. `style.pageSize` stores exact physical dimensions in EMU; preserve these for print and screen decks. PPTX import uses actual slides, groups common artwork with `familyId`, and replaces content with positioned title/body/image areas. Unused internal layouts are excluded; losses are listed by object, source, affected slides and reason.
- **Typography**: `style.textStyles` supplies default role styles; each layout
  can override them with `textStyles`. Roles are `title`, `subtitle`, `body`,
  `kicker`, `footer`, `caption`, `quote`, `attribution`, `table`. Each role stores
  `fontFamily`, `size` (points), `bold`, `italic`, and `color` (`#RRGGBB`). Import
  resolves theme major/minor fonts and inherits master → layout → first source
  slide using that layout. Mixed runs and list levels become role defaults;
  they are not preserved as individually editable source text blocks.
- **Embedded fonts**: `style.fonts[]` stores `{family, variant, file}` with
  `regular / bold / italic / boldItalic` variants. Files live in `assets/` in
  the template ZIP; supported formats are TTF, OTF and EOT/MTX `.fntdata`.
  Originals survive template import/export and EOT re-embedding; browser
  previews use decoded sfnt via `@font-face`, without system installation or
  network requests. Raw sfnt is wrapped in uncompressed EOT for PowerPoint.
  Fonts have separate limits: 12 MiB per file, 32 MiB combined. Image limits
  remain 5 MiB per file / 8 MiB combined; unpacked bundles are capped at 64 MiB.
  Only source-PPTX embedded files are imported. Missing files, font permission
  bits (`fsType`), corrupt fonts and subset fonts produce import warnings.
  Restrictions are reported without blocking import; subset fonts may lack
  characters needed by new content. No system-font lookup is performed.
- **Outline skeleton**: pages with placeholders ("To fill: …") and a
  `layoutId` per slide pointing at a `style.layouts[]` entry; without it the
  first layout of that page type applies.
- **Sample slides** (optional): examples in the template's style.

## Workflow

1. List installed templates, then call `ask_user_question` with the complete returned template choice and clarify content. Wait for answers, including when a template was already specified. If none are installed, ask about style instead.
2. Inspect the selected template with `get`; compose substantive content in its style. For schema 3 pass `templateId` + scene `slides`; do not generate placeholders or append sample pages.
3. Check and render the result; inspect actual pages and correct layout issues. Report unresolved rendering limitations.
4. Existing fixed-slot filling and `apply-to-project` remain available for compatible editing workflows.

## Cross-harness (no library)

There is no template store outside DSH. Export a ZIP bundle first
(`ppt_template { operation: "export" }` or the CLI `--export-template`), then
build with `node <skill-dir>/scripts/build-deck.mjs --template-file
<bundle.zip> …`. The CLI `--theme` flag is a legacy fallback.

## Creating templates

`create-from-pptx` extracts palette/fonts/backgrounds/layouts and the title
outline from an example PPTX; `create-from-project` converts an existing deck.
Both require admin-free `newTemplateId` and store into the caller's library;
publishing to public is admin-only.
