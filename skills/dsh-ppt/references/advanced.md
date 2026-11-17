# Images, Charts, Project Editing, and Rendering

The agent prepares the actual content first, then generates a playable HTML slideshow and an editable PPTX. Users do not need to write JSON manually. Below is the tool interface reference.

## Creation

`ppt_templates` provides four structural references: `weekly`, `defense`, `project`, and `pitch`. Using `template` alone in `ppt_create` generates an unfilled draft and returns `deliveryStatus:draft`; you must supply completed `content` or `slides` before starting final deliverable verification.

**Template Library** (see `docs/TEMPLATES.md` in the repository for details): `ppt_template` manages templates across three tiers (`builtin` / `public` / `user`; `create-from-pptx` extracts styles and skeleton from a sample PPTX, `create-from-project` creates from an existing project, `import`/`export` handles ZIP bundles, and `publish` requires administrator privileges). `ppt_create` accepts `templateId` to generate a skeleton draft using a template's styling and structure; `ppt_template { operation: 'apply-to-project', deckPath, templateId }` restyles an existing project's appearance only (theme, branding, and slide backgrounds; undoable). Equivalent CLI flags are `--template-file`, `--restyle`, and `--create-template-from-pptx/deck --save-template`. Template backgrounds are applied by slide type (`cover`/`section`/`content`/`closing`); templates without custom backgrounds work fully in any environment.

`slides` supports `image`, `image-left`, `image-right`, and `chart` layouts. Image example: `{layout:"image-left",title:"New Workflow Is Shorter",image:{src:"assets/flow.png",alt:"Screenshot of the new workflow",fit:"contain"},bullets:["Generate directly","Edit specific slides"]}`. Local PNG/JPEG paths are resolved relative to the session `cwd`, and data URIs are also supported; limits are 5 MiB / 32 megapixels per image and 32 MiB total. Images are embedded into the project and output files, so they remain intact even if the original source files are moved. `contain` fits the entire image inside the frame, while `cover` crops from the center. External URLs and SVGs must first be prepared by an explicitly authorized tool—they are never downloaded automatically.

Chart example: `{layout:"chart",title:"Monthly Completions Keep Rising",chart:{kind:"column",categories:["July","August","September"],series:[{name:"Completions",values:[3,5,9]}],unit:"items"}}`. Supported chart kinds are `column`, `bar`, `line`, and `pie`; data can also be passed via `rows` with a header row. Category and value array lengths must match, and all values must be finite numbers; `pie` charts allow only one non-negative series with a positive sum. Native PPTX charts include an embedded editable data workbook, while HTML renders an SVG chart alongside an accessible data table for screen readers.

Shared branding is configured via `brand:{primaryColor:"#2C9F87",fontFamily:"Arial",logo:"logo.png",footer:"Product Team · 2026"}`. You can also specify background/text colors and `name`. Choose fonts available on the recipient's machine; font diagnostics will not install missing fonts automatically.


## Editing & Undo

First, run `ppt_check {deckPath:"report.json"}` to retrieve the current `revision` and slide IDs. To edit: `ppt_edit {deckPath:"report.json",expectedRevision:0,edits:[{slide:3,patch:{title:"New Title",bullets:["Fact One","Action"]}}]}`. `slide` accepts a 1-based slide index or a stable slide ID, while all other slides remain unchanged; targeting the same slide multiple times in one call is rejected. `brand` can be updated independently; pass `brand:null` to clear branding, `logo:null` to remove the logo, or an empty `footer` string to clear the footer.

Duplicating & Removing: `ppt_edit {deckPath:"report.json",expectedRevision:0,duplicate:[2],remove:[3]}`. Both arrays resolve against pre-edit 1-based slide indices or stable IDs; duplicated slides are inserted immediately after their originals, receive new IDs, and retain images, charts, and speaker notes. A slide cannot be duplicated and removed in the same operation, nor specified twice, and the final deck must contain 1–120 slides. These operations can be combined with `edits` and `order` in a single call—edits and reordering are applied first, followed by duplication and removal; `order` must still include each original slide ID exactly once.

Edits atomically update the entire HTML/PPTX/JSON set and roll back on failure. Undo history retains up to 20 steps. `ppt_undo {deckPath:"report.json",expectedRevision:1}` restores the previous state, including slide structure, images, charts, and branding; `revision` continues incrementing forward, and stale modifications cannot overwrite an undone state. Only JSON projects created by this plugin can be edited—arbitrary external PPTX files cannot be imported for editing. If a table expands to the point of requiring pagination, you will be prompted to generate a new deck instead.


## Inspection & Rendering

`ppt_check` identifies slide-level issues, including content density, estimated text overflow, 14pt font sizing on 7–8 column tables, missing/corrupted/low-resolution images, chart label overlap, and color contrast. Native tables with up to 6 columns use 17pt font sizing. Static estimation does not guarantee exact font metrics or final visual layout.

Optionally install `npm install --ignore-scripts @deepseek-ai/libreoffice-kit@0.2.3` (bundled with DSH 0.2.2+; 0.1.5 is also compatible). Windows also requires the matching architecture's VC++ v14 runtime. Run `ppt_render {pptxPath:"report.pptx",format:"both"}` to read the final PPTX and output PNGs, PDF, and a render receipt without modifying the source file. Defaults: `format` is `"png"`, `width` is `1440` (range `320–3840`), and `timeoutMs` is `120000` (range `1000–300000`). Limits: up to 120 slides, 64 MiB input size, 128 MiB total output size, and 16 MP per image. If the rendering engine is missing, it returns `unavailable` along with installation instructions, while standard deck generation remains unaffected.

Inspect every rendered PNG as well as the HTML slideshow, and verify editability, speaker notes, and animations in PowerPoint or WPS when necessary. LibreOffice does not guarantee pixel-for-pixel parity with Microsoft Office, and PNG/PDF outputs do not preserve animations. A successful render still carries the status `visual:not-verified`—never automatically claim visual inspection has passed.

Pass the returned `receiptPath` to `ppt_check {deckPath:"report.json",renderReceipt:".../render-receipt.json"}`. The checksums of the source file and all outputs must match; any subsequent modification or deletion invalidates the receipt, requiring a re-render. The receipt serves as a local integrity record, not a cryptographic signature.


## CLI

`--slides @slides.json`、`--brand @brand.json`、`--template weekly`。

`--edit report.json --edits @edits.json --revision 0`、`--undo report.json --revision 1`。

`--check report.json`、`--render report.pptx --format both`、`--check report.json --render-receipt receipt.json`。

By default, the render output directory is created next to the PPTX file; passing `--out` explicitly specifies the base directory, appending a suffix if the directory already exists. An unavailable rendering engine, static validation errors, or an invalidated explicit receipt will return a non-zero exit code.

