# dsh-ppt Troubleshooting

Consult this file only when delivery issues occur.

| Symptom | Resolution |
| --- | --- |
| `ppt_create` does not exist | The plugin is not installed; use the standalone CLI `node <skill-dir>/scripts/build-deck.mjs` to generate the same three-file bundle |
| Unknown theme | Run `ppt_themes` or `--list-themes` to view available IDs; do not guess |
| Content exceeds 60 slides | Consolidate arguments or split into multiple decks; `maxSlides` defaults to 60 |
| PPTX cannot be opened | Verify file integrity (ZIP header `PK`); seeing a blank layout upon first opening in Office is normal, and edit view remains functional |
| Bilingual UI | `lang: bilingual` only localizes the UI; bilingual content must be authored by the agent during the writing phase |
| No animations during playback | `motion` is set to `off`; when set to the default `on`, HTML includes slide transitions and PPTX reveals bullets on click |
| Bullets missing when printing HTML | Print styles force all bullets to display; if still missing, check whether the browser is blocking animation styles |
| Missing dependencies for image, chart, or branding export | Reinstall the plugin; in a standalone skill directory, run `npm install --ignore-scripts` to install Office Kit 0.21.0 |
| `ppt_render` returns `unavailable` | Install the optional official Kit 0.2.3 (bundled with DSH 0.2.2+) or 0.1.5; on Windows, verify the matching VC++ v14 runtime |
| Receipt status is `not-verified` | The source PPTX or output files were modified, deleted, or mismatched in version; re-render using the current PPTX rather than relying on stale results |
| Revision number conflict | Re-read the current project state with `ppt_check`, then apply edits using the updated `revision` |
| Template still contains unfilled placeholders | Fill in real facts, evidence, and action items; mark as a draft rather than delivering as a final product |
| Render report flags missing fonts | Substitute with fonts available in both the local environment and the target machine, regenerate, and inspect slide by slide; any unresolved font issues must be noted, and the deck cannot be claimed as visually verified |

