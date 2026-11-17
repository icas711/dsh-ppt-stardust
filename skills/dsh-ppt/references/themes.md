# dsh-ppt Built-In Themes Reference

The theme system is ported from the `visual-styles.md` visual style library of the `hyperframes` skill. Every theme uses the exact same color palette, font family, and mood guidelines across both HTML and PPTX exports.

> Want a preview first? Run `ppt_themes { preview: true, outputDir: "dist" }` to generate `themes-preview.html` along with a `theme-<id>.svg` file for each theme; these SVGs can be embedded directly in READMEs or npm landing pages.

## Quick Reference

| ID | Chinese Name | English | Mode | Background | Foreground | Primary Accent | Secondary Accent | Mood | Best For |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `data` | 数据漂移 | Data Drift | Dark | `#070B14` | `#E8F1FF` | `#7C3AED` | `#06B6D4` | Futuristic / Immersive | AI, data, research, tech launches |
| `swiss` | 瑞士脉冲 | Swiss Pulse | Dark | `#10151B` | `#F5F7FA` | `#2F6BFF` | `#FFB300` | Precise / Rational | SaaS, analytics, developer tools |
| `velvet` | 天鹅绒标准 | Velvet Standard | Dark | `#111316` | `#F4EFE6` | `#C9A84C` | `#3D4A63` | Premium / Restrained | Executive reports, branding, pitch decks |
| `soft` | 柔和信号 | Soft Signal | Light | `#FFF8EC` | `#3B2F2A` | `#E58A2F` | `#8FAF8C` | Warm / Human | Brand storytelling, training, personal talks |
| `bold` | 极繁大字 | Maximalist Type | Dark | `#0D0D0D` | `#FFFFFF` | `#E63946` | `#FFD60A` | Loud / Kinetic | Product launches, events, major announcements |

## Theme Breakdown

### data — Data Drift (Default)

- Deep black background + electric purple + cyan, light-weight futuristic typography.
- Ideal for AI / ML / data / frontier tech; use concise display titles and contrasting metrics.
- Anti-patterns: Do not introduce extraneous warm colors; avoid dense paragraphs of text.


### swiss — Swiss Pulse

- Black, white, and gray + a single electric blue (or amber), grid-driven layout, large numbers.
- Ideal for SaaS / metrics / developer tools; keep titles short and format bullets like technical specs.
- Anti-patterns: Do not use decorative gradient text; avoid stacking rounded-corner cards.

### velvet — Velvet Standard

- Black, off-white, and champagne gold; serif headings + sans-serif body text, wide letter spacing, generous whitespace.
- Ideal for executive reports / branding / fundraising; slow pacing with fewer, high-impact slides.
- Anti-patterns: Do not use flashy, overly animated colors; never use more than one accent color.

### soft — Soft Signal

- Warm cream background, dark brown text, amber + sage green; the only light-background theme in the palette.
- Ideal for brand storytelling / training / personal talks; copy can be more conversational.
- Anti-patterns: Do not use pure black for body text; avoid high-saturation clashing colors.

### bold — Maximalist Type

- Black background, true red + bright yellow, ultra-bold display titles where typography serves as the primary visual element.
- Ideal for product launches / events / major announcements; short headlines with a single focal punch per slide.
- Anti-patterns: Do not crowd slides with dense bullet lists; never introduce a third accent color beyond red and yellow.


## Theme Selection Decision Tree

1. Mood is futuristic / tech → `data`
2. Mood is rational / data-driven / precise → `swiss`
3. Mood is premium / trustworthy / formal → `velvet`
4. Mood is warm / human-centric / storytelling → `soft`
5. Mood is loud / launch event → `bold`

When in doubt, default to `data`—never invent custom theme IDs.

## Visual Engine Reuse (hyperframes)

If the `hyperframes` skill is installed, read its `visual-styles.md` / `house-style.md` first as a visual reference before generating; this skill's 5 themes are deterministic HTML+PPTX implementations of its Swiss Pulse, Velvet Standard, Data Drift, Soft Signal, and Maximalist Type styles. Switch to `hyperframes` only when an advanced animated video version is required; do not use a video engine for standard presentations.

