<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5826
title: "fix: prevent Create New Mode form fields from resetting while typing"
author: app/kiloconnect
category: fix
tier: 2
lines: 39
files: 3
review_number: 15
fork_pr: null
-->

# Review Journal: kilocode #5826

> **PR**: [#5826](https://github.com/Kilo-Org/kilocode/pull/5826) |
> **Author**: kiloconnect (bot) | **Size**: 39 lines, 3 files | **Confidence**: 5/5

## Summary

Fixes two related UX bugs: (1) VS Code web components (`VSCodeTextArea`, `VSCodeTextField`) reset form values on re-render, replaced with native HTML elements themed with VS Code CSS variables; (2) navigating to "modes" tab showed a blank screen because it doesn't exist as a standalone view. APPROVE with changeset.

## What Changed

### Fix 1: Form Reset (ModesView.tsx)
Replaced 3 `VSCodeTextArea` instances and 1 `VSCodeTextField` with native `<textarea>` and `<Input>` elements. The native elements use VS Code theme variables (`--vscode-input-background`, `--vscode-input-foreground`, etc.) for visual consistency.

This is the same root cause as PR #5634 — VS Code web components have internal state that conflicts with React's controlled input pattern.

### Fix 2: Blank Screen Navigation (App.tsx)
When navigating from the marketplace to the "modes" tab, the app redirected to a non-existent standalone view. The fix redirects to the settings view with `setCurrentSection("modes")`, which renders modes as a section within settings.

## Lessons Learned

- VS Code web components cause controlled input issues that native HTML elements don't — this is now a confirmed pattern across PRs #5634 and #5826
- When replacing web components with native HTML, the VS Code CSS variable theming system (`--vscode-*`) provides visual consistency without the component framework

---

<sub>Review #15 of 75 | [Methodology](https://github.com/jeremylongshore/kilocode/tree/main/.reviews)</sub>
