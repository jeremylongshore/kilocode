<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5826
title: "fix: prevent Create New Mode form fields from resetting while typing"
author: app/kiloconnect
category: fix
tier: 2
lines: +24/-15
files: 3
review_number: N/A
fork_pr: N/A (batch review)
-->

# Review Journal: kilocode #5826

> **PR**: [#5826](https://github.com/Kilo-Org/kilocode/pull/5826) |
> **Title**: fix: prevent Create New Mode form fields from resetting while typing |
> **Author**: @app/kiloconnect |
> **Category**: fix | **Tier**: 2 | **Size**: +24/-15 lines, 3 files

---

## Summary

Fixes two UX bugs: (1) VS Code web components (`VSCodeTextArea`, `VSCodeTextField`) reset form values on re-render in the Create New Mode dialog, replaced with native HTML elements themed with VS Code CSS variables; (2) navigating to "modes" tab from marketplace showed a blank screen because it does not exist as a standalone tab. APPROVE.

## What Changed

Three files:

1. **`ModesView.tsx`** -- Replaces 3 `VSCodeTextArea` instances with native `<textarea>` elements and 1 `VSCodeTextField` with `<Input>`. The native elements receive VS Code theme classes (`bg-vscode-input-background`, `text-vscode-input-foreground`, `border-vscode-input-border`). Event handlers are simplified from `(e.target as HTMLTextAreaElement).value` to `e.target.value`.

2. **`App.tsx`** -- Adds a `"modes"` tab redirect: when `switchTab` action targets `"modes"`, the app sets `targetTab = "settings"` and calls `setCurrentSection("modes")`. This correctly routes to the modes section within the settings view.

3. **`fix-create-mode-form-reset.md`** -- Changeset (patch for `kilo-code`).

## Analysis

This is the same root cause as PR #5634 (condensing prompt flickering). VS Code's web component wrappers (`<vscode-text-area>`, `<vscode-text-field>`) are custom elements that maintain their own internal DOM state. When React re-renders the parent component, these custom elements reset their internal state, causing the user's typed text to vanish.

Native HTML `<textarea>` and `<input>` elements do not have this problem because React controls their value directly via the `value` prop. The fix is the right one -- swap web components for native elements and apply VS Code theme CSS variables for visual consistency.

The modes tab fix is orthogonal but correctly bundled in the same PR since it is also a navigation bug in the modes feature. The "modes" tab does not exist as a standalone view in the tab routing -- it is a section within settings. The redirect ensures users reach the correct destination.

## Bot Review Synthesis

| Bot | Status | Key Finding | Useful? |
|-----|--------|-------------|---------|
| CodeRabbit | Not collected | Batch review | N/A |
| Gemini | Not collected | Batch review | N/A |
| Greptile | Not collected | Batch review | N/A |
| CodeQL | Not collected | Batch review | N/A |
| Qodo | Not collected | Batch review | N/A |

## Lessons Learned

- VS Code web components cause controlled input issues that native HTML elements do not -- this is now a confirmed pattern across PRs #5634 and #5826. This should be documented as a known anti-pattern in the project.
- When replacing web components with native HTML, the VS Code CSS variable theming system (`--vscode-*`) provides visual consistency without the component framework overhead.
- Bundling two related UX fixes (form reset + navigation) in one PR is acceptable when they affect the same feature area and are both small.

---

<sub>Batch review | Static analysis only | [Methodology](https://github.com/jeremylongshore/kilocode/tree/main/.reviews) | Reviewed with Claude Code</sub>
