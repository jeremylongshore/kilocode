<!-- PR-REVIEW-META
repo: Kilo-Org/kilocode
pr: 5826
title: "fix: prevent Create New Mode form fields from resetting while typing"
author: app/kiloconnect
category: fix
tier: 2
lines: 39
files: 3
confidence: 5
verdict: APPROVE
fork_pr: null
-->

## Review Summary

| Aspect | Assessment |
|--------|------------|
| **Verdict** | APPROVE |
| **Confidence** | 5/5 |
| **Blocking Issues** | 0 |

## Checklist

- [x] Changeset included
- [x] Two distinct bugs fixed
- [x] Native elements properly themed with VS Code CSS vars

## Analysis

### Fix 1: Form Reset (ModesView.tsx)

Replaces VS Code web components with native HTML elements:
- `VSCodeTextArea` → `<textarea>` (3 instances)
- `VSCodeTextField` → `<Input>` (1 instance)

VS Code web components reset their internal value on re-render. Native elements don't. Same pattern as #5634.

The native elements use proper VS Code theme variables (`--vscode-input-background`, etc.) for visual consistency.

### Fix 2: Blank Screen on Navigation (App.tsx)

Redirects `"modes"` tab switch to `"settings"` with `setCurrentSection("modes")`. Fixes blank screen when navigating from marketplace to modes tab — the "modes" tab doesn't exist as a standalone view, it's a section within settings.

## Recommendation

**APPROVE** — Clean fixes for two related UX bugs. Merge.

---
