# Data Sources, Formulas, and Live Simulation

Deliver the final deck directly by default. Provide `dataModel` and structured `slides` in `ppt_create` only when numbers require traceability or live simulation. Never guess sources based on matching numerical values, and never fabricate cells, source text, or files.

## Minimal Complete Example

```json
{
  "title": "Business Scenarios",
  "slides": [
    { "layout": "cover", "title": "Business Scenarios", "subtitle": "Baseline Revenue {{base}}" },
    { "layout": "bullets", "title": "Growth {{growth}}", "bullets": ["Projected Revenue {{revenue}}", "The growth rate above is a discussion assumption"] },
    { "layout": "chart", "title": "Revenue Comparison", "chart": { "kind": "column", "categories": ["Baseline", "Scenario"], "series": [{"name": "Revenue", "values": ["{{base}}", "{{revenue}}"]}], "unit": "10K CNY" } }
  ],
  "dataModel": {
    "schemaVersion": 1,
    "sources": [{ "id": "sales", "name": "business_data.csv", "format": "csv", "content": "Item,Revenue\nBaseline,1000" }],
    "metrics": [
      { "id": "base", "label": "Baseline Revenue", "kind": "source", "source": { "sourceId": "sales", "cell": "B2" }, "format": { "digits": 0, "unit": "10K CNY" } },
      { "id": "growth", "label": "Growth Rate", "kind": "input", "value": 0.3, "min": 0, "max": 1, "step": 0.1, "note": "Discussion assumption only, not a performance guarantee", "format": { "style": "percent", "digits": 0 } },
      { "id": "revenue", "label": "Projected Revenue", "kind": "formula", "formula": "base * (1 + growth)", "format": { "digits": 0, "unit": "10K CNY" } }
    ]
  }
}
```

`source` represents facts from source materials, `input` represents adjustable assumptions, and `formula` represents derived calculations. Percentages are calculated as ratios: 30% is `0.3`. Number formats support `number` (default) or `percent`, 0–6 decimal places, and an optional `unit`. Display rounding does not alter the underlying values used in calculations.

Use `{{metricId}}` in body text, bullets, tables, speaker notes, and chart labels; chart values must be standalone placeholders, and calculations always use raw unrounded numbers. Metric IDs must start with a letter, contain only alphanumeric characters, and be at most 48 characters long.

## Sources

- Tables: `format:csv/tsv` + `content`, or `kind:table` + `rows`. Cell addresses range from `A1–Z500`, where the header row counts as row 1. Referenced cells must contain a single numeric value (thousands commas or percent signs are allowed).
- Text materials: `format:text` + `content`, or `kind:text` + `text`. Reference using `{sourceId,line:1,numberIndex:0}`, where line numbers are 1-based and the number index within that line is 0-based. Dates and version numbers may also be parsed as numbers—always verify the exact extraction position.
- Tool calls may explicitly pass `path` to read a regular local file resolved relative to the session `cwd`; the file is read once and embedded without watching for changes. Web browsers can only use content explicitly selected or pasted by the user—never instruct the browser to fetch arbitrary file paths.
- UTF-8 CSV / TSV / TXT / Markdown; up to 8 sources totaling 1 MiB max. Tables allow up to 500 rows / 26 columns with uniform row widths and up to 2,000 characters per cell. Referenced text lines allow up to 8,000 characters. No automatic number extraction from XLSX / PDF.

## Arithmetic & Limits

Up to 80 metrics and 12 inputs (assumptions). Inputs must specify finite `value/min/max/step` values aligned to the range and step grid, with at most 100,000 steps. Computed results must not exceed an absolute value of `1e15`.

Formulas permit metric IDs, parentheses, `+ - * / % **`, unary plus/minus, and `min/max/sum/abs/floor/ceil/round`. In `round(value,digits)`, `digits` must be 0–6. Limits: up to 256 AST nodes, 32 expression nesting levels, and 40 levels of metric dependencies. Circular references, division by zero, unknown metrics, and non-finite results will throw errors. No `eval`, property access, assignment, network requests, or file execution.


## Updates & Confirmation

```js
// 1. Preview first without modifying any deliverables.
ppt_data({ action: 'preview', deckPath, expectedRevision: 0,
  parameters: { growth: 0.5 } })
// Or replace an existing source: sourceUpdates:[{id:'sales',format:'csv',content:'Item,Revenue\nBaseline,1200'}]

// 2. Show changes, affectedSlides, and before/after field diffs to the user, then save upon confirmation.
ppt_data({ action: 'apply', deckPath, expectedRevision: 0,
  parameters: { growth: 0.5 }, confirmed: true, previewToken: preview.token })
```

Applying changes defaults to `saveAs:true`, leaving the original file untouched and creating an undoable copy; `saveAs:false` still enforces external deliverable modification protection. The preview token is bound to the complete project state, data, and revision—any change requires generating a new preview. `ppt_undo` reverts sources, parameters, formulas, and slides atomically.

`ppt_edit` preserves bindings on unmodified fields. Replacing a bound field with plain text removes its binding; keep the placeholder intact if dynamic linking is still required. Confirmed static PPTX exports include the full citation chain in speaker notes and the download report. Optional AI pre-review also receives slide-relevant formula and assumption descriptions, though source linking does not constitute fact-checking.

Offline HTML exports generate a `scenario.json` containing `schemaVersion/deckId/revision/fingerprint/parameters`. Import it back into the same DSH project to preview, confirm, and download the matching static PPTX; it can also be passed via `ppt_data.scenario`. Never force-apply parameters from an old project onto a new copy.

Cross-harness: After running `npm install --ignore-scripts` in the skill directory, run `node scripts/build-deck.mjs --title ... --slides @slides.json --data-model @model.json --out ...`. For direct JS calls, use `buildDeckAsync` from `deck-advanced.mjs`; the synchronous `deck-core.buildDeck` does not support data models.

## Dependencies

CSV parsing uses [csv-parse](https://csv.js.org/parse/api/sync/) 6.1.0 ([MIT](https://github.com/adaltas/node-csv/blob/master/LICENSE)). Formulas are parsed with [jsep](https://github.com/EricSmekens/jsep) 1.4.0 ([MIT](https://github.com/EricSmekens/jsep/blob/main/LICENSE)); the plugin supplies its own restricted evaluator. Dependencies retain their own license notices. Offline HTML embeds the plugin's validated arithmetic representation and runtime, not those parser implementations.

