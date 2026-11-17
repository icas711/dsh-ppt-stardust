# dsh-ppt Input Syntax Reference (Markdown / Structured Slides / Motion)

Consult this file only when looking up specific syntax rules; standard workflows are covered in `SKILL.md`.

## Markdown Parsing Rules

`ppt_create` and `build-deck.mjs` parse Markdown according to the following rules:

- The first `# Heading` becomes the cover slide title; any immediately following paragraphs or lists are used as the cover subtitle.
- Each `## Section` (or deeper heading) generates a single slide:
  - Contains a `- ` / `* ` / `1.` list → `bullets` slide;
  - Contains neither a list nor body text → `section` divider slide;
  - Contains body paragraphs → sentences are split and converted into bullets.
- Plain text without headings: The first sentence of the first paragraph becomes the cover subtitle, and subsequent paragraphs are split into bullet slides in groups of 5 sentences.
- Single-sentence input: Automatically generates a three-slide sequence: "Cover → Core Statement → Closing Slide".
- When finer layout control is required, use structured `slides` JSON—do not mix it with Markdown.

## Advanced Syntax (Auto-Detected)

- **Tables**: Consecutive `| Col | Col |` rows (with a `| --- | --- |` separator on the second line) → standalone `table` slide (theme-colored header; up to 8 data rows per slide, with longer tables automatically continuing onto new slides with repeated headers; max 8 columns and 60 characters per cell—exceeding limits throws an error). Prefer tables over dense bullet lists for data comparisons.
- **Pull Quotes**: `>` blockquotes → standalone `quote` slide; ending the final line with `—— Attribution` (or `-- Attribution`) sets the quote attribution.
- **Speaker Notes**: `<!-- note: Content to speak on this slide -->` (also supports `<!-- 备注: ... -->`) attaches speaker notes to that slide. Notes are excluded from slide body content: press `S` during HTML playback to toggle the notes panel, and in PPTX they are written to native speaker notes (visible in Presenter View). Proactively write speaker notes for reports and live talks (metric definitions, data sources, Q&A talking points).

## Structured `slides` (Advanced Usage)

The `slides` parameter in `ppt_create` and the `--slides` CLI flag accept a JSON array:

```json
[
  { "layout": "cover", "title": "Title", "subtitle": "Subtitle", "kicker": "Opening", "notes": "Start with a 30-second self-introduction" },
  { "layout": "section", "kicker": "01", "title": "Background" },
  { "layout": "bullets", "title": "Three Key Arguments", "bullets": ["Point One", "Point Two", "Point Three"] },
  { "layout": "table", "title": "Performance Comparison", "rows": [["Region", "Revenue"], ["East China", "\$12M"]], "notes": "Highlight growth rate in East China" },
  { "layout": "quote", "title": "Slow is smooth, smooth is fast.", "subtitle": "Founder" },
  { "layout": "statement", "title": "Core Takeaway in One Sentence", "subtitle": "Supporting context" },
  { "layout": "closing", "title": "Thank You", "subtitle": "Call to Action" }
]
```

`layout` supports `cover | section | bullets | statement | quote | table | closing | image | image-left | image-right | chart`; each slide accepts an optional `notes` field, and tables use `rows` (with the first row serving as the header). Structured tables paginate automatically, with speaker notes placed only on the first page. If pagination causes the total slide count to exceed `maxSlides`, an error is thrown (maximum 120 slides). For images, charts, branding, and per-slide editing, see `advanced.md`.

## Motion (`motion`)

Defaults to `motion: on`: HTML playback features cross-fade slide transitions and sequential bullet entrance animations; PPTX includes native fade transitions on every slide, and `bullets` slides reveal points one by one on click during playback. Pass `motion: 'off'` (CLI `--motion off`) for formal/print scenarios or when the user explicitly requests a static deck—the generated output will contain zero animation code.

