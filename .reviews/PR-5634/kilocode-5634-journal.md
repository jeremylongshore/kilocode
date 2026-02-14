<!-- PR-JOURNAL-META
repo: Kilo-Org/kilocode
pr: 5634
title: "fix: context condensing prompt not saving properly"
author: Patel230
category: fix
tier: 2
lines: 33
files: 2
review_number: 13
fork_pr: null
-->

# Review Journal: kilocode #5634

> **PR**: [#5634](https://github.com/Kilo-Org/kilocode/pull/5634) |
> **Author**: @Patel230 | **Size**: 33 lines, 2 files | **Confidence**: 4/5

## Summary

Fixes textarea flickering when editing the condensing prompt by introducing a local state pattern. Before: typing triggered a round-trip through extension state, causing cursor reset. After: local state handles immediate input, syncs on blur. APPROVE — standard React controlled input fix with changeset.

## What Changed

Added `localCondensingPrompt` state that:
1. Initializes from extension state when switching to the CONDENSE tab
2. Updates immediately on keystroke (local, no round-trip)
3. Syncs back to extension state on `onBlur`

This is a textbook React pattern for controlled inputs that need to sync with external state (VS Code extension host in this case).

## Analysis

The pattern is applied only to the CONDENSE prompt, not the ENHANCE prompt. This suggests the flickering issue is specific to how condensing prompt state flows through the extension host. The `onBlur` handler duplicates some value extraction logic from `onChange` — minor, could be refactored into a shared helper, but not worth blocking on.

VS Code's web component wrappers (`<vscode-text-area>`) fire events differently from native HTML elements, requiring the `CustomEvent?.detail?.target?.value` fallback chain. This is the same pattern seen in PR #5826.

## Lessons Learned

- Local state prevents controlled input flickering when the source of truth has round-trip latency (e.g., VS Code extension host)
- VS Code web components cause controlled input issues that native HTML elements don't

---

<sub>Review #13 of 75 | [Methodology](https://github.com/jeremylongshore/kilocode/tree/main/.reviews)</sub>
