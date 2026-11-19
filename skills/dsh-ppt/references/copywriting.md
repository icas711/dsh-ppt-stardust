# dsh-ppt Slide Copywriting Rules (Bilingual)

## Structural Template

After clarifying the task through `ask_user_question`, choose a narrative suited to the audience and objective. The following is an optional reference:

1. **Cover**: Title (declarative statement or noun phrase + value proposition) + Subtitle (one-sentence positioning).
2. **Background / Problem**: Current state → Pain points → Why now.
3. **Solution / Arguments**: One slide per argument, leading with the conclusion followed by supporting reasons.
4. **Evidence / Case Studies**: Metrics, comparisons, customer proof, or data points.
5. **Call to Action (CTA)**: What you want the audience to do next.
6. **Closing Slide**: Thank you + contact details or restated CTA.

A short input still requires questions. Preserve the agreed scope and slide count; do not automatically add cover or closing pages.


## Single-Slide Rules

- Give each slide a main idea with supporting facts, explanations and evidence. Several text or visual blocks may be useful; do not reduce each slide to one phrase.
- Titles must be complete declarative statements—for example, *"AI Customer Support Cuts First Response Time to 8 Seconds"*, rather than *"About Customer Support"*.
- Use enough text to convey the material clearly. Edit for readability without dropping facts to fit arbitrary word limits.
- Prioritize numbers, comparisons, and strong verbs; avoid empty corporate buzzwords (such as *"empower"*, *"leverage point"*, or *"closed-loop"*).
- Use an actionable CTA when the presentation purpose calls for one.

## Bilingual Rules

- The plugin's `lang` parameter only controls UI elements (slide numbers, labels, default closing slide copy); **bilingual content must be authored during the writing stage**.
- Two recommended approaches for bilingual decks:
  1. **Single combined deck**: Chinese title + English subtitle on the same slide; primary bullets in Chinese with key English terms in parentheses.
  2. **Two separate decks**: Generate two versions from the same outline using `zh` and `en` respectively, keeping the theme consistent across both.
- Use Title Case for English titles; introduce technical terms with both languages on first mention, such as *"Retrieval-Augmented Generation (RAG)"*.
- Avoid literal word-for-word translation in bilingual decks—rewrite copy naturally to match the idioms and conventions of the target language.


## Markdown & Structured Input

For parsing rules, table/pull-quote/speaker-note syntax, and structured `slides` JSON, see `syntax.md`.

## Example

Input:

```markdown
# Cut Meetings in Half

Replace synchronous status meetings with asynchronous decision-making.

## Problem
- Engineers spend 6 hours per week in status meetings
- Decisions go unrecorded, causing repeated discussions

## Solution
- Pre-meeting async docs + 24-hour comment window
- Hold live meetings only for unresolved disagreements

## Results
- Weekly meetings reduced from 4 to 1
- 100% of decisions documented and preserved
```

Output: Cover → Problem → Solution → Results → Closing Slide (5 slides total); recommended themes are `swiss` (data/efficiency) or `soft` (team collaboration).

