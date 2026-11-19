# Synthetic PPTX import and rendering fixtures

These public fixtures contain synthetic English text and inert test data. They do not contain material from the user's presentations. `generate.mjs` writes OOXML directly, independently of both the plugin exporter and `@office-kit/pptx`. ZIP timestamps are fixed in local calendar time so fixture hashes remain reproducible across time zones.

| Fixture | Coverage |
|---|---|
| dense | A title and 12 independent text blocks; current six-slot limit and its diagnostic |
| groups | Nested groups with nonzero child origins and nonuniform scaling; flat descendant copies; identical shape names with different IDs |
| typography | Explicit line break, paragraph boundary, bold red run, regular and italic runs |
| artwork | 13 placements of one shared logo asset; image limit and unsupported connector |
| layers | Overlapping red and blue rectangles; decoration order and placement in export |
| objects | Native column chart with cached values 12/8, table with horizontal and vertical merged cells, OLE frame with image preview |

The OLE binary is an inert marker, not an executable or functional embedded document. It tests that arbitrary embedding bytes are not copied to template assets. This does not establish support for opening or editing real OLE documents.

`expectations.json` describes current structural coverage and known losses. Changes that improve coverage must update the corresponding expectations explicitly; known losses must not be mistaken for implemented features. Fixture source structure is checked before testing the importer.

Generate local files:

```sh
node test/fixtures/pptx/generate.mjs
node --test test/pptx-synthetic-import.test.mjs test/pptx-synthetic-runner.test.mjs
```

Portable rendering (Node 22.19.0, Python 3.12):

```sh
# Run inside test/fixtures/pptx/render-runtime:
npm ci --ignore-scripts --omit=optional --no-audit --no-fund
# Then run from the repository root:
python -m pip install -r test/fixtures/pptx/requirements-render.txt
npm run test:pptx-render
```

The separate runtime lockfile pins LibreOffice kit and WASM 0.2.3 and their dependencies. The command forces WASM on every host and uses only the four bundled Liberation Sans fonts. It does not use system font discovery or require PowerPoint. Missing dependencies/fonts, a changed input identity or a rendering regression fail the command; there is no successful skip. The CI job runs on Linux and Windows and uploads `.test-output/pptx-synthetic-render/` even on failure.

`render-baselines/` contains source and generated PNGs from the same WASM engine, font hashes, source PPTX hashes and initial source-vs-output metrics. Both full images and generated content regions must match reviewed baseline images with SSIM >= 0.999. Source-vs-output SSIM is reported separately; known losses still make full fidelity FAIL. This regression contract does not replace the native PowerPoint golden test.

To approve an intentional visual change, inspect source/actual/overview/diff images and update structural expectations, then explicitly run:

```sh
node scripts/golden-pptx-synthetic.mjs --record
npm run test:pptx-render
```

Review baseline images and manifest in the diff. CI refuses `--record`. `DSH_PPT_RENDER_RUNTIME`, `DSH_PPT_SYNTHETIC_OUT` and `DSH_PPT_GOLDEN_PYTHON` can select a separate installed runtime, artifact directory and Python executable.

Additional capability probes use the same portable runtime:

```sh
node scripts/probe-pptx-charts.mjs --render
node --expose-gc scripts/benchmark-pptx-import.mjs --render
```

The chart probe verifies eight native variants, embedded XLSX values and visible updates; it also runs in the rendering CI job. Capacity measurements are diagnostic and have no timing assertions. The planned scene contract and current support matrix are documented in `docs/SLIDE-MODEL.md`.

## Fonts and license

The unmodified `LiberationSans-*.ttf` files and `LICENSE_LIBERATION` are redistributed from `pdfjs-dist@5.6.205/standard_fonts`. They are licensed under SIL Open Font License 1.1; copyright and reserved-name notices are in `fonts/LICENSE_LIBERATION`. Their SHA-256 hashes are recorded with the rendering baseline. These files are test assets and are not included in the published plugin's `files` list.
