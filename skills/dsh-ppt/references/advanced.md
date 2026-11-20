# Images, Charts, Project Editing, and Rendering

The agent prepares the actual content first, then generates a playable HTML slideshow and an editable PPTX. Users do not need to write JSON manually. Below is the tool interface reference.

## Creation

For free scene composition, first read `ppt_template get` and map semantic roles to actual reference IDs before writing the full `slides` array. An explicit `designLayout` wins and may have a different purpose. Without it, selection uses an exact purpose match, then the first content reference for non-cover slides only. Cover has no automatic fallback. If the chosen title reference is tagged content, use its known ID with `purpose:"cover"`; do not change the semantic role or guess an ID. Imported references may all be tagged content. Closing/section may reuse content automatically; set an ID to select a particular design. A composition-reference error lists the requested role and available IDs/names/purposes.

`ppt_templates` provides four structural references: `weekly`, `defense`, `project`, and `pitch`. Using `template` alone in `ppt_create` generates an unfilled draft and returns `deliveryStatus:draft`; you must supply completed `content` or `slides` before starting final deliverable verification.

**Template Library** (see `docs/TEMPLATES.md` in the repository for details): `ppt_template` manages templates across three tiers (`builtin` / `public` / `user`; `create-from-pptx` extracts styles and skeleton from a sample PPTX, `create-from-project` creates from an existing project, `import`/`export` handles ZIP bundles, and `publish` requires administrator privileges). `ppt_create` accepts `templateId` to generate a skeleton draft using a template's styling and structure; `ppt_template { operation: 'apply-to-project', deckPath, templateId }` restyles an existing project's appearance only (theme, branding, and slide backgrounds; undoable). Equivalent CLI flags are `--template-file`, `--restyle`, and `--create-template-from-pptx/deck --save-template`. Template backgrounds are applied by slide type (`cover`/`section`/`content`/`closing`); templates without custom backgrounds work fully in any environment.

Use compositionGuides from ppt_template get: choose the actual title/body reference, consider text anchors, typography, decor, real pictures, captions and neighboring blocks, then choose sizes and wrapping and pass final frames in EMU. referenceArea is a sample, not a capacity quota or exclusion mask. For an unrotated right anchor R, choose width W and x = R - W: R=94 with W=40 gives x=54; W=55 gives x=39. Paragraph alignment alone does not position the block. Rotated/reflected bounds are not the typesetting frame; preserve frame/transform semantics. New content may have different widths, heights and block counts. Do not shorten user text or shrink fonts merely to match the sample. Guides describe the first meaningful run, not all mixed styles. This is initial composition guidance, not a fit guarantee or a reason for automatic metric/render/repair loops. For explicit fixed-slot filling, request includeFixedSlots:true; this preserves original frames and requirements.

`slides` supports `image`, `image-left`, `image-right`, and `chart` layouts. Image example: `{layout:"image-left",title:"New Workflow Is Shorter",image:{src:"assets/flow.png",alt:"Screenshot of the new workflow",fit:"contain"},bullets:["Generate directly","Edit specific slides"]}`. Local PNG/JPEG paths are resolved relative to the session `cwd`, and data URIs are also supported; limits are 5 MiB / 32 megapixels per image and 32 MiB total. Images are embedded into the project and output files, so they remain intact even if the original source files are moved. `contain` fits the entire image inside the frame, while `cover` crops from the center. External URLs and SVGs must first be prepared by an explicitly authorized tool—they are never downloaded automatically.

Chart example: `{layout:"chart",title:"Monthly Completions Keep Rising",chart:{kind:"column",categories:["July","August","September"],series:[{name:"Completions",values:[3,5,9]}],unit:"items"}}`. Supported chart kinds are `column`, `bar`, `line`, and `pie`; data can also be passed via `rows` with a header row. Category and value array lengths must match, and all values must be finite numbers; `pie` charts allow only one non-negative series with a positive sum. Native PPTX charts include an embedded editable data workbook, while HTML renders an SVG chart alongside an accessible data table for screen readers.

Shared branding is configured via `brand:{primaryColor:"#2C9F87",fontFamily:"Arial",logo:"logo.png",footer:"Product Team · 2026"}`. You can also specify background/text colors and `name`. Choose fonts available on the recipient's machine; font diagnostics will not install missing fonts automatically.


## Editing & Undo

Use the revision and IDs returned by the latest successful operation. Only if state is missing or stale, read `ppt_check {deckPath:"report.json"}`; never guess a revision or probe it through an intentional error. To edit: `ppt_edit {deckPath:"report.json",expectedRevision:0,edits:[{slide:3,patch:{title:"New Title",bullets:["Fact One","Action"]}}]}`. `slide` accepts a 1-based slide index or a stable slide ID, while all other slides remain unchanged; targeting the same slide multiple times in one call is rejected. `brand` can be updated independently; pass `brand:null` to clear branding, `logo:null` to remove the logo, or an empty `footer` string to clear the footer.

Duplicating & Removing: `ppt_edit {deckPath:"report.json",expectedRevision:0,duplicate:[2],remove:[3]}`. Both arrays resolve against pre-edit 1-based slide indices or stable IDs; duplicated slides are inserted immediately after their originals, receive new IDs, and retain images, charts, and speaker notes. A slide cannot be duplicated and removed in the same operation, nor specified twice, and the final deck must contain 1–120 slides. These operations can be combined with `edits` and `order` in a single call—edits and reordering are applied first, followed by duplication and removal; `order` must still include each original slide ID exactly once.

Edits atomically update the entire HTML/PPTX/JSON set and roll back on failure. Undo history retains up to 20 steps. `ppt_undo {deckPath:"report.json",expectedRevision:1}` restores the previous state, including slide structure, images, charts, and branding; `revision` continues incrementing forward, and stale modifications cannot overwrite an undone state. Only JSON projects created by this plugin can be edited—arbitrary external PPTX files cannot be imported for editing. If a table expands to the point of requiring pagination, you will be prompted to generate a new deck instead.


## Inspection & Rendering

`ppt_check` identifies slide-level issues, including content density, estimated text overflow, 14pt font sizing on 7–8 column tables, missing/corrupted/low-resolution images, chart label overlap, and color contrast. Native tables with up to 6 columns use 17pt font sizing. Static estimation does not guarantee exact font metrics or final visual layout.

Optionally install `npm install --ignore-scripts @deepseek-ai/libreoffice-kit@0.2.3` (bundled with DSH 0.2.2+; 0.1.5 is also compatible). Windows also requires the matching architecture's VC++ v14 runtime. Run `ppt_render {pptxPath:"report.pptx",format:"both"}` to read the final PPTX and output PNGs, PDF, and a render receipt without modifying the source file. Defaults: `format` is `"png"`, `width` is `1440` (range `320–3840`), and `timeoutMs` is `120000` (range `1000–300000`). Limits: up to 120 slides, 64 MiB input size, 128 MiB total output size, and 16 MP per image. If the rendering engine is missing, it returns `unavailable` along with installation instructions, while standard deck generation remains unaffected.

Extended review is opt-in. A successful creation is ready for delivery with known warnings; no separate check/render/pixel/metric pass is required. In a requested review, inspect the relevant pages and properties within the agreed scope. Do not automatically shorten text, change fonts or resize blocks to clear static estimates. LibreOffice does not guarantee pixel-for-pixel parity with Microsoft Office, and PNG/PDF outputs do not preserve animations. A successful render still carries the status `visual:not-verified`—never automatically claim visual inspection has passed.

If the current model cannot view images, or `read_image` reports `no adapter registered for provider` or another provider/adapter failure, immediately disclose that visual inspection could not be completed and ask the user to inspect all unchecked pages in the delivered PPTX/PDF/HTML. In a requested review, try one page before queueing others and stop on the first adapter failure. Use exact pngPaths and receiptPath shown in the ppt_render response, never shared-directory scans. This error concerns the image-viewing integration; it does not by itself mean rendering or the PNG file failed. Keep `visual:not-verified`, use structural results already returned, and deliver the generated artifacts. Do not automatically launch subagents, configure a review role, choose another provider/model or retry through another model. Separate AI review is opt-in and requires an explicit user request. Do not block delivery waiting for review-model selection.

Pass the returned `receiptPath` to `ppt_check {deckPath:"report.json",renderReceipt:".../render-receipt.json"}`. The checksums of the source file and all outputs must match; any subsequent modification or deletion invalidates the receipt. Re-render only if the requested review needs a current receipt. The receipt serves as a local integrity record, not a cryptographic signature.


## CLI

`--slides @slides.json`、`--brand @brand.json`、`--template weekly`。

`--edit report.json --edits @edits.json --revision 0`、`--undo report.json --revision 1`。

`--check report.json`、`--render report.pptx --format both`、`--check report.json --render-receipt receipt.json`。

By default, the render output directory is created next to the PPTX file; passing `--out` explicitly specifies the base directory, appending a suffix if the directory already exists. An unavailable rendering engine, static validation errors, or an invalidated explicit receipt will return a non-zero exit code.



## Safe scene editing and recovery

Use the latest returned revision and known object data. If missing/stale, read `ppt_check {deckPath, slide:5}` for the complete `selectedSlide`. Prefer `ppt_edit {deckPath, expectedRevision, edits:[{slide:5, patch:{elementUpdates:[{id:"existing-id", changes:{paragraphs:[{runs:[{text:"Updated",style:{color:"#FFFFFF"}}]}]}}]}}]}`. This updates existing objects by ID, preserving other objects and frames. Object fields are replaced when supplied, except `textStyle`, which merges; preserve unchanged paragraphs/runs when editing text. IDs and types cannot change in this mode.

`patch.elements` fully replaces the entire array, including decor; every element must be complete. Omitted objects are deleted. `designLayout` does not reinsert decor during editing. Do not combine `elements` with `elementUpdates`.

After an output/transport error, inspect the known project path and current revision before retrying: files may already have been saved. Undo unwanted edits with `ppt_undo` and inspect each restored version before considering recreation. `ppt_create overwrite:true` overwrites delivery files but creates a new internal JSON, new ID, revision 0 and empty history. Continue with its returned `jsonPath`; it does not repair the old project. `saveAs:true` saves a separate copy. Never select a project just because its directory is newest.

Coordinates, sizes and text-frame margins use integer EMU. Stroke and table-border thickness use points, 0–100, default 1; 9525 EMU = 0.75 pt. Font size and paragraph spacing use points; lineSpacing pct value 1 means 100%. Explicit `color` overrides inherited `colorSpec`; when both are explicitly supplied, `colorSpec` wins.

Check embedded template/library fonts and actual render `missingFonts` before reporting substitution. Missing system installation alone is not evidence of missing embedded fonts. Re-render after changes only when needed to assess the requested fix/review; static estimates do not constitute visual acceptance.
