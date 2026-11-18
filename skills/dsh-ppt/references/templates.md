# Templates (Layouts)

Templates are the only sanctioned visual source for a deck. The five built-in
themes (swiss / velvet / data / soft / bold) are an engine fallback — never
offer them, never pass `theme` to `ppt_create` when a `templateId` is used.

## Template keys

| Prefix | Source | Notes |
| --- | --- | --- |
| `builtin:<id>` | Ships in the package (`corporate-report`, `dark-pitch`) | Always available; read-only unless an admin saves an override |
| `public:<id>` | Library, visible to everyone | Publish/delete is admin-only |
| `user:<id>` | The session owner's private library | Created via `ppt_template` or the panel |

## What a template carries

- **Style**: theme reference, brand palette (`primaryColor` / `backgroundColor` /
  `textColor`), font, logo, footer, per-page-type backgrounds
  (`cover / section / content / closing`), and optional layouts
  `style.layouts[]` (each: background image/color, positioned images with
  `z` order, `textZones`). Up to 16 layouts, up to 12 images per layout;
  coordinates are percent of the slide.
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

1. `ppt_template { operation: "list" }` — enumerate installed templates.
   Ask the user via the ask-user tool which one to use (corporate options
   first); fall back to `builtin:corporate-report` only when there is no
   ask-user tool or no answer, and say so.
2. `ppt_create { title, templateId, content | slides }` — build with real
   content in the template style. A `templateId` without content/slides
   produces an **unfilled draft** (quality issue `template-unfilled`) — never
   deliver it as final. Pass `templateSamples: false` to drop the sample
   slides when you supply your own content.
3. Fine-tuning: outline slides may set `layoutId` to pick a specific layout;
   edit later with `ppt_edit` (`patch.layout`, `patch.layoutId`).
4. Restyling an existing project (keeps content, swaps style, undoable):
   `ppt_template { operation: "apply-to-project", deckPath, templateId }`;
   add `saveAs: true` for a copy.

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
